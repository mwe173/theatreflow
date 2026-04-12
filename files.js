// ===== FILES MANAGEMENT WITH SUPABASE (COMPLETE WORKING VERSION) =====

import { supabase, auth } from './supabase.js';

console.log('Files script loaded');

class FileManager {
    constructor() {
        this.currentFolderId = null;
        this.currentPath = 'root';
        this.currentFolderName = 'All Files';
        this.viewMode = 'grid';
        this.searchTerm = '';
        this.sortBy = 'name';
        this.files = [];
        this.folders = [];
        this.userId = null;
        this.currentShowId = null;
        this.selectedFiles = [];
        
        this.init();
    }

    async init() {
        console.log('Initializing FileManager...');
        await this.getUserAndShow();
        await this.loadDataFromSupabase();
        this.setupEventListeners();
        this.render();
        this.updateBreadcrumb();
        console.log('FileManager initialized');
    }

    async getUserAndShow() {
        try {
            const user = await auth.getUser();
            if (user) {
                this.userId = user.id;
                console.log('User ID:', this.userId);
            } else {
                console.error('No user found');
                this.showToast('Please log in again', 'error');
                return;
            }
            
            this.currentShowId = localStorage.getItem('currentShowId');
            if (this.currentShowId) {
                this.currentShowId = parseInt(this.currentShowId);
                console.log('Show ID:', this.currentShowId);
            } else {
                console.warn('No show selected');
                this.showToast('Please select a show in Settings', 'warning');
            }
        } catch (error) {
            console.error('Error getting user/show:', error);
        }
    }

    async loadDataFromSupabase() {
        if (!this.userId || !this.currentShowId) {
            console.log('No user or show selected, skipping data load');
            this.files = [];
            this.folders = [];
            return;
        }

        try {
            console.log('Loading folders from Supabase...');
            const { data: foldersData, error: foldersError } = await supabase
                .from('folders')
                .select('*')
                .eq('user_id', this.userId)
                .order('created_at', { ascending: false });

            if (foldersError) throw foldersError;

            console.log('Loading files from Supabase...');
            let query = supabase
                .from('files')
                .select('*')
                .eq('user_id', this.userId)
                .eq('show_id', this.currentShowId);
            
            if (this.currentFolderId) {
                query = query.eq('folder_id', this.currentFolderId);
            } else {
                query = query.is('folder_id', null);
            }
            
            const { data: filesData, error: filesError } = await query.order('created_at', { ascending: false });

            if (filesError) throw filesError;

            this.folders = foldersData || [];
            this.files = filesData || [];

            console.log(`Loaded ${this.files.length} files and ${this.folders.length} folders`);
            this.updateStorageStats();
            this.updateBreadcrumb();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('Failed to load files: ' + error.message, 'error');
        }
    }

    updateBreadcrumb() {
        const breadcrumb = document.getElementById('breadcrumb');
        if (!breadcrumb) return;
        
        breadcrumb.innerHTML = '';
        
        const rootSpan = document.createElement('span');
        rootSpan.className = 'breadcrumb-item';
        if (!this.currentFolderId) rootSpan.classList.add('active');
        rootSpan.innerHTML = '<i class="fas fa-home mr-1"></i> All Files';
        rootSpan.style.cursor = 'pointer';
        rootSpan.onclick = () => this.navigateToRoot();
        breadcrumb.appendChild(rootSpan);
        
        if (this.currentFolderId && this.currentFolderName !== 'All Files') {
            const separator = document.createTextNode(' / ');
            breadcrumb.appendChild(separator);
            
            const folderSpan = document.createElement('span');
            folderSpan.className = 'breadcrumb-item active';
            folderSpan.innerHTML = `<i class="fas fa-folder mr-1"></i> ${this.escapeHtml(this.currentFolderName)}`;
            breadcrumb.appendChild(folderSpan);
        }
    }

    async navigateToRoot() {
        console.log('Navigating to root');
        this.currentFolderId = null;
        this.currentFolderName = 'All Files';
        this.currentPath = 'root';
        await this.loadDataFromSupabase();
        this.render();
        this.showToast('Viewing All Files', 'info');
    }

    async navigateToFolder(folderId, folderName) {
        console.log(`Navigating to folder: ${folderName}`);
        this.currentFolderId = folderId;
        this.currentFolderName = folderName;
        this.currentPath = `root/${folderName}`;
        await this.loadDataFromSupabase();
        this.render();
        this.showToast(`Opened folder: ${folderName}`, 'info');
    }

    async moveFileToFolder(fileId, folderId) {
        try {
            const { error } = await supabase
                .from('files')
                .update({ folder_id: folderId })
                .eq('id', fileId);

            if (error) throw error;

            await this.loadDataFromSupabase();
            this.render();
            const folderName = folderId ? this.folders.find(f => f.id === folderId)?.name || 'folder' : 'Root';
            this.showToast(`File moved to ${folderName}`, 'success');
        } catch (error) {
            console.error('Error moving file:', error);
            this.showToast('Failed to move file', 'error');
        }
    }

    async getSignedUrl(storagePath) {
        try {
            const { data, error } = await supabase.storage
                .from('production-files')
                .createSignedUrl(storagePath, 3600);
            
            if (error) {
                console.error('Signed URL error:', error);
                return null;
            }
            return data.signedUrl;
        } catch (error) {
            console.error('Error getting signed URL:', error);
            return null;
        }
    }

    async uploadFileToSupabase(file, folderId = null) {
        console.log('Uploading file:', file.name);
        
        if (!this.userId || !this.currentShowId) {
            this.showToast('Please select a show first', 'error');
            return null;
        }

        try {
            const timestamp = Date.now();
            const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const filePath = `${this.userId}/${this.currentShowId}/${timestamp}_${safeFileName}`;
            
            const { error: uploadError } = await supabase.storage
                .from('production-files')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const fileExt = file.name.split('.').pop().toLowerCase();
            const fileType = this.getFileCategory(fileExt);

            const fileRecord = {
                name: file.name,
                type: 'file',
                file_type: fileType,
                size: file.size,
                path: this.currentPath,
                storage_path: filePath,
                url: null,
                folder_id: folderId || this.currentFolderId,
                user_id: this.userId,
                show_id: this.currentShowId,
                description: '',
                tags: []
            };

            const { data, error } = await supabase
                .from('files')
                .insert([fileRecord])
                .select()
                .single();

            if (error) throw error;

            this.addRecentActivity('upload', { name: file.name });
            return data;
            
        } catch (error) {
            console.error('Upload failed:', error);
            this.showToast(`Failed to upload ${file.name}: ${error.message}`, 'error');
            return null;
        }
    }

    async uploadFiles(files) {
        const uploadQueue = document.getElementById('uploadQueue');
        const startUploadBtn = document.getElementById('startUploadBtn');
        
        if (startUploadBtn) startUploadBtn.disabled = true;
        
        let successCount = 0;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const uploadItem = this.createUploadItem(file, 'uploading');
            if (uploadQueue) uploadQueue.appendChild(uploadItem);
            
            const result = await this.uploadFileToSupabase(file);
            
            if (result) {
                this.updateUploadItem(uploadItem, 'success');
                successCount++;
            } else {
                this.updateUploadItem(uploadItem, 'error');
            }
        }
        
        if (startUploadBtn) startUploadBtn.disabled = false;
        
        await this.loadDataFromSupabase();
        this.render();
        this.updateStorageStats();
        
        this.showToast(`Uploaded ${successCount} of ${files.length} files`, successCount > 0 ? 'success' : 'error');
        this.selectedFiles = [];
    }

    async getFileUrl(file) {
        if (file.storage_path) {
            return await this.getSignedUrl(file.storage_path);
        }
        return null;
    }

    async showFilePreview(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (!file) {
            console.error('File not found:', fileId);
            return;
        }

        const modal = document.getElementById('previewModal');
        const title = document.getElementById('previewTitle');
        const content = document.getElementById('previewContent');
        
        title.textContent = file.name;
        
        content.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto"></div><p class="text-amber-100 mt-4">Loading preview...</p></div>';
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        const fileUrl = await this.getFileUrl(file);
        
        if (!fileUrl) {
            content.innerHTML = this.getPreviewErrorHtml('Unable to load file');
            return;
        }
        
        let previewHtml = '';
        
        if (file.file_type === 'image') {
            previewHtml = `
                <div class="flex items-center justify-center bg-amber-950/30 rounded-lg p-4">
                    <img src="${fileUrl}" alt="${file.name}" class="max-w-full max-h-[60vh] object-contain rounded-lg">
                </div>
            `;
        } else if (file.file_type === 'pdf') {
            previewHtml = `
                <div class="bg-amber-950/30 rounded-lg p-4">
                    <iframe src="${fileUrl}" class="w-full h-[60vh] rounded-lg"></iframe>
                </div>
            `;
        } else if (file.name.endsWith('.txt')) {
            try {
                const response = await fetch(fileUrl);
                const text = await response.text();
                previewHtml = `
                    <div class="bg-amber-950/30 rounded-lg p-4">
                        <div class="bg-black/30 rounded-lg p-4 overflow-auto max-h-[60vh]">
                            <pre class="text-amber-100 font-mono text-sm whitespace-pre-wrap">${this.escapeHtml(text.substring(0, 100000))}</pre>
                        </div>
                    </div>
                `;
            } catch (error) {
                previewHtml = this.getPreviewErrorHtml('Could not load text file');
            }
        } else {
            previewHtml = this.getPreviewFallbackHtml(file.name, fileUrl);
        }
        
        content.innerHTML = previewHtml;
        modal.dataset.fileId = fileId;
        modal.dataset.fileUrl = fileUrl;
        modal.dataset.fileName = file.name;
        
        const downloadBtn = document.getElementById('downloadFromPreviewBtn');
        if (downloadBtn) {
            downloadBtn.onclick = () => this.downloadFile(fileUrl, file.name);
        }
        
        const openInNewTabBtn = document.getElementById('openInNewTabBtn');
        if (openInNewTabBtn) {
            openInNewTabBtn.onclick = () => window.open(fileUrl, '_blank');
        }
    }

    getPreviewErrorHtml(message) {
        return `
            <div class="flex flex-col items-center justify-center bg-amber-950/30 rounded-lg p-8">
                <i class="fas fa-exclamation-triangle text-6xl text-red-400 mb-4"></i>
                <p class="text-amber-100 text-lg">${message}</p>
                <button id="downloadFromPreviewBtn" class="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg">
                    <i class="fas fa-download mr-2"></i>Download File
                </button>
            </div>
        `;
    }

    getPreviewFallbackHtml(fileName, fileUrl) {
        return `
            <div class="flex flex-col items-center justify-center bg-amber-950/30 rounded-lg p-8">
                <i class="fas fa-file-alt text-6xl text-amber-400 mb-4"></i>
                <p class="text-amber-100 text-lg">${this.escapeHtml(fileName)}</p>
                <p class="text-amber-200/50 mt-2">Preview not available for this file type</p>
                <div class="flex gap-3 mt-4">
                    <button id="downloadFromPreviewBtn" class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg">
                        <i class="fas fa-download mr-2"></i>Download File
                    </button>
                    <button id="openInNewTabBtn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                        <i class="fas fa-external-link-alt mr-2"></i>Open in New Tab
                    </button>
                </div>
            </div>
        `;
    }

    downloadFile(url, fileName) {
        if (!url) {
            this.showToast('Download URL not available', 'error');
            return;
        }
        window.open(url, '_blank');
        this.showToast(`Opening ${fileName} in new tab...`, 'success');
    }

    getFileCategory(extension) {
        const categories = {
            'pdf': 'pdf',
            'txt': 'text',
            'doc': 'document', 'docx': 'document',
            'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'webp': 'image', 'svg': 'image',
            'mp3': 'audio', 'wav': 'audio', 'ogg': 'audio', 'm4a': 'audio',
            'mp4': 'video', 'mov': 'video', 'avi': 'video', 'mkv': 'video',
            'zip': 'archive', 'rar': 'archive', '7z': 'archive',
            'js': 'code', 'html': 'code', 'css': 'code', 'json': 'code', 'xml': 'code'
        };
        return categories[extension] || 'default';
    }

    getFileIconClass(fileType) {
        const icons = {
            pdf: 'fa-file-pdf pdf',
            document: 'fa-file-word doc',
            text: 'fa-file-alt default',
            image: 'fa-file-image image',
            audio: 'fa-file-audio audio',
            video: 'fa-file-video video',
            archive: 'fa-file-archive archive',
            code: 'fa-file-code code',
            default: 'fa-file default'
        };
        return icons[fileType] || icons.default;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    getCurrentItems() {
        let items = [
            ...this.folders.map(f => ({ ...f, isFolder: true, file_type: 'folder' })),
            ...this.files.map(f => ({ ...f, isFolder: false }))
        ];

        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            items = items.filter(item => item.name.toLowerCase().includes(searchLower));
        }

        items.sort((a, b) => {
            if (this.sortBy === 'name') return a.name.localeCompare(b.name);
            if (this.sortBy === 'date') return new Date(b.created_at) - new Date(a.created_at);
            if (this.sortBy === 'size') return (b.size || 0) - (a.size || 0);
            if (this.sortBy === 'type') return (a.file_type || '').localeCompare(b.file_type || '');
            return 0;
        });

        return items;
    }

    render() {
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

    renderGridView(items) {
        const container = document.getElementById('filesContainer');
        let html = '<div class="files-grid">';
        
        items.forEach(item => {
            if (item.isFolder) {
                html += this.renderFolderGrid(item);
            } else {
                html += this.renderFileGrid(item);
            }
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    renderFolderGrid(folder) {
        return `
            <div class="folder-card bg-amber-600/5 rounded-xl p-4 border border-amber-600/20 hover:border-amber-600/40 cursor-pointer" 
                 data-id="${folder.id}" data-type="folder" data-name="${folder.name}">
                <div class="flex flex-col items-center text-center">
                    <div class="w-16 h-16 rounded-xl bg-amber-600/20 flex items-center justify-center mb-3">
                        <i class="fas fa-folder text-3xl" style="color: ${folder.color || '#b45309'};"></i>
                    </div>
                    <h4 class="font-medium text-amber-100 mb-1 truncate w-full">${this.escapeHtml(folder.name)}</h4>
                    <p class="text-xs text-amber-200/50">Folder</p>
                    <p class="text-xs text-amber-200/30 mt-2">${this.formatDate(folder.created_at)}</p>
                </div>
                <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="w-8 h-8 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 item-options" 
                            data-id="${folder.id}" data-type="folder" data-name="${folder.name}">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            </div>
        `;
    }

    renderFileGrid(file) {
        const iconClass = this.getFileIconClass(file.file_type);
        const iconParts = iconClass.split(' ');
        
        return `
            <div class="file-card bg-amber-600/5 rounded-xl p-4 border border-amber-600/20 hover:border-amber-600/40 cursor-pointer" 
                 data-id="${file.id}" data-type="file" data-name="${file.name}">
                <div class="flex flex-col items-center text-center">
                    <div class="file-icon ${iconParts[1]} w-16 h-16 flex items-center justify-center mb-3">
                        <i class="fas ${iconParts[0]} text-3xl"></i>
                    </div>
                    <h4 class="font-medium text-amber-100 mb-1 truncate w-full">${this.escapeHtml(file.name)}</h4>
                    <p class="text-xs text-amber-200/50">${this.formatFileSize(file.size)}</p>
                    <p class="text-xs text-amber-200/30 mt-2">${this.formatDate(file.created_at)}</p>
                </div>
                <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button class="w-8 h-8 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 file-preview" 
                            data-id="${file.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="w-8 h-8 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 item-options" 
                            data-id="${file.id}" data-type="file" data-name="${file.name}">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            </div>
        `;
    }

    renderListView(items) {
        const container = document.getElementById('filesContainer');
        
        let html = '<div class="files-list">';
        html += `
            <div class="file-list-item header">
                <div>Name</div>
                <div class="file-size">Size</div>
                <div class="file-modified">Modified</div>
                <div>Actions</div>
            </div>
        `;
        
        items.forEach(item => {
            if (item.isFolder) {
                html += this.renderFolderList(item);
            } else {
                html += this.renderFileList(item);
            }
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    renderFolderList(folder) {
        return `
            <div class="file-list-item cursor-pointer hover:bg-amber-600/10" 
                 data-id="${folder.id}" data-type="folder" data-name="${folder.name}">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-amber-600/20 flex items-center justify-center">
                        <i class="fas fa-folder" style="color: ${folder.color || '#b45309'};"></i>
                    </div>
                    <span class="text-amber-100 font-medium">${this.escapeHtml(folder.name)}</span>
                </div>
                <div class="file-size text-amber-200/50">Folder</div>
                <div class="file-modified text-amber-200/50">${this.formatDate(folder.created_at)}</div>
                <div>
                    <button class="w-8 h-8 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 item-options" 
                            data-id="${folder.id}" data-type="folder" data-name="${folder.name}">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            </div>
        `;
    }

    renderFileList(file) {
        const iconClass = this.getFileIconClass(file.file_type);
        const iconParts = iconClass.split(' ');
        
        return `
            <div class="file-list-item cursor-pointer hover:bg-amber-600/10" 
                 data-id="${file.id}" data-type="file" data-name="${file.name}">
                <div class="flex items-center gap-3">
                    <div class="file-icon ${iconParts[1]} w-8 h-8 rounded-lg flex items-center justify-center">
                        <i class="fas ${iconParts[0]}"></i>
                    </div>
                    <span class="text-amber-100">${this.escapeHtml(file.name)}</span>
                </div>
                <div class="file-size text-amber-200/50">${this.formatFileSize(file.size)}</div>
                <div class="file-modified text-amber-200/50">${this.formatDate(file.created_at)}</div>
                <div class="flex gap-1">
                    <button class="w-8 h-8 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 file-preview" 
                            data-id="${file.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="w-8 h-8 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 item-options" 
                            data-id="${file.id}" data-type="file" data-name="${file.name}">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            </div>
        `;
    }

    showMoveToFolderMenu(fileId, fileName) {
        if (this.folders.length === 0) {
            this.showToast('No folders available to move to', 'warning');
            return;
        }
        
        const folderOptions = this.folders.map(folder => 
            `<div class="context-menu-item" data-folder-id="${folder.id}">
                <i class="fas fa-folder"></i> ${this.escapeHtml(folder.name)}
            </div>`
        ).join('');
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.position = 'fixed';
        menu.style.left = `${window.event ? window.event.clientX : 100}px`;
        menu.style.top = `${window.event ? window.event.clientY : 100}px`;
        menu.innerHTML = `
            <div class="context-menu-item" style="font-weight: bold; border-bottom: 1px solid #334155;">
                <i class="fas fa-arrow-right"></i> Move "${this.escapeHtml(fileName)}" to:
            </div>
            ${folderOptions}
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" data-folder-id="null">
                <i class="fas fa-folder-open"></i> Root (No Folder)
            </div>
        `;
        
        document.body.appendChild(menu);
        
        const handleClick = async (e) => {
            const item = e.target.closest('.context-menu-item');
            if (item && item.dataset.folderId !== undefined) {
                const targetFolderId = item.dataset.folderId === 'null' ? null : item.dataset.folderId;
                await this.moveFileToFolder(fileId, targetFolderId);
            }
            menu.remove();
            document.removeEventListener('click', handleClick);
        };
        
        setTimeout(() => document.addEventListener('click', handleClick), 0);
    }

    showContextMenu(e, id, type, name) {
        e.preventDefault();
        e.stopPropagation();
        
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) existingMenu.remove();
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = `${e.pageX}px`;
        menu.style.top = `${e.pageY}px`;
        
        if (type === 'file') {
            menu.innerHTML = `
                <div class="context-menu-item" data-action="preview">
                    <i class="fas fa-eye"></i> Preview
                </div>
                <div class="context-menu-item" data-action="download">
                    <i class="fas fa-download"></i> Download
                </div>
                <div class="context-menu-item" data-action="move">
                    <i class="fas fa-folder-open"></i> Move to Folder
                </div>
                <div class="context-menu-divider"></div>
                <div class="context-menu-item" data-action="rename">
                    <i class="fas fa-pencil-alt"></i> Rename
                </div>
                <div class="context-menu-item" data-action="delete" style="color: #ef4444;">
                    <i class="fas fa-trash"></i> Delete
                </div>
            `;
        } else {
            menu.innerHTML = `
                <div class="context-menu-item" data-action="open">
                    <i class="fas fa-folder-open"></i> Open Folder
                </div>
                <div class="context-menu-divider"></div>
                <div class="context-menu-item" data-action="rename">
                    <i class="fas fa-pencil-alt"></i> Rename
                </div>
                <div class="context-menu-item" data-action="delete" style="color: #ef4444;">
                    <i class="fas fa-trash"></i> Delete
                </div>
            `;
        }
        
        document.body.appendChild(menu);
        
        menu.addEventListener('click', async (event) => {
            const action = event.target.closest('.context-menu-item')?.dataset.action;
            if (!action) return;
            
            menu.remove();
            
            switch (action) {
                case 'preview':
                    await this.showFilePreview(id);
                    break;
                case 'download':
                    const fileData = this.files.find(f => f.id === id);
                    if (fileData) {
                        const url = await this.getFileUrl(fileData);
                        if (url) this.downloadFile(url, fileData.name);
                    }
                    break;
                case 'move':
                    this.showMoveToFolderMenu(id, name);
                    break;
                case 'open':
                    await this.navigateToFolder(id, name);
                    break;
                case 'rename':
                    this.showRenameModal(id, type, name);
                    break;
                case 'delete':
                    if (type === 'file') {
                        await this.deleteFile(id);
                    } else {
                        await this.deleteFolder(id);
                    }
                    break;
            }
        });
        
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    async deleteFile(fileId) {
        const confirmed = confirm('Are you sure you want to delete this file?');
        if (!confirmed) return;

        try {
            const file = this.files.find(f => f.id === fileId);
            
            if (file && file.storage_path) {
                await supabase.storage
                    .from('production-files')
                    .remove([file.storage_path]);
            }

            await supabase.from('files').delete().eq('id', fileId);
            await this.loadDataFromSupabase();
            this.render();
            this.updateStorageStats();
            this.showToast('File deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting file:', error);
            this.showToast('Failed to delete file', 'error');
        }
    }

    async deleteFolder(folderId) {
        const confirmed = confirm(`Delete this folder? Files inside will be moved to root.`);
        if (!confirmed) return;

        try {
            await supabase
                .from('files')
                .update({ folder_id: null })
                .eq('folder_id', folderId);

            await supabase.from('folders').delete().eq('id', folderId);
            
            if (this.currentFolderId === folderId) {
                await this.navigateToRoot();
            } else {
                await this.loadDataFromSupabase();
                this.render();
            }
            this.showToast('Folder deleted', 'success');
        } catch (error) {
            console.error('Error deleting folder:', error);
            this.showToast('Failed to delete folder', 'error');
        }
    }

    async renameFile(fileId, newName) {
        if (!newName) return false;

        try {
            await supabase
                .from('files')
                .update({ name: newName })
                .eq('id', fileId);

            await this.loadDataFromSupabase();
            this.render();
            this.showToast(`Renamed to "${newName}"`, 'success');
            return true;
        } catch (error) {
            console.error('Error renaming file:', error);
            this.showToast('Failed to rename file', 'error');
            return false;
        }
    }

    async renameFolder(folderId, newName) {
        if (!newName) return false;

        try {
            await supabase
                .from('folders')
                .update({ name: newName })
                .eq('id', folderId);

            if (this.currentFolderId === folderId) {
                this.currentFolderName = newName;
            }
            
            await this.loadDataFromSupabase();
            this.render();
            this.showToast(`Folder renamed to "${newName}"`, 'success');
            return true;
        } catch (error) {
            console.error('Error renaming folder:', error);
            this.showToast('Failed to rename folder', 'error');
            return false;
        }
    }

    async createFolder(name) {
        if (!name) return false;

        try {
            const { error } = await supabase
                .from('folders')
                .insert([{
                    name: name,
                    path: this.currentPath,
                    user_id: this.userId,
                    color: this.getRandomColor()
                }]);

            if (error) throw error;

            this.addRecentActivity('create', { name: name });
            await this.loadDataFromSupabase();
            this.render();
            this.showToast(`Folder "${name}" created`, 'success');
            return true;
        } catch (error) {
            console.error('Error creating folder:', error);
            this.showToast('Failed to create folder', 'error');
            return false;
        }
    }

    showRenameModal(id, type, currentName) {
        const modal = document.getElementById('renameModal');
        const input = document.getElementById('renameInput');
        
        input.value = currentName;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        const confirmBtn = document.getElementById('confirmRenameBtn');
        const closeBtn = document.getElementById('closeRenameModal');
        const cancelBtn = document.getElementById('cancelRenameBtn');
        
        const handleConfirm = async () => {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                if (type === 'file') {
                    await this.renameFile(id, newName);
                } else {
                    await this.renameFolder(id, newName);
                }
            }
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            cleanup();
        };
        
        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            closeBtn.removeEventListener('click', cleanup);
            cancelBtn.removeEventListener('click', cleanup);
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        closeBtn.addEventListener('click', cleanup);
        cancelBtn.addEventListener('click', cleanup);
    }

    addRecentActivity(action, item) {
        const container = document.getElementById('recentActivity');
        if (!container) return;
        
        const activityHtml = `
            <div class="flex items-center gap-3 p-2 rounded-lg hover:bg-amber-600/10 transition-colors">
                <div class="w-8 h-8 rounded-full bg-amber-600/20 flex items-center justify-center text-amber-400">
                    <i class="fas ${this.getActivityIcon(action)}"></i>
                </div>
                <div class="flex-1">
                    <p class="text-sm text-amber-100">
                        You ${action}ed <span class="font-medium">${this.escapeHtml(item.name)}</span>
                    </p>
                    <p class="text-xs text-amber-200/50">Just now</p>
                </div>
            </div>
        `;
        
        if (container.innerHTML.includes('No recent activity')) {
            container.innerHTML = '<div class="space-y-2"></div>';
        }
        
        const activityContainer = container.querySelector('.space-y-2') || container;
        activityContainer.insertAdjacentHTML('afterbegin', activityHtml);
        
        const items = activityContainer.children;
        while (items.length > 10) {
            items[items.length - 1].remove();
        }
    }

    getActivityIcon(action) {
        const icons = {
            upload: 'fa-cloud-upload-alt',
            create: 'fa-plus-circle',
            delete: 'fa-trash',
            rename: 'fa-pencil-alt'
        };
        return icons[action] || 'fa-file';
    }

    updateStorageStats() {
        const totalSize = this.files.reduce((sum, file) => sum + (file.size || 0), 0);
        const totalStorage = 5 * 1024 * 1024 * 1024;
        const usedPercent = (totalSize / totalStorage) * 100;
        
        const usedEl = document.getElementById('usedStorage');
        const fillEl = document.getElementById('storageBarFill');
        
        if (usedEl) usedEl.textContent = this.formatFileSize(totalSize);
        if (fillEl) fillEl.style.width = Math.min(usedPercent, 100) + '%';
    }

    getRandomColor() {
        const colors = ['#b45309', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', '#f59e0b'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    createUploadItem(file, status) {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-2 bg-amber-600/10 rounded-lg';
        item.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fas fa-file text-amber-400"></i>
                <span class="text-sm text-amber-100">${this.escapeHtml(file.name)}</span>
                <span class="text-xs text-amber-200/50">${this.formatFileSize(file.size)}</span>
            </div>
            <div class="upload-status">
                ${status === 'uploading' ? '<div class="loading-spinner"></div>' : 
                  status === 'success' ? '<i class="fas fa-check-circle text-green-400"></i>' :
                  '<i class="fas fa-exclamation-circle text-red-400"></i>'}
            </div>
        `;
        return item;
    }

    updateUploadItem(item, status) {
        const statusDiv = item.querySelector('.upload-status');
        if (status === 'success') {
            statusDiv.innerHTML = '<i class="fas fa-check-circle text-green-400"></i>';
        } else {
            statusDiv.innerHTML = '<i class="fas fa-exclamation-circle text-red-400"></i>';
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) {
            console.log('Toast:', message);
            alert(message);
            return;
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="flex-1">
                <p class="text-sm text-amber-100">${this.escapeHtml(message)}</p>
            </div>
            <button class="toast-close ml-3 text-amber-200/50 hover:text-amber-100">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(toast);
        
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => toast.remove());
        
        setTimeout(() => toast.remove(), 5000);
    }

    escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // View toggle
    const gridViewBtn = document.getElementById('gridViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    
    if (gridViewBtn) {
        gridViewBtn.addEventListener('click', () => {
            gridViewBtn.classList.add('active');
            listViewBtn.classList.remove('active');
            this.viewMode = 'grid';
            this.render();
        });
    }
    
    if (listViewBtn) {
        listViewBtn.addEventListener('click', () => {
            listViewBtn.classList.add('active');
            gridViewBtn.classList.remove('active');
            this.viewMode = 'list';
            this.render();
        });
    }
    
    // Search
    const searchInput = document.getElementById('searchFiles');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value;
            this.render();
        });
    }
    
    // Sort
    const sortSelect = document.getElementById('sortFiles');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.render();
        });
    }
    
    // Quick access tags
    document.querySelectorAll('.tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const filter = tag.dataset.filter;
            this.searchTerm = filter;
            const searchEl = document.getElementById('searchFiles');
            if (searchEl) searchEl.value = filter;
            this.render();
        });
    });
    
    // Get DOM elements
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
    
    // Open modal
    const openModal = () => {
        console.log('Opening upload modal');
        if (uploadModal) {
            uploadModal.classList.remove('hidden');
            uploadModal.classList.add('flex');
            if (uploadQueue) uploadQueue.innerHTML = '';
            if (startUploadBtn) startUploadBtn.disabled = true;
            this.selectedFiles = [];
        }
    };
    
    if (uploadBtn) uploadBtn.addEventListener('click', openModal);
    if (emptyStateUploadBtn) emptyStateUploadBtn.addEventListener('click', openModal);
    
    // Close modal
    const closeModal = () => {
        if (uploadModal) {
            uploadModal.classList.add('hidden');
            uploadModal.classList.remove('flex');
        }
        this.selectedFiles = [];
        if (fileInput) fileInput.value = '';
    };
    
    if (closeUploadBtn) closeUploadBtn.addEventListener('click', closeModal);
    if (cancelUploadBtn) cancelUploadBtn.addEventListener('click', closeModal);
    
    if (uploadModal) {
        uploadModal.addEventListener('click', (e) => {
            if (e.target === uploadModal) closeModal();
        });
    }
    
    // Handle selected files
    const handleFiles = (files) => {
        if (!files || files.length === 0) {
            console.log('No files selected');
            return;
        }
        
        console.log('Files selected:', files.length);
        
        const fileArray = Array.from(files);
        this.selectedFiles = fileArray;
        
        console.log('Selected files stored:', this.selectedFiles.length);
        
        if (uploadQueue) {
            uploadQueue.innerHTML = '';
            
            fileArray.forEach(file => {
                const item = document.createElement('div');
                item.className = 'flex items-center justify-between p-2 bg-amber-600/10 rounded-lg';
                item.innerHTML = `
                    <div class="flex items-center gap-2">
                        <i class="fas fa-file text-amber-400"></i>
                        <span class="text-sm text-amber-100">${this.escapeHtml(file.name)}</span>
                        <span class="text-xs text-amber-200/50">${this.formatFileSize(file.size)}</span>
                    </div>
                    <i class="fas fa-clock text-amber-400"></i>
                `;
                uploadQueue.appendChild(item);
            });
        }
        
        if (startUploadBtn) {
            startUploadBtn.disabled = false;
            console.log('Upload button enabled');
        }
    };
    
    // Browse button - SIMPLE: just add click listener
    if (browseFilesBtn && fileInput) {
        browseFilesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Browse button clicked - opening file dialog');
            fileInput.click();
        });
    }
    
    // File input change
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            console.log('File input changed event fired');
            const files = e.target.files;
            if (files && files.length > 0) {
                console.log('Files found in input:', files.length);
                handleFiles(files);
            } else {
                console.log('No files in input');
            }
            // Reset the input so the same file can be selected again
            fileInput.value = '';
        });
    }
    
    // Upload area - drag and drop only (no click handler)
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
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                console.log('Files dropped:', files.length);
                handleFiles(files);
            }
        });
    }
    
    // Start upload button
    if (startUploadBtn) {
        startUploadBtn.addEventListener('click', async () => {
            console.log('Start upload clicked');
            console.log('Selected files count:', this.selectedFiles ? this.selectedFiles.length : 0);
            
            if (!this.selectedFiles || this.selectedFiles.length === 0) {
                console.log('No files selected, showing error');
                this.showToast('No files selected. Please browse or drag files first.', 'warning');
                return;
            }
            
            console.log('Starting upload of', this.selectedFiles.length, 'files');
            
            startUploadBtn.disabled = true;
            const originalText = startUploadBtn.innerHTML;
            startUploadBtn.innerHTML = '<div class="loading-spinner"></div> Uploading...';
            
            try {
                await this.uploadFiles(this.selectedFiles);
                closeModal();
            } catch (error) {
                console.error('Upload error:', error);
                this.showToast('Upload failed: ' + error.message, 'error');
            } finally {
                startUploadBtn.disabled = false;
                startUploadBtn.innerHTML = originalText;
            }
        });
    }
    
    // New folder button
    const newFolderBtn = document.getElementById('newFolderBtn');
    const folderModal = document.getElementById('newFolderModal');
    const closeFolderBtn = document.getElementById('closeFolderModal');
    const cancelFolderBtn = document.getElementById('cancelFolderBtn');
    const createFolderBtn = document.getElementById('createFolderBtn');
    const folderNameInput = document.getElementById('folderName');
    
    if (newFolderBtn) {
        newFolderBtn.addEventListener('click', () => {
            if (folderNameInput) folderNameInput.value = '';
            if (folderModal) {
                folderModal.classList.remove('hidden');
                folderModal.classList.add('flex');
            }
        });
    }
    
    const closeFolderModal = () => {
        if (folderModal) {
            folderModal.classList.add('hidden');
            folderModal.classList.remove('flex');
        }
    };
    
    if (closeFolderBtn) closeFolderBtn.addEventListener('click', closeFolderModal);
    if (cancelFolderBtn) cancelFolderBtn.addEventListener('click', closeFolderModal);
    
    if (folderModal) {
        folderModal.addEventListener('click', (e) => {
            if (e.target === folderModal) closeFolderModal();
        });
    }
    
    if (createFolderBtn) {
        createFolderBtn.addEventListener('click', async () => {
            const name = folderNameInput?.value.trim();
            if (name) {
                await this.createFolder(name);
                closeFolderModal();
            }
        });
    }
    
    // Preview modal
    const closePreviewBtn = document.getElementById('closePreviewModal');
    const downloadFromPreview = document.getElementById('downloadFromPreview');
    const deleteFromPreview = document.getElementById('deleteFromPreview');
    const previewModal = document.getElementById('previewModal');
    
    if (closePreviewBtn) {
        closePreviewBtn.addEventListener('click', () => {
            if (previewModal) {
                previewModal.classList.add('hidden');
                previewModal.classList.remove('flex');
            }
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
        downloadFromPreview.addEventListener('click', async () => {
            const fileId = previewModal?.dataset.fileId;
            if (fileId) {
                const file = this.files.find(f => f.id === fileId);
                if (file) {
                    const url = await this.getFileUrl(file);
                    if (url) this.downloadFile(url, file.name);
                }
            }
        });
    }
    
    if (deleteFromPreview) {
        deleteFromPreview.addEventListener('click', async () => {
            const id = previewModal?.dataset.fileId;
            if (id && confirm('Delete this file?')) {
                await this.deleteFile(id);
                if (previewModal) {
                    previewModal.classList.add('hidden');
                    previewModal.classList.remove('flex');
                }
            }
        });
    }
    
    // Info modal
    const closeInfoBtn = document.getElementById('closeInfoModal');
    const infoModal = document.getElementById('fileInfoModal');
    
    if (closeInfoBtn) {
        closeInfoBtn.addEventListener('click', () => {
            if (infoModal) {
                infoModal.classList.add('hidden');
                infoModal.classList.remove('flex');
            }
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
    
    // Rename modal
    const closeRenameBtn = document.getElementById('closeRenameModal');
    const cancelRenameBtn = document.getElementById('cancelRenameBtn');
    const renameModal = document.getElementById('renameModal');
    
    const closeRenameModal = () => {
        if (renameModal) {
            renameModal.classList.add('hidden');
            renameModal.classList.remove('flex');
        }
    };
    
    if (closeRenameBtn) closeRenameBtn.addEventListener('click', closeRenameModal);
    if (cancelRenameBtn) cancelRenameBtn.addEventListener('click', closeRenameModal);
    
    if (renameModal) {
        renameModal.addEventListener('click', (e) => {
            if (e.target === renameModal) closeRenameModal();
        });
    }
    
    // File/Folder click handlers
    const filesContainer = document.getElementById('filesContainer');
    if (filesContainer) {
        filesContainer.addEventListener('click', async (e) => {
            const previewBtn = e.target.closest('.file-preview');
            if (previewBtn) {
                e.stopPropagation();
                const id = previewBtn.dataset.id;
                await this.showFilePreview(id);
                return;
            }
            
            const card = e.target.closest('[data-id]');
            if (card && !e.target.closest('.item-options')) {
                const id = card.dataset.id;
                const type = card.dataset.type;
                const name = card.dataset.name;
                
                if (type === 'folder') {
                    await this.navigateToFolder(id, name);
                } else if (type === 'file') {
                    await this.showFilePreview(id);
                }
            }
        });
        
        filesContainer.addEventListener('contextmenu', (e) => {
            const card = e.target.closest('[data-id]');
            if (card) {
                e.preventDefault();
                const id = card.dataset.id;
                const type = card.dataset.type;
                const name = card.dataset.name;
                this.showContextMenu(e, id, type, name);
            }
        });
        
        filesContainer.addEventListener('click', (e) => {
            const optionsBtn = e.target.closest('.item-options');
            if (optionsBtn) {
                e.stopPropagation();
                const id = optionsBtn.dataset.id;
                const type = optionsBtn.dataset.type;
                const name = optionsBtn.dataset.name;
                this.showContextMenu(e, id, type, name);
            }
        });
    }
    
    console.log('Event listeners setup complete');
}
}

// Initialize file manager when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing files page');
    window.fileManager = new FileManager();
    
    if (typeof initSidebar === 'function') {
        initSidebar();
    }
});