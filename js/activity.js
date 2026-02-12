/**
 * Activity Feed Module - Real-time activity log with live updates
 * Feature 2.1 for Mission Control v2
 */

const ActivityModule = (function() {
    // State
    let allItems = [];
    let filteredItems = [];
    let lastItemId = null;
    let lastFetchTime = null;
    let pollInterval = null;
    let consecutiveNoChanges = 0;
    let isLive = false;
    let soundEnabled = false;
    let notificationCount = 0;
    let relativeTimeInterval = null;
    let listenersBound = false;
    let initialized = false;
    
    // Config
    const BASE_POLL_INTERVAL = 10000;  // 10 seconds
    const MAX_POLL_INTERVAL = 60000;   // 60 seconds max backoff
    const MAX_ITEMS = 100;
    const BACKOFF_MULTIPLIER = 1.5;

    /**
     * Initialize the activity feed
     */
    async function init() {
        if (initialized) return;
        initialized = true;
        renderLiveHeader();
        setupListeners();
        await fetchAndRender();
        startPolling();
    }

    /**
     * Render the live indicator header
     */
    function renderLiveHeader() {
        const sectionHeader = document.querySelector('#dashboard-tab [data-section="activity-feed"] .section-header h2');
        if (sectionHeader) {
            sectionHeader.innerHTML = `
                Activity Feed
                <span class="live-indicator" id="liveIndicator">
                    <span class="live-dot"></span>
                    <span class="live-text">LIVE</span>
                </span>
                <span class="last-update" id="lastUpdateTime"></span>
            `;
        }
        
        // Add notification/date/sound controls to the Activity section header
        const headerRight = document.querySelector('#dashboard-tab [data-section="activity-feed"] .section-header-right');
        if (headerRight && !document.getElementById('activityControls')) {
            const controls = document.createElement('div');
            controls.id = 'activityControls';
            controls.className = 'activity-controls';
            controls.innerHTML = `
                <select id="dateRange" class="filter-select" title="Date range">
                    <option value="1">24h</option>
                    <option value="7" selected>7d</option>
                    <option value="30">30d</option>
                    <option value="all">All</option>
                </select>
                <span class="new-badge" id="newActivityBadge" style="display: none;">
                    <span class="badge-count">0</span> new
                </span>
                <button class="sound-toggle" id="soundToggle" title="Toggle notification sound">
                    🔇
                </button>
            `;
            headerRight.prepend(controls);
        }
    }

    /**
     * Set up event listeners for filters and controls
     */
    function setupListeners() {
        if (listenersBound) return;
        const typeFilter = document.getElementById('activityType');
        const dateFilter = document.getElementById('dateRange');
        const soundToggle = document.getElementById('soundToggle');
        const newBadge = document.getElementById('newActivityBadge');

        if (typeFilter) {
            typeFilter.addEventListener('change', applyFilters);
        }
        if (dateFilter) {
            dateFilter.addEventListener('change', applyFilters);
        }
        if (soundToggle) {
            soundToggle.addEventListener('click', toggleSound);
        }
        if (newBadge) {
            newBadge.addEventListener('click', scrollToTop);
        }
        
        // Update relative times every minute
        relativeTimeInterval = setInterval(updateRelativeTimes, 60000);
        
        // Visibility change - pause/resume polling
        document.addEventListener('visibilitychange', handleVisibilityChange);
        listenersBound = true;
    }

    /**
     * Fetch data and render
     */
    async function fetchAndRender() {
        const data = await DataModule.loadActivity();
        if (!data || !data.items) {
            showEmpty();
            setLiveStatus(false);
            return;
        }

        const oldFirstId = allItems.length > 0 ? allItems[0].id : null;
        const previousItemIds = new Set(allItems.map(item => item.id));
        
        // Keep only the last MAX_ITEMS
        allItems = data.items.slice(0, MAX_ITEMS);
        
        // Check for new items
        const newItems = allItems.filter(item => !previousItemIds.has(item.id));
        
        if (newItems.length > 0 && oldFirstId !== null) {
            // We have new items that weren't there before
            handleNewItems(newItems);
            consecutiveNoChanges = 0;
        } else if (oldFirstId !== null) {
            // No changes
            consecutiveNoChanges++;
        }
        
        lastFetchTime = new Date();
        lastItemId = allItems.length > 0 ? allItems[0].id : null;
        
        applyFilters(newItems.length > 0);
        setLiveStatus(true);
        updateLastUpdateDisplay();
    }

    /**
     * Handle new items arriving
     */
    function handleNewItems(newItems) {
        // Update notification count
        notificationCount += newItems.length;
        updateNotificationBadge();
        
        // Play sound if enabled
        if (soundEnabled && document.hidden) {
            playNotificationSound();
        }
        
        // Flash the browser tab title
        if (document.hidden) {
            flashTabTitle(newItems.length);
        }
    }

    /**
     * Update the notification badge
     */
    function updateNotificationBadge() {
        const badge = document.getElementById('newActivityBadge');
        const countEl = badge?.querySelector('.badge-count');
        
        if (badge && countEl) {
            if (notificationCount > 0) {
                countEl.textContent = notificationCount;
                badge.style.display = 'inline-flex';
                badge.classList.add('pulse');
            } else {
                badge.style.display = 'none';
                badge.classList.remove('pulse');
            }
        }
    }

    /**
     * Clear notification count and scroll to top
     */
    function scrollToTop() {
        notificationCount = 0;
        updateNotificationBadge();
        
        const container = document.getElementById('activityList');
        if (container) {
            container.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    /**
     * Toggle notification sound
     */
    function toggleSound() {
        soundEnabled = !soundEnabled;
        const toggle = document.getElementById('soundToggle');
        if (toggle) {
            toggle.textContent = soundEnabled ? '🔊' : '🔇';
            toggle.classList.toggle('active', soundEnabled);
        }
    }

    /**
     * Play notification sound
     */
    function playNotificationSound() {
        try {
            // Use Web Audio API for a short beep
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.frequency.value = 880;
            oscillator.type = 'sine';
            gain.gain.value = 0.3;
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.15);
        } catch (e) {
            // Ignore audio errors
        }
    }

    /**
     * Flash tab title when new items arrive
     */
    function flashTabTitle(count) {
        const originalTitle = document.title;
        let isFlashing = true;
        
        const flashInterval = setInterval(() => {
            if (!document.hidden || !isFlashing) {
                document.title = originalTitle;
                clearInterval(flashInterval);
                return;
            }
            document.title = document.title.startsWith('🔴') 
                ? originalTitle 
                : `🔴 (${count}) New Activity`;
        }, 1000);
        
        // Stop flashing when tab becomes visible
        const stopFlash = () => {
            isFlashing = false;
            document.title = originalTitle;
            document.removeEventListener('visibilitychange', stopFlash);
        };
        document.addEventListener('visibilitychange', stopFlash);
    }

    /**
     * Start polling for updates
     */
    function startPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
        }
        
        const interval = calculatePollInterval();
        pollInterval = setInterval(async () => {
            // Clear cache to force fresh fetch
            await DataModule.refresh();
            await fetchAndRender();
            
            // Adjust polling interval based on activity
            restartPollingWithNewInterval();
        }, interval);
    }

    /**
     * Calculate poll interval with backoff
     */
    function calculatePollInterval() {
        if (consecutiveNoChanges === 0) {
            return BASE_POLL_INTERVAL;
        }
        
        const backoff = BASE_POLL_INTERVAL * Math.pow(BACKOFF_MULTIPLIER, Math.min(consecutiveNoChanges, 5));
        return Math.min(backoff, MAX_POLL_INTERVAL);
    }

    /**
     * Restart polling with new interval
     */
    function restartPollingWithNewInterval() {
        clearInterval(pollInterval);
        startPolling();
    }

    /**
     * Handle visibility change
     */
    function handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden, slow down polling
            clearInterval(pollInterval);
            pollInterval = setInterval(async () => {
                await DataModule.refresh();
                await fetchAndRender();
            }, MAX_POLL_INTERVAL);
        } else {
            // Page is visible, reset and poll immediately
            notificationCount = 0;
            updateNotificationBadge();
            consecutiveNoChanges = 0;
            startPolling();
            fetchAndRender();
        }
    }

    /**
     * Set live status indicator
     */
    function setLiveStatus(live) {
        isLive = live;
        const indicator = document.getElementById('liveIndicator');
        if (indicator) {
            indicator.classList.toggle('live', live);
            indicator.classList.toggle('offline', !live);
            const liveText = indicator.querySelector('.live-text');
            if (liveText) {
                liveText.textContent = live ? 'LIVE' : 'OFFLINE';
            }
        }
    }

    /**
     * Update the last update display
     */
    function updateLastUpdateDisplay() {
        const el = document.getElementById('lastUpdateTime');
        if (el && lastFetchTime) {
            el.textContent = `Updated ${formatSmartTime(lastFetchTime)}`;
        }
    }

    /**
     * Format time smartly
     */
    function formatSmartTime(date) {
        const now = new Date();
        const diff = now - new Date(date);
        const seconds = Math.floor(diff / 1000);
        
        if (seconds < 5) return 'just now';
        if (seconds < 60) return `${seconds}s ago`;
        
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    /**
     * Update all relative times in the DOM
     */
    function updateRelativeTimes() {
        document.querySelectorAll('.activity-time[data-timestamp]').forEach(el => {
            const timestamp = el.getAttribute('data-timestamp');
            el.textContent = formatSmartTime(new Date(timestamp));
        });
        updateLastUpdateDisplay();
    }

    /**
     * Apply filters and re-render
     */
    function applyFilters(animateNew = false) {
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
                cutoff.setDate(cutoff.getDate() - parseInt(selectedRange, 10));
                if (itemDate < cutoff) {
                    return false;
                }
            }

            return true;
        });

        render(animateNew);
    }

    /**
     * Render the activity feed
     */
    function render(animateNew = false) {
        const container = document.getElementById('activityList');
        if (!container) return;

        if (filteredItems.length === 0) {
            showEmpty();
            return;
        }

        // Get existing item IDs for animation detection
        const existingIds = new Set(
            Array.from(container.querySelectorAll('.activity-item')).map(el => el.dataset.id)
        );

        // Group by date
        const grouped = groupByDate(filteredItems);
        
        let html = '';
        Object.entries(grouped).forEach(([date, items]) => {
            html += `<div class="date-divider">${formatDateHeader(date)}</div>`;
            items.forEach(item => {
                const isNew = animateNew && !existingIds.has(item.id);
                html += renderItem(item, isNew);
            });
        });

        container.innerHTML = html;
        
        // Trigger animations for new items
        if (animateNew) {
            requestAnimationFrame(() => {
                container.querySelectorAll('.activity-item.new-item').forEach(el => {
                    el.classList.add('animate-in');
                    // Remove animation class after animation completes
                    setTimeout(() => {
                        el.classList.remove('new-item', 'animate-in');
                    }, 600);
                });
            });
        }
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
    function renderItem(item, isNew = false) {
        const icon = DataModule.getActivityIcon(item.type);
        const time = DataModule.formatTime(item.timestamp);
        const relativeTime = formatSmartTime(new Date(item.timestamp));
        const safeType = Utils.escapeHtml(item.type);
        const safeId = Utils.escapeHtml(item.id);
        const safeFile = item.file ? Utils.escapeHtml(item.file) : '';

        return `
            <div class="activity-item ${isNew ? 'new-item' : ''}" data-type="${safeType}" data-id="${safeId}">
                <div class="activity-icon ${safeType}">${icon}</div>
                <div class="activity-content">
                    <div class="activity-title">${Utils.escapeHtml(item.title)}</div>
                    <div class="activity-meta">
                        <span class="activity-source">${getSourceLabel(item.source)}</span>
                        <span class="activity-time" title="${time}" data-timestamp="${item.timestamp}">${relativeTime}</span>
                        ${item.file ? `<span class="activity-file">${safeFile}</span>` : ''}
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
     * Refresh activity data
     */
    async function refresh() {
        const container = document.getElementById('activityList');
        if (container) {
            container.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <span>Loading activity...</span>
                </div>
            `;
        }
        
        await DataModule.refresh();
        allItems = [];
        filteredItems = [];
        consecutiveNoChanges = 0;
        await fetchAndRender();
    }

    /**
     * Stop polling (for cleanup)
     */
    function destroy() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        if (relativeTimeInterval) {
            clearInterval(relativeTimeInterval);
            relativeTimeInterval = null;
        }
        if (listenersBound) {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            listenersBound = false;
        }
        initialized = false;
    }

    return {
        init,
        refresh,
        applyFilters,
        destroy
    };
})();

// Export for use in main.js
window.ActivityModule = ActivityModule;
