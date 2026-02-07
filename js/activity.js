/**
 * Activity Feed Module - Displays chronological activity log
 */

const ActivityModule = (function() {
    let allItems = [];
    let filteredItems = [];

    /**
     * Initialize the activity feed
     */
    async function init() {
        const data = await DataModule.loadActivity();
        if (!data || !data.items) {
            showEmpty();
            return;
        }

        allItems = data.items;
        applyFilters();
        setupListeners();
    }

    /**
     * Set up event listeners for filters
     */
    function setupListeners() {
        const typeFilter = document.getElementById('activityType');
        const dateFilter = document.getElementById('dateRange');

        if (typeFilter) {
            typeFilter.addEventListener('change', applyFilters);
        }
        if (dateFilter) {
            dateFilter.addEventListener('change', applyFilters);
        }
    }

    /**
     * Apply filters and re-render
     */
    function applyFilters() {
        const typeFilter = document.getElementById('activityType');
        const dateFilter = document.getElementById('dateRange');
        
        const selectedType = typeFilter?.value || 'all';
        const selectedRange = dateFilter?.value || '7';

        filteredItems = allItems.filter(item => {
            // Type filter
            if (selectedType !== 'all' && item.type !== selectedType) {
                return false;
            }

            // Date filter
            if (selectedRange !== 'all') {
                const itemDate = new Date(item.timestamp);
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - parseInt(selectedRange));
                if (itemDate < cutoff) {
                    return false;
                }
            }

            return true;
        });

        render();
    }

    /**
     * Render the activity feed
     */
    function render() {
        const container = document.getElementById('activityList');
        if (!container) return;

        if (filteredItems.length === 0) {
            showEmpty();
            return;
        }

        // Group by date
        const grouped = groupByDate(filteredItems);
        
        let html = '';
        Object.entries(grouped).forEach(([date, items]) => {
            html += `<div class="date-divider">${formatDateHeader(date)}</div>`;
            items.forEach(item => {
                html += renderItem(item);
            });
        });

        container.innerHTML = html;
    }

    /**
     * Group items by date
     */
    function groupByDate(items) {
        const groups = {};
        items.forEach(item => {
            const date = new Date(item.timestamp).toDateString();
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(item);
        });
        return groups;
    }

    /**
     * Format the date header
     */
    function formatDateHeader(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric'
            });
        }
    }

    /**
     * Render a single activity item
     */
    function renderItem(item) {
        const icon = DataModule.getActivityIcon(item.type);
        const time = DataModule.formatTime(item.timestamp);
        const relativeTime = DataModule.formatRelativeTime(item.timestamp);

        return `
            <div class="activity-item" data-type="${item.type}">
                <div class="activity-icon ${item.type}">${icon}</div>
                <div class="activity-content">
                    <div class="activity-title">${escapeHtml(item.title)}</div>
                    <div class="activity-meta">
                        <span class="activity-source">${getSourceLabel(item.source)}</span>
                        <span class="activity-time" title="${time}">${relativeTime}</span>
                        ${item.file ? `<span class="activity-file">${item.file}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get human-readable source label
     */
    function getSourceLabel(source) {
        const labels = {
            git: '🔀 Git',
            daily: '📝 Daily Notes',
            task: '✅ Tasks',
            arena: '🎯 Arena',
            cron: '⏰ Cron',
            default: '📋 Log'
        };
        return labels[source] || labels.default;
    }

    /**
     * Show empty state
     */
    function showEmpty() {
        const container = document.getElementById('activityList');
        if (!container) return;

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-emoji">📋</div>
                <p>No activity found matching your filters.</p>
                <p>Try adjusting the date range or type filter.</p>
            </div>
        `;
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Refresh activity data
     */
    async function refresh() {
        allItems = [];
        filteredItems = [];
        const container = document.getElementById('activityList');
        if (container) {
            container.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <span>Loading activity...</span>
                </div>
            `;
        }
        await init();
    }

    return {
        init,
        refresh,
        applyFilters
    };
})();

// Export for use in main.js
window.ActivityModule = ActivityModule;
