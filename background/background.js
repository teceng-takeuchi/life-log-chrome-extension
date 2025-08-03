/**
 * ライフログ Chrome 拡張機能 - バックグラウンドスクリプト
 * 履歴変更の監視とライフログの自動記録を管理
 */

// ユーティリティクラスをインポート
importScripts('../utils/storage.js');
importScripts('../utils/history.js');
importScripts('../utils/dataProcessor.js');

class LifeLogBackground {
  constructor() {
    this.storage = lifeLogStorage;
    this.history = lifeLogHistory;
    this.dataProcessor = lifeLogDataProcessor;
    this.settings = null;
    this.isInitialized = false;
    
    // データプロセッサーにストレージを設定
    this.dataProcessor.setStorage(this.storage);
  }

  /**
   * 初期化処理
   */
  async initialize() {
    try {
      console.log('LifeLog Background: Initializing...');
      
      // 設定を読み込み
      this.settings = await this.storage.getSettings();
      
      // 履歴変更の監視を開始
      this.startHistoryMonitoring();
      
      // 既存の履歴データを同期
      await this.syncExistingHistory();
      
      // 定期的なデータ整理を設定
      this.setupDataCleanup();
      
      this.isInitialized = true;
      console.log('LifeLog Background: Initialized successfully');
    } catch (error) {
      console.error('LifeLog Background: Initialization error:', error);
    }
  }

  /**
   * 履歴変更の監視を開始
   */
  startHistoryMonitoring() {
    try {
      // Chrome履歴APIの監視を設定
      chrome.history.onVisited.addListener((historyItem) => {
        this.handleHistoryChange(historyItem);
      });
      
      console.log('LifeLog Background: History monitoring started');
    } catch (error) {
      console.error('LifeLog Background: Failed to start history monitoring:', error);
    }
  }

  /**
   * 既存の履歴データを同期
   */
  async syncExistingHistory() {
    try {
      console.log('LifeLog Background: Syncing existing history...');
      
      // 最近24時間の履歴を取得
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const recentHistory = await this.history.getRecentHistory(1000, '', oneDayAgo, new Date());
      
      // 既存のライフログエントリを取得
      const existingEntries = await this.storage.getLifeLogEntries();
      
      // 新しい履歴エントリを追加（重複を避ける）
      let addedCount = 0;
      for (const historyItem of recentHistory) {
        const isDuplicate = existingEntries.some(entry => 
          entry.url === historyItem.url && 
          Math.abs(entry.timestamp - historyItem.timestamp) < 60000 // 1分以内
        );
        
        if (!isDuplicate) {
          const success = await this.storage.saveLifeLogEntry(historyItem);
          if (success) {
            addedCount++;
          }
        }
      }
      
      console.log(`LifeLog Background: Synced ${addedCount} new history entries`);
      
      // 統計データを更新
      await this.updateStats();
    } catch (error) {
      console.error('LifeLog Background: Sync existing history error:', error);
    }
  }

  /**
   * 履歴変更時の処理
   * @param {Object} historyItem - Chrome履歴アイテム
   */
  async handleHistoryChange(historyItem) {
    try {
      // ライフログエントリに変換
      const entry = this.history.convertToLifeLogEntry(historyItem);
      
      // 除外ドメインのチェック
      if (this.isExcludedDomain(entry.domain)) {
        console.log(`LifeLog Background: Skipping excluded domain: ${entry.domain}`);
        return;
      }

      // 重複チェック
      if (await this.isDuplicateEntry(entry)) {
        console.log(`LifeLog Background: Skipping duplicate entry: ${entry.url}`);
        return;
      }

      // エントリを保存
      const success = await this.storage.saveLifeLogEntry(entry);
      if (success) {
        console.log(`LifeLog Background: Saved entry: ${entry.title}`);
        
        // 統計データを更新
        await this.updateStats();
        
        // 通知を送信（設定が有効な場合）
        if (this.settings.notifications) {
          this.showNotification(entry);
        }
      } else {
        console.error('LifeLog Background: Failed to save entry');
      }
    } catch (error) {
      console.error('LifeLog Background: Handle history change error:', error);
    }
  }

  /**
   * 除外ドメインかどうかをチェック
   * @param {string} domain - ドメイン名
   * @returns {boolean}
   */
  isExcludedDomain(domain) {
    if (!this.settings || !this.settings.excludedDomains) {
      return false;
    }
    
    return this.settings.excludedDomains.some(excludedDomain => 
      domain.includes(excludedDomain) || excludedDomain.includes(domain)
    );
  }

  /**
   * 重複エントリかどうかをチェック
   * @param {Object} entry - ライフログエントリ
   * @returns {Promise<boolean>}
   */
  async isDuplicateEntry(entry) {
    try {
      const recentEntries = await this.storage.getLifeLogEntries();
      const recentEntry = recentEntries.find(existingEntry => 
        existingEntry.url === entry.url && 
        Math.abs(existingEntry.timestamp - entry.timestamp) < 60000 // 1分以内
      );
      
      return !!recentEntry;
    } catch (error) {
      console.error('LifeLog Background: Duplicate check error:', error);
      return false;
    }
  }

  /**
   * 統計データを更新
   */
  async updateStats() {
    try {
      const entries = await this.storage.getLifeLogEntries();
      
      // データプロセッサーを使用して統計を計算
      const stats = this.dataProcessor.processStats(entries);
      
      // 統計データを保存
      await this.storage.saveStats(stats);
      console.log('LifeLog Background: Stats updated');
    } catch (error) {
      console.error('LifeLog Background: Update stats error:', error);
    }
  }



  /**
   * 通知を表示
   * @param {Object} entry - ライフログエントリ
   */
  showNotification(entry) {
    try {
      // 通知機能が利用可能かチェック
      if (chrome.notifications && typeof chrome.notifications.create === 'function') {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: '../assets/icon48.png',
          title: 'ライフログ',
          message: `新しいページを記録しました: ${entry.title}`
        });
      } else {
        console.warn('Notifications API not available');
      }
    } catch (error) {
      console.error('LifeLog Background: Show notification error:', error);
    }
  }

  /**
   * 定期的なデータ整理を設定
   */
  setupDataCleanup() {
    try {
      // 毎日午前2時にデータ整理を実行
      chrome.alarms.create('dataCleanup', {
        when: this.getNextCleanupTime(),
        periodInMinutes: 24 * 60 // 24時間
      });

      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'dataCleanup') {
          this.performDataCleanup();
        }
      });

      console.log('LifeLog Background: Data cleanup scheduled');
    } catch (error) {
      console.error('LifeLog Background: Setup data cleanup error:', error);
    }
  }

  /**
   * 次回のデータ整理時刻を取得
   * @returns {number}
   */
  getNextCleanupTime() {
    const now = new Date();
    const cleanupTime = new Date(now);
    cleanupTime.setHours(2, 0, 0, 0); // 午前2時
    
    if (cleanupTime <= now) {
      cleanupTime.setDate(cleanupTime.getDate() + 1);
    }
    
    return cleanupTime.getTime();
  }

  /**
   * データ整理を実行
   */
  async performDataCleanup() {
    try {
      console.log('LifeLog Background: Starting data cleanup...');
      
      const settings = await this.storage.getSettings();
      const retentionDays = settings.dataRetentionDays || 365;
      
      // 古いデータを削除
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const entries = await this.storage.getLifeLogEntries();
      const validEntries = entries.filter(entry => 
        entry.timestamp >= cutoffDate.getTime()
      );

      // 有効なエントリのみを保存
      await this.storage.set('lifeLogEntries', validEntries);
      
      console.log(`LifeLog Background: Data cleanup completed. Removed ${entries.length - validEntries.length} old entries`);
    } catch (error) {
      console.error('LifeLog Background: Data cleanup error:', error);
    }
  }

  /**
   * 設定を更新
   * @param {Object} newSettings - 新しい設定
   */
  async updateSettings(newSettings) {
    try {
      this.settings = { ...this.settings, ...newSettings };
      await this.storage.saveSettings(this.settings);
      console.log('LifeLog Background: Settings updated');
    } catch (error) {
      console.error('LifeLog Background: Update settings error:', error);
    }
  }
}

// バックグラウンドインスタンスを作成
const lifeLogBackground = new LifeLogBackground();

// 拡張機能のインストール時に初期化
chrome.runtime.onInstalled.addListener(() => {
  lifeLogBackground.initialize();
});

// 拡張機能の起動時に初期化
chrome.runtime.onStartup.addListener(() => {
  lifeLogBackground.initialize();
});

// メッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getStats':
      lifeLogBackground.storage.getStats().then(stats => {
        sendResponse({ success: true, data: stats });
      });
      return true; // 非同期レスポンスを示す

    case 'getRecentHistory':
      lifeLogBackground.history.getRecentHistory(request.maxResults || 50).then(entries => {
        sendResponse({ success: true, data: entries });
      });
      return true;

    case 'getLifeLogEntries':
      lifeLogBackground.storage.getLifeLogEntries().then(entries => {
        sendResponse({ success: true, data: entries });
      });
      return true;

    case 'syncHistory':
      lifeLogBackground.syncExistingHistory().then(() => {
        sendResponse({ success: true });
      });
      return true;

    case 'updateSettings':
      lifeLogBackground.updateSettings(request.settings).then(() => {
        sendResponse({ success: true });
      });
      return true;

    case 'performDataCleanup':
      lifeLogBackground.performDataCleanup().then(() => {
        sendResponse({ success: true });
      });
      return true;

    case 'getStorage':
      sendResponse({ success: true, data: lifeLogBackground.storage });
      return false;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
  }
});

console.log('LifeLog Background: Service worker loaded'); 