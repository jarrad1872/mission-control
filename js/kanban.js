/**
 * Kanban Task Board Module
 * Drag-and-drop task management with three columns
 */

const KanbanModule = (function() {
    'use strict';

    let tasksData = null;
    let currentDraggedCard = null;

    /**
     * Initialize the Kanban board
     */
    async function init() {
        console.log('📋 Kanban Module initializing...');
        
        await loadTasksData();
        renderBoard();
        setupDragAndDrop();
        
        console.log('✅ Kanban Module ready');
    }

    /**
     * Load tasks data from JSON
     */
    async function loadTasksData() {
        try {
            const response = await fetch(`data/tasks-board.json?t=${Date.now()}`);
            if (!response.ok) {
                throw new Error(`Failed to load tasks: ${response.status}`);
            }
            tasksData = await response.json();
        } catch (error) {
            console.error('Error loading tasks:', error);
            tasksData = { columns: { todo: [], inProgress: [], complete: [] }, generated: null };
        }
    }

    /**
     * Render the Kanban board
     */
    function renderBoard() {
        const container = document.getElementById('kanban-board');
        if (!container) return;

        const columns = [
            { id: 'todo', title: 'To Do', icon: '📋', tasks: tasksData.columns.todo || [] },
            { id: 'inProgress', title: 'In Progress', icon: '🔄', tasks: tasksData.columns.inProgress || [] },
            { id: 'complete', title: 'Complete', icon: '✅', tasks: tasksData.columns.complete || [] }
        ];

        container.innerHTML = columns.map(col => `
            <div class="kanban-column" data-column="${col.id}">
                <div class="kanban-column-header">
                    <span class="column-icon">${col.icon}</span>
                    <span class="column-title">${col.title}</span>
                    <span class="column-count">${col.tasks.length}</span>
                </div>
                <div class="kanban-cards" data-column="${col.id}">
                    ${col.tasks.map(task => renderCard(task)).join('')}
                </div>
            </div>
        `).join('');

        // Setup card click handlers
        container.querySelectorAll('.kanban-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.drag-handle')) {
                    showTaskDetail(card.dataset.taskId);
                }
            });
        });
    }

    /**
     * Render a single task card
     */
    function renderCard(task) {
        const priorityClass = getPriorityClass(task.priority);
        const priorityLabel = getPriorityLabel(task.priority);
        const statusClass = getStatusClass(task.status);
        
        return `
            <div class="kanban-card ${priorityClass}" 
                 data-task-id="${task.id}" 
                 draggable="true">
                <div class="card-header">
                    <span class="drag-handle">⋮⋮</span>
                    <span class="card-priority-dot ${priorityClass}" title="${priorityLabel}"></span>
                </div>
                <div class="card-title">${escapeHtml(task.title)}</div>
                <div class="card-meta">
                    ${task.assignee ? `<span class="card-assignee" title="Assigned to ${task.assignee}">👤 ${task.assignee}</span>` : ''}
                    <span class="card-status ${statusClass}">${task.status}</span>
                </div>
                ${task.due ? `<div class="card-due">${formatDue(task.due)}</div>` : ''}
            </div>
        `;
    }

    /**
     * Setup drag and drop functionality
     */
    function setupDragAndDrop() {
        const container = document.getElementById('kanban-board');
        if (!container) return;

        // Drag start
        container.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('kanban-card')) {
                currentDraggedCard = e.target;
                e.target.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
            }
        });

        // Drag end
        container.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('kanban-card')) {
                e.target.classList.remove('dragging');
                currentDraggedCard = null;
                
                // Remove all drop indicators
                container.querySelectorAll('.kanban-cards').forEach(col => {
                    col.classList.remove('drag-over');
                });
            }
        });

        // Setup drop zones
        container.querySelectorAll('.kanban-cards').forEach(dropZone => {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                dropZone.classList.add('drag-over');
                
                // Find position to insert
                const afterElement = getDragAfterElement(dropZone, e.clientY);
                const dragging = document.querySelector('.dragging');
                if (dragging) {
                    if (afterElement) {
                        dropZone.insertBefore(dragging, afterElement);
                    } else {
                        dropZone.appendChild(dragging);
                    }
                }
            });

            dropZone.addEventListener('dragleave', (e) => {
                // Only remove if actually leaving the drop zone
                if (!dropZone.contains(e.relatedTarget)) {
                    dropZone.classList.remove('drag-over');
                }
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                
                const taskId = e.dataTransfer.getData('text/plain');
                const newColumn = dropZone.dataset.column;
                
                if (taskId && newColumn) {
                    moveTask(taskId, newColumn);
                }
            });
        });
    }

    /**
     * Get the element to insert after during drag
     */
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.kanban-card:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    /**
     * Move task to new column (in-memory only)
     */
    function moveTask(taskId, newColumn) {
        // Find and remove task from current column
        let task = null;
        let oldColumn = null;
        
        for (const [colName, tasks] of Object.entries(tasksData.columns)) {
            const idx = tasks.findIndex(t => t.id === taskId);
            if (idx !== -1) {
                task = tasks.splice(idx, 1)[0];
                oldColumn = colName;
                break;
            }
        }
        
        if (task && newColumn !== oldColumn) {
            // Update task status based on column
            const statusMap = {
                todo: 'pending',
                inProgress: 'in-progress',
                complete: 'complete'
            };
            task.status = statusMap[newColumn] || task.status;
            
            // Add to new column
            tasksData.columns[newColumn].push(task);
            
            // Update column counts
            updateColumnCounts();
            
            // Show toast
            showToast(`Moved "${task.title}" to ${getColumnTitle(newColumn)}`, 'success');
        }
    }

    /**
     * Update column count badges
     */
    function updateColumnCounts() {
        document.querySelectorAll('.kanban-column').forEach(col => {
            const columnId = col.dataset.column;
            const count = tasksData.columns[columnId]?.length || 0;
            const countEl = col.querySelector('.column-count');
            if (countEl) {
                countEl.textContent = count;
            }
        });
    }

    /**
     * Show task detail modal
     */
    function showTaskDetail(taskId) {
        // Find task in all columns
        let task = null;
        for (const tasks of Object.values(tasksData.columns)) {
            task = tasks.find(t => t.id === taskId);
            if (task) break;
        }
        
        if (!task) return;

        const modal = document.getElementById('taskDetailModal');
        const titleEl = document.getElementById('taskDetailTitle');
        const contentEl = document.getElementById('taskDetailContent');
        
        if (!modal || !titleEl || !contentEl) return;

        titleEl.textContent = task.title;
        
        contentEl.innerHTML = `
            <div class="task-detail-grid">
                <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span class="detail-value status-badge ${getStatusClass(task.status)}">${task.status}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Priority</span>
                    <span class="detail-value priority-badge ${getPriorityClass(task.priority)}">${getPriorityLabel(task.priority)}</span>
                </div>
                ${task.assignee ? `
                <div class="detail-row">
                    <span class="detail-label">Assignee</span>
                    <span class="detail-value">👤 ${escapeHtml(task.assignee)}</span>
                </div>
                ` : ''}
                ${task.due ? `
                <div class="detail-row">
                    <span class="detail-label">Due</span>
                    <span class="detail-value">${formatDue(task.due)}</span>
                </div>
                ` : ''}
                ${task.created ? `
                <div class="detail-row">
                    <span class="detail-label">Created</span>
                    <span class="detail-value">${formatDate(task.created)}</span>
                </div>
                ` : ''}
                ${task.file ? `
                <div class="detail-row">
                    <span class="detail-label">Source</span>
                    <span class="detail-value file-path">${escapeHtml(task.file)}</span>
                </div>
                ` : ''}
            </div>
            ${task.objective ? `
            <div class="detail-section">
                <h4>Objective</h4>
                <p>${escapeHtml(task.objective)}</p>
            </div>
            ` : ''}
            ${task.notes ? `
            <div class="detail-section">
                <h4>Notes</h4>
                <p>${escapeHtml(task.notes)}</p>
            </div>
            ` : ''}
        `;

        modal.classList.add('open');
        
        // Close handlers
        const closeModal = () => modal.classList.remove('open');
        modal.querySelector('.close-btn')?.addEventListener('click', closeModal, { once: true });
        modal.querySelector('.modal-backdrop')?.addEventListener('click', closeModal, { once: true });
    }

    /**
     * Get priority CSS class
     */
    function getPriorityClass(priority) {
        const map = {
            'high': 'priority-high',
            'P0': 'priority-high',
            'P1': 'priority-high',
            'medium': 'priority-medium',
            'P2': 'priority-medium',
            'low': 'priority-low',
            'P3': 'priority-low'
        };
        return map[priority] || 'priority-low';
    }

    /**
     * Get priority label
     */
    function getPriorityLabel(priority) {
        const map = {
            'high': 'High Priority',
            'P0': 'P0 - Critical',
            'P1': 'P1 - High',
            'medium': 'Medium Priority',
            'P2': 'P2 - Medium',
            'low': 'Low Priority',
            'P3': 'P3 - Low'
        };
        return map[priority] || priority || 'Normal';
    }

    /**
     * Get status CSS class
     */
    function getStatusClass(status) {
        const map = {
            'pending': 'status-pending',
            'in-progress': 'status-in-progress',
            'complete': 'status-complete',
            'blocked': 'status-blocked'
        };
        return map[status] || 'status-pending';
    }

    /**
     * Get column title
     */
    function getColumnTitle(columnId) {
        const map = {
            'todo': 'To Do',
            'inProgress': 'In Progress',
            'complete': 'Complete'
        };
        return map[columnId] || columnId;
    }

    /**
     * Format due date
     */
    function formatDue(dateStr) {
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diff = date - now;
            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            
            if (days < 0) {
                return `⚠️ Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`;
            } else if (days === 0) {
                return '📅 Due today';
            } else if (days === 1) {
                return '📅 Due tomorrow';
            } else if (days <= 7) {
                return `📅 Due in ${days} days`;
            } else {
                return `📅 ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
            }
        } catch (e) {
            return dateStr;
        }
    }

    /**
     * Format date
     */
    function formatDate(dateStr) {
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch (e) {
            return dateStr;
        }
    }

    /**
     * Show toast notification
     */
    function showToast(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    /**
     * Escape HTML for safe rendering
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Refresh the board
     */
    async function refresh() {
        await loadTasksData();
        renderBoard();
        setupDragAndDrop();
    }

    return {
        init,
        refresh,
        moveTask,
        showTaskDetail
    };
})();

// Export for global access
window.KanbanModule = KanbanModule;
