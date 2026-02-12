/**
 * Theme Module — Dark/Light Mode Toggle (#7)
 * Saves preference to localStorage
 */

(function() {
    'use strict';
    
    const STORAGE_KEY = 'mission-control-theme';
    const THEMES = {
        dark: {
            icon: '🌙',
            label: 'Dark mode'
        },
        light: {
            icon: '☀️',
            label: 'Light mode'
        }
    };
    
    /**
     * Initialize theme
     */
    function init() {
        // Load saved preference or detect system preference
        const savedTheme = localStorage.getItem(STORAGE_KEY);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        
        applyTheme(theme);
        setupToggle();
        setupSystemPreferenceListener();
        
        console.log(`🎨 Theme initialized: ${theme}`);
    }
    
    /**
     * Apply theme to document
     */
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        updateToggleIcon(theme);
        
        // Update meta theme-color for mobile browsers
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.setAttribute('content', theme === 'dark' ? '#0f0f1a' : '#f5f5f7');
        }
    }
    
    /**
     * Update toggle button icon
     */
    function updateToggleIcon(theme) {
        const toggle = document.getElementById('themeToggle');
        const icon = toggle?.querySelector('.theme-icon');
        
        if (icon) {
            // Show opposite theme icon (what clicking will switch to)
            const nextTheme = theme === 'dark' ? 'light' : 'dark';
            icon.textContent = THEMES[nextTheme].icon;
        }
        
        if (toggle) {
            toggle.title = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
        }
    }
    
    /**
     * Toggle theme
     */
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        applyTheme(newTheme);
        localStorage.setItem(STORAGE_KEY, newTheme);
        
        console.log(`🎨 Theme switched to: ${newTheme}`);
    }
    
    /**
     * Get current theme
     */
    function getTheme() {
        return document.documentElement.getAttribute('data-theme') || 'dark';
    }
    
    /**
     * Set up toggle button
     */
    function setupToggle() {
        const toggle = document.getElementById('themeToggle');
        
        toggle?.addEventListener('click', () => {
            toggleTheme();
            
            // Add a subtle animation
            toggle.style.transform = 'scale(0.9)';
            setTimeout(() => {
                toggle.style.transform = '';
            }, 100);
        });
    }
    
    /**
     * Listen for system preference changes
     */
    function setupSystemPreferenceListener() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        mediaQuery.addEventListener('change', (e) => {
            // Only auto-switch if user hasn't manually set a preference
            if (!localStorage.getItem(STORAGE_KEY)) {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }
    
    // Initialize immediately (before DOMContentLoaded to prevent flash)
    if (document.documentElement) {
        const savedTheme = localStorage.getItem(STORAGE_KEY);
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        }
    }
    
    // Full init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Expose for external use
    window.ThemeModule = {
        toggle: toggleTheme,
        get: getTheme,
        set: applyTheme
    };
})();
