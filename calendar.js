// ===== CALENDAR PAGE WITH LIST VIEW AND MINI CALENDAR =====
console.log('Calendar page script loaded');

class CalendarManager {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = this.formatDateKey(this.currentDate);
        this.events = {};
        this.currentFilter = 'all';
        this.searchTerm = '';
        this.eventTypeFilter = 'all';
        
        // Event colors - distinct colors for each type
        this.eventColors = {
            rehearsal: '#7c3aed',   // Purple
            tech: '#0891b2',         // Cyan/Teal
            performance: '#dc2626',  // Red
            workshop: '#d97706',     // Orange/Amber
            other: '#6b806b'         // Gray
        };
        
        // Event icons
        this.eventIcons = {
            rehearsal: 'fa-theater-masks',
            tech: 'fa-cog',
            performance: 'fa-ticket-alt',
            workshop: 'fa-chalkboard-teacher',
            other: 'fa-calendar-alt'
        };
    }

    // ===== HELPER METHOD - SAFE DATE PARSING =====
    // Parse date string YYYY-MM-DD without timezone issues
    parseDateSafely(dateKey) {
        const [year, month, day] = dateKey.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    // ===== SUPABASE FUNCTIONS =====

    async loadEventsFromSupabase() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return {};
            
            const currentShowId = localStorage.getItem('currentShowId');
            if (!currentShowId) {
                console.log('No show selected - returning empty events');
                return {};
            }
            
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('user_id', user.id)
                .eq('show_id', currentShowId)
                .order('date');
            
            if (error) throw error;
            
            const eventsByDate = {};
            data?.forEach(event => {
                if (!eventsByDate[event.date]) eventsByDate[event.date] = [];
                eventsByDate[event.date].push(event);
            });
            
            console.log(`Loaded ${data?.length || 0} events for show ${currentShowId}`);
            return eventsByDate;
        } catch (error) {
            console.error('Error loading events:', error);
            return {};
        }
    }

    async saveEventToSupabase(eventData) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return { success: false, error: 'Not authenticated' };
            }
            
            const currentShowId = localStorage.getItem('currentShowId');
            if (!currentShowId) {
                return { success: false, error: 'No show selected. Please create or select a show in Settings.' };
            }
            
            const eventRecord = {
                title: eventData.title,
                type: eventData.type,
                date: eventData.date,
                time: eventData.time,
                location: eventData.location || '',
                description: eventData.description || '',
                user_id: user.id,
                show_id: currentShowId
            };
            
            let result;
            
            if (eventData.id) {
                result = await supabase
                    .from('events')
                    .update(eventRecord)
                    .eq('id', eventData.id)
                    .eq('user_id', user.id)
                    .select();
            } else {
                result = await supabase
                    .from('events')
                    .insert([eventRecord])
                    .select();
            }
            
            if (result.error) throw result.error;
            
            return { success: true, data: result.data?.[0] };
        } catch (error) {
            console.error('Error saving event:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteEventFromSupabase(eventId) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return { success: false, error: 'Not authenticated' };
            }
            
            const { error } = await supabase
                .from('events')
                .delete()
                .eq('id', eventId)
                .eq('user_id', user.id);
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting event:', error);
            return { success: false, error: error.message };
        }
    }

    async initialize() {
        console.log('Initializing CalendarManager...');
        this.events = await this.loadEventsFromSupabase();
        this.renderMiniCalendar();
        this.renderEventList();
        console.log('CalendarManager initialized');
    }

    // ===== HELPER METHODS =====

    formatDateKey(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    parseDateKey(dateKey) {
        const [year, month, day] = dateKey.split('-').map(Number);
        return { year, month: month - 1, day };
    }

    formatDisplayDate(dateKey) {
        const { year, month, day } = this.parseDateKey(dateKey);
        const date = new Date(year, month, day);
        return date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    formatShortDate(dateKey) {
        const { year, month, day } = this.parseDateKey(dateKey);
        const date = new Date(year, month, day);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    getFirstDayOfMonth(year, month) {
        return new Date(year, month, 1).getDay();
    }

    isToday(dateKey) {
        const today = this.formatDateKey(new Date());
        return dateKey === today;
    }

    // Render mini calendar
    renderMiniCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const daysInMonth = this.getDaysInMonth(year, month);
        const firstDay = this.getFirstDayOfMonth(year, month);
        
        const monthYearEl = document.getElementById('miniMonthYear');
        if (monthYearEl) {
            monthYearEl.textContent = this.currentDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long' 
            });
        }
        
        const calendarEl = document.getElementById('miniCalendar');
        if (!calendarEl) {
            console.error('Mini calendar element not found');
            return;
        }
        
        calendarEl.innerHTML = '';
        
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'mini-calendar-day empty';
            emptyCell.style.pointerEvents = 'none';
            calendarEl.appendChild(emptyCell);
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = this.formatDateKey(new Date(year, month, day));
            const dayEvents = this.events[dateKey] || [];
            const hasEvents = dayEvents.length > 0;
            const isSelected = dateKey === this.selectedDate;
            const isToday = this.isToday(dateKey);
            
            const dayCell = document.createElement('div');
            let classes = 'mini-calendar-day';
            if (hasEvents) classes += ' has-event';
            if (isSelected) classes += ' selected';
            if (isToday) classes += ' today';
            
            dayCell.className = classes;
            dayCell.textContent = day;
            dayCell.setAttribute('data-date', dateKey);
            dayCell.addEventListener('click', () => this.selectDate(dateKey));
            
            // Add event type dots with correct colors - positioned below the date
            if (hasEvents && dayEvents.length > 0) {
                const dotsContainer = document.createElement('div');
                dotsContainer.className = 'event-dots';
                
                // Get unique event types for this day
                const uniqueTypes = [...new Set(dayEvents.map(e => e.type))];
                uniqueTypes.slice(0, 3).forEach(type => {
                    const dot = document.createElement('span');
                    dot.className = 'event-dot';
                    dot.style.backgroundColor = this.eventColors[type] || '#94a3b8';
                    dotsContainer.appendChild(dot);
                });
                
                dayCell.appendChild(dotsContainer);
            }
            
            calendarEl.appendChild(dayCell);
        }
        
        console.log('Mini calendar rendered');
    }

    selectDate(dateKey) {
        this.selectedDate = dateKey;
        const { year, month } = this.parseDateKey(dateKey);
        this.currentDate = new Date(year, month, 1);
        this.renderMiniCalendar();
        this.renderEventList();
        
        setTimeout(() => {
            const dateGroup = document.querySelector(`[data-date-group="${dateKey}"]`);
            if (dateGroup) {
                dateGroup.scrollIntoView({ behavior: 'smooth', block: 'start' });
                dateGroup.classList.add('highlight-date-group');
                setTimeout(() => {
                    dateGroup.classList.remove('highlight-date-group');
                }, 2000);
            }
        }, 100);
    }

    getAllEvents() {
        const allEvents = [];
        for (const [dateKey, events] of Object.entries(this.events)) {
            events.forEach(event => {
                allEvents.push({
                    ...event,
                    dateKey,
                    displayDate: this.formatDisplayDate(dateKey),
                    shortDate: this.formatShortDate(dateKey)
                });
            });
        }
        return allEvents;
    }

    filterEvents(events) {
        return events.filter(event => {
            if (this.searchTerm) {
                const searchLower = this.searchTerm.toLowerCase();
                const matchesSearch = event.title.toLowerCase().includes(searchLower) ||
                                     (event.location && event.location.toLowerCase().includes(searchLower)) ||
                                     (event.description && event.description.toLowerCase().includes(searchLower));
                if (!matchesSearch) return false;
            }
            
            if (this.eventTypeFilter !== 'all' && event.type !== this.eventTypeFilter) {
                return false;
            }
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            // Use safe date parsing
            const eventDate = this.parseDateSafely(event.dateKey);
            
            switch (this.currentFilter) {
                case 'upcoming':
                    return eventDate >= today;
                case 'today':
                    return event.dateKey === this.formatDateKey(today);
                case 'week':
                    const weekFromNow = new Date(today);
                    weekFromNow.setDate(today.getDate() + 7);
                    return eventDate >= today && eventDate <= weekFromNow;
                case 'month':
                    return eventDate.getMonth() === today.getMonth() &&
                           eventDate.getFullYear() === today.getFullYear();
                default:
                    return true;
            }
        });
    }

    groupEventsByDate(events) {
        const grouped = {};
        events.forEach(event => {
            if (!grouped[event.dateKey]) {
                grouped[event.dateKey] = [];
            }
            grouped[event.dateKey].push(event);
        });
        
        return Object.keys(grouped)
            .sort((a, b) => new Date(a) - new Date(b))
            .reduce((obj, key) => {
                obj[key] = grouped[key];
                return obj;
            }, {});
    }

    renderEventList() {
        const eventListEl = document.getElementById('eventList');
        const eventCountEl = document.getElementById('eventCount');
        const totalEventsEl = document.getElementById('totalEventsCount');
        const monthEventsEl = document.getElementById('monthEventsCount');
        
        if (!eventListEl) return;
        
        const allEvents = this.getAllEvents();
        const filteredEvents = this.filterEvents(allEvents);
        
        // Get today's date - set to start of day for proper comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const pastEvents = [];
        const currentEvents = [];
        const upcomingEvents = [];
        
        filteredEvents.forEach(event => {
            // Use safe date parsing to avoid timezone issues
            const eventDate = this.parseDateSafely(event.dateKey);
            
            if (eventDate < today) {
                pastEvents.push(event);
            } else if (eventDate.getTime() === today.getTime()) {
                currentEvents.push(event);
            } else {
                upcomingEvents.push(event);
            }
        });
        
        // Sort events
        pastEvents.sort((a, b) => this.parseDateSafely(b.dateKey) - this.parseDateSafely(a.dateKey));
        upcomingEvents.sort((a, b) => this.parseDateSafely(a.dateKey) - this.parseDateSafely(b.dateKey));
        currentEvents.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        
        // Update counts
        if (eventCountEl) eventCountEl.textContent = `${filteredEvents.length} events`;
        if (totalEventsEl) totalEventsEl.textContent = allEvents.length;
        
        if (monthEventsEl) {
            const currentMonth = this.currentDate.getMonth();
            const monthEvents = allEvents.filter(e => {
                const eventDate = this.parseDateSafely(e.dateKey);
                return eventDate.getMonth() === currentMonth;
            }).length;
            monthEventsEl.textContent = monthEvents;
        }
        
        if (filteredEvents.length === 0) {
            eventListEl.innerHTML = `
                <div class="text-center py-12 text-amber-200/50">
                    <i class="fas fa-calendar-times text-4xl mb-3 opacity-50"></i>
                    <p>No events found</p>
                    <button id="emptyStateAddEventBtn" 
                            class="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors text-sm">
                        <i class="fas fa-plus mr-2"></i>Add Your First Event
                    </button>
                </div>
            `;
            const emptyStateBtn = document.getElementById('emptyStateAddEventBtn');
            if (emptyStateBtn) {
                emptyStateBtn.addEventListener('click', () => {
                    document.getElementById('openAddEventModal').click();
                });
            }
            return;
        }
        
        let html = '';
        
        // Helper function to render a section
        const renderSection = (title, events, icon, bgColor, borderColor, showToggle = true) => {
            if (events.length === 0) return '';
            
            const sectionId = `section-${title.replace(/\s/g, '')}`;
            
            return `
                <div class="mb-6">
                    <div class="flex items-center justify-between mb-3 cursor-pointer section-header" data-section="${sectionId}">
                        <div class="flex items-center gap-2">
                            <i class="fas ${icon} ${bgColor}"></i>
                            <h3 class="font-display font-semibold text-amber-100">${title}</h3>
                            <span class="text-xs text-amber-200/50 ml-1">(${events.length})</span>
                        </div>
                        ${showToggle ? `<i class="fas fa-chevron-up text-amber-200/50 text-sm section-toggle"></i>` : ''}
                    </div>
                    <div id="${sectionId}" class="space-y-3 pl-2 border-l-2 ${borderColor}">
                        ${events.map(event => this.renderEventItem(event)).join('')}
                    </div>
                </div>
            `;
        };
        
        // Build the HTML with sections
        html += renderSection('Current Events', currentEvents, 'fa-calendar-day', 'text-blue-400', 'border-blue-500/50', currentEvents.length > 0);
        html += renderSection('Upcoming Events', upcomingEvents, 'fa-calendar-week', 'text-green-400', 'border-green-500/50', true);
        html += renderSection('Past Events', pastEvents, 'fa-calendar-check', 'text-gray-400', 'border-gray-500/50', true);
        
        eventListEl.innerHTML = html;
        
        // Add toggle functionality for sections
        document.querySelectorAll('.section-header').forEach(header => {
            header.addEventListener('click', () => {
                const sectionId = header.dataset.section;
                const content = document.getElementById(sectionId);
                const toggleIcon = header.querySelector('.section-toggle');
                
                if (content) {
                    if (content.style.display === 'none') {
                        content.style.display = 'block';
                        if (toggleIcon) {
                            toggleIcon.classList.remove('fa-chevron-down');
                            toggleIcon.classList.add('fa-chevron-up');
                        }
                    } else {
                        content.style.display = 'none';
                        if (toggleIcon) {
                            toggleIcon.classList.remove('fa-chevron-up');
                            toggleIcon.classList.add('fa-chevron-down');
                        }
                    }
                }
            });
        });
    }

    renderEventItem(event) {
        // Get today's date at midnight for comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Use safe date parsing
        const eventDate = this.parseDateSafely(event.dateKey);
        
        // Determine if event is past, today, or future based on DATE only
        const isPast = eventDate < today;
        const isToday = eventDate.getTime() === today.getTime();
        
        let displayTime = event.time;
        if (event.time && event.time.includes(' - ')) {
            const parts = event.time.split(' - ');
            displayTime = `${this.formatTime(parts[0])} - ${this.formatTime(parts[1])}`;
        } else if (event.time) {
            displayTime = this.formatTime(event.time);
        }
        
        const color = this.eventColors[event.type] || '#6b7280';
        const shortDate = this.formatShortDate(event.dateKey);
        
        // Set styling based on event date
        let borderStyle = '';
        let bgColor = '';
        let titleClass = '';
        let timeClass = '';
        let opacityClass = '';
        
        if (isPast) {
            // Past events - faded
            borderStyle = 'border: 1px solid #334155;';
            bgColor = '#1e293b';
            titleClass = 'text-gray-400';
            timeClass = 'text-gray-500';
            opacityClass = 'opacity-70 hover:opacity-100';
        } else if (isToday) {
            // Today's events - highlighted
            borderStyle = 'border: 1px solid rgba(245, 158, 11, 0.3); border-left: 4px solid #f9c66e;';
            bgColor = 'rgba(245, 158, 11, 0.1)';
            titleClass = 'text-amber-100';
            timeClass = 'text-amber-200/70';
            opacityClass = '';
        } else {
            // Future events - normal
            borderStyle = 'border: 1px solid #334155;';
            bgColor = '#1e293b';
            titleClass = 'text-amber-100';
            timeClass = 'text-amber-200/70';
            opacityClass = '';
        }
        
        return `
            <div class="event-list-item p-4 rounded-xl cursor-pointer transition-all ${opacityClass}" 
                 style="background: ${bgColor}; ${borderStyle}"
                 onclick="calendarManager.viewEvent('${event.dateKey}', ${event.id})">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" 
                         style="background: ${color}20;">
                        <i class="fas ${this.eventIcons[event.type] || 'fa-calendar-alt'}" style="color: ${color};"></i>
                    </div>
                    
                    <div class="flex-1 min-w-0">
                        <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <h4 class="font-medium ${titleClass}">${this.escapeHtml(event.title)}</h4>
                            <span class="text-xs ${timeClass}">
                                <i class="far fa-calendar-alt mr-1"></i>${shortDate}
                            </span>
                        </div>
                        
                        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs ${timeClass}">
                            <span><i class="far fa-clock mr-1"></i>${displayTime}</span>
                            ${event.location ? `<span><i class="fas fa-map-marker-alt mr-1"></i>${this.escapeHtml(event.location)}</span>` : ''}
                        </div>
                        
                        <div class="flex flex-wrap items-center gap-2 mt-2">
                            <span class="inline-block text-xs font-medium px-2 py-1 rounded-full" 
                                  style="background: ${color}20; color: ${color};">
                                ${this.capitalizeFirst(event.type)}
                            </span>
                            ${isToday ? '<span class="inline-block text-xs font-medium px-2 py-1 rounded-full bg-amber-500/20 text-amber-400">Today</span>' : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    viewEvent(dateKey, eventId) {
        const event = this.events[dateKey]?.find(e => e.id === eventId);
        if (!event) return;
        
        const modal = document.getElementById('viewEventModal');
        const titleEl = document.getElementById('viewEventTitle');
        const detailsEl = document.getElementById('viewEventDetails');
        const color = this.eventColors[event.type] || '#6b7280';
        
        titleEl.textContent = event.title;
        
        detailsEl.innerHTML = `
            <div class="space-y-3">
                <div class="flex items-center gap-3 p-3 rounded-lg" style="background: ${color}10;">
                    <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: ${color}20;">
                        <i class="fas ${this.eventIcons[event.type] || 'fa-calendar-alt'}" style="color: ${color};"></i>
                    </div>
                    <div>
                        <span class="text-xs text-amber-200/50">Event Type</span>
                        <p class="text-amber-100 font-medium">${this.capitalizeFirst(event.type)}</p>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="p-3 rounded-lg bg-amber-600/5">
                        <span class="text-xs text-amber-200/50">Date</span>
                        <p class="text-amber-100">${this.formatDisplayDate(dateKey)}</p>
                    </div>
                    <div class="p-3 rounded-lg bg-amber-600/5">
                        <span class="text-xs text-amber-200/50">Time</span>
                        <p class="text-amber-100">${event.time}</p>
                    </div>
                </div>
                ${event.location ? `
                    <div class="p-3 rounded-lg bg-amber-600/5">
                        <span class="text-xs text-amber-200/50">Location</span>
                        <p class="text-amber-100">${this.escapeHtml(event.location)}</p>
                    </div>
                ` : ''}
                ${event.description ? `
                    <div class="p-3 rounded-lg bg-amber-600/5">
                        <span class="text-xs text-amber-200/50">Description</span>
                        <p class="text-amber-100 text-sm mt-1">${this.escapeHtml(event.description)}</p>
                    </div>
                ` : ''}
            </div>
        `;
        
        detailsEl.setAttribute('data-datekey', dateKey);
        detailsEl.setAttribute('data-eventid', eventId);
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    capitalizeFirst(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    formatTime(time24) {
        if (!time24) return '';
        const [hours, minutes] = time24.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    }

    async addEvent(eventData) {
        console.log('Adding event:', eventData);
        const result = await this.saveEventToSupabase(eventData);
        
        if (result.success) {
            this.events = await this.loadEventsFromSupabase();
            this.renderMiniCalendar();
            this.renderEventList();
            return { success: true };
        } else {
            console.error('Failed to add event:', result.error);
            alert('Error adding event: ' + result.error);
            return { success: false, error: result.error };
        }
    }

    async updateEvent(dateKey, eventId, eventData) {
        console.log('Updating event:', eventId, eventData);
        const result = await this.saveEventToSupabase({ ...eventData, id: eventId, date: dateKey });
        
        if (result.success) {
            this.events = await this.loadEventsFromSupabase();
            this.renderMiniCalendar();
            this.renderEventList();
            return { success: true };
        } else {
            console.error('Failed to update event:', result.error);
            alert('Error updating event: ' + result.error);
            return { success: false, error: result.error };
        }
    }

    async deleteEvent(dateKey, eventId) {
        console.log('Deleting event:', eventId);
        
        if (!confirm('Are you sure you want to delete this event?')) return;
        
        const result = await this.deleteEventFromSupabase(eventId);
        
        if (result.success) {
            this.events = await this.loadEventsFromSupabase();
            this.renderMiniCalendar();
            this.renderEventList();
            
            const viewModal = document.getElementById('viewEventModal');
            if (viewModal) {
                viewModal.classList.add('hidden');
                viewModal.classList.remove('flex');
            }
        } else {
            console.error('Failed to delete event:', result.error);
            alert('Error deleting event: ' + result.error);
        }
    }

    goToToday() {
        const today = new Date();
        this.currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
        this.selectedDate = this.formatDateKey(today);
        this.renderMiniCalendar();
        this.renderEventList();
        
        setTimeout(() => {
            const dateGroup = document.querySelector(`[data-date-group="${this.selectedDate}"]`);
            if (dateGroup) {
                dateGroup.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }

    changeMonth(delta) {
        this.currentDate.setMonth(this.currentDate.getMonth() + delta);
        this.renderMiniCalendar();
    }
}

// Initialize calendar manager
const calendarManager = new CalendarManager();

// DOM Elements
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM loaded, initializing calendar page');
    
    if (typeof initSidebar === 'function') {
        initSidebar();
    }
    
    await calendarManager.initialize();
    setupEventListeners();
});

function setupEventListeners() {
    const prevBtn = document.getElementById('prevMonthMini');
    const nextBtn = document.getElementById('nextMonthMini');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => calendarManager.changeMonth(-1));
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => calendarManager.changeMonth(1));
    }
    
    const todayBtn = document.getElementById('todayBtn');
    if (todayBtn) {
        todayBtn.addEventListener('click', () => calendarManager.goToToday());
    }
    
    const searchInput = document.getElementById('searchEvents');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            calendarManager.searchTerm = e.target.value;
            calendarManager.renderEventList();
        });
    }
    
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            calendarManager.currentFilter = btn.dataset.filter;
            calendarManager.renderEventList();
        });
    });
    
    const typeFilter = document.getElementById('eventTypeFilter');
    if (typeFilter) {
        typeFilter.addEventListener('change', (e) => {
            calendarManager.eventTypeFilter = e.target.value;
            calendarManager.renderEventList();
        });
    }
    
    // Modal setup
    const openModalBtn = document.getElementById('openAddEventModal');
    const closeModalBtn = document.getElementById('closeEventModal');
    const cancelModalBtn = document.getElementById('cancelEventModal');
    const eventModal = document.getElementById('eventModal');
    const eventForm = document.getElementById('eventForm');
    
    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            const dateInput = document.getElementById('eventDateInput');
            if (dateInput) {
                const today = new Date();
                dateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            }
            document.getElementById('eventId').value = '';
            document.getElementById('eventModalTitle').textContent = 'Add New Event';
            document.getElementById('submitEventBtn').textContent = 'Add Event';
            eventForm?.reset();
            eventModal?.classList.remove('hidden');
            eventModal?.classList.add('flex');
        });
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            eventModal?.classList.add('hidden');
            eventModal?.classList.remove('flex');
        });
    }
    
    if (cancelModalBtn) {
        cancelModalBtn.addEventListener('click', () => {
            eventModal?.classList.add('hidden');
            eventModal?.classList.remove('flex');
        });
    }
    
    if (eventModal) {
        eventModal.addEventListener('click', (e) => {
            if (e.target === eventModal) {
                eventModal.classList.add('hidden');
                eventModal.classList.remove('flex');
            }
        });
    }
    
    if (eventForm) {
        eventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const eventId = document.getElementById('eventId').value;
            const dateKey = document.getElementById('eventDateInput').value;
            const startTime = document.getElementById('eventStartTime')?.value;
            const endTime = document.getElementById('eventEndTime')?.value;
            const timeValue = endTime ? `${startTime} - ${endTime}` : startTime;
            
            const eventData = {
                date: dateKey,
                type: document.getElementById('eventType').value,
                title: document.getElementById('eventTitle').value,
                time: timeValue,
                location: document.getElementById('eventLocation').value,
                description: document.getElementById('eventDescription').value
            };
            
            let result;
            if (eventId) {
                result = await calendarManager.updateEvent(dateKey, parseInt(eventId), eventData);
            } else {
                result = await calendarManager.addEvent(eventData);
            }
            
            if (result && result.success) {
                eventModal.classList.add('hidden');
                eventModal.classList.remove('flex');
            }
        });
    }
    
    // View modal close
    const closeViewModal = document.getElementById('closeViewModal');
    const viewModal = document.getElementById('viewEventModal');
    
    if (closeViewModal) {
        closeViewModal.addEventListener('click', () => {
            viewModal?.classList.add('hidden');
            viewModal?.classList.remove('flex');
        });
    }
    
    if (viewModal) {
        viewModal.addEventListener('click', (e) => {
            if (e.target === viewModal) {
                viewModal.classList.add('hidden');
                viewModal.classList.remove('flex');
            }
        });
    }
    
    // Edit from view modal
    const editFromViewBtn = document.getElementById('editFromViewBtn');
    if (editFromViewBtn) {
        editFromViewBtn.addEventListener('click', () => {
            const detailsEl = document.getElementById('viewEventDetails');
            const dateKey = detailsEl.dataset.datekey;
            const eventId = parseInt(detailsEl.dataset.eventid);
            
            const eventsForDate = calendarManager.events[dateKey] || [];
            const event = eventsForDate.find(e => e.id === eventId);
            if (!event) return;
            
            viewModal.classList.add('hidden');
            viewModal.classList.remove('flex');
            
            document.getElementById('eventId').value = eventId;
            document.getElementById('eventDateInput').value = dateKey;
            document.getElementById('eventType').value = event.type;
            document.getElementById('eventTitle').value = event.title;
            
            // Handle time field
            const timeField = document.getElementById('eventTime');
            if (timeField) timeField.value = event.time;
            
            document.getElementById('eventLocation').value = event.location || '';
            document.getElementById('eventDescription').value = event.description || '';
            
            document.getElementById('eventModalTitle').textContent = 'Edit Event';
            document.getElementById('submitEventBtn').textContent = 'Save Changes';
            
            document.getElementById('eventModal').classList.remove('hidden');
            document.getElementById('eventModal').classList.add('flex');
        });
    }
    
    // Delete from view modal
    const deleteFromViewBtn = document.getElementById('deleteFromViewBtn');
    if (deleteFromViewBtn) {
        deleteFromViewBtn.addEventListener('click', async () => {
            const detailsEl = document.getElementById('viewEventDetails');
            const dateKey = detailsEl.dataset.datekey;
            const eventId = parseInt(detailsEl.dataset.eventid);
            await calendarManager.deleteEvent(dateKey, eventId);
        });
    }
}

window.calendarManager = calendarManager;