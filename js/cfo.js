/**
 * CFO Center Module
 * Financial dashboard for Jarrad's business portfolio
 */

const CFOModule = (function() {
    let cfoData = null;
    let expandedCards = new Set();
    
    // Company configuration with icons and colors
    const COMPANY_CONFIG = {
        'kippen-concrete': { 
            icon: '🏗️', 
            name: 'Kippen Concrete Cutting LLC',
            shortName: 'Kippen Concrete',
            color: '#4ecdc4'
        },
        'kippen-excavation': { 
            icon: '⛏️', 
            name: 'Kippen Excavation',
            shortName: 'Kippen Excavation',
            color: '#a855f7'
        },
        'dmi-tools': { 
            icon: '🔧', 
            name: 'DMI Tools Corp',
            shortName: 'DMI Tools',
            color: '#e94560'
        },
        'roc-diamond': { 
            icon: '💎', 
            name: 'Roc Diamond LLC',
            shortName: 'Roc Diamond',
            color: '#ffc107'
        },
        'kippen-leasing': { 
            icon: '📋', 
            name: 'Kippen Leasing LLC',
            shortName: 'Kippen Leasing',
            color: '#6c6c7c'
        },
        'sawdot-city': { 
            icon: '🪚', 
            name: 'SawDot City',
            shortName: 'SawDot',
            color: '#00d26a'
        },
        'calvin-kippen-properties': { 
            icon: '🏠', 
            name: 'Calvin Kippen Properties LLC',
            shortName: 'Calvin Properties',
            color: '#4a90d9'
        },
        'cj-kippen-properties': { 
            icon: '🏘️', 
            name: 'CJ Kippen Properties',
            shortName: 'CJ Properties',
            color: '#4a90d9'
        },
        'durno': { 
            icon: '🏢', 
            name: 'Durno Inc',
            shortName: 'Durno',
            color: '#6c6c7c'
        }
    };
    
    // Status badge configuration
    const STATUS_CONFIG = {
        'profitable': { 
            label: 'Profitable', 
            color: '#00d26a', 
            bg: 'rgba(0, 210, 106, 0.15)',
            icon: '🟢'
        },
        'break-even': { 
            label: 'Break-even', 
            color: '#ffc107', 
            bg: 'rgba(255, 193, 7, 0.15)',
            icon: '🟡'
        },
        'losing': { 
            label: 'Losing Money', 
            color: '#e94560', 
            bg: 'rgba(233, 69, 96, 0.15)',
            icon: '🔴'
        },
        'debt-holder': { 
            label: 'Debt Holder', 
            color: '#ffc107', 
            bg: 'rgba(255, 193, 7, 0.15)',
            icon: '🟡'
        },
        'inactive': { 
            label: 'Inactive', 
            color: '#6c6c7c', 
            bg: 'rgba(108, 108, 124, 0.15)',
            icon: '⚪'
        },
        'software': { 
            label: 'Software', 
            color: '#4ecdc4', 
            bg: 'rgba(78, 205, 196, 0.15)',
            icon: '🔵'
        }
    };
    
    /**
     * Initialize the CFO module
     */
    async function init() {
        console.log('💰 Initializing CFO Center...');
        
        await loadCFOData();
        render();
        bindEvents();
        
        console.log('✅ CFO Center initialized');
    }
    
    /**
     * Load CFO data
     */
    async function loadCFOData() {
        try {
            const response = await fetch('data/cfo.json?t=' + Date.now());
            if (!response.ok) throw new Error('Failed to load CFO data');
            cfoData = await response.json();
        } catch (error) {
            console.error('CFO Module: Could not load data', error);
            cfoData = { companies: [], portfolio: {}, alerts: [], generated: null };
        }
    }
    
    /**
     * Format currency for display
     */
    function formatCurrency(amount) {
        if (!amount && amount !== 0) return '—';
        if (amount >= 1000000) {
            return '$' + (amount / 1000000).toFixed(1) + 'M';
        } else if (amount >= 1000) {
            return '$' + (amount / 1000).toFixed(0) + 'K';
        }
        return '$' + amount.toFixed(0);
    }
    
    /**
     * Format percentage
     */
    function formatPercent(value) {
        if (!value && value !== 0) return '—';
        const sign = value >= 0 ? '' : '';
        return sign + value.toFixed(1) + '%';
    }
    
    /**
     * Get relative time string
     */
    function getRelativeTime(isoDate) {
        if (!isoDate) return 'Never';
        const date = new Date(isoDate);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    /**
     * Render the CFO center
     */
    function render() {
        const container = document.getElementById('cfo-tab');
        if (!container) return;
        
        const portfolio = cfoData?.portfolio || {};
        const companies = cfoData?.companies || [];
        const alerts = cfoData?.alerts || [];
        const generated = cfoData?.generated;
        
        container.innerHTML = `
            <div class="cfo-container">
                <!-- Header -->
                <div class="cfo-header">
                    <div class="cfo-header-title">
                        <h2>💰 CFO Center</h2>
                        <span class="cfo-updated">Updated: ${getRelativeTime(generated)}</span>
                    </div>
                    <button class="cfo-refresh-btn" onclick="CFOModule.refresh()" title="Refresh Data">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                        </svg>
                    </button>
                </div>
                
                <!-- Portfolio Overview Card -->
                ${renderPortfolioCard(portfolio)}
                
                <!-- Company Cards -->
                <div class="cfo-section">
                    <h3 class="cfo-section-title">📊 Company Portfolio</h3>
                    <div class="cfo-companies-grid">
                        ${companies.map(company => renderCompanyCard(company)).join('')}
                    </div>
                </div>
                
                <!-- Alerts Section -->
                ${alerts.length > 0 ? renderAlertsSection(alerts) : ''}
                
                <!-- Quick Actions -->
                <div class="cfo-section">
                    <h3 class="cfo-section-title">⚡ Quick Actions</h3>
                    <div class="cfo-actions">
                        <button class="cfo-action-btn primary" onclick="CFOModule.triggerAction('cfo')">
                            <span class="action-icon">📊</span>
                            <span class="action-label">Run CFO Analysis</span>
                        </button>
                        <button class="cfo-action-btn" onclick="CFOModule.triggerAction('cfo dmi')">
                            <span class="action-icon">🔧</span>
                            <span class="action-label">DMI Deep Dive</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render portfolio overview card
     */
    function renderPortfolioCard(portfolio) {
        const healthIcon = portfolio.health === 'good' ? '🟢' : 
                          portfolio.health === 'watch' ? '🟡' : '🔴';
        const healthLabel = portfolio.health === 'good' ? 'Good' :
                           portfolio.health === 'watch' ? 'Watch' : 'Concern';
        
        return `
            <div class="cfo-portfolio-card">
                <div class="portfolio-health">
                    <span class="health-label">PORTFOLIO HEALTH</span>
                    <span class="health-indicator">${healthIcon} ${healthLabel}</span>
                </div>
                <div class="portfolio-stats">
                    <div class="portfolio-stat">
                        <span class="stat-value">${formatCurrency(portfolio.totalRevenue)}</span>
                        <span class="stat-label">Total Revenue</span>
                    </div>
                    <div class="portfolio-stat">
                        <span class="stat-value">${portfolio.profitable || 0}</span>
                        <span class="stat-label">Profitable</span>
                    </div>
                    <div class="portfolio-stat">
                        <span class="stat-value">${portfolio.needsAttention || 0}</span>
                        <span class="stat-label">Watch</span>
                    </div>
                </div>
                ${portfolio.totalDebt ? `
                    <div class="portfolio-debt">
                        <span class="debt-label">Total Debt:</span>
                        <span class="debt-value">${formatCurrency(portfolio.totalDebt)}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * Render a company card
     */
    function renderCompanyCard(company) {
        const config = COMPANY_CONFIG[company.id] || { 
            icon: '🏢', 
            name: company.name,
            shortName: company.name,
            color: '#6c6c7c'
        };
        const statusConfig = STATUS_CONFIG[company.status] || STATUS_CONFIG['inactive'];
        const isExpanded = expandedCards.has(company.id);
        
        return `
            <div class="cfo-company-card ${isExpanded ? 'expanded' : ''}" 
                 data-company-id="${company.id}"
                 style="--company-color: ${config.color}">
                <div class="company-card-header" onclick="CFOModule.toggleCard('${company.id}')">
                    <div class="company-identity">
                        <span class="company-icon">${config.icon}</span>
                        <div class="company-name-group">
                            <span class="company-name">${config.shortName}</span>
                            <span class="company-status" style="background: ${statusConfig.bg}; color: ${statusConfig.color}">
                                ${statusConfig.label}
                            </span>
                        </div>
                    </div>
                    <div class="company-revenue">
                        ${formatCurrency(company.revenue)}
                    </div>
                </div>
                
                <div class="company-card-metrics">
                    ${company.grossMargin !== undefined ? `
                        <div class="metric">
                            <span class="metric-label">GM</span>
                            <span class="metric-value ${company.grossMargin < 20 ? 'negative' : ''}">${formatPercent(company.grossMargin)}</span>
                        </div>
                    ` : ''}
                    ${company.cashStatus ? `
                        <div class="metric">
                            <span class="metric-label">Cash</span>
                            <span class="metric-value ${company.cashStatus === 'Low' ? 'negative' : ''}">${company.cashStatus}</span>
                        </div>
                    ` : ''}
                    ${company.debt ? `
                        <div class="metric">
                            <span class="metric-label">Debt</span>
                            <span class="metric-value">${formatCurrency(company.debt)}</span>
                        </div>
                    ` : ''}
                </div>
                
                ${isExpanded ? renderExpandedContent(company) : ''}
                
                <div class="company-card-expand">
                    <span class="expand-icon">${isExpanded ? '▲' : '▼'}</span>
                </div>
            </div>
        `;
    }
    
    /**
     * Render expanded card content
     */
    function renderExpandedContent(company) {
        return `
            <div class="company-card-expanded">
                ${company.summary ? `
                    <div class="expanded-section">
                        <h4>Overview</h4>
                        <p>${company.summary}</p>
                    </div>
                ` : ''}
                
                ${company.keyFacts && company.keyFacts.length > 0 ? `
                    <div class="expanded-section">
                        <h4>Key Facts</h4>
                        <ul class="key-facts-list">
                            ${company.keyFacts.map(fact => `<li>${escapeHtml(fact)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${company.alerts && company.alerts.length > 0 ? `
                    <div class="expanded-section">
                        <h4>⚠️ Alerts</h4>
                        <ul class="company-alerts-list">
                            ${company.alerts.map(alert => `
                                <li class="alert-${alert.severity || 'info'}">${escapeHtml(alert.message)}</li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * Render alerts section
     */
    function renderAlertsSection(alerts) {
        return `
            <div class="cfo-section">
                <h3 class="cfo-section-title">⚠️ Alerts</h3>
                <div class="cfo-alerts">
                    ${alerts.map(alert => `
                        <div class="cfo-alert alert-${alert.severity || 'warning'}">
                            <span class="alert-icon">${getAlertIcon(alert.severity)}</span>
                            <span class="alert-message">${escapeHtml(alert.message)}</span>
                            ${alert.company ? `<span class="alert-company">${alert.company}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * Get alert icon by severity
     */
    function getAlertIcon(severity) {
        switch (severity) {
            case 'critical': return '🔴';
            case 'warning': return '🟡';
            case 'info': return '🔵';
            default: return '⚠️';
        }
    }
    
    /**
     * Toggle card expansion
     */
    function toggleCard(companyId) {
        if (expandedCards.has(companyId)) {
            expandedCards.delete(companyId);
        } else {
            expandedCards.add(companyId);
        }
        render();
    }
    
    /**
     * Trigger a CFO action (shows message to user)
     */
    function triggerAction(command) {
        // Try to use the existing notification system if available
        if (window.showToast) {
            window.showToast(`Send "${command}" in chat to run analysis`, 'info');
        } else {
            alert(`To run analysis, send "${command}" in your Telegram chat with Bob.`);
        }
    }
    
    /**
     * Escape HTML
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Bind event handlers
     */
    function bindEvents() {
        // Cards are handled via onclick attributes
    }
    
    /**
     * Refresh data
     */
    async function refresh() {
        const refreshBtn = document.querySelector('.cfo-refresh-btn');
        if (refreshBtn) {
            refreshBtn.classList.add('spinning');
        }
        
        await loadCFOData();
        render();
        
        if (refreshBtn) {
            refreshBtn.classList.remove('spinning');
        }
    }
    
    // Public API
    return {
        init,
        refresh,
        toggleCard,
        triggerAction
    };
})();

// Initialize when tab becomes active
document.addEventListener('DOMContentLoaded', () => {
    const cfoTab = document.getElementById('cfo-tab');
    if (cfoTab && cfoTab.classList.contains('active')) {
        CFOModule.init();
    }
});

// Export for global access
window.CFOModule = CFOModule;
