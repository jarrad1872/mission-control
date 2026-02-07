#!/usr/bin/env node
/**
 * Mission Control Data Generator
 * Parses daily notes, git commits, tasks, and builds search index
 * 
 * Usage: node build.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CLAWD_ROOT = process.env.CLAWD_ROOT || '/home/node/clawd';
const DATA_DIR = path.join(__dirname, 'data');
const GENERATED = new Date().toISOString();

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

console.log('🎯 Mission Control Build Script');
console.log(`   Generated: ${GENERATED}`);
console.log('');

/**
 * Parse git commits
 */
function getGitCommits(limit = 100) {
    const items = [];
    try {
        const output = execSync(
            `cd "${CLAWD_ROOT}" && git log --pretty=format:"%h|%ai|%s" -${limit}`,
            { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
        );
        
        output.split('\n').forEach((line, idx) => {
            const [hash, date, ...messageParts] = line.split('|');
            if (hash && date) {
                items.push({
                    id: `commit-${idx}`,
                    type: 'commit',
                    timestamp: new Date(date).toISOString(),
                    title: messageParts.join('|').trim(),
                    source: 'git',
                    hash: hash
                });
            }
        });
    } catch (e) {
        console.error('   ⚠️ Could not parse git commits:', e.message);
    }
    return items;
}

/**
 * Parse daily notes for events
 */
function getDailyNoteEvents() {
    const items = [];
    const memoryDir = path.join(CLAWD_ROOT, 'memory');
    let eventId = 0;
    
    try {
        const files = fs.readdirSync(memoryDir)
            .filter(f => /^20\d{2}-\d{2}-\d{2}\.md$/.test(f));
        
        files.forEach(filename => {
            const baseDate = filename.replace('.md', '');
            const filePath = path.join(memoryDir, filename);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Match ## HH:MM UTC — Title patterns
            const regex = /^##\s+(\d{2}:\d{2})\s*(?:UTC)?\s*—\s*(.+)$/gm;
            let match;
            
            while ((match = regex.exec(content)) !== null) {
                const time = match[1];
                const title = match[2].trim();
                const timestamp = `${baseDate}T${time}:00Z`;
                
                // Determine event type
                let eventType = 'event';
                if (/arena/i.test(title)) {
                    eventType = 'arena';
                } else if (/heartbeat/i.test(title)) {
                    eventType = 'heartbeat';
                }
                
                items.push({
                    id: `event-${eventId++}`,
                    type: eventType,
                    timestamp: timestamp,
                    title: title,
                    source: 'daily',
                    file: filename
                });
            }
        });
    } catch (e) {
        console.error('   ⚠️ Could not parse daily notes:', e.message);
    }
    
    return items;
}

/**
 * Parse completed tasks
 */
function getCompletedTasks() {
    const items = [];
    const completedDir = path.join(CLAWD_ROOT, 'tasks', 'completed');
    let taskId = 0;
    
    try {
        if (!fs.existsSync(completedDir)) return items;
        
        const files = fs.readdirSync(completedDir)
            .filter(f => f.endsWith('.md'));
        
        files.forEach(filename => {
            const filePath = path.join(completedDir, filename);
            const content = fs.readFileSync(filePath, 'utf8');
            const stats = fs.statSync(filePath);
            
            // Get title from first # heading
            const titleMatch = content.match(/^#\s+(.+)$/m);
            const title = titleMatch ? titleMatch[1].replace(/^Task:\s*/i, '') : filename.replace('.md', '');
            
            items.push({
                id: `task-${taskId++}`,
                type: 'task',
                timestamp: stats.mtime.toISOString(),
                title: title,
                source: 'task',
                file: filename
            });
        });
    } catch (e) {
        console.error('   ⚠️ Could not parse completed tasks:', e.message);
    }
    
    return items;
}

/**
 * Generate activity.json
 */
function generateActivity() {
    console.log('📋 Generating activity feed...');
    
    console.log('   - Parsing git commits...');
    const commits = getGitCommits();
    
    console.log('   - Parsing daily notes...');
    const events = getDailyNoteEvents();
    
    console.log('   - Parsing completed tasks...');
    const tasks = getCompletedTasks();
    
    // Combine and sort by timestamp descending
    const allItems = [...commits, ...events, ...tasks]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const data = {
        generated: GENERATED,
        items: allItems
    };
    
    fs.writeFileSync(
        path.join(DATA_DIR, 'activity.json'),
        JSON.stringify(data, null, 2)
    );
    
    console.log(`   ✅ activity.json generated (${allItems.length} items)`);
    return data;
}

/**
 * Generate calendar.json
 */
function generateCalendar() {
    console.log('📅 Generating calendar...');
    
    const events = [
        // Recurring events
        {
            id: 'recurring-1',
            title: 'Bob Collective Arena',
            time: '03:00',
            recurring: 'daily',
            type: 'recurring',
            source: 'system',
            description: 'Nightly coordination session for the Bob Collective'
        },
        {
            id: 'recurring-2',
            title: 'Heartbeat Check',
            time: '09:00',
            recurring: 'daily',
            type: 'recurring',
            source: 'system',
            description: 'Morning heartbeat - check email, calendar, notifications'
        },
        {
            id: 'recurring-3',
            title: 'Heartbeat Check',
            time: '15:00',
            recurring: 'daily',
            type: 'recurring',
            source: 'system',
            description: 'Afternoon heartbeat - check for updates'
        },
        {
            id: 'recurring-4',
            title: 'Heartbeat Check',
            time: '21:00',
            recurring: 'daily',
            type: 'recurring',
            source: 'system',
            description: 'Evening heartbeat - wrap up, prepare for next day'
        },
        {
            id: 'recurring-5',
            title: 'Daily Standup',
            time: '23:00',
            recurring: 'daily',
            type: 'recurring',
            source: 'system',
            description: 'Daily standup summary posted to Topic 1'
        },
        {
            id: 'recurring-6',
            title: 'CFO Weekly Report',
            time: '00:00',
            recurring: 'weekly',
            dayOfWeek: 5, // Friday
            type: 'recurring',
            source: 'system',
            description: 'Weekly financial report generation'
        }
    ];
    
    // Parse task deadlines
    const tasksDir = path.join(CLAWD_ROOT, 'tasks');
    let deadlineId = 0;
    
    try {
        const files = fs.readdirSync(tasksDir)
            .filter(f => f.startsWith('task-') && f.endsWith('.md'));
        
        files.forEach(filename => {
            const filePath = path.join(tasksDir, filename);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Get title
            const titleMatch = content.match(/^#\s+(.+)$/m);
            const title = titleMatch ? titleMatch[1].replace(/^Task:\s*/i, '') : filename;
            
            // Look for Due: or Deadline: lines
            const deadlineMatch = content.match(/^\*?\*?(?:due|deadline)\*?\*?:\s*(.+)$/im);
            
            if (deadlineMatch) {
                const deadlineStr = deadlineMatch[1].trim();
                try {
                    const date = new Date(deadlineStr);
                    if (!isNaN(date.getTime())) {
                        events.push({
                            id: `deadline-${deadlineId++}`,
                            title: `📌 ${title}`,
                            date: date.toISOString().split('T')[0],
                            type: 'task-deadline',
                            source: 'tasks',
                            file: filename
                        });
                    }
                } catch (e) {
                    // Ignore unparseable dates
                }
            }
        });
    } catch (e) {
        console.error('   ⚠️ Could not parse task deadlines:', e.message);
    }
    
    const data = {
        generated: GENERATED,
        events: events
    };
    
    fs.writeFileSync(
        path.join(DATA_DIR, 'calendar.json'),
        JSON.stringify(data, null, 2)
    );
    
    console.log(`   ✅ calendar.json generated (${events.length} events)`);
    return data;
}

/**
 * Generate search-index.json
 */
function generateSearchIndex() {
    console.log('🔍 Generating search index...');
    
    const files = [];
    
    // Index memory files
    console.log('   - Indexing memory/*.md...');
    const memoryDir = path.join(CLAWD_ROOT, 'memory');
    try {
        fs.readdirSync(memoryDir)
            .filter(f => f.endsWith('.md'))
            .forEach(filename => {
                const filePath = path.join(memoryDir, filename);
                const content = fs.readFileSync(filePath, 'utf8').slice(0, 50000);
                files.push({
                    path: `memory/${filename}`,
                    title: filename.replace('.md', ''),
                    content: content,
                    category: 'memory'
                });
            });
    } catch (e) {
        console.error('   ⚠️ Could not index memory:', e.message);
    }
    
    // Index active tasks
    console.log('   - Indexing tasks/*.md...');
    const tasksDir = path.join(CLAWD_ROOT, 'tasks');
    try {
        fs.readdirSync(tasksDir)
            .filter(f => f.endsWith('.md'))
            .forEach(filename => {
                const filePath = path.join(tasksDir, filename);
                if (fs.statSync(filePath).isFile()) {
                    const content = fs.readFileSync(filePath, 'utf8').slice(0, 50000);
                    files.push({
                        path: `tasks/${filename}`,
                        title: filename.replace('.md', ''),
                        content: content,
                        category: 'tasks'
                    });
                }
            });
    } catch (e) {
        console.error('   ⚠️ Could not index tasks:', e.message);
    }
    
    // Index completed tasks
    console.log('   - Indexing tasks/completed/*.md...');
    const completedDir = path.join(CLAWD_ROOT, 'tasks', 'completed');
    try {
        if (fs.existsSync(completedDir)) {
            fs.readdirSync(completedDir)
                .filter(f => f.endsWith('.md'))
                .forEach(filename => {
                    const filePath = path.join(completedDir, filename);
                    const content = fs.readFileSync(filePath, 'utf8').slice(0, 50000);
                    files.push({
                        path: `tasks/completed/${filename}`,
                        title: filename.replace('.md', ''),
                        content: content,
                        category: 'tasks'
                    });
                });
        }
    } catch (e) {
        console.error('   ⚠️ Could not index completed tasks:', e.message);
    }
    
    // Index docs
    console.log('   - Indexing docs/*.md...');
    const docsDir = path.join(CLAWD_ROOT, 'docs');
    try {
        if (fs.existsSync(docsDir)) {
            fs.readdirSync(docsDir)
                .filter(f => f.endsWith('.md'))
                .forEach(filename => {
                    const filePath = path.join(docsDir, filename);
                    if (fs.statSync(filePath).isFile()) {
                        const content = fs.readFileSync(filePath, 'utf8').slice(0, 50000);
                        files.push({
                            path: `docs/${filename}`,
                            title: filename.replace('.md', ''),
                            content: content,
                            category: 'docs'
                        });
                    }
                });
        }
    } catch (e) {
        // docs directory might not exist
    }
    
    // Index root markdown files
    console.log('   - Indexing root *.md files...');
    try {
        fs.readdirSync(CLAWD_ROOT)
            .filter(f => f.endsWith('.md'))
            .forEach(filename => {
                const filePath = path.join(CLAWD_ROOT, filename);
                if (fs.statSync(filePath).isFile()) {
                    const content = fs.readFileSync(filePath, 'utf8').slice(0, 50000);
                    files.push({
                        path: filename,
                        title: filename.replace('.md', ''),
                        content: content,
                        category: 'root'
                    });
                }
            });
    } catch (e) {
        console.error('   ⚠️ Could not index root files:', e.message);
    }
    
    const data = {
        generated: GENERATED,
        files: files
    };
    
    fs.writeFileSync(
        path.join(DATA_DIR, 'search-index.json'),
        JSON.stringify(data, null, 2)
    );
    
    console.log(`   ✅ search-index.json generated (${files.length} files indexed)`);
    return data;
}

/**
 * Generate bob-status.json
 * TODO: In future, call sessions_list API to get real status
 */
function generateBobStatus() {
    console.log('👥 Generating Bob status...');
    
    const now = new Date().toISOString();
    
    // Bob Collective configuration - update when adding/removing Bobs
    const bobConfigs = [
        { id: 'main', name: 'Main Bob', emoji: '🎯', channel: 'telegram', description: 'Primary orchestrator' },
        { id: 'kcc', name: 'KCC Bob', emoji: '🏗️', channel: 'telegram', description: 'Kippen Concrete & Construction' },
        { id: 'dmi', name: 'DMI Bob', emoji: '🔧', channel: 'telegram', description: 'DMI Tools Corp' },
        { id: 'personal', name: 'Personal Bob', emoji: '🏠', channel: 'whatsapp', description: 'Personal assistant' },
        { id: 'sawdot', name: 'SawDot Bob', emoji: '🪚', channel: 'telegram', description: 'SawDot operations' },
        { id: 'mrbex', name: 'MrBex Bob', emoji: '🎬', channel: 'telegram', description: 'MrBex content' }
    ];
    
    // TODO: Replace mock data with real session data from API
    // For now, generate plausible mock status
    const bobs = bobConfigs.map(config => {
        // Randomize status for demo
        const statuses = ['idle', 'idle', 'idle', 'active', 'active'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        // Generate recent-ish last activity
        const hoursAgo = Math.floor(Math.random() * 24);
        const lastActivity = new Date(Date.now() - hoursAgo * 3600000).toISOString();
        
        // Random context percentage
        const contextPercent = status === 'active' 
            ? Math.floor(Math.random() * 60) + 20  // 20-80% if active
            : Math.floor(Math.random() * 30);       // 0-30% if idle
        
        return {
            ...config,
            status,
            lastActivity,
            contextPercent
        };
    });
    
    const data = {
        generated: now,
        lastUpdate: now,
        bobs
    };
    
    fs.writeFileSync(
        path.join(DATA_DIR, 'bob-status.json'),
        JSON.stringify(data, null, 2)
    );
    
    console.log(`   ✅ bob-status.json generated (${bobs.length} Bobs)`);
    return data;
}

/**
 * Generate costs.json from metrics data
 */
function generateCosts() {
    console.log('💰 Generating cost data...');
    
    const metricsDir = path.join(CLAWD_ROOT, 'metrics');
    const today = new Date().toISOString().split('T')[0];
    
    // Model pricing (per 1M tokens) - approximate rates
    const MODEL_PRICING = {
        'claude-opus-4-5': { input: 15.00, output: 75.00, cacheRead: 1.50 },
        'claude-sonnet-4-5': { input: 3.00, output: 15.00, cacheRead: 0.30 },
        'claude-3-5-sonnet': { input: 3.00, output: 15.00, cacheRead: 0.30 },
        'claude-3-5-haiku': { input: 0.80, output: 4.00, cacheRead: 0.08 },
        'kimi-k2.5': { input: 0.60, output: 2.40, cacheRead: 0.06 },
        'gpt-4o': { input: 5.00, output: 15.00, cacheRead: 2.50 },
        'gemini-2.0-flash': { input: 0.10, output: 0.40, cacheRead: 0.025 }
    };
    
    // Read all metrics files
    let allDays = [];
    try {
        const files = fs.readdirSync(metricsDir)
            .filter(f => /^20\d{2}-\d{2}-\d{2}\.json$/.test(f))
            .sort()
            .slice(-7); // Last 7 days
        
        files.forEach(filename => {
            const filePath = path.join(metricsDir, filename);
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const data = JSON.parse(content);
                const date = filename.replace('.json', '');
                
                // Extract activity metrics for cost estimation
                const heartbeats = data.bobCollective?.heartbeatsProcessed || 0;
                const agentsSpawned = data.swarms?.agentsSpawned || 0;
                const arenaSessions = data.arena?.sessionsRun || 0;
                const searches = data.memory?.searchesPerformed || 0;
                
                // Estimate token usage based on activity
                const estimatedInputTokens = (heartbeats * 5000) + (agentsSpawned * 20000) + (arenaSessions * 30000) + (searches * 1000);
                const estimatedOutputTokens = (heartbeats * 2000) + (agentsSpawned * 8000) + (arenaSessions * 15000) + (searches * 500);
                const estimatedCacheTokens = (heartbeats * 3000) + (agentsSpawned * 10000);
                
                // Distribute across models (estimated distribution)
                const modelDistribution = {
                    'claude-opus-4-5': 0.40,
                    'claude-sonnet-4-5': 0.35,
                    'kimi-k2.5': 0.15,
                    'gemini-2.0-flash': 0.10
                };
                
                let totalCost = 0;
                const byModel = {};
                
                Object.entries(modelDistribution).forEach(([model, ratio]) => {
                    const pricing = MODEL_PRICING[model];
                    if (pricing) {
                        const inputCost = (estimatedInputTokens * ratio / 1000000) * pricing.input;
                        const outputCost = (estimatedOutputTokens * ratio / 1000000) * pricing.output;
                        const cacheCost = (estimatedCacheTokens * ratio / 1000000) * pricing.cacheRead;
                        const modelCost = inputCost + outputCost + cacheCost;
                        byModel[model] = parseFloat(modelCost.toFixed(2));
                        totalCost += modelCost;
                    }
                });
                
                // Ensure minimum cost if there was activity
                if (totalCost === 0 && (heartbeats > 0 || agentsSpawned > 0)) {
                    totalCost = 0.10;
                    byModel['claude-sonnet-4-5'] = 0.10;
                }
                
                allDays.push({
                    date: date,
                    cost: parseFloat(totalCost.toFixed(2)),
                    tokens: {
                        input: estimatedInputTokens,
                        output: estimatedOutputTokens,
                        cacheRead: estimatedCacheTokens
                    },
                    byModel: byModel
                });
            } catch (e) {
                console.error(`   ⚠️ Could not parse ${filename}:`, e.message);
            }
        });
    } catch (e) {
        console.error('   ⚠️ Could not read metrics directory:', e.message);
    }
    
    // Get today's data
    const todayData = allDays.find(d => d.date === today) || {
        date: today,
        cost: 0,
        tokens: { input: 0, output: 0, cacheRead: 0 },
        byModel: {}
    };
    
    // Calculate weekly totals
    const weekTotal = allDays.reduce((sum, d) => sum + d.cost, 0);
    const weekByModel = {};
    allDays.forEach(day => {
        Object.entries(day.byModel || {}).forEach(([model, cost]) => {
            weekByModel[model] = (weekByModel[model] || 0) + cost;
        });
    });
    Object.keys(weekByModel).forEach(model => {
        weekByModel[model] = parseFloat(weekByModel[model].toFixed(2));
    });
    
    const data = {
        lastUpdate: GENERATED,
        today: {
            totalCost: todayData.cost,
            tokens: todayData.tokens,
            byModel: todayData.byModel
        },
        week: {
            totalCost: parseFloat(weekTotal.toFixed(2)),
            days: allDays.map(d => ({ date: d.date, cost: d.cost })),
            byModel: weekByModel
        }
    };
    
    fs.writeFileSync(
        path.join(DATA_DIR, 'costs.json'),
        JSON.stringify(data, null, 2)
    );
    
    console.log(`   ✅ costs.json generated (${allDays.length} days, $${weekTotal.toFixed(2)} weekly)`);
    return data;
}

// Run all generators
console.log('');
generateBobStatus();
console.log('');
generateActivity();
console.log('');
generateCalendar();
console.log('');
generateCosts();
console.log('');
generateSearchIndex();
console.log('');

// Summary
console.log('✅ Build complete!');
console.log(`   Data directory: ${DATA_DIR}`);
console.log(`   Generated at: ${GENERATED}`);
console.log('');
console.log('   Files:');
fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .forEach(f => {
        const stats = fs.statSync(path.join(DATA_DIR, f));
        console.log(`   - ${f} (${(stats.size / 1024).toFixed(1)} KB)`);
    });
