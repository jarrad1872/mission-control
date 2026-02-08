/**
 * Quick Actions Module — FAB Version (#3)
 * Floating Action Button with bottom sheet menu.
 * Connects to the OpenClaw gateway for real actions.
 */

(function() {
    'use strict';

    // Model mapping for spawn
    const MODEL_MAP = {
        'opus': 'anthropic/claude-opus-4-6',
        'sonnet': 'anthropic/claude-sonnet-4-20250514',
        'haiku': 'anthropic/claude-haiku-3-5-20241022'
    };

    // Main session key for sending messages/tasks
    // The gateway's primary session (first active main session)
    const MAIN_SESSION_KEY = 'agent:main:telegram:group:-1003765361939:topic:1';

    // Action definitions — wired to real gateway calls
    const ACTIONS = [
        {
            id: 'checkEmail',
            icon: '📧',
            label: 'Check Email',
            description: 'Spawn a sub-agent to check all email accounts',
            handler: async () => {
                ensureConnected();
                const result = await Gateway.spawnAgent(
                    'Check all email accounts for urgent unread messages. Report back with a summary.',
                    null,
                    'email-check'
                );
                return { success: true, message: 'Email check agent spawned!', data: result };
            }
        },
        {
            id: 'runHeartbeat',
            icon: '💓',
            label: 'Heartbeat',
            description: 'Trigger a heartbeat wake via gateway',
            handler: async () => {
                ensureConnected();
                const result = await Gateway.triggerHeartbeat(
                    'Manual heartbeat triggered from Mission Control'
                );
                return { success: true, message: 'Heartbeat triggered!', data: result };
            }
        },
        {
            id: 'spawnSubBob',
            icon: '🤖',
            label: 'Spawn Bob',
            description: 'Create a new sub-agent with a task',
            handler: async () => {
                openSpawnModal();
                return null; // Modal handles the rest
            },
            isModal: true
        },
        {
            id: 'refreshData',
            icon: '🔄',
            label: 'Refresh',
            description: 'Rebuild dashboard data',
            handler: async () => {
                document.getElementById('refreshBtn')?.click();
                return null;
            }
        },
        {
            id: 'newTask',
            icon: '📋',
            label: 'New Task',
            description: 'Create a new task via the main session',
            handler: async () => {
                openTaskModal();
                return null;
            },
            isModal: true
        },
        {
            id: 'sendMessage',
            icon: '💬',
            label: 'Message',
            description: 'Send a message to the main session',
            handler: async () => {
                openMessageModal();
                return null;
            },
            isModal: true
        },
        {
            id: 'settings',
            icon: '⚙️',
            label: 'Settings',
            description: 'Configure gateway connection',
            handler: async () => {
                openSettingsModal();
                return null;
            },
            isModal: true
        }
    ];

    /**
     * Ensure gateway is configured before making API calls
     */
    function ensureConnected() {
        if (!Gateway.hasToken()) {
            throw new Error('Gateway not configured — tap ⚙️ Settings to connect');
        }
    }

    // ========================================
    // Initialization
    // ========================================

    function init() {
        renderFabMenu();
        renderModals();
        renderToastContainer();
        renderConnectionIndicator();
        attachEventListeners();

        // Listen for gateway status changes
        Gateway.onStatusChange(updateConnectionIndicator);
    }

    // ========================================
    // FAB Menu
    // ========================================

    function renderFabMenu() {
        const grid = document.getElementById('fabMenuGrid');
        if (!grid) return;

        grid.innerHTML = ACTIONS.map(action => `
            <button class="fab-action-btn" data-action="${action.id}" title="${action.description}">
                <span class="fab-action-icon">${action.icon}</span>
                <span class="fab-action-label">${action.label}</span>
            </button>
        `).join('');
    }

    // ========================================
    // Connection Status Indicator
    // ========================================

    function renderConnectionIndicator() {
        // Add a small gateway status dot next to the global status dot in the header
        const headerRight = document.querySelector('.header-right');
        if (!headerRight) return;

        // Check if already rendered
        if (document.getElementById('gatewayStatusIndicator')) return;

        const indicator = document.createElement('div');
        indicator.id = 'gatewayStatusIndicator';
        indicator.className = 'gateway-status-indicator';
        indicator.title = 'Gateway: checking...';
        indicator.innerHTML = `<span class="gateway-dot"></span>`;
        indicator.addEventListener('click', openSettingsModal);

        // Insert before the first button
        headerRight.insertBefore(indicator, headerRight.firstChild);

        // Set initial state
        updateConnectionIndicator(Gateway.getStatus());
    }

    function updateConnectionIndicator(status) {
        const indicator = document.getElementById('gatewayStatusIndicator');
        if (!indicator) return;

        const dot = indicator.querySelector('.gateway-dot');
        if (!dot) return;

        dot.className = 'gateway-dot';

        switch (status) {
            case 'connected':
                dot.classList.add('gw-connected');
                indicator.title = 'Gateway: Connected';
                break;
            case 'disconnected':
                dot.classList.add('gw-disconnected');
                indicator.title = Gateway.hasToken()
                    ? 'Gateway: Disconnected — tap to configure'
                    : 'Gateway: Not configured — tap to set up';
                break;
            case 'error':
                dot.classList.add('gw-error');
                indicator.title = 'Gateway: Error — tap to reconfigure';
                break;
            default:
                dot.classList.add('gw-unknown');
                indicator.title = 'Gateway: Checking...';
        }
    }

    // ========================================
    // Modals
    // ========================================

    function renderModals() {
        const modalsContainer = document.createElement('div');
        modalsContainer.id = 'quick-action-modals';
        modalsContainer.innerHTML = `
            <!-- Spawn Sub-Bob Modal -->
            <div class="modal qa-modal" id="spawnModal">
                <div class="modal-backdrop"></div>
                <div class="modal-content modal-bottom-sheet">
                    <div class="modal-header">
                        <h3>🤖 Spawn Sub-Bob</h3>
                        <button class="close-btn" data-close-modal="spawnModal">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="spawnForm" class="qa-form">
                            <div class="form-group">
                                <label for="spawnLabel">Label</label>
                                <input type="text" id="spawnLabel" name="label" placeholder="e.g., research-task" required>
                                <span class="form-hint">Unique identifier for this sub-agent</span>
                            </div>
                            <div class="form-group">
                                <label for="spawnModel">Model</label>
                                <select id="spawnModel" name="model">
                                    <option value="opus">Claude Opus (Best)</option>
                                    <option value="sonnet" selected>Claude Sonnet (Balanced)</option>
                                    <option value="haiku">Claude Haiku (Fast)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="spawnPrompt">Task / Instructions</label>
                                <textarea id="spawnPrompt" name="prompt" rows="4" placeholder="What should this sub-Bob do?" required></textarea>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" data-close-modal="spawnModal">Cancel</button>
                                <button type="submit" class="btn btn-primary" id="spawnSubmitBtn">🚀 Spawn</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- New Task Modal -->
            <div class="modal qa-modal" id="taskModal">
                <div class="modal-backdrop"></div>
                <div class="modal-content modal-bottom-sheet">
                    <div class="modal-header">
                        <h3>📋 New Task</h3>
                        <button class="close-btn" data-close-modal="taskModal">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="taskForm" class="qa-form">
                            <div class="form-group">
                                <label for="taskName">Task Name</label>
                                <input type="text" id="taskName" name="name" placeholder="e.g., update-docs" required>
                            </div>
                            <div class="form-group">
                                <label for="taskObjective">Objective</label>
                                <input type="text" id="taskObjective" name="objective" placeholder="One sentence goal" required>
                            </div>
                            <div class="form-group">
                                <label for="taskPriority">Priority</label>
                                <select id="taskPriority" name="priority">
                                    <option value="high">🔴 High</option>
                                    <option value="medium" selected>🟡 Medium</option>
                                    <option value="low">🟢 Low</option>
                                </select>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" data-close-modal="taskModal">Cancel</button>
                                <button type="submit" class="btn btn-primary" id="taskSubmitBtn">✨ Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Message Modal -->
            <div class="modal qa-modal" id="messageModal">
                <div class="modal-backdrop"></div>
                <div class="modal-content modal-bottom-sheet">
                    <div class="modal-header">
                        <h3>💬 Send Message</h3>
                        <button class="close-btn" data-close-modal="messageModal">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="messageForm" class="qa-form">
                            <div class="form-group">
                                <label for="messageContent">Message</label>
                                <textarea id="messageContent" name="content" rows="4" placeholder="Your message to the main session..." required></textarea>
                                <span class="form-hint">Sends to the main Bob session</span>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" data-close-modal="messageModal">Cancel</button>
                                <button type="submit" class="btn btn-primary" id="messageSubmitBtn">📤 Send</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Settings Modal -->
            <div class="modal qa-modal" id="settingsModal">
                <div class="modal-backdrop"></div>
                <div class="modal-content modal-bottom-sheet">
                    <div class="modal-header">
                        <h3>⚙️ Gateway Settings</h3>
                        <button class="close-btn" data-close-modal="settingsModal">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="settingsForm" class="qa-form">
                            <div class="form-group">
                                <label for="settingsGatewayUrl">Gateway URL</label>
                                <input type="url" id="settingsGatewayUrl" name="gatewayUrl"
                                       placeholder="http://100.72.187.117:18789" required>
                                <span class="form-hint">OpenClaw gateway address (Tailscale IP)</span>
                            </div>
                            <div class="form-group">
                                <label for="settingsToken">Auth Token</label>
                                <div class="token-input-row">
                                    <input type="password" id="settingsToken" name="token"
                                           placeholder="Enter your gateway token" required>
                                    <button type="button" class="btn btn-icon" id="toggleTokenVis" title="Show/hide">👁️</button>
                                </div>
                                <span class="form-hint">Bearer token for gateway authentication</span>
                            </div>

                            <div class="form-group">
                                <label for="settingsOpenAIKey">OpenAI API Key</label>
                                <div class="token-input-row">
                                    <input type="password" id="settingsOpenAIKey" name="openaiKey" placeholder="sk-...">
                                    <button type="button" class="btn btn-icon" id="toggleOpenAIVis" title="Show/hide">👁️</button>
                                </div>
                                <span class="form-hint">Required for Bob Chat (STT + TTS)</span>
                            </div>

                            <div class="settings-status" id="settingsStatus">
                                <span class="settings-status-dot"></span>
                                <span class="settings-status-text">Not tested</span>
                            </div>

                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" data-close-modal="settingsModal">Cancel</button>
                                <button type="button" class="btn btn-outline" id="testConnectionBtn">🔗 Test</button>
                                <button type="submit" class="btn btn-primary" id="saveSettingsBtn">💾 Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalsContainer);
    }

    // ========================================
    // Toast Notifications
    // ========================================

    function renderToastContainer() {
        if (document.getElementById('toast-container')) return;

        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    function showToast(message, type = 'success', duration = 4000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${Utils.escapeHtml(message)}</span>
            <button class="toast-close">×</button>
        `;

        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.add('toast-hiding');
            setTimeout(() => toast.remove(), 300);
        });

        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('toast-visible');
        });

        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('toast-hiding');
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    }

    // ========================================
    // FAB Open/Close
    // ========================================

    function toggleFabMenu() {
        const menu = document.getElementById('fabMenu');
        if (menu?.classList.contains('open')) {
            closeFabMenu();
        } else {
            openFabMenu();
        }
    }

    function openFabMenu() {
        document.getElementById('fabButton')?.classList.add('open');
        document.getElementById('fabMenu')?.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeFabMenu() {
        document.getElementById('fabButton')?.classList.remove('open');
        document.getElementById('fabMenu')?.classList.remove('open');
        document.body.style.overflow = '';
    }

    // ========================================
    // Modal Helpers
    // ========================================

    function openSpawnModal() {
        closeFabMenu();
        document.getElementById('spawnModal')?.classList.add('open');
        document.getElementById('spawnLabel')?.focus();
    }

    function openTaskModal() {
        closeFabMenu();
        document.getElementById('taskModal')?.classList.add('open');
        document.getElementById('taskName')?.focus();
    }

    function openMessageModal() {
        closeFabMenu();
        document.getElementById('messageModal')?.classList.add('open');
        document.getElementById('messageContent')?.focus();
    }

    function openSettingsModal() {
        closeFabMenu();
        // Populate current values
        const urlInput = document.getElementById('settingsGatewayUrl');
        const tokenInput = document.getElementById('settingsToken');
        const openaiInput = document.getElementById('settingsOpenAIKey');
        if (urlInput) urlInput.value = Gateway.getUrl();
        if (tokenInput) tokenInput.value = Gateway.getToken();
        if (openaiInput) openaiInput.value = localStorage.getItem('mc_openai_key') || '';
        updateSettingsStatus(Gateway.getStatus());
        document.getElementById('settingsModal')?.classList.add('open');
        if (!Gateway.hasToken()) {
            tokenInput?.focus();
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('open');
            const form = modal.querySelector('form');
            if (form) form.reset();
        }
        document.body.style.overflow = '';
    }

    // ========================================
    // Settings Status
    // ========================================

    function updateSettingsStatus(status) {
        const container = document.getElementById('settingsStatus');
        if (!container) return;

        const dot = container.querySelector('.settings-status-dot');
        const text = container.querySelector('.settings-status-text');

        dot.className = 'settings-status-dot';

        switch (status) {
            case 'connected':
                dot.classList.add('gw-connected');
                text.textContent = 'Connected to gateway';
                break;
            case 'disconnected':
                dot.classList.add('gw-disconnected');
                text.textContent = 'Not connected';
                break;
            case 'error':
                dot.classList.add('gw-error');
                text.textContent = 'Connection error';
                break;
            default:
                dot.classList.add('gw-unknown');
                text.textContent = 'Not tested';
        }
    }

    // ========================================
    // Action Handlers (Real Gateway Calls)
    // ========================================

    async function handleActionClick(actionId) {
        const action = ACTIONS.find(a => a.id === actionId);
        if (!action) return;

        closeFabMenu();

        // For non-modal actions, check gateway connection
        if (!action.isModal && actionId !== 'refreshData' && actionId !== 'settings') {
            if (!Gateway.hasToken()) {
                showToast('Gateway not configured — tap ⚙️ Settings first', 'warning');
                setTimeout(openSettingsModal, 300);
                return;
            }
        }

        try {
            const result = await action.handler();
            if (result) {
                if (result.success) {
                    showToast(result.message, 'success');
                } else {
                    showToast(result.message || 'Action failed', 'error');
                }
            }
        } catch (error) {
            console.error(`Action ${actionId} failed:`, error);
            const msg = friendlyError(error);
            showToast(msg, 'error', 6000);
        }
    }

    /**
     * Spawn Sub-Bob form submit
     */
    async function handleSpawnSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const btn = document.getElementById('spawnSubmitBtn');

        const label = form.label.value.trim();
        const modelKey = form.model.value;
        const task = form.prompt.value.trim();

        if (!task) {
            showToast('Please enter a task for the sub-agent', 'warning');
            return;
        }

        ensureConnected();
        setButtonLoading(btn, true);

        try {
            const model = MODEL_MAP[modelKey] || modelKey;
            const result = await Gateway.spawnAgent(task, model, label || undefined);
            showToast(`Sub-Bob "${label || 'unnamed'}" spawned! 🚀`, 'success');
            closeModal('spawnModal');
            console.log('Spawn result:', result);
        } catch (error) {
            showToast(friendlyError(error), 'error', 6000);
        } finally {
            setButtonLoading(btn, false);
        }
    }

    /**
     * New Task form submit — sends to main session
     */
    async function handleTaskSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const btn = document.getElementById('taskSubmitBtn');

        const name = form.name.value.trim();
        const objective = form.objective.value.trim();
        const priority = form.priority.value;

        if (!name || !objective) {
            showToast('Please fill in both task name and objective', 'warning');
            return;
        }

        ensureConnected();
        setButtonLoading(btn, true);

        try {
            const message = `Create task: "${name}" — Objective: ${objective}. Priority: ${priority}.`;
            const result = await Gateway.sendMessage(MAIN_SESSION_KEY, message);
            showToast(`Task "${name}" sent to main session!`, 'success');
            closeModal('taskModal');
            console.log('Task result:', result);
        } catch (error) {
            showToast(friendlyError(error), 'error', 6000);
        } finally {
            setButtonLoading(btn, false);
        }
    }

    /**
     * Send Message form submit
     */
    async function handleMessageSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const btn = document.getElementById('messageSubmitBtn');

        const content = form.content.value.trim();

        if (!content) {
            showToast('Please enter a message', 'warning');
            return;
        }

        ensureConnected();
        setButtonLoading(btn, true);

        try {
            const result = await Gateway.sendMessage(MAIN_SESSION_KEY, content);
            showToast('Message sent to main session! 📤', 'success');
            closeModal('messageModal');
            console.log('Message result:', result);
        } catch (error) {
            showToast(friendlyError(error), 'error', 6000);
        } finally {
            setButtonLoading(btn, false);
        }
    }

    /**
     * Settings form submit
     */
    async function handleSettingsSubmit(e) {
        e.preventDefault();
        const form = e.target;

        // Always save OpenAI key first (independent of Gateway)
        const openaiKey = (document.getElementById('settingsOpenAIKey')?.value || '').trim();
        if (openaiKey) {
            localStorage.setItem('mc_openai_key', openaiKey);
        } else {
            localStorage.removeItem('mc_openai_key');
        }
        // Update Bob Chat API notice if available
        if (window.BobChat?.updateApiNotice) {
            window.BobChat.updateApiNotice();
        }

        const url = form.gatewayUrl.value.trim();
        const token = form.token.value.trim();

        if (!url) {
            showToast('OpenAI key saved. Please enter a gateway URL for full setup.', 'warning');
            return;
        }
        if (!token) {
            showToast('OpenAI key saved. Please enter an auth token for full setup.', 'warning');
            return;
        }

        Gateway.setUrl(url);
        Gateway.setToken(token);

        showToast('Settings saved!', 'success');

        // Auto-test after save
        const result = await Gateway.testConnection();
        updateSettingsStatus(result.success ? 'connected' : 'error');

        if (result.success) {
            showToast('Gateway connected! ✅', 'success');
            setTimeout(() => closeModal('settingsModal'), 800);
        } else {
            showToast(`Connection failed: ${result.error}`, 'error', 6000);
        }
    }

    /**
     * Test connection button handler
     */
    async function handleTestConnection() {
        const btn = document.getElementById('testConnectionBtn');
        setButtonLoading(btn, true);

        // Save current values first
        const url = document.getElementById('settingsGatewayUrl')?.value?.trim();
        const token = document.getElementById('settingsToken')?.value?.trim();
        if (url) Gateway.setUrl(url);
        if (token) Gateway.setToken(token);

        try {
            const result = await Gateway.testConnection();
            updateSettingsStatus(result.success ? 'connected' : 'error');

            if (result.success) {
                showToast('Connected to gateway! ✅', 'success');
            } else {
                showToast(`Connection failed: ${result.error}`, 'error', 6000);
            }
        } catch (error) {
            updateSettingsStatus('error');
            showToast(friendlyError(error), 'error', 6000);
        } finally {
            setButtonLoading(btn, false);
        }
    }

    // ========================================
    // Utility
    // ========================================

    function setButtonLoading(btn, loading) {
        if (!btn) return;
        if (loading) {
            btn.disabled = true;
            btn.dataset.originalText = btn.textContent;
            btn.textContent = '⏳ Working...';
        } else {
            btn.disabled = false;
            btn.textContent = btn.dataset.originalText || btn.textContent;
        }
    }

    /**
     * Turn gateway errors into user-friendly messages
     */
    function friendlyError(error) {
        const msg = error?.message || String(error);

        if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
            return 'Gateway unreachable — check your connection and URL';
        }
        if (msg.includes('401') || msg.includes('403') || msg.includes('Authentication')) {
            return 'Authentication failed — check your token in ⚙️ Settings';
        }
        if (msg.includes('not configured')) {
            return msg;
        }
        if (msg.includes('404')) {
            return 'Endpoint not found — is the gateway running the right version?';
        }
        if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
            return 'Gateway server error — try again in a moment';
        }

        return `Error: ${msg}`;
    }

    // ========================================
    // Event Listeners
    // ========================================

    function attachEventListeners() {
        // FAB button
        document.getElementById('fabButton')?.addEventListener('click', toggleFabMenu);

        // FAB menu backdrop and close
        document.querySelector('.fab-menu-backdrop')?.addEventListener('click', closeFabMenu);
        document.querySelector('.fab-menu-close')?.addEventListener('click', closeFabMenu);

        // Action button clicks (delegated)
        document.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('.fab-action-btn');
            if (actionBtn) {
                handleActionClick(actionBtn.dataset.action);
            }

            // Modal close buttons
            const closeBtn = e.target.closest('[data-close-modal]');
            if (closeBtn) {
                closeModal(closeBtn.dataset.closeModal);
            }

            // Modal backdrop click
            if (e.target.classList.contains('modal-backdrop')) {
                const modal = e.target.closest('.modal');
                if (modal) {
                    closeModal(modal.id);
                }
            }
        });

        // Form submissions
        document.getElementById('spawnForm')?.addEventListener('submit', handleSpawnSubmit);
        document.getElementById('taskForm')?.addEventListener('submit', handleTaskSubmit);
        document.getElementById('messageForm')?.addEventListener('submit', handleMessageSubmit);
        document.getElementById('settingsForm')?.addEventListener('submit', handleSettingsSubmit);

        // Settings-specific buttons
        document.getElementById('testConnectionBtn')?.addEventListener('click', handleTestConnection);
        document.getElementById('toggleTokenVis')?.addEventListener('click', () => {
            const input = document.getElementById('settingsToken');
            const btn = document.getElementById('toggleTokenVis');
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = '🙈';
            } else {
                input.type = 'password';
                btn.textContent = '👁️';
            }
        });

        document.getElementById('toggleOpenAIVis')?.addEventListener('click', () => {
            const input = document.getElementById('settingsOpenAIKey');
            const btn = document.getElementById('toggleOpenAIVis');
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = '🙈';
            } else {
                input.type = 'password';
                btn.textContent = '👁️';
            }
        });

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeFabMenu();
                document.querySelectorAll('.qa-modal.open').forEach(modal => {
                    closeModal(modal.id);
                });
            }
        });
    }

    // ========================================
    // Public API
    // ========================================

    window.QuickActions = {
        showToast,
        openSpawnModal,
        openTaskModal,
        openMessageModal,
        openSettingsModal,
        openFabMenu,
        closeFabMenu
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
