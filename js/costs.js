/**
 * Costs Module - API Cost Tracker for Mission Control
 * Displays daily/weekly costs, token usage, and model breakdown
 */

const CostsModule = (function() {
    'use strict';
    
    let data = null;
    
    // Cost thresholds for color coding
    const THRESHOLDS = {
        daily: { low: 5, high: 15 },      // Under $5 = green, over $15 = red
        weekly: { low: 30, high: 75 }     // Under $30 = green, over $75 = red
    };
    
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
        console.log('💰 Initializing Costs Module...');
        await loadData();
        render();
        return true;
    }
    
    /**
     * Load cost data
     */
    async function loadData() {
        try {
            const response = await fetch('data/costs.json?t=' + Date.now());
            if (!response.ok) {
                throw new Error('costs.json not found');
            }
            data = await response.json();
            console.log('   ✅ Cost data loaded');
        } catch (e) {
            console.warn('   ⚠️ Could not load costs.json, using placeholder data');
            data = getPlaceholderData();
        }
    }
    
    /**
     * Generate placeholder data if costs.json doesn't exist
     */
    function getPlaceholderData() {
        const today = new Date().toISOString().split('T')[0];
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            days.push({
                date: date.toISOString().split('T')[0],
                cost: parseFloat((Math.random() * 5 + 1).toFixed(2)),
                tokens: {
                    input: Math.floor(Math.random() * 50000 + 10000),
                    output: Math.floor(Math.random() * 15000 + 3000),
                    cacheRead: Math.floor(Math.random() * 40000 + 5000)
                }
            });
        }
        
        const todayData = days[days.length - 1];
        const weekTotal = days.reduce((sum, d) => sum + d.cost, 0);
        
        return {
            lastUpdate: new Date().toISOString(),
            today: {
                totalCost: todayData.cost,
                tokens: todayData.tokens,
                byModel: {
                    'claude-opus-4-5': todayData.cost * 0.6,
                    'claude-sonnet-4-5': todayData.cost * 0.25,
                    'kimi-k2.5': todayData.cost * 0.15
                }
            },
            week: {
                totalCost: parseFloat(weekTotal.toFixed(2)),
                days: days,
                byModel: {
                    'claude-opus-4-5': weekTotal * 0.55,
                    'claude-sonnet-4-5': weekTotal * 0.30,
                    'kimi-k2.5': weekTotal * 0.15
                }
            }
        };
    }
    
    /**
     * Format currency
     */
    function formatCurrency(amount) {
        return '$' + amount.toFixed(2);
    }
    
    /**
     * Format token count (e.g., 50000 -> 50K)
     */
    function formatTokens(count) {
        if (count >= 1000000) {
            return (count / 1000000).toFixed(1) + 'M';
        } else if (count >= 1000) {
            return (count / 1000).toFixed(1) + 'K';
        }
        return count.toString();
    }
    
    /**
     * Get cost color based on thresholds
     */
    function getCostColor(amount, type = 'daily') {
        const threshold = THRESHOLDS[type];
        if (amount < threshold.low) return 'var(--success)';
        if (amount > threshold.high) return 'var(--accent)';
        return 'var(--warning)';
    }
    
    /**
     * Get cost class based on thresholds
     */
    function getCostClass(amount, type = 'daily') {
        const threshold = THRESHOLDS[type];
        if (amount < threshold.low) return 'cost-low';
        if (amount > threshold.high) return 'cost-high';
        return 'cost-medium';
    }
    
    /**
     * Render the cost tracker panel
     */
    function render() {
        const container = document.getElementById('costTrackerContent');
        if (!container || !data) return;
        
        // Update the header timestamp
        const updateTimeEl = document.getElementById('costUpdateTime');
        if (updateTimeEl && data.lastUpdate) {
            const d = new Date(data.lastUpdate);
            updateTimeEl.textContent = 'Updated: ' + d.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        }
        
        const todayCost = data.today?.totalCost || 0;
        const weekCost = data.week?.totalCost || 0;
        const tokens = data.today?.tokens || { input: 0, output: 0, cacheRead: 0 };
        const totalTokens = tokens.input + tokens.output + (tokens.cacheRead || 0);
        
        container.innerHTML = `
            <div class="cost-summary">
                <div class="cost-card">
                    <div class="cost-label">Today</div>
                    <div class="cost-amount ${getCostClass(todayCost, 'daily')}">${formatCurrency(todayCost)}</div>
                    <div class="cost-tokens">${formatTokens(totalTokens)} tokens</div>
                </div>
                <div class="cost-card">
                    <div class="cost-label">This Week</div>
                    <div class="cost-amount ${getCostClass(weekCost, 'weekly')}">${formatCurrency(weekCost)}</div>
                    <div class="cost-tokens">7-day total</div>
                </div>
            </div>
            
            <div class="token-breakdown">
                <div class="token-item">
                    <span class="token-label">Input</span>
                    <span class="token-value">${formatTokens(tokens.input)}</span>
                </div>
                <div class="token-item">
                    <span class="token-label">Output</span>
                    <span class="token-value">${formatTokens(tokens.output)}</span>
                </div>
                <div class="token-item">
                    <span class="token-label">Cache</span>
                    <span class="token-value">${formatTokens(tokens.cacheRead || 0)}</span>
                </div>
            </div>
            
            <div class="model-breakdown">
                <div class="section-label">By Model (Today)</div>
                ${renderModelBars(data.today?.byModel || {})}
            </div>
            
            <div class="weekly-chart">
                <div class="section-label">Last 7 Days</div>
                ${renderWeeklyChart(data.week?.days || [])}
            </div>
        `;
    }
    
    /**
     * Render model breakdown bars
     */
    function renderModelBars(byModel) {
        const entries = Object.entries(byModel).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0) {
            return '<div class="no-data">No model data available</div>';
        }
        
        const maxCost = Math.max(...entries.map(e => e[1]));
        
        return entries.map(([model, cost]) => {
            const percentage = maxCost > 0 ? (cost / maxCost) * 100 : 0;
            const color = MODEL_COLORS[model] || 'var(--accent)';
            const displayName = MODEL_NAMES[model] || model;
            
            return `
                <div class="model-bar-container">
                    <div class="model-bar-header">
                        <span class="model-name">${displayName}</span>
                        <span class="model-cost">${formatCurrency(cost)}</span>
                    </div>
                    <div class="model-bar-track">
                        <div class="model-bar-fill" style="width: ${percentage}%; background: ${color}"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    /**
     * Render weekly bar chart
     */
    function renderWeeklyChart(days) {
        if (!days || days.length === 0) {
            return '<div class="no-data">No weekly data available</div>';
        }
        
        const maxCost = Math.max(...days.map(d => d.cost));
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        return `
            <div class="chart-container">
                ${days.map(day => {
                    const percentage = maxCost > 0 ? (day.cost / maxCost) * 100 : 0;
                    const date = new Date(day.date);
                    const dayName = dayNames[date.getDay()];
                    const isToday = day.date === new Date().toISOString().split('T')[0];
                    
                    return `
                        <div class="chart-bar ${isToday ? 'today' : ''}" title="${day.date}: ${formatCurrency(day.cost)}">
                            <div class="chart-bar-fill" style="height: ${percentage}%"></div>
                            <div class="chart-bar-label">${dayName}</div>
                            <div class="chart-bar-value">${formatCurrency(day.cost)}</div>
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
