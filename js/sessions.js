/**
 * Sessions Module - Session Viewer for Mission Control
 * Lists all active Bob sessions with filtering and sorting
 */

const SessionsModule = (function() {
    'use strict';
    
    const REFRESH_INTERVAL = 30000;

    /**
     * Get sessions data URL (gateway or static fallback)
     */
    function getDataUrl() {
        const gwUrl = localStorage.getItem('mc_gateway_url');
        if (gwUrl) return gwUrl.replace(/\/$/, '') + '/api/sessions';
        return 'data/sessions.json';
    }
    
    let data = null;
    let refreshTimer = null;
    let currentFilter = 'all';
    let currentSort = 'recent';
    let expandedSessions = new Set();
    
    // Channel icons/emoji
    const CHANNEL_ICONS = {
        'telegram': '📱',
        'whatsapp': '💬',
        'discord': '🎮',
        'internal': '🔧',
        'email': '📧',
        'sms': '📲',
        'default': '💻'
    };
    
    // Kind labels and colors
    const KIND_INFO = {
        'main': { label: 'Main', color: '#00ff88', icon: '🎯' },
        'subagent': { label: 'Sub-Bob', color: '#a855f7', icon: '🤖' },
        'cron': { label: 'Cron', color: '#4ecdc4', icon: '⏰' },
        'group': { label: 'Group', color: '#ff6b8a', icon: '👥' },
        'dm': { label: 'DM', color: '#ffc107', icon: '💬' }
    };

    function toFiniteNumber(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function toContextPercent(value) {
        return Math.max(0, Math.min(100, Math.round(toFiniteNumber(value, 0))));
    }
    
    /**
     * Initialize the module
     */
    async function init() {
        console.log('📡 Sessions Module initializing...');
        
        await refresh();
        setupEventListeners();
        setupVisibilityHandler();
        startAutoRefresh();
        
        console.log('✅ Sessions Module ready');
    }
    
    /**
     * Pause/resume refresh when tab visibility changes
     * (Follows pattern from ActivityModule)
     */
    function setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopAutoRefresh();
            } else {
                refresh();
                startAutoRefresh();
            }
        });
    }
    
    /**
     * Fetch and render sessions data
     */
    async function refresh() {
        try {
            const url = getDataUrl();
            const response = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now());
            if (!response.ok) throw new Error('Failed to fetch sessions');
            
            data = await response.json();
            render();
            updateTimestamp();
            
        } catch (error) {
            console.error('❌ Sessions fetch error:', error);
            renderError();
        }
    }
    
    /**
     * Setup event listeners for filters and sorting
     */
    function setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('[data-session-filter]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const clicked = e.currentTarget;
                currentFilter = clicked.dataset.sessionFilter;
                document.querySelectorAll('[data-session-filter]').forEach(b => 
                    b.classList.toggle('active', b.dataset.sessionFilter === currentFilter)
                );
                render();
            });
        });
        
        // Sort select
        const sortSelect = document.getElementById('sessionSort');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                currentSort = e.target.value;
                render();
            });
        }
    }
    
    /**
     * Filter sessions by type
     */
    function filterSessions(sessions) {
        if (currentFilter === 'all') return sessions;
        return sessions.filter(s => s.kind === currentFilter);
    }
    
    /**
     * Sort sessions
     */
    function sortSessions(sessions) {
        const sorted = [...sessions];
        
        switch (currentSort) {
            case 'recent':
                sorted.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
                break;
            case 'tokens':
                sorted.sort((a, b) => toFiniteNumber(b?.totalTokens, 0) - toFiniteNumber(a?.totalTokens, 0));
                break;
            case 'name':
                sorted.sort((a, b) => String(a?.key || '').localeCompare(String(b?.key || '')));
                break;
            case 'context':
                sorted.sort((a, b) => toFiniteNumber(b?.contextPercent, 0) - toFiniteNumber(a?.contextPercent, 0));
                break;
        }
        
        return sorted;
    }
    
    /**
     * Render sessions list
     */
    function render() {
        const container = document.getElementById('sessionsListContainer');
        if (!container || !data) return;
        
        const sourceSessions = Array.isArray(data.sessions) ? data.sessions : [];
        let sessions = filterSessions(sourceSessions);
        sessions = sortSessions(sessions);
        
        // Update counts
        updateCounts();
        
        if (sessions.length === 0) {
            container.innerHTML = `
                <div class="sessions-empty">
                    <span class="empty-icon">🔍</span>
                    <p>No sessions match the current filter</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = sessions.map(session => renderSessionRow(session)).join('');
        
        // Add click handlers for expansion
        container.querySelectorAll('.session-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('.session-actions')) return;
                toggleSessionExpand(row.dataset.sessionKey);
            });
        });
        
        container.querySelectorAll('.btn-session-action[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                let sessionKey = '';
                try {
                    sessionKey = decodeURIComponent(btn.dataset.sessionKey || '');
                } catch (_) {
                    return;
                }
                
                if (!sessionKey) return;
                if (btn.dataset.action === 'history') viewHistory(sessionKey);
                if (btn.dataset.action === 'copy') copyKey(sessionKey);
            });
        });
    }
    
    /**
     * Render a single session row
     */
    function renderSessionRow(session) {
        const kindInfo = KIND_INFO[session?.kind] || KIND_INFO.main;
        const channelIcon = CHANNEL_ICONS[session?.channel] || CHANNEL_ICONS.default;
        const sessionKey = String(session?.key || '');
        const isExpanded = expandedSessions.has(sessionKey);
        const contextPercent = toContextPercent(session?.contextPercent);
        const totalTokens = toFiniteNumber(session?.totalTokens, 0);
        const messageCount = Math.max(0, Math.floor(toFiniteNumber(session?.messageCount, 0)));
        const statusTime = session?.lastMessageTime || null;

        const displayName = getDisplayName(session);
        const safeDisplayName = Utils.escapeHtml(displayName);
        const safeModel = Utils.escapeHtml(session?.model || 'Unknown');
        const safeLabel = session?.label ? Utils.escapeHtml(session.label) : '';
        const safeSessionKey = Utils.escapeHtml(sessionKey);
        
        // Token bar color based on context
        const contextClass = contextPercent > 80 ? 'critical' : 
                            contextPercent > 50 ? 'warning' : 'healthy';
        
        return `
            <div class="session-row ${isExpanded ? 'expanded' : ''}" data-session-key="${safeSessionKey}">
                <div class="session-header">
                    <div class="session-kind" style="--kind-color: ${kindInfo.color}">
                        <span class="kind-icon">${kindInfo.icon}</span>
                        <span class="kind-label">${kindInfo.label}</span>
                    </div>
                    
                    <div class="session-main">
                        <div class="session-name">
                            <span class="channel-icon">${channelIcon}</span>
                            <span class="session-title">${safeDisplayName}</span>
                        </div>
                        <div class="session-meta">
                            <span class="session-model">${safeModel}</span>
                            <span class="session-msgs">${messageCount} msgs</span>
                            ${session?.label ? `<span class="session-label">${safeLabel}</span>` : ''}
                        </div>
                    </div>
                    
                    <div class="session-tokens">
                        <div class="tokens-value">${Utils.formatTokens(totalTokens)}</div>
                        <div class="context-bar-small ${contextClass}">
                            <div class="context-fill-small" style="width: ${contextPercent}%"></div>
                        </div>
                        <div class="context-label">${contextPercent}% ctx</div>
                    </div>
                    
                    <div class="session-time">
                        ${Utils.formatRelativeTime(statusTime)}
                    </div>
                    
                    <div class="session-expand-icon">
                        ${isExpanded ? '▼' : '▶'}
                    </div>
                </div>
                
                ${isExpanded ? renderSessionDetails(session) : ''}
            </div>
        `;
    }
    
    /**
     * Render expanded session details
     */
    function renderSessionDetails(session) {
        const sessionKey = String(session?.key || '');
        const encodedSessionKey = encodeURIComponent(sessionKey);
        const safeSessionKey = Utils.escapeHtml(sessionKey);
        const safeChannel = Utils.escapeHtml(session?.channel || 'Unknown');
        const safeModel = Utils.escapeHtml(session?.model || 'Unknown');
        const safeParentSession = session?.parentSession ? Utils.escapeHtml(truncateKey(session.parentSession)) : '';
        const safeSchedule = session?.schedule ? Utils.escapeHtml(session.schedule) : '';
        const safeTotalTokens = toFiniteNumber(session?.totalTokens, 0).toLocaleString('en-US');
        const safeLastMessage = Utils.escapeHtml(session?.lastMessage || 'No message content');
        
        return `
            <div class="session-details">
                <div class="session-info-grid">
                    <div class="info-item">
                        <span class="info-label">Session Key</span>
                        <code class="info-value session-key-full">${safeSessionKey}</code>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Channel</span>
                        <span class="info-value">${safeChannel}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Model</span>
                        <span class="info-value">${safeModel}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Total Tokens</span>
                        <span class="info-value">${safeTotalTokens}</span>
                    </div>
                    ${session?.parentSession ? `
                    <div class="info-item">
                        <span class="info-label">Parent Session</span>
                        <code class="info-value">${safeParentSession}</code>
                    </div>
                    ` : ''}
                    ${session?.schedule ? `
                    <div class="info-item">
                        <span class="info-label">Schedule</span>
                        <code class="info-value">${safeSchedule}</code>
                    </div>
                    ` : ''}
                </div>
                
                <div class="last-message-box">
                    <div class="last-message-header">
                        <span>Last Message</span>
                        <span class="last-message-time">${formatDateTime(session?.lastMessageTime)}</span>
                    </div>
                    <div class="last-message-content">${safeLastMessage}</div>
                </div>
                
                <div class="session-actions">
                    <button class="btn-session-action" data-action="history" data-session-key="${encodedSessionKey}" title="View conversation history">
                        📜 View History
                    </button>
                    <button class="btn-session-action" data-action="copy" data-session-key="${encodedSessionKey}" title="Copy session key">
                        📋 Copy Key
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * Toggle session expansion
     */
    function toggleSessionExpand(sessionKey) {
        if (expandedSessions.has(sessionKey)) {
            expandedSessions.delete(sessionKey);
        } else {
            expandedSessions.add(sessionKey);
        }
        render();
    }
    
    /**
     * View conversation history (opens modal)
     */
    function viewHistory(sessionKey) {
        // For now, show a placeholder modal
        const modal = document.getElementById('sessionHistoryModal');
        if (!modal) return;
        
        const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
        const session = sessions.find(s => s.key === sessionKey);
        if (!session) return;
        
        const title = document.getElementById('historyModalTitle');
        const content = document.getElementById('historyModalContent');
        
        if (title) title.textContent = `History: ${getDisplayName(session)}`;
        if (content) {
            const safeKey = Utils.escapeHtml(truncateKey(sessionKey));
            const safeMsgCount = Math.max(0, Math.floor(toFiniteNumber(session?.messageCount, 0)));
            content.innerHTML = `
                <div class="history-placeholder">
                    <span class="placeholder-icon">📜</span>
                    <p>Conversation history would load here</p>
                    <p class="placeholder-hint">Session: <code>${safeKey}</code></p>
                    <p class="placeholder-hint">${safeMsgCount} messages in session</p>
                </div>
            `;
        }
        
        modal.classList.add('open');
    }
    
    /**
     * Copy session key to clipboard
     */
    async function copyKey(sessionKey) {
        try {
            await navigator.clipboard.writeText(sessionKey);
            Utils.showToast('Session key copied!', 'success');
        } catch (e) {
            console.error('Failed to copy:', e);
            Utils.showToast('Failed to copy key', 'error');
        }
    }
    
    /**
     * Update counts in filter buttons
     */
    function updateCounts() {
        if (!data || !data.sessions) return;
        
        const counts = { all: data.sessions.length };
        data.sessions.forEach(s => {
            counts[s.kind] = (counts[s.kind] || 0) + 1;
        });
        
        document.querySelectorAll('[data-session-filter]').forEach(btn => {
            const filter = btn.dataset.sessionFilter;
            const countEl = btn.querySelector('.filter-count');
            if (countEl) {
                countEl.textContent = counts[filter] || 0;
            }
        });
    }
    
    /**
     * Get display name from session
     */
    function getDisplayName(session) {
        if (session?.label) return session.label;
        
        const key = String(session?.key || '');
        const parts = key ? key.split(':') : [];
        const tail = parts.length > 0 ? parts[parts.length - 1] : '';
        
        if (session?.kind === 'subagent') {
            return `Sub-Bob ${tail.slice(0, 8)}`;
        }
        
        if (session?.kind === 'cron') {
            return parts.slice(2).join(':') || 'Cron Job';
        }
        
        // For telegram/whatsapp groups
        if (parts.includes('group')) {
            const topicIdx = parts.indexOf('topic');
            if (topicIdx > 0) {
                return `Group (Topic ${parts[topicIdx + 1]})`;
            }
            return `Group ${tail.slice(-6)}`;
        }
        
        if (parts.includes('dm')) {
            return `DM ${tail.slice(-6)}`;
        }
        
        return parts.slice(-2).join(':') || key || 'Unknown session';
    }
    
    /**
     * Truncate session key for display
     */
    function truncateKey(key) {
        if (!key) return '';
        if (key.length <= 40) return key;
        return key.slice(0, 20) + '...' + key.slice(-15);
    }
    
    /**
     * Format full date/time
     */
    function formatDateTime(timestamp) {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }
    
    /**
     * Update timestamp display
     */
    function updateTimestamp() {
        const el = document.getElementById('sessionsUpdateTime');
        if (!el || !data) return;
        
        const d = new Date(data.lastUpdate);
        if (Number.isNaN(d.getTime())) {
            el.textContent = 'Updated: Unknown';
            return;
        }
        el.textContent = 'Updated: ' + d.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }
    
    /**
     * Render error state
     */
    function renderError() {
        const container = document.getElementById('sessionsListContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="sessions-error">
                <span class="error-icon">⚠️</span>
                <p>Failed to load sessions</p>
                <button class="retry-btn" onclick="SessionsModule.refresh()">Retry</button>
            </div>
        `;
    }
    
    /**
     * Start auto-refresh timer
     */
    function startAutoRefresh() {
        if (refreshTimer) clearInterval(refreshTimer);
        refreshTimer = setInterval(refresh, REFRESH_INTERVAL);
    }
    
    /**
     * Stop auto-refresh
     */
    function stopAutoRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
    }
    
    /**
     * Close history modal
     */
    function closeHistoryModal() {
        const modal = document.getElementById('sessionHistoryModal');
        if (modal) modal.classList.remove('open');
    }
    
    // Public API
    return {
        init,
        refresh,
        viewHistory,
        copyKey,
        closeHistoryModal,
        getData: () => data
    };
})();

// Export for debugging
if (typeof window !== 'undefined') {
    window.SessionsModule = SessionsModule;
}
