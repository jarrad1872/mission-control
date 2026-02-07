/**
 * Bob Status Module — Compact Chip View (#2)
 * Shows all Bobs as compact chips in a horizontal row
 * Tap to expand full details in a modal
 */

const BobStatusModule = (function() {
    'use strict';
    
    const REFRESH_INTERVAL = 30000; // 30 seconds
    const DATA_URL = 'data/bob-status.json';
    
    let refreshTimer = null;
    let statusData = null;
    
    /**
     * Initialize the module
     */
    async function init() {
        console.log('👥 Bob Status Module initializing...');
        
        setupModalHandlers();
        await refresh();
        startAutoRefresh();
        
        console.log('✅ Bob Status Module ready');
    }
    
    /**
     * Setup modal handlers
     */
    function setupModalHandlers() {
        const modal = document.getElementById('bobDetailModal');
        const closeBtn = document.getElementById('closeBobDetail');
        const backdrop = modal?.querySelector('.modal-backdrop');
        
        closeBtn?.addEventListener('click', closeDetailModal);
        backdrop?.addEventListener('click', closeDetailModal);
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal?.classList.contains('open')) {
                closeDetailModal();
            }
        });
    }
    
    /**
     * Close detail modal
     */
    function closeDetailModal() {
        const modal = document.getElementById('bobDetailModal');
        modal?.classList.remove('open');
        document.body.style.overflow = '';
    }
    
    /**
     * Open detail modal for a specific Bob
     */
    function openDetailModal(bobId) {
        if (!statusData || !statusData.bobs) return;
        
        const bob = statusData.bobs.find(b => b.id === bobId);
        if (!bob) return;
        
        const modal = document.getElementById('bobDetailModal');
        const title = document.getElementById('bobDetailTitle');
        const content = document.getElementById('bobDetailContent');
        
        if (!modal || !content) return;
        
        title.textContent = bob.name;
        content.innerHTML = renderBobDetail(bob);
        
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    
    /**
     * Render full Bob detail view
     */
    function renderBobDetail(bob) {
        const statusLabels = {
            active: 'Active — Currently working',
            idle: 'Idle — Ready for tasks',
            error: 'Error — Needs attention',
            offline: 'Offline'
        };
        
        const contextLevel = getContextLevel(bob.contextPercent || 0);
        
        return `
            <div class="bob-detail-card">
                <div class="bob-detail-header">
                    <span class="bob-detail-emoji">${bob.emoji}</span>
                    <div class="bob-detail-info">
                        <h4>${bob.name}</h4>
                        <span class="bob-detail-channel">${bob.channel || 'Unknown channel'}</span>
                    </div>
                </div>
                
                <div class="bob-detail-status">
                    <span class="bob-detail-status-dot ${bob.status}"></span>
                    <span class="bob-detail-status-text">${statusLabels[bob.status] || bob.status}</span>
                </div>
                
                ${bob.description ? `<p class="bob-detail-description">${bob.description}</p>` : ''}
                
                ${bob.errorMessage ? `
                    <div class="bob-error-banner">
                        ⚠️ ${bob.errorMessage}
                    </div>
                ` : ''}
                
                <div class="bob-detail-metrics">
                    <div class="bob-metric-row">
                        <span class="bob-metric-label">Context</span>
                        ${renderContextGauge(bob.contextPercent || 0)}
                        <span class="bob-metric-value">${bob.contextPercent || 0}%</span>
                    </div>
                    <div class="bob-metric-row">
                        <span class="bob-metric-label">Last Active</span>
                        <span class="bob-metric-value">${formatRelativeTime(bob.lastActivity)}</span>
                    </div>
                    ${bob.sessionId ? `
                        <div class="bob-metric-row">
                            <span class="bob-metric-label">Session</span>
                            <span class="bob-metric-value" style="font-size: 0.75rem;">${bob.sessionId.slice(0, 20)}...</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    /**
     * Render circular context gauge (#9)
     */
    function renderContextGauge(percent) {
        const radius = 16;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;
        const level = getContextLevel(percent);
        
        return `
            <div class="context-gauge">
                <svg width="40" height="40" viewBox="0 0 40 40">
                    <circle class="context-gauge-bg" cx="20" cy="20" r="${radius}" />
                    <circle 
                        class="context-gauge-fill ${level}" 
                        cx="20" cy="20" r="${radius}"
                        stroke-dasharray="${circumference}"
                        stroke-dashoffset="${offset}"
                    />
                </svg>
                <span class="context-gauge-text">${percent}</span>
            </div>
        `;
    }
    
    /**
     * Get context level class
     */
    function getContextLevel(percent) {
        if (percent < 50) return 'low';
        if (percent < 80) return 'medium';
        return 'high';
    }
    
    /**
     * Fetch and render bob status
     */
    async function refresh() {
        try {
            const response = await fetch(DATA_URL + '?t=' + Date.now());
            if (!response.ok) throw new Error('Failed to fetch bob status');
            
            statusData = await response.json();
            renderChips();
            
        } catch (error) {
            console.error('❌ Bob Status fetch error:', error);
            renderError();
        }
    }
    
    /**
     * Render compact Bob chips (#2)
     */
    function renderChips() {
        const container = document.getElementById('bobSummaryChips');
        if (!container || !statusData) return;
        
        const bobs = statusData.bobs || [];
        
        container.innerHTML = bobs.map(bob => `
            <button class="bob-chip" data-bob="${bob.id}" title="${bob.name} — ${getStatusText(bob.status)}">
                <span class="bob-chip-emoji">${bob.emoji}</span>
                <span class="bob-chip-name">${getShortName(bob.name)}</span>
                <span class="bob-chip-status ${bob.status}"></span>
            </button>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.bob-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const bobId = chip.dataset.bob;
                openDetailModal(bobId);
            });
        });
    }
    
    /**
     * Get shortened name for chip
     */
    function getShortName(name) {
        // Extract just the first word or abbreviation
        if (name.includes('-')) {
            return name.split('-')[0];
        }
        return name.split(' ')[0];
    }
    
    /**
     * Render error state
     */
    function renderError() {
        const container = document.getElementById('bobSummaryChips');
        if (!container) return;
        
        container.innerHTML = `
            <div class="bob-chip" style="cursor: default;">
                <span class="bob-chip-emoji">⚠️</span>
                <span class="bob-chip-name">Load failed</span>
            </div>
        `;
    }
    
    /**
     * Get human-readable status text
     */
    function getStatusText(status) {
        const texts = {
            'idle': 'Idle',
            'active': 'Active',
            'error': 'Error',
            'offline': 'Offline'
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
        openDetailModal,
        closeDetailModal,
        startAutoRefresh,
        stopAutoRefresh
    };
})();

// Export for debugging
if (typeof window !== 'undefined') {
    window.BobStatusModule = BobStatusModule;
}
