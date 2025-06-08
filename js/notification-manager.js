/**
 * Notification Manager
 * Handles in-app notifications and browser notifications
 * Implements Observer pattern for notification events
 */

class NotificationManager {
    constructor() {
        this.notifications = [];
        this.observers = [];
        this.nextId = 1;
        this.permission = 'default';
        this.init();
    }
    
    /**
     * Initialize notification system
     */
    init() {
        // Check for notification support
        if ('Notification' in window) {
            this.permission = Notification.permission;
            
            // Request permission if not granted
            if (this.permission === 'default') {
                this.requestPermission();
            }
        }
        
        // Listen for service worker messages
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'notification') {
                    this.add(event.data.message, event.data.level || 'info');
                }
            });
        }
    }
    
    /**
     * Request notification permission
     */
    async requestPermission() {
        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            
            if (permission === 'granted') {
                this.add('Notifications enabled!', 'success', 3000);
            }
        } catch (error) {
            console.error('Failed to request notification permission:', error);
        }
    }
    
    /**
     * Add a notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, warning, info)
     * @param {number} duration - Duration in milliseconds (0 for persistent)
     * @param {Object} options - Additional options
     */
    add(message, type = 'info', duration = 5000, options = {}) {
        const notification = {
            id: this.nextId++,
            message,
            type,
            duration,
            timestamp: Date.now(),
            ...options
        };
        
        // Add to internal list
        this.notifications.push(notification);
        this.notifyObservers();
        
        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => this.remove(notification.id), duration);
        }
        
        // Show browser notification if permitted and app is in background
        if (this.permission === 'granted' && document.hidden) {
            this.showBrowserNotification(message, type, options);
        }
        
        // Haptic feedback on mobile
        if ('vibrate' in navigator && type === 'error') {
            navigator.vibrate([100, 50, 100]);
        } else if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }
        
        return notification.id;
    }
    
    /**
     * Remove a notification
     * @param {number} id - Notification ID
     */
    remove(id) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.notifyObservers();
    }
    
    /**
     * Clear all notifications
     */
    clear() {
        this.notifications = [];
        this.notifyObservers();
    }
    
    /**
     * Subscribe to notification changes
     * @param {Function} callback - Callback function
     */
    subscribe(callback) {
        this.observers.push(callback);
        
        // Send current notifications
        callback([...this.notifications]);
        
        // Return unsubscribe function
        return () => {
            this.observers = this.observers.filter(cb => cb !== callback);
        };
    }
    
    /**
     * Notify all observers
     */
    notifyObservers() {
        this.observers.forEach(callback => {
            try {
                callback([...this.notifications]);
            } catch (error) {
                console.error('Notification observer error:', error);
            }
        });
    }
    
    /**
     * Show browser notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type
     * @param {Object} options - Additional options
     */
    showBrowserNotification(message, type, options = {}) {
        if (!('Notification' in window) || this.permission !== 'granted') {
            return;
        }
        
        const icon = options.icon || '/icon-192.png';
        const badge = options.badge || '/icon-72.png';
        
        const notification = new Notification('Family Finance Hub', {
            body: message,
            icon,
            badge,
            tag: options.tag || `notification-${Date.now()}`,
            vibrate: [200, 100, 200],
            requireInteraction: type === 'error',
            actions: options.actions || [],
            data: {
                type,
                timestamp: Date.now(),
                ...options.data
            }
        });
        
        // Handle notification click
        notification.onclick = (event) => {
            event.preventDefault();
            window.focus();
            notification.close();
            
            if (options.onClick) {
                options.onClick(event);
            }
        };
        
        // Handle notification error
        notification.onerror = (error) => {
            console.error('Browser notification error:', error);
        };
    }
    
    /**
     * Show success notification
     * @param {string} message - Success message
     * @param {Object} options - Additional options
     */
    success(message, options = {}) {
        return this.add(message, 'success', 5000, options);
    }
    
    /**
     * Show error notification
     * @param {string} message - Error message
     * @param {Object} options - Additional options
     */
    error(message, options = {}) {
        return this.add(message, 'error', 10000, options);
    }
    
    /**
     * Show warning notification
     * @param {string} message - Warning message
     * @param {Object} options - Additional options
     */
    warning(message, options = {}) {
        return this.add(message, 'warning', 7000, options);
    }
    
    /**
     * Show info notification
     * @param {string} message - Info message
     * @param {Object} options - Additional options
     */
    info(message, options = {}) {
        return this.add(message, 'info', 5000, options);
    }
    
    /**
     * Show progress notification
     * @param {string} message - Progress message
     * @param {number} progress - Progress value (0-100)
     * @param {Object} options - Additional options
     */
    progress(message, progress, options = {}) {
        const existingId = options.id;
        
        if (existingId) {
            // Update existing notification
            const notification = this.notifications.find(n => n.id === existingId);
            if (notification) {
                notification.message = message;
                notification.progress = progress;
                this.notifyObservers();
                return existingId;
            }
        }
        
        // Create new progress notification
        return this.add(message, 'progress', 0, {
            ...options,
            progress
        });
    }
    
    /**
     * Show confirmation notification
     * @param {string} message - Confirmation message
     * @param {Function} onConfirm - Confirmation callback
     * @param {Function} onCancel - Cancel callback
     * @param {Object} options - Additional options
     */
    confirm(message, onConfirm, onCancel, options = {}) {
        return this.add(message, 'confirm', 0, {
            ...options,
            actions: [
                {
                    label: 'Confirm',
                    type: 'primary',
                    onClick: () => {
                        this.remove(notificationId);
                        if (onConfirm) onConfirm();
                    }
                },
                {
                    label: 'Cancel',
                    type: 'secondary',
                    onClick: () => {
                        this.remove(notificationId);
                        if (onCancel) onCancel();
                    }
                }
            ]
        });
    }
}

// Initialize global notification manager
window.notificationManager = new NotificationManager();

// Export for use in other modules
window.NotificationManager = NotificationManager;