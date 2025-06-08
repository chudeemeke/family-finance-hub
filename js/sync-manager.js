/**
 * Enhanced Sync Manager
 * Handles data synchronization with GitHub Gist storage
 * Implements conflict resolution and offline queue
 */

class EnhancedSyncManager {
    constructor() {
        this.syncEndpoint = 'https://api.github.com/gists';
        this.syncInterval = null;
        this.syncInProgress = false;
        this.conflictResolutionStrategy = 'last-write-wins';
        this.vectorClock = {};
        this.syncQueue = [];
        this.lastSyncTime = null;
        this.gistToken = null; // In production, use OAuth
    }
    
    /**
     * Initialize sync manager
     * @param {string} familyCode - Family identifier
     * @param {string} memberCode - Member identifier
     * @param {string} gistId - GitHub Gist ID for storage
     */
    init(familyCode, memberCode, gistId = null) {
        this.familyCode = familyCode;
        this.memberCode = memberCode;
        this.gistId = gistId;
        
        // Initialize vector clock for this member
        if (!this.vectorClock[memberCode]) {
            this.vectorClock[memberCode] = 0;
        }
        
        // Load sync queue from storage
        this.loadSyncQueue();
        
        // Start periodic sync
        this.startPeriodicSync();
        
        // Listen for online/offline events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Sync on visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && navigator.onLine) {
                this.syncNow();
            }
        });
        
        // Listen for storage events (sync across tabs)
        window.addEventListener('storage', (e) => this.handleStorageChange(e));
    }
    
    /**
     * Load sync queue from storage
     */
    async loadSyncQueue() {
        try {
            if (window.dbManager && window.dbManager.db) {
                const queue = await window.dbManager.getAll('syncQueue');
                this.syncQueue = queue.filter(item => item.status === 'pending');
            }
        } catch (error) {
            console.error('Failed to load sync queue:', error);
        }
    }
    
    /**
     * Start periodic sync
     */
    startPeriodicSync() {
        // Clear existing interval
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        // Sync every 30 seconds when online
        this.syncInterval = setInterval(() => {
            if (navigator.onLine && !this.syncInProgress) {
                this.syncNow();
            }
        }, 30000);
        
        // Initial sync if online
        if (navigator.onLine) {
            setTimeout(() => this.syncNow(), 1000);
        }
    }
    
    /**
     * Handle coming online
     */
    handleOnline() {
        console.log('Network connection restored');
        
        // Process sync queue
        this.processSyncQueue();
        
        // Perform full sync
        this.syncNow();
        
        // Show notification
        if (window.notificationManager) {
            window.notificationManager.add('Back online! Syncing data...', 'info');
        }
    }
    
    /**
     * Handle going offline
     */
    handleOffline() {
        console.log('Network connection lost');
        
        // Show notification
        if (window.notificationManager) {
            window.notificationManager.add(
                'You\'re offline. Changes will sync when connection returns.', 
                'warning'
            );
        }
    }
    
    /**
     * Handle storage changes (sync across tabs)
     */
    handleStorageChange(event) {
        if (event.key && event.key.startsWith('ffh_')) {
            console.log('Storage change detected:', event.key);
            
            // Trigger UI update if needed
            if (window.appContext && window.appContext.refreshData) {
                window.appContext.refreshData();
            }
        }
    }
    
    /**
     * Add operation to sync queue
     * @param {Object} operation - Operation to queue
     */
    async queueOperation(operation) {
        const queueItem = {
            id: window.SecurityManager.generateUUID(),
            timestamp: Date.now(),
            memberCode: this.memberCode,
            operation: operation,
            vectorClock: { ...this.vectorClock },
            status: 'pending'
        };
        
        this.syncQueue.push(queueItem);
        
        // Save to IndexedDB
        if (window.dbManager && window.dbManager.db) {
            await window.dbManager.save('syncQueue', queueItem);
        }
        
        // Try to sync immediately if online
        if (navigator.onLine && !this.syncInProgress) {
            this.processSyncQueue();
        }
    }
    
    /**
     * Process queued operations
     */
    async processSyncQueue() {
        if (this.syncQueue.length === 0 || this.syncInProgress) return;
        
        console.log('Processing sync queue:', this.syncQueue.length, 'items');
        this.syncInProgress = true;
        
        try {
            const pendingOps = this.syncQueue.filter(op => op.status === 'pending');
            
            for (const op of pendingOps) {
                try {
                    await this.syncOperation(op);
                    op.status = 'completed';
                    
                    // Remove from queue
                    this.syncQueue = this.syncQueue.filter(item => item.id !== op.id);
                    
                    // Remove from IndexedDB
                    if (window.dbManager && window.dbManager.db) {
                        await window.dbManager.delete('syncQueue', op.id);
                    }
                } catch (error) {
                    console.error('Failed to sync operation:', error);
                    op.status = 'failed';
                    op.error = error.message;
                    op.retryCount = (op.retryCount || 0) + 1;
                    
                    // Remove if too many retries
                    if (op.retryCount > 3) {
                        this.syncQueue = this.syncQueue.filter(item => item.id !== op.id);
                    }
                }
            }
        } finally {
            this.syncInProgress = false;
        }
    }
    
    /**
     * Sync single operation
     * @param {Object} operation - Operation to sync
     */
    async syncOperation(operation) {
        // Increment vector clock
        this.vectorClock[this.memberCode]++;
        
        // Add vector clock to operation
        operation.vectorClock = { ...this.vectorClock };
        
        console.log('Syncing operation:', operation.operation.type);
        
        // In a real implementation, this would sync to a backend
        // For now, we'll just update local state
        return Promise.resolve();
    }
    
    /**
     * Perform full sync
     */
    async syncNow() {
        if (this.syncInProgress || !navigator.onLine) return;
        
        this.syncInProgress = true;
        console.log('Starting sync...');
        
        // Update sync status in UI
        if (window.appContext && window.appContext.setSyncStatus) {
            window.appContext.setSyncStatus('syncing');
        }
        
        try {
            // Process any pending operations first
            await this.processSyncQueue();
            
            // Get local data
            const localData = await this.getLocalData();
            
            // Get remote data (if gist exists)
            const remoteData = this.gistId ? await this.getRemoteData() : null;
            
            // Merge data with conflict resolution
            const mergedData = await this.mergeData(localData, remoteData);
            
            // Save merged data locally
            await this.saveLocalData(mergedData);
            
            // Upload merged data (if we have a gist)
            if (this.gistId) {
                await this.uploadData(mergedData);
            }
            
            // Update last sync time
            this.lastSyncTime = new Date();
            
            // Update UI
            if (window.appContext) {
                window.appContext.setSyncStatus?.('success');
                window.appContext.showNotification?.('Data synced successfully!', 'success');
            }
            
            console.log('Sync completed successfully');
        } catch (error) {
            console.error('Sync failed:', error);
            
            if (window.appContext) {
                window.appContext.setSyncStatus?.('error');
                window.appContext.showNotification?.('Sync failed. Will retry...', 'error');
            }
        } finally {
            this.syncInProgress = false;
        }
    }
    
    /**
     * Get all local data for sync
     */
    async getLocalData() {
        if (!window.dbManager || !window.dbManager.db) {
            await window.dbManager.init();
        }
        
        const data = {
            transactions: await window.dbManager.getAll('transactions'),
            budgets: await window.dbManager.getAll('budgets'),
            savingsGoals: await window.dbManager.getAll('savingsGoals'),
            billReminders: await window.dbManager.getAll('billReminders'),
            accounts: await window.dbManager.getAll('accounts'),
            investments: await window.dbManager.getAll('investments'),
            shoppingLists: await window.dbManager.getAll('shoppingLists'),
            familyTasks: await window.dbManager.getAll('familyTasks'),
            sharedNotes: await window.dbManager.getAll('sharedNotes'),
            settings: await window.dbManager.getAll('settings'),
            activityFeed: await window.dbManager.getAll('activityFeed'),
            vectorClock: this.vectorClock,
            lastModified: new Date().toISOString(),
            memberCode: this.memberCode
        };
        
        return data;
    }
    
    /**
     * Get remote data from GitHub Gist
     */
    async getRemoteData() {
        if (!this.gistId) return null;
        
        try {
            const headers = {
                'Accept': 'application/vnd.github.v3+json'
            };
            
            // Add auth token if available
            if (this.gistToken) {
                headers['Authorization'] = `token ${this.gistToken}`;
            }
            
            const response = await fetch(`${this.syncEndpoint}/${this.gistId}`, {
                headers
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const gist = await response.json();
            const content = gist.files?.['family-finance-data.json']?.content;
            
            if (!content) {
                return null;
            }
            
            // Parse and decrypt data
            try {
                const parsed = JSON.parse(content);
                if (parsed.encrypted && this.familyCode) {
                    const decrypted = window.SecurityManager.decrypt(parsed.data, this.familyCode);
                    return decrypted;
                }
                return parsed;
            } catch (error) {
                console.error('Failed to parse remote data:', error);
                return null;
            }
        } catch (error) {
            console.error('Failed to fetch remote data:', error);
            return null;
        }
    }
    
    /**
     * Merge local and remote data with conflict resolution
     */
    async mergeData(localData, remoteData) {
        if (!remoteData) {
            return localData;
        }
        
        const merged = { ...localData };
        
        // Merge vector clocks
        Object.entries(remoteData.vectorClock || {}).forEach(([member, clock]) => {
            if (!this.vectorClock[member] || clock > this.vectorClock[member]) {
                this.vectorClock[member] = clock;
            }
        });
        
        // Merge each data type
        const dataTypes = [
            'transactions', 'budgets', 'savingsGoals', 
            'billReminders', 'accounts', 'investments',
            'shoppingLists', 'familyTasks', 'sharedNotes',
            'settings', 'activityFeed'
        ];
        
        for (const type of dataTypes) {
            merged[type] = await this.mergeCollection(
                localData[type] || [],
                remoteData[type] || [],
                type
            );
        }
        
        merged.vectorClock = this.vectorClock;
        merged.lastModified = new Date().toISOString();
        
        return merged;
    }
    
    /**
     * Merge two collections with conflict resolution
     */
    async mergeCollection(local, remote, type) {
        const merged = new Map();
        
        // Add all local items
        local.forEach(item => {
            merged.set(item.id, item);
        });
        
        // Merge remote items
        remote.forEach(remoteItem => {
            const localItem = merged.get(remoteItem.id);
            
            if (!localItem) {
                // Item only exists remotely
                merged.set(remoteItem.id, remoteItem);
            } else {
                // Conflict - resolve based on strategy
                const resolvedItem = this.resolveConflict(localItem, remoteItem, type);
                merged.set(remoteItem.id, resolvedItem);
            }
        });
        
        return Array.from(merged.values());
    }
    
    /**
     * Resolve conflict between local and remote items
     */
    resolveConflict(local, remote, type) {
        switch (this.conflictResolutionStrategy) {
            case 'last-write-wins':
                // Compare timestamps
                const localTime = new Date(local.updatedAt || local.createdAt || 0).getTime();
                const remoteTime = new Date(remote.updatedAt || remote.createdAt || 0).getTime();
                return localTime > remoteTime ? local : remote;
                
            case 'remote-wins':
                return remote;
                
            case 'local-wins':
                return local;
                
            case 'manual':
                // Queue for manual resolution
                this.queueConflict(local, remote, type);
                return local; // Keep local until resolved
                
            default:
                return local;
        }
    }
    
    /**
     * Save merged data locally
     */
    async saveLocalData(data) {
        if (!window.dbManager || !window.dbManager.db) {
            await window.dbManager.init();
        }
        
        // Save each collection
        for (const [type, items] of Object.entries(data)) {
            if (Array.isArray(items) && window.dbManager.stores[type]) {
                await window.dbManager.clear(window.dbManager.stores[type]);
                if (items.length > 0) {
                    await window.dbManager.saveBatch(window.dbManager.stores[type], items);
                }
            }
        }
    }
    
    /**
     * Upload data to GitHub Gist
     */
    async uploadData(data) {
        if (!this.gistId) {
            console.warn('No gist ID configured for upload');
            return;
        }
        
        // Prepare data for upload
        const uploadData = {
            ...data,
            encrypted: true,
            data: window.SecurityManager.encrypt(data, this.familyCode)
        };
        
        const content = {
            files: {
                'family-finance-data.json': {
                    content: JSON.stringify(uploadData, null, 2)
                }
            }
        };
        
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
        
        // Add auth token if available
        if (this.gistToken) {
            headers['Authorization'] = `token ${this.gistToken}`;
        }
        
        const response = await fetch(`${this.syncEndpoint}/${this.gistId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(content)
        });
        
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
        }
        
        return response.json();
    }
    
    /**
     * Create new gist for family
     */
    async createGist() {
        const content = {
            description: `Family Finance Hub - ${this.familyCode}`,
            public: false,
            files: {
                'family-finance-data.json': {
                    content: JSON.stringify({ 
                        created: new Date().toISOString(),
                        familyCode: this.familyCode 
                    })
                }
            }
        };
        
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
        
        if (this.gistToken) {
            headers['Authorization'] = `token ${this.gistToken}`;
        }
        
        const response = await fetch(this.syncEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(content)
        });
        
        if (!response.ok) {
            throw new Error(`Failed to create gist: ${response.status}`);
        }
        
        const gist = await response.json();
        this.gistId = gist.id;
        return gist;
    }
}

// Initialize enhanced sync manager
window.enhancedSyncManager = new EnhancedSyncManager();