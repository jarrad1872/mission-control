/**
 * Usage Stats Module - Token & Session Usage Tracker for Mission Control
 * Displays daily/weekly token usage, session counts, and model distribution
 */

const CostsModule = (function() {
    'use strict';
    
    let data = null;
    
    // Model display names
    const MODEL_NAMES = {
        'claude-opus-4-5': 'Claude Opus 4.5',
        'claude-sonnet-4-5': 'Claude Sonnet 4.5',
        'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
        'claude-3-5-haiku': 'Claude 3.5 Haiku',
        'kimi-k2.5': 'Kimi K2.5',
        'gpt-4o': 'GPT-4o',
        'gemini-2.0-flash': 'Gemini 2.0 Flash'
    };
    
    // Model colors
    const MODEL_COLORS = {
        'claude-opus-4-5': '#e94560',
        'claude-sonnet-4-5': '#ff6b8a',
        'claude-3-5-sonnet': '#ff8fa3',
        'claude-3-5-haiku': '#ffb3c1',
        'kimi-k2.5': '#4ecdc4',
        'gpt-4o': '#10a37f',
        'gemini-2.0-flash': '#8e44ef'
    };
    
    /**
     * Initialize the module
     */
    async function init() {
        console.log('📊 Initializing Usage Stats Module...');
        await loadData();
        render();
        return true;
    }
    
    /**
     * Load usage data
     */
    async function loadData() {
        try {
            const response = await fetch('data/usage.json?t=' + Date.now());
            if (!response.ok) {
                throw new Error('usage.json not found');
            }
            data = await response.json();
            console.log('   ✅ Usage data loaded');
        } catch (e) {
            console.warn('   ⚠️ Could not load usage.json, using placeholder data');
            data = getPlaceholderData();
        }
    }
    
    /**
     * Generate placeholder data if usage.json doesn't exist
     */
    function getPlaceholderData() {
        const today = new Date().toISOString().split('T')[0];
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            days.push({
                date: date.toISOString().split('T')[0],
                totalTokens: Math.floor(Math.random() * 50000 + 10000),
                tokens: {
                    input: Math.floor(Math.random() * 30000 + 5000),
                    output: Math.floor(Math.random() * 15000 + 3000),
                    cacheRead: Math.floor(Math.random() * 20000 + 2000)
                },
                sessions: Math.floor(Math.random() * 20 + 5)
            });
        }
        
        const todayData = days[days.length - 1];
        const weekTotalTokens = days.reduce((sum, d) => sum + d.totalTokens, 0);
        const weekTotalSessions = days.reduce((sum, d) => sum + d.sessions, 0);
        
        return {
            lastUpdate: new Date().toISOString(),
            today: {
                tokens: todayData.tokens,
                totalTokens: todayData.totalTokens,
                sessions: todayData.sessions,
                messages: Math.floor(todayData.sessions * 8.5),
                byModel: {
                    'claude-opus-4-5': todayData.totalTokens * 0.55,
                    'claude-sonnet-4-5': todayData.totalTokens * 0.30,
                    'kimi-k2.5': todayData.totalTokens * 0.15
                }
            },
            week: {
                totalTokens: weekTotalTokens,
                sessions: weekTotalSessions,
                messages: Math.floor(weekTotalSessions * 8.5),
                days: days,
                byModel: {
                    'claude-opus-4-5': weekTotalTokens * 0.55,
                    'claude-sonnet-4-5': weekTotalTokens * 0.30,
                    'kimi-k2.5': weekTotalTokens * 0.15
                }
            }
        };
    }
    
    /**
     * Get data freshness info
     */
    function getDataFreshness(lastUpdate) {
        if (!lastUpdate) return { text: 'Unknown', status: 'outdated', relative: 'unknown' };
        
        const now = new Date();
        const updated = new Date(lastUpdate);
        const diffMs = now - updated;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        let relative;
        if (diffMins < 1) relative = 'just now';
        else if (diffMins < 60) relative = `${diffMins}m ago`;
        else if (diffHours < 24) relative = `${diffHours}h ago`;
        else relative = `${diffDays}d ago`;
        
        let status;
        if (diffHours >= 6) status = 'outdated';
        else if (diffHours >= 1) status = 'stale';
        else status = 'fresh';
        
        return { text: lastUpdate, status, relative };
    }
    
    /**
     * Render the usage stats panel
     */
    function render() {
        const container = document.getElementById('costTrackerContent');
        if (!container || !data) return;
        
        // Update the header timestamp with freshness indicator
        const updateTimeEl = document.getElementById('costUpdateTime');
        if (updateTimeEl && data.lastUpdate) {
            const freshness = getDataFreshness(data.lastUpdate);
            
            let badgeHTML = '';
            if (freshness.status === 'stale') {
                badgeHTML = '<span class="freshness-badge stale">⚠️ Stale</span>';
            } else if (freshness.status === 'outdated') {
                badgeHTML = '<span class="freshness-badge outdated">🔴 Outdated</span>';
            }
            
            updateTimeEl.innerHTML = `${freshness.relative} ${badgeHTML}`;
        }
        
        const todayTokens = data.today?.totalTokens || 0;
        const weekTokens = data.week?.totalTokens || 0;
        const tokens = data.today?.tokens || { input: 0, output: 0, cacheRead: 0 };
        const todaySessions = data.today?.sessions || 0;
        const weekSessions = data.week?.sessions || 0;
        
        container.innerHTML = `
            <div class="cost-summary">
                <div class="cost-card">
                    <div class="cost-label">Today</div>
                    <div class="cost-amount">${Utils.formatTokens(todayTokens)}</div>
                    <div class="cost-tokens">${todaySessions} session${todaySessions !== 1 ? 's' : ''}</div>
                </div>
                <div class="cost-card">
                    <div class="cost-label">This Week</div>
                    <div class="cost-amount">${Utils.formatTokens(weekTokens)}</div>
                    <div class="cost-tokens">${weekSessions} session${weekSessions !== 1 ? 's' : ''}</div>
                </div>
            </div>
            
            <div class="token-breakdown">
                <div class="token-item">
                    <span class="token-label">Input</span>
                    <span class="token-value">${Utils.formatTokens(tokens.input)}</span>
                </div>
                <div class="token-item">
                    <span class="token-label">Output</span>
                    <span class="token-value">${Utils.formatTokens(tokens.output)}</span>
                </div>
                <div class="token-item">
                    <span class="token-label">Cache</span>
                    <span class="token-value">${Utils.formatTokens(tokens.cacheRead || 0)}</span>
                </div>
            </div>
            
            <div class="model-breakdown">
                <div class="section-label">Model Usage (Today)</div>
                ${renderModelBars(data.today?.byModel || {})}
            </div>
            
            <div class="weekly-chart">
                <div class="section-label">Last 7 Days</div>
                ${renderWeeklyChart(data.week?.days || [])}
            </div>
        `;
    }
    
    /**
     * Render model usage bars (by token count)
     */
    function renderModelBars(byModel) {
        const entries = Object.entries(byModel).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0) {
            return '<div class="no-data">No model data available</div>';
        }
        
        const maxTokens = Math.max(...entries.map(e => e[1]));
        
        return entries.map(([model, tokens]) => {
            const percentage = maxTokens > 0 ? (tokens / maxTokens) * 100 : 0;
            const color = MODEL_COLORS[model] || 'var(--accent)';
            const displayName = MODEL_NAMES[model] || model;
            
            return `
                <div class="model-bar-container">
                    <div class="model-bar-header">
                        <span class="model-name">${displayName}</span>
                        <span class="model-cost">${Utils.formatTokens(tokens)}</span>
                    </div>
                    <div class="model-bar-track">
                        <div class="model-bar-fill" style="width: ${percentage}%; background: ${color}"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    /**
     * Render weekly bar chart (horizontal bars for token usage per day)
     */
    function renderWeeklyChart(days) {
        if (!days || days.length === 0) {
            return '<div class="no-data">No weekly data available</div>';
        }
        
        const maxTokens = Math.max(...days.map(d => d.totalTokens || 0));
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        return `
            <div class="chart-container">
                ${days.map(day => {
                    const totalTokens = day.totalTokens || 0;
                    const percentage = maxTokens > 0 ? (totalTokens / maxTokens) * 100 : 0;
                    const date = new Date(day.date);
                    const dayName = dayNames[date.getDay()];
                    const isToday = day.date === new Date().toISOString().split('T')[0];
                    
                    return `
                        <div class="chart-bar ${isToday ? 'today' : ''}" title="${day.date}: ${Utils.formatTokens(totalTokens)}">
                            <div class="chart-bar-label">${dayName}</div>
                            <div class="chart-bar-track">
                                <div class="chart-bar-fill" style="width: ${percentage}%"></div>
                            </div>
                            <div class="chart-bar-value">${Utils.formatTokens(totalTokens)}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    /**
     * Refresh data
     */
    async function refresh() {
        await loadData();
        render();
    }
    
    return {
        init,
        refresh,
        getData: () => data
    };
})();

// Export for use in other modules
window.CostsModule = CostsModule;
