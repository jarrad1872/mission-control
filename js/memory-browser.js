/**
 * Memory Browser Module
 * Visual explorer for the knowledge graph (/life/areas/)
 */

const MemoryBrowser = (function() {
    let memoryData = null;
    let selectedEntity = null;
    let searchQuery = '';
    
    // Category icons and colors
    const CATEGORY_CONFIG = {
        people: { icon: '👤', color: '#e94560', label: 'People' },
        companies: { icon: '🏢', color: '#4ecdc4', label: 'Companies' },
        projects: { icon: '📁', color: '#a855f7', label: 'Projects' }
    };
    
    /**
     * Initialize the memory browser
     */
    async function init() {
        console.log('🧠 Initializing Memory Browser...');
        
        await loadMemoryData();
        render();
        bindEvents();
        
        console.log('✅ Memory Browser initialized');
    }
    
    /**
     * Load memory tree data
     */
    async function loadMemoryData() {
        try {
            const response = await fetch('data/memory-tree.json?t=' + Date.now());
            if (!response.ok) throw new Error('Failed to load memory data');
            memoryData = await response.json();
        } catch (error) {
            console.error('Memory Browser: Could not load data', error);
            memoryData = { tree: {}, generated: null };
        }
    }
    
    /**
     * Render the memory browser UI
     */
    function render() {
        const container = document.getElementById('memory-tab');
        if (!container) return;
        
        container.innerHTML = `
            <div class="memory-browser">
                <div class="memory-sidebar">
                    <div class="memory-search-container">
                        <div class="memory-search-box">
                            <svg class="search-icon" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/>
                            </svg>
                            <input type="text" id="memorySearchInput" placeholder="Search memory..." autocomplete="off">
                        </div>
                    </div>
                    <div class="memory-tree" id="memoryTree">
                        ${renderTree()}
                    </div>
                </div>
                <div class="memory-content">
                    <div class="memory-content-header" id="memoryContentHeader">
                        <span class="placeholder-text">Select an entity to view details</span>
                    </div>
                    <div class="memory-content-body" id="memoryContentBody">
                        <div class="memory-placeholder">
                            <span class="placeholder-emoji">🧠</span>
                            <p>Knowledge Graph Explorer</p>
                            <p class="placeholder-hint">Browse people, companies, and projects from the memory system</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render the tree structure
     */
    function renderTree() {
        if (!memoryData || !memoryData.tree) {
            return '<div class="memory-empty">No memory data available</div>';
        }
        
        const tree = memoryData.tree;
        let html = '';
        
        // Render each category
        Object.entries(CATEGORY_CONFIG).forEach(([category, config]) => {
            const entities = tree[category] || {};
            const entityCount = Object.keys(entities).length;
            const matchingEntities = filterEntities(entities, searchQuery);
            
            // Skip category if no matches and we're searching
            if (searchQuery && Object.keys(matchingEntities).length === 0) return;
            
            html += `
                <div class="tree-category" data-category="${category}">
                    <div class="tree-category-header" onclick="MemoryBrowser.toggleCategory('${category}')">
                        <span class="tree-toggle">▶</span>
                        <span class="tree-icon">${config.icon}</span>
                        <span class="tree-label">${config.label}</span>
                        <span class="tree-count">${entityCount}</span>
                    </div>
                    <div class="tree-category-items" style="display: none;">
                        ${renderEntities(category, searchQuery ? matchingEntities : entities)}
                    </div>
                </div>
            `;
        });
        
        return html || '<div class="memory-empty">No results found</div>';
    }
    
    /**
     * Filter entities by search query
     */
    function filterEntities(entities, query) {
        if (!query) return entities;
        
        const filtered = {};
        const lowerQuery = query.toLowerCase();
        
        Object.entries(entities).forEach(([key, entity]) => {
            const matchesKey = key.toLowerCase().includes(lowerQuery);
            const matchesSummary = entity.summary && entity.summary.toLowerCase().includes(lowerQuery);
            
            if (matchesKey || matchesSummary) {
                filtered[key] = entity;
            }
        });
        
        return filtered;
    }
    
    /**
     * Render entity items within a category
     */
    function renderEntities(category, entities) {
        if (!entities || Object.keys(entities).length === 0) {
            return '<div class="tree-empty">No entities</div>';
        }
        
        return Object.entries(entities).map(([key, entity]) => {
            const config = CATEGORY_CONFIG[category];
            const factCount = entity.factCount || 0;
            const isSelected = selectedEntity === `${category}/${key}`;
            
            // Highlight search matches
            let displayName = formatEntityName(key);
            if (searchQuery) {
                const regex = new RegExp(`(${escapeRegex(searchQuery)})`, 'gi');
                displayName = displayName.replace(regex, '<mark>$1</mark>');
            }
            
            return `
                <div class="tree-entity ${isSelected ? 'selected' : ''}" 
                     data-path="${category}/${key}"
                     onclick="MemoryBrowser.selectEntity('${category}', '${key}')">
                    <div class="entity-info">
                        <span class="entity-name">${displayName}</span>
                        <span class="entity-preview">${truncate(entity.summary, 50)}</span>
                    </div>
                    <span class="entity-facts" title="${factCount} facts">${factCount}</span>
                </div>
            `;
        }).join('');
    }
    
    /**
     * Toggle category expand/collapse
     */
    function toggleCategory(category) {
        const categoryEl = document.querySelector(`.tree-category[data-category="${category}"]`);
        if (!categoryEl) return;
        
        const items = categoryEl.querySelector('.tree-category-items');
        const toggle = categoryEl.querySelector('.tree-toggle');
        
        if (items.style.display === 'none') {
            items.style.display = 'block';
            toggle.textContent = '▼';
            categoryEl.classList.add('expanded');
        } else {
            items.style.display = 'none';
            toggle.textContent = '▶';
            categoryEl.classList.remove('expanded');
        }
    }
    
    /**
     * Select and display an entity
     */
    async function selectEntity(category, key) {
        selectedEntity = `${category}/${key}`;
        
        // Update tree selection
        document.querySelectorAll('.tree-entity').forEach(el => {
            el.classList.toggle('selected', el.dataset.path === selectedEntity);
        });
        
        const entity = memoryData.tree[category]?.[key];
        if (!entity) return;
        
        const config = CATEGORY_CONFIG[category];
        const header = document.getElementById('memoryContentHeader');
        const body = document.getElementById('memoryContentBody');
        
        // Render header
        header.innerHTML = `
            <div class="content-entity-header">
                <span class="entity-icon" style="color: ${config.color}">${config.icon}</span>
                <div class="entity-title-info">
                    <h2>${formatEntityName(key)}</h2>
                    <span class="entity-category">${config.label}</span>
                </div>
                <span class="entity-fact-badge">${entity.factCount || 0} facts</span>
            </div>
        `;
        
        // Render body with summary and facts
        body.innerHTML = `
            <div class="entity-content">
                <div class="entity-section">
                    <h3>📝 Summary</h3>
                    <div class="summary-content markdown-content">
                        ${renderMarkdown(entity.summary || 'No summary available')}
                    </div>
                </div>
                
                ${entity.facts && entity.facts.length > 0 ? `
                    <div class="entity-section">
                        <h3>📌 Facts (${entity.facts.length})</h3>
                        <div class="facts-list">
                            ${renderFacts(entity.facts)}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * Render facts list
     */
    function renderFacts(facts) {
        return facts.map(fact => {
            const categoryColor = getCategoryColor(fact.category);
            return `
                <div class="fact-item">
                    <span class="fact-category" style="background: ${categoryColor}20; color: ${categoryColor}">
                        ${fact.category || 'general'}
                    </span>
                    <span class="fact-text">${Utils.escapeHtml(fact.fact)}</span>
                    <span class="fact-date">${fact.timestamp || ''}</span>
                </div>
            `;
        }).join('');
    }
    
    /**
     * Get color for fact category
     */
    function getCategoryColor(category) {
        const colors = {
            relationship: '#e94560',
            milestone: '#a855f7',
            status: '#4ecdc4',
            preference: '#ffc107',
            general: '#6c6c7c'
        };
        return colors[category] || colors.general;
    }
    
    /**
     * Simple markdown renderer
     * Processes text line-by-line for reliable list wrapping
     */
    function renderMarkdown(text) {
        if (!text) return '';
        
        const lines = text.split('\n');
        const output = [];
        let inList = false;
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            // Headers
            if (line.match(/^### (.+)$/)) {
                if (inList) { output.push('</ul>'); inList = false; }
                output.push(line.replace(/^### (.+)$/, '<h4>$1</h4>'));
                continue;
            }
            if (line.match(/^## (.+)$/)) {
                if (inList) { output.push('</ul>'); inList = false; }
                output.push(line.replace(/^## (.+)$/, '<h3>$1</h3>'));
                continue;
            }
            if (line.match(/^# (.+)$/)) {
                if (inList) { output.push('</ul>'); inList = false; }
                output.push(line.replace(/^# (.+)$/, '<h2>$1</h2>'));
                continue;
            }
            
            // List items (unordered: - or *)
            const listMatch = line.match(/^[-*] (.+)$/);
            if (listMatch) {
                if (!inList) { output.push('<ul>'); inList = true; }
                let content = listMatch[1];
                // Inline formatting
                content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                content = content.replace(/\*(.+?)\*/g, '<em>$1</em>');
                output.push('<li>' + content + '</li>');
                continue;
            }
            
            // Empty line ends list and creates paragraph break
            if (line.trim() === '') {
                if (inList) { output.push('</ul>'); inList = false; }
                output.push('</p><p>');
                continue;
            }
            
            // Regular text line — close any open list first
            if (inList) { output.push('</ul>'); inList = false; }
            
            // Inline formatting
            line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
            output.push(line);
        }
        
        // Close any trailing open list
        if (inList) { output.push('</ul>'); }
        
        return '<p>' + output.join('\n') + '</p>';
    }
    
    /**
     * Bind event handlers
     */
    function bindEvents() {
        // Search input
        const searchInput = document.getElementById('memorySearchInput');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    searchQuery = e.target.value.trim();
                    updateTree();
                    
                    // Auto-expand categories when searching
                    if (searchQuery) {
                        document.querySelectorAll('.tree-category').forEach(cat => {
                            const items = cat.querySelector('.tree-category-items');
                            const toggle = cat.querySelector('.tree-toggle');
                            items.style.display = 'block';
                            toggle.textContent = '▼';
                            cat.classList.add('expanded');
                        });
                    }
                }, 200);
            });
        }
    }
    
    /**
     * Update tree display
     */
    function updateTree() {
        const treeContainer = document.getElementById('memoryTree');
        if (treeContainer) {
            treeContainer.innerHTML = renderTree();
        }
    }
    
    /**
     * Format entity key to display name
     */
    function formatEntityName(key) {
        return key
            .replace(/-/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    }
    
    /**
     * Truncate text
     */
    function truncate(text, length) {
        if (!text) return '';
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
    }
    
    /**
     * Escape regex special characters
     */
    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    /**
     * Refresh data
     */
    async function refresh() {
        await loadMemoryData();
        updateTree();
        if (selectedEntity) {
            const [category, key] = selectedEntity.split('/');
            selectEntity(category, key);
        }
    }
    
    // Public API
    return {
        init,
        refresh,
        toggleCategory,
        selectEntity
    };
})();

// Initialize when tab becomes active
document.addEventListener('DOMContentLoaded', () => {
    // Check if memory tab exists
    const memoryTab = document.getElementById('memory-tab');
    if (memoryTab) {
        // Initialize immediately if visible, otherwise wait for tab click
        if (memoryTab.classList.contains('active')) {
            MemoryBrowser.init();
        }
    }
});

// Export for global access
window.MemoryBrowser = MemoryBrowser;
