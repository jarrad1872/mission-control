/**
 * Search Module - Full-text search across all indexed files
 */

const SearchModule = (function() {
    let searchIndex = [];
    let searchTimeout = null;
    let listenersBound = false;
    const DEBOUNCE_MS = 200;

    /**
     * Initialize the search module
     */
    async function init() {
        await loadSearchIndexData();
        setupListeners();
    }
    
    async function loadSearchIndexData() {
        const data = await DataModule.loadSearchIndex();
        searchIndex = data?.files || [];
    }

    /**
     * Set up event listeners
     */
    function setupListeners() {
        if (listenersBound) return;
        const searchInput = document.getElementById('searchInput');
        const filterCheckboxes = document.querySelectorAll('.filter-checkbox input');
        
        // Quick search modal elements
        const quickSearchTrigger = document.getElementById('quickSearchTrigger');
        const quickSearchModal = document.getElementById('quickSearchModal');
        const quickSearchInput = document.getElementById('quickSearchInput');
        const quickSearchBackdrop = quickSearchModal?.querySelector('.quick-search-backdrop');

        if (searchInput) {
            searchInput.addEventListener('input', handleSearchInput);
        }
        
        // Quick search modal handlers
        if (quickSearchTrigger && quickSearchModal) {
            quickSearchTrigger.addEventListener('click', openQuickSearch);
            quickSearchBackdrop?.addEventListener('click', closeQuickSearch);
        }
        
        if (quickSearchInput) {
            quickSearchInput.addEventListener('input', handleQuickSearchInput);
        }
        
        // Keyboard shortcut (Cmd/Ctrl + K) - now opens quick search modal
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                openQuickSearch();
            }
            
            // ESC to close quick search
            if (e.key === 'Escape' && quickSearchModal?.classList.contains('open')) {
                closeQuickSearch();
            }
        });

        filterCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                if (searchInput && searchInput.value) {
                    performSearch(searchInput.value);
                }
            });
        });
        
        listenersBound = true;
    }
    
    /**
     * Open quick search modal
     */
    function openQuickSearch() {
        const modal = document.getElementById('quickSearchModal');
        const input = document.getElementById('quickSearchInput');
        
        if (modal) {
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
        
        if (input) {
            input.value = '';
            input.focus();
            renderQuickSearchPlaceholder();
        }
    }
    
    /**
     * Close quick search modal
     */
    function closeQuickSearch() {
        const modal = document.getElementById('quickSearchModal');
        
        if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
    }
    
    /**
     * Handle quick search input
     */
    function handleQuickSearchInput(e) {
        const query = e.target.value.trim();
        
        clearTimeout(searchTimeout);
        
        if (!query) {
            renderQuickSearchPlaceholder();
            return;
        }
        
        searchTimeout = setTimeout(() => {
            const results = searchFiles(query);
            renderQuickSearchResults(query, results);
        }, DEBOUNCE_MS);
    }
    
    /**
     * Render quick search placeholder
     */
    function renderQuickSearchPlaceholder() {
        const container = document.getElementById('quickSearchResults');
        if (!container) return;
        
        container.innerHTML = `
            <div class="quick-search-empty">
                <span class="quick-search-empty-icon">🔍</span>
                <p>Search across tasks, activity, memory & sessions</p>
            </div>
        `;
    }
    
    /**
     * Render quick search results grouped by type
     */
    function renderQuickSearchResults(query, results) {
        const container = document.getElementById('quickSearchResults');
        if (!container) return;
        
        if (results.length === 0) {
            container.innerHTML = `
                <div class="quick-search-empty">
                    <span class="quick-search-empty-icon">😕</span>
                    <p>No results for "<strong>${Utils.escapeHtml(query)}</strong>"</p>
                </div>
            `;
            return;
        }
        
        // Group results by category
        const grouped = {};
        results.forEach(result => {
            const cat = result.category || 'other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(result);
        });
        
        const categoryLabels = {
            memory: '🧠 Memory',
            tasks: '✅ Tasks',
            docs: '📚 Docs',
            root: '📄 Files'
        };
        
        let html = '';
        Object.entries(grouped).forEach(([category, items]) => {
            const label = categoryLabels[category] || category;
            html += `
                <div class="quick-search-group">
                    <div class="quick-search-group-label">${label}</div>
                    ${items.slice(0, 5).map(item => `
                        <div class="quick-search-item" data-path="${Utils.escapeHtml(item.path)}">
                            <span class="quick-search-item-icon">${getCategoryIcon(item.category)}</span>
                            <div class="quick-search-item-content">
                                <div class="quick-search-item-title">${Utils.escapeHtml(item.title || item.path.split('/').pop())}</div>
                                <div class="quick-search-item-path">${Utils.escapeHtml(item.path)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Add click handlers
        container.querySelectorAll('.quick-search-item').forEach(el => {
            el.addEventListener('click', () => {
                const path = el.dataset.path;
                closeQuickSearch();
                showFileContent(path);
            });
        });
    }

    /**
     * Handle search input with debounce
     */
    function handleSearchInput(e) {
        const query = e.target.value.trim();
        
        clearTimeout(searchTimeout);
        
        if (!query) {
            showPlaceholder();
            return;
        }

        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, DEBOUNCE_MS);
    }

    /**
     * Perform the search
     */
    function performSearch(query) {
        const results = searchFiles(query);
        renderResults(query, results);
    }

    /**
     * Search through indexed files
     */
    function searchFiles(query) {
        const queryLower = query.toLowerCase();
        const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 0);
        const activeFilters = getActiveFilters();

        const scoredResults = searchIndex
            .filter(file => {
                // Apply category filter
                if (!activeFilters.includes(file.category)) {
                    return false;
                }
                return true;
            })
            .map(file => {
                const content = (file.content || '').toLowerCase();
                const title = (file.title || file.path).toLowerCase();
                
                let score = 0;
                let matchedTerms = 0;
                let matchPositions = [];

                queryTerms.forEach(term => {
                    // Title match (higher weight)
                    if (title.includes(term)) {
                        score += 10;
                        matchedTerms++;
                    }
                    
                    // Content match
                    let idx = content.indexOf(term);
                    if (idx !== -1) {
                        score += 5;
                        matchedTerms++;
                        matchPositions.push(idx);
                        
                        // Count occurrences
                        let count = 0;
                        let searchIdx = 0;
                        while ((searchIdx = content.indexOf(term, searchIdx)) !== -1) {
                            count++;
                            searchIdx += term.length;
                        }
                        score += Math.min(count, 5); // Cap at 5 extra points
                    }
                });

                // Only include if all terms matched somewhere
                if (matchedTerms < queryTerms.length) {
                    return null;
                }

                // Extract snippet around first match
                const snippet = extractSnippet(file.content || '', queryTerms[0], 150);

                return {
                    ...file,
                    score,
                    snippet,
                    matchPositions
                };
            })
            .filter(result => result !== null)
            .sort((a, b) => b.score - a.score)
            .slice(0, 50); // Limit to 50 results

        return scoredResults;
    }

    /**
     * Get active filter categories
     */
    function getActiveFilters() {
        const checkboxes = document.querySelectorAll('.filter-checkbox input:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    /**
     * Extract a snippet around the search term
     */
    function extractSnippet(content, term, maxLength) {
        const termLower = term.toLowerCase();
        const contentLower = content.toLowerCase();
        const idx = contentLower.indexOf(termLower);
        
        if (idx === -1) {
            return content.slice(0, maxLength) + (content.length > maxLength ? '...' : '');
        }

        const start = Math.max(0, idx - 60);
        const end = Math.min(content.length, idx + term.length + maxLength - 60);
        
        let snippet = content.slice(start, end);
        
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';
        
        return snippet;
    }

    /**
     * Render search results
     */
    function renderResults(query, results) {
        const container = document.getElementById('searchResults');
        if (!container) return;

        if (results.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <div class="no-results-emoji">🔍</div>
                    <p>No results found for "<strong>${Utils.escapeHtml(query)}</strong>"</p>
                    <p>Try different keywords or check your filters</p>
                </div>
            `;
            return;
        }

        const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);

        let html = `
            <div class="result-count">
                Found <strong>${results.length}</strong> result${results.length !== 1 ? 's' : ''} for "<strong>${Utils.escapeHtml(query)}</strong>"
            </div>
        `;

        results.forEach(result => {
            const highlightedSnippet = highlightTerms(result.snippet, queryTerms);
            
            html += `
                <div class="search-result" data-path="${Utils.escapeHtml(result.path)}">
                    <div class="result-header">
                        <span class="result-path">${Utils.escapeHtml(result.path)}</span>
                        <span class="result-score">${getCategoryIcon(result.category)} ${result.category}</span>
                    </div>
                    <div class="result-snippet">${highlightedSnippet}</div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Add click handlers
        container.querySelectorAll('.search-result').forEach(el => {
            el.addEventListener('click', () => {
                const path = el.dataset.path;
                showFileContent(path);
            });
        });
    }

    /**
     * Highlight search terms in text
     */
    function highlightTerms(text, terms) {
        let result = Utils.escapeHtml(text);
        
        terms.forEach(term => {
            const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
            result = result.replace(regex, '<mark>$1</mark>');
        });
        
        return result;
    }

    /**
     * Escape regex special characters
     */
    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Get category icon
     */
    function getCategoryIcon(category) {
        const icons = {
            memory: '🧠',
            tasks: '✅',
            docs: '📚',
            root: '📄'
        };
        return icons[category] || '📋';
    }

    /**
     * Show full file content in modal
     */
    function showFileContent(path) {
        const file = searchIndex.find(f => f.path === path);
        if (!file) return;

        const modal = document.getElementById('resultModal');
        const title = document.getElementById('modalTitle');
        const content = document.getElementById('modalContent');
        const closeBtn = document.getElementById('closeModal');
        const backdrop = modal.querySelector('.modal-backdrop');

        if (!modal || !title || !content) return;

        title.textContent = path;
        content.textContent = file.content || 'No content available';
        
        modal.classList.add('open');

        // Close handlers
        const closeModal = () => modal.classList.remove('open');
        closeBtn.addEventListener('click', closeModal, { once: true });
        backdrop.addEventListener('click', closeModal, { once: true });
        
        // ESC key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    /**
     * Show placeholder when no search query
     */
    function showPlaceholder() {
        const container = document.getElementById('searchResults');
        if (!container) return;

        container.innerHTML = `
            <div class="search-placeholder">
                <span class="placeholder-emoji">🔍</span>
                <p>Start typing to search across all files</p>
                <p class="placeholder-hint">Searches memory/, tasks/, docs/, and root markdown files</p>
            </div>
        `;
    }

    /**
     * Refresh search index
     */
    async function refresh() {
        await loadSearchIndexData();
        // Re-run current search if any
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value) {
            performSearch(searchInput.value);
        }
    }

    /**
     * Clear search
     */
    function clear() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        showPlaceholder();
    }

    return {
        init,
        refresh,
        clear,
        performSearch,
        openQuickSearch,
        closeQuickSearch
    };
})();

// Export for use in main.js
window.SearchModule = SearchModule;
