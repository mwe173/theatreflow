// account.js
// ===== ACCOUNT MANAGEMENT =====
import { supabase, auth } from './supabase.js';

console.log('Account management script loaded');

// Global variables
let currentUser = null;
let currentSession = null;

// ===== INITIALIZATION =====

async function initializeAccountManagement() {
    console.log('Initializing account management...');
    
    await loadUserData();
    await loadAccountStats();
    await loadSessions();
    loadPreferences();
    setupEventListeners();
    
    console.log('Account management initialized');
}

async function loadUserData() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        currentUser = user;
        currentSession = await supabase.auth.getSession();
        
        // Get user metadata
        const fullName = user.user_metadata?.full_name || '';
        const email = user.email || '';
        const role = user.user_metadata?.role || 'cast';
        const bio = user.user_metadata?.bio || '';
        const createdAt = user.created_at || new Date().toISOString();
        
        // Format role for display
        const roleDisplay = role.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        
        // Update profile display
        const avatarEl = document.getElementById('profileAvatar');
        const displayNameEl = document.getElementById('profileDisplayName');
        const roleEl = document.getElementById('profileRole');
        const displayEmailEl = document.getElementById('profileDisplayEmail');
        const memberSinceEl = document.getElementById('memberSince');
        
        if (avatarEl) {
            const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            avatarEl.textContent = initials;
        }
        if (displayNameEl) displayNameEl.textContent = fullName || 'User';
        if (roleEl) roleEl.textContent = roleDisplay;
        if (displayEmailEl) displayEmailEl.textContent = email;
        if (memberSinceEl) {
            const date = new Date(createdAt);
            memberSinceEl.textContent = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
        
        // Update form fields
        const nameInput = document.getElementById('fullName');
        const emailInput = document.getElementById('email');
        const roleInput = document.getElementById('role');
        const bioInput = document.getElementById('bio');
        
        if (nameInput) nameInput.value = fullName;
        if (emailInput) emailInput.value = email;
        if (roleInput) roleInput.value = roleDisplay;
        if (bioInput) bioInput.value = user.user_metadata?.bio || '';
        
    } catch (error) {
        console.error('Error loading user data:', error);
        showToast('Failed to load user data', 'error');
    }
}

async function loadAccountStats() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const currentShowId = localStorage.getItem('currentShowId');
        
        // Count shows
        const { count: showsCount, error: showsError } = await supabase
            .from('shows')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);
        
        if (showsError) console.error('Error counting shows:', showsError);
        
        // Count students
        const { count: studentsCount, error: studentsError } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);
        
        if (studentsError) console.error('Error counting students:', studentsError);
        
        // Count events
        const { count: eventsCount, error: eventsError } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);
        
        if (eventsError) console.error('Error counting events:', eventsError);
        
        // Update UI
        const showsCountEl = document.getElementById('showsCount');
        const studentsCountEl = document.getElementById('studentsCount');
        const eventsCountEl = document.getElementById('eventsCount');
        
        if (showsCountEl) showsCountEl.textContent = showsCount || 0;
        if (studentsCountEl) studentsCountEl.textContent = studentsCount || 0;
        if (eventsCountEl) eventsCountEl.textContent = eventsCount || 0;
        
    } catch (error) {
        console.error('Error loading account stats:', error);
        showToast('Failed to load account stats', 'error');
    }
}

async function loadSessions() {
    const sessionsList = document.getElementById('sessionsList');
    if (!sessionsList) return;
    
    try {
        // Get current session info
        const { data: { session } } = await supabase.auth.getSession();
        
        // For demo purposes, we'll show a sample session list
        // In production, you'd need to implement proper session tracking
        const sessions = [
            {
                id: 'current',
                device: 'Current Browser',
                location: 'Current Location',
                lastActive: 'Now',
                isCurrent: true
            }
        ];
        
        sessionsList.innerHTML = sessions.map(session => `
            <div class="session-item ${session.isCurrent ? 'current' : ''}">
                <div class="flex items-center gap-3">
                    <i class="fas ${session.isCurrent ? 'fa-circle text-green-500' : 'fa-desktop text-amber-400'}"></i>
                    <div>
                        <div class="text-sm text-amber-100 font-medium">${session.device}</div>
                        <div class="text-xs text-amber-200/50">${session.location} • Last active: ${session.lastActive}</div>
                    </div>
                </div>
                ${!session.isCurrent ? `
                    <button class="revoke-session text-xs text-red-400 hover:text-red-300" data-session-id="${session.id}">
                        Revoke
                    </button>
                ` : '<span class="text-xs text-green-500">Current Session</span>'}
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading sessions:', error);
    }
}

function loadPreferences() {
    // Dark mode
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        const isDarkMode = localStorage.getItem('theme') === 'dark' || 
                          (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
        darkModeToggle.checked = isDarkMode;
    }
    
    // Email notifications
    const emailNotifications = document.getElementById('emailNotificationsToggle');
    if (emailNotifications) {
        const saved = localStorage.getItem('emailNotifications');
        emailNotifications.checked = saved !== 'false';
    }
    
    // Calendar sync
    const calendarSync = document.getElementById('calendarSyncToggle');
    if (calendarSync) {
        const saved = localStorage.getItem('calendarSync');
        calendarSync.checked = saved === 'true';
    }
}

// ===== PROFILE UPDATE =====

async function updateProfile(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('fullName').value;
    const bio = document.getElementById('bio').value;
    
    if (!fullName) {
        showToast('Please enter your name', 'warning');
        return;
    }
    
    try {
        const { data, error } = await supabase.auth.updateUser({
            data: {
                full_name: fullName,
                bio: bio
            }
        });
        
        if (error) throw error;
        
        showToast('Profile updated successfully!', 'success');
        await loadUserData(); // Refresh display
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showToast('Failed to update profile: ' + error.message, 'error');
    }
}

async function updatePassword(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showToast('Please fill in all password fields', 'warning');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match', 'warning');
        return;
    }
    
    if (newPassword.length < 8) {
        showToast('Password must be at least 8 characters', 'warning');
        return;
    }
    
    try {
        // First, verify current password by trying to sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: currentUser.email,
            password: currentPassword
        });
        
        if (signInError) {
            showToast('Current password is incorrect', 'error');
            return;
        }
        
        // Update password
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });
        
        if (error) throw error;
        
        // Clear form
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        
        showToast('Password updated successfully!', 'success');
        
    } catch (error) {
        console.error('Error updating password:', error);
        showToast('Failed to update password: ' + error.message, 'error');
    }
}

// ===== PREFERENCES =====

function setDarkMode(enabled) {
    if (enabled) {
        localStorage.setItem('theme', 'dark');
        document.body.classList.remove('light-mode');
        document.documentElement.classList.remove('light-mode');
    } else {
        localStorage.setItem('theme', 'light');
        document.body.classList.add('light-mode');
        document.documentElement.classList.add('light-mode');
    }
    
    // Update any theme-dependent UI
    if (typeof window.applyTheme === 'function') {
        window.applyTheme(enabled ? 'dark' : 'light');
    }
}

function setEmailNotifications(enabled) {
    localStorage.setItem('emailNotifications', enabled);
    // In production, you'd update this in your backend
}

function setCalendarSync(enabled) {
    localStorage.setItem('calendarSync', enabled);
    // In production, you'd update this in your backend
}

// ===== DATA EXPORT =====

async function exportAllData() {
    try {
        showToast('Preparing data export...', 'info');
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showToast('Please log in to export data', 'error');
            return;
        }
        
        // Fetch all user data
        const [shows, students, events, inventory, scenes, attendance] = await Promise.all([
            supabase.from('shows').select('*').eq('user_id', user.id),
            supabase.from('students').select('*').eq('user_id', user.id),
            supabase.from('events').select('*').eq('user_id', user.id),
            supabase.from('inventory').select('*').eq('user_id', user.id),
            supabase.from('scenes').select('*').eq('user_id', user.id),
            supabase.from('attendance').select('*').eq('user_id', user.id)
        ]);
        
        const exportData = {
            exportDate: new Date().toISOString(),
            user: {
                email: user.email,
                metadata: user.user_metadata,
                createdAt: user.created_at
            },
            shows: shows.data || [],
            students: students.data || [],
            events: events.data || [],
            inventory: inventory.data || [],
            scenes: scenes.data || [],
            attendance: attendance.data || []
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `theatreflow-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        showToast('Data exported successfully!', 'success');
        
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast('Failed to export data: ' + error.message, 'error');
    }
}

// ===== ACCOUNT DELETION =====

function showDeleteAccountModal() {
    const modal = document.getElementById('deleteAccountModal');
    const confirmInput = document.getElementById('deleteConfirmText');
    const confirmBtn = document.getElementById('confirmDeleteAccountBtn');
    
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        // Reset input and button
        if (confirmInput) {
            confirmInput.value = '';
            confirmInput.classList.remove('border-red-500');
        }
        if (confirmBtn) confirmBtn.disabled = true;
    }
}

function closeDeleteAccountModal() {
    const modal = document.getElementById('deleteAccountModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function deleteAccount() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // Delete all user data from tables
        const tables = ['shows', 'students', 'events', 'inventory', 'scenes', 'attendance', 'files', 'folders'];
        
        for (const table of tables) {
            const { error } = await supabase
                .from(table)
                .delete()
                .eq('user_id', user.id);
            
            if (error) console.error(`Error deleting from ${table}:`, error);
        }
        
        // Sign out and redirect to login
        await supabase.auth.signOut();
        window.location.href = 'login.html?deleted=true';
        
    } catch (error) {
        console.error('Error deleting account:', error);
        showToast('Failed to delete account: ' + error.message, 'error');
        closeDeleteAccountModal();
    }
}

// ===== SESSION MANAGEMENT =====

async function signOutAllDevices() {
    try {
        const { error } = await supabase.auth.signOut({ scope: 'global' });
        
        if (error) throw error;
        
        showToast('Signed out from all devices', 'success');
        window.location.href = 'login.html';
        
    } catch (error) {
        console.error('Error signing out all devices:', error);
        showToast('Failed to sign out all devices', 'error');
    }
}

// ===== EVENT LISTENERS =====

function setupEventListeners() {
    // Profile form
    const profileForm = document.getElementById('profileForm');
    if (profileForm) profileForm.addEventListener('submit', updateProfile);
    
    // Password form
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) passwordForm.addEventListener('submit', updatePassword);
    
    // Avatar upload
    const avatarUpload = document.getElementById('avatarUpload');
    if (avatarUpload) {
        avatarUpload.addEventListener('change', handleAvatarUpload);
    }
    
    // Preferences toggles
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', (e) => setDarkMode(e.target.checked));
    }
    
    const emailNotificationsToggle = document.getElementById('emailNotificationsToggle');
    if (emailNotificationsToggle) {
        emailNotificationsToggle.addEventListener('change', (e) => setEmailNotifications(e.target.checked));
    }
    
    const calendarSyncToggle = document.getElementById('calendarSyncToggle');
    if (calendarSyncToggle) {
        calendarSyncToggle.addEventListener('change', (e) => setCalendarSync(e.target.checked));
    }
    
    // Danger zone buttons
    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) exportDataBtn.addEventListener('click', exportAllData);
    
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) deleteAccountBtn.addEventListener('click', showDeleteAccountModal);
    
    const signOutAllBtn = document.getElementById('signOutAllDevices');
    if (signOutAllBtn) signOutAllBtn.addEventListener('click', signOutAllDevices);
    
    // Delete account modal
    const confirmDeleteBtn = document.getElementById('confirmDeleteAccountBtn');
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', deleteAccount);
    
    const cancelDeleteBtn = document.getElementById('cancelDeleteAccountBtn');
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteAccountModal);
    
    const closeDeleteModal = document.getElementById('closeDeleteAccountModal');
    if (closeDeleteModal) closeDeleteModal.addEventListener('click', closeDeleteAccountModal);
    
    const deleteModal = document.getElementById('deleteAccountModal');
    if (deleteModal) {
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) closeDeleteAccountModal();
        });
    }
    
    // Delete confirmation input
    const deleteConfirmText = document.getElementById('deleteConfirmText');
    if (deleteConfirmText) {
        deleteConfirmText.addEventListener('input', (e) => {
            const confirmBtn = document.getElementById('confirmDeleteAccountBtn');
            if (confirmBtn) {
                confirmBtn.disabled = e.target.value !== 'DELETE';
            }
        });
    }
}

async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'warning');
        return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
        showToast('Image must be less than 2MB', 'warning');
        return;
    }
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // Upload to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file);
        
        if (uploadError) throw uploadError;
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
        
        // Update user metadata
        const { error: updateError } = await supabase.auth.updateUser({
            data: { avatar_url: publicUrl }
        });
        
        if (updateError) throw updateError;
        
        // Update avatar display
        const avatarDiv = document.getElementById('profileAvatar');
        if (avatarDiv) {
            avatarDiv.style.backgroundImage = `url(${publicUrl})`;
            avatarDiv.style.backgroundSize = 'cover';
            avatarDiv.style.backgroundPosition = 'center';
            avatarDiv.textContent = '';
        }
        
        showToast('Profile picture updated!', 'success');
        
    } catch (error) {
        console.error('Error uploading avatar:', error);
        showToast('Failed to upload avatar: ' + error.message, 'error');
    }
}

function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }
    
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close"><i class="fas fa-times"></i></button>
    `;
    
    container.appendChild(toast);
    
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => toast.remove());
    
    setTimeout(() => toast.remove(), 4000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM loaded, initializing account management');
    
    if (typeof initSidebar === 'function') {
        initSidebar();
    }
    
    await initializeAccountManagement();
});