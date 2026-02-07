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
                BobStatusModule.init(),
                CostsModule.init(),
                ActivityModule.init(),
                CalendarModule.init(),
                SearchModule.init(),
                VoiceModule.init(),
                SessionsModule.init(),
                KanbanModule.init(),
                MemoryBrowser.init(),
                ControlModule?.init?.()
            ]);
            
            // Update Bob status summary counts
            updateBobStatusSummary();
            
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
     * Set up tab scroll indicators for mobile
     */
    function setupTabScrollIndicators() {
        const wrapper = document.getElementById('navTabsWrapper');
        const navTabs = document.getElementById('navTabs');
        
        if (!wrapper || !navTabs) return;
        
        function updateScrollIndicators() {
            const scrollLeft = navTabs.scrollLeft;
            const maxScroll = navTabs.scrollWidth - navTabs.clientWidth;
            
            // Show/hide left indicator
            if (scrollLeft > 5) {
                wrapper.classList.add('can-scroll-left');
            } else {
                wrapper.classList.remove('can-scroll-left');
            }
            
            // Show/hide right indicator
            if (scrollLeft < maxScroll - 5) {
                wrapper.classList.add('can-scroll-right');
            } else {
                wrapper.classList.remove('can-scroll-right');
            }
        }
        
        // Check on scroll
        navTabs.addEventListener('scroll', updateScrollIndicators);
        
        // Initial check and on resize
        updateScrollIndicators();
        window.addEventListener('resize', updateScrollIndicators);
    }

    /**
     * Set up tab navigation
     * Proper show/hide tab switching with mobile scroll support
     */
    function setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        const mainContent = document.querySelector('.main-content');
        
        // Set up scroll indicators for mobile
        setupTabScrollIndicators();

        // Ensure initial state: only active tab content is visible
        tabContents.forEach(content => {
            if (!content.classList.contains('active')) {
                content.style.display = 'none';
            } else {
                content.style.display = 'block';
            }
        });

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.dataset.tab;
                
                // Remove active state from all tabs
                tabButtons.forEach(btn => btn.classList.remove('active'));
                
                // Hide ALL tab contents explicitly
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    content.style.display = 'none';
                });
                
                // Activate clicked tab
                button.classList.add('active');
                
                // Show target content
                const targetContent = document.getElementById(`${tabId}-tab`);
                if (targetContent) {
                    targetContent.classList.add('active');
                    targetContent.style.display = 'block';
                    
                    // On mobile, scroll to the main content area for better UX
                    if (window.innerWidth <= 768 && mainContent) {
                        mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
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
                    BobStatusModule.refresh(),
                    CostsModule.refresh(),
                    ActivityModule.refresh(),
                    CalendarModule.refresh(),
                    SearchModule.refresh(),
                    KanbanModule.refresh(),
                    MemoryBrowser.refresh()
                ]);
                
                // Update Bob status summary
                updateBobStatusSummary();
                
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

    /**
     * Update Bob status summary counts in the header
     */
    function updateBobStatusSummary() {
        const counts = BobStatusModule.getStatusCounts();
        
        const activeEl = document.getElementById('activeCount');
        const idleEl = document.getElementById('idleCount');
        const errorEl = document.getElementById('errorCount');
        
        if (activeEl) activeEl.textContent = counts.active || 0;
        if (idleEl) idleEl.textContent = counts.idle || 0;
        if (errorEl) errorEl.textContent = counts.error || 0;
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
        BobStatusModule,
        CostsModule,
        ActivityModule,
        CalendarModule,
        SearchModule,
        VoiceModule,
        DataModule,
        KanbanModule,
        MemoryBrowser,
        ControlModule
    };
})();
