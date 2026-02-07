// Two-Way Control Panel — Mission Control v2
// Send commands, messages, and trigger actions via Gateway API

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        defaultGatewayUrl: 'http://localhost:18789',
        storageKeys: {
            token: 'mc_gateway_token',
            gatewayUrl: 'mc_gateway_url'
        }
    };

    // Bob definitions (aligned with BOBS.md)
    const BOBS = [
        { id: 'personal', name: 'Personal Bob', emoji: '👤', channel: 'telegram' },
        { id: 'kcc', name: 'KCC Bob', emoji: '🏗️', channel: 'telegram' },
        { id: 'dmi', name: 'DMI Bob', emoji: '🔧', channel: 'telegram' },
        { id: 'rocdia', name: 'Roc Diamond Bob', emoji: '💎', channel: 'telegram' },
        { id: 'discord', name: 'Discord Bob', emoji: '💬', channel: 'discord' },
        { id: 'whatsapp', name: 'WhatsApp Bob', emoji: '📱', channel: 'whatsapp' }
    ];

    // Cron job definitions
    const CRON_JOBS = [
        { id: 'heartbeat', name: 'Heartbeat Poll', emoji: '💓', description: 'Trigger main heartbeat check' },
        { id: 'email-check', name: 'Email Check', emoji: '📧', description: 'Check all email accounts' },
        { id: 'daily-standup', name: 'Daily Standup', emoji: '📊', description: 'Generate daily standup report' },
        { id: 'memory-flush', name: 'Memory Flush', emoji: '🧠', description: 'Flush session memory to files' }
    ];

    // State
    let connectionStatus = 'disconnected'; // disconnected, connecting, connected, error

    // ========================================
    // Gateway API Client
    // ========================================

    class GatewayClient {
        constructor() {
            this.baseUrl = this.getGatewayUrl();
            this.token = this.getToken();
        }

        getGatewayUrl() {
            return localStorage.getItem(CONFIG.storageKeys.gatewayUrl) || CONFIG.defaultGatewayUrl;
        }

        setGatewayUrl(url) {
            localStorage.setItem(CONFIG.storageKeys.gatewayUrl, url);
            this.baseUrl = url;
        }

        getToken() {
            return localStorage.getItem(CONFIG.storageKeys.token) || '';
        }

        setToken(token) {
            if (token) {
                localStorage.setItem(CONFIG.storageKeys.token, token);
            } else {
                localStorage.removeItem(CONFIG.storageKeys.token);
            }
            this.token = token;
        }

        hasToken() {
            return !!this.token;
        }

        async request(endpoint, options = {}) {
            const url = `${this.baseUrl}${endpoint}`;
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };

            if (this.token) {
                headers['Authorization'] = `Bearer ${this.token}`;
            }

            const response = await fetch(url, {
                ...options,
                headers
            });

            if (!response.ok) {
                const error = await response.text().catch(() => 'Unknown error');
                throw new Error(`API Error ${response.status}: ${error}`);
            }

            return response.json().catch(() => ({}));
        }

        // Test connection to gateway
        async testConnection() {
            try {
                const response = await this.request('/health');
                return { success: true, data: response };
            } catch (error) {
                return { success: false, error: error.message };
            }
        }

        // Send chat message to a specific Bob/channel
        async sendMessage(target, message) {
            return this.request('/chat', {
                method: 'POST',
                body: JSON.stringify({
                    target,
                    message
                })
            });
        }

        // Create a new task
        async createTask(taskData) {
            return this.request('/tasks', {
                method: 'POST',
                body: JSON.stringify(taskData)
            });
        }

        // Trigger a cron job
        async triggerCron(cronId) {
            return this.request(`/cron/run`, {
                method: 'POST',
                body: JSON.stringify({ job: cronId })
            });
        }

        // Get list of active sessions
        async getSessions() {
            return this.request('/sessions');
        }

        // Get cron job status
        async getCronStatus() {
            return this.request('/cron/status');
        }
    }

    const gateway = new GatewayClient();

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
                        <span class="status-text">Disconnected</span>
                    </span>
                </div>
                <div class="control-section-body">
                    <div class="form-row">
                        <div class="form-group flex-2">
                            <label for="gateway-url">Gateway URL</label>
                            <input type="url" id="gateway-url" 
                                   value="${gateway.getGatewayUrl()}" 
                                   placeholder="http://localhost:18789">
                        </div>
                        <div class="form-group flex-3">
                            <label for="gateway-token">Auth Token</label>
                            <div class="token-input-wrapper">
                                <input type="password" id="gateway-token" 
                                       value="${gateway.getToken()}" 
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
                                <span class="btn-text">📤 Send Message</span>
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
                                    <option value="">Unassigned</option>
                                    ${BOBS.map(bob => `
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

            <!-- Cron Job Triggers -->
            <div class="control-section" id="cron-section">
                <div class="control-section-header">
                    <h3>⏰ Cron Jobs</h3>
                    <button type="button" class="btn btn-small btn-secondary" id="refresh-cron">
                        🔄 Refresh
                    </button>
                </div>
                <div class="control-section-body">
                    <div class="cron-grid" id="cron-grid">
                        ${CRON_JOBS.map(job => `
                            <div class="cron-card" data-cron-id="${job.id}">
                                <div class="cron-icon">${job.emoji}</div>
                                <div class="cron-info">
                                    <span class="cron-name">${job.name}</span>
                                    <span class="cron-desc">${job.description}</span>
                                </div>
                                <button type="button" class="btn btn-small btn-primary cron-trigger" 
                                        data-cron="${job.id}" title="Run ${job.name}">
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
        updateConnectionUI();
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

        // Cron triggers
        document.querySelectorAll('.cron-trigger').forEach(btn => {
            btn.addEventListener('click', () => handleTriggerCron(btn.dataset.cron, btn));
        });

        // Refresh cron status
        document.getElementById('refresh-cron')?.addEventListener('click', handleRefreshCron);

        // Clear response log
        document.getElementById('clear-log')?.addEventListener('click', clearResponseLog);
    }

    async function handleTestConnection() {
        const btn = document.getElementById('test-connection');
        setButtonLoading(btn, true);
        updateConnectionStatus('connecting');

        try {
            // First save settings
            handleSaveSettings();

            const result = await gateway.testConnection();
            
            if (result.success) {
                updateConnectionStatus('connected');
                addToLog('success', 'Connection successful!', result.data);
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

        if (url) gateway.setGatewayUrl(url);
        gateway.setToken(token);
        updateConnectionUI();

        showToast('Settings saved', 'info');
    }

    function handleClearToken() {
        gateway.setToken('');
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

    async function handleSendMessage(e) {
        e.preventDefault();
        const form = e.target;
        const btn = form.querySelector('button[type="submit"]');
        
        const target = document.getElementById('message-target').value;
        const message = document.getElementById('message-content').value;

        if (!target || !message) {
            showToast('Please select a Bob and enter a message', 'warning');
            return;
        }

        setButtonLoading(btn, true);

        try {
            const result = await gateway.sendMessage(target, message);
            addToLog('success', `Message sent to ${getBobName(target)}`, { target, message, response: result });
            showToast(`Message sent to ${getBobName(target)}!`, 'success');
            form.reset();
        } catch (error) {
            addToLog('error', 'Failed to send message', error.message);
            showToast(`Failed: ${error.message}`, 'error');
        } finally {
            setButtonLoading(btn, false);
        }
    }

    async function handleCreateTask(e) {
        e.preventDefault();
        const form = e.target;
        const btn = form.querySelector('button[type="submit"]');

        const taskData = {
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-description').value,
            priority: document.getElementById('task-priority').value,
            assignee: document.getElementById('task-assignee').value,
            successCriteria: document.getElementById('task-success').value
        };

        if (!taskData.title) {
            showToast('Please enter a task title', 'warning');
            return;
        }

        setButtonLoading(btn, true);

        try {
            const result = await gateway.createTask(taskData);
            addToLog('success', `Task created: ${taskData.title}`, { taskData, response: result });
            showToast(`Task "${taskData.title}" created!`, 'success');
            form.reset();
        } catch (error) {
            addToLog('error', 'Failed to create task', error.message);
            showToast(`Failed: ${error.message}`, 'error');
        } finally {
            setButtonLoading(btn, false);
        }
    }

    async function handleTriggerCron(cronId, btn) {
        setButtonLoading(btn, true);

        try {
            const result = await gateway.triggerCron(cronId);
            const cronJob = CRON_JOBS.find(j => j.id === cronId);
            addToLog('success', `Cron triggered: ${cronJob?.name || cronId}`, result);
            showToast(`${cronJob?.emoji || '⏰'} ${cronJob?.name || cronId} triggered!`, 'success');
        } catch (error) {
            addToLog('error', `Failed to trigger ${cronId}`, error.message);
            showToast(`Failed: ${error.message}`, 'error');
        } finally {
            setButtonLoading(btn, false);
        }
    }

    async function handleRefreshCron() {
        const btn = document.getElementById('refresh-cron');
        setButtonLoading(btn, true);

        try {
            const status = await gateway.getCronStatus();
            addToLog('info', 'Cron status refreshed', status);
            showToast('Cron status updated', 'info');
        } catch (error) {
            addToLog('error', 'Failed to refresh cron status', error.message);
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
                text.textContent = gateway.hasToken() ? 'Configured' : 'Not configured';
        }
    }

    function updateConnectionUI() {
        const hasToken = gateway.hasToken();
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
        // Use QuickActions toast if available
        if (window.QuickActions?.showToast) {
            window.QuickActions.showToast(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
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
        entry.innerHTML = `
            <div class="log-header">
                <span class="log-icon">${icons[type] || icons.info}</span>
                <span class="log-message">${message}</span>
                <span class="log-time">${timestamp}</span>
            </div>
            ${data ? `<pre class="log-data">${JSON.stringify(data, null, 2)}</pre>` : ''}
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
        renderControlPanel();
        console.log('🎮 Control Panel initialized');
    }

    function refresh() {
        renderControlPanel();
    }

    // Expose module
    window.ControlModule = {
        init,
        refresh,
        gateway,
        BOBS,
        CRON_JOBS
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
