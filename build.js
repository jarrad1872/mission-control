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
 * Clawdbot session data paths
 */
const CLAWDBOT_HOME = process.env.CLAWDBOT_HOME || '/home/node/.clawdbot';
const SESSIONS_DIR = path.join(CLAWDBOT_HOME, 'agents', 'main', 'sessions');
const SESSIONS_JSON = path.join(SESSIONS_DIR, 'sessions.json');

/**
 * Bob Collective configuration - maps session keys to Bob identities
 */
const BOB_CONFIG = {
    'agent:main:main': { id: 'main', name: 'Main Bob', emoji: '🎯', channel: 'whatsapp', description: 'Primary orchestrator' },
    'agent:main:telegram:group:-1003765361939:topic:1': { id: 'standup', name: 'Standup Bob', emoji: '📢', channel: 'telegram', description: 'Daily standup & general' },
    'agent:main:telegram:group:-1003765361939:topic:4': { id: 'kcc', name: 'KCC Bob', emoji: '🏗️', channel: 'telegram', description: 'Kippen Concrete & Construction' },
    'agent:main:telegram:group:-1003765361939:topic:5': { id: 'personal', name: 'Personal Bob', emoji: '🏠', channel: 'telegram', description: 'Personal assistant' },
    'agent:main:telegram:group:-1003765361939:topic:6': { id: 'dmi', name: 'DMI Bob', emoji: '🔧', channel: 'telegram', description: 'DMI Tools Corp' },
    'agent:main:telegram:group:-1003765361939:topic:7': { id: 'sawdot', name: 'SawDot Bob', emoji: '🪚', channel: 'telegram', description: 'SawDot operations' },
    'agent:main:telegram:group:-1003765361939:topic:8': { id: 'mrbex', name: 'MrBex Bob', emoji: '🎬', channel: 'telegram', description: 'MrBex content' }
};

/**
 * Determine Bob status based on last activity time
 */
function getBobStatus(lastActivityMs) {
    const now = Date.now();
    const diffMs = now - lastActivityMs;
    const diffMinutes = diffMs / (1000 * 60);
    
    if (diffMinutes < 5) return 'active';
    if (diffMinutes < 60) return 'idle';
    return 'offline';
}

/**
 * Generate bob-status.json from REAL session data
 */
function generateBobStatus() {
    console.log('👥 Generating Bob status from real session data...');
    
    const now = new Date().toISOString();
    const bobs = [];
    
    try {
        if (!fs.existsSync(SESSIONS_JSON)) {
            console.error('   ⚠️ Sessions file not found:', SESSIONS_JSON);
            return generateBobStatusFallback();
        }
        
        const sessionsData = JSON.parse(fs.readFileSync(SESSIONS_JSON, 'utf8'));
        
        // Process each known Bob
        Object.entries(BOB_CONFIG).forEach(([sessionKey, config]) => {
            const session = sessionsData[sessionKey];
            
            if (session) {
                const lastActivityMs = session.updatedAt || 0;
                const lastActivity = new Date(lastActivityMs).toISOString();
                const status = getBobStatus(lastActivityMs);
                
                // Calculate context usage percentage
                const totalTokens = session.totalTokens || 0;
                const contextTokens = session.contextTokens || 200000;
                const contextPercent = Math.round((totalTokens / contextTokens) * 100);
                
                bobs.push({
                    ...config,
                    status,
                    lastActivity,
                    contextPercent: Math.min(contextPercent, 100),
                    model: session.model || 'unknown',
                    totalTokens,
                    contextTokens,
                    sessionId: session.sessionId
                });
                
                console.log(`   - ${config.name}: ${status} (${contextPercent}% context, last: ${lastActivity})`);
            } else {
                // Bob exists in config but no session data
                bobs.push({
                    ...config,
                    status: 'offline',
                    lastActivity: null,
                    contextPercent: 0,
                    model: null,
                    totalTokens: 0,
                    contextTokens: 200000,
                    sessionId: null
                });
                console.log(`   - ${config.name}: no session data`);
            }
        });
        
    } catch (e) {
        console.error('   ⚠️ Error reading session data:', e.message);
        return generateBobStatusFallback();
    }
    
    const data = {
        generated: now,
        lastUpdate: now,
        source: 'real',
        bobs
    };
    
    fs.writeFileSync(
        path.join(DATA_DIR, 'bob-status.json'),
        JSON.stringify(data, null, 2)
    );
    
    console.log(`   ✅ bob-status.json generated (${bobs.length} Bobs from real data)`);
    return data;
}

/**
 * Fallback if session data unavailable
 */
function generateBobStatusFallback() {
    console.log('   ⚠️ Using fallback (no real data available)');
    const now = new Date().toISOString();
    const bobs = Object.values(BOB_CONFIG).map(config => ({
        ...config,
        status: 'unknown',
        lastActivity: null,
        contextPercent: 0,
        model: null
    }));
    
    const data = {
        generated: now,
        lastUpdate: now,
        source: 'fallback',
        bobs
    };
    
    fs.writeFileSync(
        path.join(DATA_DIR, 'bob-status.json'),
        JSON.stringify(data, null, 2)
    );
    
    return data;
}

/**
 * Parse usage data from a JSONL session file
 * Returns token breakdown and model usage
 */
function parseSessionUsage(filePath) {
    const result = {
        tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        byModel: {},
        messageCount: 0
    };
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
            try {
                const entry = JSON.parse(line);
                if (entry.type === 'message' && entry.message?.usage) {
                    const usage = entry.message.usage;
                    const model = entry.message.model || 'unknown';
                    
                    // Aggregate tokens
                    result.tokens.input += usage.input || 0;
                    result.tokens.output += usage.output || 0;
                    result.tokens.cacheRead += usage.cacheRead || 0;
                    result.tokens.cacheWrite += usage.cacheWrite || 0;
                    
                    // Track model usage by total tokens
                    const modelTokens = (usage.input || 0) + (usage.output || 0);
                    result.byModel[model] = (result.byModel[model] || 0) + modelTokens;
                    
                    result.messageCount++;
                }
            } catch (e) {
                // Skip malformed lines
            }
        }
    } catch (e) {
        // File read error, return empty result
    }
    
    return result;
}

/**
 * Get date from a timestamp in milliseconds
 */
function getDateFromMs(ms) {
    return new Date(ms).toISOString().split('T')[0];
}

/**
 * Generate usage.json from REAL session transcript data
 */
function generateCosts() {
    console.log('📊 Generating usage data from real session transcripts...');
    
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Aggregate by day
    const dayData = {};
    let totalProcessed = 0;
    let totalTokens = 0;
    
    try {
        if (!fs.existsSync(SESSIONS_DIR)) {
            console.error('   ⚠️ Sessions directory not found:', SESSIONS_DIR);
            return generateCostsFallback();
        }
        
        // Get all JSONL files (session transcripts)
        const sessionFiles = fs.readdirSync(SESSIONS_DIR)
            .filter(f => f.endsWith('.jsonl') && !f.endsWith('.lock'));
        
        console.log(`   - Found ${sessionFiles.length} session files to scan`);
        
        // Process each session file
        for (const filename of sessionFiles) {
            const filePath = path.join(SESSIONS_DIR, filename);
            const stats = fs.statSync(filePath);
            const fileDate = getDateFromMs(stats.mtimeMs);
            
            // Only process files from the last 7 days
            if (new Date(fileDate) < sevenDaysAgo) continue;
            
            const usage = parseSessionUsage(filePath);
            const dayTokens = usage.tokens.input + usage.tokens.output;
            
            if (dayTokens > 0) {
                if (!dayData[fileDate]) {
                    dayData[fileDate] = {
                        date: fileDate,
                        tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                        byModel: {},
                        sessions: 0,
                        messages: 0
                    };
                }
                
                dayData[fileDate].tokens.input += usage.tokens.input;
                dayData[fileDate].tokens.output += usage.tokens.output;
                dayData[fileDate].tokens.cacheRead += usage.tokens.cacheRead;
                dayData[fileDate].tokens.cacheWrite += usage.tokens.cacheWrite;
                dayData[fileDate].messages += usage.messageCount;
                dayData[fileDate].sessions++;
                
                // Merge model usage (by token count)
                Object.entries(usage.byModel).forEach(([model, tokens]) => {
                    dayData[fileDate].byModel[model] = (dayData[fileDate].byModel[model] || 0) + tokens;
                });
                
                totalTokens += dayTokens;
                totalProcessed++;
            }
        }
        
        console.log(`   - Processed ${totalProcessed} sessions with usage data`);
        
    } catch (e) {
        console.error('   ⚠️ Error reading session data:', e.message);
        return generateCostsFallback();
    }
    
    // Convert to sorted array
    const allDays = Object.values(dayData)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(d => ({
            date: d.date,
            tokens: d.tokens,
            totalTokens: d.tokens.input + d.tokens.output,
            byModel: d.byModel,
            sessions: d.sessions,
            messages: d.messages
        }));
    
    // Get today's data
    const todayData = dayData[today] || {
        date: today,
        tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        byModel: {},
        sessions: 0,
        messages: 0
    };
    
    // Calculate weekly totals
    const weekTotalTokens = allDays.reduce((sum, d) => sum + d.totalTokens, 0);
    const weekTotalSessions = allDays.reduce((sum, d) => sum + d.sessions, 0);
    const weekTotalMessages = allDays.reduce((sum, d) => sum + d.messages, 0);
    const weekByModel = {};
    const weekTokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    
    allDays.forEach(day => {
        weekTokens.input += day.tokens.input;
        weekTokens.output += day.tokens.output;
        weekTokens.cacheRead += day.tokens.cacheRead;
        weekTokens.cacheWrite += day.tokens.cacheWrite;
        
        Object.entries(day.byModel || {}).forEach(([model, tokens]) => {
            weekByModel[model] = (weekByModel[model] || 0) + tokens;
        });
    });
    
    const data = {
        lastUpdate: GENERATED,
        source: 'real',
        today: {
            date: today,
            tokens: todayData.tokens,
            totalTokens: todayData.tokens.input + todayData.tokens.output,
            byModel: todayData.byModel || {},
            sessions: todayData.sessions || 0,
            messages: todayData.messages || 0
        },
        week: {
            tokens: weekTokens,
            totalTokens: weekTotalTokens,
            sessions: weekTotalSessions,
            messages: weekTotalMessages,
            days: allDays.map(d => ({ 
                date: d.date, 
                totalTokens: d.totalTokens, 
                sessions: d.sessions 
            })),
            byModel: weekByModel
        }
    };
    
    fs.writeFileSync(
        path.join(DATA_DIR, 'usage.json'),
        JSON.stringify(data, null, 2)
    );
    
    console.log(`   ✅ usage.json generated from real data`);
    console.log(`      Today: ${todayData.tokens.input + todayData.tokens.output} tokens | Week: ${weekTotalTokens} tokens`);
    return data;
}

/**
 * Fallback if session data unavailable
 */
function generateCostsFallback() {
    console.log('   ⚠️ Using fallback (no real usage data available)');
    const today = new Date().toISOString().split('T')[0];
    
    const data = {
        lastUpdate: GENERATED,
        source: 'fallback',
        today: {
            date: today,
            tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            totalTokens: 0,
            byModel: {},
            sessions: 0,
            messages: 0
        },
        week: {
            tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            totalTokens: 0,
            sessions: 0,
            messages: 0,
            days: [],
            byModel: {}
        }
    };
    
    fs.writeFileSync(
        path.join(DATA_DIR, 'usage.json'),
        JSON.stringify(data, null, 2)
    );
    
    return data;
}

/**
 * Generate tasks-board.json for Kanban board
 * Parses task files and categorizes into columns
 */
function generateTasksBoard() {
    console.log('📋 Generating task board...');
    
    const tasksDir = path.join(CLAWD_ROOT, 'tasks');
    const completedDir = path.join(tasksDir, 'completed');
    
    const columns = {
        todo: [],
        inProgress: [],
        complete: []
    };
    
    let taskId = 0;
    
    // Parse active task files
    try {
        const files = fs.readdirSync(tasksDir)
            .filter(f => f.startsWith('task-') && f.endsWith('.md'));
        
        files.forEach(filename => {
            const filePath = path.join(tasksDir, filename);
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const stats = fs.statSync(filePath);
                const task = parseTaskFile(content, filename, stats);
                task.id = `task-${taskId++}`;
                
                // Categorize by status
                if (task.status.includes('complete') || task.status.includes('✅')) {
                    columns.complete.push(task);
                } else if (task.status.includes('progress') || task.status.includes('🟡') || task.status.includes('active')) {
                    columns.inProgress.push(task);
                } else if (task.status.includes('blocked') || task.status.includes('🔴')) {
                    columns.todo.push(task); // Blocked tasks go to todo
                    task.status = 'blocked';
                } else {
                    columns.todo.push(task);
                }
            } catch (e) {
                console.error(`   ⚠️ Could not parse ${filename}:`, e.message);
            }
        });
    } catch (e) {
        console.error('   ⚠️ Could not read tasks directory:', e.message);
    }
    
    // Parse completed task files
    try {
        if (fs.existsSync(completedDir)) {
            const files = fs.readdirSync(completedDir)
                .filter(f => f.endsWith('.md'))
                .slice(-10); // Only last 10 completed tasks
            
            files.forEach(filename => {
                const filePath = path.join(completedDir, filename);
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const stats = fs.statSync(filePath);
                    const task = parseTaskFile(content, filename, stats);
                    task.id = `task-${taskId++}`;
                    task.status = 'complete';
                    columns.complete.push(task);
                } catch (e) {
                    console.error(`   ⚠️ Could not parse ${filename}:`, e.message);
                }
            });
        }
    } catch (e) {
        console.error('   ⚠️ Could not read completed directory:', e.message);
    }
    
    // Sort: In Progress by priority, Todo by priority, Complete by date (newest first)
    const priorityOrder = { 'P0': 0, 'high': 1, 'P1': 1, 'P2': 2, 'medium': 2, 'P3': 3, 'low': 3 };
    const sortByPriority = (a, b) => (priorityOrder[a.priority] || 5) - (priorityOrder[b.priority] || 5);
    
    columns.todo.sort(sortByPriority);
    columns.inProgress.sort(sortByPriority);
    columns.complete.sort((a, b) => new Date(b.created) - new Date(a.created));
    
    const data = {
        generated: GENERATED,
        columns: columns,
        stats: {
            todo: columns.todo.length,
            inProgress: columns.inProgress.length,
            complete: columns.complete.length,
            total: columns.todo.length + columns.inProgress.length + columns.complete.length
        }
    };
    
    fs.writeFileSync(
        path.join(DATA_DIR, 'tasks-board.json'),
        JSON.stringify(data, null, 2)
    );
    
    console.log(`   ✅ tasks-board.json generated (${data.stats.total} tasks)`);
    console.log(`      To Do: ${data.stats.todo} | In Progress: ${data.stats.inProgress} | Complete: ${data.stats.complete}`);
    return data;
}

/**
 * Generate memory-tree.json from /life/areas/
 */
function generateMemoryTree() {
    console.log('🧠 Generating memory tree...');
    
    const areasDir = path.join(CLAWD_ROOT, 'life', 'areas');
    const categories = ['people', 'companies', 'projects'];
    const tree = {};
    
    let totalEntities = 0;
    let totalFacts = 0;
    
    categories.forEach(category => {
        tree[category] = {};
        const categoryDir = path.join(areasDir, category);
        
        try {
            if (!fs.existsSync(categoryDir)) {
                console.log(`   - ${category}/ not found, skipping`);
                return;
            }
            
            const entities = fs.readdirSync(categoryDir)
                .filter(f => {
                    const entityPath = path.join(categoryDir, f);
                    return fs.statSync(entityPath).isDirectory();
                });
            
            console.log(`   - Scanning ${category}/ (${entities.length} entities)...`);
            
            entities.forEach(entityName => {
                const entityDir = path.join(categoryDir, entityName);
                const summaryPath = path.join(entityDir, 'summary.md');
                const itemsPath = path.join(entityDir, 'items.json');
                
                let summary = '';
                let facts = [];
                
                // Read summary.md
                try {
                    if (fs.existsSync(summaryPath)) {
                        summary = fs.readFileSync(summaryPath, 'utf8');
                    }
                } catch (e) {
                    // ignore
                }
                
                // Read items.json
                try {
                    if (fs.existsSync(itemsPath)) {
                        const itemsContent = fs.readFileSync(itemsPath, 'utf8');
                        facts = JSON.parse(itemsContent);
                        if (!Array.isArray(facts)) facts = [];
                    }
                } catch (e) {
                    // ignore
                }
                
                tree[category][entityName] = {
                    summary: summary,
                    factCount: facts.length,
                    facts: facts.slice(0, 50) // Limit facts for performance
                };
                
                totalEntities++;
                totalFacts += facts.length;
            });
            
        } catch (e) {
            console.error(`   ⚠️ Could not scan ${category}:`, e.message);
        }
    });
    
    const data = {
        generated: GENERATED,
        stats: {
            entities: totalEntities,
            facts: totalFacts
        },
        tree: tree
    };
    
    fs.writeFileSync(
        path.join(DATA_DIR, 'memory-tree.json'),
        JSON.stringify(data, null, 2)
    );
    
    console.log(`   ✅ memory-tree.json generated (${totalEntities} entities, ${totalFacts} facts)`);
    return data;
}

/**
 * Parse a task markdown file and extract metadata
 */
function parseTaskFile(content, filename, stats) {
    // Get title from first # heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    let title = titleMatch ? titleMatch[1].replace(/^Task:\s*/i, '').trim() : filename.replace('.md', '');
    
    // Get status
    let status = 'pending';
    const statusMatch = content.match(/\*?\*?Status\*?\*?:\s*(.+)$/im);
    if (statusMatch) {
        const statusText = statusMatch[1].toLowerCase();
        if (statusText.includes('complete') || statusText.includes('✅')) {
            status = 'complete';
        } else if (statusText.includes('progress') || statusText.includes('🟡') || statusText.includes('active') || statusText.includes('running')) {
            status = 'in-progress';
        } else if (statusText.includes('blocked') || statusText.includes('🔴')) {
            status = 'blocked';
        }
    }
    
    // Get priority
    let priority = 'medium';
    const priorityMatch = content.match(/\*?\*?Priority\*?\*?:\s*(\w+)/im);
    if (priorityMatch) {
        priority = priorityMatch[1].toUpperCase().startsWith('P') ? priorityMatch[1] : priorityMatch[1].toLowerCase();
    } else if (content.toLowerCase().includes('urgent') || content.toLowerCase().includes('critical')) {
        priority = 'high';
    }
    
    // Get assignee (orchestrator)
    let assignee = null;
    const assigneeMatch = content.match(/\*?\*?(?:Orchestrator|Assigned|Owner)\*?\*?:\s*(.+)$/im);
    if (assigneeMatch) {
        assignee = assigneeMatch[1].replace(/\(.+\)/, '').trim();
    }
    
    // Get created date
    let created = stats.mtime.toISOString();
    const createdMatch = content.match(/\*?\*?Created\*?\*?:\s*(.+)$/im);
    if (createdMatch) {
        try {
            const parsed = new Date(createdMatch[1].replace(' UTC', 'Z'));
            if (!isNaN(parsed.getTime())) {
                created = parsed.toISOString();
            }
        } catch (e) { /* ignore */ }
    }
    
    // Get due date
    let due = null;
    const dueMatch = content.match(/\*?\*?(?:Due|Deadline|Target)\*?\*?:\s*(.+)$/im);
    if (dueMatch) {
        const dueText = dueMatch[1].trim();
        try {
            const parsed = new Date(dueText);
            if (!isNaN(parsed.getTime())) {
                due = parsed.toISOString();
            }
        } catch (e) { /* ignore */ }
    }
    
    // Get objective
    let objective = null;
    const objMatch = content.match(/^##\s*Objective\s*\n+(.+?)(?=\n#|$)/ms);
    if (objMatch) {
        objective = objMatch[1].trim().split('\n')[0].substring(0, 200);
    }
    
    // Get notes section (first 200 chars)
    let notes = null;
    const notesMatch = content.match(/^##\s*Notes\s*\n+(.+?)(?=\n#|$)/ms);
    if (notesMatch) {
        notes = notesMatch[1].trim().substring(0, 200);
    }
    
    return {
        title: title,
        status: status,
        priority: priority,
        assignee: assignee,
        created: created,
        due: due,
        objective: objective,
        notes: notes,
        file: `tasks/${filename}`
    };
}

/**
 * Generate cfo.json from /life/areas/companies/
 * Aggregates financial data for the CFO dashboard
 */
function generateCFOData() {
    console.log('💰 Generating CFO data...');
    
    const companiesDir = path.join(CLAWD_ROOT, 'life', 'areas', 'companies');
    
    // Company configuration with financial defaults
    const COMPANY_CONFIG = {
        'kippen-concrete': { 
            order: 1,
            defaultRevenue: 5000000,
            defaultStatus: 'profitable',
            defaultGrossMargin: 45
        },
        'kippen-excavation': { 
            order: 2,
            defaultRevenue: 2000000,
            defaultStatus: 'profitable',
            defaultGrossMargin: 35
        },
        'dmi-tools': { 
            order: 3,
            defaultRevenue: 946000,
            defaultStatus: 'losing',
            defaultGrossMargin: -7.6
        },
        'roc-diamond': { 
            order: 4,
            defaultRevenue: 0,
            defaultStatus: 'debt-holder',
            defaultDebt: 1200000
        },
        'kippen-leasing': { 
            order: 5,
            defaultRevenue: 0,
            defaultStatus: 'inactive'
        },
        'sawdot-city': { 
            order: 6,
            defaultRevenue: 0,
            defaultStatus: 'software'
        },
        'calvin-kippen-properties': { 
            order: 7,
            defaultRevenue: 0,
            defaultStatus: 'inactive'
        },
        'cj-kippen-properties': { 
            order: 8,
            defaultRevenue: 0,
            defaultStatus: 'inactive'
        },
        'durno': { 
            order: 9,
            defaultRevenue: 0,
            defaultStatus: 'inactive'
        }
    };
    
    const companies = [];
    const alerts = [];
    let totalRevenue = 0;
    let totalDebt = 0;
    let profitableCount = 0;
    let needsAttentionCount = 0;
    
    try {
        if (!fs.existsSync(companiesDir)) {
            console.log('   ⚠️ Companies directory not found');
            return generateCFODataFallback();
        }
        
        // Get all company directories
        const companyDirs = fs.readdirSync(companiesDir)
            .filter(f => {
                const fullPath = path.join(companiesDir, f);
                return fs.statSync(fullPath).isDirectory() && !f.startsWith('{');
            });
        
        console.log(`   - Found ${companyDirs.length} companies`);
        
        companyDirs.forEach(companyId => {
            const companyDir = path.join(companiesDir, companyId);
            const summaryPath = path.join(companyDir, 'summary.md');
            const itemsPath = path.join(companyDir, 'items.json');
            
            const config = COMPANY_CONFIG[companyId] || { order: 99 };
            
            let summary = '';
            let facts = [];
            let revenue = config.defaultRevenue || 0;
            let status = config.defaultStatus || 'inactive';
            let grossMargin = config.defaultGrossMargin;
            let debt = config.defaultDebt;
            let cashStatus = null;
            const keyFacts = [];
            const companyAlerts = [];
            
            // Read summary.md
            try {
                if (fs.existsSync(summaryPath)) {
                    summary = fs.readFileSync(summaryPath, 'utf8');
                    
                    // Extract first paragraph as summary text
                    const summaryMatch = summary.match(/## Overview\n+(.+?)(?=\n#|\n\n)/s);
                    if (summaryMatch) {
                        summary = summaryMatch[1].trim();
                    }
                }
            } catch (e) { /* ignore */ }
            
            // Read items.json and extract financial data
            try {
                if (fs.existsSync(itemsPath)) {
                    const itemsContent = fs.readFileSync(itemsPath, 'utf8');
                    facts = JSON.parse(itemsContent);
                    if (!Array.isArray(facts)) facts = [];
                    
                    // Extract financial facts
                    facts.forEach(fact => {
                        const text = fact.fact.toLowerCase();
                        
                        // Revenue extraction - look specifically for dollar amounts
                        if (text.includes('revenue') || (text.includes('gross') && !text.includes('margin'))) {
                            // Look for patterns like $5M, $946K, ~$5M, $1.5M
                            const revenueMatch = fact.fact.match(/~?\$\s*([\d,.]+)\s*(m|k|million|thousand)?/i);
                            if (revenueMatch) {
                                let val = parseFloat(revenueMatch[1].replace(/,/g, ''));
                                const unit = (revenueMatch[2] || '').toLowerCase();
                                if (unit === 'm' || unit === 'million') val *= 1000000;
                                else if (unit === 'k' || unit === 'thousand') val *= 1000;
                                if (val > revenue) revenue = val; // Only update if larger (take max revenue mentioned)
                            }
                            keyFacts.push(fact.fact);
                        }
                        
                        // Margin extraction - look for percentage patterns
                        if (text.includes('margin')) {
                            const marginMatch = fact.fact.match(/(-?[\d.]+)\s*%/);
                            if (marginMatch) {
                                grossMargin = parseFloat(marginMatch[1]);
                            }
                            keyFacts.push(fact.fact);
                        }
                        
                        // Debt extraction
                        if (text.includes('debt') || text.includes('loan')) {
                            const debtMatch = fact.fact.match(/\$?([\d,.]+)\s*(m|k|million|thousand)?/i);
                            if (debtMatch) {
                                let val = parseFloat(debtMatch[1].replace(/,/g, ''));
                                const unit = (debtMatch[2] || '').toLowerCase();
                                if (unit === 'm' || unit === 'million') val *= 1000000;
                                else if (unit === 'k' || unit === 'thousand') val *= 1000;
                                if (val > 0) debt = val;
                            }
                            keyFacts.push(fact.fact);
                        }
                        
                        // Status extraction
                        if (text.includes('losing money') || text.includes('negative margin')) {
                            status = 'losing';
                        } else if (text.includes('profitable') && status !== 'losing') {
                            status = 'profitable';
                        }
                        
                        // Cash alerts
                        if (text.includes('cash') && (text.includes('low') || text.includes('burn'))) {
                            cashStatus = 'Low';
                            companyAlerts.push({
                                severity: 'warning',
                                message: fact.fact
                            });
                        }
                        
                        // Important milestones or facts
                        if (fact.category === 'milestone' || text.includes('pipeline') || text.includes('critical')) {
                            keyFacts.push(fact.fact);
                        }
                    });
                }
            } catch (e) { 
                console.error(`   ⚠️ Could not parse items.json for ${companyId}:`, e.message);
            }
            
            // Determine cash status based on company situation
            if (!cashStatus) {
                if (status === 'losing') {
                    cashStatus = 'Low';
                } else if (status === 'profitable') {
                    cashStatus = 'OK';
                }
            }
            
            // Update totals
            totalRevenue += revenue;
            if (debt) totalDebt += debt;
            if (status === 'profitable') profitableCount++;
            if (status === 'losing' || status === 'debt-holder') needsAttentionCount++;
            
            // Add global alerts for critical companies
            if (status === 'losing' && revenue > 0) {
                alerts.push({
                    severity: 'critical',
                    message: `${companyId.replace(/-/g, ' ')} is losing money`,
                    company: companyId
                });
            }
            
            // Build company object
            companies.push({
                id: companyId,
                name: companyId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                revenue: revenue,
                status: status,
                grossMargin: grossMargin,
                cashStatus: cashStatus,
                debt: debt,
                summary: summary.substring(0, 200),
                keyFacts: keyFacts.slice(0, 5),
                alerts: companyAlerts,
                order: config.order || 99
            });
            
            console.log(`   - ${companyId}: ${status} | Revenue: $${revenue.toLocaleString()}`);
        });
        
    } catch (e) {
        console.error('   ⚠️ Error generating CFO data:', e.message);
        return generateCFODataFallback();
    }
    
    // Sort companies by order
    companies.sort((a, b) => a.order - b.order);
    
    // Determine overall portfolio health
    let portfolioHealth = 'good';
    if (needsAttentionCount > 0) portfolioHealth = 'watch';
    if (needsAttentionCount > 1 || alerts.some(a => a.severity === 'critical')) portfolioHealth = 'concern';
    
    const data = {
        generated: GENERATED,
        portfolio: {
            health: portfolioHealth,
            totalRevenue: totalRevenue,
            totalDebt: totalDebt,
            profitable: profitableCount,
            needsAttention: needsAttentionCount,
            companyCount: companies.length
        },
        companies: companies,
        alerts: alerts
    };
    
    fs.writeFileSync(
        path.join(DATA_DIR, 'cfo.json'),
        JSON.stringify(data, null, 2)
    );
    
    console.log(`   ✅ cfo.json generated (${companies.length} companies)`);
    console.log(`      Total Revenue: $${totalRevenue.toLocaleString()} | Health: ${portfolioHealth}`);
    return data;
}

/**
 * Fallback CFO data if generation fails
 */
function generateCFODataFallback() {
    console.log('   ⚠️ Using CFO fallback data');
    
    const data = {
        generated: GENERATED,
        portfolio: {
            health: 'unknown',
            totalRevenue: 0,
            totalDebt: 0,
            profitable: 0,
            needsAttention: 0,
            companyCount: 0
        },
        companies: [],
        alerts: [{
            severity: 'warning',
            message: 'Could not load company data',
            company: null
        }]
    };
    
    fs.writeFileSync(
        path.join(DATA_DIR, 'cfo.json'),
        JSON.stringify(data, null, 2)
    );
    
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
generateTasksBoard();
console.log('');
generateMemoryTree();
console.log('');
generateCFOData();
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
