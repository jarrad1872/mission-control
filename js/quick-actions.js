/**
 * Quick Actions Module — FAB Version (#3)
 * Floating Action Button with bottom sheet menu
 */

(function() {
    'use strict';

    // Gateway API endpoint (auth will be added later)
    const GATEWAY_URL = 'http://localhost:18789';

    // Action definitions
    const ACTIONS = [
        {
            id: 'checkEmail',
            icon: '📧',
            label: 'Check Email',
            description: 'Trigger email check across all accounts',
            handler: async () => {
                await simulateAction(1500);
                return { success: true, message: 'Email check triggered!' };
            }
        },
        {
            id: 'runHeartbeat',
            icon: '💓',
            label: 'Heartbeat',
            description: 'Trigger a heartbeat poll',
            handler: async () => {
                await simulateAction(2000);
                return { success: true, message: 'Heartbeat triggered!' };
            }
        },
        {
            id: 'spawnSubBob',
            icon: '🤖',
            label: 'Spawn Bob',
            description: 'Create a new sub-agent',
            handler: async () => {
                openSpawnModal();
                return null;
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
            description: 'Create a new task file',
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
            description: 'Send a message to Bob',
            handler: async () => {
                openMessageModal();
                return null;
            },
            isModal: true
        }
    ];

    // Simulated delay for placeholder actions
    function simulateAction(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Initialize quick actions
    function init() {
        renderFabMenu();
        renderModals();
        renderToastContainer();
        attachEventListeners();
    }

    // Render the FAB menu content
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

    // Render modals
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
                                <label for="spawnPrompt">Instructions</label>
                                <textarea id="spawnPrompt" name="prompt" rows="3" placeholder="What should this sub-Bob do?" required></textarea>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" data-close-modal="spawnModal">Cancel</button>
                                <button type="submit" class="btn btn-primary">🚀 Spawn</button>
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
                                <button type="submit" class="btn btn-primary">✨ Create</button>
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
                                <label for="messageTarget">Send To</label>
                                <select id="messageTarget" name="target">
                                    <option value="main">Main Bob</option>
                                    <option value="telegram">Telegram</option>
                                    <option value="discord">Discord</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="messageContent">Message</label>
                                <textarea id="messageContent" name="content" rows="3" placeholder="Your message..." required></textarea>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" data-close-modal="messageModal">Cancel</button>
                                <button type="submit" class="btn btn-primary">📤 Send</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalsContainer);
    }

    // Render toast notification container
    function renderToastContainer() {
        if (document.getElementById('toast-container')) return;
        
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // Show toast notification
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
            <span class="toast-message">${message}</span>
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

    // Open/close FAB menu
    function toggleFabMenu() {
        const fab = document.getElementById('fabButton');
        const menu = document.getElementById('fabMenu');
        
        if (menu?.classList.contains('open')) {
            closeFabMenu();
        } else {
            openFabMenu();
        }
    }

    function openFabMenu() {
        const fab = document.getElementById('fabButton');
        const menu = document.getElementById('fabMenu');
        
        fab?.classList.add('open');
        menu?.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeFabMenu() {
        const fab = document.getElementById('fabButton');
        const menu = document.getElementById('fabMenu');
        
        fab?.classList.remove('open');
        menu?.classList.remove('open');
        document.body.style.overflow = '';
    }

    // Modal openers
    function openSpawnModal() {
        closeFabMenu();
        const modal = document.getElementById('spawnModal');
        modal?.classList.add('open');
        document.getElementById('spawnLabel')?.focus();
    }

    function openTaskModal() {
        closeFabMenu();
        const modal = document.getElementById('taskModal');
        modal?.classList.add('open');
        document.getElementById('taskName')?.focus();
    }

    function openMessageModal() {
        closeFabMenu();
        const modal = document.getElementById('messageModal');
        modal?.classList.add('open');
        document.getElementById('messageContent')?.focus();
    }

    // Close modal by ID
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('open');
            const form = modal.querySelector('form');
            if (form) form.reset();
        }
        document.body.style.overflow = '';
    }

    // Handle action button click
    async function handleActionClick(actionId) {
        const action = ACTIONS.find(a => a.id === actionId);
        if (!action) return;

        closeFabMenu();

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
            showToast(`Error: ${error.message}`, 'error');
        }
    }

    // Form handlers
    async function handleSpawnSubmit(e) {
        e.preventDefault();
        const form = e.target;
        
        const data = {
            label: form.label.value,
            model: form.model.value,
            prompt: form.prompt.value
        };

        try {
            await simulateAction(2000);
            showToast(`Sub-Bob "${data.label}" spawned!`, 'success');
            closeModal('spawnModal');
        } catch (error) {
            showToast(`Failed to spawn: ${error.message}`, 'error');
        }
    }

    async function handleTaskSubmit(e) {
        e.preventDefault();
        const form = e.target;
        
        const data = {
            name: form.name.value,
            objective: form.objective.value,
            priority: form.priority.value
        };

        try {
            await simulateAction(1500);
            showToast(`Task "${data.name}" created!`, 'success');
            closeModal('taskModal');
        } catch (error) {
            showToast(`Failed to create task: ${error.message}`, 'error');
        }
    }

    async function handleMessageSubmit(e) {
        e.preventDefault();
        const form = e.target;
        
        const data = {
            target: form.target.value,
            content: form.content.value
        };

        try {
            await simulateAction(1000);
            showToast(`Message sent to ${data.target}!`, 'success');
            closeModal('messageModal');
        } catch (error) {
            showToast(`Failed to send: ${error.message}`, 'error');
        }
    }

    // Attach event listeners
    function attachEventListeners() {
        // FAB button
        document.getElementById('fabButton')?.addEventListener('click', toggleFabMenu);
        
        // FAB menu backdrop and close
        document.querySelector('.fab-menu-backdrop')?.addEventListener('click', closeFabMenu);
        document.querySelector('.fab-menu-close')?.addEventListener('click', closeFabMenu);
        
        // Action button clicks
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

    // Expose for external use
    window.QuickActions = {
        showToast,
        openSpawnModal,
        openTaskModal,
        openMessageModal,
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
