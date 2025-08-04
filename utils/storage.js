/**
 * Chrome Storage API のラッパークラス
 * ライフログデータの保存・取得・削除を管理
 */
class LifeLogStorage {
  constructor() {
    this.storage = chrome.storage.local;
  }

  /**
   * データを保存する
   * @param {string} key - 保存するキー
   * @param {any} value - 保存する値
   * @returns {Promise}
   */
  async set(key, value) {
    try {
      await this.storage.set({ [key]: value });
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  }

  /**
   * データを取得する
   * @param {string} key - 取得するキー
   * @returns {Promise<any>}
   */
  async get(key) {
    try {
      const result = await this.storage.get(key);
      return result[key];
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  }

  /**
   * 複数のキーのデータを取得する
   * @param {string[]} keys - 取得するキーの配列
   * @returns {Promise<Object>}
   */
  async getMultiple(keys) {
    try {
      return await this.storage.get(keys);
    } catch (error) {
      console.error('Storage getMultiple error:', error);
      return {};
    }
  }

  /**
   * データを削除する
   * @param {string} key - 削除するキー
   * @returns {Promise<boolean>}
   */
  async remove(key) {
    try {
      await this.storage.remove(key);
      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  }

  /**
   * すべてのデータを削除する
   * @returns {Promise<boolean>}
   */
  async clear() {
    try {
      await this.storage.clear();
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }

  /**
   * ライフログエントリを保存する
   * @param {Object} entry - ライフログエントリ
   * @returns {Promise<boolean>}
   */
  async saveLifeLogEntry(entry) {
    try {
      const entries = await this.getLifeLogEntries();
      entries.push(entry);
      
      // 最新のエントリを先頭に配置
      entries.sort((a, b) => b.timestamp - a.timestamp);
      
      await this.set('lifeLogEntries', entries);
      return true;
    } catch (error) {
      console.error('Save life log entry error:', error);
      return false;
    }
  }

  /**
   * ライフログエントリを取得する
   * @returns {Promise<Array>}
   */
  async getLifeLogEntries() {
    try {
      const entries = await this.get('lifeLogEntries');
      return entries || [];
    } catch (error) {
      console.error('Get life log entries error:', error);
      return [];
    }
  }

  /**
   * 特定の期間のライフログエントリを取得する
   * @param {Date} startDate - 開始日
   * @param {Date} endDate - 終了日
   * @returns {Promise<Array>}
   */
  async getLifeLogEntriesByDateRange(startDate, endDate) {
    try {
      const entries = await this.getLifeLogEntries();
      const startTimestamp = startDate.getTime();
      const endTimestamp = endDate.getTime();
      
      return entries.filter(entry => 
        entry.timestamp >= startTimestamp && entry.timestamp <= endTimestamp
      );
    } catch (error) {
      console.error('Get life log entries by date range error:', error);
      return [];
    }
  }

  /**
   * 設定を保存する
   * @param {Object} settings - 設定オブジェクト
   * @returns {Promise<boolean>}
   */
  async saveSettings(settings) {
    try {
      await this.set('settings', settings);
      return true;
    } catch (error) {
      console.error('Save settings error:', error);
      return false;
    }
  }

  /**
   * 設定を取得する
   * @returns {Promise<Object>}
   */
  async getSettings() {
    try {
      const settings = await this.get('settings');
      return settings || this.getDefaultSettings();
    } catch (error) {
      console.error('Get settings error:', error);
      return this.getDefaultSettings();
    }
  }

  /**
   * デフォルト設定を取得する
   * @returns {Object}
   */
  getDefaultSettings() {
    return {
      excludedDomains: [],
      dataRetentionDays: 365,
      autoBackup: false,
      notifications: true,
      privacyMode: false
    };
  }

  /**
   * 統計データを保存する
   * @param {Object} stats - 統計データ
   * @returns {Promise<boolean>}
   */
  async saveStats(stats) {
    try {
      await this.set('stats', stats);
      return true;
    } catch (error) {
      console.error('Save stats error:', error);
      return false;
    }
  }

  /**
   * 統計データを取得する
   * @returns {Promise<Object>}
   */
  async getStats() {
    try {
      const stats = await this.get('stats');
      return stats || {};
    } catch (error) {
      console.error('Get stats error:', error);
      return {};
    }
  }
}

// グローバルインスタンスを作成
const lifeLogStorage = new LifeLogStorage();

// モジュールエクスポート（ES6モジュール対応）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LifeLogStorage;
} 