// index.js - Replace your imports with this debug version
console.log('📝 index.js starting to load...')

// Import everything and log what we get
import * as SupabaseModule from './supabase.js'

console.log('📦 Full module import:', SupabaseModule)
console.log('📦 Module keys:', Object.keys(SupabaseModule))
console.log('📦 auth from module:', SupabaseModule.auth)
console.log('📦 supabase from module:', SupabaseModule.supabase)

// Now assign to window
window.supabase = SupabaseModule.supabase
window.auth = SupabaseModule.auth
window.api = SupabaseModule.api
window.realtime = SupabaseModule.realtime
window.storage = SupabaseModule.storage

console.log('🪟 Window objects attached. window.auth is now:', window.auth ? '✅ DEFINED' : '❌ UNDEFINED')

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Theatre Manager with Supabase initialized')
    
    // Check if user is logged in
    const session = await auth.getSession()
    
    if (session) {
        console.log('User is logged in:', session.user)
        document.body.classList.add('user-authenticated')
    } else {
        console.log('User is not logged in')
        document.body.classList.add('user-unauthenticated')
    }
    
    // Initialize based on current page
    initializePageModules()
})

function initializePageModules() {
    const path = window.location.pathname
    
    if (path.includes('people.html')) {
        initializePeoplePage()
    } else if (path.includes('calendar.html')) {
        initializeCalendarPage()
    } else if (path.includes('attendance.html')) {
        initializeAttendancePage()
    } else if (path.includes('props-costumes.html')) {
        initializeInventoryPage()
    } else if (path.includes('files.html')) {
        initializeFilesPage()
    }
}

async function initializePeoplePage() {
    console.log('Initializing People page with Supabase')
    
    // Load students from Supabase
    const { data: students, error } = await api.students.getAll()
    
    if (error) {
        console.error('Error loading students:', error)
        return
    }
    
    // Update the global students array
    window.students = students || []
    
    // Re-render with Supabase data
    if (typeof renderStudents === 'function') {
        renderStudents()
    }
    
    // Set up real-time subscription
    realtime.subscribeToTable('students', (payload) => {
        console.log('Students table changed:', payload)
        
        // Refresh students data
        api.students.getAll().then(({ data }) => {
            window.students = data || []
            if (typeof renderStudents === 'function') {
                renderStudents()
            }
            if (typeof updatePeopleStats === 'function') {
                updatePeopleStats()
            }
        })
    })
}

async function initializeCalendarPage() {
    console.log('Initializing Calendar page with Supabase')
    
    // Load events from Supabase
    const { data: events, error } = await api.events.getAll()
    
    if (error) {
        console.error('Error loading events:', error)
        return
    }
    
    // Convert to format expected by calendar
    const eventsByDate = {}
    events.forEach(event => {
        if (!eventsByDate[event.date]) {
            eventsByDate[event.date] = []
        }
        eventsByDate[event.date].push({
            id: event.id,
            type: event.type,
            title: event.title,
            time: event.time,
            location: event.location,
            description: event.description
        })
    })
    
    // Update calendar manager
    if (window.calendarManager) {
        window.calendarManager.events = eventsByDate
        window.calendarManager.renderMiniCalendar()
        window.calendarManager.renderEventList()
    }
    
    // Set up real-time subscription
    realtime.subscribeToTable('events', (payload) => {
        console.log('Events table changed:', payload)
        // Refresh calendar
        initializeCalendarPage()
    })
}

async function initializeAttendancePage() {
    console.log('Initializing Attendance page with Supabase')
    
    // Load students for attendance
    const { data: students } = await api.students.getAll()
    
    // Load today's attendance
    const today = new Date().toISOString().split('T')[0]
    const { data: attendance } = await api.attendance.getByDate(today)
    
    if (window.attendanceManager) {
        window.attendanceManager.students = students || []
        
        // Convert attendance to the format expected
        const attendanceByDate = {
            [today]: {}
        }
        
        attendance?.forEach(record => {
            attendanceByDate[today][record.student_id] = {
                status: record.status,
                notes: record.notes
            }
        })
        
        window.attendanceManager.attendanceRecords = attendanceByDate
        window.attendanceManager.renderAttendanceList()
    }
}

async function initializeInventoryPage() {
    console.log('Initializing Inventory page with Supabase')
    
    const { data: inventory, error } = await api.inventory.getAll()
    
    if (error) {
        console.error('Error loading inventory:', error)
        return
    }
    
    window.inventory = inventory || []
    
    if (typeof renderInventory === 'function') {
        renderInventory()
    }
    
    realtime.subscribeToTable('inventory', () => {
        api.inventory.getAll().then(({ data }) => {
            window.inventory = data || []
            if (typeof renderInventory === 'function') {
                renderInventory()
            }
        })
    })
}

async function initializeFilesPage() {
    console.log('Initializing Files page with Supabase')
    
    const { data: files, error } = await api.files.getAll()
    
    if (error) {
        console.error('Error loading files:', error)
        return
    }
    
    if (window.fileManager) {
        // Convert to format expected by file manager
        window.fileManager.files = files?.filter(f => f.category === 'file') || []
        window.fileManager.folders = files?.filter(f => f.category === 'folder') || []
        window.fileManager.renderFiles()
    }
}