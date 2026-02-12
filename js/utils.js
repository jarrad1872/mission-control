/**
 * Shared Utilities Module
 * Common functions used across Mission Control modules
 */

const Utils = (function() {
    'use strict';

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Raw text to escape
     * @returns {string} HTML-safe string
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Format a timestamp as relative time (e.g., "5m ago", "2d ago")
     * @param {string|Date} timestamp - Date to format
     * @returns {string} Relative time string
     */
    function formatRelativeTime(timestamp) {
        if (!timestamp) return 'Unknown';

        const now = new Date();
        const then = new Date(timestamp);
        const diffMs = now - then;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return then.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: diffDays > 365 ? 'numeric' : undefined
        });
    }

    /**
     * Format large numbers compactly (e.g., 50000 -> "50.0K", 1500000 -> "1.5M")
     * @param {number} num - Number to format
     * @returns {string} Formatted number string
     */
    function formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    /**
     * Alias for formatNumber — formats token counts
     * @param {number} count - Token count
     * @returns {string} Formatted token string
     */
    function formatTokens(count) {
        return formatNumber(count);
    }

    /**
     * Show a toast notification via QuickActions (canonical implementation)
     * @param {string} message - Toast message
     * @param {string} [type='info'] - Toast type: 'success', 'error', 'warning', 'info'
     */
    function showToast(message, type) {
        if (window.QuickActions?.showToast) {
            window.QuickActions.showToast(message, type || 'info');
        } else {
            // Fallback: create simple toast
            const container = document.querySelector('.toast-container') || _createToastContainer();
            const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
            const t = type || 'info';
            const safeMessage = escapeHtml(message);
            const toast = document.createElement('div');
            toast.className = `toast toast-${t} toast-visible`;
            toast.innerHTML = `
                <span class="toast-icon">${icons[t] || icons.info}</span>
                <span class="toast-message">${safeMessage}</span>
            `;
            container.appendChild(toast);
            setTimeout(() => {
                toast.classList.add('toast-hiding');
                setTimeout(() => toast.remove(), 300);
            }, 4000);
        }
    }

    /**
     * Create toast container element
     * @private
     */
    function _createToastContainer() {
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    }

    return {
        escapeHtml,
        formatRelativeTime,
        formatNumber,
        formatTokens,
        showToast
    };
})();

// Export for global access
window.Utils = Utils;
