# Mission Control — Code Review

**Reviewer:** Bob (Opus-level review)  
**Date:** 2026-02-08  
**Scope:** Full codebase review — all source files  
**Purpose:** Honest assessment for the project owner (Jarrad)

---

## Executive Summary

Mission Control is a surprisingly ambitious and well-executed personal dashboard. For a project built entirely with vanilla HTML/CSS/JS (no frameworks), it's impressive — 16 JavaScript modules, a complete PWA setup, dark/light theming, mobile-first design, and a real data pipeline from your workspace.

**Overall Grade: B+**

The good: Clean modular architecture, proper PWA compliance, thoughtful UX patterns (pull-to-refresh, collapsible sections, bottom sheet modals), and real data integration via `build.js`.

The bad: Several quick-action features are non-functional placeholders, the Analytics module doesn't integrate with `main.js` properly, there's code duplication across modules, and the 544KB search index could become a problem.

---

## 1. Architecture & Structure

### What's Good

- **Clear separation of concerns.** Each feature lives in its own JS file as a revealing module pattern (IIFE returning a public API). This is textbook clean architecture for vanilla JS.
- **Data layer abstraction.** `data.js` provides a caching fetch layer that all modules use. Smart.
- **Build pipeline.** `build.js` is a genuine data ETL script — it reads session files, parses git commits, scans task files, builds a knowledge graph, and generates CFO analytics from real business data. This is the most impressive part of the codebase.
- **File organization.** `js/`, `css/`, `data/`, `icons/` — clean and predictable.

### Issues

- **No bundling or minification.** 16 individual `<script>` tags in `index.html` (lines 282–299). Each is a separate HTTP request. Total JS payload: ~220KB unminified.
- **Global namespace pollution.** Every module attaches itself to `window` (e.g., `window.BobStatusModule`, `window.CostsModule`). With 16 modules, that's 16+ global variables. Works, but fragile.
- **Analytics module uses a different pattern.** `analytics.js` uses a plain object (`Analytics = { ... }`) instead of the IIFE/revealing module pattern every other file uses. It's also exposed as `window.Analytics` but `main.js` (line 39) tries to call it — it's not in the `Promise.all()` init list. The analytics tab renders on demand, which partially saves it, but it's inconsistent.
- **`README.md` is outdated.** The file structure section (lines 54-66) only lists 5 JS files. The actual project has 16 JS files, 2 CSS files, and 9 data JSON files.

### Recommendations

1. Add a simple bundler (esbuild is <2 lines of config) to concat + minify JS/CSS
2. Standardize all modules to the same pattern
3. Update README.md to reflect actual file structure

---

## 2. Code Quality

### What's Good

- **Consistent `escapeHtml()` usage.** Almost every module that renders user content uses `escapeHtml()` — good XSS prevention habit.
- **Error handling.** Most `fetch()` calls have try/catch with fallback states. `build.js` has fallback generators for every data type.
- **Readable code.** Functions are small, well-named, and well-commented. JSDoc headers on major functions.
- **Debounced search.** Both the main search and quick search use 200ms debounce — correct pattern.

### Issues

- **DRY violations — `escapeHtml()` is defined 6 times.** It appears independently in:
  - `bob-status.js` (line 205)
  - `activity.js` (line 316)
  - `calendar.js` (line 172)
  - `search.js` (line 275)
  - `sessions.js` (line 360)
  - `memory-browser.js` (line 292)
  - `kanban.js` (line 287)
  - `cfo.js` (line 299)
  
  This should be in `data.js` and shared.

- **`formatRelativeTime()` is defined 4 times.** In `data.js`, `bob-status.js`, `sessions.js`, and `cfo.js`. Slightly different implementations each time.

- **`formatTokens()` is defined 3 times.** In `costs.js`, `sessions.js`, and `analytics.js` (as `formatNumber`). Same logic, different names.

- **`showToast()` has 4 competing implementations.** `quick-actions.js` creates the canonical one, but `sessions.js`, `control.js`, and `pwa.js` each have their own fallback implementations. The fallback in `pwa.js` (line 225) calls `showToast(type, message)` with reversed parameter order compared to `quick-actions.js` which uses `showToast(message, type)`.

- **Inline `onclick` handlers in `cfo.js`.** Lines like `onclick="CFOModule.toggleCard('${company.id}')"` (rendered HTML) mix event handling into templates. The rest of the codebase uses `addEventListener`. Inconsistent.

- **`SessionsModule.closeHistoryModal()` called via `onclick` in `index.html`** (lines 268-269). This creates a hard coupling between HTML and a specific module name.

### Recommendations

1. Move all shared utilities (`escapeHtml`, `formatRelativeTime`, `formatTokens`, `showToast`) to `data.js`
2. Eliminate inline `onclick` handlers; use `addEventListener` consistently
3. Consider a small utility module (`utils.js`) if `data.js` gets too big

---

## 3. Features Inventory

### ✅ Working Features

| Feature | Module | Status |
|---------|--------|--------|
| Bob status chips (expandable) | `bob-status.js` | ✅ Working — real data from sessions.json |
| Usage stats (token tracking) | `costs.js` | ✅ Working — reads usage.json with fallback |
| Activity feed (live polling) | `activity.js` | ✅ Working — git commits, daily notes, tasks |
| Calendar (weekly view) | `calendar.js` | ✅ Working — recurring events + task deadlines |
| Full-text search | `search.js` | ✅ Working — searches indexed .md files |
| Quick search modal (⌘K) | `search.js` | ✅ Working — spotlight-style search |
| Task board (kanban) | `kanban.js` | ✅ Working — drag-and-drop, 3 columns |
| Memory browser | `memory-browser.js` | ✅ Working — tree view of knowledge graph |
| Session viewer | `sessions.js` | ✅ Working — filterable, sortable, expandable |
| CFO Center | `cfo.js` | ✅ Working — portfolio overview, company cards |
| Dark/light theme | `theme.js` | ✅ Working — persisted to localStorage |
| Collapsible sections | `main.js` | ✅ Working — state persisted |
| Pull to refresh | `pull-refresh.js` | ✅ Working — touch devices only |
| Bottom navigation | `main.js` | ✅ Working — 5 tabs + More drawer |
| PWA install prompt | `pwa.js` | ✅ Working — service worker + manifest |
| Offline page | `offline.html` | ✅ Working — auto-reconnect |

### ⚠️ Placeholder/Non-Functional Features

| Feature | Module | Issue |
|---------|--------|-------|
| Quick Actions: Check Email | `quick-actions.js` | **Fake** — `simulateAction(1500)` just waits, does nothing (line 18) |
| Quick Actions: Heartbeat | `quick-actions.js` | **Fake** — `simulateAction(2000)`, no API call (line 25) |
| Quick Actions: Spawn Bob | `quick-actions.js` | **Fake** — form submits to `simulateAction(2000)` (line 209) |
| Quick Actions: New Task | `quick-actions.js` | **Fake** — same pattern (line 222) |
| Quick Actions: Send Message | `quick-actions.js` | **Fake** — same pattern (line 235) |
| Control Panel: All API calls | `control.js` | **Non-functional** — sends to `localhost:18789` which isn't accessible from GitHub Pages. Gateway client is well-built but can't reach the server. |
| Voice tab (ClawChat) | `voice.js` | **Broken URL** — hardcoded Cloudflare tunnel URL (`infrared-lounge-sherman-set.trycloudflare.com`) will rotate. |
| Session history viewer | `sessions.js` | **Placeholder** — shows "Conversation history would load here" (line 267) |
| Analytics tab | `analytics.js` | **Partially working** — renders charts from data, but isn't initialized via `main.js` and uses a different module pattern. Tab change event (`tabChange`) is never dispatched. |
| Notification sound | `activity.js` | **Broken** — generates audio from a malformed base64 string (line 171). Will produce silence or error. |
| Background sync | `service-worker.js` | **Stub** — `sync` event handler just logs (line 123) |
| Push notifications | `service-worker.js` | **Stub** — handler exists but no subscription mechanism |

### Key Insight

The dashboard is excellent as a **read-only monitoring tool**. All the data visualization works great. But the **write/action features** (sending messages, creating tasks, spawning agents, triggering crons) are all non-functional placeholders. The Control Panel (`control.js`) has a well-architected Gateway client class, but it can't connect from a static GitHub Pages site to a local server.

---

## 4. UX/UI Assessment

### What's Good

- **Mobile-first design targeting Samsung S25 Ultra.** The 600px max-width, bottom nav, and touch-friendly 44px minimum tap targets show real thought about the primary use case.
- **Bottom sheet modals.** On mobile, modals slide up from the bottom (Bob details, FAB menu, More drawer) — this is the correct native-app pattern.
- **Collapsible sections with persisted state.** Smart — users don't have to re-collapse sections they don't care about.
- **Pull-to-refresh.** Correctly only enabled on touch devices, with resistance factor and threshold.
- **Dark theme is gorgeous.** The color palette (`#0f0f1a` background, `#e94560` accent) with subtle gradients looks professional. Light theme also works.
- **Status indicators are subtle.** The tiny green dot in the header and the pulsing status dots on Bob chips are the right level of information density.
- **Keyboard shortcut (⌘K).** Quick search modal is a power-user feature that works well.

### Issues

- **No visual feedback that Quick Actions are fake.** Users will tap "Check Email" and see a success toast ("Email check triggered!") even though nothing happened. This is actively misleading.
- **FAB button overlaps content.** The floating action button at bottom-right (56px circle) can cover the last item in long lists since `main-content` padding accounts for it but not all content.
- **Calendar is vertical-only on mobile.** The 7-day week renders as a vertical list on mobile (one day per row). This works but takes a lot of scrolling. A horizontal scroll or 2-column layout would be more compact.
- **No loading skeletons.** All sections show a spinner + "Loading..." text. Skeleton screens would feel snappier.
- **CFO Quick Actions are confusing.** The "Run CFO Analysis" button shows a toast saying "Send 'cfo' in chat to run analysis" — this is a dead-end UX. The user can't do anything with this information from the dashboard.
- **More drawer has 6 items.** That's a lot of features hidden behind "More." Consider if some (like Stats) could be merged into the main Dashboard tab.

### Recommendations

1. Remove or clearly label placeholder actions as "Coming Soon"
2. Add skeleton loading states
3. Consider a compact calendar view for mobile
4. Make CFO Quick Actions either functional or remove them

---

## 5. Performance

### Current State

| Asset | Size | Notes |
|-------|------|-------|
| Total JS (16 files) | ~220 KB | Unminified, 16 HTTP requests |
| CSS (2 files) | ~57 KB | Unminified |
| `search-index.json` | **544 KB** | 🔴 Largest asset by far |
| `memory-tree.json` | 49 KB | Knowledge graph |
| `activity.json` | 29 KB | Activity feed |
| `tasks-board.json` | 10 KB | Kanban data |
| Chart.js CDN | ~200 KB | External dependency |
| Total page weight | ~1.1 MB | Before gzip |

### Issues

- **`search-index.json` at 544KB is the biggest concern.** This loads the full text content of every .md file in the workspace (up to 50KB per file). As the workspace grows, this will become a real problem. It's loaded client-side and searched with string matching. Currently loaded on-demand (good) but cached in memory.
- **No code splitting or lazy loading for JS.** All 16 scripts load on page load regardless of which tab is active. The Voice module lazy-loads its iframe (good), but the JS for all tabs loads upfront.
- **Chart.js loaded but rarely used.** The `<script>` tag for Chart.js (200KB) is in `index.html` but it's only used by the Analytics module. It should be lazy-loaded.
- **Auto-refresh timers could stack.** `BobStatusModule` and `SessionsModule` both run 30-second refresh timers. `ActivityModule` runs a 10-60 second polling loop with backoff. That's 3 concurrent polling loops making fetch requests, even when those tabs aren't visible. `ActivityModule` correctly slows down when hidden, but the others don't.
- **`build.js` scans JSONL session files.** `parseSessionUsage()` reads entire JSONL files line by line. For large session histories, this could be slow. No streaming or incremental processing.

### Recommendations

1. **Bundle + minify JS/CSS.** esbuild can do this in one command. Would reduce JS from 220KB to ~60KB.
2. **Compress search-index.json.** Either serve it gzipped (GitHub Pages does this automatically) or truncate content to snippets instead of full file contents.
3. **Lazy-load Chart.js.** Only import it when the Analytics tab is opened.
4. **Pause refresh timers for non-visible tabs.** Add visibility checks to `BobStatusModule` and `SessionsModule` like `ActivityModule` already does.
5. **Consider server-side search.** The README already notes this — at some point the client-side search index won't scale.

---

## 6. Security

### ✅ Good Practices

- **XSS prevention.** `escapeHtml()` is used consistently when rendering user-generated content (commit messages, task titles, facts, etc.).
- **No secrets in the codebase.** No API keys, tokens, or credentials are hardcoded. The Gateway token in `control.js` is stored in localStorage and entered by the user.
- **Service worker skips cross-origin requests.** Correct — `service-worker.js` line 71 returns early for non-same-origin fetches.

### ⚠️ Concerns

- **Gateway token stored in localStorage.** `control.js` (line 44) stores the auth token in `localStorage`. This is vulnerable to XSS attacks. For a personal dashboard this is acceptable, but it's worth noting.
- **`search-index.json` exposes full file contents.** The search index contains the full text of every .md file in the workspace (up to 50KB each). If this dashboard is publicly accessible (it is — GitHub Pages), anyone can read your memory files, task files, and documentation by fetching `/mission-control/data/search-index.json`. This includes:
  - `memory/*.md` — Daily notes with personal context
  - `tasks/*.md` — Task details and decisions
  - `MEMORY.md`, `AGENTS.md`, etc. — System files
  
  **This is the most significant security concern.** Your personal/business information is publicly readable.

- **`data/bob-status.json` exposes session IDs.** Anyone can see which sessions are active and their identifiers.
- **`data/cfo.json` exposes financial data.** Revenue figures, debt amounts, and company details are publicly accessible.
- **`data/memory-tree.json` exposes knowledge graph.** Personal facts about people, companies, and projects.

### 🔴 Critical Recommendation

**If this is deployed publicly, all `data/*.json` files are accessible to anyone.** This is a significant privacy/security concern given the nature of the data (personal notes, financial information, business details).

Options:
1. **Make the repo private** and use GitHub Pages from a private repo (requires GitHub Pro)
2. **Add authentication.** Simple approach: use a static site auth service or move to Cloudflare Pages with Access
3. **Sanitize data files.** Strip sensitive content from search-index.json and memory-tree.json before committing
4. **Don't commit data files.** Generate them at build time via GitHub Actions from a separate private source

---

## 7. PWA Compliance

### ✅ Passing

| Requirement | Status | Notes |
|-------------|--------|-------|
| `manifest.json` | ✅ Complete | Name, icons, shortcuts, screenshots, scope |
| Service Worker | ✅ Registered | Cache-first for assets, network-first for data |
| HTTPS | ✅ | GitHub Pages serves over HTTPS |
| Icons (multiple sizes) | ✅ | 72, 96, 128, 144, 152, 192, 384, 512 + maskable |
| Offline page | ✅ | `offline.html` with auto-reconnect |
| `<meta>` tags | ✅ | theme-color, apple-mobile-web-app-capable, etc. |
| Standalone display mode | ✅ | `"display": "standalone"` |
| App shortcuts | ✅ | Activity Feed and CFO Center shortcuts |
| Screenshots | ✅ | Wide and narrow form factors |
| Install prompt handling | ✅ | `beforeinstallprompt` + iOS fallback instructions |

### Issues

- **Service worker precache list is incomplete.** `service-worker.js` lines 14-28 list 16 assets to precache, but the app has 16 JS files and only 8 are listed. Missing: `analytics.js`, `sessions.js`, `memory-browser.js`, `kanban.js`, `control.js`, `cfo.js`, `pull-refresh.js`, `theme.js`, `pwa.css`. These will only be cached after first visit (stale-while-revalidate fallback works, but first offline visit after install may be broken).
- **Cache version management is manual.** `CACHE_NAME = 'mission-control-v8'` — this has to be manually bumped on every deploy. No content-hashing.
- **Push notification handler exists but no subscription.** The service worker handles `push` events (line 128) but there's no client-side code to request notification permission or create a push subscription.
- **Scope mismatch potential.** `manifest.json` uses `"scope": "/mission-control/"` but `pwa.js` registers the service worker with `scope: './'`. The relative path should resolve correctly on GitHub Pages, but this could break if the deployment path changes.

### Recommendations

1. Add all JS/CSS files to the precache list
2. Automate cache versioning (use a build hash)
3. Either implement push notification subscription or remove the stub handlers

---

## 8. Bugs & Issues

### 🔴 Bugs

1. **`analytics.js` not initialized by `main.js`.** The `Promise.all()` in `main.js` (line 33) doesn't include `Analytics.init()`. Instead it tries `Analytics` which isn't even referenced. The analytics tab only works because it self-initializes on DOMContentLoaded and re-renders on a `tabChange` event — but that event is never dispatched by `main.js`.

2. **Toast parameter order mismatch.** `pwa.js` line 103 calls `this.showToast('warning', 'You\'re offline...')` but at line 225 it checks for a global `showToast(type, message)`. The `QuickActions.showToast()` signature is `showToast(message, type)`. If the global `showToast` exists, the type and message will be swapped.

3. **Notification sound is silence.** `activity.js` line 171 creates an Audio from `'data:audio/wav;base64,UklGRl9vT19XQVZFZm10...'` followed by `'tvT18'.repeat(100)`. This is not a valid WAV file — it will either produce silence or throw. The `.catch(() => {})` swallows the error silently.

4. **`mainTabs` array in `main.js` is wrong.** Line 96: `const mainTabs = ['dashboard', 'tasks', 'stats', 'activity']`. But the nav bar has `dashboard`, `tasks`, `cfo`, `activity`, and `more`. `stats` is in the More drawer, and `cfo` is a main tab. This means switching to CFO from the More drawer won't correctly highlight the nav item.

5. **`data/sessions.json` path inconsistency in `build.js`.** `build.js` generates `bob-status.json` from the sessions data but doesn't generate `sessions.json` itself. The `SessionsModule` fetches `data/sessions.json` but there's no generator for it in `build.js`. It must be created externally.

### ⚠️ Minor Issues

6. **Event detail panel covers entire viewport on mobile.** `event-detail-panel` (CSS line ~958) is `width: 100%` on mobile with no backdrop. Users might not realize how to close it.

7. **Calendar `getStartOfWeek()` doesn't account for timezone.** `calendar.js` line 8 uses local time for week calculation, but events from `calendar.json` use UTC times. This could cause events to appear on the wrong day near midnight.

8. **Memory browser `renderMarkdown()` is incomplete.** `memory-browser.js` line 244 has a basic markdown renderer that handles headers, bold, italic, and lists — but the list wrapping regex (`(<li>.*<\/li>\n?)+` → `<ul>`) won't work correctly with multiline content.

9. **Kanban drag-and-drop changes are lost on refresh.** `kanban.js` `moveTask()` updates the in-memory data but doesn't persist anywhere. Refreshing the page resets all moved tasks.

---

## 9. Missing Features (What Would Make This Significantly Better)

### High Impact

1. **Authentication / Access Control.** The #1 need. Your personal and financial data is publicly accessible. Even a simple password gate would help.

2. **Real API Integration.** The Control Panel has a well-built Gateway client class. Making it actually connect to the OpenClaw gateway (via a proxy or WebSocket) would unlock the write side of the dashboard — sending messages, creating tasks, triggering actions.

3. **Live Data via WebSocket.** Currently all modules poll via HTTP. A WebSocket connection to the gateway would enable real-time updates for Bob status, activity feed, and sessions without the polling overhead.

4. **Build Automation.** `build.js` must be run manually (or via cron). A GitHub Action that runs on push and regenerates `data/*.json` would keep the dashboard fresh automatically.

### Medium Impact

5. **Notifications.** The push notification infrastructure is stubbed out but not implemented. Browser notifications for important events (new tasks, errors, email alerts) would be valuable.

6. **Time Range Selection.** The activity feed and usage stats would benefit from configurable date ranges (today, 7d, 30d, custom).

7. **Data Export.** Ability to export usage data, task lists, or activity logs as CSV/JSON.

8. **Session Transcript Viewer.** The "View History" button in Sessions is a placeholder. Actually loading and displaying conversation transcripts would be useful for debugging and auditing.

### Nice to Have

9. **Charts with Chart.js.** The library is loaded but not used for the main dashboard. Proper line/bar charts for usage trends would be more informative than the CSS bar charts.

10. **Responsive Desktop Layout.** The dashboard is mobile-first (good) but on desktop the 800px max-width feels cramped. A multi-column layout for larger screens would use space better.

11. **Keyboard Navigation.** Beyond ⌘K for search, keyboard shortcuts for tab switching, refresh, etc.

---

## 10. Prioritized Recommendations

### 🔴 Do First (Security & Correctness)

1. **Address data exposure.** Either make the repo private, add authentication, or stop committing sensitive data files. `search-index.json` and `memory-tree.json` contain personal/business information that's publicly accessible.

2. **Fix Analytics initialization.** Add `Analytics.init?.()` to `main.js` Promise.all, or better yet, refactor Analytics to use the same IIFE pattern.

3. **Fix toast parameter order.** Standardize on `showToast(message, type)` everywhere. Fix `pwa.js` to match.

4. **Remove or label fake Quick Actions.** Either make them work or show "Coming Soon" badges. Fake success toasts are worse than no feature at all.

### 🟡 Do Next (Quality & Performance)

5. **Extract shared utilities.** Move `escapeHtml`, `formatRelativeTime`, `formatTokens`, `showToast` to a shared module. This eliminates ~200 lines of duplicated code.

6. **Bundle and minify.** A single `esbuild --bundle --minify` step would reduce 16 HTTP requests to 1 and cut JS size by ~70%.

7. **Complete service worker precache list.** Add all JS and CSS files.

8. **Add visibility-based pause to all refresh timers.** Follow `ActivityModule`'s pattern in `BobStatusModule` and `SessionsModule`.

9. **Truncate search index content.** Store only first 500 chars per file instead of 50,000. This would cut `search-index.json` from 544KB to ~50KB.

### 🟢 Improve Later (Features & Polish)

10. **Add build automation** via GitHub Actions to regenerate data files on push.

11. **Implement real gateway integration** for the Control Panel (requires auth + CORS + proxy solution).

12. **Add loading skeletons** instead of spinners for a more polished feel.

13. **Update README.md** to reflect the actual project scope and architecture.

14. **Fix the `mainTabs` array** in `main.js` to match actual navigation structure.

---

## File-by-File Summary

| File | Lines | Grade | Notes |
|------|-------|-------|-------|
| `index.html` | 309 | A | Clean, semantic, well-structured |
| `css/style.css` | 2667 | A- | Comprehensive, well-organized. Could split into modules. |
| `css/pwa.css` | 232 | A | Good touch-friendly overrides |
| `js/data.js` | 113 | A | Clean data layer, should host shared utilities |
| `js/theme.js` | 97 | A | Solid dark/light toggle with system preference detection |
| `js/bob-status.js` | 292 | A- | Good expandable chip UX, minor DRY issues |
| `js/costs.js` | 245 | A- | Clean rendering, smart fallback data generation |
| `js/activity.js` | 380 | B+ | Good live polling with backoff, but broken notification sound |
| `js/calendar.js` | 211 | B+ | Functional but timezone handling is fragile |
| `js/search.js` | 327 | A- | Well-implemented full-text search with highlighting |
| `js/voice.js` | 95 | C+ | Hardcoded tunnel URL will break. Lazy loading is good. |
| `js/quick-actions.js` | 293 | C | Well-structured but every action is a fake placeholder |
| `js/analytics.js` | 214 | B- | Different module pattern, not integrated with main init |
| `js/sessions.js` | 412 | A- | Excellent session viewer, placeholder history modal |
| `js/memory-browser.js` | 316 | B+ | Good tree UI, basic markdown renderer is fragile |
| `js/kanban.js` | 352 | B+ | Good drag-and-drop, but changes aren't persisted |
| `js/control.js` | 502 | B | Well-architected Gateway client, but can't work from static site |
| `js/cfo.js` | 347 | B+ | Good portfolio view, inline onclick handlers |
| `js/pull-refresh.js` | 147 | A | Clean touch handling, correct threshold/resistance |
| `js/main.js` | 195 | B+ | Good orchestrator, but has the `mainTabs` bug |
| `js/pwa.js` | 211 | B+ | Good PWA support, toast parameter order bug |
| `build.js` | 733 | A- | Impressive data pipeline, parses real workspace data |
| `service-worker.js` | 162 | B+ | Good dual strategy, incomplete precache list |
| `manifest.json` | 71 | A | Complete and correct |
| `offline.html` | 87 | A | Clean, auto-reconnects |
| `generate-icons.js` | 146 | A | Clever SVG-based icon generation |

---

## Conclusion

Mission Control is a genuinely useful personal dashboard that does a lot of things right. The read-only monitoring features are solid, the mobile UX is well-thought-out, and the data pipeline via `build.js` is impressive engineering for a vanilla JS project.

The two biggest concerns are:
1. **Security:** Sensitive data is publicly exposed via the JSON data files
2. **Honest UX:** Several features present as functional but are fake placeholders

Fix those, and you have a tool worth relying on daily.

---

*Reviewed with 💜 by the Bob Collective*
