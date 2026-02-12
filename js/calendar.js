/**
 * Calendar Module - Weekly view of Bob ecosystem schedule
 * Shows cron jobs, recurring tasks, and scheduled events
 */

const CalendarModule = (function() {
    let events = [];
    let currentWeekStart = getStartOfWeekUTC(new Date());
    let listenersBound = false;

    function getStartOfWeekUTC(date) {
        const d = new Date(date);
        const day = d.getUTCDay();
        const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
        d.setUTCDate(diff);
        d.setUTCHours(0, 0, 0, 0);
        return d;
    }

    async function init() {
        const data = await DataModule.loadCalendar();
        if (data && data.events) {
            events = data.events;
        }
        setupListeners();
        render();
    }

    function setupListeners() {
        if (listenersBound) return;
        const prevBtn = document.getElementById('prevWeek');
        const nextBtn = document.getElementById('nextWeek');
        const closeBtn = document.getElementById('closeEventPanel');
        if (prevBtn) prevBtn.addEventListener('click', () => navigateWeek(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => navigateWeek(1));
        if (closeBtn) closeBtn.addEventListener('click', closeEventPanel);
        listenersBound = true;
    }

    function navigateWeek(direction) {
        const newDate = new Date(currentWeekStart);
        newDate.setUTCDate(newDate.getUTCDate() + (direction * 7));
        currentWeekStart = newDate;
        render();
    }

    /**
     * Check if an event occurs on a given date
     */
    function eventMatchesDate(event, date) {
        const dateStr = formatDateKey(date);
        const dow = date.getUTCDay(); // 0=Sun..6=Sat

        // Exact date match
        if (event.date === dateStr) return true;

        // Recurring patterns
        const r = (event.recurring || '').toLowerCase();
        if (!r) return false;

        if (r === 'daily' || r === 'every day') return true;
        if (r === 'weekdays' && dow >= 1 && dow <= 5) return true;
        if (r === 'weekends' && (dow === 0 || dow === 6)) return true;

        // "every N min" / "every N hours" — these run continuously, show on all days
        if (r.startsWith('every ') && (r.includes('min') || r.includes('hour'))) return true;

        // Day-of-week matching: "monday", "friday", "sunday" etc
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        if (dayNames.indexOf(r) === dow) return true;

        // "weekly" with dayOfWeek property
        if (r === 'weekly' && event.dayOfWeek === dow) return true;

        return false;
    }

    /**
     * Get events for a specific date, sorted by priority
     */
    function getEventsForDate(date) {
        const matched = events.filter(e => eventMatchesDate(e, date));

        // Sort: timed events first (by time), then background tasks
        return matched.sort((a, b) => {
            // Background tasks (every N min) go to bottom
            const aFreq = isFrequentTask(a);
            const bFreq = isFrequentTask(b);
            if (aFreq && !bFreq) return 1;
            if (!aFreq && bFreq) return -1;
            // Then by time string
            if (a.time && b.time) return a.time.localeCompare(b.time);
            if (a.time) return -1;
            if (b.time) return 1;
            return 0;
        });
    }

    function isFrequentTask(event) {
        const r = (event.recurring || '').toLowerCase();
        return r.startsWith('every ') && (r.includes('min') || r.includes('hour'));
    }

    function formatDateKey(date) {
        return date.toISOString().split('T')[0];
    }

    /**
     * Render the calendar
     */
    function render() {
        const container = document.getElementById('calendarGrid');
        const weekLabel = document.getElementById('currentWeek');
        if (!container) return;

        const weekEnd = new Date(currentWeekStart);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

        if (weekLabel) {
            const opts = { month: 'short', day: 'numeric', timeZone: 'UTC' };
            weekLabel.textContent = `${currentWeekStart.toLocaleDateString('en-US', opts)} — ${weekEnd.toLocaleDateString('en-US', opts)}, ${weekEnd.getUTCFullYear()}`;
        }

        const today = new Date();
        const todayStr = formatDateKey(today);
        const days = [];

        for (let i = 0; i < 7; i++) {
            const date = new Date(currentWeekStart);
            date.setUTCDate(date.getUTCDate() + i);
            const dayEvents = getEventsForDate(date);
            const isToday = formatDateKey(date) === todayStr;
            days.push(renderDay(date, dayEvents, isToday));
        }

        container.innerHTML = days.join('');

        container.querySelectorAll('.calendar-event').forEach(el => {
            el.addEventListener('click', (e) => {
                showEventDetails(e.currentTarget.dataset.eventId);
            });
        });
    }

    function renderDay(date, dayEvents, isToday) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayName = dayNames[date.getUTCDay()];
        const dayNum = date.getUTCDate();

        // Separate scheduled events from background tasks
        const scheduled = dayEvents.filter(e => !isFrequentTask(e));
        const background = dayEvents.filter(e => isFrequentTask(e));

        let eventsHtml = '';
        if (scheduled.length === 0 && background.length === 0) {
            eventsHtml = '<div class="no-events">No events</div>';
        } else {
            eventsHtml = scheduled.map(e => renderEvent(e)).join('');
            if (background.length > 0) {
                const safeBackgroundTitle = Utils.escapeHtml(background.map(b => b.title || 'Untitled').join(', '));
                eventsHtml += `<div class="calendar-bg-tasks" title="${safeBackgroundTitle}">
                    ⚙️ ${background.length} background task${background.length > 1 ? 's' : ''}
                </div>`;
            }
        }

        return `
            <div class="calendar-day ${isToday ? 'today' : ''}">
                <div class="day-header">
                    ${dayName}
                    <span class="day-date">${dayNum}</span>
                </div>
                <div class="day-events">
                    ${eventsHtml}
                </div>
            </div>
        `;
    }

    function renderEvent(event) {
        const typeColors = {
            'cron': '#4ecdc4',
            'recurring': '#a855f7',
            'arena': '#ffc107',
            'system': '#6c6c7c',
            'meeting': '#e94560'
        };
        const color = typeColors[event.type] || '#4ecdc4';

        const safeEventId = Utils.escapeHtml(String(event?.id ?? ''));

        return `
            <div class="calendar-event" data-event-id="${safeEventId}" style="border-left: 3px solid ${color}">
                <div class="event-title">${Utils.escapeHtml(event.title)}</div>
                ${event.time ? `<div class="event-time">${Utils.escapeHtml(event.time)}</div>` : ''}
                ${event.recurring ? `<div class="event-recurrence">${Utils.escapeHtml(event.recurring)}</div>` : ''}
            </div>
        `;
    }

    function showEventDetails(eventId) {
        const event = events.find(e => String(e?.id ?? '') === String(eventId ?? ''));
        if (!event) return;

        const panel = document.getElementById('eventDetailPanel');
        const title = document.getElementById('eventDetailTitle');
        const content = document.getElementById('eventDetailContent');
        if (!panel || !title || !content) return;

        title.textContent = event.title;

        let details = '';
        if (event.time) details += `<p><strong>Time:</strong> ${Utils.escapeHtml(event.time)}</p>`;
        if (event.recurring) details += `<p><strong>Recurrence:</strong> ${Utils.escapeHtml(event.recurring)}</p>`;
        if (event.type) details += `<p><strong>Type:</strong> ${Utils.escapeHtml(event.type)}</p>`;
        if (event.source) details += `<p><strong>Source:</strong> ${Utils.escapeHtml(event.source)}</p>`;
        if (event.model) details += `<p><strong>Model:</strong> ${Utils.escapeHtml(event.model)}</p>`;
        if (event.delivery) details += `<p><strong>Delivery:</strong> ${Utils.escapeHtml(event.delivery)}</p>`;
        if (event.description) details += `<p>${Utils.escapeHtml(event.description)}</p>`;
        if (event.lastRun) details += `<p><strong>Last run:</strong> ${Utils.formatRelativeTime(event.lastRun)}</p>`;
        if (event.nextRun) details += `<p><strong>Next run:</strong> ${Utils.formatRelativeTime(event.nextRun)}</p>`;

        content.innerHTML = details || '<p>No details available.</p>';
        panel.classList.add('open');
    }

    function closeEventPanel() {
        const panel = document.getElementById('eventDetailPanel');
        if (panel) panel.classList.remove('open');
    }

    async function refresh() {
        const data = await DataModule.loadCalendar();
        events = data?.events || [];
        render();
    }

    function goToToday() {
        currentWeekStart = getStartOfWeekUTC(new Date());
        render();
    }

    return { init, refresh, goToToday, navigateWeek };
})();

window.CalendarModule = CalendarModule;
