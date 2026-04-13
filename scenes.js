// scenes.js - Enhanced version with bubble views and prop selection
console.log('Scenes script loaded');

// Global variables
let scenes = [];
let allCharacters = [];
let allInventory = [];
let searchTerm = '';
let characterFilter = 'all';

// Selection tracking for modals
let selectedCharacterIds = new Set();
let selectedPropIds = new Set();

// Song counter for unique IDs
let songCounter = 0;
let propCounter = 0;
let checklistCounter = 0;

// ===== SUPABASE FUNCTIONS =====

async function loadScenesFromSupabase() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        
        const currentShowId = localStorage.getItem('currentShowId');
        if (!currentShowId) return [];
        
        const { data, error } = await supabase
            .from('scenes')
            .select('*')
            .eq('user_id', user.id)
            .eq('show_id', currentShowId)
            .order('scene_order', { ascending: true });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error loading scenes:', error);
        return [];
    }
}

async function saveSceneToSupabase(sceneData) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Not authenticated' };
        
        const currentShowId = localStorage.getItem('currentShowId');
        
        const supabaseScene = {
            name: sceneData.name,
            setting: sceneData.setting || '',
            summary: sceneData.summary || '',
            characters: sceneData.characters || [],
            songs: sceneData.songs || [],
            props: sceneData.props || [],
            blocking: sceneData.blocking || '',
            director_notes: sceneData.directorNotes || '',
            tech_notes: sceneData.techNotes || '',
            checklist: sceneData.checklist || [],
            scene_order: sceneData.sceneOrder || 0,
            user_id: user.id,
            show_id: currentShowId
        };
        
        let result;
        
        if (sceneData.id && !sceneData.id.toString().startsWith('temp_')) {
            result = await supabase
                .from('scenes')
                .update(supabaseScene)
                .eq('id', sceneData.id)
                .eq('user_id', user.id)
                .select();
        } else {
            result = await supabase
                .from('scenes')
                .insert([supabaseScene])
                .select();
        }
        
        if (result.error) throw result.error;
        
        return { success: true, data: result.data?.[0] };
    } catch (error) {
        console.error('Error saving scene:', error);
        return { success: false, error: error.message };
    }
}

async function deleteSceneFromSupabase(sceneId) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { success: false, error: 'Not authenticated' };
        }
        
        const { error } = await supabase
            .from('scenes')
            .delete()
            .eq('id', sceneId)
            .eq('user_id', user.id);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error deleting scene:', error);
        return { success: false, error: error.message };
    }
}

async function updateSceneOrder(sceneId, newOrder) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;
        
        const { error } = await supabase
            .from('scenes')
            .update({ scene_order: newOrder })
            .eq('id', sceneId)
            .eq('user_id', user.id);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error updating scene order:', error);
        return false;
    }
}

async function loadCharactersFromSupabase() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        
        const currentShowId = localStorage.getItem('currentShowId');
        if (!currentShowId) return [];
        
        const { data, error } = await supabase
            .from('students')
            .select('id, name, roles, notes')
            .eq('user_id', user.id)
            .eq('show_id', currentShowId)
            .order('name');
        
        if (error) throw error;
        
        // Filter to only cast members (main or ensemble) and include their notes/character info
        return (data || []).filter(s => 
            s.roles && (s.roles.includes('main') || s.roles.includes('ensemble'))
        ).map(s => ({
            id: s.id,
            name: s.name,
            roles: s.roles || [],
            notes: s.notes || ''
        }));
    } catch (error) {
        console.error('Error loading characters:', error);
        return [];
    }
}

async function loadInventoryFromSupabase() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        
        const currentShowId = localStorage.getItem('currentShowId');
        if (!currentShowId) return [];
        
        // Load props and costumes (category props, set_pieces, other - excluding costumes)
        const { data, error } = await supabase
            .from('inventory')
            .select('id, name, category, quantity, condition, notes')
            .eq('user_id', user.id)
            .eq('show_id', currentShowId)
            .in('category', ['props', 'set_pieces', 'other'])
            .order('name');
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error loading inventory:', error);
        return [];
    }
}

// ===== INITIALIZATION =====

async function initializeScenes() {
    console.log('Initializing scenes page...');
    
    // Load data
    allCharacters = await loadCharactersFromSupabase();
    allInventory = await loadInventoryFromSupabase();
    scenes = await loadScenesFromSupabase();
    
    // Populate character filter dropdown
    populateCharacterFilter();
    
    // Render the scenes
    renderScenes();
    updateStats();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize drag and drop sorting
    initDragAndDrop();
    
    console.log('Scenes initialized');
}

function populateCharacterFilter() {
    const filterSelect = document.getElementById('characterFilter');
    if (!filterSelect) return;
    
    filterSelect.innerHTML = '<option value="all">All Characters</option>';
    
    allCharacters.forEach(char => {
        const option = document.createElement('option');
        option.value = char.name;
        option.textContent = char.name;
        filterSelect.appendChild(option);
    });
}

function getFilteredScenes() {
    let filtered = [...scenes];
    
    if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filtered = filtered.filter(scene => 
            scene.name.toLowerCase().includes(searchLower) ||
            (scene.summary && scene.summary.toLowerCase().includes(searchLower)) ||
            (scene.songs && scene.songs.some(song => song.name.toLowerCase().includes(searchLower))) ||
            (scene.characters && scene.characters.some(char => char.toLowerCase().includes(searchLower))) ||
            (scene.props && scene.props.some(prop => prop.name.toLowerCase().includes(searchLower)))
        );
    }
    
    if (characterFilter !== 'all') {
        filtered = filtered.filter(scene => 
            scene.characters && scene.characters.includes(characterFilter)
        );
    }
    
    return filtered;
}

function updateStats() {
    const totalScenes = scenes.length;
    const totalSongs = scenes.reduce((sum, scene) => sum + (scene.songs?.length || 0), 0);
    
    const allSceneCharacters = new Set();
    scenes.forEach(scene => {
        if (scene.characters) {
            scene.characters.forEach(char => allSceneCharacters.add(char));
        }
    });
    
    const totalCharacters = allSceneCharacters.size;
    const totalProps = scenes.reduce((sum, scene) => sum + (scene.props?.length || 0), 0);
    const totalChecklist = scenes.reduce((sum, scene) => sum + (scene.checklist?.length || 0), 0);
    
    const elements = {
        totalScenesCount: totalScenes,
        totalSongsCount: totalSongs,
        totalCharactersCount: totalCharacters,
        totalPropsCount: totalProps,
        totalChecklistCount: totalChecklist
    };
    
    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
}

function getCharacterDetails(characterName) {
    return allCharacters.find(c => c.name === characterName);
}

function renderScenes() {
    const container = document.getElementById('scenesContainer');
    const emptyState = document.getElementById('emptyState');
    
    if (!container) return;
    
    const filteredScenes = getFilteredScenes();
    
    if (filteredScenes.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        container.classList.add('hidden');
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    container.classList.remove('hidden');
    
    container.innerHTML = filteredScenes.map((scene, index) => {
        const checklistItems = scene.checklist || [];
        const completedCount = checklistItems.filter(item => item.completed).length;
        const completionPercent = checklistItems.length > 0 
            ? Math.round((completedCount / checklistItems.length) * 100) 
            : 0;
        
        // Generate character bubbles with popup info
        const characterBubbles = (scene.characters || []).map(char => {
            const charDetails = getCharacterDetails(char);
            return `
                <div class="bubble-tag character relative">
                    <i class="fas fa-user"></i>
                    <span>${escapeHtml(char)}</span>
                    ${charDetails && charDetails.notes ? `
                        <div class="character-popup absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64">
                            <div class="bg-gray-800 rounded-lg p-3 shadow-xl border border-amber-600/30">
                                <div class="font-medium text-amber-300">${escapeHtml(char)}</div>
                                <div class="text-xs text-amber-200/50 mt-1">${charDetails.roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')}</div>
                                <div class="text-xs text-amber-200/70 mt-2 italic">${escapeHtml(charDetails.notes.substring(0, 100))}${charDetails.notes.length > 100 ? '...' : ''}</div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        
        // Generate song bubbles
        const songBubbles = (scene.songs || []).map(song => `
            <div class="bubble-tag song">
                <i class="fas fa-music"></i>
                <span>${escapeHtml(song.name)}</span>
                ${song.notes ? `<span class="text-xs opacity-70 ml-1">(${escapeHtml(song.notes.substring(0, 30))})</span>` : ''}
            </div>
        `).join('');
        
        // Generate prop bubbles
        const propBubbles = (scene.props || []).map(prop => `
            <div class="bubble-tag prop">
                <i class="fas fa-cube"></i>
                <span>${escapeHtml(prop.name)}</span>
                ${prop.quantity > 1 ? `<span class="text-xs ml-1">x${prop.quantity}</span>` : ''}
            </div>
        `).join('');
        
        return `
            <div class="scene-card rounded-xl border border-amber-600/20 overflow-hidden" data-scene-id="${scene.id}" data-scene-order="${scene.scene_order || index}">
                <!-- Scene Header -->
                <div class="p-5 cursor-pointer scene-header" data-scene-id="${scene.id}">
                    <div class="flex items-start justify-between flex-wrap gap-3">
                        <div class="flex items-center gap-4">
                            <div class="drag-handle cursor-grab">
                                <i class="fas fa-grip-vertical text-amber-200/30 hover:text-amber-200"></i>
                            </div>
                            <div class="scene-number">${index + 1}</div>
                            <div>
                                <h3 class="font-display font-semibold text-amber-100 text-lg">${escapeHtml(scene.name)}</h3>
                                ${scene.setting ? `<p class="text-amber-200/50 text-sm mt-0.5"><i class="fas fa-location-dot mr-1"></i>${escapeHtml(scene.setting)}</p>` : ''}
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            ${completionPercent > 0 ? `
                                <div class="hidden sm:flex items-center gap-2">
                                    <div class="progress-bar w-20">
                                        <div class="progress-bar-fill" style="width: ${completionPercent}%"></div>
                                    </div>
                                    <span class="text-xs text-amber-200/50">${completionPercent}%</span>
                                </div>
                            ` : ''}
                            <button class="edit-scene-btn w-8 h-8 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 transition-colors" data-scene-id="${scene.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="delete-scene-btn w-8 h-8 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 transition-colors" data-scene-id="${scene.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                            <button class="expand-scene-btn w-8 h-8 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-200 transition-colors" data-scene-id="${scene.id}">
                                <i class="fas fa-chevron-down"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Bubble stacks for quick view -->
                    ${characterBubbles ? `
                        <div class="bubble-section mt-3">
                            <div class="bubble-section-title">
                                <i class="fas fa-users"></i> Characters
                            </div>
                            <div class="bubble-stack">${characterBubbles}</div>
                        </div>
                    ` : ''}
                    
                    ${songBubbles ? `
                        <div class="bubble-section">
                            <div class="bubble-section-title">
                                <i class="fas fa-music"></i> Songs
                            </div>
                            <div class="bubble-stack">${songBubbles}</div>
                        </div>
                    ` : ''}
                    
                    ${propBubbles ? `
                        <div class="bubble-section">
                            <div class="bubble-section-title">
                                <i class="fas fa-couch"></i> Props
                            </div>
                            <div class="bubble-stack">${propBubbles}</div>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Scene Details (collapsible) -->
                <div id="scene-details-${scene.id}" class="scene-details hidden border-t border-amber-600/20 bg-gray-800/30">
                    <div class="p-5 space-y-5">
                        ${scene.summary ? `
                            <div>
                                <h4 class="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
                                    <i class="fas fa-align-left"></i> Summary
                                </h4>
                                <p class="text-amber-200/70 text-sm">${escapeHtml(scene.summary)}</p>
                            </div>
                        ` : ''}
                        
                        ${scene.blocking ? `
                            <div>
                                <h4 class="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
                                    <i class="fas fa-arrows-alt"></i> Blocking / Stage Directions
                                </h4>
                                <div class="bg-black/20 rounded-lg p-3 font-mono text-sm text-amber-200/70 whitespace-pre-wrap">${escapeHtml(scene.blocking)}</div>
                            </div>
                        ` : ''}
                        
                        ${scene.director_notes ? `
                            <div>
                                <h4 class="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
                                    <i class="fas fa-clipboard-list"></i> Director's Notes
                                </h4>
                                <div class="bg-amber-950/30 rounded-lg p-3 text-amber-200/70 italic">${escapeHtml(scene.director_notes)}</div>
                            </div>
                        ` : ''}
                        
                        ${scene.tech_notes ? `
                            <div>
                                <h4 class="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
                                    <i class="fas fa-lightbulb"></i> Technical Notes
                                </h4>
                                <div class="bg-amber-950/30 rounded-lg p-3 text-amber-200/70">${escapeHtml(scene.tech_notes)}</div>
                            </div>
                        ` : ''}
                        
                        ${scene.checklist && scene.checklist.length > 0 ? `
                            <div>
                                <h4 class="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
                                    <i class="fas fa-check-square"></i> Production Checklist
                                </h4>
                                <div class="space-y-1">
                                    ${scene.checklist.map(item => `
                                        <div class="checklist-item ${item.completed ? 'completed' : ''}">
                                            <input type="checkbox" class="scene-checklist-checkbox" 
                                                   data-scene-id="${scene.id}" data-task-id="${item.id}" 
                                                   ${item.completed ? 'checked' : ''}>
                                            <span class="task-text">${escapeHtml(item.task)}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    attachDynamicEventListeners();
}

function attachDynamicEventListeners() {
    // Scene header click (expand/collapse)
    document.querySelectorAll('.scene-header').forEach(header => {
        header.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            
            const sceneId = header.dataset.sceneId;
            const detailsDiv = document.getElementById(`scene-details-${sceneId}`);
            const expandBtn = header.querySelector('.expand-scene-btn i');
            
            if (detailsDiv) {
                detailsDiv.classList.toggle('hidden');
                if (expandBtn) {
                    expandBtn.classList.toggle('fa-chevron-down');
                    expandBtn.classList.toggle('fa-chevron-up');
                }
            }
        });
    });
    
    // Edit buttons
    document.querySelectorAll('.edit-scene-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sceneId = parseInt(btn.dataset.sceneId);
            editScene(sceneId);
        });
    });
    
    // Delete buttons
    document.querySelectorAll('.delete-scene-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sceneId = parseInt(btn.dataset.sceneId);
            showDeleteConfirm(sceneId);
        });
    });
    
    // Checklist checkboxes
    document.querySelectorAll('.scene-checklist-checkbox').forEach(cb => {
        cb.addEventListener('change', async (e) => {
            e.stopPropagation();
            const sceneId = parseInt(cb.dataset.sceneId);
            const taskId = cb.dataset.taskId;
            const completed = cb.checked;
            
            await updateChecklistItem(sceneId, taskId, completed);
        });
    });
}

async function updateChecklistItem(sceneId, taskId, completed) {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    
    const checklist = scene.checklist || [];
    const taskIndex = checklist.findIndex(item => item.id === taskId);
    
    if (taskIndex !== -1) {
        checklist[taskIndex].completed = completed;
        
        const updatedScene = {
            ...scene,
            checklist: checklist
        };
        
        const result = await saveSceneToSupabase(updatedScene);
        
        if (result.success) {
            const index = scenes.findIndex(s => s.id === sceneId);
            if (index !== -1) {
                scenes[index] = { ...scenes[index], checklist: checklist };
            }
            updateStats();
            renderScenes();
        } else {
            showToast('Error updating checklist', 'error');
        }
    }
}

async function editScene(sceneId) {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    openSceneModal(scene);
}

function showDeleteConfirm(sceneId) {
    currentDeleteSceneId = sceneId;
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

async function deleteScene() {
    if (!currentDeleteSceneId) return;
    
    const result = await deleteSceneFromSupabase(currentDeleteSceneId);
    
    if (result.success) {
        scenes = scenes.filter(s => s.id !== currentDeleteSceneId);
        renderScenes();
        updateStats();
        showToast('Scene deleted successfully', 'success');
    } else {
        showToast('Error deleting scene: ' + result.error, 'error');
    }
    
    closeDeleteModal();
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    currentDeleteSceneId = null;
}

// ===== MODAL FUNCTIONS =====

function openSceneModal(scene = null) {
    const modal = document.getElementById('sceneModal');
    const title = document.getElementById('sceneModalTitle');
    const submitBtn = document.getElementById('submitSceneBtn');
    const sceneId = document.getElementById('sceneId');
    const sceneOrder = document.getElementById('sceneOrder');
    const sceneName = document.getElementById('sceneName');
    const sceneSetting = document.getElementById('sceneSetting');
    const sceneSummary = document.getElementById('sceneSummary');
    const sceneBlocking = document.getElementById('sceneBlocking');
    const sceneDirectorNotes = document.getElementById('sceneDirectorNotes');
    const sceneTechNotes = document.getElementById('sceneTechNotes');
    
    // Reset form
    sceneName.value = '';
    sceneSetting.value = '';
    sceneSummary.value = '';
    sceneBlocking.value = '';
    sceneDirectorNotes.value = '';
    sceneTechNotes.value = '';
    
    // Clear dynamic lists
    document.getElementById('songsBubbles').innerHTML = '';
    document.getElementById('propsBubbles').innerHTML = '';
    document.getElementById('checklistList').innerHTML = '';
    document.getElementById('selectedCharactersBubbles').innerHTML = '<div class="text-amber-200/40 text-sm italic">No characters selected</div>';
    
    // Reset counters
    songCounter = 0;
    propCounter = 0;
    checklistCounter = 0;
    
    if (scene) {
        title.innerHTML = '<i class="fas fa-edit text-amber-400"></i> Edit Scene';
        submitBtn.textContent = 'Save Changes';
        sceneId.value = scene.id;
        sceneOrder.value = scene.scene_order || 0;
        sceneName.value = scene.name || '';
        sceneSetting.value = scene.setting || '';
        sceneSummary.value = scene.summary || '';
        sceneBlocking.value = scene.blocking || '';
        sceneDirectorNotes.value = scene.director_notes || '';
        sceneTechNotes.value = scene.tech_notes || '';
        
        // Populate characters bubbles
        if (scene.characters && scene.characters.length > 0) {
            updateCharacterBubbles(scene.characters);
        }
        
        // Populate songs
        if (scene.songs) {
            scene.songs.forEach(song => addSongBubble(song.name, song.notes, song.id));
        }
        
        // Populate props
        if (scene.props) {
            scene.props.forEach(prop => addPropBubble(prop.name, prop.quantity, prop.id, prop.fromInventory));
        }
        
        // Populate checklist
        if (scene.checklist) {
            scene.checklist.forEach(item => addChecklistItem(item.task, item.id, item.completed));
        }
    } else {
        title.innerHTML = '<i class="fas fa-clapperboard text-amber-400"></i> Add New Scene';
        submitBtn.textContent = 'Add Scene';
        sceneId.value = '';
        sceneOrder.value = scenes.length;
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function updateCharacterBubbles(selectedCharacters) {
    const container = document.getElementById('selectedCharactersBubbles');
    if (!container) return;
    
    if (!selectedCharacters || selectedCharacters.length === 0) {
        container.innerHTML = '<div class="text-amber-200/40 text-sm italic">No characters selected</div>';
        return;
    }
    
    container.innerHTML = selectedCharacters.map(char => {
        const charDetails = getCharacterDetails(char);
        return `
            <div class="bubble-tag character selected-character" data-character="${escapeHtml(char)}">
                <i class="fas fa-user"></i>
                <span>${escapeHtml(char)}</span>
                <button type="button" class="remove-character ml-2 text-amber-200/50 hover:text-red-400" data-character="${escapeHtml(char)}">
                    <i class="fas fa-times-circle text-xs"></i>
                </button>
            </div>
        `;
    }).join('');
    
    // Add remove handlers
    container.querySelectorAll('.remove-character').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const charToRemove = btn.dataset.character;
            removeCharacterFromSelection(charToRemove);
        });
    });
}

function removeCharacterFromSelection(characterName) {
    const currentSelected = getSelectedCharacters();
    const updated = currentSelected.filter(c => c !== characterName);
    updateCharacterBubbles(updated);
}

function getSelectedCharacters() {
    const container = document.getElementById('selectedCharactersBubbles');
    if (!container) return [];
    
    const bubbles = container.querySelectorAll('.selected-character');
    return Array.from(bubbles).map(bubble => bubble.dataset.character);
}

function addSongBubble(name = '', notes = '', id = null) {
    const container = document.getElementById('songsBubbles');
    const songId = id || `song_${Date.now()}_${songCounter++}`;
    
    const songDiv = document.createElement('div');
    songDiv.className = 'bubble-tag song song-item';
    songDiv.dataset.songId = songId;
    songDiv.innerHTML = `
        <i class="fas fa-music"></i>
        <input type="text" class="song-name bg-transparent border-none outline-none w-auto min-w-[80px] text-amber-100" 
               placeholder="Song name" value="${escapeHtml(name)}" style="max-width: 150px;">
        <input type="text" class="song-notes bg-transparent border-none outline-none w-auto text-xs text-amber-200/50 ml-1" 
               placeholder="Notes" value="${escapeHtml(notes)}" style="max-width: 120px;">
        <button type="button" class="remove-song ml-2 text-amber-200/50 hover:text-red-400">
            <i class="fas fa-times-circle"></i>
        </button>
    `;
    
    const removeBtn = songDiv.querySelector('.remove-song');
    removeBtn.addEventListener('click', () => songDiv.remove());
    
    container.appendChild(songDiv);
}

function addPropBubble(name = '', quantity = 1, id = null, fromInventory = false) {
    const container = document.getElementById('propsBubbles');
    const propId = id || `prop_${Date.now()}_${propCounter++}`;
    
    const propDiv = document.createElement('div');
    propDiv.className = `bubble-tag prop prop-item ${fromInventory ? 'from-inventory' : ''}`;
    propDiv.dataset.propId = propId;
    propDiv.innerHTML = `
        <i class="fas fa-cube"></i>
        <input type="text" class="prop-name bg-transparent border-none outline-none w-auto min-w-[80px] text-amber-100" 
               placeholder="Prop name" value="${escapeHtml(name)}" style="max-width: 150px;">
        <input type="number" class="prop-quantity bg-transparent border-none outline-none w-12 text-amber-100 text-center" 
               value="${quantity}" min="1" style="width: 40px;">
        <button type="button" class="remove-prop ml-2 text-amber-200/50 hover:text-red-400">
            <i class="fas fa-times-circle"></i>
        </button>
    `;
    
    const removeBtn = propDiv.querySelector('.remove-prop');
    removeBtn.addEventListener('click', () => propDiv.remove());
    
    container.appendChild(propDiv);
}

function addChecklistItem(task = '', id = null, completed = false) {
    const container = document.getElementById('checklistList');
    const taskId = id || `task_${Date.now()}_${checklistCounter++}`;
    
    const taskDiv = document.createElement('div');
    taskDiv.className = 'checklist-item';
    taskDiv.dataset.taskId = taskId;
    taskDiv.innerHTML = `
        <input type="checkbox" class="checklist-completed" ${completed ? 'checked' : ''}>
        <input type="text" class="checklist-task flex-1 px-3 py-1.5 bg-gray-800/50 border border-amber-600/30 rounded-lg text-amber-100 text-sm" 
               placeholder="Task description" value="${escapeHtml(task)}">
        <button type="button" class="remove-checklist text-red-400 hover:text-red-300">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    const removeBtn = taskDiv.querySelector('.remove-checklist');
    removeBtn.addEventListener('click', () => taskDiv.remove());
    
    container.appendChild(taskDiv);
}

// Character selection modal
function openCharacterSelectModal() {
    const modal = document.getElementById('characterSelectModal');
    const listContainer = document.getElementById('charactersSelectionList');
    const searchInput = document.getElementById('characterSearch');
    
    // Get currently selected characters
    const selectedCharacters = getSelectedCharacters();
    
    // Populate character list
    listContainer.innerHTML = allCharacters.map(char => `
        <div class="selection-modal-item ${selectedCharacters.includes(char.name) ? 'selected' : ''}" data-character-name="${escapeHtml(char.name)}">
            <input type="checkbox" class="character-checkbox" value="${escapeHtml(char.name)}" 
                   ${selectedCharacters.includes(char.name) ? 'checked' : ''}>
            <div class="flex-1">
                <div class="font-medium text-amber-100">${escapeHtml(char.name)}</div>
                <div class="text-xs text-amber-200/50">${char.roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')}</div>
                ${char.notes ? `<div class="text-xs text-amber-200/70 mt-1 italic">${escapeHtml(char.notes.substring(0, 100))}</div>` : ''}
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    listContainer.querySelectorAll('.selection-modal-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                const checkbox = item.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
            }
            item.classList.toggle('selected', item.querySelector('input[type="checkbox"]').checked);
        });
    });
    
    // Search functionality
    const handleSearch = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const items = listContainer.querySelectorAll('.selection-modal-item');
        items.forEach(item => {
            const name = item.dataset.characterName.toLowerCase();
            if (name.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    };
    
    searchInput.addEventListener('input', handleSearch);
    
    // Setup confirm button
    const confirmBtn = document.getElementById('confirmCharacterSelect');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.addEventListener('click', () => {
        const selected = Array.from(listContainer.querySelectorAll('.character-checkbox:checked'))
            .map(cb => cb.value);
        updateCharacterBubbles(selected);
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });
    
    const cancelBtn = document.getElementById('cancelCharacterSelect');
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    newCancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// Prop selection modal
function openPropSelectModal() {
    const modal = document.getElementById('propSelectModal');
    const listContainer = document.getElementById('propsSelectionList');
    const searchInput = document.getElementById('propSearch');
    
    // Get currently selected props
    const existingProps = getSelectedProps();
    
    listContainer.innerHTML = allInventory.map(item => `
        <div class="selection-modal-item ${existingProps.some(p => p.name === item.name) ? 'selected' : ''}" data-prop-id="${item.id}" data-prop-name="${escapeHtml(item.name)}">
            <input type="checkbox" class="prop-checkbox" value="${escapeHtml(item.name)}" data-prop-id="${item.id}" data-prop-quantity="${item.quantity || 1}"
                   ${existingProps.some(p => p.name === item.name) ? 'checked' : ''}>
            <div class="flex-1">
                <div class="font-medium text-amber-100">${escapeHtml(item.name)}</div>
                <div class="text-xs text-amber-200/50">
                    ${item.category} | Qty: ${item.quantity || 1} | Condition: ${item.condition || 'Good'}
                </div>
                ${item.notes ? `<div class="text-xs text-amber-200/70 mt-1 italic">${escapeHtml(item.notes.substring(0, 80))}</div>` : ''}
            </div>
        </div>
    `).join('');
    
    listContainer.querySelectorAll('.selection-modal-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                const checkbox = item.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
            }
            item.classList.toggle('selected', item.querySelector('input[type="checkbox"]').checked);
        });
    });
    
    const handleSearch = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const items = listContainer.querySelectorAll('.selection-modal-item');
        items.forEach(item => {
            const name = item.dataset.propName.toLowerCase();
            if (name.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    };
    
    searchInput.addEventListener('input', handleSearch);
    
    const confirmBtn = document.getElementById('confirmPropSelect');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.addEventListener('click', () => {
        const selected = Array.from(listContainer.querySelectorAll('.prop-checkbox:checked'));
        
        // Clear existing props that are from inventory
        const container = document.getElementById('propsBubbles');
        const existingItems = container.querySelectorAll('.prop-item.from-inventory');
        existingItems.forEach(item => item.remove());
        
        // Add selected props
        selected.forEach(cb => {
            addPropBubble(cb.value, parseInt(cb.dataset.propQuantity) || 1, null, true);
        });
        
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });
    
    const cancelBtn = document.getElementById('cancelPropSelect');
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    newCancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function getSelectedProps() {
    const container = document.getElementById('propsBubbles');
    if (!container) return [];
    
    const propItems = container.querySelectorAll('.prop-item');
    return Array.from(propItems).map(item => ({
        name: item.querySelector('.prop-name')?.value || '',
        quantity: parseInt(item.querySelector('.prop-quantity')?.value) || 1
    })).filter(p => p.name);
}

function collectFormData() {
    // Get selected characters
    const characters = getSelectedCharacters();
    
    // Get songs
    const songItems = document.querySelectorAll('.song-item');
    const songs = Array.from(songItems).map(item => ({
        id: item.dataset.songId,
        name: item.querySelector('.song-name')?.value || '',
        notes: item.querySelector('.song-notes')?.value || ''
    })).filter(song => song.name.trim() !== '');
    
    // Get props
    const propItems = document.querySelectorAll('.prop-item');
    const props = Array.from(propItems).map(item => ({
        id: item.dataset.propId,
        name: item.querySelector('.prop-name')?.value || '',
        quantity: parseInt(item.querySelector('.prop-quantity')?.value) || 1
    })).filter(prop => prop.name.trim() !== '');
    
    // Get checklist
    const checklistItems = document.querySelectorAll('#checklistList .checklist-item');
    const checklist = Array.from(checklistItems).map(item => ({
        id: item.dataset.taskId,
        task: item.querySelector('.checklist-task')?.value || '',
        completed: item.querySelector('.checklist-completed')?.checked || false
    })).filter(task => task.task.trim() !== '');
    
    return { characters, songs, props, checklist };
}

async function saveSceneFromForm(e) {
    e.preventDefault();
    
    const sceneId = document.getElementById('sceneId').value;
    const sceneOrder = parseInt(document.getElementById('sceneOrder').value) || 0;
    const name = document.getElementById('sceneName').value;
    const setting = document.getElementById('sceneSetting').value;
    const summary = document.getElementById('sceneSummary').value;
    const blocking = document.getElementById('sceneBlocking').value;
    const directorNotes = document.getElementById('sceneDirectorNotes').value;
    const techNotes = document.getElementById('sceneTechNotes').value;
    
    if (!name) {
        showToast('Please enter a scene name', 'warning');
        return;
    }
    
    const { characters, songs, props, checklist } = collectFormData();
    
    const sceneData = {
        id: sceneId ? parseInt(sceneId) : null,
        name,
        setting,
        summary,
        characters,
        songs,
        props,
        blocking,
        directorNotes,
        techNotes,
        checklist,
        sceneOrder
    };
    
    const result = await saveSceneToSupabase(sceneData);
    
    if (result.success) {
        showToast('Scene saved successfully!', 'success');
        closeSceneModal();
        
        scenes = await loadScenesFromSupabase();
        renderScenes();
        updateStats();
    } else {
        showToast('Error saving scene: ' + result.error, 'error');
    }
}

function closeSceneModal() {
    const modal = document.getElementById('sceneModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function initDragAndDrop() {
    const container = document.getElementById('scenesContainer');
    if (!container) return;
    
    new Sortable(container, {
        handle: '.drag-handle',
        animation: 300,
        ghostClass: 'sortable-ghost',
        onEnd: async function() {
            const sceneElements = container.querySelectorAll('.scene-card');
            const updates = [];
            
            sceneElements.forEach((el, index) => {
                const sceneId = parseInt(el.dataset.sceneId);
                const currentOrder = parseInt(el.dataset.sceneOrder);
                if (currentOrder !== index) {
                    updates.push({ id: sceneId, newOrder: index });
                    el.dataset.sceneOrder = index;
                }
            });
            
            // Update scene order in database
            for (const update of updates) {
                await updateSceneOrder(update.id, update.newOrder);
            }
            
            // Reload scenes to ensure consistency
            scenes = await loadScenesFromSupabase();
            renderScenes();
            showToast('Scene order updated', 'success');
        }
    });
}

// ===== EVENT LISTENERS =====

function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchScenes');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            renderScenes();
        });
    }
    
    // Character filter
    const characterFilterSelect = document.getElementById('characterFilter');
    if (characterFilterSelect) {
        characterFilterSelect.addEventListener('change', (e) => {
            characterFilter = e.target.value;
            renderScenes();
        });
    }
    
    // Add scene button
    const addSceneBtn = document.getElementById('openAddSceneModal');
    if (addSceneBtn) {
        addSceneBtn.addEventListener('click', () => openSceneModal(null));
    }
    
    const emptyStateAddBtn = document.getElementById('emptyStateAddBtn');
    if (emptyStateAddBtn) {
        emptyStateAddBtn.addEventListener('click', () => openSceneModal(null));
    }
    
    // Modal buttons
    const closeModalBtn = document.getElementById('closeSceneModal');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeSceneModal);
    
    const cancelModalBtn = document.getElementById('cancelSceneModal');
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeSceneModal);
    
    const sceneModal = document.getElementById('sceneModal');
    if (sceneModal) {
        sceneModal.addEventListener('click', (e) => {
            if (e.target === sceneModal) closeSceneModal();
        });
    }
    
    // Form submit
    const sceneForm = document.getElementById('sceneForm');
    if (sceneForm) sceneForm.addEventListener('submit', saveSceneFromForm);
    
    // Add song button
    const addSongBtn = document.getElementById('addSongBtn');
    if (addSongBtn) addSongBtn.addEventListener('click', () => addSongBubble());
    
    // Add custom prop button
    const addCustomPropBtn = document.getElementById('addCustomPropBtn');
    if (addCustomPropBtn) addCustomPropBtn.addEventListener('click', () => addPropBubble());
    
    // Select props button
    const selectPropsBtn = document.getElementById('selectPropsBtn');
    if (selectPropsBtn) selectPropsBtn.addEventListener('click', () => openPropSelectModal());
    
    // Select characters button
    const selectCharactersBtn = document.getElementById('selectCharactersBtn');
    if (selectCharactersBtn) selectCharactersBtn.addEventListener('click', () => openCharacterSelectModal());
    
    // Add checklist button
    const addChecklistBtn = document.getElementById('addChecklistBtn');
    if (addChecklistBtn) addChecklistBtn.addEventListener('click', () => addChecklistItem());
    
    // Character modal close buttons
    const closeCharacterModal = document.getElementById('closeCharacterModal');
    if (closeCharacterModal) {
        closeCharacterModal.addEventListener('click', () => {
            const modal = document.getElementById('characterSelectModal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        });
    }
    
    // Prop modal close buttons
    const closePropModal = document.getElementById('closePropModal');
    if (closePropModal) {
        closePropModal.addEventListener('click', () => {
            const modal = document.getElementById('propSelectModal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        });
    }
    
    // Delete modal buttons
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', deleteScene);
    
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    
    const closeDeleteModalBtn = document.getElementById('closeDeleteModal');
    if (closeDeleteModalBtn) closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
    
    const deleteModal = document.getElementById('deleteConfirmModal');
    if (deleteModal) {
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) closeDeleteModal();
        });
    }
    
    // Export button
    const exportBtn = document.getElementById('exportScenesBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportScenes);
    }
}

function exportScenes() {
    const data = {
        exportDate: new Date().toISOString(),
        scenes: scenes,
        characters: allCharacters,
        inventory: allInventory
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scenes-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Scenes exported successfully!', 'success');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg text-white z-50 ${
        type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM loaded, initializing scenes page');
    
    if (typeof initSidebar === 'function') {
        initSidebar();
    }
    
    await initializeScenes();
});