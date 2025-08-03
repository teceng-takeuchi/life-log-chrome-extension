/**
 * ライフログデータ処理クラス
 * データの集計・統計、フィルタリング、グループ化を管理
 */
class LifeLogDataProcessor {
  constructor() {
    this.storage = null;
  }

  /**
   * ストレージインスタンスを設定
   * @param {Object} storage - ストレージインスタンス
   */
  setStorage(storage) {
    this.storage = storage;
  }

  /**
   * データを集計・統計処理
   * @param {Array} entries - ライフログエントリの配列
   * @returns {Object} 統計データ
   */
  processStats(entries) {
    if (!entries || entries.length === 0) {
      return this.getEmptyStats();
    }

    const stats = {
      totalEntries: entries.length,
      uniqueDomains: this.getUniqueDomains(entries),
      totalDuration: this.calculateTotalDuration(entries),
      averageDuration: this.calculateAverageDuration(entries),
      topDomains: this.getTopDomains(entries, 10),
      dailyStats: this.getDailyStats(entries),
      weeklyStats: this.getWeeklyStats(entries),
      monthlyStats: this.getMonthlyStats(entries),
      hourlyDistribution: this.getHourlyDistribution(entries),
      domainDistribution: this.getDomainDistribution(entries),
      lastUpdated: Date.now()
    };

    return stats;
  }

  /**
   * 空の統計データを取得
   * @returns {Object}
   */
  getEmptyStats() {
    return {
      totalEntries: 0,
      uniqueDomains: 0,
      totalDuration: 0,
      averageDuration: 0,
      topDomains: [],
      dailyStats: [],
      weeklyStats: [],
      monthlyStats: [],
      hourlyDistribution: [],
      domainDistribution: [],
      lastUpdated: Date.now()
    };
  }

  /**
   * ユニークドメイン数を取得
   * @param {Array} entries - ライフログエントリの配列
   * @returns {number}
   */
  getUniqueDomains(entries) {
    const domains = new Set(entries.map(entry => entry.domain).filter(Boolean));
    return domains.size;
  }

  /**
   * 総滞在時間を計算
   * @param {Array} entries - ライフログエントリの配列
   * @returns {number}
   */
  calculateTotalDuration(entries) {
    return entries.reduce((total, entry) => total + (entry.visitDuration || 0), 0);
  }

  /**
   * 平均滞在時間を計算
   * @param {Array} entries - ライフログエントリの配列
   * @returns {number}
   */
  calculateAverageDuration(entries) {
    if (entries.length === 0) return 0;
    const totalDuration = this.calculateTotalDuration(entries);
    return Math.round(totalDuration / entries.length);
  }

  /**
   * 上位ドメインを取得
   * @param {Array} entries - ライフログエントリの配列
   * @param {number} limit - 取得件数
   * @returns {Array}
   */
  getTopDomains(entries, limit = 10) {
    const domainCounts = {};
    
    entries.forEach(entry => {
      if (entry.domain) {
        if (!domainCounts[entry.domain]) {
          domainCounts[entry.domain] = {
            domain: entry.domain,
            visits: 0,
            duration: 0
          };
        }
        domainCounts[entry.domain].visits++;
        domainCounts[entry.domain].duration += entry.visitDuration || 0;
      }
    });

    return Object.values(domainCounts)
      .sort((a, b) => b.visits - a.visits)
      .slice(0, limit);
  }

  /**
   * 日別統計を取得
   * @param {Array} entries - ライフログエントリの配列
   * @returns {Array}
   */
  getDailyStats(entries) {
    const dailyStats = {};
    
    entries.forEach(entry => {
      const date = new Date(entry.timestamp);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = {
          date: dateKey,
          visits: 0,
          uniqueDomains: new Set(),
          duration: 0
        };
      }
      
      dailyStats[dateKey].visits++;
      dailyStats[dateKey].uniqueDomains.add(entry.domain);
      dailyStats[dateKey].duration += entry.visitDuration || 0;
    });

    return Object.values(dailyStats).map(stat => ({
      ...stat,
      uniqueDomains: stat.uniqueDomains.size
    })).sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * 週別統計を取得
   * @param {Array} entries - ライフログエントリの配列
   * @returns {Array}
   */
  getWeeklyStats(entries) {
    const weeklyStats = {};
    
    entries.forEach(entry => {
      const date = new Date(entry.timestamp);
      const weekStart = this.getWeekStart(date);
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyStats[weekKey]) {
        weeklyStats[weekKey] = {
          weekStart: weekKey,
          visits: 0,
          uniqueDomains: new Set(),
          duration: 0
        };
      }
      
      weeklyStats[weekKey].visits++;
      weeklyStats[weekKey].uniqueDomains.add(entry.domain);
      weeklyStats[weekKey].duration += entry.visitDuration || 0;
    });

    return Object.values(weeklyStats).map(stat => ({
      ...stat,
      uniqueDomains: stat.uniqueDomains.size
    })).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }

  /**
   * 月別統計を取得
   * @param {Array} entries - ライフログエントリの配列
   * @returns {Array}
   */
  getMonthlyStats(entries) {
    const monthlyStats = {};
    
    entries.forEach(entry => {
      const date = new Date(entry.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = {
          month: monthKey,
          visits: 0,
          uniqueDomains: new Set(),
          duration: 0
        };
      }
      
      monthlyStats[monthKey].visits++;
      monthlyStats[monthKey].uniqueDomains.add(entry.domain);
      monthlyStats[monthKey].duration += entry.visitDuration || 0;
    });

    return Object.values(monthlyStats).map(stat => ({
      ...stat,
      uniqueDomains: stat.uniqueDomains.size
    })).sort((a, b) => b.month.localeCompare(a.month));
  }

  /**
   * 時間帯別分布を取得
   * @param {Array} entries - ライフログエントリの配列
   * @returns {Array}
   */
  getHourlyDistribution(entries) {
    const hourlyStats = Array(24).fill(0).map((_, hour) => ({
      hour: hour,
      visits: 0,
      duration: 0
    }));
    
    entries.forEach(entry => {
      const date = new Date(entry.timestamp);
      const hour = date.getHours();
      hourlyStats[hour].visits++;
      hourlyStats[hour].duration += entry.visitDuration || 0;
    });

    return hourlyStats;
  }

  /**
   * ドメイン分布を取得
   * @param {Array} entries - ライフログエントリの配列
   * @returns {Array}
   */
  getDomainDistribution(entries) {
    const domainStats = {};
    
    entries.forEach(entry => {
      if (entry.domain) {
        if (!domainStats[entry.domain]) {
          domainStats[entry.domain] = {
            domain: entry.domain,
            visits: 0,
            duration: 0,
            percentage: 0
          };
        }
        domainStats[entry.domain].visits++;
        domainStats[entry.domain].duration += entry.visitDuration || 0;
      }
    });

    const totalVisits = entries.length;
    return Object.values(domainStats)
      .map(stat => ({
        ...stat,
        percentage: totalVisits > 0 ? Math.round((stat.visits / totalVisits) * 100) : 0
      }))
      .sort((a, b) => b.visits - a.visits);
  }

  /**
   * 週の開始日を取得
   * @param {Date} date - 日付
   * @returns {Date}
   */
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  /**
   * 日付・時間でフィルタリング
   * @param {Array} entries - ライフログエントリの配列
   * @param {Object} filters - フィルター条件
   * @returns {Array}
   */
  filterByDateRange(entries, filters) {
    let filteredEntries = [...entries];

    if (filters.startDate) {
      const startTimestamp = new Date(filters.startDate).getTime();
      filteredEntries = filteredEntries.filter(entry => 
        entry.timestamp >= startTimestamp
      );
    }

    if (filters.endDate) {
      const endTimestamp = new Date(filters.endDate).getTime();
      filteredEntries = filteredEntries.filter(entry => 
        entry.timestamp <= endTimestamp
      );
    }

    if (filters.startTime && filters.endTime) {
      filteredEntries = filteredEntries.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        const entryHour = entryDate.getHours();
        return entryHour >= filters.startTime && entryHour <= filters.endTime;
      });
    }

    return filteredEntries;
  }

  /**
   * ドメインでフィルタリング
   * @param {Array} entries - ライフログエントリの配列
   * @param {Array} domains - ドメインの配列
   * @param {boolean} exclude - 除外するかどうか
   * @returns {Array}
   */
  filterByDomains(entries, domains, exclude = false) {
    if (!domains || domains.length === 0) {
      return entries;
    }

    return entries.filter(entry => {
      const hasDomain = domains.some(domain => 
        entry.domain && entry.domain.includes(domain)
      );
      return exclude ? !hasDomain : hasDomain;
    });
  }

  /**
   * テキスト検索でフィルタリング
   * @param {Array} entries - ライフログエントリの配列
   * @param {string} searchTerm - 検索語
   * @returns {Array}
   */
  filterBySearch(entries, searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
      return entries;
    }

    const term = searchTerm.toLowerCase();
    return entries.filter(entry => 
      entry.title.toLowerCase().includes(term) ||
      entry.domain.toLowerCase().includes(term) ||
      entry.url.toLowerCase().includes(term) ||
      (entry.notes && entry.notes.toLowerCase().includes(term))
    );
  }

  /**
   * ドメイン別にグループ化
   * @param {Array} entries - ライフログエントリの配列
   * @returns {Object}
   */
  groupByDomain(entries) {
    const groups = {};
    
    entries.forEach(entry => {
      if (entry.domain) {
        if (!groups[entry.domain]) {
          groups[entry.domain] = [];
        }
        groups[entry.domain].push(entry);
      }
    });

    return groups;
  }

  /**
   * 日付別にグループ化
   * @param {Array} entries - ライフログエントリの配列
   * @returns {Object}
   */
  groupByDate(entries) {
    const groups = {};
    
    entries.forEach(entry => {
      const date = new Date(entry.timestamp);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(entry);
    });

    return groups;
  }

  /**
   * 時間帯別にグループ化
   * @param {Array} entries - ライフログエントリの配列
   * @returns {Object}
   */
  groupByHour(entries) {
    const groups = {};
    
    entries.forEach(entry => {
      const date = new Date(entry.timestamp);
      const hour = date.getHours();
      const hourKey = String(hour).padStart(2, '0');
      
      if (!groups[hourKey]) {
        groups[hourKey] = [];
      }
      groups[hourKey].push(entry);
    });

    return groups;
  }

  /**
   * データをエクスポート用にフォーマット
   * @param {Array} entries - ライフログエントリの配列
   * @param {string} format - フォーマット（'json', 'csv'）
   * @returns {string}
   */
  formatForExport(entries, format = 'json') {
    if (format === 'csv') {
      return this.toCSV(entries);
    }
    return JSON.stringify(entries, null, 2);
  }

  /**
   * CSV形式に変換
   * @param {Array} entries - ライフログエントリの配列
   * @returns {string}
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
}

// グローバルインスタンスを作成
const lifeLogDataProcessor = new LifeLogDataProcessor();

// モジュールエクスポート（ES6モジュール対応）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LifeLogDataProcessor;
} 