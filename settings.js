// ===== SETTINGS MANAGEMENT =====
console.log('Settings script loaded');

// Global variables
let shows = [];
let currentShowId = localStorage.getItem('currentShowId') || null;

// DOM Elements
let showSelect, currentShowNameSpan, createNewShowBtn;
let createShowModal, closeCreateShowModal, cancelCreateShowBtn, confirmCreateShowBtn;
let newShowNameInput, copyFromShowSelect;
let themeSelect, notificationsSelect;
let saveSettingsBtn, cancelSettingsBtn;

// ===== LOAD FUNCTIONS =====

// Load user's shows from Supabase
async function loadShows() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data, error } = await supabase
            .from('shows')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        shows = data || [];
        
        // Populate show select dropdowns
        if (showSelect) {
            showSelect.innerHTML = '<option value="">Select a show...</option>';
        }
        if (copyFromShowSelect) {
            copyFromShowSelect.innerHTML = '<option value="">-- None (Start Fresh) --</option>';
        }
        
        shows.forEach(show => {
            if (showSelect) {
                const option = document.createElement('option');
                option.value = show.id;
                option.textContent = show.name;
                showSelect.appendChild(option);
            }
            
            if (copyFromShowSelect) {
                const copyOption = document.createElement('option');
                copyOption.value = show.id;
                copyOption.textContent = show.name;
                copyFromShowSelect.appendChild(copyOption);
            }
        });
        
        // Set current show display
        if (currentShowId && shows.find(s => s.id == currentShowId)) {
            const currentShow = shows.find(s => s.id == currentShowId);
            if (currentShowNameSpan) currentShowNameSpan.textContent = currentShow.name;
            if (showSelect) showSelect.value = currentShowId;
        } else if (shows.length > 0) {
            currentShowId = shows[0].id;
            localStorage.setItem('currentShowId', currentShowId);
            if (currentShowNameSpan) currentShowNameSpan.textContent = shows[0].name;
            if (showSelect) showSelect.value = currentShowId;
        } else {
            if (currentShowNameSpan) currentShowNameSpan.textContent = 'No shows yet';
        }
        
    } catch (error) {
        console.error('Error loading shows:', error);
        showToast('Error loading shows: ' + error.message, 'error');
    }
}

// Switch to a different show
async function switchShow(showId) {
    const show = shows.find(s => s.id == showId);
    if (!show) return;
    
    currentShowId = showId;
    localStorage.setItem('currentShowId', currentShowId);
    if (currentShowNameSpan) currentShowNameSpan.textContent = show.name;
    
    showToast(`Switched to "${show.name}"`, 'success');
    
    // Optional: reload page to refresh all data with new show context
    setTimeout(() => {
        if (confirm('Show changed. Reload page to see updated data?')) {
            window.location.reload();
        }
    }, 500);
}

// Create a new show
async function createNewShow() {
    const showName = newShowNameInput?.value.trim();
    if (!showName) {
        showToast('Please enter a show name', 'warning');
        return;
    }
    
    const copyFromId = copyFromShowSelect?.value;
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        
        // Create new show
        const { data: newShow, error: showError } = await supabase
            .from('shows')
            .insert([{
                name: showName,
                user_id: user.id,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();
        
        if (showError) throw showError;
        
        // Copy data from existing show if selected
        if (copyFromId) {
            await copyShowData(copyFromId, newShow.id, user.id);
            showToast(`Show "${showName}" created with data from existing show!`, 'success');
        } else {
            showToast(`Show "${showName}" created successfully!`, 'success');
        }
        
        // Close modal and reload shows
        closeCreateShowModal();
        newShowNameInput.value = '';
        
        await loadShows();
        
        // Switch to new show
        await switchShow(newShow.id);
        
    } catch (error) {
        console.error('Error creating show:', error);
        showToast('Error creating show: ' + error.message, 'error');
    }
}

// Copy data from existing show (students and inventory)
async function copyShowData(sourceShowId, targetShowId, userId) {
    try {
        // Copy students
        const { data: students } = await supabase
            .from('students')
            .select('*')
            .eq('show_id', sourceShowId)
            .eq('user_id', userId);
        
        if (students && students.length > 0) {
            const studentsToCopy = students.map(s => ({
                name: s.name,
                grade: s.grade,
                roles: s.roles,
                vocal_parts: s.vocal_parts,
                crew_specialties: s.crew_specialties,
                notes: s.notes,
                show_id: targetShowId,
                user_id: userId
            }));
            
            const { error } = await supabase.from('students').insert(studentsToCopy);
            if (error) console.error('Error copying students:', error);
        }
        
        // Copy inventory
        const { data: inventory } = await supabase
            .from('inventory')
            .select('*')
            .eq('show_id', sourceShowId)
            .eq('user_id', userId);
        
        if (inventory && inventory.length > 0) {
            const inventoryToCopy = inventory.map(i => ({
                name: i.name,
                category: i.category,
                quantity: i.quantity,
                condition: i.condition,
                location: i.location,
                assigned_to: i.assigned_to,
                notes: i.notes,
                status: i.status,
                show_id: targetShowId,
                user_id: userId,
                last_checked: new Date().toISOString().split('T')[0]
            }));
            
            const { error } = await supabase.from('inventory').insert(inventoryToCopy);
            if (error) console.error('Error copying inventory:', error);
        }
        
    } catch (error) {
        console.error('Error copying data:', error);
    }
}

// ===== PREFERENCES FUNCTIONS =====

// Save user preferences
function savePreferences() {
    const theme = themeSelect?.value;
    const notifications = notificationsSelect?.value;
    
    if (theme) localStorage.setItem('theme', theme);
    if (notifications) localStorage.setItem('notifications', notifications);
    
    // Apply theme
    if (theme === 'light') {
        document.documentElement.classList.add('light-mode');
        document.body.classList.add('light-mode');
    } else {
        document.documentElement.classList.remove('light-mode');
        document.body.classList.remove('light-mode');
    }
    
    showToast('Preferences saved!', 'success');
}

// Load saved preferences
function loadPreferences() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const savedNotifications = localStorage.getItem('notifications') || 'on';
    
    if (themeSelect) themeSelect.value = savedTheme;
    if (notificationsSelect) notificationsSelect.value = savedNotifications;
    
    // Apply theme
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light-mode');
        document.body.classList.add('light-mode');
    } else {
        document.documentElement.classList.remove('light-mode');
        document.body.classList.remove('light-mode');
    }
}

// ===== MODAL FUNCTIONS =====

function openCreateShowModal() {
    if (createShowModal) {
        createShowModal.classList.remove('hidden');
        createShowModal.classList.add('flex');
    }
}

function closeCreateShowModal() {
    if (createShowModal) {
        createShowModal.classList.add('hidden');
        createShowModal.classList.remove('flex');
        if (newShowNameInput) newShowNameInput.value = '';
        if (copyFromShowSelect) copyFromShowSelect.value = '';
    }
}

// ===== INITIALIZATION =====

function initializeSettings() {
    console.log('Initializing settings page...');
    
    // Get DOM Elements
    showSelect = document.getElementById('showSelect');
    currentShowNameSpan = document.getElementById('currentShowName');
    createNewShowBtn = document.getElementById('createNewShowBtn');
    createShowModal = document.getElementById('createShowModal');
    closeCreateShowModal = document.getElementById('closeCreateShowModal');
    cancelCreateShowBtn = document.getElementById('cancelCreateShowBtn');
    confirmCreateShowBtn = document.getElementById('confirmCreateShowBtn');
    newShowNameInput = document.getElementById('newShowName');
    copyFromShowSelect = document.getElementById('copyFromShow');
    themeSelect = document.getElementById('themeSelect');
    notificationsSelect = document.getElementById('notificationsSelect');
    saveSettingsBtn = document.getElementById('saveSettingsBtn');
    cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
    
    // Setup event listeners
    if (createNewShowBtn) createNewShowBtn.addEventListener('click', openCreateShowModal);
    if (closeCreateShowModal) closeCreateShowModal.addEventListener('click', closeCreateShowModal);
    if (cancelCreateShowBtn) cancelCreateShowBtn.addEventListener('click', closeCreateShowModal);
    if (confirmCreateShowBtn) confirmCreateShowBtn.addEventListener('click', createNewShow);
    
    if (showSelect) {
        showSelect.addEventListener('change', (e) => {
            if (e.target.value) switchShow(e.target.value);
        });
    }
    
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', savePreferences);
    if (cancelSettingsBtn) cancelSettingsBtn.addEventListener('click', loadPreferences);
    
    // Load data
    loadShows();
    loadPreferences();
    
    console.log('Settings page initialized');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeSettings);