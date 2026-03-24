// ===== FILES MANAGEMENT =====

import { auth, supabase, storage } from './supabase.js';
console.log('Files script loaded');

class FileManager {
    constructor() {
        this.currentPath = 'root';
        this.viewMode = 'grid'; // 'grid' or 'list'
        this.searchTerm = '';
        this.sortBy = 'name';
        this.files = [];
        this.folders = [];
        this.recentActivity = [];
        
        this.loadData();
    }

    // Load data from localStorage
    loadData() {
        try {
            const savedFiles = localStorage.getItem('theatreFiles');
            if (savedFiles) {
                const data = JSON.parse(savedFiles);
                this.files = data.files || [];
                this.folders = data.folders || [];
                this.recentActivity = data.recentActivity || [];
            } else {
                this.initializeSampleData();
            }
        } catch (e) {
            console.error('Error loading files:', e);
            this.initializeSampleData();
        }
    }

    // Initialize sample data
    initializeSampleData() {
        // Start with empty arrays instead of sample data
        this.folders = [];
        this.files = [];
        this.recentActivity = [];
        this.saveData();
    }

    // Save data to localStorage
    saveData() {
        const data = {
            files: this.files,
            folders: this.folders,
            recentActivity: this.recentActivity
        };
        localStorage.setItem('theatreFiles', JSON.stringify(data));
    }

    // ===== NEW SUPABASE STORAGE METHODS =====
    // Place Part 3 code HERE - inside the FileManager class
    // but before the existing methods

    async uploadFileToSupabase(file, path) {
        try {
            // Get current user
            const user = await auth.getUser()
            const userId = user?.id || 'anonymous'
            
            // Create a unique file path to avoid overwrites
            // Format: user_id/folder/filename_timestamp.ext
            const timestamp = Date.now()
            const fileExt = this.getFileExtension(file.name)
            const fileNameWithoutExt = file.name.replace(`.${fileExt}`, '')
            const safeFileName = fileNameWithoutExt.replace(/[^a-z0-9]/gi, '_').toLowerCase()
            const filePath = `${userId}/${path || 'uploads'}/${safeFileName}_${timestamp}.${fileExt}`
            
            console.log('Uploading to Supabase:', filePath)
            
            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from('files')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false // Don't overwrite existing files
                })
            
            if (error) throw error
            
            // Get public URL
            const { data: urlData } = await supabase.storage
                .from('files')
                .getPublicUrl(filePath)
            
            // Save file metadata to your local state
            const fileRecord = {
                id: 'file_' + Date.now() + Math.random(),
                name: file.name,
                type: fileExt,
                size: file.size,
                path: this.currentPath,
                storage_path: filePath,
                public_url: urlData?.publicUrl,
                uploadedAt: new Date().toISOString().split('T')[0],
                modifiedAt: new Date().toISOString().split('T')[0],
                uploadedBy: user?.user_metadata?.full_name || 'You',
                description: '',
                tags: [],
                versions: []
            }
            
            // Add to local files array
            this.files.push(fileRecord)
            this.addRecentActivity('upload', fileRecord, user?.user_metadata?.full_name || 'You')
            this.saveData()
            
            return { success: true, data: fileRecord }
        } catch (error) {
            console.error('Upload failed:', error)
            return { success: false, error: error.message }
        }
    }

    // New upload method that processes multiple files
    async uploadFiles(files) {
        const uploadQueue = document.getElementById('uploadQueue')
        const startUploadBtn = document.getElementById('startUploadBtn')
        
        // Disable upload button during upload
        if (startUploadBtn) startUploadBtn.disabled = true
        
        // Process each file
        for (const file of Array.from(files)) {
            try {
                // Create UI element for this file
                const uploadItem = this.createUploadItem(file, 'uploading')
                uploadQueue.appendChild(uploadItem)
                
                // Upload to Supabase
                const result = await this.uploadFileToSupabase(file, 'uploads')
                
                if (result.success) {
                    this.updateUploadItem(uploadItem, 'success')
                } else {
                    this.updateUploadItem(uploadItem, 'error', result.error)
                }
            } catch (error) {
                console.error('File upload error:', error)
                const uploadItem = this.createUploadItem(file, 'error', error.message)
                uploadQueue.appendChild(uploadItem)
            }
        }
        
        // Re-enable upload button
        if (startUploadBtn) startUploadBtn.disabled = false
        
        // Re-render files after all uploads
        setTimeout(() => {
            this.renderFiles()
            this.updateStorageStats()
        }, 500)
    }

    // Helper methods for UI feedback during upload
    createUploadItem(file, status, errorMsg = '') {
        const item = document.createElement('div')
        item.className = 'flex items-center justify-between p-2 bg-amber-600/10 rounded-lg'
        item.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fas fa-file text-amber-400"></i>
                <span class="text-sm text-amber-100">${file.name}</span>
                <span class="text-xs text-amber-200/50">${this.formatFileSize(file.size)}</span>
            </div>
            <div class="upload-status">
                ${status === 'uploading' ? '<i class="fas fa-spinner fa-spin text-amber-400"></i>' : ''}
                ${status === 'success' ? '<i class="fas fa-check-circle text-green-400"></i>' : ''}
                ${status === 'error' ? `<i class="fas fa-exclamation-circle text-red-400" title="${errorMsg}"></i>` : ''}
            </div>
        `
        return item
    }

    updateUploadItem(item, status, errorMsg = '') {
        const statusDiv = item.querySelector('.upload-status')
        if (status === 'success') {
            statusDiv.innerHTML = '<i class="fas fa-check-circle text-green-400"></i>'
        } else if (status === 'error') {
            statusDiv.innerHTML = `<i class="fas fa-exclamation-circle text-red-400" title="${errorMsg}"></i>`
        }
    }

    // ===== END OF NEW SUPABASE STORAGE METHODS =====

    // Get file icon class based on type
    getFileIconClass(type) {
        const icons = {
            pdf: 'fa-file-pdf pdf',
            doc: 'fa-file-word doc',
            docx: 'fa-file-word doc',
            xls: 'fa-file-excel doc',
            xlsx: 'fa-file-excel doc',
            jpg: 'fa-file-image image',
            jpeg: 'fa-file-image image',
            png: 'fa-file-image image',
            gif: 'fa-file-image image',
            mp3: 'fa-file-audio audio',
            wav: 'fa-file-audio audio',
            mp4: 'fa-file-video video',
            mov: 'fa-file-video video',
            zip: 'fa-file-archive archive',
            rar: 'fa-file-archive archive',
            js: 'fa-file-code code',
            html: 'fa-file-code code',
            css: 'fa-file-code code',
            default: 'fa-file default'
        };
        return icons[type] || icons.default;
    }

    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Get file extension
    getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    // Get files and folders in current path
    getCurrentItems() {
        // Get folders in current path
        let items = this.folders
            .filter(f => f.path === this.currentPath)
            .map(f => ({ ...f, type: 'folder' }));

        // Get files in current path
        items = items.concat(
            this.files
                .filter(f => f.path === this.currentPath)
                .map(f => ({ ...f, type: 'file' }))
        );

        // Apply search filter
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            items = items.filter(item => 
                item.name.toLowerCase().includes(searchLower)
            );
        }

        // Apply sorting
        items.sort((a, b) => {
            if (this.sortBy === 'name') {
                return a.name.localeCompare(b.name);
            } else if (this.sortBy === 'date') {
                return new Date(b.modifiedAt) - new Date(a.modifiedAt);
            } else if (this.sortBy === 'size') {
                if (a.type === 'folder') return -1;
                if (b.type === 'folder') return 1;
                return (b.size || 0) - (a.size || 0);
            } else if (this.sortBy === 'type') {
                if (a.type !== b.type) {
                    return a.type === 'folder' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            }
        });

        return items;
    }

    // Render files and folders
    renderFiles() {
        const container = document.getElementById('filesContainer');
        const emptyState = document.getElementById('emptyState');
        const items = this.getCurrentItems();

        if (items.length === 0) {
            container.innerHTML = '';
            container.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        container.classList.remove('hidden');
        emptyState.classList.add('hidden');

        if (this.viewMode === 'grid') {
            this.renderGridView(items);
        } else {
            this.renderListView(items);
        }
    }

    // Render grid view
    renderGridView(items) {
        const container = document.getElementById('filesContainer');
        
        let html = '<div class="files-grid">';
        
        items.forEach(item => {
            if (item.type === 'folder') {
                html += this.renderFolderGrid(item);
            } else {
                html += this.renderFileGrid(item);
            }
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    // Render folder in grid view
    renderFolderGrid(folder) {
        return `
            <div class="folder-card bg-amber-600/5 rounded-xl p-4 border border-amber-600/20 hover:border-amber-600/40" data-folder-id="${folder.id}" data-path="${folder.path}/${folder.name}">
                <div class="flex flex-col items-center text-center">
                    <div class="w-16 h-16 rounded-xl bg-amber-600/20 flex items-center justify-center mb-3" style="color: ${folder.color || '#b45309'};">
                        <i class="fas fa-folder text-3xl"></i>
                    </div>
                    <h4 class="font-medium text-amber-100 mb-1 truncate w-full">${folder.name}</h4>
                    <p class="text-xs text-amber-200/50">${folder.itemCount || 0} items</p>
                    <p class="text-xs text-amber-200/30 mt-2">Modified ${this.formatDate(folder.modifiedAt)}</p>
                </div>
                <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="w-8 h-8 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 folder-options" data-folder-id="${folder.id}">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // Render file in grid view
    renderFileGrid(file) {
        const ext = this.getFileExtension(file.name);
        const iconClass = this.getFileIconClass(ext);
        
        return `
            <div class="file-card bg-amber-600/5 rounded-xl p-4 border border-amber-600/20 hover:border-amber-600/40 cursor-pointer group" data-file-id="${file.id}">
                <div class="flex flex-col items-center text-center">
                    <div class="file-icon ${iconClass.split(' ')[1]} w-16 h-16 flex items-center justify-center mb-3">
                        <i class="fas ${iconClass.split(' ')[0]} text-3xl"></i>
                    </div>
                    <h4 class="font-medium text-amber-100 mb-1 truncate w-full">${file.name}</h4>
                    <p class="text-xs text-amber-200/50">${this.formatFileSize(file.size)}</p>
                    <p class="text-xs text-amber-200/30 mt-2">Modified ${this.formatDate(file.modifiedAt)}</p>
                </div>
                <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button class="w-8 h-8 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 file-preview" data-file-id="${file.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="w-8 h-8 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 file-options" data-file-id="${file.id}">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // Render list view
    renderListView(items) {
        const container = document.getElementById('filesContainer');
        
        let html = '<div class="files-list">';
        
        // Header
        html += `
            <div class="file-list-item header">
                <div class="col-span-2">Name</div>
                <div class="file-size">Size</div>
                <div class="file-modified">Modified</div>
                <div>Actions</div>
            </div>
        `;
        
        items.forEach(item => {
            if (item.type === 'folder') {
                html += this.renderFolderList(item);
            } else {
                html += this.renderFileList(item);
            }
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    // Render folder in list view
    renderFolderList(folder) {
        return `
            <div class="file-list-item cursor-pointer hover:bg-amber-600/10" data-folder-id="${folder.id}" data-path="${folder.path}/${folder.name}">
                <div class="flex items-center gap-3 col-span-2">
                    <div class="w-8 h-8 rounded-lg bg-amber-600/20 flex items-center justify-center" style="color: ${folder.color || '#b45309'};">
                        <i class="fas fa-folder"></i>
                    </div>
                    <span class="text-amber-100 font-medium">${folder.name}</span>
                </div>
                <div class="file-size text-amber-200/50">${folder.itemCount || 0} items</div>
                <div class="file-modified text-amber-200/50">${this.formatDate(folder.modifiedAt)}</div>
                <div>
                    <button class="w-8 h-8 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 folder-options" data-folder-id="${folder.id}">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // Render file in list view
    renderFileList(file) {
        const ext = this.getFileExtension(file.name);
        const iconClass = this.getFileIconClass(ext);
        
        return `
            <div class="file-list-item cursor-pointer hover:bg-amber-600/10" data-file-id="${file.id}">
                <div class="flex items-center gap-3 col-span-2">
                    <div class="file-icon ${iconClass.split(' ')[1]} w-8 h-8 rounded-lg flex items-center justify-center">
                        <i class="fas ${iconClass.split(' ')[0]}"></i>
                    </div>
                    <span class="text-amber-100">${file.name}</span>
                </div>
                <div class="file-size text-amber-200/50">${this.formatFileSize(file.size)}</div>
                <div class="file-modified text-amber-200/50">${this.formatDate(file.modifiedAt)}</div>
                <div class="flex gap-1">
                    <button class="w-8 h-8 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 file-preview" data-file-id="${file.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="w-8 h-8 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 file-options" data-file-id="${file.id}">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // Format date
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // Update breadcrumb
    updateBreadcrumb() {
        const breadcrumb = document.getElementById('breadcrumb');
        if (!breadcrumb) return;

        const paths = this.currentPath === 'root' ? [] : this.currentPath.split('/');
        
        let html = '<a href="#" class="breadcrumb-item" data-path="root">All Files</a>';
        
        let currentPath = '';
        paths.forEach((path, index) => {
            if (path) {
                currentPath += (currentPath ? '/' : '') + path;
                const isLast = index === paths.length - 1;
                html += `<a href="#" class="breadcrumb-item ${isLast ? 'active' : ''}" data-path="${currentPath}">${path}</a>`;
            }
        });
        
        breadcrumb.innerHTML = html;
    }

    // Navigate to path
    navigateTo(path) {
        this.currentPath = path;
        this.updateBreadcrumb();
        this.renderFiles();
    }

    // Update recent activity
    addRecentActivity(action, item, user) {
        const activity = {
            action,
            file: item.name,
            user: user || 'You',
            time: 'Just now'
        };
        
        this.recentActivity.unshift(activity);
        if (this.recentActivity.length > 10) {
            this.recentActivity.pop();
        }
        
        this.renderRecentActivity();
        this.saveData();
    }

    // Render recent activity
    renderRecentActivity() {
        const container = document.getElementById('recentActivity');
        if (!container) return;

        if (this.recentActivity.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-amber-200/50">
                    <i class="fas fa-clock text-2xl mb-2 opacity-50"></i>
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }

        let html = '<div class="space-y-2">';
        
        this.recentActivity.forEach(activity => {
            const icon = this.getActivityIcon(activity.action);
            html += `
                <div class="flex items-center gap-3 p-2 rounded-lg hover:bg-amber-600/10 transition-colors">
                    <div class="w-8 h-8 rounded-full bg-amber-600/20 flex items-center justify-center text-amber-400">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="flex-1">
                        <p class="text-sm text-amber-100">
                            <span class="font-medium">${activity.user}</span> ${activity.action}ed 
                            <span class="font-medium">${activity.file || activity.folder}</span>
                        </p>
                        <p class="text-xs text-amber-200/50">${activity.time}</p>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    // Get activity icon
    getActivityIcon(action) {
        const icons = {
            upload: 'fa-cloud-upload-alt',
            edit: 'fa-edit',
            share: 'fa-share-alt',
            create: 'fa-plus-circle',
            delete: 'fa-trash',
            move: 'fa-arrows-alt',
            rename: 'fa-i-cursor'
        };
        return icons[action] || 'fa-file';
    }

    // Update storage stats
    updateStorageStats() {
        const totalSize = this.files.reduce((sum, file) => sum + (file.size || 0), 0);
        const totalStorage = 5 * 1024 * 1024 * 1024; // 5 GB
        const usedPercent = (totalSize / totalStorage) * 100;
        
        document.getElementById('usedStorage').textContent = this.formatFileSize(totalSize);
        document.getElementById('storageBarFill').style.width = Math.min(usedPercent, 100) + '%';
    }

    // Create new folder
    createFolder(name) {
        if (!name) return false;

        const newFolder = {
            id: 'folder_' + Date.now(),
            name: name,
            path: this.currentPath,
            createdAt: new Date().toISOString().split('T')[0],
            modifiedAt: new Date().toISOString().split('T')[0],
            itemCount: 0,
            color: this.getRandomColor()
        };

        this.folders.push(newFolder);
        this.addRecentActivity('create', newFolder, 'You');
        this.saveData();
        this.renderFiles();
        
        return true;
    }

    // Get random color for folder
    getRandomColor() {
        const colors = ['#b45309', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', '#f59e0b'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // Show file preview
    showFilePreview(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (!file) return;

        const modal = document.getElementById('previewModal');
        const title = document.getElementById('previewTitle');
        const content = document.getElementById('previewContent');
        
        title.textContent = file.name;
        
        const ext = this.getFileExtension(file.name);
        const iconClass = this.getFileIconClass(ext);
        
        // Generate preview based on file type
        let previewHtml = '';
        
        if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif') {
            previewHtml = `
                <div class="flex items-center justify-center bg-amber-950/30 rounded-lg p-4">
                    <div class="text-center">
                        <i class="fas ${iconClass.split(' ')[0]} text-8xl ${iconClass.split(' ')[1]} mb-4"></i>
                        <p class="text-amber-100">Image preview would appear here</p>
                        <p class="text-sm text-amber-200/50 mt-2">${file.name}</p>
                    </div>
                </div>
            `;
        } else if (ext === 'pdf') {
            previewHtml = `
                <div class="bg-amber-950/30 rounded-lg p-4">
                    <div class="flex items-center gap-4 mb-4">
                        <i class="fas fa-file-pdf text-4xl text-red-400"></i>
                        <div>
                            <h4 class="text-amber-100 font-medium">PDF Document</h4>
                            <p class="text-sm text-amber-200/50">${this.formatFileSize(file.size)}</p>
                        </div>
                    </div>
                    <div class="border-2 border-dashed border-amber-600/30 rounded-lg p-8 text-center">
                        <p class="text-amber-200/70">PDF preview would be displayed here</p>
                        <p class="text-sm text-amber-200/50 mt-2">Page 1 of 24</p>
                    </div>
                </div>
            `;
        } else {
            previewHtml = `
                <div class="flex flex-col items-center justify-center bg-amber-950/30 rounded-lg p-8">
                    <i class="fas ${iconClass.split(' ')[0]} text-8xl ${iconClass.split(' ')[1]} mb-4"></i>
                    <p class="text-amber-100 text-lg">${file.name}</p>
                    <p class="text-amber-200/50 mt-2">${this.formatFileSize(file.size)}</p>
                    <p class="text-sm text-amber-200/30 mt-4">Uploaded by ${file.uploadedBy} on ${file.uploadedAt}</p>
                </div>
            `;
        }
        
        content.innerHTML = previewHtml;
        modal.dataset.fileId = fileId;
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    // Show file info
    showFileInfo(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (!file) return;

        const modal = document.getElementById('fileInfoModal');
        const title = document.getElementById('infoModalTitle');
        const content = document.getElementById('fileInfoContent');
        const versions = document.getElementById('versionHistory');
        
        title.textContent = file.name;
        
        const ext = this.getFileExtension(file.name);
        const iconClass = this.getFileIconClass(ext);
        
        content.innerHTML = `
            <div class="flex items-center gap-4 p-4 bg-amber-600/10 rounded-lg">
                <div class="file-icon ${iconClass.split(' ')[1]} w-16 h-16 flex items-center justify-center">
                    <i class="fas ${iconClass.split(' ')[0]} text-3xl"></i>
                </div>
                <div>
                    <h4 class="text-amber-100 font-medium">${file.name}</h4>
                    <p class="text-sm text-amber-200/50">${this.formatFileSize(file.size)}</p>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div class="p-3 bg-amber-600/5 rounded-lg">
                    <p class="text-xs text-amber-200/50">Type</p>
                    <p class="text-amber-100">${ext.toUpperCase()} File</p>
                </div>
                <div class="p-3 bg-amber-600/5 rounded-lg">
                    <p class="text-xs text-amber-200/50">Size</p>
                    <p class="text-amber-100">${this.formatFileSize(file.size)}</p>
                </div>
                <div class="p-3 bg-amber-600/5 rounded-lg">
                    <p class="text-xs text-amber-200/50">Uploaded</p>
                    <p class="text-amber-100">${file.uploadedAt}</p>
                </div>
                <div class="p-3 bg-amber-600/5 rounded-lg">
                    <p class="text-xs text-amber-200/50">Modified</p>
                    <p class="text-amber-100">${file.modifiedAt}</p>
                </div>
                <div class="p-3 bg-amber-600/5 rounded-lg">
                    <p class="text-xs text-amber-200/50">Uploaded by</p>
                    <p class="text-amber-100">${file.uploadedBy}</p>
                </div>
                <div class="p-3 bg-amber-600/5 rounded-lg">
                    <p class="text-xs text-amber-200/50">Path</p>
                    <p class="text-amber-100 truncate">${file.path}</p>
                </div>
            </div>
            
            ${file.description ? `
                <div class="p-3 bg-amber-600/5 rounded-lg">
                    <p class="text-xs text-amber-200/50">Description</p>
                    <p class="text-amber-100">${file.description}</p>
                </div>
            ` : ''}
            
            ${file.tags && file.tags.length > 0 ? `
                <div class="p-3 bg-amber-600/5 rounded-lg">
                    <p class="text-xs text-amber-200/50 mb-2">Tags</p>
                    <div class="flex flex-wrap gap-2">
                        ${file.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
        `;
        
        // Version history
        if (file.versions && file.versions.length > 0) {
            versions.innerHTML = file.versions.map(v => `
                <div class="version-item">
                    <div>
                        <p class="text-sm text-amber-100">Version ${v.version}</p>
                        <p class="text-xs text-amber-200/50">${v.date} by ${v.uploadedBy}</p>
                    </div>
                    <p class="text-sm text-amber-200/50">${this.formatFileSize(v.size)}</p>
                </div>
            `).join('');
        } else {
            versions.innerHTML = '<p class="text-sm text-amber-200/50 text-center py-4">No version history</p>';
        }
        
        modal.dataset.fileId = fileId;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    // Delete file
    deleteFile(fileId) {
        if (!confirm('Are you sure you want to delete this file?')) return;
        
        const index = this.files.findIndex(f => f.id === fileId);
        if (index !== -1) {
            const file = this.files[index];
            this.files.splice(index, 1);
            this.addRecentActivity('delete', file, 'You');
            this.saveData();
            this.renderFiles();
            this.updateStorageStats();
        }
    }

    // Delete folder
    deleteFolder(folderId) {
        if (!confirm('Are you sure you want to delete this folder and all its contents?')) return;
        
        const index = this.folders.findIndex(f => f.id === folderId);
        if (index !== -1) {
            const folder = this.folders[index];
            
            // Delete all files in this folder
            const folderPath = folder.path === 'root' ? folder.name : `${folder.path}/${folder.name}`;
            this.files = this.files.filter(f => !f.path.startsWith(folderPath));
            
            // Delete subfolders
            this.folders = this.folders.filter(f => !f.path.startsWith(folderPath));
            
            // Delete the folder itself
            this.folders.splice(index, 1);
            
            this.addRecentActivity('delete', folder, 'You');
            this.saveData();
            this.renderFiles();
            this.updateStorageStats();
        }
    }

    // Share file
    shareFile(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (!file) return;

        const modal = document.getElementById('shareModal');
        const fileName = document.getElementById('shareFileName');
        
        fileName.textContent = file.name;
        modal.dataset.fileId = fileId;
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        this.addRecentActivity('share', file, 'You');
    }

    // Download file (simulated)
    downloadFile(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (!file) return;

        // In a real app, this would trigger a download
        alert(`Downloading ${file.name}...\n(This is a simulation - in a real app, the file would download.)`);
    }
}

// Initialize file manager
const fileManager = new FileManager();

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing files page');
    
    // Initialize sidebar
    if (typeof initSidebar === 'function') {
        initSidebar();
    }
    
    // Render initial files
    fileManager.renderFiles();
    fileManager.updateBreadcrumb();
    fileManager.renderRecentActivity();
    fileManager.updateStorageStats();
    
    // Set up event listeners
    setupFileEventListeners();
});

function setupFileEventListeners() {
    // View toggle
    const gridViewBtn = document.getElementById('gridViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    
    if (gridViewBtn) {
        gridViewBtn.addEventListener('click', () => {
            gridViewBtn.classList.add('active');
            listViewBtn.classList.remove('active');
            fileManager.viewMode = 'grid';
            fileManager.renderFiles();
        });
    }
    
    if (listViewBtn) {
        listViewBtn.addEventListener('click', () => {
            listViewBtn.classList.add('active');
            gridViewBtn.classList.remove('active');
            fileManager.viewMode = 'list';
            fileManager.renderFiles();
        });
    }
    
    // Search
    const searchInput = document.getElementById('searchFiles');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            fileManager.searchTerm = e.target.value;
            fileManager.renderFiles();
        });
    }
    
    // Sort
    const sortSelect = document.getElementById('sortFiles');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            fileManager.sortBy = e.target.value;
            fileManager.renderFiles();
        });
    }
    
    // Breadcrumb navigation
    document.addEventListener('click', (e) => {
        const breadcrumbItem = e.target.closest('.breadcrumb-item');
        if (breadcrumbItem) {
            e.preventDefault();
            const path = breadcrumbItem.dataset.path;
            fileManager.navigateTo(path);
        }
    });
    
    // Folder click (navigation)
    document.addEventListener('click', (e) => {
        const folderCard = e.target.closest('[data-folder-id]');
        if (folderCard && !e.target.closest('button')) {
            const folderId = folderCard.dataset.folderId;
            const folder = fileManager.folders.find(f => f.id === folderId);
            if (folder) {
                const path = folder.path === 'root' ? folder.name : `${folder.path}/${folder.name}`;
                fileManager.navigateTo(path);
            }
        }
    });
    
    // File click (preview)
    document.addEventListener('click', (e) => {
        const fileCard = e.target.closest('[data-file-id]');
        if (fileCard && !e.target.closest('button')) {
            const fileId = fileCard.dataset.fileId;
            fileManager.showFilePreview(fileId);
        }
    });
    
    // File preview buttons
    document.addEventListener('click', (e) => {
        const previewBtn = e.target.closest('.file-preview');
        if (previewBtn) {
            e.stopPropagation();
            const fileId = previewBtn.closest('[data-file-id]')?.dataset.fileId;
            if (fileId) fileManager.showFilePreview(fileId);
        }
    });
    
    // File options buttons
    document.addEventListener('click', (e) => {
        const optionsBtn = e.target.closest('.file-options');
        if (optionsBtn) {
            e.stopPropagation();
            const fileId = optionsBtn.closest('[data-file-id]')?.dataset.fileId;
            if (fileId) showFileContextMenu(e, fileId);
        }
    });
    
    // Folder options buttons
    document.addEventListener('click', (e) => {
        const optionsBtn = e.target.closest('.folder-options');
        if (optionsBtn) {
            e.stopPropagation();
            const folderId = optionsBtn.closest('[data-folder-id]')?.dataset.folderId;
            if (folderId) showFolderContextMenu(e, folderId);
        }
    });
    
    // Quick access tags
    document.querySelectorAll('.tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const filter = tag.dataset.filter;
            fileManager.searchTerm = filter;
            document.getElementById('searchFiles').value = filter;
            fileManager.renderFiles();
        });
    });
    
    // New folder button
    const newFolderBtn = document.getElementById('newFolderBtn');
    const folderModal = document.getElementById('newFolderModal');
    const closeFolderBtn = document.getElementById('closeFolderModal');
    const cancelFolderBtn = document.getElementById('cancelFolderBtn');
    const createFolderBtn = document.getElementById('createFolderBtn');
    const folderNameInput = document.getElementById('folderName');
    
    if (newFolderBtn) {
        newFolderBtn.addEventListener('click', () => {
            folderNameInput.value = '';
            folderModal.classList.remove('hidden');
            folderModal.classList.add('flex');
        });
    }
    
    if (closeFolderBtn) {
        closeFolderBtn.addEventListener('click', () => {
            folderModal.classList.add('hidden');
            folderModal.classList.remove('flex');
        });
    }
    
    if (cancelFolderBtn) {
        cancelFolderBtn.addEventListener('click', () => {
            folderModal.classList.add('hidden');
            folderModal.classList.remove('flex');
        });
    }
    
    if (folderModal) {
        folderModal.addEventListener('click', (e) => {
            if (e.target === folderModal) {
                folderModal.classList.add('hidden');
                folderModal.classList.remove('flex');
            }
        });
    }
    
    if (createFolderBtn) {
        createFolderBtn.addEventListener('click', () => {
            const name = folderNameInput.value.trim();
            if (name) {
                fileManager.createFolder(name);
                folderModal.classList.add('hidden');
                folderModal.classList.remove('flex');
            }
        });
    }
    
    // Upload modal - UPDATED to use new uploadFiles method
    const uploadBtn = document.getElementById('uploadFileBtn');
    const emptyStateUploadBtn = document.getElementById('emptyStateUploadBtn');
    const uploadModal = document.getElementById('uploadModal');
    const closeUploadBtn = document.getElementById('closeUploadModal');
    const cancelUploadBtn = document.getElementById('cancelUploadBtn');
    const browseFilesBtn = document.getElementById('browseFilesBtn');
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const uploadQueue = document.getElementById('uploadQueue');
    const startUploadBtn = document.getElementById('startUploadBtn');
    
    let selectedFiles = [];
    
    function openUploadModal() {
        uploadModal.classList.remove('hidden');
        uploadModal.classList.add('flex');
        uploadQueue.innerHTML = '';
        selectedFiles = [];
        startUploadBtn.disabled = true;
    }
    
    if (uploadBtn) uploadBtn.addEventListener('click', openUploadModal);
    if (emptyStateUploadBtn) emptyStateUploadBtn.addEventListener('click', openUploadModal);
    
    if (closeUploadBtn) {
        closeUploadBtn.addEventListener('click', () => {
            uploadModal.classList.add('hidden');
            uploadModal.classList.remove('flex');
        });
    }
    
    if (cancelUploadBtn) {
        cancelUploadBtn.addEventListener('click', () => {
            uploadModal.classList.add('hidden');
            uploadModal.classList.remove('flex');
        });
    }
    
    if (uploadModal) {
        uploadModal.addEventListener('click', (e) => {
            if (e.target === uploadModal) {
                uploadModal.classList.add('hidden');
                uploadModal.classList.remove('flex');
            }
        });
    }
    
    if (browseFilesBtn && fileInput) {
        browseFilesBtn.addEventListener('click', () => {
            fileInput.click();
        });
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });
    }
    
    // Drag and drop
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            handleFiles(e.dataTransfer.files);
        });
    }
    
    function handleFiles(files) {
        if (files.length === 0) return;
        
        selectedFiles = files;
        uploadQueue.innerHTML = '';
        
        Array.from(files).forEach(file => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-2 bg-amber-600/10 rounded-lg';
            item.innerHTML = `
                <div class="flex items-center gap-2">
                    <i class="fas fa-file text-amber-400"></i>
                    <span class="text-sm text-amber-100">${file.name}</span>
                    <span class="text-xs text-amber-200/50">${fileManager.formatFileSize(file.size)}</span>
                </div>
                <i class="fas fa-clock text-amber-400"></i>
            `;
            uploadQueue.appendChild(item);
        });
        
        startUploadBtn.disabled = false;
    }
    
    if (startUploadBtn) {
        startUploadBtn.addEventListener('click', async () => {
            if (selectedFiles.length === 0) return;
            
            // Clear the queue display (will be repopulated with upload status)
            uploadQueue.innerHTML = '';
            
            // Upload files using the new Supabase method
            await fileManager.uploadFiles(selectedFiles);
            
            // Close modal after a short delay
            setTimeout(() => {
                uploadModal.classList.add('hidden');
                uploadModal.classList.remove('flex');
                
                // Refresh the view
                fileManager.renderFiles();
                fileManager.updateStorageStats();
            }, 1500);
        });
    }
    
    // Preview modal
    const closePreviewBtn = document.getElementById('closePreviewModal');
    const downloadFromPreview = document.getElementById('downloadFromPreview');
    const shareFromPreview = document.getElementById('shareFromPreview');
    const previewModal = document.getElementById('previewModal');
    
    if (closePreviewBtn) {
        closePreviewBtn.addEventListener('click', () => {
            previewModal.classList.add('hidden');
            previewModal.classList.remove('flex');
        });
    }
    
    if (previewModal) {
        previewModal.addEventListener('click', (e) => {
            if (e.target === previewModal) {
                previewModal.classList.add('hidden');
                previewModal.classList.remove('flex');
            }
        });
    }
    
    if (downloadFromPreview) {
        downloadFromPreview.addEventListener('click', () => {
            const fileId = previewModal.dataset.fileId;
            if (fileId) fileManager.downloadFile(fileId);
        });
    }
    
    if (shareFromPreview) {
        shareFromPreview.addEventListener('click', () => {
            const fileId = previewModal.dataset.fileId;
            if (fileId) {
                previewModal.classList.add('hidden');
                previewModal.classList.remove('flex');
                fileManager.shareFile(fileId);
            }
        });
    }
    
    // Info modal
    const closeInfoBtn = document.getElementById('closeInfoModal');
    const infoModal = document.getElementById('fileInfoModal');
    
    if (closeInfoBtn) {
        closeInfoBtn.addEventListener('click', () => {
            infoModal.classList.add('hidden');
            infoModal.classList.remove('flex');
        });
    }
    
    if (infoModal) {
        infoModal.addEventListener('click', (e) => {
            if (e.target === infoModal) {
                infoModal.classList.add('hidden');
                infoModal.classList.remove('flex');
            }
        });
    }
    
    // Share modal
    const closeShareBtn = document.getElementById('closeShareModal');
    const shareModal = document.getElementById('shareModal');
    
    if (closeShareBtn) {
        closeShareBtn.addEventListener('click', () => {
            shareModal.classList.add('hidden');
            shareModal.classList.remove('flex');
        });
    }
    
    if (shareModal) {
        shareModal.addEventListener('click', (e) => {
            if (e.target === shareModal) {
                shareModal.classList.add('hidden');
                shareModal.classList.remove('flex');
            }
        });
    }
    
    // Context menu functions
    window.showFileContextMenu = function(e, fileId) {
        const file = fileManager.files.find(f => f.id === fileId);
        if (!file) return;
        
        const action = prompt(`Choose action for ${file.name}:\n1. Download\n2. Info\n3. Share\n4. Delete\n(Enter number)`);
        
        if (action === '1') {
            fileManager.downloadFile(fileId);
        } else if (action === '2') {
            fileManager.showFileInfo(fileId);
        } else if (action === '3') {
            fileManager.shareFile(fileId);
        } else if (action === '4') {
            fileManager.deleteFile(fileId);
        }
    };
    
    window.showFolderContextMenu = function(e, folderId) {
        const folder = fileManager.folders.find(f => f.id === folderId);
        if (!folder) return;
        
        const action = prompt(`Choose action for folder ${folder.name}:\n1. Info\n2. Delete\n(Enter number)`);
        
        if (action === '1') {
            alert(`Folder: ${folder.name}\nPath: ${folder.path}\nCreated: ${folder.createdAt}\nItems: ${folder.itemCount || 0}`);
        } else if (action === '2') {
            fileManager.deleteFolder(folderId);
        }
    };
}