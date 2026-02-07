/**
 * Mission Control Analytics Module
 * Visualizes usage and activity data with charts
 */

const Analytics = {
  container: null,
  range: 7,
  usageData: null,
  activityData: null,

  /**
   * Initialize analytics
   */
  init() {
    this.container = document.getElementById('analyticsContainer');
    this.setupEventListeners();
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const rangeSelect = document.getElementById('analyticsRange');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', (e) => {
        this.range = parseInt(e.target.value);
        this.render();
      });
    }

    const refreshBtn = document.getElementById('refreshAnalytics');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.render());
    }
  },

  /**
   * Render analytics when tab becomes active
   */
  async render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <span>Loading analytics...</span>
      </div>
    `;

    try {
      // Load data from JSON files
      const [usageResponse, activityResponse] = await Promise.all([
        fetch('data/usage.json?t=' + Date.now()),
        fetch('data/activity.json?t=' + Date.now())
      ]);
      
      this.usageData = usageResponse.ok ? await usageResponse.json() : null;
      this.activityData = activityResponse.ok ? await activityResponse.json() : null;

      if (!this.usageData) {
        this.container.innerHTML = `
          <div class="empty-state">
            <span class="empty-icon">📊</span>
            <p>No usage data available</p>
          </div>
        `;
        return;
      }

      this.renderDashboard();
    } catch (error) {
      console.error('[Analytics] Error:', error);
      this.container.innerHTML = `
        <div class="error-state">
          <span class="error-icon">❌</span>
          <p>Failed to load analytics</p>
        </div>
      `;
    }
  },

  /**
   * Render the full analytics dashboard
   */
  renderDashboard() {
    const week = this.usageData.week || {};
    const today = this.usageData.today || {};
    const days = week.days || [];
    const byModel = week.byModel || {};

    // Calculate stats
    const avgDailyTokens = days.length > 0 
      ? Math.round(days.reduce((sum, d) => sum + (d.totalTokens || 0), 0) / days.length)
      : 0;
    const maxDay = days.length > 0 
      ? days.reduce((max, d) => (d.totalTokens || 0) > (max.totalTokens || 0) ? d : max, days[0])
      : null;

    // Activity stats
    const activityItems = this.activityData?.items || [];
    const todayActivity = activityItems.filter(item => {
      const itemDate = new Date(item.timestamp).toDateString();
      return itemDate === new Date().toDateString();
    }).length;

    this.container.innerHTML = `
      <div class="analytics-grid">
        <!-- Summary Cards -->
        <div class="analytics-row summary-cards">
          <div class="stat-card primary">
            <div class="stat-icon">📊</div>
            <div class="stat-content">
              <div class="stat-value">${this.formatNumber(week.totalTokens || 0)}</div>
              <div class="stat-label">${this.range}-Day Tokens</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📈</div>
            <div class="stat-content">
              <div class="stat-value">${this.formatNumber(avgDailyTokens)}</div>
              <div class="stat-label">Daily Average</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🎯</div>
            <div class="stat-content">
              <div class="stat-value">${this.formatNumber(today.totalTokens || 0)}</div>
              <div class="stat-label">Today</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">💬</div>
            <div class="stat-content">
              <div class="stat-value">${week.sessions || 0}</div>
              <div class="stat-label">Sessions (7d)</div>
            </div>
          </div>
        </div>

        <!-- Token Usage Chart -->
        <div class="analytics-section">
          <h3>📊 Daily Token Usage</h3>
          <div class="chart-container">
            ${this.renderBarChart(days)}
          </div>
        </div>

        <!-- Model Breakdown -->
        <div class="analytics-section">
          <h3>🤖 Usage by Model</h3>
          <div class="model-breakdown">
            ${this.renderModelBreakdown(byModel)}
          </div>
        </div>

        <!-- Token Usage -->
        <div class="analytics-section">
          <h3>🔢 Token Breakdown (Today)</h3>
          <div class="token-stats">
            ${this.renderTokenStats(today.tokens || {})}
          </div>
        </div>

        ${maxDay ? `
        <!-- Peak Day -->
        <div class="analytics-section highlight">
          <h3>🔥 Peak Day</h3>
          <div class="peak-day">
            <div class="peak-date">${this.formatDate(maxDay.date)}</div>
            <div class="peak-cost">${this.formatNumber(maxDay.totalTokens || 0)} tokens</div>
          </div>
        </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Render bar chart for daily token usage
   */
  renderBarChart(days) {
    if (!days || days.length === 0) {
      return '<div class="empty-chart">No data available</div>';
    }

    const maxTokens = Math.max(...days.map(d => d.totalTokens || 0), 1);
    
    return `
      <div class="bar-chart">
        ${days.map(day => {
          const tokens = day.totalTokens || 0;
          const height = (tokens / maxTokens) * 100;
          const dayName = this.getDayName(day.date);
          return `
            <div class="bar-wrapper" title="${this.formatDate(day.date)}: ${this.formatNumber(tokens)} tokens">
              <div class="bar" style="height: ${Math.max(height, 2)}%">
                <span class="bar-value">${this.formatNumber(tokens)}</span>
              </div>
              <span class="bar-label">${dayName}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  /**
   * Render model breakdown
   */
  renderModelBreakdown(byModel) {
    const models = Object.entries(byModel);
    if (models.length === 0) {
      return '<div class="empty-state">No model data</div>';
    }

    const total = models.reduce((sum, [_, tokens]) => sum + tokens, 0);
    const colors = {
      'claude-opus-4-5': '#FF6B6B',
      'claude-sonnet-4-5': '#4ECDC4',
      'kimi-k2.5': '#45B7D1',
      'gemini-2.0-flash': '#96CEB4'
    };

    return `
      <div class="model-list">
        ${models.map(([model, tokens]) => {
          const percentage = total > 0 ? ((tokens / total) * 100).toFixed(1) : 0;
          const color = colors[model] || '#888';
          const displayName = this.formatModelName(model);
          return `
            <div class="model-row">
              <div class="model-info">
                <span class="model-color" style="background: ${color}"></span>
                <span class="model-name">${displayName}</span>
              </div>
              <div class="model-stats">
                <span class="model-cost">${this.formatNumber(tokens)} tokens</span>
                <span class="model-percentage">${percentage}%</span>
              </div>
              <div class="model-bar">
                <div class="model-bar-fill" style="width: ${percentage}%; background: ${color}"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  /**
   * Render token statistics
   */
  renderTokenStats(tokens) {
    const input = tokens.input || 0;
    const output = tokens.output || 0;
    const cache = tokens.cacheRead || 0;
    const total = input + output + cache;

    return `
      <div class="token-grid">
        <div class="token-stat">
          <div class="token-label">Input</div>
          <div class="token-value">${this.formatNumber(input)}</div>
          <div class="token-bar input"></div>
        </div>
        <div class="token-stat">
          <div class="token-label">Output</div>
          <div class="token-value">${this.formatNumber(output)}</div>
          <div class="token-bar output"></div>
        </div>
        <div class="token-stat">
          <div class="token-label">Cache Read</div>
          <div class="token-value">${this.formatNumber(cache)}</div>
          <div class="token-bar cache"></div>
        </div>
        <div class="token-stat total">
          <div class="token-label">Total</div>
          <div class="token-value">${this.formatNumber(total)}</div>
        </div>
      </div>
    `;
  },

  /**
   * Format model name for display
   */
  formatModelName(model) {
    const names = {
      'claude-opus-4-5': 'Claude Opus 4.5',
      'claude-sonnet-4-5': 'Claude Sonnet 4.5',
      'kimi-k2.5': 'Kimi K2.5',
      'gemini-2.0-flash': 'Gemini 2.0 Flash'
    };
    return names[model] || model;
  },

  /**
   * Format date for display
   */
  formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  },

  /**
   * Get short day name
   */
  getDayName(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  },

  /**
   * Format large numbers
   */
  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Analytics.init());
} else {
  Analytics.init();
}

// Subscribe to tab changes
document.addEventListener('tabChange', (e) => {
  if (e.detail === 'analytics') {
    Analytics.render();
  }
});

// Export for global access
window.Analytics = Analytics;
