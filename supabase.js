// supabase.js - Using CDN instead of npm package
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

console.log('🚀 Supabase.js loading...')

// Set to Vercel
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Check if credentials exist
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials. Please check your supabase.js file.')
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
console.log('✅ Supabase client created')

export const auth = {
    signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })
        return { data, error }
    },
    
    signUp: async (email, password, userData) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: userData
            }
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

// API helpers
export const api = {
    students: {
        getAll: async () => {
            return await supabase.from('students').select('*')
        },
        getById: async (id) => {
            return await supabase.from('students').select('*').eq('id', id).single()
        },
        create: async (student) => {
            return await supabase.from('students').insert([student])
        },
        update: async (id, updates) => {
            return await supabase.from('students').update(updates).eq('id', id)
        },
        delete: async (id) => {
            return await supabase.from('students').delete().eq('id', id)
        }
    },
    events: {
        getAll: async () => {
            return await supabase.from('events').select('*')
        }
    },
    attendance: {
        getByDate: async (date) => {
            return await supabase.from('attendance').select('*').eq('date', date)
        }
    },
    inventory: {
        getAll: async () => {
            return await supabase.from('inventory').select('*')
        }
    },
    files: {
        getAll: async () => {
            return await supabase.from('files').select('*')
        }
    }
}

export const realtime = {
    subscribeToTable: (table, callback) => {
        return supabase
            .channel('table-changes')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: table },
                callback
            )
            .subscribe()
    }
}

// Storage helper with hardcoded bucket name for local development
export const storage = {
    bucket: 'files', // Hardcoded bucket name
    
    // Upload a file
    uploadFile: async (file, path = 'uploads') => {
        try {
            const user = await auth.getUser()
            const userId = user?.id || 'anonymous'
            const timestamp = Date.now()
            
            // Clean filename to avoid issues
            const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_')
            const filePath = `${userId}/${path}/${timestamp}_${cleanFileName}`
            
            console.log('Uploading to:', filePath)
            
            const { data, error } = await supabase.storage
                .from('files')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                })
            
            if (error) throw error
            
            // Get public URL
            const { data: urlData } = await supabase.storage
                .from('files')
                .getPublicUrl(filePath)
            
            return { 
                success: true, 
                path: filePath, 
                url: urlData?.publicUrl 
            }
        } catch (error) {
            console.error('Upload error:', error)
            return { success: false, error: error.message }
        }
    },
    
    // List files in a folder
    listFiles: async (folderPath = '') => {
        try {
            const { data, error } = await supabase.storage
                .from('files')
                .list(folderPath)
            
            if (error) throw error
            return { success: true, files: data }
        } catch (error) {
            console.error('List error:', error)
            return { success: false, error: error.message }
        }
    },
    
    // Delete a file
    deleteFile: async (filePath) => {
        try {
            const { error } = await supabase.storage
                .from('files')
                .remove([filePath])
            
            if (error) throw error
            return { success: true }
        } catch (error) {
            console.error('Delete error:', error)
            return { success: false, error: error.message }
        }
    },
    
    // Get public URL
    getPublicUrl: (filePath) => {
        const { data } = supabase.storage
            .from('files')
            .getPublicUrl(filePath)
        return data?.publicUrl
    }
}
