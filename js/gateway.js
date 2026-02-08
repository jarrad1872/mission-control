/**
 * Gateway Client Module — Shared gateway connection for Mission Control
 * Provides authenticated API access to the OpenClaw gateway.
 * Used by quick-actions.js and control.js.
 */

(function() {
    'use strict';

    const STORAGE_KEYS = {
        url: 'mc_gateway_url',
        token: 'mc_gateway_token'
    };

    const DEFAULT_GATEWAY_URL = 'http://100.72.187.117:18789';

    // Connection state
    let _status = 'unknown'; // unknown | connected | disconnected | error
    let _lastCheck = null;
    let _statusListeners = [];

    /**
     * Get the configured gateway URL
     */
    function getUrl() {
        return localStorage.getItem(STORAGE_KEYS.url) || DEFAULT_GATEWAY_URL;
    }

    /**
     * Set the gateway URL
     */
    function setUrl(url) {
        const clean = (url || '').replace(/\/+$/, '');
        localStorage.setItem(STORAGE_KEYS.url, clean || DEFAULT_GATEWAY_URL);
    }

    /**
     * Get the auth token
     */
    function getToken() {
        return localStorage.getItem(STORAGE_KEYS.token) || '';
    }

    /**
     * Set the auth token
     */
    function setToken(token) {
        if (token) {
            localStorage.setItem(STORAGE_KEYS.token, token);
        } else {
            localStorage.removeItem(STORAGE_KEYS.token);
        }
    }

    /**
     * Check if a token is configured
     */
    function hasToken() {
        return !!getToken();
    }

    /**
     * Get current connection status
     */
    function getStatus() {
        return _status;
    }

    /**
     * Subscribe to connection status changes
     * @param {function} fn - callback(status)
     * @returns {function} unsubscribe
     */
    function onStatusChange(fn) {
        _statusListeners.push(fn);
        return () => {
            _statusListeners = _statusListeners.filter(f => f !== fn);
        };
    }

    function _setStatus(s) {
        if (_status === s) return;
        _status = s;
        _statusListeners.forEach(fn => {
            try { fn(s); } catch(e) { console.error('Gateway status listener error:', e); }
        });
    }

    // ========================================
    // HTTP layer
    // ========================================

    /**
     * Make an authenticated request to the gateway
     */
    async function request(endpoint, options = {}) {
        const url = `${getUrl()}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        const token = getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (response.status === 401 || response.status === 403) {
            _setStatus('error');
            throw new GatewayError('Authentication failed — check your token', response.status);
        }

        if (!response.ok) {
            const body = await response.text().catch(() => 'Unknown error');
            throw new GatewayError(`API Error ${response.status}: ${body}`, response.status);
        }

        // Some endpoints return empty body
        const text = await response.text();
        if (!text) return {};
        try {
            return JSON.parse(text);
        } catch {
            return { raw: text };
        }
    }

    /**
     * Custom error class for gateway errors
     */
    class GatewayError extends Error {
        constructor(message, statusCode) {
            super(message);
            this.name = 'GatewayError';
            this.statusCode = statusCode;
        }
    }

    // ========================================
    // API Methods (real OpenClaw endpoints)
    // ========================================

    /**
     * Test connection / get gateway status
     * GET /api/status
     */
    async function testConnection() {
        try {
            const data = await request('/api/status');
            _setStatus('connected');
            _lastCheck = Date.now();
            return { success: true, data };
        } catch (error) {
            if (error.message && error.message.includes('Failed to fetch')) {
                _setStatus('disconnected');
                return { success: false, error: 'Gateway unreachable — check URL and network' };
            }
            _setStatus('error');
            return { success: false, error: error.message };
        }
    }

    /**
     * Spawn a sub-agent
     * POST /api/sessions/spawn
     * @param {string} task - Task description for the agent
     * @param {string} [model] - Model to use (e.g. 'sonnet', 'opus', 'haiku')
     * @param {string} [label] - Label for the session
     */
    async function spawnAgent(task, model, label) {
        const body = { task };
        if (model) body.model = model;
        if (label) body.label = label;

        return request('/api/sessions/spawn', {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    /**
     * Send a message to a session
     * POST /api/sessions/send
     * @param {string} sessionKey - Session key to send to
     * @param {string} message - Message content
     */
    async function sendMessage(sessionKey, message) {
        return request('/api/sessions/send', {
            method: 'POST',
            body: JSON.stringify({ sessionKey, message })
        });
    }

    /**
     * Trigger a heartbeat / cron wake
     * POST /api/cron/wake
     * @param {string} [text] - Wake text
     */
    async function triggerHeartbeat(text) {
        return request('/api/cron/wake', {
            method: 'POST',
            body: JSON.stringify({
                text: text || 'Manual heartbeat triggered from Mission Control',
                mode: 'now'
            })
        });
    }

    /**
     * Get gateway status info
     * GET /api/status
     */
    async function getGatewayStatus() {
        return request('/api/status');
    }

    // ========================================
    // Auto-check on load
    // ========================================

    function autoCheck() {
        if (hasToken()) {
            // Silently test connection on load
            testConnection().catch(() => {});
        } else {
            _setStatus('disconnected');
        }
    }

    // Run auto-check when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoCheck);
    } else {
        // Small delay to let other modules init first
        setTimeout(autoCheck, 500);
    }

    // ========================================
    // Public API
    // ========================================

    window.Gateway = {
        // Config
        getUrl,
        setUrl,
        getToken,
        setToken,
        hasToken,
        DEFAULT_URL: DEFAULT_GATEWAY_URL,
        STORAGE_KEYS,

        // Connection
        getStatus,
        onStatusChange,
        testConnection,

        // API methods
        spawnAgent,
        sendMessage,
        triggerHeartbeat,
        getGatewayStatus,

        // Low-level
        request,
        GatewayError
    };

})();
