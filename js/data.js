/**
 * Data Module - Handles loading and caching of all dashboard data
 */

const DataModule = (function() {
    const DATA_PATH = 'data/';
    const cache = {};
    let lastUpdated = null;

    /**
     * Get gateway base URL if configured
     */
    function getGatewayBase() {
        const gwUrl = localStorage.getItem('mc_gateway_url');
        return gwUrl ? gwUrl.replace(/\/$/, '') : null;
    }

    /**
     * Map filenames to API endpoints
     */
    const API_MAP = {
        'activity.json': '/api/activity',
        'search-index.json': '/api/search',
        'calendar.json': null, // no API endpoint yet
    };

    /**
     * Load JSON data from a file (or gateway API)
     */
    async function loadJSON(filename) {
        if (cache[filename]) {
            return cache[filename];
        }

        try {
            // Try gateway API first
            const gw = getGatewayBase();
            const apiPath = API_MAP[filename];
            let url;
            if (gw && apiPath) {
                url = gw + apiPath;
            } else {
                url = DATA_PATH + filename;
            }
            
            const response = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now());
            if (!response.ok) {
                throw new Error(`Failed to load ${filename}: ${response.status}`);
            }
            const data = await response.json();
            cache[filename] = data;
            return data;
        } catch (error) {
            console.error(`Error loading ${filename}:`, error);
            return null;
        }
    }

    /**
     * Load activity data
     */
    async function loadActivity() {
        return loadJSON('activity.json');
    }

    /**
     * Load calendar data
     */
    async function loadCalendar() {
        return loadJSON('calendar.json');
    }

    /**
     * Load search index
     */
    async function loadSearchIndex() {
        return loadJSON('search-index.json');
    }

    /**
     * Get metadata about the data
     */
    async function getMetadata() {
        const activity = await loadActivity();
        if (activity && activity.generated) {
            lastUpdated = new Date(activity.generated);
            return {
                lastUpdated: lastUpdated,
                activityCount: activity.items?.length || 0,
            };
        }
        return null;
    }

    /**
     * Clear cache and reload all data
     */
    async function refresh() {
        Object.keys(cache).forEach(key => delete cache[key]);
        await Promise.all([
            loadActivity(),
            loadCalendar(),
            loadSearchIndex()
        ]);
        return getMetadata();
    }

    /**
     * Format relative time (delegates to Utils)
     */
    function formatRelativeTime(date) {
        return Utils.formatRelativeTime(date);
    }

    /**
     * Format date for display
     */
    function formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    }

    /**
     * Format time for display
     */
    function formatTime(date) {
        return new Date(date).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    /**
     * Get the icon for an activity type
     */
    function getActivityIcon(type) {
        const icons = {
            commit: '📝',
            task: '✅',
            event: '📌',
            arena: '🎯',
            heartbeat: '💓',
            email: '📧',
            default: '📋'
        };
        return icons[type] || icons.default;
    }

    return {
        loadActivity,
        loadCalendar,
        loadSearchIndex,
        getMetadata,
        refresh,
        formatRelativeTime,
        formatDate,
        formatTime,
        getActivityIcon
    };
})();

// Export for use in other modules
window.DataModule = DataModule;
