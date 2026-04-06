// login.js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Check if credentials are available
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase credentials!')
    console.error('For local development: create .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
    console.error('For production: set environment variables in Vercel dashboard')
    
    // Show user-friendly error
    document.body.innerHTML = `
        <div class="min-h-screen flex items-center justify-center bg-gray-900">
            <div class="bg-red-900/20 p-8 rounded-lg border border-red-600/30 text-center">
                <i class="fas fa-exclamation-triangle text-red-400 text-4xl mb-4"></i>
                <h1 class="text-red-400 text-xl mb-2">Configuration Error</h1>
                <p class="text-gray-300">Missing Supabase credentials. Please contact the administrator.</p>
            </div>
        </div>
    `
    throw new Error('Missing Supabase credentials')
}

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Loading functions
window.showLoading = function(message) {
    const overlay = document.getElementById('loadingOverlay')
    const messageEl = document.getElementById('loadingMessage')
    if (messageEl) messageEl.textContent = message
    if (overlay) {
        overlay.classList.remove('hidden')
        overlay.classList.add('flex')
    }
}

window.hideLoading = function() {
    const overlay = document.getElementById('loadingOverlay')
    if (overlay) {
        overlay.classList.add('hidden')
        overlay.classList.remove('flex')
    }
}

window.showSignup = function() {
    document.getElementById('loginForm').classList.add('hidden')
    document.getElementById('signupForm').classList.remove('hidden')
    document.getElementById('loginError').classList.add('hidden')
    document.getElementById('signupError').classList.add('hidden')
}

window.showLogin = function() {
    document.getElementById('signupForm').classList.add('hidden')
    document.getElementById('loginForm').classList.remove('hidden')
    document.getElementById('loginError').classList.add('hidden')
    document.getElementById('signupError').classList.add('hidden')
}

// In login.js, update the handleLogin function - add this after successful login
window.handleLogin = async function() {
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value
    const errorEl = document.getElementById('loginError')
    
    if (!email || !password) {
        errorEl.textContent = 'Please enter both email and password'
        errorEl.classList.remove('hidden')
        return
    }
    
    window.showLoading('Signing in...')
    errorEl.classList.add('hidden')
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        })
        
        window.hideLoading()
        
        if (error) {
            errorEl.textContent = error.message
            errorEl.classList.remove('hidden')
        } else {
            // CHECK IF USER HAS ANY SHOWS
            const { data: shows, error: showsError } = await supabaseClient
                .from('shows')
                .select('id')
                .eq('user_id', data.user.id)
                .limit(1)
            
            if (showsError) {
                console.error('Error checking shows:', showsError)
                window.location.href = 'index.html'
                return
            }
            
            // If no shows exist, redirect to settings page with welcome message
            if (!shows || shows.length === 0) {
                // Store a flag to show welcome message
                localStorage.setItem('newUserWelcome', 'true')
                window.location.href = 'settings.html?new=true'
            } else {
                // Check if this is a returning user who just created their first show
                const justCreatedShow = localStorage.getItem('justCreatedShow')
                if (justCreatedShow === 'true') {
                    localStorage.removeItem('justCreatedShow')
                    // Show a toast or alert that they can now add data
                    setTimeout(() => {
                        alert('🎉 Welcome! Your show is ready. Now you can:\n\n• Add students to your cast & crew\n• Create calendar events\n• Track attendance\n• Manage props and costumes')
                    }, 500)
                }
                window.location.href = 'index.html'
            }
        }
    } catch (err) {
        window.hideLoading()
        errorEl.textContent = err.message
        errorEl.classList.remove('hidden')
    }
}

window.handleSignup = async function() {
    const name = document.getElementById('fullName').value
    const email = document.getElementById('signupEmail').value
    const password = document.getElementById('signupPassword').value
    const role = 'director'
    const errorEl = document.getElementById('signupError')
    
    if (!name || !email || !password) {
        errorEl.textContent = 'Please fill in all fields'
        errorEl.classList.remove('hidden')
        return
    }
    
    if (password.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters'
        errorEl.classList.remove('hidden')
        return
    }
    
    window.showLoading('Creating account...')
    errorEl.classList.add('hidden')
    
    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    role: role
                }
            }
        })
        
        window.hideLoading()
        
        if (error) {
            errorEl.textContent = error.message
            errorEl.classList.remove('hidden')
        } else {
            alert('Account created! You can now sign in.')
            window.showLogin()
            
            document.getElementById('fullName').value = ''
            document.getElementById('signupEmail').value = ''
            document.getElementById('signupPassword').value = ''
        }
    } catch (err) {
        window.hideLoading()
        errorEl.textContent = err.message
        errorEl.classList.remove('hidden')
    }
}

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession()
    if (session) {
        window.location.href = 'index.html'
    }
}

document.addEventListener('DOMContentLoaded', checkSession)