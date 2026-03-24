// login.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// Get environment variables from Vite (these will be replaced at build time)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Supabase credentials not configured')
}

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Loading functions
function showLoading(message) {
    const overlay = document.getElementById('loadingOverlay')
    const messageEl = document.getElementById('loadingMessage')
    if (messageEl) messageEl.textContent = message
    if (overlay) {
        overlay.classList.remove('hidden')
        overlay.classList.add('flex')
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay')
    if (overlay) {
        overlay.classList.add('hidden')
        overlay.classList.remove('flex')
    }
}

// Toggle forms
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

// Login handler
window.handleLogin = async function() {
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value
    const errorEl = document.getElementById('loginError')
    
    if (!email || !password) {
        errorEl.textContent = 'Please enter both email and password'
        errorEl.classList.remove('hidden')
        return
    }
    
    showLoading('Signing in...')
    errorEl.classList.add('hidden')
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        })
        
        hideLoading()
        
        if (error) {
            errorEl.textContent = error.message
            errorEl.classList.remove('hidden')
        } else {
            window.location.href = 'index.html'
        }
    } catch (err) {
        hideLoading()
        errorEl.textContent = err.message
        errorEl.classList.remove('hidden')
    }
}

// Signup handler
window.handleSignup = async function() {
    const name = document.getElementById('fullName').value
    const email = document.getElementById('signupEmail').value
    const password = document.getElementById('signupPassword').value
    const role = document.getElementById('signupRole').value
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
    
    showLoading('Creating account...')
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
        
        hideLoading()
        
        if (error) {
            errorEl.textContent = error.message
            errorEl.classList.remove('hidden')
        } else {
            alert('Account created! You can now sign in.')
            window.showLogin()
            
            // Clear signup form
            document.getElementById('fullName').value = ''
            document.getElementById('signupEmail').value = ''
            document.getElementById('signupPassword').value = ''
        }
    } catch (err) {
        hideLoading()
        errorEl.textContent = err.message
        errorEl.classList.remove('hidden')
    }
}

// Check if already logged in
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession()
    if (session) {
        window.location.href = 'index.html'
    }
}

// Run when page loads
document.addEventListener('DOMContentLoaded', checkSession)