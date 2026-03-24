// ===== PROPS & COSTUMES MANAGEMENT =====
console.log('Props & Costumes script loaded');

// Initialize empty inventory
let inventory = [];

// Current folder view: 'current', 'archived', or 'all'
let currentFolder = 'current';

// Multi-select mode
let selectMode = false;
let selectedItems = new Set();

// ===== SUPABASE FUNCTIONS =====

// Load inventory from Supabase - filtered by current show
async function loadInventoryFromSupabase() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        
        const currentShowId = localStorage.getItem('currentShowId');
        if (!currentShowId) return [];
        
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .eq('user_id', user.id)
            .eq('show_id', currentShowId)  // ← ADD THIS LINE
            .order('name');
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error loading inventory:', error);
        return [];
    }
}

// Save inventory to Supabase - include current show_id
async function saveInventoryToSupabase(itemData) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Not authenticated' };
        
        const currentShowId = localStorage.getItem('currentShowId');
        
        const supabaseItem = {
            name: itemData.name,
            category: itemData.category,
            quantity: itemData.quantity,
            condition: itemData.condition || 'good',
            location: itemData.location || '',
            assigned_to: itemData.assignedTo || '',
            notes: itemData.notes || '',
            status: itemData.status || 'current',
            user_id: user.id,
            show_id: currentShowId,  // ← ADD THIS LINE
            last_checked: new Date().toISOString().split('T')[0]
        };
        
        console.log('Prepared item for Supabase:', supabaseItem);
        
        let result;
        
        // If item has an id, update existing record
        if (itemData.id && !itemData.id.toString().startsWith('temp_')) {
            console.log('Updating existing item with id:', itemData.id);
            result = await supabase
                .from('inventory')
                .update(supabaseItem)
                .eq('id', itemData.id)
                .eq('user_id', user.id)
                .select();
        } else {
            // Create new record
            console.log('Creating new item');
            result = await supabase
                .from('inventory')
                .insert([supabaseItem])
                .select();
        }
        
        console.log('Supabase result:', result);
        
        if (result.error) {
            console.error('Supabase error details:', result.error);
            return { success: false, error: result.error.message };
        }
        
        return { success: true, data: result.data?.[0] };
    } catch (error) {
        console.error('Exception saving item:', error);
        return { success: false, error: error.message };
    }
}

// Update multiple items' status (for moving between folders)
async function updateMultipleItemsStatus(itemIds, newStatus) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { success: false, error: 'Not authenticated' };
        }
        
        const { error } = await supabase
            .from('inventory')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .in('id', itemIds)
            .eq('user_id', user.id);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error updating multiple items:', error);
        return { success: false, error: error.message };
    }
}

// Initialize - load from Supabase and then set up management
async function initializeInventory() {
    console.log('Initializing inventory...');
    inventory = await loadInventoryFromSupabase();
    
    // Now initialize the management UI
    initializeInventoryManagement();
    console.log('Inventory initialized');
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize sidebar
    if (typeof initSidebar === 'function') {
        initSidebar();
    }
    
    await initializeInventory();
});

function initializeInventoryManagement() {
    console.log('Initializing inventory management');
    
    // DOM Elements
    const inventoryGrid = document.getElementById('inventoryGrid');
    const searchInput = document.getElementById('searchInventory');
    const categoryFilter = document.getElementById('categoryFilter');
    const inventoryModal = document.getElementById('inventoryModal');
    const openModalBtn = document.getElementById('openAddItemModal');
    const closeModalBtn = document.getElementById('closeInventoryModal');
    const cancelModalBtn = document.getElementById('cancelInventoryModal');
    const inventoryForm = document.getElementById('inventoryForm');
    const modalTitle = document.getElementById('inventoryModalTitle');
    const submitButton = document.getElementById('submitInventoryBtn');
    const itemId = document.getElementById('itemId');
    const selectModeBtn = document.getElementById('selectModeBtn');
    const actionBar = document.getElementById('actionBar');
    const selectedCountSpan = document.getElementById('selectedCount');
    const moveToCurrentBtn = document.getElementById('moveToCurrentBtn');
    const moveToArchivedBtn = document.getElementById('moveToArchivedBtn');
    const cancelSelectBtn = document.getElementById('cancelSelectBtn');
    
    // Folder tabs
    const folderTabs = document.querySelectorAll('.folder-tab');
    
    if (!inventoryGrid) {
        console.log('Inventory grid not found');
        return;
    }
    
    // Update folder counts
    function updateFolderCounts() {
        const currentItems = inventory.filter(i => i.status === 'current').length;
        const archivedItems = inventory.filter(i => i.status === 'archived').length;
        const allItems = inventory.length;
        
        const currentCountEl = document.getElementById('currentCount');
        const archivedCountEl = document.getElementById('archivedCount');
        const allCountEl = document.getElementById('allCount');
        
        if (currentCountEl) currentCountEl.textContent = currentItems;
        if (archivedCountEl) archivedCountEl.textContent = archivedItems;
        if (allCountEl) allCountEl.textContent = allItems;
    }
    
    // Switch folder view
    function switchFolder(folder) {
        currentFolder = folder;
        
        // Update active tab styling
        folderTabs.forEach(tab => {
            if (tab.dataset.folder === folder) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Clear selection when switching folders
        clearSelection();
        
        // Render the view
        renderInventory();
    }
    
    // Get filtered items based on current folder and search
    function getFilteredItems() {
        let filtered = [...inventory];
        
        // Filter by folder
        if (currentFolder === 'current') {
            filtered = filtered.filter(item => item.status === 'current');
        } else if (currentFolder === 'archived') {
            filtered = filtered.filter(item => item.status === 'archived');
        }
        
        // Filter by search term
        const searchTerm = searchInput?.value.toLowerCase() || '';
        if (searchTerm) {
            filtered = filtered.filter(item => 
                item.name.toLowerCase().includes(searchTerm) ||
                (item.notes && item.notes.toLowerCase().includes(searchTerm))
            );
        }
        
        // Filter by category
        const categoryValue = categoryFilter?.value || 'all';
        if (categoryValue !== 'all') {
            filtered = filtered.filter(item => item.category === categoryValue);
        }
        
        return filtered;
    }
    
    // Helper function to escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Helper functions
    function getCategoryIcon(category) {
        const icons = {
            'props': 'mask',
            'costumes': 'tshirt',
            'set_pieces': 'couch',
            'other': 'tag'
        };
        return icons[category] || 'box';
    }
    
    // Render inventory grid
    function renderInventory() {
        const filteredItems = getFilteredItems();
        
        if (filteredItems.length === 0) {
            const emptyMessage = currentFolder === 'current' ? 'No items in current show' :
                                currentFolder === 'archived' ? 'No items in drama closet' :
                                'No items found';
            inventoryGrid.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <div class="w-24 h-24 mx-auto mb-4 rounded-full bg-amber-600/20 flex items-center justify-center">
                        <i class="fas fa-box-open text-4xl text-amber-600/40"></i>
                    </div>
                    <h3 class="font-display text-xl text-amber-100 mb-2">${emptyMessage}</h3>
                    <p class="text-amber-200/50 mb-4">Add new items or move items from the drama closet</p>
                    <button onclick="document.getElementById('openAddItemModal').click()" 
                            class="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors inline-flex items-center gap-2">
                        <i class="fas fa-plus"></i>
                        Add New Item
                    </button>
                </div>
            `;
            return;
        }
        
        // Add select-mode class to grid if in select mode
        if (selectMode) {
            inventoryGrid.classList.add('select-mode');
        } else {
            inventoryGrid.classList.remove('select-mode');
        }
        
        inventoryGrid.innerHTML = filteredItems.map(item => {
            const isSelected = selectedItems.has(item.id);
            
            // Combine location and condition for display
            const locationCondition = [];
            if (item.location) locationCondition.push(`Location: ${item.location}`);
            if (item.condition) locationCondition.push(`Condition: ${item.condition}`);
            const locationConditionText = locationCondition.length > 0 ? locationCondition.join(' | ') : '';
            
            const combinedNotes = item.notes ? 
                (locationConditionText ? `${locationConditionText} | ${item.notes}` : item.notes) : 
                locationConditionText;
            
            return `
                <div class="inventory-card bg-amber-600/5 rounded-xl p-4 border border-amber-600/20 hover:border-amber-600/40 transition-all group ${isSelected ? 'selected' : ''}" 
                     data-item-id="${item.id}">
                    <div class="selection-checkbox">
                        ${isSelected ? '<i class="fas fa-check"></i>' : ''}
                    </div>
                    <div class="flex items-start justify-between mb-3">
                        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-white">
                            <i class="fas fa-${getCategoryIcon(item.category)}"></i>
                        </div>
                        <div class="flex gap-1">
                            <button onclick="editItem(${item.id})" class="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="duplicateItem(${item.id})" class="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400" title="Duplicate">
                                <i class="fas fa-copy"></i>
                            </button>
                            <button onclick="deleteItem(${item.id})" class="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    
                    <h3 class="font-display font-semibold text-amber-100 mb-2">${escapeHtml(item.name)}</h3>
                    
                    <div class="space-y-2 text-sm">
                        <div class="flex items-center justify-between">
                            <span class="text-amber-200/50">Quantity:</span>
                            <span class="text-amber-200/80 font-medium">${item.quantity}</span>
                        </div>
                        
                        ${item.assigned_to ? `
                            <div class="flex items-center justify-between">
                                <span class="text-amber-200/50">Assigned to:</span>
                                <span class="text-amber-200/80">${escapeHtml(item.assigned_to)}</span>
                            </div>
                        ` : ''}
                        
                        ${combinedNotes ? `
                            <div class="border-t border-amber-600/20 pt-2 mt-2">
                                <div class="text-xs text-amber-200/50">Notes:</div>
                                <div class="text-xs text-amber-200/70 italic break-words">${escapeHtml(combinedNotes)}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        updateFolderCounts();
    }
    
    // Reset form
    function resetForm() {
        if (inventoryForm) inventoryForm.reset();
        if (itemId) itemId.value = '';
        if (modalTitle) modalTitle.textContent = 'Add New Item';
        if (submitButton) submitButton.textContent = 'Add Item';
        
        // Set default values for new form fields
        const conditionInput = document.getElementById('itemCondition');
        const locationInput = document.getElementById('itemLocation');
        if (conditionInput) conditionInput.value = 'good';
        if (locationInput) locationInput.value = '';
        
        const statusInput = document.getElementById('itemStatus');
        if (statusInput) statusInput.value = currentFolder === 'archived' ? 'archived' : 'current';
    }
    
    // Open modal
    function openModal() {
        if (inventoryModal) {
            inventoryModal.classList.remove('hidden');
            inventoryModal.classList.add('flex');
        }
    }
    
    // Close modal
    function closeModal() {
        if (inventoryModal) {
            inventoryModal.classList.add('hidden');
            inventoryModal.classList.remove('flex');
            resetForm();
        }
    }
    
    // Save item to Supabase
    async function saveItem(e) {
        e.preventDefault();
        
        const name = document.getElementById('itemName')?.value;
        const category = document.getElementById('itemCategory')?.value;
        const quantity = parseInt(document.getElementById('itemQuantity')?.value) || 1;
        const condition = document.getElementById('itemCondition')?.value;
        const location = document.getElementById('itemLocation')?.value;
        const assignedTo = document.getElementById('itemAssignedTo')?.value;
        const notes = document.getElementById('itemNotes')?.value;
        const status = document.getElementById('itemStatus')?.value || currentFolder;
        const id = itemId?.value ? parseInt(itemId.value) : null;

        if (!name || !category) {
            showToast('Please fill in all required fields (Name and Category)', 'warning');
            return;
        }
        
        const itemData = {
            id,
            name,
            category,
            quantity,
            condition: condition || 'good',
            location: location || '',
            assignedTo: assignedTo || '',
            notes: notes || '',
            status: status === 'archived' ? 'archived' : 'current'
        };
        
        const result = await saveInventoryToSupabase(itemData);
        
        if (result.success) {
            showToast('Item saved successfully!', 'success');
            inventory = await loadInventoryFromSupabase();
            renderInventory();
            closeModal();
        } else {
            showToast('Error saving item: ' + result.error, 'error');
        }
    }
    
    // Edit item
    window.editItem = async function(id) {
        const item = inventory.find(i => i.id === id);
        if (!item) return;
        
        document.getElementById('itemId').value = item.id;
        document.getElementById('itemName').value = item.name;
        document.getElementById('itemCategory').value = item.category;
        document.getElementById('itemQuantity').value = item.quantity;
        document.getElementById('itemCondition').value = item.condition || 'good';
        document.getElementById('itemLocation').value = item.location || '';
        document.getElementById('itemAssignedTo').value = item.assigned_to || '';
        document.getElementById('itemNotes').value = item.notes || '';
        document.getElementById('itemStatus').value = item.status || 'current';
        
        document.getElementById('inventoryModalTitle').textContent = 'Edit Item';
        document.getElementById('submitInventoryBtn').textContent = 'Save Changes';
        openModal();
    };
    
    // Duplicate item
    window.duplicateItem = async function(id) {
        const item = inventory.find(i => i.id === id);
        if (!item) return;
        
        const newItem = {
            name: `${item.name} (Copy)`,
            category: item.category,
            quantity: item.quantity,
            condition: item.condition || 'good',
            location: item.location || '',
            assignedTo: item.assigned_to || '',
            notes: item.notes || '',
            status: currentFolder === 'archived' ? 'archived' : 'current'
        };
        
        const result = await saveInventoryToSupabase(newItem);
        
        if (result.success) {
            showToast('Item duplicated successfully!', 'success');
            inventory = await loadInventoryFromSupabase();
            renderInventory();
        } else {
            showToast('Error duplicating item: ' + result.error, 'error');
        }
    };
    
   // Delete item
window.deleteItem = async function(id) {
    // This will now use our custom modal instead of browser confirm
    const confirmed = await confirm('Are you sure you want to delete this item? This action cannot be undone.', 'Delete Item', 'Yes, Delete', 'Cancel');
    
    if (!confirmed) {
        return;
    }
    
    console.log('Deleting item with id:', id);
    
    try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showToast('You must be logged in to delete items', 'error');
            return;
        }
        
        // Delete from Supabase
        const { error } = await supabase
            .from('inventory')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);
        
        if (error) {
            console.error('Error deleting item:', error);
            showToast('Error deleting item: ' + error.message, 'error');
            return;
        }
        
        // Refresh inventory list
        showToast('Item deleted successfully!', 'success');
        inventory = await loadInventoryFromSupabase();
        renderInventory();
        
        console.log('Item deleted successfully');
        
    } catch (error) {
        console.error('Exception deleting item:', error);
        showToast('Error deleting item: ' + error.message, 'error');
    }
};
    
    // Selection mode functions
    function enterSelectMode() {
        selectMode = true;
        selectedItems.clear();
        selectModeBtn.classList.add('active');
        selectModeBtn.style.background = 'linear-gradient(135deg, #b45309, #d97706)';
        selectModeBtn.style.color = 'white';
        actionBar.classList.remove('hidden');
        renderInventory();
    }
    
    function exitSelectMode() {
        selectMode = false;
        selectedItems.clear();
        selectModeBtn.classList.remove('active');
        selectModeBtn.style.background = '';
        selectModeBtn.style.color = '';
        actionBar.classList.add('hidden');
        renderInventory();
    }
    
    function clearSelection() {
        selectedItems.clear();
        updateSelectedCount();
        renderInventory();
    }
    
    function updateSelectedCount() {
        selectedCountSpan.textContent = `${selectedItems.size} item${selectedItems.size !== 1 ? 's' : ''} selected`;
    }
    
    function toggleItemSelection(itemId) {
        if (selectedItems.has(itemId)) {
            selectedItems.delete(itemId);
        } else {
            selectedItems.add(itemId);
        }
        updateSelectedCount();
        renderInventory();
    }
    
    async function moveSelectedItems(newStatus) {
        if (selectedItems.size === 0) return;
        
        const itemIds = Array.from(selectedItems);
        const targetFolder = newStatus === 'current' ? 'current' : 'archived';
        
        const result = await updateMultipleItemsStatus(itemIds, targetFolder);
        
        if (result.success) {
            const message = targetFolder === 'current' ? 
                `Moved ${selectedItems.size} item(s) to Current Show` : 
                `Moved ${selectedItems.size} item(s) to Drama Closet`;
            showToast(message, 'success');
            inventory = await loadInventoryFromSupabase();
            clearSelection();
            renderInventory();
        } else {
            showToast('Error moving items: ' + result.error, 'error');
        }
    }
    
    // Setup event listeners
    function setupEventListeners() {
        if (searchInput) searchInput.addEventListener('input', renderInventory);
        if (categoryFilter) categoryFilter.addEventListener('change', renderInventory);
        
        // Folder tabs
        folderTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                switchFolder(tab.dataset.folder);
                exitSelectMode();
            });
        });
        
        // Modal buttons
        if (openModalBtn) {
            openModalBtn.addEventListener('click', () => {
                resetForm();
                openModal();
            });
        }
        
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
        if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);
        if (inventoryForm) inventoryForm.addEventListener('submit', saveItem);
        
        if (inventoryModal) {
            inventoryModal.addEventListener('click', (e) => {
                if (e.target === inventoryModal) closeModal();
            });
        }
        
        // Selection mode
        if (selectModeBtn) {
            selectModeBtn.addEventListener('click', () => {
                if (selectMode) {
                    exitSelectMode();
                } else {
                    enterSelectMode();
                }
            });
        }
        
        if (cancelSelectBtn) {
            cancelSelectBtn.addEventListener('click', exitSelectMode);
        }
        
        if (moveToCurrentBtn) {
            moveToCurrentBtn.addEventListener('click', () => moveSelectedItems('current'));
        }
        
        if (moveToArchivedBtn) {
            moveToArchivedBtn.addEventListener('click', () => moveSelectedItems('archived'));
        }
        
        // Item click for selection mode
        document.addEventListener('click', (e) => {
            if (!selectMode) return;
            
            const card = e.target.closest('.inventory-card');
            if (!card) return;
            
            const itemId = parseInt(card.dataset.itemId);
            if (itemId) {
                toggleItemSelection(itemId);
            }
        });
    }
    
    // Initialize UI
    updateFolderCounts();
    renderInventory();
    setupEventListeners();
    
    console.log('Inventory management initialized');
}

// User initialization
async function initializeInventoryWithUser() {
    const isStaff = await auth?.isStaff?.() ?? false;
    if (isStaff) {
        document.getElementById('staffOnlyControls')?.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', initializeInventoryWithUser);