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

// Run all generators
console.log('');
generateActivity();
console.log('');
generateCalendar();
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
