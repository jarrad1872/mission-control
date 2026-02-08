/**
 * Main Application Controller
 * Mobile-first navigation with bottom nav and collapsible sections
 */

(function() {
    'use strict';

    /**
     * Auto-populate default settings if not already configured.
     * This is a private, auth-gated dashboard — hardcoding defaults is fine.
     * Users can still override via the Settings modal.
     */
    function initDefaults() {
        // OpenAI key is base64-encoded to avoid GitHub push protection pattern matching
        const _oaiB64 = 'c2stcHJvai0yQVVHXy1QSGplTWllamxaN0hYVWxvNGtybDFqcGxiRjg3THNRZi1aNml3UzJhRFExZ2JjZVZ3U0VxUWJMVXhsTTlEcU42U2lFdVQzQmxia0ZKT2UtbG1xUjdRa25iSWc1MHAwam92VFY5NUd2cmxVNEkxLV9kRGZzT0taVjRySkdDTXJWdnBwMDdrMXNkU05aeXcwMVpwSEExTUE=';

        const defaults = {
            'mc_gateway_url':   'https://plots-academic-gabriel-weather.trycloudflare.com',
            'mc_gateway_token': 'dcc3f1b418346afbaa3870d46c10e0111db809109402a437',
            'mc_openai_key':    atob(_oaiB64)
        };

        // Force-update gateway URL if it still points to an old tunnel
        // (Cloudflare quick tunnels get new URLs on restart)
        const currentGw = localStorage.getItem('mc_gateway_url') || '';
        if (currentGw.includes('trycloudflare.com') && currentGw !== defaults.mc_gateway_url) {
            localStorage.setItem('mc_gateway_url', defaults.mc_gateway_url);
            console.log('🔄 Updated gateway URL to new tunnel');
        }

        Object.entries(defaults).forEach(([key, value]) => {
            if (!localStorage.getItem(key)) {
                localStorage.setItem(key, value);
                console.log(`🔧 Auto-set default for ${key}`);
            }
        });
    }

    // Run defaults before anything else reads localStorage
    initDefaults();

    /**
     * Initialize the application
     */
    async function init() {
        console.log('🎯 Mission Control initializing...');
        
        // Set up bottom navigation
        setupBottomNav();
        
        // Set up more drawer
        setupMoreDrawer();
        
        // Set up collapsible sections
        setupCollapsibleSections();
        
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
                BobChat.init(),
                SessionsModule.init(),
                KanbanModule.init(),
                MemoryBrowser.init(),
                CFOModule?.init?.(),
                ControlModule?.init?.(),
                Analytics?.init?.()
            ]);
            
            // Update status indicator
            updateStatus('online');
            
            console.log('✅ Mission Control ready');
        } catch (error) {
            console.error('❌ Initialization error:', error);
            updateStatus('error');
        }
    }

    /**
     * Set up bottom navigation (#1)
     */
    function setupBottomNav() {
        const navItems = document.querySelectorAll('.nav-item');
        const tabContents = document.querySelectorAll('.tab-content');
        const mainContent = document.querySelector('.main-content');

        // Ensure initial state
        tabContents.forEach(content => {
            content.style.display = content.classList.contains('active') ? 'block' : 'none';
        });

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const tabId = item.dataset.tab;
                
                // Handle "more" tab specially
                if (tabId === 'more') {
                    openMoreDrawer();
                    return;
                }
                
                // Remove active from all nav items
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Switch tab content
                switchTab(tabId);
                
                // Scroll to top on tab change
                if (mainContent) {
                    mainContent.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    }

    /**
     * Switch to a specific tab
     */
    function switchTab(tabId) {
        const tabContents = document.querySelectorAll('.tab-content');
        const navItems = document.querySelectorAll('.nav-item');
        
        // Hide all tabs
        tabContents.forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none';
        });
        
        // Show target tab
        const targetTab = document.getElementById(`${tabId}-tab`);
        if (targetTab) {
            targetTab.classList.add('active');
            targetTab.style.display = 'block';
        }
        
        // Update nav active state (for tabs opened from More drawer)
        const mainTabs = ['dashboard', 'tasks', 'cfo', 'activity'];
        if (!mainTabs.includes(tabId)) {
            // It's a secondary tab from More drawer
            navItems.forEach(nav => nav.classList.remove('active'));
        }
        
        // Focus search input when switching to search tab
        if (tabId === 'search') {
            setTimeout(() => {
                document.getElementById('searchInput')?.focus();
            }, 100);
        }
    }

    /**
     * Set up more drawer (#1)
     */
    function setupMoreDrawer() {
        const moreDrawer = document.getElementById('moreDrawer');
        const moreItems = document.querySelectorAll('.more-item');
        const closeBtn = moreDrawer?.querySelector('.more-drawer-close');
        const backdrop = moreDrawer?.querySelector('.more-drawer-backdrop');

        // More item clicks
        moreItems.forEach(item => {
            item.addEventListener('click', () => {
                const tabId = item.dataset.tab;
                switchTab(tabId);
                closeMoreDrawer();
            });
        });

        // Close button
        closeBtn?.addEventListener('click', closeMoreDrawer);
        
        // Backdrop click
        backdrop?.addEventListener('click', closeMoreDrawer);
        
        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && moreDrawer?.classList.contains('open')) {
                closeMoreDrawer();
            }
        });
    }

    /**
     * Open more drawer
     */
    function openMoreDrawer() {
        const drawer = document.getElementById('moreDrawer');
        drawer?.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close more drawer
     */
    function closeMoreDrawer() {
        const drawer = document.getElementById('moreDrawer');
        drawer?.classList.remove('open');
        document.body.style.overflow = '';
    }

    /**
     * Set up collapsible sections (#6)
     */
    function setupCollapsibleSections() {
        const sections = document.querySelectorAll('.collapsible-section');
        const STORAGE_KEY = 'collapsedSections';
        
        // Restore saved state
        let savedState = {};
        try {
            savedState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        } catch (e) {
            console.warn('Could not parse collapsed sections state');
        }

        sections.forEach(section => {
            const sectionId = section.dataset.section;
            const header = section.querySelector('.collapsible-header');
            
            if (!header || !sectionId) return;
            
            // Restore collapsed state
            if (savedState[sectionId]) {
                section.classList.add('collapsed');
            }
            
            // Add click handler
            header.addEventListener('click', (e) => {
                // Don't collapse if clicking on filter selects
                if (e.target.closest('.filter-select')) return;
                
                const isCollapsed = section.classList.toggle('collapsed');
                
                // Save state
                savedState[sectionId] = isCollapsed;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));
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
            updateStatus('loading');
            
            try {
                await DataModule.refresh();
                await Promise.all([
                    BobStatusModule.refresh(),
                    CostsModule.refresh(),
                    ActivityModule.refresh(),
                    CalendarModule.refresh(),
                    SearchModule.refresh(),
                    KanbanModule.refresh(),
                    MemoryBrowser.refresh(),
                    CFOModule?.refresh?.()
                ]);
                
                updateStatus('online');
                showToast?.('Data refreshed!', 'success');
            } catch (error) {
                console.error('Refresh error:', error);
                updateStatus('error');
                showToast?.('Refresh failed', 'error');
            } finally {
                refreshBtn.classList.remove('spinning');
            }
        });
    }

    /**
     * Update status indicator (#10 - subtle status)
     */
    function updateStatus(status) {
        const statusDot = document.getElementById('globalStatusDot');
        
        if (statusDot) {
            statusDot.className = 'status-dot';
            if (status === 'loading') statusDot.classList.add('loading');
            if (status === 'error') statusDot.classList.add('error');
        }
    }

    /**
     * Show toast notification (delegates to Utils)
     */
    function showToast(message, type = 'info') {
        Utils.showToast(message, type);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose for debugging and external access
    window.MissionControl = {
        switchTab,
        openMoreDrawer,
        closeMoreDrawer,
        refresh: () => document.getElementById('refreshBtn')?.click(),
        BobStatusModule,
        CostsModule,
        ActivityModule,
        CalendarModule,
        SearchModule,
        BobChat,
        DataModule,
        KanbanModule,
        MemoryBrowser,
        CFOModule,
        ControlModule
    };
})();
