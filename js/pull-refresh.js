/**
 * Pull to Refresh Module (#5)
 * Touch-based pull-to-refresh for mobile
 */

(function() {
    'use strict';
    
    const PULL_THRESHOLD = 80; // Pixels needed to trigger refresh
    const RESISTANCE = 2.5; // Pull resistance factor
    
    let startY = 0;
    let currentY = 0;
    let isPulling = false;
    let isRefreshing = false;
    
    /**
     * Initialize pull to refresh
     */
    function init() {
        const mainContent = document.getElementById('mainContent');
        const indicator = document.getElementById('pullRefreshIndicator');
        
        if (!mainContent || !indicator) {
            console.warn('Pull to refresh: missing elements');
            return;
        }
        
        // Only enable on touch devices
        if (!('ontouchstart' in window)) {
            return;
        }
        
        mainContent.addEventListener('touchstart', handleTouchStart, { passive: true });
        mainContent.addEventListener('touchmove', handleTouchMove, { passive: false });
        mainContent.addEventListener('touchend', handleTouchEnd, { passive: true });
        
        console.log('🔄 Pull to refresh initialized');
    }
    
    /**
     * Handle touch start
     */
    function handleTouchStart(e) {
        if (isRefreshing) return;
        
        const mainContent = document.getElementById('mainContent');
        
        // Only start if scrolled to top
        if (mainContent.scrollTop > 0) return;
        
        startY = e.touches[0].clientY;
        isPulling = true;
    }
    
    /**
     * Handle touch move
     */
    function handleTouchMove(e) {
        if (!isPulling || isRefreshing) return;
        
        const mainContent = document.getElementById('mainContent');
        
        // Cancel if not at top
        if (mainContent.scrollTop > 0) {
            isPulling = false;
            return;
        }
        
        currentY = e.touches[0].clientY;
        const pullDistance = currentY - startY;
        
        // Only handle pull down
        if (pullDistance <= 0) {
            hideIndicator();
            return;
        }
        
        // Prevent default scroll when pulling
        e.preventDefault();
        
        // Apply resistance
        const adjustedDistance = pullDistance / RESISTANCE;
        
        updateIndicator(adjustedDistance);
    }
    
    /**
     * Handle touch end
     */
    function handleTouchEnd() {
        if (!isPulling || isRefreshing) return;
        
        const pullDistance = (currentY - startY) / RESISTANCE;
        
        if (pullDistance >= PULL_THRESHOLD) {
            triggerRefresh();
        } else {
            hideIndicator();
        }
        
        isPulling = false;
        startY = 0;
        currentY = 0;
    }
    
    /**
     * Update indicator state
     */
    function updateIndicator(distance) {
        const indicator = document.getElementById('pullRefreshIndicator');
        const spinner = indicator?.querySelector('.pull-refresh-spinner');
        const text = indicator?.querySelector('.pull-refresh-text');
        
        if (!indicator) return;
        
        indicator.classList.add('visible');
        
        // Rotate spinner based on pull distance
        const rotation = Math.min(distance * 3, 360);
        if (spinner) {
            spinner.style.transform = `rotate(${rotation}deg)`;
        }
        
        // Update text
        if (text) {
            text.textContent = distance >= PULL_THRESHOLD 
                ? 'Release to refresh' 
                : 'Pull to refresh';
        }
        
        // Scale indicator
        const scale = Math.min(distance / PULL_THRESHOLD, 1);
        indicator.style.transform = `translateY(${Math.min(distance, PULL_THRESHOLD)}px) scale(${0.8 + scale * 0.2})`;
        indicator.style.opacity = Math.min(scale, 1);
    }
    
    /**
     * Hide indicator
     */
    function hideIndicator() {
        const indicator = document.getElementById('pullRefreshIndicator');
        
        if (!indicator) return;
        
        indicator.style.transform = '';
        indicator.style.opacity = '';
        
        setTimeout(() => {
            indicator.classList.remove('visible');
            indicator.classList.remove('refreshing');
        }, 200);
    }
    
    /**
     * Trigger refresh
     */
    async function triggerRefresh() {
        if (isRefreshing) return;
        
        isRefreshing = true;
        
        const indicator = document.getElementById('pullRefreshIndicator');
        const text = indicator?.querySelector('.pull-refresh-text');
        
        if (indicator) {
            indicator.classList.add('refreshing');
            indicator.style.transform = 'translateY(60px)';
        }
        
        if (text) {
            text.textContent = 'Refreshing...';
        }
        
        try {
            // Trigger the main refresh
            await DataModule.refresh();
            await Promise.all([
                BobStatusModule.refresh(),
                CostsModule?.refresh?.(),
                ActivityModule?.refresh?.(),
                KanbanModule?.refresh?.()
            ]);
            
            // Show success
            if (text) {
                text.textContent = 'Updated!';
            }
            
            // Brief delay to show success
            await new Promise(r => setTimeout(r, 500));
            
        } catch (error) {
            console.error('Pull refresh error:', error);
            
            if (text) {
                text.textContent = 'Refresh failed';
            }
            
            await new Promise(r => setTimeout(r, 1000));
        }
        
        hideIndicator();
        isRefreshing = false;
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Expose for debugging
    window.PullRefresh = {
        trigger: triggerRefresh
    };
})();
