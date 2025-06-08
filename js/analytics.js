/**
 * Offline Analytics Manager
 * Tracks user actions and app performance offline
 * Syncs analytics data when connection is restored
 */

class OfflineAnalytics {
    constructor() {
        this.events = [];
        this.sessions = [];
        this.currentSession = null;
        this.config = {
            maxEvents: 1000,
            maxSessions: 50,
            batchSize: 50,
            syncInterval: 5 * 60 * 1000, // 5 minutes
            trackingEnabled: true
        };
        this.init();
    }
    
    /**
     * Initialize analytics
     */
    init() {
        this.startSession();
        
        // Track page visibility
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.endSession();
            } else {
                this.startSession();
            }
        });
        
        // Track page unload
        window.addEventListener('beforeunload', () => {
            this.endSession();
            this.persist();
        });
        
        // Track errors
        window.addEventListener('error', (event) => {
            this.trackError(event.error, {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });
        
        // Track unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.trackError(event.reason, {
                type: 'unhandledRejection',
                promise: event.promise
            });
        });
        
        // Load persisted data
        this.loadPersisted();
        
        // Set up periodic sync
        setInterval(() => this.sync(), this.config.syncInterval);
    }
    
    /**
     * Start a new session
     */
    startSession() {
        if (!this.config.trackingEnabled) return;
        
        this.currentSession = {
            id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            startTime: Date.now(),
            events: [],
            device: this.getDeviceInfo(),
            referrer: document.referrer,
            url: window.location.href
        };
        
        this.sessions.push(this.currentSession);
        
        this.trackEvent('session_start', {
            sessionId: this.currentSession.id
        });
    }
    
    /**
     * End current session
     */
    endSession() {
        if (!this.currentSession) return;
        
        this.currentSession.endTime = Date.now();
        this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;
        
        this.trackEvent('session_end', {
            sessionId: this.currentSession.id,
            duration: this.currentSession.duration
        });
        
        this.currentSession = null;
    }
    
    /**
     * Track an event
     * @param {string} eventName - Event name
     * @param {Object} data - Event data
     */
    trackEvent(eventName, data = {}) {
        if (!this.config.trackingEnabled) return;
        
        const event = {
            id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: eventName,
            data,
            timestamp: Date.now(),
            sessionId: this.currentSession?.id,
            url: window.location.href
        };
        
        this.events.push(event);
        
        if (this.currentSession) {
            this.currentSession.events.push(event);
        }
        
        // Trim events if needed
        if (this.events.length > this.config.maxEvents) {
            this.events = this.events.slice(-this.config.maxEvents);
        }
        
        // Persist to storage
        this.persist();
    }
    
    /**
     * Track screen view
     * @param {string} screenName - Screen name
     * @param {Object} data - Additional data
     */
    trackScreen(screenName, data = {}) {
        this.trackEvent('screen_view', {
            screen: screenName,
            ...data
        });
    }
    
    /**
     * Track user action
     * @param {string} action - Action name
     * @param {string} category - Action category
     * @param {Object} data - Additional data
     */
    trackAction(action, category, data = {}) {
        this.trackEvent('user_action', {
            action,
            category,
            ...data
        });
    }
    
    /**
     * Track error
     * @param {Error} error - Error object
     * @param {Object} context - Error context
     */
    trackError(error, context = {}) {
        this.trackEvent('error', {
            message: error?.message || 'Unknown error',
            stack: error?.stack,
            ...context
        });
    }
    
    /**
     * Track performance metric
     * @param {string} metric - Metric name
     * @param {number} value - Metric value
     * @param {Object} data - Additional data
     */
    trackMetric(metric, value, data = {}) {
        this.trackEvent('performance_metric', {
            metric,
            value,
            ...data
        });
    }
    
    /**
     * Track timing
     * @param {string} category - Timing category
     * @param {string} variable - Timing variable
     * @param {number} time - Time in milliseconds
     * @param {Object} data - Additional data
     */
    trackTiming(category, variable, time, data = {}) {
        this.trackEvent('timing', {
            category,
            variable,
            time,
            ...data
        });
    }
    
    /**
     * Get device information
     */
    getDeviceInfo() {
        const ua = navigator.userAgent;
        const mobile = /iPhone|iPad|iPod|Android/i.test(ua);
        
        return {
            userAgent: ua,
            platform: navigator.platform,
            language: navigator.language,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio,
            mobile,
            online: navigator.onLine,
            cookieEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
    }
    
    /**
     * Persist analytics data to storage
     */
    persist() {
        try {
            const data = {
                events: this.events.slice(-this.config.maxEvents),
                sessions: this.sessions.slice(-this.config.maxSessions),
                lastPersisted: Date.now()
            };
            
            localStorage.setItem('ffh_analytics', JSON.stringify(data));
        } catch (error) {
            console.error('Failed to persist analytics:', error);
        }
    }
    
    /**
     * Load persisted analytics data
     */
    loadPersisted() {
        try {
            const stored = localStorage.getItem('ffh_analytics');
            if (stored) {
                const data = JSON.parse(stored);
                this.events = data.events || [];
                this.sessions = data.sessions || [];
            }
        } catch (error) {
            console.error('Failed to load persisted analytics:', error);
        }
    }
    
    /**
     * Sync analytics data
     */
    async sync() {
        if (!navigator.onLine || this.events.length === 0) return;
        
        console.log('Syncing analytics data...', {
            events: this.events.length,
            sessions: this.sessions.length
        });
        
        try {
            // In production, this would send data to analytics server
            // For now, we'll just simulate a successful sync
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Clear old events after successful sync
            const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
            this.events = this.events.filter(e => e.timestamp > cutoffTime);
            this.sessions = this.sessions.filter(s => s.startTime > cutoffTime);
            
            this.persist();
            
            console.log('Analytics sync completed');
        } catch (error) {
            console.error('Analytics sync failed:', error);
        }
    }
    
    /**
     * Get analytics summary
     */
    getSummary() {
        const now = Date.now();
        const dayAgo = now - (24 * 60 * 60 * 1000);
        const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
        
        const recentEvents = this.events.filter(e => e.timestamp > dayAgo);
        const weekEvents = this.events.filter(e => e.timestamp > weekAgo);
        
        const eventTypes = {};
        recentEvents.forEach(e => {
            eventTypes[e.name] = (eventTypes[e.name] || 0) + 1;
        });
        
        return {
            totalEvents: this.events.length,
            totalSessions: this.sessions.length,
            eventsToday: recentEvents.length,
            eventsThisWeek: weekEvents.length,
            eventTypes,
            currentSession: this.currentSession ? {
                duration: Date.now() - this.currentSession.startTime,
                events: this.currentSession.events.length
            } : null
        };
    }
    
    /**
     * Clear all analytics data
     */
    clear() {
        this.events = [];
        this.sessions = [];
        this.currentSession = null;
        localStorage.removeItem('ffh_analytics');
    }
    
    /**
     * Enable or disable tracking
     * @param {boolean} enabled - Whether tracking is enabled
     */
    setTrackingEnabled(enabled) {
        this.config.trackingEnabled = enabled;
        if (!enabled) {
            this.endSession();
        } else {
            this.startSession();
        }
    }
}

// Initialize analytics
window.Analytics = new OfflineAnalytics();

// Export for use in other modules
window.OfflineAnalytics = OfflineAnalytics;