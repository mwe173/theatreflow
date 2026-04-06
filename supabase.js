import { createClient } from '@supabase/supabase-js'

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Add detailed debugging
console.group('🔧 Supabase Configuration')
console.log('VITE_SUPABASE_URL:', supabaseUrl)
console.log('VITE_SUPABASE_ANON_KEY exists:', !!supabaseAnonKey)
console.log('VITE_SUPABASE_ANON_KEY length:', supabaseAnonKey?.length || 0)
console.log('All env vars with VITE_ prefix:', Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')))
console.groupEnd()

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables!')
    console.error('Current values:')
    console.error('URL:', supabaseUrl)
    console.error('Key exists:', !!supabaseAnonKey)
    
    // Don't throw, show helpful message in development
    if (import.meta.env.DEV) {
        const errorDiv = document.createElement('div')
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #dc2626;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            z-index: 10000;
            font-family: monospace;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `
        errorDiv.innerHTML = `
            <strong>⚠️ Configuration Error</strong><br>
            Missing Supabase credentials.<br>
            Please check your .env file and restart the dev server.<br>
            <small>Expected: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY</small>
        `
        document.body.prepend(errorDiv)
    }
}

// Create client only if we have credentials
export const supabase = supabaseUrl && supabaseAnonKey 
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

// Rest of your code with null checks...
export const auth = {
    signIn: async (email, password) => {
        if (!supabase) throw new Error('Supabase not configured')
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        return { data, error }
    },
    signUp: async (email, password, userData) => {
        if (!supabase) throw new Error('Supabase not configured')
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: userData }
        })
        return { data, error }
    },
    signOut: async () => {
        if (!supabase) throw new Error('Supabase not configured')
        const { error } = await supabase.auth.signOut()
        return { error }
    },
    getSession: async () => {
        if (!supabase) return null
        const { data: { session } } = await supabase.auth.getSession()
        return session
    },
    getUser: async () => {
        if (!supabase) return null
        const { data: { user } } = await supabase.auth.getUser()
        return user
    },
    isStaff: async () => {
        const user = await auth.getUser()
        const role = user?.user_metadata?.role
        return role === 'director' || role === 'stage_manager'
    }
}

export const api = {
    students: { 
        getAll: async () => {
            if (!supabase) return { data: [], error: new Error('Supabase not configured') }
            return await supabase.from('students').select('*')
        }
    },
    // In supabase.js, update the events.getAll function:
events: { 
    getAll: async () => {
        if (!supabase) return { data: [], error: new Error('Supabase not configured') }
        
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { data: [], error: new Error('Not authenticated') }
        
        const currentShowId = localStorage.getItem('currentShowId')
        if (!currentShowId) return { data: [], error: new Error('No show selected') }
        
        return await supabase
            .from('events')
            .select('*')
            .eq('user_id', user.id)
            .eq('show_id', currentShowId)
    }
},
    attendance: { 
        getByDate: async (date) => {
            if (!supabase) return { data: [], error: new Error('Supabase not configured') }
            return await supabase.from('attendance').select('*').eq('date', date)
        }
    },
    inventory: { 
        getAll: async () => {
            if (!supabase) return { data: [], error: new Error('Supabase not configured') }
            return await supabase.from('inventory').select('*')
        }
    },
    files: { 
        getAll: async () => {
            if (!supabase) return { data: [], error: new Error('Supabase not configured') }
            return await supabase.from('files').select('*')
        }
    }
}

export const realtime = {
    subscribeToTable: (table, callback) => {
        if (!supabase) return null
        return supabase
            .channel('table-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: table }, callback)
            .subscribe()
    }
}

export const storage = {
    bucket: 'production-files',
    uploadFile: async (file, path = 'uploads') => {
        if (!supabase) return { success: false, error: 'Supabase not configured' }
        try {
            const user = await auth.getUser()
            const userId = user ? user.id : 'anonymous'
            const timestamp = Date.now()
            const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_')
            const filePath = `${userId}/${path}/${timestamp}_${cleanFileName}`
            
            const { error } = await supabase.storage
                .from('production-files')
                .upload(filePath, file)
            
            if (error) throw error
            
            const { data: urlData } = await supabase.storage
                .from('production-files')
                .getPublicUrl(filePath)
            
            return { success: true, path: filePath, url: urlData?.publicUrl }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
}