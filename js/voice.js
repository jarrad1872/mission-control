/**
 * Voice Module - ClawChat Integration
 * Lazy-loads ClawChat voice interface in an iframe
 */

const VoiceModule = (function() {
    'use strict';

    // Configuration - update this when tunnel URL changes
    const CONFIG = {
        clawchatUrl: 'https://infrared-lounge-sherman-set.trycloudflare.com'
    };

    let isLoaded = false;
    let container = null;

    /**
     * Initialize the voice module
     */
    function init() {
        container = document.getElementById('voice-tab');
        if (!container) {
            console.warn('Voice tab container not found');
            return;
        }

        // Set up tab listener for lazy loading
        const voiceTabBtn = document.querySelector('[data-tab="voice"]');
        if (voiceTabBtn) {
            voiceTabBtn.addEventListener('click', handleTabActivation);
        }

        console.log('🎙️ Voice module initialized');
    }

    /**
     * Handle tab activation - lazy load iframe
     */
    function handleTabActivation() {
        if (!isLoaded) {
            loadIframe();
        }
    }

    /**
     * Load the ClawChat iframe
     */
    function loadIframe() {
        if (isLoaded || !container) return;

        const loadingEl = container.querySelector('.voice-loading');
        const iframeWrapper = container.querySelector('.voice-iframe-wrapper');
        
        if (!iframeWrapper) return;

        // Create iframe
        const iframe = document.createElement('iframe');
        iframe.src = CONFIG.clawchatUrl;
        iframe.className = 'voice-iframe';
        iframe.allow = 'microphone; camera; autoplay';
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('loading', 'lazy');

        // Handle load success
        iframe.addEventListener('load', () => {
            if (loadingEl) {
                loadingEl.style.display = 'none';
            }
            iframe.classList.add('loaded');
            console.log('✅ ClawChat iframe loaded');
        });

        // Handle load error
        iframe.addEventListener('error', () => {
            if (loadingEl) {
                loadingEl.innerHTML = `
                    <span class="voice-error-icon">⚠️</span>
                    <p>Failed to load ClawChat</p>
                    <p class="voice-error-hint">The tunnel URL may have changed</p>
                    <a href="${CONFIG.clawchatUrl}" target="_blank" class="voice-fallback-link">
                        Open in new tab →
                    </a>
                `;
            }
        });

        iframeWrapper.appendChild(iframe);
        isLoaded = true;
    }

    /**
     * Refresh - reload iframe
     */
    function refresh() {
        if (!isLoaded) return;
        
        const iframe = container?.querySelector('.voice-iframe');
        if (iframe) {
            iframe.src = CONFIG.clawchatUrl;
        }
    }

    /**
     * Get current ClawChat URL
     */
    function getUrl() {
        return CONFIG.clawchatUrl;
    }

    /**
     * Update ClawChat URL (for when tunnel changes)
     */
    function setUrl(newUrl) {
        CONFIG.clawchatUrl = newUrl;
        
        const iframe = container?.querySelector('.voice-iframe');
        if (iframe) {
            iframe.src = newUrl;
        }
        
        console.log('🎙️ ClawChat URL updated:', newUrl);
    }

    // Public API
    return {
        init,
        refresh,
        getUrl,
        setUrl,
        loadIframe,
        get CONFIG() { return CONFIG; }
    };
})();
