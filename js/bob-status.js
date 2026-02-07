/**
 * Bob Status Module
 * Live status panel for the Bob Collective
 * Auto-refreshes every 30 seconds
 */

const BobStatusModule = (function() {
    'use strict';
    
    const REFRESH_INTERVAL = 30000; // 30 seconds
    const DATA_URL = 'data/bob-status.json';
    const STORAGE_KEY = 'bobStatusCollapsed';
    
    let refreshTimer = null;
    let statusData = null;
    
    /**
     * Initialize the module
     */
    async function init() {
        console.log('👥 Bob Status Module initializing...');
        
        // Setup collapse/expand functionality
        setupCollapseToggle();
        
        // Restore collapsed state from localStorage
        restoreCollapsedState();
        
        await refresh();
        startAutoRefresh();
        
        console.log('✅ Bob Status Module ready');
    }
    
    /**
     * Setup collapse toggle button
     */
    function setupCollapseToggle() {
        const header = document.getElementById('bobStatusHeader');
        const toggle = document.getElementById('bobStatusToggle');
        
        if (!header || !toggle) return;
        
        // Make header clickable
        header.style.cursor = 'pointer';
        
        // Add click handlers
        header.addEventListener('click', toggleCollapse);
        toggle.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent double-trigger
        });
    }
    
    /**
     * Toggle panel collapse state
     */
    function toggleCollapse() {
        const panel = document.querySelector('.bob-status-panel');
        if (!panel) return;
        
        const isCollapsed = panel.classList.toggle('collapsed');
        
        // Save state to localStorage
        localStorage.setItem(STORAGE_KEY, isCollapsed ? 'true' : 'false');
        
        console.log(`📊 Bob Status Panel ${isCollapsed ? 'collapsed' : 'expanded'}`);
    }
    
    /**
     * Restore collapsed state from localStorage
     */
    function restoreCollapsedState() {
        const panel = document.querySelector('.bob-status-panel');
        if (!panel) return;
        
        const isCollapsed = localStorage.getItem(STORAGE_KEY) === 'true';
        
        if (isCollapsed) {
            panel.classList.add('collapsed');
            console.log('📊 Bob Status Panel restored as collapsed');
        }
    }
    
    /**
     * Fetch and render bob status
     */
    async function refresh() {
        try {
            const response = await fetch(DATA_URL + '?t=' + Date.now());
            if (!response.ok) throw new Error('Failed to fetch bob status');
            
            statusData = await response.json();
            render();
            updatePanelTimestamp();
            
        } catch (error) {
            console.error('❌ Bob Status fetch error:', error);
            renderError();
        }
    }
    
    /**
     * Render the bob status cards
     */
    function render() {
        const container = document.getElementById('bobStatusGrid');
        if (!container || !statusData) return;
        
        const bobs = statusData.bobs || [];
        
        container.innerHTML = bobs.map(bob => `
            <div class="bob-card ${bob.status}" data-bob="${bob.id}">
                <div class="bob-header">
                    <span class="bob-emoji">${bob.emoji}</span>
                    <div class="bob-info">
                        <h3 class="bob-name">${bob.name}</h3>
                        <span class="bob-channel">${bob.channel || 'unknown'}</span>
                    </div>
                    <div class="bob-status-dot" title="${getStatusText(bob.status)}"></div>
                </div>
                <div class="bob-body">
                    ${bob.description ? `<p class="bob-description">${bob.description}</p>` : ''}
                    ${bob.errorMessage ? `<p class="bob-error">${bob.errorMessage}</p>` : ''}
                    <div class="bob-metrics">
                        <div class="metric">
                            <span class="metric-label">Context</span>
                            <div class="context-bar">
                                <div class="context-fill" style="width: ${bob.contextPercent || 0}%"></div>
                            </div>
                            <span class="metric-value">${bob.contextPercent || 0}%</span>
                        </div>
                    </div>
                    <div class="bob-activity">
                        <span class="activity-label">Last active:</span>
                        <span class="activity-time">${formatRelativeTime(bob.lastActivity)}</span>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add subtle animation for status changes
        animateStatusDots();
    }
    
    /**
     * Render error state
     */
    function renderError() {
        const container = document.getElementById('bobStatusGrid');
        if (!container) return;
        
        container.innerHTML = `
            <div class="bob-status-error">
                <span class="error-icon">⚠️</span>
                <p>Failed to load Bob status</p>
                <button class="retry-btn" onclick="BobStatusModule.refresh()">Retry</button>
            </div>
        `;
    }
    
    /**
     * Get human-readable status text
     */
    function getStatusText(status) {
        const texts = {
            'idle': 'Idle - Ready for tasks',
            'active': 'Active - Currently working',
            'error': 'Error - Needs attention'
        };
        return texts[status] || status;
    }
    
    /**
     * Format timestamp as relative time
     */
    function formatRelativeTime(timestamp) {
        if (!timestamp) return 'Unknown';
        
        const now = new Date();
        const then = new Date(timestamp);
        const diffMs = now - then;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    /**
     * Update the panel's last updated timestamp
     */
    function updatePanelTimestamp() {
        const el = document.getElementById('bobStatusUpdated');
        if (!el) return;
        
        const now = new Date();
        el.textContent = now.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
    }
    
    /**
     * Animate status dots for active bobs
     */
    function animateStatusDots() {
        const activeDots = document.querySelectorAll('.bob-card.active .bob-status-dot');
        activeDots.forEach(dot => {
            dot.classList.add('pulsing');
        });
    }
    
    /**
     * Start auto-refresh timer
     */
    function startAutoRefresh() {
        if (refreshTimer) clearInterval(refreshTimer);
        refreshTimer = setInterval(refresh, REFRESH_INTERVAL);
    }
    
    /**
     * Stop auto-refresh timer
     */
    function stopAutoRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
    }
    
    /**
     * Get current status data
     */
    function getData() {
        return statusData;
    }
    
    /**
     * Get status counts
     */
    function getStatusCounts() {
        if (!statusData || !statusData.bobs) return { idle: 0, active: 0, error: 0 };
        
        return statusData.bobs.reduce((acc, bob) => {
            acc[bob.status] = (acc[bob.status] || 0) + 1;
            return acc;
        }, { idle: 0, active: 0, error: 0 });
    }
    
    // Public API
    return {
        init,
        refresh,
        getData,
        getStatusCounts,
        startAutoRefresh,
        stopAutoRefresh
    };
})();

// Export for debugging
if (typeof window !== 'undefined') {
    window.BobStatusModule = BobStatusModule;
}
