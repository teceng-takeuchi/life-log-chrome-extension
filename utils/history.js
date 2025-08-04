/**
 * Chrome History API のラッパークラス
 * 履歴データの取得・フィルタリングを管理
 */
class LifeLogHistory {
  constructor() {
    this.history = chrome.history;
  }

  /**
   * URLからドメインを抽出する
   * @param {string} url - URL
   * @returns {string} ドメイン名
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      console.error('Domain extraction error:', error);
      return '';
    }
  }

  /**
   * 履歴アイテムをライフログエントリ形式に変換する
   * @param {Object} historyItem - Chrome履歴アイテム
   * @returns {Object} ライフログエントリ
   */
  convertToLifeLogEntry(historyItem) {
    return {
      id: this.generateId(),
      url: historyItem.url,
      title: historyItem.title || 'タイトルなし',
      domain: this.extractDomain(historyItem.url),
      timestamp: historyItem.lastVisitTime,
      visitDuration: 0, // 後で計算
      notes: '',
      tags: [],
      isBookmarked: false
    };
  }

  /**
   * 一意のIDを生成する
   * @returns {string} UUID
   */
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * 最近の履歴を取得する
   * @param {number} maxResults - 最大取得件数
   * @param {string} text - 検索テキスト（オプション）
   * @param {Date} startTime - 開始時刻（オプション）
   * @param {Date} endTime - 終了時刻（オプション）
   * @returns {Promise<Array>}
   */
  async getRecentHistory(maxResults = 100, text = '', startTime = null, endTime = null) {
    try {
      const query = {
        text: text,
        maxResults: maxResults
      };

      if (startTime) {
        query.startTime = startTime.getTime();
      }
      if (endTime) {
        query.endTime = endTime.getTime();
      }

      const historyItems = await this.history.search(query);
      return historyItems.map(item => this.convertToLifeLogEntry(item));
    } catch (error) {
      console.error('Get recent history error:', error);
      return [];
    }
  }

  /**
   * 特定の期間の履歴を取得する
   * @param {Date} startDate - 開始日
   * @param {Date} endDate - 終了日
   * @returns {Promise<Array>}
   */
  async getHistoryByDateRange(startDate, endDate) {
    try {
      const startTime = new Date(startDate);
      startTime.setHours(0, 0, 0, 0);
      
      const endTime = new Date(endDate);
      endTime.setHours(23, 59, 59, 999);

      return await this.getRecentHistory(1000, '', startTime, endTime);
    } catch (error) {
      console.error('Get history by date range error:', error);
      return [];
    }
  }

  /**
   * 特定のドメインの履歴を取得する
   * @param {string} domain - ドメイン名
   * @param {number} maxResults - 最大取得件数
   * @returns {Promise<Array>}
   */
  async getHistoryByDomain(domain, maxResults = 100) {
    try {
      const historyItems = await this.history.search({
        text: domain,
        maxResults: maxResults
      });

      return historyItems
        .filter(item => this.extractDomain(item.url) === domain)
        .map(item => this.convertToLifeLogEntry(item));
    } catch (error) {
      console.error('Get history by domain error:', error);
      return [];
    }
  }

  /**
   * 今日の履歴を取得する
   * @returns {Promise<Array>}
   */
  async getTodayHistory() {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    return await this.getHistoryByDateRange(startOfDay, endOfDay);
  }

  /**
   * 今週の履歴を取得する
   * @returns {Promise<Array>}
   */
  async getThisWeekHistory() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(today);
    endOfWeek.setHours(23, 59, 59, 999);

    return await this.getHistoryByDateRange(startOfWeek, endOfWeek);
  }

  /**
   * 今月の履歴を取得する
   * @returns {Promise<Array>}
   */
  async getThisMonthHistory() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    return await this.getHistoryByDateRange(startOfMonth, endOfMonth);
  }

  /**
   * 履歴アイテムを削除する
   * @param {string} url - 削除するURL
   * @returns {Promise<boolean>}
   */
  async deleteHistoryItem(url) {
    try {
      await this.history.deleteUrl({ url: url });
      return true;
    } catch (error) {
      console.error('Delete history item error:', error);
      return false;
    }
  }

  /**
   * 特定の期間の履歴を削除する
   * @param {Date} startTime - 開始時刻
   * @param {Date} endTime - 終了時刻
   * @returns {Promise<boolean>}
   */
  async deleteHistoryRange(startTime, endTime) {
    try {
      await this.history.deleteRange({
        startTime: startTime.getTime(),
        endTime: endTime.getTime()
      });
      return true;
    } catch (error) {
      console.error('Delete history range error:', error);
      return false;
    }
  }

  /**
   * すべての履歴を削除する
   * @returns {Promise<boolean>}
   */
  async deleteAllHistory() {
    try {
      await this.history.deleteAll();
      return true;
    } catch (error) {
      console.error('Delete all history error:', error);
      return false;
    }
  }

  /**
   * 履歴の変更を監視する
   * @param {Function} callback - 変更時のコールバック関数
   */
  onHistoryChanged(callback) {
    if (this.history && this.history.onVisited) {
      this.history.onVisited.addListener((historyItem) => {
        const entry = this.convertToLifeLogEntry(historyItem);
        callback(entry);
      });
    } else {
      console.warn('History API not available');
    }
  }

  /**
   * 履歴の変更監視を停止する
   */
  removeHistoryListener() {
    if (this.history.onVisited.hasListeners()) {
      this.history.onVisited.removeListeners();
    }
  }
}

// グローバルインスタンスを作成
const lifeLogHistory = new LifeLogHistory();

// モジュールエクスポート（ES6モジュール対応）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LifeLogHistory;
} 