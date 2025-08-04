/**
 * ライフログ Chrome 拡張機能 - オプションページスクリプト
 * 設定項目の管理、データ管理機能を提供
 */

class LifeLogOptions {
  constructor() {
    this.storage = chrome.storage.local;
    this.settings = null;
    this.excludedDomains = [];
    this.charts = {};
    
    this.initialize();
  }

  /**
   * 初期化処理
   */
  async initialize() {
    try {
      // 設定を読み込み
      await this.loadSettings();
      
      // イベントリスナーを設定
      this.setupEventListeners();
      
      // UIを更新
      this.updateUI();
      
      // 統計情報を読み込み
      await this.loadStats();
      
      console.log('LifeLog Options: Initialized successfully');
    } catch (error) {
      console.error('LifeLog Options: Initialization error:', error);
      this.showError('初期化に失敗しました');
    }
  }

  /**
   * 設定を読み込み
   */
  async loadSettings() {
    try {
      const result = await this.storage.get(['settings', 'excludedDomains']);
      this.settings = result.settings || this.getDefaultSettings();
      this.excludedDomains = result.excludedDomains || [];
    } catch (error) {
      console.error('LifeLog Options: Load settings error:', error);
      this.settings = this.getDefaultSettings();
      this.excludedDomains = [];
    }
  }

  /**
   * デフォルト設定を取得
   */
  getDefaultSettings() {
    return {
      dataRetentionDays: 365,
      notifications: true,
      privacyMode: false,
      autoBackup: false
    };
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners() {
    // 設定保存ボタン
    const saveBtn = document.getElementById('saveSettings');
    saveBtn.addEventListener('click', () => {
      this.saveSettings();
    });

    // 設定リセットボタン
    const resetBtn = document.getElementById('resetSettings');
    resetBtn.addEventListener('click', () => {
      this.resetSettings();
    });

    // 除外ドメイン追加
    const addDomainBtn = document.getElementById('addDomain');
    const domainInput = document.getElementById('domainInput');
    
    addDomainBtn.addEventListener('click', () => {
      this.addExcludedDomain();
    });

    domainInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addExcludedDomain();
      }
    });

    // エクスポートボタン
    const exportJSONBtn = document.getElementById('exportJSON');
    const exportCSVBtn = document.getElementById('exportCSV');
    
    exportJSONBtn.addEventListener('click', () => {
      this.exportData('json');
    });
    
    exportCSVBtn.addEventListener('click', () => {
      this.exportData('csv');
    });

    // インポートボタン
    const importBtn = document.getElementById('importData');
    const importFile = document.getElementById('importFile');
    
    importBtn.addEventListener('click', () => {
      importFile.click();
    });
    
    importFile.addEventListener('change', (e) => {
      this.importData(e.target.files[0]);
    });

    // データ削除ボタン
    const clearOldBtn = document.getElementById('clearOldData');
    const clearAllBtn = document.getElementById('clearAllData');
    
    clearOldBtn.addEventListener('click', () => {
      this.showConfirmModal('古いデータを削除', '設定された保持期間より古いデータを削除しますか？', () => {
        this.clearOldData();
      });
    });
    
    clearAllBtn.addEventListener('click', () => {
      this.showConfirmModal('すべてのデータを削除', 'すべてのライフログデータを削除します。この操作は取り消せません。', () => {
        this.clearAllData();
      });
    });

    // モーダル関連
    this.setupModal();
  }

  /**
   * モーダルの設定
   */
  setupModal() {
    const modal = document.getElementById('confirmModal');
    const closeBtn = modal.querySelector('.modal-close');
    const noBtn = document.getElementById('confirmNo');

    const closeModal = () => {
      modal.classList.remove('show');
    };

    closeBtn.addEventListener('click', closeModal);
    noBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  /**
   * UIを更新
   */
  updateUI() {
    // 基本設定
    document.getElementById('dataRetentionDays').value = this.settings.dataRetentionDays;
    document.getElementById('notifications').checked = this.settings.notifications;
    document.getElementById('privacyMode').checked = this.settings.privacyMode;

    // 除外ドメインリスト
    this.updateDomainList();
  }

  /**
   * 除外ドメインリストを更新
   */
  updateDomainList() {
    const domainList = document.getElementById('domainList');
    domainList.innerHTML = '';

    this.excludedDomains.forEach(domain => {
      const domainTag = document.createElement('div');
      domainTag.className = 'domain-tag';
      domainTag.innerHTML = `
        <span>${domain}</span>
        <button class="remove" data-domain="${domain}">&times;</button>
      `;

      domainTag.querySelector('.remove').addEventListener('click', () => {
        this.removeExcludedDomain(domain);
      });

      domainList.appendChild(domainTag);
    });
  }

  /**
   * 除外ドメインを追加
   */
  addExcludedDomain() {
    const domainInput = document.getElementById('domainInput');
    const domain = domainInput.value.trim();

    if (!domain) {
      this.showError('ドメインを入力してください');
      return;
    }

    if (this.excludedDomains.includes(domain)) {
      this.showError('このドメインは既に追加されています');
      return;
    }

    this.excludedDomains.push(domain);
    this.updateDomainList();
    domainInput.value = '';
    this.showSuccess('除外ドメインを追加しました');
  }

  /**
   * 除外ドメインを削除
   */
  removeExcludedDomain(domain) {
    this.excludedDomains = this.excludedDomains.filter(d => d !== domain);
    this.updateDomainList();
    this.showSuccess('除外ドメインを削除しました');
  }

  /**
   * 設定を保存
   */
  async saveSettings() {
    try {
      // 設定値を取得
      this.settings.dataRetentionDays = parseInt(document.getElementById('dataRetentionDays').value) || 365;
      this.settings.notifications = document.getElementById('notifications').checked;
      this.settings.privacyMode = document.getElementById('privacyMode').checked;

      // ストレージに保存
      await this.storage.set({
        settings: this.settings,
        excludedDomains: this.excludedDomains
      });

      // バックグラウンドスクリプトに設定を通知
      await chrome.runtime.sendMessage({
        action: 'updateSettings',
        settings: this.settings
      });

      this.showSuccess('設定を保存しました');
    } catch (error) {
      console.error('LifeLog Options: Save settings error:', error);
      this.showError('設定の保存に失敗しました');
    }
  }

  /**
   * 設定をリセット
   */
  async resetSettings() {
    try {
      this.settings = this.getDefaultSettings();
      this.excludedDomains = [];
      
      await this.storage.set({
        settings: this.settings,
        excludedDomains: this.excludedDomains
      });

      this.updateUI();
      this.showSuccess('設定をリセットしました');
    } catch (error) {
      console.error('LifeLog Options: Reset settings error:', error);
      this.showError('設定のリセットに失敗しました');
    }
  }

  /**
   * 統計情報を読み込み
   */
  async loadStats() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getStats' });
      if (response && response.success) {
        this.updateStats(response.data);
      }
    } catch (error) {
      console.error('LifeLog Options: Load stats error:', error);
    }
  }

  /**
   * 統計情報を更新
   */
  updateStats(stats) {
    document.getElementById('totalEntries').textContent = stats.totalEntries || 0;
    document.getElementById('uniqueDomains').textContent = stats.uniqueDomains || 0;
    document.getElementById('totalDuration').textContent = Math.round((stats.totalDuration || 0) / 60);
    document.getElementById('averageDuration').textContent = Math.round((stats.averageDuration || 0) / 60);
    
    // グラフを更新
    this.updateCharts(stats);
  }

  /**
   * データをエクスポート
   */
  async exportData(format) {
    try {
      const entries = await this.storage.get('lifeLogEntries');
      const data = entries.lifeLogEntries || [];

      let content, filename, mimeType;

      if (format === 'csv') {
        content = this.toCSV(data);
        filename = `life-log-${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      } else {
        content = JSON.stringify(data, null, 2);
        filename = `life-log-${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.showSuccess(`${format.toUpperCase()}形式でエクスポートしました`);
    } catch (error) {
      console.error('LifeLog Options: Export error:', error);
      this.showError('エクスポートに失敗しました');
    }
  }

  /**
   * CSV形式に変換
   */
  toCSV(entries) {
    if (entries.length === 0) return '';

    const headers = ['ID', 'URL', 'タイトル', 'ドメイン', 'アクセス時刻', '滞在時間', 'メモ', 'タグ'];
    const csvRows = [headers.join(',')];

    entries.forEach(entry => {
      const row = [
        entry.id,
        `"${entry.url}"`,
        `"${entry.title}"`,
        entry.domain,
        new Date(entry.timestamp).toISOString(),
        entry.visitDuration || 0,
        `"${entry.notes || ''}"`,
        `"${(entry.tags || []).join(',')}"`
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * データをインポート
   */
  async importData(file) {
    if (!file) return;

    try {
      const content = await this.readFile(file);
      let data;

      if (file.name.endsWith('.json')) {
        data = JSON.parse(content);
      } else if (file.name.endsWith('.csv')) {
        data = this.parseCSV(content);
      } else {
        this.showError('サポートされていないファイル形式です');
        return;
      }

      if (!Array.isArray(data)) {
        this.showError('無効なデータ形式です');
        return;
      }

      // 既存データとマージ
      const existingEntries = await this.storage.get('lifeLogEntries');
      const currentEntries = existingEntries.lifeLogEntries || [];
      const mergedEntries = [...currentEntries, ...data];

      // 重複を除去（IDベース）
      const uniqueEntries = mergedEntries.filter((entry, index, self) => 
        index === self.findIndex(e => e.id === entry.id)
      );

      await this.storage.set('lifeLogEntries', uniqueEntries);
      this.showSuccess(`${data.length}件のデータをインポートしました`);
      
      // 統計を更新
      await this.loadStats();
    } catch (error) {
      console.error('LifeLog Options: Import error:', error);
      this.showError('インポートに失敗しました');
    }
  }

  /**
   * ファイルを読み込み
   */
  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /**
   * CSVをパース
   */
  parseCSV(content) {
    const lines = content.split('\n');
    const headers = lines[0].split(',');
    const entries = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',');
      const entry = {};
      
      headers.forEach((header, index) => {
        let value = values[index] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        entry[header] = value;
      });
      
      entries.push(entry);
    }

    return entries;
  }

  /**
   * 古いデータを削除
   */
  async clearOldData() {
    try {
      await chrome.runtime.sendMessage({ action: 'performDataCleanup' });
      this.showSuccess('古いデータを削除しました');
      await this.loadStats();
    } catch (error) {
      console.error('LifeLog Options: Clear old data error:', error);
      this.showError('データの削除に失敗しました');
    }
  }

  /**
   * すべてのデータを削除
   */
  async clearAllData() {
    try {
      await this.storage.remove('lifeLogEntries');
      await this.storage.remove('stats');
      this.showSuccess('すべてのデータを削除しました');
      await this.loadStats();
    } catch (error) {
      console.error('LifeLog Options: Clear all data error:', error);
      this.showError('データの削除に失敗しました');
    }
  }

  /**
   * 確認モーダルを表示
   */
  showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const titleElement = document.getElementById('confirmTitle');
    const messageElement = document.getElementById('confirmMessage');
    const yesBtn = document.getElementById('confirmYes');

    titleElement.textContent = title;
    messageElement.textContent = message;

    // 既存のイベントリスナーを削除
    yesBtn.replaceWith(yesBtn.cloneNode(true));
    const newYesBtn = document.getElementById('confirmYes');

    // 新しいイベントリスナーを追加
    newYesBtn.addEventListener('click', () => {
      modal.classList.remove('show');
      onConfirm();
    });

    modal.classList.add('show');
  }

  /**
   * 成功メッセージを表示
   */
  showSuccess(message) {
    const successMessage = document.getElementById('successMessage');
    const successText = document.getElementById('successText');
    
    successText.textContent = message;
    successMessage.classList.add('show');
    
    setTimeout(() => {
      successMessage.classList.remove('show');
    }, 3000);
  }

  /**
   * グラフを更新
   */
  updateCharts(stats) {
    // Chart.jsが利用可能かチェック
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js is not available, skipping chart updates');
      return;
    }

    try {
      if (stats.hourlyDistribution) {
        this.updateHourlyChart(stats.hourlyDistribution);
      }
      
      if (stats.topDomains) {
        this.updateDomainChart(stats.topDomains);
      }
      
      if (stats.dailyStats) {
        this.updateDailyChart(stats.dailyStats);
      }
      
      if (stats.domainDistribution) {
        this.updateDurationChart(stats.domainDistribution);
      }
    } catch (error) {
      console.error('Error updating charts:', error);
    }
  }

  /**
   * 時間帯別グラフを更新
   */
  updateHourlyChart(hourlyData) {
    const ctx = document.getElementById('hourlyChart');
    if (!ctx) return;

    // Chart.jsが利用可能かチェック
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js is not available');
      return;
    }

    if (this.charts.hourly) {
      this.charts.hourly.destroy();
    }

    const labels = hourlyData.map((_, index) => `${index}:00`);
    const data = hourlyData.map(item => item.visits);

    this.charts.hourly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'アクセス数',
          data: data,
          backgroundColor: 'rgba(102, 126, 234, 0.8)',
          borderColor: '#667eea',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }

  /**
   * ドメイン別グラフを更新
   */
  updateDomainChart(domainData) {
    const ctx = document.getElementById('domainChart');
    if (!ctx) return;

    if (this.charts.domain) {
      this.charts.domain.destroy();
    }

    const top10 = domainData.slice(0, 10);
    const labels = top10.map(item => item.domain);
    const data = top10.map(item => item.visits);

    const colors = [
      '#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe',
      '#00f2fe', '#4facfe', '#43e97b', '#38f9d7', '#fa709a'
    ];

    this.charts.domain = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 15,
              padding: 10,
              font: {
                size: 11
              }
            }
          }
        }
      }
    });
  }

  /**
   * 日別グラフを更新
   */
  updateDailyChart(dailyData) {
    const ctx = document.getElementById('dailyChart');
    if (!ctx) return;

    if (this.charts.daily) {
      this.charts.daily.destroy();
    }

    // 最新の30日分を表示
    const recentData = dailyData.slice(0, 30).reverse();
    const labels = recentData.map(item => {
      const date = new Date(item.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    const data = recentData.map(item => item.visits);

    this.charts.daily = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'アクセス数',
          data: data,
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          },
          x: {
            ticks: {
              maxTicksLimit: 10
            }
          }
        }
      }
    });
  }

  /**
   * 滞在時間分布グラフを更新
   */
  updateDurationChart(domainData) {
    const ctx = document.getElementById('durationChart');
    if (!ctx) return;

    if (this.charts.duration) {
      this.charts.duration.destroy();
    }

    // 滞在時間の分布を計算
    const durationRanges = [
      { min: 0, max: 60, label: '1分未満' },
      { min: 60, max: 300, label: '1-5分' },
      { min: 300, max: 900, label: '5-15分' },
      { min: 900, max: 1800, label: '15-30分' },
      { min: 1800, max: 3600, label: '30分-1時間' },
      { min: 3600, max: Infinity, label: '1時間以上' }
    ];

    const durationCounts = durationRanges.map(range => {
      return domainData.filter(item => 
        item.duration >= range.min && item.duration < range.max
      ).length;
    });

    const labels = durationRanges.map(range => range.label);

    this.charts.duration = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'ページ数',
          data: durationCounts,
          backgroundColor: 'rgba(76, 175, 80, 0.8)',
          borderColor: '#4caf50',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }

  /**
   * エラーメッセージを表示
   */
  showError(message) {
    alert(message);
  }
}

// オプションページインスタンスを作成
document.addEventListener('DOMContentLoaded', () => {
  new LifeLogOptions();
}); 