/**
 * Gateway Client Module — Shared gateway connection for Mission Control
 * Provides authenticated API access to the OpenClaw gateway.
 *
 * Uses HTTP hooks API (POST /hooks/wake, POST /hooks/agent) for control operations.
 * Uses /v1/chat/completions for LLM calls (Bob Chat voice).
 */

(function() {
    'use strict';

    const STORAGE_KEYS = {
        url: 'mc_gateway_url',
        token: 'mc_gateway_token'
    };

    const DEFAULT_GATEWAY_URL = 'http://100.72.187.117:18789';
    const REQUEST_TIMEOUT_MS = 15000;

    // Connection state
    let _status = 'unknown'; // unknown | connected | disconnected | error
    let _lastCheck = null;
    let _statusListeners = [];
    let _testConnectionSeq = 0;

    function sanitizeUrl(url) {
        const raw = String(url || '').trim().replace(/\/+$/, '');
        const fallback = DEFAULT_GATEWAY_URL;
        const candidate = raw || fallback;
        try {
            const parsed = new URL(candidate);
            const normalized = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
            return normalized || fallback;
        } catch {
            return fallback;
        }
    }

    /**
     * Get the configured gateway URL
     */
    function getUrl() {
        return sanitizeUrl(localStorage.getItem(STORAGE_KEYS.url));
    }

    /**
     * Set the gateway URL
     */
    function setUrl(url) {
        localStorage.setItem(STORAGE_KEYS.url, sanitizeUrl(url));
    }

    function buildRequestUrl(endpoint) {
        if (endpoint === null || endpoint === undefined) {
            throw new GatewayError('Request endpoint is required', 0);
        }
        const base = getUrl();
        const path = String(endpoint).trim();
        if (!path) {
            throw new GatewayError('Request endpoint is required', 0);
        }
        if (/^https?:\/\//i.test(path)) {
            return path;
        }
        return `${base}${path.startsWith('/') ? path : `/${path}`}`;
    }

    async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
        const controller = new AbortController();
        const timerId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, {
                ...options,
                signal: controller.signal
            });
        } finally {
            clearTimeout(timerId);
        }
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
        try {
            const url = buildRequestUrl(endpoint);
            const headers = {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            };

            const token = getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetchWithTimeout(url, {
                ...options,
                headers
            }, REQUEST_TIMEOUT_MS);

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
        } catch (error) {
            if (error instanceof GatewayError) {
                throw error;
            }
            const message = error?.message || String(error);
            if (error?.name === 'AbortError') {
                _setStatus('disconnected');
                throw new GatewayError('Gateway request timed out', 0);
            }
            if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
                _setStatus('disconnected');
                throw new GatewayError('Gateway unreachable — check URL and network', 0);
            }
            _setStatus('error');
            throw new GatewayError(message || 'Gateway request failed', 0);
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
    // API Methods — HTTP Hooks
    // The gateway control API is WebSocket-only.
    // For HTTP access, we use the hooks system:
    //   POST /hooks/wake   — trigger heartbeat/wake
    //   POST /hooks/agent  — send message to a session
    // ========================================

    /**
     * Test connection by hitting the root URL (should return 200 or 404)
     * Any non-network-error response means the gateway is reachable.
     */
    async function testConnection() {
        const seq = ++_testConnectionSeq;
        try {
            const url = getUrl();
            const token = getToken();
            // Use a lightweight POST to /hooks/wake with a no-op as connectivity check
            const response = await fetchWithTimeout(`${url}/hooks/wake`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ text: 'connectivity check', mode: 'next-heartbeat' })
            }, REQUEST_TIMEOUT_MS);
            if (response.ok) {
                if (seq === _testConnectionSeq) _setStatus('connected');
                _lastCheck = Date.now();
                return { success: true, data: await response.json().catch(() => ({})) };
            }
            if (response.status === 401) {
                if (seq === _testConnectionSeq) _setStatus('error');
                return { success: false, error: 'Authentication failed — check your token' };
            }
            // Gateway responded but endpoint issue — still reachable
            if (seq === _testConnectionSeq) _setStatus('connected');
            _lastCheck = Date.now();
            return { success: true, data: {} };
        } catch (error) {
            if (error?.name === 'AbortError') {
                if (seq === _testConnectionSeq) _setStatus('disconnected');
                return { success: false, error: 'Gateway request timed out' };
            }
            if (error?.message && error.message.includes('Failed to fetch')) {
                if (seq === _testConnectionSeq) _setStatus('disconnected');
                return { success: false, error: 'Gateway unreachable — check URL and network' };
            }
            if (seq === _testConnectionSeq) _setStatus('error');
            return { success: false, error: error?.message || 'Gateway test failed' };
        }
    }

    /**
     * Send a message to a Bob session via hooks/agent
     * This dispatches an agent run in the specified session.
     * @param {string} sessionKey - Session key to send to
     * @param {string} message - Message content
     * @param {object} [opts] - Optional: channel, deliver, model
     */
    async function sendMessage(sessionKey, message, opts = {}) {
        const body = {
            message,
            sessionKey,
            name: opts.name || 'Mission Control',
            channel: opts.channel || 'telegram',
            deliver: opts.deliver !== undefined ? opts.deliver : true,
            wakeMode: 'now'
        };
        if (opts.model) body.model = opts.model;

        return request('/hooks/agent', {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    /**
     * Spawn a sub-agent via hooks/agent (creates a new session)
     * @param {string} task - Task description
     * @param {string} [model] - Model to use
     * @param {string} [label] - Session label
     */
    async function spawnAgent(task, model, label) {
        const body = {
            message: task,
            name: label || 'Mission Control Spawn',
            wakeMode: 'now',
            channel: 'telegram',
            deliver: true
        };
        if (model) body.model = model;

        return request('/hooks/agent', {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    /**
     * Trigger a heartbeat / cron wake
     * POST /hooks/wake
     * @param {string} [text] - Wake text
     */
    async function triggerHeartbeat(text) {
        return request('/hooks/wake', {
            method: 'POST',
            body: JSON.stringify({
                text: text || 'Manual heartbeat triggered from Mission Control',
                mode: 'now'
            })
        });
    }

    /**
     * Get gateway status — uses testConnection since no REST status endpoint exists
     */
    async function getGatewayStatus() {
        return testConnection();
    }

    // ========================================
    // Auto-check on load
    // ========================================

    function autoCheck() {
        if (hasToken()) {
            testConnection().catch(() => {});
        } else {
            _setStatus('disconnected');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoCheck, { once: true });
    } else {
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
