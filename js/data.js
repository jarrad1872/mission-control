/**
 * Data Module - Handles loading and caching of all dashboard data
 */

const DataModule = (function() {
    const DATA_PATH = 'data/';
    const CACHE_TTL_MS = 60000;
    const cache = {};
    const inFlight = {};
    let lastUpdated = null;

    /**
     * Get gateway base URL if configured
     */
    function getGatewayBase() {
        const gwUrl = localStorage.getItem('mc_gateway_url');
        const clean = String(gwUrl || '').trim().replace(/\/$/, '');
        return clean || null;
    }

    /**
     * Map filenames to API endpoints
     */
    const API_MAP = {
        'activity.json': '/api/activity',
        'search-index.json': '/api/search',
        'calendar.json': '/api/calendar',
    };

    /**
     * Load JSON data from a file (or gateway API)
     */
    async function loadJSON(filename, options = {}) {
        const forceRefresh = !!options.forceRefresh;
        const key = String(filename || '').trim();
        if (!key) {
            console.error('loadJSON requires a filename');
            return null;
        }
        const cached = cache[key];
        const isFresh = cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS;
        if (!forceRefresh && isFresh) {
            return cached.data;
        }
        if (!forceRefresh && inFlight[key]) {
            return inFlight[key];
        }

        const loadPromise = (async () => {
            try {
                // Try gateway API first, then static fallback if gateway path fails.
                const gw = getGatewayBase();
                const apiPath = API_MAP[key];
                const urls = [];
                if (gw && apiPath) {
                    urls.push(gw + apiPath);
                }
                urls.push(DATA_PATH + key);

                let lastError = null;
                for (const baseUrl of urls) {
                    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
                    try {
                        const response = await fetch(url);
                        if (!response.ok) {
                            throw new Error(`Failed to load ${key}: ${response.status}`);
                        }
                        const data = await response.json();
                        cache[key] = {
                            data,
                            fetchedAt: Date.now()
                        };
                        return data;
                    } catch (error) {
                        lastError = error;
                    }
                }

                throw lastError || new Error(`Failed to load ${key}`);
            } catch (error) {
                console.error(`Error loading ${key}:`, error);
                return null;
            } finally {
                delete inFlight[key];
            }
        })();

        inFlight[key] = loadPromise;
        return loadPromise;
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
            const generated = new Date(activity.generated);
            lastUpdated = Number.isNaN(generated.getTime()) ? null : generated;
            return {
                lastUpdated: lastUpdated,
                activityCount: Array.isArray(activity.items) ? activity.items.length : 0,
            };
        }
        return null;
    }

    /**
     * Clear cache and reload all data
     */
    async function refresh() {
        Object.keys(cache).forEach(key => delete cache[key]);
        Object.keys(inFlight).forEach(key => delete inFlight[key]);
        await Promise.all([
            loadJSON('activity.json', { forceRefresh: true }),
            loadJSON('calendar.json', { forceRefresh: true }),
            loadJSON('search-index.json', { forceRefresh: true })
        ]);
        return getMetadata();
    }

    /**
     * Format relative time (delegates to Utils)
     */
    function formatRelativeTime(date) {
        if (!date) return '';
        if (window.Utils?.formatRelativeTime) return window.Utils.formatRelativeTime(date);
        return formatDate(date);
    }

    /**
     * Format date for display
     */
    function formatDate(date) {
        const parsed = new Date(date);
        if (Number.isNaN(parsed.getTime())) return '';
        return parsed.toLocaleDateString('en-US', {
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
        const parsed = new Date(date);
        if (Number.isNaN(parsed.getTime())) return '';
        return parsed.toLocaleTimeString('en-US', {
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
