/**
 * ライフログ Chrome 拡張機能 - ポップアップスクリプト
 * 履歴表示、検索、フィルタリング、メモ機能を管理
 */

class LifeLogPopup {
  constructor() {
    this.storage = null;
    this.currentEntries = [];
    this.currentFilter = 'all';
    this.currentSearch = '';
    this.editingEntryId = null;
    this.charts = {};
    
    this.initialize();
  }

  /**
   * 初期化処理
   */
  async initialize() {
    try {
      // ストレージクラスを初期化
      await this.loadStorage();
      
      // イベントリスナーを設定
      this.setupEventListeners();
      
      // 初期データを読み込み
      await this.loadData();
      
      console.log('LifeLog Popup: Initialized successfully');
    } catch (error) {
      console.error('LifeLog Popup: Initialization error:', error);
      this.showError('初期化に失敗しました');
    }
  }

  /**
   * ストレージクラスを読み込み
   */
  async loadStorage() {
    // 直接ストレージAPIを使用
    this.storage = chrome.storage.local;
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners() {
    // 検索入力
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
      this.currentSearch = e.target.value;
      this.filterAndDisplayEntries();
    });

    // フィルター選択
    const filterSelect = document.getElementById('filterSelect');
    filterSelect.addEventListener('change', (e) => {
      this.currentFilter = e.target.value;
      this.filterAndDisplayEntries();
    });

    // 設定ボタン
    const openOptionsBtn = document.getElementById('openOptions');
    openOptionsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // 履歴同期ボタン
    const syncBtn = document.getElementById('syncHistory');
    syncBtn.addEventListener('click', () => {
      this.syncHistory();
    });

    // エクスポートボタン
    const exportBtn = document.getElementById('exportData');
    exportBtn.addEventListener('click', () => {
      this.exportData();
    });

    // メモモーダル関連
    this.setupNoteModal();
  }

  /**
   * メモモーダルの設定
   */
  setupNoteModal() {
    const modal = document.getElementById('noteModal');
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = document.getElementById('cancelNote');
    const saveBtn = document.getElementById('saveNote');
    const textarea = document.getElementById('noteTextarea');

    // モーダルを閉じる
    const closeModal = () => {
      modal.classList.remove('show');
      this.editingEntryId = null;
      textarea.value = '';
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // モーダル外クリックで閉じる
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // 保存ボタン
    saveBtn.addEventListener('click', async () => {
      await this.saveNote(textarea.value);
      closeModal();
    });

    // Enterキーで保存
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        saveBtn.click();
      }
    });
  }

  /**
   * データを読み込み
   */
  async loadData() {
    try {
      // 現在のスクロール位置を保存
      const container = document.querySelector('.container');
      const scrollTop = container ? container.scrollTop : 0;

      this.showLoading();
      
      // 統計データを取得
      try {
        const statsResponse = await chrome.runtime.sendMessage({ action: 'getStats' });
        if (statsResponse && statsResponse.success) {
          this.updateStats(statsResponse.data);
        }
      } catch (statsError) {
        console.warn('Stats loading failed, using empty stats:', statsError);
        this.updateStats({});
      }

      // 履歴エントリを取得
      const entries = await this.getLifeLogEntries();
      // 安全な初期化
      this.currentEntries = Array.isArray(entries) ? entries : [];
      
      this.filterAndDisplayEntries();
      this.hideLoading();

      // スクロール位置を復元
      if (container) {
        container.scrollTop = scrollTop;
      }
    } catch (error) {
      console.error('LifeLog Popup: Load data error:', error);
      this.showError('データの読み込みに失敗しました');
      // エラー時も安全な初期化
      this.currentEntries = [];
    }
  }

  /**
   * ライフログエントリを取得
   */
  async getLifeLogEntries() {
    try {
      // バックグラウンドからデータを取得
      const response = await chrome.runtime.sendMessage({ action: 'getLifeLogEntries' });
      if (response && response.success) {
        return Array.isArray(response.data) ? response.data : [];
      } else {
        // フォールバック: ローカルストレージから取得
        const result = await this.storage.get('lifeLogEntries');
        return Array.isArray(result) ? result : [];
      }
    } catch (error) {
      console.error('LifeLog Popup: Get entries error:', error);
      // フォールバック: ローカルストレージから取得
      try {
        const result = await this.storage.get('lifeLogEntries');
        return Array.isArray(result) ? result : [];
      } catch (fallbackError) {
        console.error('LifeLog Popup: Fallback get entries error:', fallbackError);
        return [];
      }
    }
  }

  /**
   * エントリをフィルタリングして表示
   */
  filterAndDisplayEntries() {
    // 安全な初期化
    if (!this.currentEntries || !Array.isArray(this.currentEntries)) {
      this.currentEntries = [];
    }
    let filteredEntries = Array.from(this.currentEntries);

    // フィルター適用
    switch (this.currentFilter) {
      case 'today':
        filteredEntries = this.filterByToday(filteredEntries);
        break;
      case 'week':
        filteredEntries = this.filterByWeek(filteredEntries);
        break;
      case 'month':
        filteredEntries = this.filterByMonth(filteredEntries);
        break;
    }

    // 検索フィルター適用
    if (this.currentSearch.trim()) {
      filteredEntries = this.filterBySearch(filteredEntries, this.currentSearch);
    }

    // 最新順にソート
    filteredEntries.sort((a, b) => b.timestamp - a.timestamp);

    this.displayEntries(filteredEntries);
  }

  /**
   * 今日のエントリをフィルタリング
   */
  filterByToday(entries) {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    
    return entries.filter(entry => 
      entry.timestamp >= startOfDay.getTime()
    );
  }

  /**
   * 今週のエントリをフィルタリング
   */
  filterByWeek(entries) {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    return entries.filter(entry => 
      entry.timestamp >= startOfWeek.getTime()
    );
  }

  /**
   * 今月のエントリをフィルタリング
   */
  filterByMonth(entries) {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    return entries.filter(entry => 
      entry.timestamp >= startOfMonth.getTime()
    );
  }

  /**
   * 検索でフィルタリング
   */
  filterBySearch(entries, searchTerm) {
    const term = searchTerm.toLowerCase();
    return entries.filter(entry => 
      entry.title.toLowerCase().includes(term) ||
      entry.domain.toLowerCase().includes(term) ||
      entry.url.toLowerCase().includes(term) ||
      (entry.notes && entry.notes.toLowerCase().includes(term))
    );
  }

  /**
   * エントリを表示
   */
  displayEntries(entries) {
    const historyList = document.getElementById('historyList');
    const template = document.getElementById('historyItemTemplate');
    
    // リストをクリア
    historyList.innerHTML = '';

    if (entries.length === 0) {
      historyList.innerHTML = '<div class="loading">履歴がありません</div>';
      return;
    }

    // 最新の10件のみ表示
    const displayEntries = entries.slice(0, 10);

    displayEntries.forEach(entry => {
      const clone = template.content.cloneNode(true);
      
      // タイトル
      const titleElement = clone.querySelector('.history-title');
      titleElement.textContent = entry.title;
      titleElement.title = entry.title;

      // ドメイン
      const domainElement = clone.querySelector('.history-domain');
      domainElement.textContent = entry.domain;

      // 時間
      const timeElement = clone.querySelector('.history-time');
      timeElement.textContent = this.formatTime(entry.timestamp);

      // メモ編集ボタン
      const editBtn = clone.querySelector('.btn-edit');
      editBtn.addEventListener('click', () => {
        this.openNoteModal(entry);
      });

      // 削除ボタン
      const deleteBtn = clone.querySelector('.btn-delete');
      deleteBtn.addEventListener('click', () => {
        this.deleteEntry(entry.id);
      });

      historyList.appendChild(clone);
    });
  }

  /**
   * 時間をフォーマット
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) { // 1分未満
      return '今';
    } else if (diff < 3600000) { // 1時間未満
      const minutes = Math.floor(diff / 60000);
      return `${minutes}分前`;
    } else if (diff < 86400000) { // 1日未満
      const hours = Math.floor(diff / 3600000);
      return `${hours}時間前`;
    } else {
      return date.toLocaleDateString('ja-JP');
    }
  }

  /**
   * 統計情報を更新
   */
  updateStats(stats) {
    // 今日の件数
    const todayCount = document.getElementById('todayCount');
    todayCount.textContent = stats.todayEntries || 0;

    // 総件数
    const totalCount = document.getElementById('totalCount');
    totalCount.textContent = stats.totalEntries || 0;

    // ユニークドメイン数
    const uniqueDomains = document.getElementById('uniqueDomains');
    uniqueDomains.textContent = stats.uniqueDomains || 0;

    // 最も訪問したドメイン
    const topDomain = document.getElementById('topDomain');
    if (stats.topDomains && stats.topDomains.length > 0) {
      topDomain.textContent = stats.topDomains[0].domain;
    } else {
      topDomain.textContent = '-';
    }

    // グラフを更新（データがある場合のみ）
    if (stats.hourlyDistribution || stats.topDomains) {
      this.updateCharts(stats);
    }
  }

  /**
   * メモモーダルを開く
   */
  openNoteModal(entry) {
    this.editingEntryId = entry.id;
    const textarea = document.getElementById('noteTextarea');
    textarea.value = entry.notes || '';
    
    const modal = document.getElementById('noteModal');
    modal.classList.add('show');
    textarea.focus();
  }

  /**
   * メモを保存
   */
  async saveNote(noteText) {
    try {
      if (!this.editingEntryId) return;

      const entries = await this.getLifeLogEntries();
      const entryIndex = entries.findIndex(entry => entry.id === this.editingEntryId);
      
      if (entryIndex !== -1) {
        entries[entryIndex].notes = noteText;
        await this.storage.set('lifeLogEntries', entries);
        this.currentEntries = entries;
        this.filterAndDisplayEntries();
      }
    } catch (error) {
      console.error('LifeLog Popup: Save note error:', error);
      this.showError('メモの保存に失敗しました');
    }
  }

  /**
   * エントリを削除
   */
  async deleteEntry(entryId) {
    if (!confirm('この履歴を削除しますか？')) {
      return;
    }

    try {
      const entries = await this.getLifeLogEntries();
      const filteredEntries = entries.filter(entry => entry.id !== entryId);
      
      await this.storage.set('lifeLogEntries', filteredEntries);
      this.currentEntries = filteredEntries;
      this.filterAndDisplayEntries();
      
      // 統計を更新
      await this.loadData();
    } catch (error) {
      console.error('LifeLog Popup: Delete entry error:', error);
      this.showError('削除に失敗しました');
    }
  }

  /**
   * 履歴を同期
   */
  async syncHistory() {
    try {
      // 現在のスクロール位置を保存
      const container = document.querySelector('.container');
      const scrollTop = container ? container.scrollTop : 0;

      this.showLoading();
      
      const response = await chrome.runtime.sendMessage({ action: 'syncHistory' });
      if (response && response.success) {
        // データを再読み込み
        await this.loadData();
        console.log('LifeLog Popup: History synced successfully');
      } else {
        this.showError('履歴の同期に失敗しました');
      }

      // スクロール位置を復元
      if (container) {
        container.scrollTop = scrollTop;
      }
    } catch (error) {
      console.error('LifeLog Popup: Sync history error:', error);
      this.showError('履歴の同期に失敗しました');
    }
  }

  /**
   * データをエクスポート
   */
  async exportData() {
    try {
      const entries = await this.getLifeLogEntries();
      const dataStr = JSON.stringify(entries, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `life-log-${new Date().toISOString().split('T')[0]}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('LifeLog Popup: Export error:', error);
      this.showError('エクスポートに失敗しました');
    }
  }

  /**
   * ローディング表示
   */
  showLoading() {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '<div class="loading">読み込み中...</div>';
  }

  /**
   * ローディング非表示
   */
  hideLoading() {
    // ローディング状態は自動的に解除される
  }

  /**
   * グラフを更新
   */
  updateCharts(stats) {
    try {
      // Chart.jsが利用可能かチェック
      if (typeof Chart === 'undefined') {
        console.warn('Chart.js is not available, skipping chart updates');
        return;
      }

      // 現在のスクロール位置を保存
      const container = document.querySelector('.container');
      const scrollTop = container ? container.scrollTop : 0;

      if (stats.hourlyDistribution && stats.hourlyDistribution.length > 0) {
        this.updateHourlyChart(stats.hourlyDistribution);
      }
      
      if (stats.topDomains && stats.topDomains.length > 0) {
        this.updateDomainChart(stats.topDomains);
      }

      // スクロール位置を復元
      if (container) {
        container.scrollTop = scrollTop;
      }
    } catch (error) {
      console.error('Chart update error:', error);
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
      console.warn('Chart.js is not available, skipping hourly chart update');
      return;
    }

    try {
      // 既存のチャートを破棄
      if (this.charts.hourly) {
        this.charts.hourly.destroy();
      }

      const labels = hourlyData.map((_, index) => `${index}:00`);
      const data = hourlyData.map(item => item.visits);

      this.charts.hourly = new Chart(ctx, {
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
          aspectRatio: 2,
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
                maxTicksLimit: 12
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Error creating hourly chart:', error);
    }
  }

  /**
   * ドメイン別グラフを更新
   */
  updateDomainChart(domainData) {
    const ctx = document.getElementById('domainChart');
    if (!ctx) return;

    // Chart.jsが利用可能かチェック
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js is not available, skipping domain chart update');
      return;
    }

    try {
      // 既存のチャートを破棄
      if (this.charts.domain) {
        this.charts.domain.destroy();
      }

      // 上位5件のみ表示
      const top5 = domainData.slice(0, 5);
      const labels = top5.map(item => {
        // ドメイン名を短縮（20文字を超える場合）
        const domain = item.domain;
        return domain.length > 20 ? domain.substring(0, 17) + '...' : domain;
      });
      const data = top5.map(item => item.visits);

      // カラーパレット
      const colors = [
        '#667eea',
        '#764ba2',
        '#f093fb',
        '#f5576c',
        '#4facfe'
      ];

      this.charts.domain = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors,
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          aspectRatio: 1.5,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                padding: 8,
                font: {
                  size: 10
                },
                generateLabels: function(chart) {
                  const data = chart.data;
                  if (data.labels.length && data.datasets.length) {
                    return data.labels.map((label, i) => {
                      const dataset = data.datasets[0];
                      const value = dataset.data[i];
                      const originalDomain = top5[i].domain;
                      
                      return {
                        text: `${label} (${value})`,
                        fillStyle: colors[i],
                        strokeStyle: colors[i],
                        lineWidth: 0,
                        hidden: false,
                        index: i,
                        title: originalDomain // ツールチップで完全なドメイン名を表示
                      };
                    });
                  }
                  return [];
                }
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const originalDomain = top5[context.dataIndex].domain;
                  return `${originalDomain}: ${context.parsed}`;
                }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Error creating domain chart:', error);
    }
  }

  /**
   * エラー表示
   */
  showError(message) {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = `<div class="loading" style="color: #dc3545;">${message}</div>`;
  }
}

// ポップアップインスタンスを作成
document.addEventListener('DOMContentLoaded', () => {
  new LifeLogPopup();
}); 