/**
 * IndexedDB Manager
 * Implements Repository Pattern for data persistence
 * Provides offline-first storage with encryption support
 */

class IndexedDBManager {
    constructor() {
        this.dbName = 'FamilyFinanceHubDB';
        this.version = 2;
        this.db = null;
        this.stores = {
            transactions: 'transactions',
            budgets: 'budgets',
            savingsGoals: 'savingsGoals',
            billReminders: 'billReminders',
            accounts: 'accounts',
            investments: 'investments',
            shoppingLists: 'shoppingLists',
            familyTasks: 'familyTasks',
            sharedNotes: 'sharedNotes',
            settings: 'settings',
            syncQueue: 'syncQueue',
            activityFeed: 'activityFeed'
        };
    }
    
    /**
     * Initialize IndexedDB with all required object stores
     * Creates indexes for efficient querying
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized successfully');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores if they don't exist
                Object.entries(this.stores).forEach(([key, storeName]) => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        const store = db.createObjectStore(storeName, { 
                            keyPath: 'id', 
                            autoIncrement: false 
                        });
                        
                        // Create indexes based on store type
                        this.createIndexes(store, storeName);
                    }
                });
            };
        });
    }
    
    /**
     * Create indexes for a store
     * @param {IDBObjectStore} store - Object store
     * @param {string} storeName - Store name
     */
    createIndexes(store, storeName) {
        switch (storeName) {
            case 'transactions':
                store.createIndex('date', 'date', { unique: false });
                store.createIndex('category', 'category', { unique: false });
                store.createIndex('type', 'type', { unique: false });
                store.createIndex('accountId', 'accountId', { unique: false });
                store.createIndex('familyMember', 'familyMember', { unique: false });
                break;
                
            case 'billReminders':
                store.createIndex('dueDate', 'dueDate', { unique: false });
                store.createIndex('status', 'status', { unique: false });
                break;
                
            case 'savingsGoals':
                store.createIndex('targetDate', 'targetDate', { unique: false });
                store.createIndex('status', 'status', { unique: false });
                break;
                
            case 'activityFeed':
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('memberCode', 'memberCode', { unique: false });
                store.createIndex('type', 'type', { unique: false });
                break;
                
            case 'syncQueue':
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('status', 'status', { unique: false });
                break;
        }
    }
    
    /**
     * Generic method to save data with encryption
     * @param {string} storeName - Object store name
     * @param {Object} data - Data to save
     * @param {string} encryptionKey - Optional encryption key
     */
    async save(storeName, data, encryptionKey = null) {
        if (!this.db) await this.init();
        
        try {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            // Ensure data has an ID
            if (!data.id) {
                data.id = window.SecurityManager.generateUUID();
            }
            
            // Add timestamps
            if (!data.createdAt) {
                data.createdAt = new Date().toISOString();
            }
            data.updatedAt = new Date().toISOString();
            
            // Encrypt sensitive data if key provided
            const dataToSave = encryptionKey && this.isSensitiveStore(storeName)
                ? { 
                    ...data, 
                    encrypted: true,
                    data: window.SecurityManager.encrypt(data, encryptionKey) 
                }
                : data;
            
            const request = store.put(dataToSave);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error(`Error saving to ${storeName}:`, error);
            throw error;
        }
    }
    
    /**
     * Batch save operation for performance
     * @param {string} storeName - Object store name
     * @param {Array} items - Array of items to save
     * @param {string} encryptionKey - Optional encryption key
     */
    async saveBatch(storeName, items, encryptionKey = null) {
        if (!this.db) await this.init();
        
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        const promises = items.map(item => {
            // Ensure each item has an ID
            if (!item.id) {
                item.id = window.SecurityManager.generateUUID();
            }
            
            // Add timestamps
            if (!item.createdAt) {
                item.createdAt = new Date().toISOString();
            }
            item.updatedAt = new Date().toISOString();
            
            const dataToSave = encryptionKey && this.isSensitiveStore(storeName)
                ? { 
                    ...item, 
                    encrypted: true,
                    data: window.SecurityManager.encrypt(item, encryptionKey) 
                }
                : item;
                
            return store.put(dataToSave);
        });
        
        return Promise.all(promises);
    }
    
    /**
     * Get item by ID
     * @param {string} storeName - Object store name
     * @param {string} id - Item ID
     * @param {string} encryptionKey - Optional decryption key
     */
    async get(storeName, id, encryptionKey = null) {
        if (!this.db) await this.init();
        
        try {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    let result = request.result;
                    
                    // Decrypt if needed
                    if (result && result.encrypted && encryptionKey) {
                        const decrypted = window.SecurityManager.decrypt(result.data, encryptionKey);
                        result = decrypted || result;
                    }
                    
                    resolve(result);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error(`Error getting data from ${storeName}:`, error);
            return null;
        }
    }
    
    /**
     * Get all data from a store with optional decryption
     * @param {string} storeName - Object store name
     * @param {string} encryptionKey - Optional decryption key
     */
    async getAll(storeName, encryptionKey = null) {
        if (!this.db) await this.init();
        
        try {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    let results = request.result || [];
                    
                    // Decrypt if needed
                    if (encryptionKey && this.isSensitiveStore(storeName)) {
                        results = results.map(item => {
                            if (item.encrypted && item.data) {
                                const decrypted = window.SecurityManager.decrypt(item.data, encryptionKey);
                                return decrypted || item;
                            }
                            return item;
                        });
                    }
                    
                    resolve(results);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error(`Error getting data from ${storeName}:`, error);
            return [];
        }
    }
    
    /**
     * Query data by index
     * @param {string} storeName - Object store name
     * @param {string} indexName - Index name
     * @param {IDBKeyRange} range - Query range
     * @param {string} encryptionKey - Optional decryption key
     */
    async queryByIndex(storeName, indexName, range, encryptionKey = null) {
        if (!this.db) await this.init();
        
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(range);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                let results = request.result || [];
                
                // Decrypt if needed
                if (encryptionKey && this.isSensitiveStore(storeName)) {
                    results = results.map(item => {
                        if (item.encrypted && item.data) {
                            const decrypted = window.SecurityManager.decrypt(item.data, encryptionKey);
                            return decrypted || item;
                        }
                        return item;
                    });
                }
                
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Update item
     * @param {string} storeName - Object store name
     * @param {string} id - Item ID
     * @param {Object} updates - Updates to apply
     * @param {string} encryptionKey - Optional encryption key
     */
    async update(storeName, id, updates, encryptionKey = null) {
        const existing = await this.get(storeName, id, encryptionKey);
        if (!existing) {
            throw new Error(`Item with ID ${id} not found in ${storeName}`);
        }
        
        const updated = {
            ...existing,
            ...updates,
            id, // Ensure ID doesn't change
            updatedAt: new Date().toISOString()
        };
        
        return this.save(storeName, updated, encryptionKey);
    }
    
    /**
     * Delete item by ID
     * @param {string} storeName - Object store name
     * @param {string} id - Item ID
     */
    async delete(storeName, id) {
        if (!this.db) await this.init();
        
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Delete multiple items
     * @param {string} storeName - Object store name
     * @param {Array} ids - Array of IDs to delete
     */
    async deleteBatch(storeName, ids) {
        if (!this.db) await this.init();
        
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        const promises = ids.map(id => store.delete(id));
        return Promise.all(promises);
    }
    
    /**
     * Clear all data from a store
     * @param {string} storeName - Object store name
     */
    async clear(storeName) {
        if (!this.db) await this.init();
        
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Count items in store
     * @param {string} storeName - Object store name
     */
    async count(storeName) {
        if (!this.db) await this.init();
        
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Check if store contains sensitive data
     * @param {string} storeName - Store name to check
     */
    isSensitiveStore(storeName) {
        const sensitiveStores = [
            'transactions',
            'accounts',
            'investments',
            'savingsGoals'
        ];
        return sensitiveStores.includes(storeName);
    }
    
    /**
     * Export all data
     * @param {string} encryptionKey - Optional decryption key
     */
    async exportData(encryptionKey = null) {
        const data = {};
        
        for (const [key, storeName] of Object.entries(this.stores)) {
            data[key] = await this.getAll(storeName, encryptionKey);
        }
        
        return data;
    }
    
    /**
     * Import data
     * @param {Object} data - Data to import
     * @param {string} encryptionKey - Optional encryption key
     */
    async importData(data, encryptionKey = null) {
        for (const [key, items] of Object.entries(data)) {
            if (this.stores[key] && Array.isArray(items)) {
                await this.clear(this.stores[key]);
                if (items.length > 0) {
                    await this.saveBatch(this.stores[key], items, encryptionKey);
                }
            }
        }
    }
}

// Initialize global database manager
window.dbManager = new IndexedDBManager();