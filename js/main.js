/**
 * Main Application Controller
 * Coordinates all modules and handles global UI interactions
 */

(function() {
    'use strict';

    /**
     * Initialize the application
     */
    async function init() {
        console.log('🎯 Mission Control initializing...');
        
        // Set up tab navigation
        setupTabs();
        
        // Set up refresh button
        setupRefresh();
        
        // Initialize all modules
        try {
            await Promise.all([
                ActivityModule.init(),
                CalendarModule.init(),
                SearchModule.init()
            ]);
            
            // Update status
            updateStatus('online', 'Data loaded');
            
            // Update last updated time
            const metadata = await DataModule.getMetadata();
            if (metadata && metadata.lastUpdated) {
                updateLastUpdated(metadata.lastUpdated);
            }
            
            console.log('✅ Mission Control ready');
        } catch (error) {
            console.error('❌ Initialization error:', error);
            updateStatus('error', 'Load failed');
        }
    }

    /**
     * Set up tab navigation
     */
    function setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.dataset.tab;
                
                // Update active states
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                button.classList.add('active');
                const targetContent = document.getElementById(`${tabId}-tab`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
                
                // Focus search input when switching to search tab
                if (tabId === 'search') {
                    const searchInput = document.getElementById('searchInput');
                    if (searchInput) {
                        setTimeout(() => searchInput.focus(), 100);
                    }
                }
            });
        });
    }

    /**
     * Set up refresh button
     */
    function setupRefresh() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (!refreshBtn) return;

        refreshBtn.addEventListener('click', async () => {
            refreshBtn.classList.add('spinning');
            updateStatus('loading', 'Refreshing...');
            
            try {
                await DataModule.refresh();
                await Promise.all([
                    ActivityModule.refresh(),
                    CalendarModule.refresh(),
                    SearchModule.refresh()
                ]);
                
                const metadata = await DataModule.getMetadata();
                if (metadata && metadata.lastUpdated) {
                    updateLastUpdated(metadata.lastUpdated);
                }
                
                updateStatus('online', 'Data loaded');
            } catch (error) {
                console.error('Refresh error:', error);
                updateStatus('error', 'Refresh failed');
            } finally {
                refreshBtn.classList.remove('spinning');
            }
        });
    }

    /**
     * Update status indicator
     */
    function updateStatus(status, text) {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.getElementById('statusText');
        
        if (statusDot) {
            statusDot.className = 'status-dot';
            if (status === 'online') statusDot.classList.add('online');
            if (status === 'error') statusDot.classList.add('error');
        }
        
        if (statusText) {
            statusText.textContent = text;
        }
    }

    /**
     * Update last updated timestamp
     */
    function updateLastUpdated(date) {
        const element = document.getElementById('lastUpdated');
        if (!element) return;

        const d = new Date(date);
        element.textContent = d.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose for debugging
    window.MissionControl = {
        refresh: async () => {
            document.getElementById('refreshBtn')?.click();
        },
        ActivityModule,
        CalendarModule,
        SearchModule,
        DataModule
    };
})();
