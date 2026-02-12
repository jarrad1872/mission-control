/**
 * Mission Control PWA Module
 * Handles service worker registration, install prompt, and offline detection
 */

const PWA = {
  deferredPrompt: null,
  isInstalled: false,
  isOnline: navigator.onLine,
  swRegistration: null,
  updateCheckTimer: null,
  isReloadingForUpdate: false,
  
  /**
   * Initialize PWA functionality
   */
  init() {
    this.registerServiceWorker();
    this.setupInstallPrompt();
    this.setupOnlineDetection();
    this.checkIfInstalled();
    this.createInstallButton();
  },
  
  /**
   * Register the service worker
   */
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.log('[PWA] Service workers not supported');
      return;
    }
    
    try {
      // Use relative path for GitHub Pages subdirectory deployment
      const swPath = './service-worker.js';
      const swScope = './';
      this.swRegistration = await navigator.serviceWorker.register(swPath, {
        scope: swScope
      });
      
      console.log('[PWA] Service worker registered:', this.swRegistration.scope);
      
      // Check for updates
      this.swRegistration.addEventListener('updatefound', () => {
        const newWorker = this.swRegistration.installing;
        if (!newWorker) return;
        console.log('[PWA] New service worker installing...');
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content available
            this.showUpdateToast();
          }
        });
      });
      
      // Periodic update check (every hour)
      this.updateCheckTimer = setInterval(() => {
        this.swRegistration?.update();
      }, 60 * 60 * 1000);
      
    } catch (error) {
      console.error('[PWA] Service worker registration failed:', error);
    }
  },
  
  /**
   * Setup the beforeinstallprompt event
   */
  setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('[PWA] Install prompt available');
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });
    
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed!');
      this.isInstalled = true;
      this.deferredPrompt = null;
      this.hideInstallButton();
      this.showToast('Mission Control installed! 🎯', 'success');
    });
  },
  
  /**
   * Setup online/offline detection
   */
  setupOnlineDetection() {
    const updateStatus = () => {
      this.isOnline = navigator.onLine;
      document.body.classList.toggle('offline', !this.isOnline);
      
      const statusDot = document.querySelector('.status-dot');
      const statusText = document.getElementById('statusText');
      
      if (statusDot && statusText) {
        if (this.isOnline) {
          statusDot.classList.remove('error');
          statusText.textContent = 'Online';
        } else {
          statusDot.classList.add('error');
          statusText.textContent = 'Offline';
        }
      }
      
      if (!this.isOnline) {
        this.showToast('You\'re offline. Some features may be limited.', 'warning');
      }
    };
    
    window.addEventListener('online', () => {
      this.showToast('Back online! 🟢', 'success');
      updateStatus();
    });
    
    window.addEventListener('offline', updateStatus);
    updateStatus();
  },
  
  /**
   * Check if app is already installed
   */
  checkIfInstalled() {
    // Check display-mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
      console.log('[PWA] Running in standalone mode (installed)');
    }
    
    // iOS Safari check
    if (navigator.standalone === true) {
      this.isInstalled = true;
      console.log('[PWA] Running as iOS home screen app');
    }
  },
  
  /**
   * Create install button in the UI
   */
  createInstallButton() {
    const headerRight = document.querySelector('.header-right');
    if (!headerRight) return;
    
    const installBtn = document.createElement('button');
    installBtn.id = 'pwaInstallBtn';
    installBtn.className = 'pwa-install-btn hidden';
    installBtn.title = 'Install Mission Control';
    installBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span class="install-text">Install</span>
    `;
    
    installBtn.addEventListener('click', () => this.promptInstall());
    
    // Insert before refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      headerRight.insertBefore(installBtn, refreshBtn);
    } else {
      headerRight.appendChild(installBtn);
    }
  },
  
  /**
   * Show the install button
   */
  showInstallButton() {
    const btn = document.getElementById('pwaInstallBtn');
    if (btn) {
      btn.classList.remove('hidden');
      btn.classList.add('visible');
    }
  },
  
  /**
   * Hide the install button
   */
  hideInstallButton() {
    const btn = document.getElementById('pwaInstallBtn');
    if (btn) {
      btn.classList.remove('visible');
      btn.classList.add('hidden');
    }
  },
  
  /**
   * Prompt user to install the PWA
   */
  async promptInstall() {
    if (!this.deferredPrompt) {
      // Show manual instructions for iOS or when no prompt
      this.showManualInstallInstructions();
      return;
    }
    
    this.deferredPrompt.prompt();
    
    const { outcome } = await this.deferredPrompt.userChoice;
    console.log('[PWA] Install prompt outcome:', outcome);
    
    this.deferredPrompt = null;
    this.hideInstallButton();
  },
  
  /**
   * Show manual install instructions (for iOS/Safari)
   */
  showManualInstallInstructions() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    let message;
    if (isIOS) {
      message = 'To install: tap the Share button, then "Add to Home Screen"';
    } else if (isSafari) {
      message = 'To install: use Chrome or click the install icon in the address bar';
    } else {
      message = 'Look for the install icon in your browser\'s address bar';
    }
    
    this.showToast(message, 'info');
  },
  
  /**
   * Show update available toast
   */
  showUpdateToast() {
    const update = confirm('A new version of Mission Control is available. Refresh now?');
    if (update) {
      this.applyUpdate();
    }
  },
  
  /**
   * Apply pending service worker update
   */
  applyUpdate() {
    if (this.isReloadingForUpdate) return;
    this.isReloadingForUpdate = true;

    const reloadOnControllerChange = () => {
      navigator.serviceWorker.removeEventListener('controllerchange', reloadOnControllerChange);
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', reloadOnControllerChange);

    if (this.swRegistration && this.swRegistration.waiting) {
      this.swRegistration.waiting.postMessage('skipWaiting');
      return;
    }

    // No waiting worker available; fallback to reload.
    window.location.reload();
  },
  
  /**
   * Show toast notification (delegates to Utils)
   */
  showToast(message, type) {
    Utils.showToast(message, type);
  },
  
  /**
   * Clear all caches (for debugging)
   */
  async clearCache() {
    if (this.swRegistration?.active) {
      this.swRegistration.active.postMessage('clearCache');
    }
    
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('[PWA] All caches cleared');
    this.showToast('Cache cleared', 'success');
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => PWA.init());
} else {
  PWA.init();
}

// Export for global access
window.PWA = PWA;
