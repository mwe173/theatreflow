// ===== CALENDAR PAGE WITH LIST VIEW AND MINI CALENDAR =====
console.log('Calendar page script loaded');

class CalendarManager {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = this.formatDateKey(this.currentDate);
        this.events = {};  // Will be loaded from Supabase
        this.currentFilter = 'all';
        this.searchTerm = '';
        this.eventTypeFilter = 'all';
        
this.eventColors = {
    rehearsal: '#7c3aed',
    tech: '#0891b2',
    performance: '#dc2626',
    workshop: '#d97706',
    other: '#6b7280'
};

this.eventIcons = {
    rehearsal: 'fa-theater-masks',
    tech: 'fa-cog',
    performance: 'fa-ticket-alt',
    workshop: 'fa-chalkboard-teacher',
    other: 'fa-calendar-alt'
};
        
        this.eventIcons = {
            rehearsal: 'fa-theater-masks',
            meeting: 'fa-users',
            performance: 'fa-ticket-alt',
            tech: 'fa-cog',
            workshop: 'fa-chalkboard-teacher',
            audition: 'fa-microphone-alt'
        };
    }

    // ===== SUPABASE FUNCTIONS =====

    // Load events from Supabase
    async loadEventsFromSupabase() {
            try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return {};
        
        const currentShowId = localStorage.getItem('currentShowId');
        if (!currentShowId) return {};
        
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('user_id', user.id)
            .eq('show_id', currentShowId)  // ← ADD THIS LINE
            .order('date');
        
        if (error) throw error;
        
        // Convert to format expected by calendar
        const eventsByDate = {};
        data?.forEach(event => {
            if (!eventsByDate[event.date]) eventsByDate[event.date] = [];
            eventsByDate[event.date].push(event);
        });
        
        return eventsByDate;
    } catch (error) {
        console.error('Error loading events:', error);
        return {};
    }
    }

    // Save event to Supabase
    async saveEventToSupabase(eventData) {
        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.error('No user logged in');
                return { success: false, error: 'Not authenticated' };
            }
            
            // Prepare event data
            const eventRecord = {
                title: eventData.title,
                type: eventData.type,
                date: eventData.date,
                time: eventData.time,
                location: eventData.location || '',
                description: eventData.description || '',
                user_id: user.id
            };
            
            let result;
            
            // If event has an id, update existing record
            if (eventData.id) {
                result = await supabase
                    .from('events')
                    .update(eventRecord)
                    .eq('id', eventData.id)
                    .eq('user_id', user.id)
                    .select();
            } else {
                // Create new record
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

    // Delete event from Supabase
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

    // Initialize calendar
    async initialize() {
        console.log('Initializing CalendarManager...');
        
        // Load events from Supabase
        this.events = await this.loadEventsFromSupabase();
        
        // Render components
        this.renderMiniCalendar();
        this.renderEventList();
        
        console.log('CalendarManager initialized');
    }

    // ===== EXISTING METHODS (with modifications) =====

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
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    }

    getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    getFirstDayOfMonth(year, month) {
        return new Date(year, month, 1).getDay();
    }

    isToday(dateKey) {
        const today = new Date();
        const todayKey = this.formatDateKey(today);
        return dateKey === todayKey;
    }

    // Render mini calendar
    renderMiniCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const daysInMonth = this.getDaysInMonth(year, month);
        const firstDay = this.getFirstDayOfMonth(year, month);
        
        // Update month/year display
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
        
        // Add empty cells for days before month starts
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'mini-calendar-day empty';
            emptyCell.style.pointerEvents = 'none';
            calendarEl.appendChild(emptyCell);
        }
        
        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = this.formatDateKey(new Date(year, month, day));
            const hasEvents = this.events[dateKey] && this.events[dateKey].length > 0;
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
            
            calendarEl.appendChild(dayCell);
        }
        
        console.log('Mini calendar rendered for', monthYearEl?.textContent);
    }

    // Select a date
    selectDate(dateKey) {
        this.selectedDate = dateKey;
        
        // Update the current month to show the selected date's month
        const { year, month } = this.parseDateKey(dateKey);
        this.currentDate = new Date(year, month, 1);
        
        // Re-render mini calendar to show the correct month
        this.renderMiniCalendar();
        
        // Re-render event list with the selected date highlighted
        this.renderEventList();
        
        // Scroll to the selected date group
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

    // Get all events as a flat array with date info
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

    // Filter events based on current filters
    filterEvents(events) {
        return events.filter(event => {
            // Search filter
            if (this.searchTerm) {
                const searchLower = this.searchTerm.toLowerCase();
                const matchesSearch = event.title.toLowerCase().includes(searchLower) ||
                                     (event.location && event.location.toLowerCase().includes(searchLower)) ||
                                     (event.description && event.description.toLowerCase().includes(searchLower));
                if (!matchesSearch) return false;
            }
            
            // Event type filter
            if (this.eventTypeFilter !== 'all' && event.type !== this.eventTypeFilter) {
                return false;
            }
            
            // Date-based filters
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const eventDate = new Date(event.dateKey);
            eventDate.setHours(0, 0, 0, 0);
            
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

    // Group events by date
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

    // Render event list
    renderEventList() {
        const eventListEl = document.getElementById('eventList');
        const eventCountEl = document.getElementById('eventCount');
        const totalEventsEl = document.getElementById('totalEventsCount');
        const monthEventsEl = document.getElementById('monthEventsCount');
        
        if (!eventListEl) {
            console.error('Event list element not found');
            return;
        }
        
        const allEvents = this.getAllEvents();
        const filteredEvents = this.filterEvents(allEvents);
        const groupedEvents = this.groupEventsByDate(filteredEvents);
        
        // Update counts
        if (eventCountEl) {
            eventCountEl.textContent = `${filteredEvents.length} events`;
        }
        
        if (totalEventsEl) {
            totalEventsEl.textContent = allEvents.length;
        }
        
        if (monthEventsEl) {
            const currentMonth = this.currentDate.getMonth();
            const monthEvents = allEvents.filter(e => {
                const eventDate = new Date(e.dateKey);
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
            
            // Add event listener to empty state button
            const emptyStateBtn = document.getElementById('emptyStateAddEventBtn');
            if (emptyStateBtn) {
                emptyStateBtn.addEventListener('click', () => {
                    document.getElementById('openAddEventModal').click();
                });
            }
            return;
        }
        
        let html = '';
        
        Object.entries(groupedEvents).forEach(([dateKey, events]) => {
            const isSelected = dateKey === this.selectedDate;
            const displayDate = this.formatDisplayDate(dateKey);
            
            html += `
                <div class="date-group ${isSelected ? 'selected-date-group' : ''}" data-date-group="${dateKey}">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="font-display font-semibold ${isSelected ? 'text-amber-400' : 'text-amber-100'}">
                            ${displayDate}
                            ${isSelected ? '<span class="ml-2 text-xs bg-amber-600/30 px-2 py-0.5 rounded-full">Selected</span>' : ''}
                        </h3>
                        <span class="text-xs text-amber-200/50">${events.length} event${events.length > 1 ? 's' : ''}</span>
                    </div>
                    
                    <div class="space-y-2">
                        ${events.map(event => this.renderEventItem(event)).join('')}
                    </div>
                </div>
            `;
        });
        
        eventListEl.innerHTML = html;
    }

    renderEventItem(event) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(event.dateKey);
    eventDate.setHours(0, 0, 0, 0);
    
    const isPast = eventDate < today;
    const isToday = eventDate.getTime() === today.getTime();
    
    // Format the time for display
    let displayTime = event.time;
    // If time contains a dash (start-end), you might want to format both parts
    if (event.time && event.time.includes(' - ')) {
        const parts = event.time.split(' - ');
        const startFormatted = this.formatTime(parts[0]);
        const endFormatted = this.formatTime(parts[1]);
        displayTime = `${startFormatted} - ${endFormatted}`;
    } else if (event.time) {
        displayTime = this.formatTime(event.time);
    }
    
    return `
        <div class="event-list-item p-4 rounded-xl cursor-pointer ${isPast ? 'past' : isToday ? 'ongoing' : 'upcoming'}"
             onclick="calendarManager.viewEvent('${event.dateKey}', ${event.id})">
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" 
                     style="background: ${this.eventColors[event.type]}20;">
                    <i class="fas ${this.eventIcons[event.type] || 'fa-calendar-alt'}" style="color: ${this.eventColors[event.type]};"></i>
                </div>
                
                <div class="flex-1 min-w-0">
                    <h4 class="font-medium text-amber-100 mb-1">${event.title}</h4>
                    
                    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-200/70">
                        <span><i class="far fa-clock mr-1"></i>${displayTime}</span>
                        ${event.location ? `<span><i class="fas fa-map-marker-alt mr-1"></i>${event.location}</span>` : ''}
                    </div>
                    
                    <span class="inline-block mt-2 text-xs font-medium px-2 py-1 rounded-full" 
                          style="background: ${this.eventColors[event.type]}20; color: ${this.eventColors[event.type]};">
                        ${this.capitalizeFirst(event.type)}
                    </span>
                </div>
            </div>
        </div>
    `;
}

    viewEvent(dateKey, eventId) {
        const event = this.events[dateKey]?.find(e => e.id === eventId);
        if (!event) return;
        
        const modal = document.getElementById('viewEventModal');
        const titleEl = document.getElementById('viewEventTitle');
        const detailsEl = document.getElementById('viewEventDetails');
        
        titleEl.textContent = event.title;
        
        detailsEl.innerHTML = `
            <div class="space-y-3">
                <div class="flex items-center gap-3 p-3 rounded-lg" style="background: ${this.eventColors[event.type]}10;">
                    <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: ${this.eventColors[event.type]}20;">
                        <i class="fas ${this.eventIcons[event.type]}" style="color: ${this.eventColors[event.type]};"></i>
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
                        <p class="text-amber-100"><i class="fas fa-map-marker-alt mr-2 text-amber-400"></i>${event.location}</p>
                    </div>
                ` : ''}
                
                ${event.description ? `
                    <div class="p-3 rounded-lg bg-amber-600/5">
                        <span class="text-xs text-amber-200/50">Description</span>
                        <p class="text-amber-100 text-sm mt-1">${event.description}</p>
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

    // Add event (modified for Supabase)
    async addEvent(eventData) {
        console.log('Adding event:', eventData);
        
        const result = await this.saveEventToSupabase(eventData);
        
        if (result.success) {
            // Reload events from Supabase
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

    // Update event (modified for Supabase)
    async updateEvent(dateKey, eventId, eventData) {
        console.log('Updating event:', eventId, eventData);
        
        const result = await this.saveEventToSupabase({ ...eventData, id: eventId, date: dateKey });
        
        if (result.success) {
            // Reload events from Supabase
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

    // Delete event (modified for Supabase)
    async deleteEvent(dateKey, eventId) {
        console.log('Deleting event:', eventId);
        
        if (!confirm('Are you sure you want to delete this event?')) return;
        
        const result = await this.deleteEventFromSupabase(eventId);
        
        if (result.success) {
            // Reload events from Supabase
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
    
    // Initialize sidebar from main script if available
    if (typeof initSidebar === 'function') {
        initSidebar();
    }
    
    // Initialize calendar manager with Supabase data
    await calendarManager.initialize();
    
    // Set up event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Month navigation
    const prevBtn = document.getElementById('prevMonthMini');
    const nextBtn = document.getElementById('nextMonthMini');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            calendarManager.changeMonth(-1);
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            calendarManager.changeMonth(1);
        });
    }
    
    // Today button
    const todayBtn = document.getElementById('todayBtn');
    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            calendarManager.goToToday();
        });
    }
    
    // Search input
    const searchInput = document.getElementById('searchEvents');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            calendarManager.searchTerm = e.target.value;
            calendarManager.renderEventList();
        });
    }
    
    // Filter buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            calendarManager.currentFilter = btn.dataset.filter;
            calendarManager.renderEventList();
        });
    });
    
    // Event type filter
    const typeFilter = document.getElementById('eventTypeFilter');
    if (typeFilter) {
        typeFilter.addEventListener('change', (e) => {
            calendarManager.eventTypeFilter = e.target.value;
            calendarManager.renderEventList();
        });
    }
    
    // Add event modal
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
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                dateInput.value = `${year}-${month}-${day}`;
            }
            document.getElementById('eventId').value = '';
            document.getElementById('eventModalTitle').textContent = 'Add New Event';
            document.getElementById('submitEventBtn').textContent = 'Add Event';
            eventForm.reset();
            eventModal.classList.remove('hidden');
            eventModal.classList.add('flex');
        });
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            eventModal.classList.add('hidden');
            eventModal.classList.remove('flex');
        });
    }
    
    if (cancelModalBtn) {
        cancelModalBtn.addEventListener('click', () => {
            eventModal.classList.add('hidden');
            eventModal.classList.remove('flex');
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
    
    // Event form submission (modified for Supabase)
    if (eventForm) {
    eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const eventId = document.getElementById('eventId').value;
        const dateKey = document.getElementById('eventDateInput').value;
        const startTime = document.getElementById('eventStartTime').value;
        const endTime = document.getElementById('eventEndTime').value;
        
        // Combine times for storage
        const timeValue = endTime ? `${startTime} - ${endTime}` : startTime;
        
        const eventData = {
            date: dateKey,
            type: document.getElementById('eventType').value,
            title: document.getElementById('eventTitle').value,
            time: timeValue,  // Store combined time
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
            viewModal.classList.add('hidden');
            viewModal.classList.remove('flex');
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
            document.getElementById('eventTime').value = event.time;
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

// Make calendarManager available globally
window.calendarManager = calendarManager;

// User initialization
async function initializeCalendarWithUser() {
    const isStaff = await auth?.isStaff?.() ?? false;
    if (isStaff) {
        document.getElementById('staffOnlyControls')?.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', initializeCalendarWithUser);