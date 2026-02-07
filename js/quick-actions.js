// Quick Actions Panel — Mission Control v2
// Buttons for common Bob operations with visual feedback

(function() {
    'use strict';

    // Gateway API endpoint (auth will be added later)
    const GATEWAY_URL = 'http://localhost:18789';

    // Action definitions
    const ACTIONS = {
        checkEmail: {
            id: 'checkEmail',
            icon: '📧',
            label: 'Check Email',
            description: 'Trigger email check across all accounts',
            handler: async () => {
                // Simulated for now — real implementation will call gateway
                await simulateAction(1500);
                return { success: true, message: 'Email check triggered! Found 3 new messages.' };
            }
        },
        runHeartbeat: {
            id: 'runHeartbeat',
            icon: '💓',
            label: 'Run Heartbeat',
            description: 'Trigger a heartbeat poll for main Bob',
            handler: async () => {
                await simulateAction(2000);
                return { success: true, message: 'Heartbeat triggered! Bob is checking in.' };
            }
        },
        spawnSubBob: {
            id: 'spawnSubBob',
            icon: '🤖',
            label: 'Spawn Sub-Bob',
            description: 'Create a new sub-agent for a task',
            handler: async (data) => {
                // Opens modal, actual spawn happens after form submit
                openSpawnModal();
                return null; // Don't show toast, modal handles it
            },
            isModal: true
        },
        refreshData: {
            id: 'refreshData',
            icon: '🔄',
            label: 'Refresh Data',
            description: 'Rebuild dashboard data from source files',
            handler: async () => {
                await simulateAction(1000);
                // Trigger existing refresh functionality
                if (window.refreshData) {
                    window.refreshData();
                }
                return { success: true, message: 'Dashboard data refreshed!' };
            }
        },
        newTask: {
            id: 'newTask',
            icon: '📋',
            label: 'New Task',
            description: 'Create a new task file',
            handler: async (data) => {
                openTaskModal();
                return null;
            },
            isModal: true
        }
    };

    // Simulated delay for placeholder actions
    function simulateAction(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Initialize quick actions
    function init() {
        renderQuickActionsPanel();
        renderModals();
        renderToastContainer();
        attachEventListeners();
    }

    // Render the Quick Actions panel HTML
    function renderQuickActionsPanel() {
        const panel = document.getElementById('quick-actions-panel');
        if (!panel) return;

        const actionsHTML = Object.values(ACTIONS).map(action => `
            <button class="quick-action-btn" data-action="${action.id}" title="${action.description}">
                <span class="quick-action-icon">${action.icon}</span>
                <span class="quick-action-label">${action.label}</span>
                <span class="quick-action-spinner"></span>
            </button>
        `).join('');

        panel.innerHTML = `
            <div class="quick-actions-header">
                <h3>⚡ Quick Actions</h3>
            </div>
            <div class="quick-actions-grid">
                ${actionsHTML}
            </div>
        `;
    }

    // Render modals
    function renderModals() {
        const modalsContainer = document.createElement('div');
        modalsContainer.id = 'quick-action-modals';
        modalsContainer.innerHTML = `
            <!-- Spawn Sub-Bob Modal -->
            <div class="modal qa-modal" id="spawnModal">
                <div class="modal-backdrop"></div>
                <div class="modal-content qa-modal-content">
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
                                <textarea id="spawnPrompt" name="prompt" rows="4" placeholder="What should this sub-Bob do?" required></textarea>
                            </div>
                            <div class="form-group">
                                <label for="spawnChannel">Report To</label>
                                <select id="spawnChannel" name="channel">
                                    <option value="telegram">Telegram (Main)</option>
                                    <option value="discord">Discord</option>
                                    <option value="none">No Report</option>
                                </select>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" data-close-modal="spawnModal">Cancel</button>
                                <button type="submit" class="btn btn-primary">
                                    <span class="btn-text">🚀 Spawn Agent</span>
                                    <span class="btn-spinner"></span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- New Task Modal -->
            <div class="modal qa-modal" id="taskModal">
                <div class="modal-backdrop"></div>
                <div class="modal-content qa-modal-content">
                    <div class="modal-header">
                        <h3>📋 Create New Task</h3>
                        <button class="close-btn" data-close-modal="taskModal">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="taskForm" class="qa-form">
                            <div class="form-group">
                                <label for="taskName">Task Name</label>
                                <input type="text" id="taskName" name="name" placeholder="e.g., update-documentation" required>
                                <span class="form-hint">Will create /tasks/task-[name].md</span>
                            </div>
                            <div class="form-group">
                                <label for="taskObjective">Objective</label>
                                <input type="text" id="taskObjective" name="objective" placeholder="One sentence describing the goal" required>
                            </div>
                            <div class="form-group">
                                <label for="taskSuccess">Success Criteria</label>
                                <textarea id="taskSuccess" name="success" rows="2" placeholder="How do we know it's done?"></textarea>
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
                                <button type="submit" class="btn btn-primary">
                                    <span class="btn-text">✨ Create Task</span>
                                    <span class="btn-spinner"></span>
                                </button>
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

        // Add click handler for close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.add('toast-hiding');
            setTimeout(() => toast.remove(), 300);
        });

        container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('toast-visible');
        });

        // Auto-remove
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('toast-hiding');
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    }

    // Open Spawn Sub-Bob modal
    function openSpawnModal() {
        const modal = document.getElementById('spawnModal');
        if (modal) {
            modal.classList.add('open');
            document.getElementById('spawnLabel')?.focus();
        }
    }

    // Open New Task modal
    function openTaskModal() {
        const modal = document.getElementById('taskModal');
        if (modal) {
            modal.classList.add('open');
            document.getElementById('taskName')?.focus();
        }
    }

    // Close modal by ID
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('open');
            // Reset form
            const form = modal.querySelector('form');
            if (form) form.reset();
        }
    }

    // Set button loading state
    function setButtonLoading(button, isLoading) {
        if (isLoading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    // Handle action button click
    async function handleActionClick(actionId, button) {
        const action = ACTIONS[actionId];
        if (!action) return;

        // Skip loading state for modal actions
        if (!action.isModal) {
            setButtonLoading(button, true);
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
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            if (!action.isModal) {
                setButtonLoading(button, false);
            }
        }
    }

    // Handle Spawn form submit
    async function handleSpawnSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        
        const data = {
            label: form.label.value,
            model: form.model.value,
            prompt: form.prompt.value,
            channel: form.channel.value
        };

        setButtonLoading(submitBtn, true);

        try {
            // Simulated spawn - real implementation will call gateway API
            await simulateAction(2000);
            
            showToast(`Sub-Bob "${data.label}" spawned successfully!`, 'success');
            closeModal('spawnModal');
        } catch (error) {
            showToast(`Failed to spawn agent: ${error.message}`, 'error');
        } finally {
            setButtonLoading(submitBtn, false);
        }
    }

    // Handle Task form submit
    async function handleTaskSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        
        const data = {
            name: form.name.value,
            objective: form.objective.value,
            success: form.success.value,
            priority: form.priority.value
        };

        setButtonLoading(submitBtn, true);

        try {
            // Simulated task creation - real implementation will create file via API
            await simulateAction(1500);
            
            showToast(`Task "task-${data.name}.md" created!`, 'success');
            closeModal('taskModal');
        } catch (error) {
            showToast(`Failed to create task: ${error.message}`, 'error');
        } finally {
            setButtonLoading(submitBtn, false);
        }
    }

    // Attach event listeners
    function attachEventListeners() {
        // Action button clicks
        document.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('.quick-action-btn');
            if (actionBtn) {
                const actionId = actionBtn.dataset.action;
                handleActionClick(actionId, actionBtn);
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

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.qa-modal.open').forEach(modal => {
                    closeModal(modal.id);
                });
            }
        });
    }

    // Expose for potential external use
    window.QuickActions = {
        showToast,
        openSpawnModal,
        openTaskModal
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
