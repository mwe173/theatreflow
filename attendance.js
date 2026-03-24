// ===== ATTENDANCE TRACKER =====
console.log('Attendance script loaded');

class AttendanceManager {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = this.formatDateKey(this.currentDate);
        this.students = [];
        this.attendanceRecords = {};
        this.searchTerm = '';
        this.roleFilter = 'all';
        this.statusFilter = 'all';
        
    }

    // Load students from Supabase
    async loadStudentsFromSupabase() {
        try {
            console.log('Loading students from Supabase...');
            
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) {
                console.log('No user logged in');
                return [];
            }
            
            // Fetch students for this user
            const { data, error } = await supabase
                .from('students')
                .select('*')
                .eq('user_id', user.id)
                .order('name');
            
            if (error) {
                console.error('Error loading students:', error);
                return [];
            }
            
            console.log(`Loaded ${data?.length || 0} students from Supabase`);
            return data || [];
        } catch (error) {
            console.error('Exception loading students:', error);
            return [];
        }
    }

    // Load attendance for a specific date
    async loadAttendanceFromSupabase(date) {
        try {
            console.log(`Loading attendance for ${date}...`);
            
            const { data, error } = await supabase
                .from('attendance')
                .select('*')
                .eq('date', date);
            
            if (error) {
                console.error('Error loading attendance:', error);
                return {};
            }
            
            // Convert to the format expected by the app
            const attendanceByStudent = {};
            data?.forEach(record => {
                attendanceByStudent[record.student_id] = {
                    status: record.status,
                    notes: record.notes || ''
                };
            });
            
            console.log(`Loaded ${data?.length || 0} attendance records`);
            return attendanceByStudent;
        } catch (error) {
            console.error('Exception loading attendance:', error);
            return {};
        }
    }

   // Save attendance records for a date
async saveAttendanceToSupabase(date, attendanceData) {
    try {
        console.log(`Saving attendance for ${date}...`);
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error('No user logged in');
            return false;
        }
        
        // Prepare records for upsert
        const records = [];
        for (const [studentId, data] of Object.entries(attendanceData)) {
            records.push({
                student_id: parseInt(studentId),
                date: date,
                status: data.status,
                notes: data.notes || '',
                user_id: user.id
            });
        }
        
        if (records.length === 0) {
            console.log('No attendance records to save');
            return true;
        }
        
        // Use upsert instead of delete+insert
        // This will update existing records or insert new ones
        const { error } = await supabase
            .from('attendance')
            .upsert(records, {
                onConflict: 'student_id, date', // Specify the conflict columns
                ignoreDuplicates: false // Set to true if you want to ignore conflicts
            });
        
        if (error) {
            console.error('Error saving attendance:', error);
            return false;
        }
        
        console.log(`Saved ${records.length} attendance records`);
        return true;
    } catch (error) {
        console.error('Exception saving attendance:', error);
        return false;
    }
}
    // ===== INITIALIZATION =====

    async initialize() {
        console.log('Initializing AttendanceManager...');
        
        // Load students from Supabase
        this.students = await this.loadStudentsFromSupabase();
        
        // Load attendance for selected date
        this.attendanceRecords = {};
        this.attendanceRecords[this.selectedDate] = await this.loadAttendanceFromSupabase(this.selectedDate);
        
        // Render components
        this.renderDatePicker();
        this.selectDate(this.selectedDate);
        
        console.log('AttendanceManager initialized');
    }

    // Format date key (YYYY-MM-DD)
    formatDateKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    // Format display date
    formatDisplayDate(dateKey) {
        const [year, month, day] = dateKey.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    // Get days in month
    getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    // Get first day of month (0 = Sunday)
    getFirstDayOfMonth(year, month) {
        return new Date(year, month, 1).getDay();
    }

    // Render date picker
    renderDatePicker() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const daysInMonth = this.getDaysInMonth(year, month);
        const firstDay = this.getFirstDayOfMonth(year, month);
        
        // Update month/year display
        const monthYearEl = document.getElementById('currentMonthYear');
        if (monthYearEl) {
            monthYearEl.textContent = this.currentDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long' 
            });
        }
        
        const gridEl = document.getElementById('datePickerGrid');
        if (!gridEl) return;
        
        gridEl.innerHTML = '';
        
        // Add empty cells for days before month starts
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'date-picker-day opacity-0';
            gridEl.appendChild(emptyCell);
        }
        
        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = this.formatDateKey(new Date(year, month, day));
            const hasAttendance = this.attendanceRecords[dateKey] && 
                                 Object.keys(this.attendanceRecords[dateKey]).length > 0;
            const isSelected = dateKey === this.selectedDate;
            const isToday = this.isToday(dateKey);
            
            const dayCell = document.createElement('div');
            dayCell.className = `date-picker-day ${hasAttendance ? 'has-attendance' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'text-amber-400 font-bold' : ''}`;
            dayCell.textContent = day;
            dayCell.setAttribute('data-date', dateKey);
            dayCell.addEventListener('click', () => this.selectDate(dateKey));
            
            gridEl.appendChild(dayCell);
        }
    }

    // Check if date is today
    isToday(dateKey) {
        const today = this.formatDateKey(new Date());
        return dateKey === today;
    }

    // Select a date
    async selectDate(dateKey) {
        this.selectedDate = dateKey;
        
        // Update UI
        document.querySelectorAll('.date-picker-day').forEach(el => {
            el.classList.remove('selected');
            if (el.getAttribute('data-date') === dateKey) {
                el.classList.add('selected');
            }
        });
        
        // Update selected date display
        const selectedDateEl = document.getElementById('selectedDateDisplay');
        if (selectedDateEl) {
            selectedDateEl.textContent = this.formatDisplayDate(dateKey);
        }
        
        // Load attendance for this date if not already loaded
        if (!this.attendanceRecords[dateKey]) {
            this.attendanceRecords[dateKey] = await this.loadAttendanceFromSupabase(dateKey);
        }
        
        // Render attendance list
        this.renderAttendanceList();
        this.updateStats();
    }

    // Helper methods for status colors
    getStatusBackgroundColor(status) {
        const colors = {
            'present': 'rgba(16, 185, 129, 0.2)',
            'absent': 'rgba(239, 68, 68, 0.2)',
            'excused': 'rgba(99, 102, 241, 0.2)',
            'late': 'rgba(245, 158, 11, 0.2)'
        };
        return colors[status] || 'rgba(180, 83, 9, 0.2)';
    }

    getStatusTextColor(status) {
        const colors = {
            'present': '#10b981',
            'absent': '#ef4444',
            'excused': '#6366f1',
            'late': '#f59e0b'
        };
        return colors[status] || '#fbbf24';
    }

    getStatusBorderColor(status) {
        const colors = {
            'present': 'rgba(16, 185, 129, 0.3)',
            'absent': 'rgba(239, 68, 68, 0.3)',
            'excused': 'rgba(99, 102, 241, 0.3)',
            'late': 'rgba(245, 158, 11, 0.3)'
        };
        return colors[status] || 'rgba(180, 83, 9, 0.3)';
    }

    // Render attendance list
    renderAttendanceList() {
        const listEl = document.getElementById('attendanceList');
        if (!listEl) return;
        
        // Filter students
        let filteredStudents = [...this.students];
        
        // Search filter
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            filteredStudents = filteredStudents.filter(s => 
                s.name.toLowerCase().includes(searchLower)
            );
        }
        
        // Role filter
        if (this.roleFilter !== 'all') {
            filteredStudents = filteredStudents.filter(s => 
                s.roles && s.roles.includes(this.roleFilter)
            );
        }
        
        // Get attendance for selected date
        const dayAttendance = this.attendanceRecords[this.selectedDate] || {};
        
        // Status filter
        if (this.statusFilter !== 'all') {
            filteredStudents = filteredStudents.filter(s => 
                dayAttendance[s.id]?.status === this.statusFilter
            );
        }
        
        if (filteredStudents.length === 0) {
            listEl.innerHTML = `
                <div class="text-center py-12 text-amber-200/50 bg-amber-600/5 rounded-xl">
                    <i class="fas fa-user-slash text-4xl mb-3 opacity-50"></i>
                    <p>No students found</p>
                </div>
            `;
            return;
        }
        
        listEl.innerHTML = filteredStudents.map(student => {
            const attendance = dayAttendance[student.id] || {
                status: 'present',
                notes: ''
            };
            
            const roleBadge = this.getRoleBadge(student.roles);
            
            return `
                <div class="student-row bg-amber-600/5 border border-amber-600/10 hover:border-amber-600/30" data-student-id="${student.id}">
                    <div class="student-info">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-white font-semibold flex-shrink-0">
                            ${student.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                        </div>
                        <div>
                            <h4 class="font-medium text-amber-100">${student.name}</h4>
                            <div class="flex items-center gap-2 text-xs">
                                <span class="text-amber-200/50">Grade ${student.grade}</span>
                                ${roleBadge}
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex justify-center">
                        <select class="status-select px-3 py-2 rounded-lg text-sm w-32 ${attendance.status}"
                                data-student-id="${student.id}"
                                style="background-color: ${this.getStatusBackgroundColor(attendance.status)}; color: ${this.getStatusTextColor(attendance.status)}; border: 1px solid ${this.getStatusBorderColor(attendance.status)};">
                            <option value="present" ${attendance.status === 'present' ? 'selected' : ''} style="background-color: #1e293b; color: #e2e8f0;">Present</option>
                            <option value="absent" ${attendance.status === 'absent' ? 'selected' : ''} style="background-color: #1e293b; color: #e2e8f0;">Absent</option>
                            <option value="late" ${attendance.status === 'late' ? 'selected' : ''} style="background-color: #1e293b; color: #e2e8f0;">Late</option>
                            <option value="excused" ${attendance.status === 'excused' ? 'selected' : ''} style="background-color: #1e293b; color: #e2e8f0;">Excused</option>
                        </select>
                    </div>
                    
                    <div class="flex justify-center">
                        <input type="text" class="notes-field" 
                               value="${attendance.notes || ''}" 
                               placeholder="Add notes..."
                               data-student-id="${student.id}">
                    </div>
                </div>
            `;
        }).join('');
        
        // Add event listeners
        this.attachEventListeners();
    }

    // Get role badge HTML
    getRoleBadge(roles) {
        if (!roles || roles.length === 0) return '';
        
        const roleColors = {
            main: 'bg-purple-600/20 text-purple-400',
            ensemble: 'bg-emerald-600/20 text-emerald-400',
            crew: 'bg-blue-600/20 text-blue-400'
        };
        
        const roleLabels = {
            main: 'Main',
            ensemble: 'Ens',
            crew: 'Crew'
        };
        
        const mainRole = roles[0];
        return `<span class="px-2 py-0.5 rounded-full text-xs ${roleColors[mainRole] || 'bg-amber-600/20 text-amber-400'}">${roleLabels[mainRole] || mainRole}</span>`;
    }

    // Update statistics
    updateStats() {
        const dayAttendance = this.attendanceRecords[this.selectedDate] || {};
        
        let present = 0, absent = 0, late = 0, excused = 0;
        
        this.students.forEach(student => {
            const status = dayAttendance[student.id]?.status || 'present';
            if (status === 'present') present++;
            else if (status === 'absent') absent++;
            else if (status === 'late') late++;
            else if (status === 'excused') excused++;
        });
        
        const total = this.students.length;
        
        document.getElementById('totalStudentsStat').textContent = total;
        document.getElementById('presentCount').textContent = present;
        document.getElementById('absentCount').textContent = absent;
        document.getElementById('otherCount').textContent = late + excused;
    }

    // Update attendance record from input
    async updateAttendance(studentId, field, value) {
        if (!this.attendanceRecords[this.selectedDate]) {
            this.attendanceRecords[this.selectedDate] = {};
        }
        
        if (!this.attendanceRecords[this.selectedDate][studentId]) {
            this.attendanceRecords[this.selectedDate][studentId] = {
                status: 'present',
                notes: ''
            };
        }
        
        this.attendanceRecords[this.selectedDate][studentId][field] = value;
        
        // If status changed, update stats and the select element's styling
        if (field === 'status') {
            this.updateStats();
            
            // Find and update the select element's styling
            const selectEl = document.querySelector(`.status-select[data-student-id="${studentId}"]`);
            if (selectEl) {
                selectEl.style.backgroundColor = this.getStatusBackgroundColor(value);
                selectEl.style.color = this.getStatusTextColor(value);
                selectEl.style.borderColor = this.getStatusBorderColor(value);
            }
        }
        
        // Auto-save to Supabase
        await this.saveAttendanceToSupabase(this.selectedDate, this.attendanceRecords[this.selectedDate]);
        this.updateLastSaved();
    }

    // Mark all as present
    async markAllPresent() {
        if (!this.attendanceRecords[this.selectedDate]) {
            this.attendanceRecords[this.selectedDate] = {};
        }
        
        this.students.forEach(student => {
            this.attendanceRecords[this.selectedDate][student.id] = {
                status: 'present',
                notes: this.attendanceRecords[this.selectedDate][student.id]?.notes || ''
            };
        });
        
        this.renderAttendanceList();
        this.updateStats();
        await this.saveAttendanceToSupabase(this.selectedDate, this.attendanceRecords[this.selectedDate]);
        this.updateLastSaved();
    }

    // Quick action: set all to status
    async quickSetAll(status) {
        if (!this.attendanceRecords[this.selectedDate]) {
            this.attendanceRecords[this.selectedDate] = {};
        }
        
        // Filter students based on current filters
        let filteredStudents = [...this.students];
        
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            filteredStudents = filteredStudents.filter(s => 
                s.name.toLowerCase().includes(searchLower)
            );
        }
        
        if (this.roleFilter !== 'all') {
            filteredStudents = filteredStudents.filter(s => 
                s.roles && s.roles.includes(this.roleFilter)
            );
        }
        
        filteredStudents.forEach(student => {
            this.attendanceRecords[this.selectedDate][student.id] = {
                status: status,
                notes: this.attendanceRecords[this.selectedDate][student.id]?.notes || ''
            };
        });
        
        this.renderAttendanceList();
        this.updateStats();
        await this.saveAttendanceToSupabase(this.selectedDate, this.attendanceRecords[this.selectedDate]);
        this.updateLastSaved();
    }

    // Quick action: set role to present
    async quickSetRolePresent(role) {
        if (!this.attendanceRecords[this.selectedDate]) {
            this.attendanceRecords[this.selectedDate] = {};
        }
        
        const roleStudents = this.students.filter(s => s.roles && s.roles.includes(role));
        
        roleStudents.forEach(student => {
            this.attendanceRecords[this.selectedDate][student.id] = {
                status: 'present',
                notes: this.attendanceRecords[this.selectedDate][student.id]?.notes || ''
            };
        });
        
        this.renderAttendanceList();
        this.updateStats();
        await this.saveAttendanceToSupabase(this.selectedDate, this.attendanceRecords[this.selectedDate]);
        this.updateLastSaved();
    }

    // Update last saved timestamp
    updateLastSaved() {
        const lastSavedEl = document.getElementById('lastSaved');
        if (lastSavedEl) {
            const now = new Date();
            lastSavedEl.textContent = now.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
            });
        }
    }

    // Helper function to capitalize first letter
    capitalizeFirst(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    // Attach event listeners to dynamic elements
    attachEventListeners() {
        // Status selects
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const studentId = parseInt(e.target.dataset.studentId);
                const newStatus = e.target.value;
                
                // Update the select element's styling immediately
                e.target.style.backgroundColor = this.getStatusBackgroundColor(newStatus);
                e.target.style.color = this.getStatusTextColor(newStatus);
                e.target.style.borderColor = this.getStatusBorderColor(newStatus);
                
                this.updateAttendance(studentId, 'status', newStatus);
            });
        });
        
        // Notes fields - update on blur (when focus leaves)
        document.querySelectorAll('.notes-field').forEach(input => {
            input.addEventListener('blur', (e) => {
                const studentId = parseInt(e.target.dataset.studentId);
                this.updateAttendance(studentId, 'notes', e.target.value);
            });
            
            // Optional: update on Enter key
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                }
            });
        });
    }
}

// Initialize attendance manager
const attendanceManager = new AttendanceManager();

// DOM Ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM loaded, initializing attendance page');
    
    // Initialize sidebar
    if (typeof initSidebar === 'function') {
        initSidebar();
    }
    
    // Initialize attendance manager with Supabase data
    await attendanceManager.initialize();
    
    // Set up event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Month navigation
    const prevBtn = document.getElementById('prevMonthBtn');
    const nextBtn = document.getElementById('nextMonthBtn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            attendanceManager.currentDate.setMonth(attendanceManager.currentDate.getMonth() - 1);
            attendanceManager.renderDatePicker();
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            attendanceManager.currentDate.setMonth(attendanceManager.currentDate.getMonth() + 1);
            attendanceManager.renderDatePicker();
        });
    }
    
    // Today button
    const todayBtn = document.getElementById('todayDateBtn');
    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            const today = new Date();
            attendanceManager.currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
            attendanceManager.renderDatePicker();
            attendanceManager.selectDate(attendanceManager.formatDateKey(today));
        });
    }
    
    // Search input
    const searchInput = document.getElementById('searchStudents');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            attendanceManager.searchTerm = e.target.value;
            attendanceManager.renderAttendanceList();
        });
    }
    
    // Role filter
    const roleFilter = document.getElementById('roleFilter');
    if (roleFilter) {
        roleFilter.addEventListener('change', (e) => {
            attendanceManager.roleFilter = e.target.value;
            attendanceManager.renderAttendanceList();
        });
    }
    
    // Status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            attendanceManager.statusFilter = e.target.value;
            attendanceManager.renderAttendanceList();
        });
    }
    
    // Mark all present button
    const markAllBtn = document.getElementById('markAllPresentBtn');
    if (markAllBtn) {
        markAllBtn.addEventListener('click', () => {
            attendanceManager.markAllPresent();
        });
    }
    
    // Save attendance button
    const saveBtn = document.getElementById('saveAttendanceBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            await attendanceManager.saveAttendanceToSupabase(
                attendanceManager.selectedDate, 
                attendanceManager.attendanceRecords[attendanceManager.selectedDate] || {}
            );
            attendanceManager.updateLastSaved();
            alert('Attendance saved successfully!');
        });
    }
    
    // Reset button
    const resetBtn = document.getElementById('resetAttendanceBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            if (confirm('Reset all changes for this date?')) {
                await attendanceManager.selectDate(attendanceManager.selectedDate);
            }
        });
    }
    
    // Quick attendance modal
    const quickBtn = document.getElementById('quickAttendanceBtn');
    const quickModal = document.getElementById('quickAttendanceModal');
    const closeQuickBtn = document.getElementById('closeQuickModal');
    const applyQuickBtn = document.getElementById('applyQuickActions');
    
    if (quickBtn) {
        quickBtn.addEventListener('click', () => {
            quickModal.classList.remove('hidden');
            quickModal.classList.add('flex');
        });
    }
    
    if (closeQuickBtn) {
        closeQuickBtn.addEventListener('click', () => {
            quickModal.classList.add('hidden');
            quickModal.classList.remove('flex');
        });
    }
    
    if (quickModal) {
        quickModal.addEventListener('click', (e) => {
            if (e.target === quickModal) {
                quickModal.classList.add('hidden');
                quickModal.classList.remove('flex');
            }
        });
    }
    
    // Quick action buttons
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = btn.dataset.action;
            
            switch(action) {
                case 'present':
                    attendanceManager.quickSetAll('present');
                    break;
                case 'absent':
                    attendanceManager.quickSetAll('absent');
                    break;
                case 'late':
                    attendanceManager.quickSetAll('late');
                    break;
                case 'excused':
                    attendanceManager.quickSetAll('excused');
                    break;
                case 'main-present':
                    attendanceManager.quickSetRolePresent('main');
                    break;
                case 'ensemble-present':
                    attendanceManager.quickSetRolePresent('ensemble');
                    break;
                case 'crew-present':
                    attendanceManager.quickSetRolePresent('crew');
                    break;
                case 'clear-all':
                    if (confirm('Clear all attendance for current filters?')) {
                        const filteredStudents = attendanceManager.students.filter(s => {
                            if (attendanceManager.searchTerm) {
                                return s.name.toLowerCase().includes(attendanceManager.searchTerm.toLowerCase());
                            }
                            return true;
                        }).filter(s => {
                            if (attendanceManager.roleFilter !== 'all') {
                                return s.roles && s.roles.includes(attendanceManager.roleFilter);
                            }
                            return true;
                        });
                        
                        filteredStudents.forEach(student => {
                            delete attendanceManager.attendanceRecords[attendanceManager.selectedDate]?.[student.id];
                        });
                        
                        attendanceManager.renderAttendanceList();
                        attendanceManager.saveAttendanceToSupabase(
                            attendanceManager.selectedDate, 
                            attendanceManager.attendanceRecords[attendanceManager.selectedDate] || {}
                        );
                    }
                    break;
            }
        });
    });
    
    if (applyQuickBtn) {
        applyQuickBtn.addEventListener('click', () => {
            quickModal.classList.add('hidden');
            quickModal.classList.remove('flex');
        });
    }
    
    // Export button
    const exportBtn = document.getElementById('exportAttendanceBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const data = {
                date: attendanceManager.selectedDate,
                attendance: attendanceManager.attendanceRecords[attendanceManager.selectedDate],
                students: attendanceManager.students
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `attendance-${attendanceManager.selectedDate}.json`;
            a.click();
        });
    }
}

// User initialization
async function initializeAttendanceWithUser() {
    const isStaff = await auth?.isStaff?.() ?? false;
    if (isStaff) {
        document.getElementById('staffOnlyControls')?.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', initializeAttendanceWithUser);