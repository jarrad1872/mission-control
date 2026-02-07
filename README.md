# 🎯 Mission Control

A dashboard for the Bob Collective, providing visibility into activity, schedules, and searchable documentation.

## Features

### 1. Activity Feed
- Chronological history of all actions
- Parses git commits, daily notes, and completed tasks
- Filterable by type and date range
- Real-time relative timestamps

### 2. Calendar View
- Weekly grid showing scheduled events
- Recurring events (Arena sessions, heartbeats, standups)
- Task deadlines from active task files
- Navigate between weeks
- Click events for details

### 3. Global Search
- Full-text search across entire workspace
- Searches memory/, tasks/, docs/, and root .md files
- Highlights matching terms
- Click results to view full file content
- Keyboard shortcut: ⌘K / Ctrl+K

## Tech Stack

- Pure HTML/CSS/JavaScript (no frameworks)
- Dark theme matching Bob aesthetic
- Responsive design
- Static site, deployable anywhere

## Local Development

```bash
# Generate data files
./build.sh  # or: node build.js

# Serve locally
python3 -m http.server 8080
# or
npx serve .

# Open http://localhost:8080
```

## Regenerating Data

The `build.js` script parses the workspace and generates:

- `data/activity.json` — Activity feed (git commits, daily events, completed tasks)
- `data/calendar.json` — Scheduled events and recurring items
- `data/search-index.json` — Full-text search index

**Run manually:**
```bash
node build.js
```

**Or via cron for auto-updates:**
```bash
# Add to crontab (every 15 minutes)
*/15 * * * * cd /home/node/clawd/projects/mission-control && node build.js > /dev/null 2>&1
```

## GitHub Pages Deployment

### Option 1: Deploy from main branch

1. Push this folder to a GitHub repository
2. Go to Settings → Pages
3. Source: Deploy from a branch
4. Branch: main, folder: / (root)
5. Save and wait for deployment

### Option 2: Use GitHub Actions

Create `.github/workflows/pages.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - 'projects/mission-control/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Build data
        run: |
          cd projects/mission-control
          node build.js
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./projects/mission-control
```

### Option 3: Deploy as standalone repo

```bash
# Create a new repo for the dashboard
cd /home/node/clawd/projects/mission-control
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/jarrad1872/mission-control.git
git push -u origin main

# Enable GitHub Pages in repo settings
```

## File Structure

```
mission-control/
├── index.html          # Main dashboard
├── css/
│   └── style.css       # All styles (dark theme)
├── js/
│   ├── data.js         # Data loading and utilities
│   ├── activity.js     # Activity feed module
│   ├── calendar.js     # Calendar module
│   ├── search.js       # Search module
│   └── main.js         # App initialization
├── data/
│   ├── activity.json   # Generated activity data
│   ├── calendar.json   # Generated calendar data
│   └── search-index.json # Generated search index
├── build.js            # Node.js build script
├── build.sh            # Shell wrapper
└── README.md           # This file
```

## Customization

### Colors
Edit `css/style.css` CSS variables:
```css
:root {
    --bg-primary: #0f0f1a;
    --bg-secondary: #1a1a2e;
    --accent: #e94560;
    /* ... */
}
```

### Recurring Events
Edit the `events` array in `build.js` to add/remove recurring calendar items.

### Search Categories
Modify `generateSearchIndex()` in `build.js` to include additional directories.

## Performance Notes

- Search index is loaded client-side (~500KB compressed)
- For very large workspaces, consider server-side search
- Data files cached in memory after first load
- Refresh button clears cache and reloads

---

Built with 💜 by the Bob Collective
