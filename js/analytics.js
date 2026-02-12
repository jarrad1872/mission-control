/**
 * Mission Control Analytics Module
 * Visualizes usage and activity data with charts
 */

const Analytics = (function() {
  'use strict';

  let container = null;
  let range = 7;
  let usageData = null;
  let activityData = null;

  /**
   * Get usage data URL (gateway or static fallback)
   */
  function getUsageUrl() {
    const gwUrl = localStorage.getItem('mc_gateway_url');
    if (gwUrl) return gwUrl.replace(/\/$/, '') + '/api/usage';
    return 'data/usage.json';
  }

  /**
   * Get activity data URL (gateway or static fallback)
   */
  function getActivityUrl() {
    const gwUrl = localStorage.getItem('mc_gateway_url');
    if (gwUrl) return gwUrl.replace(/\/$/, '') + '/api/activity';
    return 'data/activity.json';
  }

  /**
   * Initialize analytics
   */
  function init() {
    container = document.getElementById('analyticsContainer');
    setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    const rangeSelect = document.getElementById('analyticsRange');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', (e) => {
        range = parseInt(e.target.value, 10);
        render();
      });
    }

    const refreshBtn = document.getElementById('refreshAnalytics');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => render());
    }
  }

  /**
   * Render analytics when tab becomes active
   */
  async function render() {
    if (!container) return;

    container.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <span>Loading analytics...</span>
      </div>
    `;

    try {
      // Load data from JSON files
      const usageUrl = getUsageUrl();
      const activityUrl = getActivityUrl();
      const [usageResponse, activityResponse] = await Promise.all([
        fetch(usageUrl + (usageUrl.includes('?') ? '&' : '?') + 't=' + Date.now()),
        fetch(activityUrl + (activityUrl.includes('?') ? '&' : '?') + 't=' + Date.now())
      ]);

      usageData = usageResponse.ok ? await usageResponse.json() : null;
      activityData = activityResponse.ok ? await activityResponse.json() : null;

      if (!usageData) {
        container.innerHTML = `
          <div class="empty-state">
            <span class="empty-icon">📊</span>
            <p>No usage data available</p>
          </div>
        `;
        return;
      }

      renderDashboard();
    } catch (error) {
      console.error('[Analytics] Error:', error);
      container.innerHTML = `
        <div class="error-state">
          <span class="error-icon">❌</span>
          <p>Failed to load analytics</p>
        </div>
      `;
    }
  }

  /**
   * Render the full analytics dashboard
   */
  function renderDashboard() {
    const week = usageData.week || {};
    const today = usageData.today || {};
    const rangeData = getRangeData(range);
    const days = rangeData.days;
    const byModel = rangeData.byModel;
    const rangeTotals = rangeData.totals;

    // Calculate stats
    const avgDailyTokens = days.length > 0
      ? Math.round(days.reduce((sum, d) => sum + (d.totalTokens || 0), 0) / days.length)
      : 0;
    const maxDay = days.length > 0
      ? days.reduce((max, d) => (d.totalTokens || 0) > (max.totalTokens || 0) ? d : max, days[0])
      : null;

    // Activity stats
    const activityItems = activityData?.items || [];
    const todayActivity = activityItems.filter(item => {
      const itemDate = new Date(item.timestamp).toDateString();
      return itemDate === new Date().toDateString();
    }).length;

    container.innerHTML = `
      <div class="analytics-grid">
        <!-- Summary Cards -->
        <div class="analytics-row summary-cards">
          <div class="stat-card primary">
            <div class="stat-icon">📊</div>
            <div class="stat-content">
              <div class="stat-value">${Utils.formatNumber(rangeTotals.totalTokens || 0)}</div>
              <div class="stat-label">${range}-Day Tokens</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📈</div>
            <div class="stat-content">
              <div class="stat-value">${Utils.formatNumber(avgDailyTokens)}</div>
              <div class="stat-label">Daily Average</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🎯</div>
            <div class="stat-content">
              <div class="stat-value">${Utils.formatNumber(today.totalTokens || 0)}</div>
              <div class="stat-label">Today</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">💬</div>
            <div class="stat-content">
              <div class="stat-value">${rangeTotals.sessions || 0}</div>
              <div class="stat-label">Sessions (${range}d)</div>
            </div>
          </div>
        </div>

        <!-- Token Usage Chart -->
        <div class="analytics-section">
          <h3>📊 Daily Token Usage</h3>
          <div class="chart-container">
            ${renderBarChart(days)}
          </div>
        </div>

        <!-- Model Breakdown -->
        <div class="analytics-section">
          <h3>🤖 Usage by Model</h3>
          <div class="model-breakdown">
            ${renderModelBreakdown(byModel)}
          </div>
        </div>

        <!-- Token Usage -->
        <div class="analytics-section">
          <h3>🔢 Token Breakdown (Today)</h3>
          <div class="token-stats">
            ${renderTokenStats(today.tokens || {})}
          </div>
        </div>

        ${maxDay ? `
        <!-- Peak Day -->
        <div class="analytics-section highlight">
          <h3>🔥 Peak Day</h3>
          <div class="peak-day">
            <div class="peak-date">${formatDate(maxDay.date)}</div>
            <div class="peak-cost">${Utils.formatNumber(maxDay.totalTokens || 0)} tokens</div>
          </div>
        </div>
        ` : ''}
      </div>
    `;
  }

  function getRangeData(daysRange) {
    const sourceDays = usageData?.week?.days || usageData?.days || [];
    const dayMap = new Map();

    sourceDays.forEach((day) => {
      if (!day?.date) return;
      const key = day.date;
      const existing = dayMap.get(key) || { date: key, totalTokens: 0, sessions: 0, byModel: {} };
      existing.totalTokens += day.totalTokens || 0;
      existing.sessions += day.sessions || 0;
      if (day.byModel) {
        Object.entries(day.byModel).forEach(([model, tokens]) => {
          existing.byModel[model] = (existing.byModel[model] || 0) + (tokens || 0);
        });
      }
      dayMap.set(key, existing);
    });

    const sortedDates = Array.from(dayMap.keys()).sort();
    const endDate = sortedDates.length > 0 ? new Date(sortedDates[sortedDates.length - 1]) : new Date();
    const days = [];

    for (let i = daysRange - 1; i >= 0; i--) {
      const d = new Date(endDate);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push(dayMap.get(key) || { date: key, totalTokens: 0, sessions: 0, byModel: {} });
    }

    const byModel = {};
    const totals = { totalTokens: 0, sessions: 0 };
    days.forEach((day) => {
      totals.totalTokens += day.totalTokens || 0;
      totals.sessions += day.sessions || 0;
      Object.entries(day.byModel || {}).forEach(([model, tokens]) => {
        byModel[model] = (byModel[model] || 0) + (tokens || 0);
      });
    });

    return { days, byModel, totals };
  }

  /**
   * Render bar chart for daily token usage
   */
  function renderBarChart(days) {
    if (!days || days.length === 0) {
      return '<div class="empty-chart">No data available</div>';
    }

    const maxTokens = Math.max(...days.map(d => d.totalTokens || 0), 1);

    return `
      <div class="bar-chart">
        ${days.map(day => {
          const tokens = day.totalTokens || 0;
          const height = (tokens / maxTokens) * 100;
          const dayName = getDayName(day.date);
          return `
            <div class="bar-wrapper" title="${formatDate(day.date)}: ${Utils.formatNumber(tokens)} tokens">
              <div class="bar" style="height: ${Math.max(height, 2)}%">
                <span class="bar-value">${Utils.formatNumber(tokens)}</span>
              </div>
              <span class="bar-label">${dayName}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Render model breakdown
   */
  function renderModelBreakdown(byModel) {
    const models = Object.entries(byModel);
    if (models.length === 0) {
      return '<div class="empty-state">No model data</div>';
    }

    const total = models.reduce((sum, [_, tokens]) => sum + tokens, 0);
    const colors = {
      'claude-opus-4-6': '#d63384',
      'claude-opus-4-5': '#FF6B6B',
      'claude-sonnet-4-5': '#4ECDC4',
      'kimi-k2.5': '#45B7D1',
      'gemini-2.0-flash': '#96CEB4',
      'delivery-mirror': '#888'
    };

    return `
      <div class="model-list">
        ${models.map(([model, tokens]) => {
          const percentage = total > 0 ? ((tokens / total) * 100).toFixed(1) : 0;
          const color = colors[model] || '#888';
          const displayName = formatModelName(model);
          return `
            <div class="model-row">
              <div class="model-info">
                <span class="model-color" style="background: ${color}"></span>
                <span class="model-name">${displayName}</span>
              </div>
              <div class="model-stats">
                <span class="model-cost">${Utils.formatNumber(tokens)} tokens</span>
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
  }

  /**
   * Render token statistics
   */
  function renderTokenStats(tokens) {
    const input = tokens.input || 0;
    const output = tokens.output || 0;
    const cache = tokens.cacheRead || 0;
    const total = input + output + cache;

    return `
      <div class="token-grid">
        <div class="token-stat">
          <div class="token-label">Input</div>
          <div class="token-value">${Utils.formatNumber(input)}</div>
          <div class="token-bar input"></div>
        </div>
        <div class="token-stat">
          <div class="token-label">Output</div>
          <div class="token-value">${Utils.formatNumber(output)}</div>
          <div class="token-bar output"></div>
        </div>
        <div class="token-stat">
          <div class="token-label">Cache Read</div>
          <div class="token-value">${Utils.formatNumber(cache)}</div>
          <div class="token-bar cache"></div>
        </div>
        <div class="token-stat total">
          <div class="token-label">Total</div>
          <div class="token-value">${Utils.formatNumber(total)}</div>
        </div>
      </div>
    `;
  }

  /**
   * Format model name for display
   */
  function formatModelName(model) {
    const names = {
      'claude-opus-4-6': 'Claude Opus 4.6',
      'claude-opus-4-5': 'Claude Opus 4.5',
      'claude-sonnet-4-5': 'Claude Sonnet 4.5',
      'kimi-k2.5': 'Kimi K2.5',
      'gemini-2.0-flash': 'Gemini 2.0 Flash',
      'delivery-mirror': 'Delivery Mirror'
    };
    return names[model] || Utils.escapeHtml(model || 'Unknown');
  }

  /**
   * Format date for display
   */
  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Get short day name
   */
  function getDayName(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  // Public API
  return {
    init,
    render,
    refresh: render
  };
})();

// Export for global access
window.Analytics = Analytics;
