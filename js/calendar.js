/**
 * Calendar Module - Weekly view of scheduled events
 */

const CalendarModule = (function() {
    let events = [];
    let currentWeekStart = getStartOfWeek(new Date());

    /**
     * Get the Monday of the week containing the given date
     */
    function getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /**
     * Initialize the calendar
     */
    async function init() {
        const data = await DataModule.loadCalendar();
        if (data && data.events) {
            events = data.events;
        }
        
        setupListeners();
        render();
    }

    /**
     * Set up event listeners
     */
    function setupListeners() {
        const prevBtn = document.getElementById('prevWeek');
        const nextBtn = document.getElementById('nextWeek');
        const closeBtn = document.getElementById('closeEventPanel');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => navigateWeek(-1));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => navigateWeek(1));
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', closeEventPanel);
        }
    }

    /**
     * Navigate to previous or next week
     */
    function navigateWeek(direction) {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() + (direction * 7));
        currentWeekStart = newDate;
        render();
    }

    /**
     * Render the calendar grid
     */
    function render() {
        const container = document.getElementById('calendarGrid');
        const weekLabel = document.getElementById('currentWeek');
        
        if (!container) return;

        // Update week label
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        if (weekLabel) {
            const options = { month: 'short', day: 'numeric' };
            weekLabel.textContent = `${currentWeekStart.toLocaleDateString('en-US', options)} — ${weekEnd.toLocaleDateString('en-US', options)}, ${weekEnd.getFullYear()}`;
        }

        // Generate days
        const days = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < 7; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + i);
            
            const dayEvents = getEventsForDate(date);
            const isToday = date.getTime() === today.getTime();
            
            days.push(renderDay(date, dayEvents, isToday));
        }

        container.innerHTML = days.join('');

        // Add click handlers to events
        container.querySelectorAll('.calendar-event').forEach(el => {
            el.addEventListener('click', (e) => {
                const eventId = e.currentTarget.dataset.eventId;
                showEventDetails(eventId);
            });
        });
    }

    /**
     * Get events for a specific date
     */
    function getEventsForDate(date) {
        const dateStr = formatDateKey(date);
        const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        return events.filter(event => {
            // Exact date match
            if (event.date === dateStr) {
                return true;
            }
            
            // Recurring events
            if (event.recurring) {
                const recurrence = event.recurring;
                
                // Daily
                if (recurrence === 'daily') {
                    return true;
                }
                
                // Weekly on specific day
                if (recurrence === 'weekly' && event.dayOfWeek === dayOfWeek) {
                    return true;
                }
                
                // Weekdays
                if (recurrence === 'weekdays' && dayOfWeek >= 1 && dayOfWeek <= 5) {
                    return true;
                }
            }
            
            return false;
        });
    }

    /**
     * Format date as YYYY-MM-DD
     */
    function formatDateKey(date) {
        return date.toISOString().split('T')[0];
    }

    /**
     * Render a single day column
     */
    function renderDay(date, dayEvents, isToday) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayName = dayNames[date.getDay()];
        const dayNum = date.getDate();

        let eventsHtml = '';
        if (dayEvents.length === 0) {
            eventsHtml = '<div class="no-events" style="color: var(--text-muted); font-size: 0.75rem; padding: 8px;">No events</div>';
        } else {
            eventsHtml = dayEvents.map(event => renderEvent(event)).join('');
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

    /**
     * Render a calendar event
     */
    function renderEvent(event) {
        const typeClass = event.type || '';
        const recurringClass = event.recurring ? 'recurring' : '';

        return `
            <div class="calendar-event ${typeClass} ${recurringClass}" data-event-id="${event.id}">
                ${event.time ? `<div class="event-time">${event.time}</div>` : ''}
                <div class="event-title">${escapeHtml(event.title)}</div>
            </div>
        `;
    }

    /**
     * Show event details in the side panel
     */
    function showEventDetails(eventId) {
        const event = events.find(e => e.id === eventId);
        if (!event) return;

        const panel = document.getElementById('eventDetailPanel');
        const title = document.getElementById('eventDetailTitle');
        const content = document.getElementById('eventDetailContent');

        if (!panel || !title || !content) return;

        title.textContent = event.title;
        
        let details = '';
        if (event.time) {
            details += `<p><strong>Time:</strong> ${event.time}</p>`;
        }
        if (event.date) {
            details += `<p><strong>Date:</strong> ${DataModule.formatDate(event.date)}</p>`;
        }
        if (event.recurring) {
            details += `<p><strong>Recurrence:</strong> ${capitalizeFirst(event.recurring)}</p>`;
        }
        if (event.source) {
            details += `<p><strong>Source:</strong> ${event.source}</p>`;
        }
        if (event.description) {
            details += `<p><strong>Description:</strong></p><p>${escapeHtml(event.description)}</p>`;
        }

        content.innerHTML = details || '<p class="placeholder-text">No additional details available.</p>';
        panel.classList.add('open');
    }

    /**
     * Close the event detail panel
     */
    function closeEventPanel() {
        const panel = document.getElementById('eventDetailPanel');
        if (panel) {
            panel.classList.remove('open');
        }
    }

    /**
     * Escape HTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Capitalize first letter
     */
    function capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Refresh calendar data
     */
    async function refresh() {
        events = [];
        const container = document.getElementById('calendarGrid');
        if (container) {
            container.innerHTML = `
                <div class="loading-spinner" style="grid-column: span 7;">
                    <div class="spinner"></div>
                    <span>Loading calendar...</span>
                </div>
            `;
        }
        await init();
    }

    /**
     * Go to today's week
     */
    function goToToday() {
        currentWeekStart = getStartOfWeek(new Date());
        render();
    }

    return {
        init,
        refresh,
        goToToday,
        navigateWeek
    };
})();

// Export for use in main.js
window.CalendarModule = CalendarModule;
