// index.js - Fixed version with show filtering
console.log('📝 index.js starting to load...')

// Import everything
import * as SupabaseModule from './supabase.js'

console.log('📦 Full module import:', SupabaseModule)

// Assign to window
window.supabase = SupabaseModule.supabase
window.auth = SupabaseModule.auth
window.api = SupabaseModule.api
window.realtime = SupabaseModule.realtime
window.storage = SupabaseModule.storage

console.log('🪟 Window objects attached. window.auth is now:', window.auth ? '✅ DEFINED' : '❌ UNDEFINED')

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Theatre Manager with Supabase initialized')
    
    const session = await auth.getSession()
    
    if (session) {
        console.log('User is logged in:', session.user?.email)
        document.body.classList.add('user-authenticated')
    } else {
        console.log('User is not logged in')
        document.body.classList.add('user-unauthenticated')
    }
    
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
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const currentShowId = localStorage.getItem('currentShowId')
    if (!currentShowId) {
        console.log('No show selected')
        return
    }
    
    const { data: students, error } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user.id)
        .eq('show_id', currentShowId)
    
    if (error) {
        console.error('Error loading students:', error)
        return
    }
    
    window.students = students || []
    
    if (typeof renderStudents === 'function') {
        renderStudents()
    }
}

async function initializeCalendarPage() {
    console.log('Initializing Calendar page with Supabase')
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        console.log('No user logged in')
        return
    }
    
    const currentShowId = localStorage.getItem('currentShowId')
    if (!currentShowId) {
        console.log('No show selected - calendar will show empty')
        if (window.calendarManager) {
            window.calendarManager.events = {}
            window.calendarManager.renderMiniCalendar()
            window.calendarManager.renderEventList()
        }
        return
    }
    
    const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .eq('show_id', currentShowId)
        .order('date')
    
    if (error) {
        console.error('Error loading events:', error)
        return
    }
    
    console.log(`Loaded ${events?.length || 0} events for show ${currentShowId}`)
    
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
    
    if (window.calendarManager) {
        window.calendarManager.events = eventsByDate
        window.calendarManager.renderMiniCalendar()
        window.calendarManager.renderEventList()
    }
}

async function initializeAttendancePage() {
    console.log('Initializing Attendance page with Supabase')
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const currentShowId = localStorage.getItem('currentShowId')
    if (!currentShowId) return
    
    const { data: students } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user.id)
        .eq('show_id', currentShowId)
    
    const today = new Date().toISOString().split('T')[0]
    const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', today)
    
    if (window.attendanceManager) {
        window.attendanceManager.students = students || []
        
        const attendanceByDate = { [today]: {} }
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
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const currentShowId = localStorage.getItem('currentShowId')
    if (!currentShowId) return
    
    const { data: inventory, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', user.id)
        .eq('show_id', currentShowId)
    
    if (error) {
        console.error('Error loading inventory:', error)
        return
    }
    
    window.inventory = inventory || []
    
    if (typeof renderInventory === 'function') {
        renderInventory()
    }
}

async function initializeFilesPage() {
    console.log('Initializing Files page with Supabase')
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const currentShowId = localStorage.getItem('currentShowId')
    if (!currentShowId) return
    
    const { data: files, error } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', user.id)
        .eq('show_id', currentShowId)
    
    if (error) {
        console.error('Error loading files:', error)
        return
    }
    
    if (window.fileManager) {
        window.fileManager.files = files?.filter(f => f.category === 'file') || []
        window.fileManager.folders = files?.filter(f => f.category === 'folder') || []
        window.fileManager.renderFiles()
    }
}