// supabase.js
import { createClient } from '@supabase/supabase-js'

// These will be replaced by Vite at build time
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables!')
    console.error('Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const auth = {
    signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        return { data, error }
    },
    signUp: async (email, password, userData) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: userData }
        })
        return { data, error }
    },
    signOut: async () => {
        const { error } = await supabase.auth.signOut()
        return { error }
    },
    getSession: async () => {
        const { data: { session } } = await supabase.auth.getSession()
        return session
    },
    getUser: async () => {
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
        getAll: async () => await supabase.from('students').select('*')
    },
    events: {
        getAll: async () => await supabase.from('events').select('*')
    },
    attendance: {
        getByDate: async (date) => await supabase.from('attendance').select('*').eq('date', date)
    },
    inventory: {
        getAll: async () => await supabase.from('inventory').select('*')
    },
    files: {
        getAll: async () => await supabase.from('files').select('*')
    }
}

export const realtime = {
    subscribeToTable: (table, callback) => {
        return supabase
            .channel('table-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: table }, callback)
            .subscribe()
    }
}

export const storage = {
    bucket: 'production-files',
    uploadFile: async (file, path = 'uploads') => {
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