// Two-Way Control Panel — Mission Control v2
// Send commands, messages, and trigger actions via Gateway hooks API

(function() {
    'use strict';

    // Bob definitions with session keys for hooks/agent targeting
    const BOBS = [
        { id: 'main', name: 'Main Bob', emoji: '🎯', channel: 'telegram', sessionKey: 'agent:main:telegram:group:-1003765361939:topic:1' },
        { id: 'kcc', name: 'KCC Bob', emoji: '🏗️', channel: 'telegram', sessionKey: 'agent:main:telegram:group:-1003765361939:topic:4' },
        { id: 'personal', name: 'Personal Bob', emoji: '🏠', channel: 'telegram', sessionKey: 'agent:main:telegram:group:-1003765361939:topic:5' },
        { id: 'dmi', name: 'DMI Bob', emoji: '🔧', channel: 'telegram', sessionKey: 'agent:main:telegram:group:-1003765361939:topic:6' },
        { id: 'sawdot', name: 'SawDot Bob', emoji: '🪚', channel: 'telegram', sessionKey: 'agent:main:telegram:group:-1003765361939:topic:7' },
        { id: 'mrbex', name: 'MrBex Bob', emoji: '🎬', channel: 'telegram', sessionKey: 'agent:main:telegram:group:-1003765361939:topic:8' }
    ];

    // Quick action definitions (use hooks API)
    const QUICK_ACTIONS = [
        { id: 'heartbeat', name: 'Heartbeat Poll', emoji: '💓', description: 'Trigger main heartbeat check', type: 'wake' },
        { id: 'email-check', name: 'Email Check', emoji: '📧', description: 'Spawn agent to check all email', type: 'spawn', task: 'Check all email accounts for urgent unread messages. Report back with a summary.' },
        { id: 'daily-standup', name: 'Daily Standup', emoji: '📊', description: 'Generate daily standup report', type: 'spawn', task: 'Generate a daily standup report. Summarize completed work, in-progress tasks, and blockers.' },
        { id: 'memory-flush', name: 'Memory Flush', emoji: '🧠', description: 'Flush session memory to files', type: 'wake', text: 'Flush all important session context to memory files immediately.' }
    ];

    // State
    let connectionStatus = 'disconnected';
    let initialized = false;

    // ========================================
    // UI Rendering
    // ========================================

    function renderControlPanel() {
        const container = document.getElementById('control-panel');
        if (!container) return;

        container.innerHTML = `
            <!-- Connection Settings -->
            <div class="control-section" id="connection-section">
                <div class="control-section-header">
                    <h3>🔌 Gateway Connection</h3>
                    <span class="connection-status" id="connection-status">
                        <span class="status-dot"></span>
                        <span class="status-text">Checking...</span>
                    </span>
                </div>
                <div class="control-section-body">
                    <div class="form-row">
                        <div class="form-group flex-2">
                            <label for="gateway-url">Gateway URL</label>
                            <input type="url" id="gateway-url" 
                                   value="${Utils.escapeHtml(String(Gateway.getUrl() || ''))}" 
                                   placeholder="https://your-tunnel.trycloudflare.com">
                        </div>
                        <div class="form-group flex-3">
                            <label for="gateway-token">Auth Token</label>
                            <div class="token-input-wrapper">
                                <input type="password" id="gateway-token" 
                                       value="${Utils.escapeHtml(String(Gateway.getToken() || ''))}" 
                                       placeholder="Enter your gateway token">
                                <button type="button" class="btn-icon" id="toggle-token-visibility" title="Show/hide token">
                                    👁️
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="form-actions-inline">
                        <button type="button" class="btn btn-primary" id="test-connection">
                            <span class="btn-text">🔗 Test Connection</span>
                            <span class="btn-spinner"></span>
                        </button>
                        <button type="button" class="btn btn-secondary" id="save-settings">
                            💾 Save Settings
                        </button>
                        <button type="button" class="btn btn-danger-outline" id="clear-token">
                            🗑️ Clear Token
                        </button>
                    </div>
                </div>
            </div>

            <!-- Message Composer -->
            <div class="control-section" id="message-section">
                <div class="control-section-header">
                    <h3>💬 Send Message</h3>
                </div>
                <div class="control-section-body">
                    <form id="message-form" class="control-form">
                        <div class="form-row">
                            <div class="form-group flex-1">
                                <label for="message-target">Send To</label>
                                <select id="message-target" required>
                                    <option value="">Select a Bob...</option>
                                    ${BOBS.map(bob => `
                                        <option value="${bob.id}">${bob.emoji} ${bob.name}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="message-content">Message</label>
                            <textarea id="message-content" rows="3" 
                                      placeholder="Type your message to the Bob..." required></textarea>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">
                                <span class="btn-text">📤 Send via Gateway</span>
                                <span class="btn-spinner"></span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Task Creator -->
            <div class="control-section" id="task-section">
                <div class="control-section-header">
                    <h3>📋 Create Task</h3>
                </div>
                <div class="control-section-body">
                    <form id="task-form" class="control-form">
                        <div class="form-row">
                            <div class="form-group flex-2">
                                <label for="task-title">Task Title</label>
                                <input type="text" id="task-title" 
                                       placeholder="e.g., update-documentation" required>
                            </div>
                            <div class="form-group flex-1">
                                <label for="task-priority">Priority</label>
                                <select id="task-priority">
                                    <option value="high">🔴 High</option>
                                    <option value="medium" selected>🟡 Medium</option>
                                    <option value="low">🟢 Low</option>
                                </select>
                            </div>
                            <div class="form-group flex-1">
                                <label for="task-assignee">Assignee</label>
                                <select id="task-assignee">
                                    <option value="main">🎯 Main Bob</option>
                                    ${BOBS.filter(b => b.id !== 'main').map(bob => `
                                        <option value="${bob.id}">${bob.emoji} ${bob.name}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="task-description">Description</label>
                            <textarea id="task-description" rows="3" 
                                      placeholder="Describe what needs to be done..."></textarea>
                        </div>
                        <div class="form-group">
                            <label for="task-success">Success Criteria</label>
                            <input type="text" id="task-success" 
                                   placeholder="How do we know it's done?">
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">
                                <span class="btn-text">✨ Create Task</span>
                                <span class="btn-spinner"></span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Quick Actions (formerly Cron Jobs) -->
            <div class="control-section" id="cron-section">
                <div class="control-section-header">
                    <h3>⚡ Quick Actions</h3>
                </div>
                <div class="control-section-body">
                    <div class="cron-grid" id="cron-grid">
                        ${QUICK_ACTIONS.map(action => `
                            <div class="cron-card" data-action-id="${action.id}">
                                <div class="cron-icon">${action.emoji}</div>
                                <div class="cron-info">
                                    <span class="cron-name">${action.name}</span>
                                    <span class="cron-desc">${action.description}</span>
                                </div>
                                <button type="button" class="btn btn-small btn-primary cron-trigger" 
                                        data-action="${action.id}" title="Run ${action.name}">
                                    <span class="btn-text">▶️ Run</span>
                                    <span class="btn-spinner"></span>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- Response Log -->
            <div class="control-section" id="response-section">
                <div class="control-section-header">
                    <h3>📜 Response Log</h3>
                    <button type="button" class="btn btn-small btn-secondary" id="clear-log">
                        🗑️ Clear
                    </button>
                </div>
                <div class="control-section-body">
                    <div class="response-log" id="response-log">
                        <div class="log-empty">
                            <span class="log-empty-icon">📭</span>
                            <span>No responses yet. Send a command to see results here.</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        attachEventListeners();
        // Check connection status on load
        checkConnectionStatus();
    }

    // ========================================
    // Connection Management
    // ========================================

    async function checkConnectionStatus() {
        if (!Gateway.hasToken()) {
            updateConnectionStatus('disconnected');
            return;
        }
        
        updateConnectionStatus('connecting');
        const result = await Gateway.testConnection();
        updateConnectionStatus(result.success ? 'connected' : 'error');
    }

    // ========================================
    // Event Handlers
    // ========================================

    function attachEventListeners() {
        // Connection settings
        document.getElementById('test-connection')?.addEventListener('click', handleTestConnection);
        document.getElementById('save-settings')?.addEventListener('click', handleSaveSettings);
        document.getElementById('clear-token')?.addEventListener('click', handleClearToken);
        document.getElementById('toggle-token-visibility')?.addEventListener('click', toggleTokenVisibility);

        // Message form
        document.getElementById('message-form')?.addEventListener('submit', handleSendMessage);

        // Task form
        document.getElementById('task-form')?.addEventListener('submit', handleCreateTask);

        // Quick action triggers
        document.querySelectorAll('.cron-trigger').forEach(btn => {
            btn.addEventListener('click', () => handleTriggerAction(btn.dataset.action, btn));
        });

        // Clear response log
        document.getElementById('clear-log')?.addEventListener('click', clearResponseLog);
    }

    async function handleTestConnection() {
        const btn = document.getElementById('test-connection');
        setButtonLoading(btn, true);
        updateConnectionStatus('connecting');

        // Save current field values first
        handleSaveSettings();

        try {
            const result = await Gateway.testConnection();
            
            if (result.success) {
                updateConnectionStatus('connected');
                addToLog('success', 'Gateway connected! Hooks API is reachable.', result.data);
                showToast('Connected to gateway!', 'success');
            } else {
                updateConnectionStatus('error');
                addToLog('error', 'Connection failed', result.error);
                showToast(`Connection failed: ${result.error}`, 'error');
            }
        } catch (error) {
            updateConnectionStatus('error');
            addToLog('error', 'Connection error', error.message);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            setButtonLoading(btn, false);
        }
    }

    function handleSaveSettings() {
        const url = document.getElementById('gateway-url')?.value;
        const token = document.getElementById('gateway-token')?.value;

        if (url) Gateway.setUrl(url);
        if (token) Gateway.setToken(token);
        updateConnectionUI();

        showToast('Settings saved', 'info');
    }

    function handleClearToken() {
        Gateway.setToken('');
        document.getElementById('gateway-token').value = '';
        updateConnectionStatus('disconnected');
        updateConnectionUI();
        showToast('Token cleared', 'info');
    }

    function toggleTokenVisibility() {
        const input = document.getElementById('gateway-token');
        const btn = document.getElementById('toggle-token-visibility');
        if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '🙈';
        } else {
            input.type = 'password';
            btn.textContent = '👁️';
        }
    }

    /**
     * Send message via hooks/agent — delivers to the correct Bob session
     */
    async function handleSendMessage(e) {
        e.preventDefault();
        const form = e.target;
        const btn = form.querySelector('button[type="submit"]');
        
        const targetId = document.getElementById('message-target').value;
        const message = document.getElementById('message-content').value;

        if (!targetId || !message) {
            showToast('Please select a Bob and enter a message', 'warning');
            return;
        }

        if (!Gateway.hasToken()) {
            showToast('Gateway not configured — save your token first', 'warning');
            return;
        }

        const bob = BOBS.find(b => b.id === targetId);
        if (!bob) return;

        setButtonLoading(btn, true);

        try {
            const result = await Gateway.sendMessage(bob.sessionKey, message, {
                name: 'Mission Control',
                channel: bob.channel
            });
            addToLog('success', `Message sent to ${bob.emoji} ${bob.name}`, { target: targetId, message, response: result });
            showToast(`Message sent to ${bob.name}!`, 'success');
            form.reset();
        } catch (error) {
            addToLog('error', 'Failed to send message', error.message);
            showToast(`Failed: ${error.message}`, 'error');
        } finally {
            setButtonLoading(btn, false);
        }
    }

    /**
     * Create task via hooks/agent — sends instruction to assigned Bob
     */
    async function handleCreateTask(e) {
        e.preventDefault();
        const form = e.target;
        const btn = form.querySelector('button[type="submit"]');

        const title = document.getElementById('task-title').value.trim();
        const description = document.getElementById('task-description').value.trim();
        const priority = document.getElementById('task-priority').value;
        const assigneeId = document.getElementById('task-assignee').value;
        const success = document.getElementById('task-success').value.trim();

        if (!title) {
            showToast('Please enter a task title', 'warning');
            return;
        }

        if (!Gateway.hasToken()) {
            showToast('Gateway not configured — save your token first', 'warning');
            return;
        }

        const bob = BOBS.find(b => b.id === assigneeId) || BOBS[0];
        const taskMessage = [
            `Create task: "${title}"`,
            description ? `Description: ${description}` : null,
            `Priority: ${priority}`,
            success ? `Success criteria: ${success}` : null
        ].filter(Boolean).join('. ');

        setButtonLoading(btn, true);

        try {
            const result = await Gateway.sendMessage(bob.sessionKey, taskMessage, {
                name: 'Mission Control',
                channel: bob.channel
            });
            addToLog('success', `Task "${title}" sent to ${bob.emoji} ${bob.name}`, { task: title, priority, assignee: bob.name, response: result });
            showToast(`Task "${title}" created!`, 'success');
            form.reset();
        } catch (error) {
            addToLog('error', 'Failed to create task', error.message);
            showToast(`Failed: ${error.message}`, 'error');
        } finally {
            setButtonLoading(btn, false);
        }
    }

    /**
     * Trigger a quick action via hooks API
     */
    async function handleTriggerAction(actionId, btn) {
        const action = QUICK_ACTIONS.find(a => a.id === actionId);
        if (!action) return;

        if (!Gateway.hasToken()) {
            showToast('Gateway not configured — save your token first', 'warning');
            return;
        }

        setButtonLoading(btn, true);

        try {
            let result;

            if (action.type === 'wake') {
                result = await Gateway.triggerHeartbeat(action.text || `${action.name} triggered from Mission Control`);
            } else if (action.type === 'spawn') {
                result = await Gateway.spawnAgent(action.task, null, action.id);
            }

            addToLog('success', `${action.emoji} ${action.name} triggered`, result);
            showToast(`${action.emoji} ${action.name} triggered!`, 'success');
        } catch (error) {
            addToLog('error', `Failed: ${action.name}`, error.message);
            showToast(`Failed: ${error.message}`, 'error');
        } finally {
            setButtonLoading(btn, false);
        }
    }

    // ========================================
    // UI Helpers
    // ========================================

    function updateConnectionStatus(status) {
        connectionStatus = status;
        const statusEl = document.getElementById('connection-status');
        if (!statusEl) return;

        const dot = statusEl.querySelector('.status-dot');
        const text = statusEl.querySelector('.status-text');

        dot.className = 'status-dot';
        
        switch (status) {
            case 'connected':
                dot.classList.add('online');
                text.textContent = 'Connected';
                break;
            case 'connecting':
                dot.classList.add('connecting');
                text.textContent = 'Connecting...';
                break;
            case 'error':
                dot.classList.add('error');
                text.textContent = 'Error';
                break;
            default:
                text.textContent = Gateway.hasToken() ? 'Configured' : 'Not configured';
        }
    }

    function updateConnectionUI() {
        const hasToken = Gateway.hasToken();
        const clearBtn = document.getElementById('clear-token');
        if (clearBtn) {
            clearBtn.style.display = hasToken ? 'inline-flex' : 'none';
        }
    }

    function getBobName(id) {
        const bob = BOBS.find(b => b.id === id);
        return bob ? `${bob.emoji} ${bob.name}` : id;
    }

    function setButtonLoading(button, isLoading) {
        if (!button) return;
        if (isLoading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    function showToast(message, type = 'info') {
        Utils.showToast(message, type);
    }

    function addToLog(type, message, data = null) {
        const log = document.getElementById('response-log');
        if (!log) return;

        // Remove empty state
        const emptyState = log.querySelector('.log-empty');
        if (emptyState) emptyState.remove();

        const timestamp = new Date().toLocaleTimeString();
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };

        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        const safeMessage = Utils.escapeHtml(message);
        const safeData = data ? Utils.escapeHtml(JSON.stringify(data, null, 2)) : '';
        entry.innerHTML = `
            <div class="log-header">
                <span class="log-icon">${icons[type] || icons.info}</span>
                <span class="log-message">${safeMessage}</span>
                <span class="log-time">${timestamp}</span>
            </div>
            ${data ? `<pre class="log-data">${safeData}</pre>` : ''}
        `;

        // Add click to expand/collapse
        if (data) {
            entry.querySelector('.log-header').addEventListener('click', () => {
                entry.classList.toggle('expanded');
            });
            entry.classList.add('has-data');
        }

        log.insertBefore(entry, log.firstChild);

        // Limit log entries
        const entries = log.querySelectorAll('.log-entry');
        if (entries.length > 50) {
            entries[entries.length - 1].remove();
        }
    }

    function clearResponseLog() {
        const log = document.getElementById('response-log');
        if (!log) return;

        log.innerHTML = `
            <div class="log-empty">
                <span class="log-empty-icon">📭</span>
                <span>No responses yet. Send a command to see results here.</span>
            </div>
        `;
    }

    // ========================================
    // Module Initialization
    // ========================================

    function init() {
        if (initialized) return;
        initialized = true;
        renderControlPanel();
        console.log('🎮 Control Panel initialized (hooks API)');
    }

    function refresh() {
        renderControlPanel();
    }

    // Expose module
    window.ControlModule = {
        init,
        refresh,
        BOBS,
        QUICK_ACTIONS
    };

    // Auto-init if control tab exists
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (document.getElementById('control-panel')) {
                init();
            }
        });
    } else {
        if (document.getElementById('control-panel')) {
            init();
        }
    }
})();
