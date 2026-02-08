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
        setupVisibilityHandler();
        await refresh();
        startAutoRefresh();
        
        console.log('✅ Bob Status Module ready');
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
                        <span class="bob-metric-value">${Utils.formatRelativeTime(bob.lastActivity)}</span>
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
     * Render compact Bob chips with inline expansion (#2)
     */
    function renderChips() {
        const container = document.getElementById('bobSummaryChips');
        if (!container || !statusData) return;
        
        const bobs = statusData.bobs || [];
        
        container.innerHTML = bobs.map(bob => {
            const contextPercent = bob.contextPercent || 0;
            const lastMessage = bob.lastMessage || 'No recent messages';
            const truncatedMessage = lastMessage.length > 60 
                ? lastMessage.substring(0, 60) + '...' 
                : lastMessage;
            
            return `
                <button class="bob-chip" data-bob="${bob.id}" title="${bob.name} — ${getStatusText(bob.status)}">
                    <div class="bob-chip-main">
                        <span class="bob-chip-emoji">${bob.emoji}</span>
                        <span class="bob-chip-name">${getShortName(bob.name)}</span>
                        <span class="bob-chip-status ${bob.status}"></span>
                    </div>
                    <div class="bob-chip-expanded">
                        <div class="bob-expanded-row">
                            <span class="bob-expanded-label">Context</span>
                            <span class="bob-expanded-value">${contextPercent}%</span>
                        </div>
                        <div class="bob-last-message">${Utils.escapeHtml(truncatedMessage)}</div>
                        <button class="bob-action-btn" data-action="message" data-bob="${bob.id}" onclick="event.stopPropagation();">
                            💬 Message
                        </button>
                    </div>
                </button>
            `;
        }).join('');
        
        // Add click handlers for chip expansion
        container.querySelectorAll('.bob-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                // Don't expand if clicking the message button
                if (e.target.closest('.bob-action-btn')) {
                    const bobId = e.target.dataset.bob;
                    handleMessageBob(bobId);
                    return;
                }
                
                // Toggle expansion
                const wasExpanded = chip.classList.contains('expanded');
                
                // Collapse all other chips
                container.querySelectorAll('.bob-chip.expanded').forEach(c => {
                    c.classList.remove('expanded');
                });
                
                // Toggle this chip
                if (!wasExpanded) {
                    chip.classList.add('expanded');
                }
            });
        });
    }
    
    // Telegram topic IDs for each Bob
    const BOB_TOPIC_MAP = {
        'main': 1,
        'standup': 1,
        'kcc': 4,
        'personal': 5,
        'dmi': 6,
        'sawdot': 7,
        'mrbex': 8
    };

    // Session keys for each Bob
    const BOB_SESSION_KEYS = {
        'main': 'agent:main:telegram:group:-1003765361939:topic:1',
        'standup': 'agent:main:telegram:group:-1003765361939:topic:1',
        'kcc': 'agent:main:telegram:group:-1003765361939:topic:4',
        'personal': 'agent:main:telegram:group:-1003765361939:topic:5',
        'dmi': 'agent:main:telegram:group:-1003765361939:topic:6',
        'sawdot': 'agent:main:telegram:group:-1003765361939:topic:7',
        'mrbex': 'agent:main:telegram:group:-1003765361939:topic:8'
    };

    /**
     * Handle message bob action — opens a send-message modal
     */
    function handleMessageBob(bobId) {
        const bob = statusData?.bobs?.find(b => b.id === bobId);
        if (!bob) return;

        const sessionKey = BOB_SESSION_KEYS[bobId] || '';
        const topicId = BOB_TOPIC_MAP[bobId];

        // Create or reuse message modal
        let modal = document.getElementById('bobMessageModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'bobMessageModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-backdrop"></div>
                <div class="modal-content modal-bottom-sheet">
                    <div class="modal-header">
                        <h3 id="bobMessageTitle">Message Bob</h3>
                        <button class="close-btn" id="closeBobMessage">×</button>
                    </div>
                    <div class="modal-body" id="bobMessageBody"></div>
                </div>
            `;
            document.body.appendChild(modal);

            // Close handlers
            modal.querySelector('#closeBobMessage').addEventListener('click', () => {
                modal.classList.remove('open');
                document.body.style.overflow = '';
            });
            modal.querySelector('.modal-backdrop').addEventListener('click', () => {
                modal.classList.remove('open');
                document.body.style.overflow = '';
            });
        }

        const title = modal.querySelector('#bobMessageTitle');
        const body = modal.querySelector('#bobMessageBody');
        title.textContent = `💬 Message ${bob.name}`;

        body.innerHTML = `
            <div class="bob-message-form">
                <textarea id="bobMessageInput" class="bob-message-textarea" rows="4"
                    placeholder="Type a message to ${bob.name}..."></textarea>
                <div class="bob-message-actions">
                    <button class="bob-msg-send-btn" id="bobMsgSendBtn">
                        📤 Send via Gateway
                    </button>
                    ${topicId ? `
                    <a class="bob-msg-tg-link" href="https://t.me/c/3765361939/${topicId}" target="_blank" rel="noopener">
                        📱 Open in Telegram
                    </a>` : ''}
                </div>
                <div class="bob-message-status" id="bobMsgStatus"></div>
            </div>
        `;

        // Send button handler
        const sendBtn = body.querySelector('#bobMsgSendBtn');
        const input = body.querySelector('#bobMessageInput');
        const statusEl = body.querySelector('#bobMsgStatus');

        sendBtn.addEventListener('click', async () => {
            const message = input.value.trim();
            if (!message) {
                statusEl.textContent = '⚠️ Please type a message';
                statusEl.className = 'bob-message-status error';
                return;
            }

            sendBtn.disabled = true;
            sendBtn.textContent = '⏳ Sending...';
            statusEl.textContent = '';

            try {
                if (typeof Gateway !== 'undefined' && Gateway.hasToken()) {
                    await Gateway.sendMessage(sessionKey, message);
                    statusEl.textContent = '✅ Message sent!';
                    statusEl.className = 'bob-message-status success';
                    input.value = '';
                    setTimeout(() => {
                        modal.classList.remove('open');
                        document.body.style.overflow = '';
                    }, 1200);
                } else {
                    statusEl.textContent = '⚠️ Gateway not configured. Use Settings to connect.';
                    statusEl.className = 'bob-message-status error';
                }
            } catch (err) {
                console.error('Send message error:', err);
                statusEl.textContent = `❌ ${err.message || 'Send failed'}`;
                statusEl.className = 'bob-message-status error';
            } finally {
                sendBtn.disabled = false;
                sendBtn.textContent = '📤 Send via Gateway';
            }
        });

        // Enter to send (Ctrl/Cmd+Enter)
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                sendBtn.click();
            }
        });

        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
        setTimeout(() => input.focus(), 100);
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
