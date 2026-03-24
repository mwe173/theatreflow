// ===== THEATRE MANAGER - MAIN JAVASCRIPT =====
// Now only handles sidebar, navigation, and UI helpers (no calendar)

// Default configuration
const defaultConfig = {
  theatre_name: 'Spotlight',
  welcome_message: 'Ready for tonight\'s show?',
  primary_color: '#b45309',
  secondary_color: '#1a1a2e',
  text_color: '#000000',
  accent_color: '#d97706',
  surface_color: '#16213e',
  font_family: 'Playfair Display',
  font_size: 16
};

let config = { ...defaultConfig };

// ===== SIDEBAR COLLAPSE FUNCTIONALITY =====
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggleSidebar');
  const toggleIcon = document.getElementById('toggleIcon');
  
  if (!sidebar || !toggleBtn || !toggleIcon) return;
  
  // Get saved state from localStorage
  const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  
  // Apply saved state
  if (isCollapsed) {
    sidebar.classList.add('collapsed');
    toggleIcon.classList.remove('fa-chevron-left');
    toggleIcon.classList.add('fa-chevron-right');
  } else {
    sidebar.classList.remove('collapsed');
    toggleIcon.classList.remove('fa-chevron-right');
    toggleIcon.classList.add('fa-chevron-left');
  }
  
  // Remove any existing event listeners by cloning and replacing
  const newToggleBtn = toggleBtn.cloneNode(true);
  toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
  
  // Add new event listener
  newToggleBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const currentSidebar = document.getElementById('sidebar');
    const currentIcon = document.getElementById('toggleIcon');
    
    if (!currentSidebar || !currentIcon) return;
    
    currentSidebar.classList.toggle('collapsed');
    
    if (currentSidebar.classList.contains('collapsed')) {
      currentIcon.classList.remove('fa-chevron-left');
      currentIcon.classList.add('fa-chevron-right');
      localStorage.setItem('sidebarCollapsed', 'true');
    } else {
      currentIcon.classList.remove('fa-chevron-right');
      currentIcon.classList.add('fa-chevron-left');
      localStorage.setItem('sidebarCollapsed', 'false');
    }
    
    // Trigger resize event for any layout adjustments
    window.dispatchEvent(new Event('resize'));
  });
  
  // Update toggle icon reference
  window.toggleIcon = document.getElementById('toggleIcon');
}

// ===== SIDEBAR NAVIGATION =====
function initSidebarNavigation() {
  // Set active class based on current page
  setActiveSidebarItem();
}

function setActiveSidebarItem() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  
  sidebarItems.forEach(item => {
    const href = item.getAttribute('href');
    if (href === currentPage) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

// ===== QUICK ACTION BUTTONS =====
function initQuickActions() {
  const quickActions = document.querySelectorAll('.quick-action-card');
  
  quickActions.forEach((action) => {
    action.addEventListener('click', function(e) {
      e.preventDefault();
      const actionText = this.querySelector('h4')?.textContent || 'Action';
      console.log(`${actionText} clicked`);
      
      const ripple = document.createElement('span');
      ripple.classList.add('ripple');
      this.appendChild(ripple);
      
      setTimeout(() => {
        ripple.remove();
      }, 600);
      
      // Navigate based on action
      if (actionText === 'Attendance') {
        window.location.href = 'attendance.html';
      } else if (actionText === 'People') {
        window.location.href = 'people.html';
      } else if (actionText === 'Props') {
        window.location.href = 'props-costumes.html';
      } else if (actionText === 'Scenes') {
        window.location.href = 'scenes.html';
      }
    });
  });
}

// ===== SDK INTEGRATION =====
async function onConfigChange(newConfig) {
  const theatreName = newConfig.theatre_name || defaultConfig.theatre_name;
  const welcomeMessage = newConfig.welcome_message || defaultConfig.welcome_message;
  const fontFamily = newConfig.font_family || defaultConfig.font_family;
  const fontSize = newConfig.font_size || defaultConfig.font_size;
  
  const theatreNameEl = document.getElementById('theatre-name');
  const welcomeMsgEl = document.getElementById('welcome-message');
  
  if (theatreNameEl) theatreNameEl.textContent = theatreName;
  if (welcomeMsgEl) welcomeMsgEl.textContent = welcomeMessage;
  
  document.querySelectorAll('.font-display').forEach(el => {
    el.style.fontFamily = `${fontFamily}, serif`;
  });
  
  document.body.style.fontSize = `${fontSize}px`;
}

// Handle resize events
window.addEventListener('resize', function() {
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768 && sidebar) {
    if (!sidebar.classList.contains('collapsed')) {
      sidebar.classList.add('collapsed-mobile');
    }
  }
});

// ===== MAIN INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing...');
  
  // Initialize sidebar first
  initSidebar();
  
  // Initialize navigation
  initSidebarNavigation();
  
  // Initialize quick actions (only on index page)
  if (document.querySelector('.quick-action-card')) {
    initQuickActions();
  }
  
  // Set active page in sidebar
  setActiveSidebarItem();
});

// Re-initialize sidebar when page loads (for back/forward navigation)
window.addEventListener('pageshow', function() {
  initSidebar();
  setActiveSidebarItem();
});

// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');
  
  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener('click', function() {
      sidebar.classList.toggle('mobile-open');
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(e) {
      if (window.innerWidth <= 1024) {
        if (!sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
          sidebar.classList.remove('mobile-open');
        }
      }
    });
  }
});

// ===== TOAST NOTIFICATION SYSTEM =====

// Create toast container if it doesn't exist
function ensureToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

// Show toast notification
window.showToast = function(message, type = 'info', title = '') {
    const container = ensureToastContainer();
    
    // Set default titles based on type
    const titles = {
        success: 'Success',
        error: 'Error',
        warning: 'Warning',
        info: 'Notice'
    };
    
    const finalTitle = title || titles[type] || 'Notice';
    
    // Icons for each type
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const icon = icons[type] || 'fa-info-circle';
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${icon}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${finalTitle}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    // Add close button functionality
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        removeToast(toast);
    });
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        removeToast(toast);
    }, 4000);
};

function removeToast(toast) {
    toast.classList.add('hiding');
    setTimeout(() => {
        if (toast && toast.remove) {
            toast.remove();
        }
    }, 300);
}

// ===== CUSTOM CONFIRMATION MODAL =====

let confirmResolve = null;

function showConfirmModal(message, title = 'Confirm Action', confirmText = 'Yes, Delete', cancelText = 'Cancel') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const confirmBtn = document.getElementById('confirmYesBtn');
        const cancelBtn = document.getElementById('confirmNoBtn');
        const closeBtn = document.getElementById('closeConfirmModal');
        
        if (!modal) {
            // Fallback to browser confirm if modal doesn't exist
            const result = confirm(message);
            resolve(result);
            return;
        }
        
        // Set content
        if (titleEl) {
            titleEl.innerHTML = `<i class="fas fa-exclamation-triangle text-amber-400"></i> ${title}`;
        }
        if (messageEl) messageEl.textContent = message;
        if (confirmBtn) confirmBtn.textContent = confirmText;
        if (cancelBtn) cancelBtn.textContent = cancelText;
        
        // Show modal
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        // Handle confirm
        const handleConfirm = () => {
            cleanup();
            resolve(true);
        };
        
        // Handle cancel
        const handleCancel = () => {
            cleanup();
            resolve(false);
        };
        
        // Cleanup function
        const cleanup = () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            if (closeBtn) closeBtn.removeEventListener('click', handleCancel);
            modal.removeEventListener('click', outsideClick);
        };
        
        // Outside click handler
        const outsideClick = (e) => {
            if (e.target === modal) {
                handleCancel();
            }
        };
        
        // Add event listeners
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        if (closeBtn) closeBtn.addEventListener('click', handleCancel);
        modal.addEventListener('click', outsideClick);
    });
}

// Replace the native confirm with custom modal
window.confirm = showConfirmModal;