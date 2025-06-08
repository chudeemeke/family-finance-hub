/**
 * Voice Command Manager
 * Implements voice control for hands-free operation
 * Uses Web Speech API for voice recognition and synthesis
 */

class VoiceCommandManager {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.isEnabled = false;
        this.commands = new Map();
        this.language = 'en-US';
        this.continuous = false;
        this.interimResults = false;
        this.maxAlternatives = 1;
        this.volume = 1.0;
        this.rate = 1.0;
        this.pitch = 1.0;
        this.voice = null;
        
        this.init();
    }
    
    /**
     * Initialize voice command system
     */
    init() {
        // Check for speech recognition support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.log('Speech recognition not supported');
            return;
        }
        
        // Create recognition instance
        this.recognition = new SpeechRecognition();
        this.configureRecognition();
        
        // Define default commands
        this.defineDefaultCommands();
        
        // Get available voices
        if (this.synthesis) {
            this.loadVoices();
            this.synthesis.addEventListener('voiceschanged', () => this.loadVoices());
        }
    }
    
    /**
     * Configure speech recognition
     */
    configureRecognition() {
        if (!this.recognition) return;
        
        this.recognition.continuous = this.continuous;
        this.recognition.interimResults = this.interimResults;
        this.recognition.maxAlternatives = this.maxAlternatives;
        this.recognition.lang = this.language;
        
        // Set up event handlers
        this.recognition.onstart = () => this.handleStart();
        this.recognition.onresult = (event) => this.handleResult(event);
        this.recognition.onerror = (event) => this.handleError(event);
        this.recognition.onend = () => this.handleEnd();
        this.recognition.onspeechstart = () => this.handleSpeechStart();
        this.recognition.onspeechend = () => this.handleSpeechEnd();
    }
    
    /**
     * Define default voice commands
     */
    defineDefaultCommands() {
        // Navigation commands
        this.addCommand(['go to dashboard', 'show dashboard', 'dashboard'], () => {
            this.navigateTo('dashboard');
        });
        
        this.addCommand(['go to transactions', 'show transactions', 'transactions'], () => {
            this.navigateTo('transactions');
        });
        
        this.addCommand(['go to budget', 'show budget', 'budget'], () => {
            this.navigateTo('budget');
        });
        
        this.addCommand(['go to savings', 'show savings', 'savings'], () => {
            this.navigateTo('savings');
        });
        
        this.addCommand(['go to settings', 'show settings', 'settings'], () => {
            this.navigateTo('settings');
        });
        
        // Transaction commands
        this.addCommand(['add expense', 'new expense', 'record expense'], () => {
            this.startAddTransaction('expense');
        });
        
        this.addCommand(['add income', 'new income', 'record income'], () => {
            this.startAddTransaction('income');
        });
        
        // Query commands
        this.addCommand(['what\'s my balance', 'what is my balance', 'show balance'], () => {
            this.speakBalance();
        });
        
        this.addCommand(['how much did i spend', 'what did i spend', 'spending'], () => {
            this.speakSpending();
        });
        
        this.addCommand(['what\'s my budget', 'what is my budget', 'budget status'], () => {
            this.speakBudgetStatus();
        });
        
        // Help commands
        this.addCommand(['help', 'what can you do', 'commands', 'list commands'], () => {
            this.speakHelp();
        });
        
        // Control commands
        this.addCommand(['stop listening', 'stop', 'cancel'], () => {
            this.stop();
        });
    }
    
    /**
     * Add a voice command
     * @param {string|Array} patterns - Command patterns
     * @param {Function} handler - Command handler
     */
    addCommand(patterns, handler) {
        const patternArray = Array.isArray(patterns) ? patterns : [patterns];
        
        patternArray.forEach(pattern => {
            this.commands.set(pattern.toLowerCase(), handler);
        });
    }
    
    /**
     * Start listening for voice commands
     */
    start() {
        if (!this.recognition || this.isListening) return;
        
        try {
            this.recognition.start();
            this.isListening = true;
            
            // Visual feedback
            this.showListeningIndicator();
            
            // Audio feedback
            this.playSound('start');
            
            // Haptic feedback on mobile
            if ('vibrate' in navigator) {
                navigator.vibrate(50);
            }
        } catch (error) {
            console.error('Failed to start voice recognition:', error);
            this.isListening = false;
        }
    }
    
    /**
     * Stop listening
     */
    stop() {
        if (!this.recognition || !this.isListening) return;
        
        try {
            this.recognition.stop();
            this.isListening = false;
            
            // Hide listening indicator
            this.hideListeningIndicator();
            
            // Audio feedback
            this.playSound('stop');
        } catch (error) {
            console.error('Failed to stop voice recognition:', error);
        }
    }
    
    /**
     * Toggle listening
     */
    toggle() {
        if (this.isListening) {
            this.stop();
        } else {
            this.start();
        }
    }
    
    /**
     * Handle recognition start
     */
    handleStart() {
        console.log('Voice recognition started');
        
        if (window.Analytics) {
            window.Analytics.trackEvent('voice_command_start');
        }
    }
    
    /**
     * Handle recognition result
     * @param {SpeechRecognitionEvent} event - Recognition event
     */
    handleResult(event) {
        const results = event.results;
        const lastResult = results[results.length - 1];
        
        if (lastResult.isFinal) {
            const transcript = lastResult[0].transcript.toLowerCase().trim();
            console.log('Voice command:', transcript);
            
            // Track analytics
            if (window.Analytics) {
                window.Analytics.trackEvent('voice_command', {
                    command: transcript,
                    confidence: lastResult[0].confidence
                });
            }
            
            // Process command
            this.processCommand(transcript);
        }
    }
    
    /**
     * Handle recognition error
     * @param {SpeechRecognitionErrorEvent} event - Error event
     */
    handleError(event) {
        console.error('Voice recognition error:', event.error);
        
        switch (event.error) {
            case 'no-speech':
                this.speak('I didn\'t hear anything. Please try again.');
                break;
                
            case 'not-allowed':
                this.speak('Microphone access is required for voice commands.');
                break;
                
            case 'network':
                this.speak('Network error. Please check your connection.');
                break;
                
            default:
                this.speak('Sorry, something went wrong. Please try again.');
        }
        
        this.isListening = false;
        this.hideListeningIndicator();
    }
    
    /**
     * Handle recognition end
     */
    handleEnd() {
        console.log('Voice recognition ended');
        this.isListening = false;
        this.hideListeningIndicator();
        
        // Restart if continuous mode
        if (this.continuous && this.isEnabled) {
            setTimeout(() => this.start(), 1000);
        }
    }
    
    /**
     * Handle speech start
     */
    handleSpeechStart() {
        console.log('Speech detected');
        this.updateListeningIndicator('active');
    }
    
    /**
     * Handle speech end
     */
    handleSpeechEnd() {
        console.log('Speech ended');
        this.updateListeningIndicator('processing');
    }
    
    /**
     * Process voice command
     * @param {string} transcript - Voice transcript
     */
    processCommand(transcript) {
        // Check for exact command match
        if (this.commands.has(transcript)) {
            const handler = this.commands.get(transcript);
            handler();
            return;
        }
        
        // Check for partial matches
        for (const [pattern, handler] of this.commands) {
            if (transcript.includes(pattern)) {
                handler();
                return;
            }
        }
        
        // Try natural language processing
        if (this.processNaturalLanguage(transcript)) {
            return;
        }
        
        // No match found
        this.speak('Sorry, I didn\'t understand that command. Say "help" for available commands.');
    }
    
    /**
     * Process natural language commands
     * @param {string} transcript - Voice transcript
     */
    processNaturalLanguage(transcript) {
        // Amount detection
        const amountMatch = transcript.match(/(\d+(?:\.\d+)?)\s*(?:dollars?|bucks?)?/);
        
        if (amountMatch) {
            const amount = parseFloat(amountMatch[1]);
            
            // Expense patterns
            if (/spent|bought|paid|expense/.test(transcript)) {
                this.addQuickExpense(amount, transcript);
                return true;
            }
            
            // Income patterns
            if (/earned|received|got|income/.test(transcript)) {
                this.addQuickIncome(amount, transcript);
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Text-to-speech
     * @param {string} text - Text to speak
     * @param {Object} options - Speech options
     */
    speak(text, options = {}) {
        if (!this.synthesis) return;
        
        // Cancel any ongoing speech
        this.synthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = options.volume || this.volume;
        utterance.rate = options.rate || this.rate;
        utterance.pitch = options.pitch || this.pitch;
        utterance.lang = options.lang || this.language;
        
        if (this.voice) {
            utterance.voice = this.voice;
        }
        
        // Add event handlers
        utterance.onstart = () => console.log('Speech started');
        utterance.onend = () => console.log('Speech ended');
        utterance.onerror = (event) => console.error('Speech error:', event);
        
        this.synthesis.speak(utterance);
    }
    
    /**
     * Load available voices
     */
    loadVoices() {
        const voices = this.synthesis.getVoices();
        
        // Prefer natural voices
        const preferredVoices = [
            'Samantha', // iOS
            'Google US English', // Chrome
            'Microsoft Zira', // Edge
            'Alex' // macOS
        ];
        
        for (const name of preferredVoices) {
            const voice = voices.find(v => v.name.includes(name));
            if (voice) {
                this.voice = voice;
                break;
            }
        }
        
        // Fallback to first English voice
        if (!this.voice) {
            this.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
        }
    }
    
    /**
     * Navigate to a specific tab
     * @param {string} tab - Tab name
     */
    navigateTo(tab) {
        if (window.appContext?.setActiveTab) {
            window.appContext.setActiveTab(tab);
            this.speak(`Navigating to ${tab}`);
        }
    }
    
    /**
     * Start add transaction flow
     * @param {string} type - Transaction type
     */
    startAddTransaction(type) {
        if (window.appContext?.setShowAddTransaction) {
            window.appContext.setShowAddTransaction(true);
            this.speak(`Adding new ${type}`);
        }
    }
    
    /**
     * Add quick expense
     * @param {number} amount - Expense amount
     * @param {string} transcript - Original transcript
     */
    addQuickExpense(amount, transcript) {
        // Extract category hints
        let category = 'other_expense';
        
        if (/food|lunch|dinner|coffee/.test(transcript)) {
            category = 'food';
        } else if (/gas|uber|lyft|taxi/.test(transcript)) {
            category = 'transport';
        } else if (/shopping|bought/.test(transcript)) {
            category = 'shopping';
        }
        
        if (window.appContext?.addTransaction) {
            window.appContext.addTransaction({
                type: 'expense',
                amount,
                description: `Voice: ${transcript}`,
                category,
                date: new Date().toISOString()
            });
            
            this.speak(`Added expense of ${amount} dollars`);
        }
    }
    
    /**
     * Add quick income
     * @param {number} amount - Income amount
     * @param {string} transcript - Original transcript
     */
    addQuickIncome(amount, transcript) {
        let category = 'other_income';
        
        if (/salary|paycheck/.test(transcript)) {
            category = 'salary';
        } else if (/freelance|client/.test(transcript)) {
            category = 'freelance';
        }
        
        if (window.appContext?.addTransaction) {
            window.appContext.addTransaction({
                type: 'income',
                amount,
                description: `Voice: ${transcript}`,
                category,
                date: new Date().toISOString()
            });
            
            this.speak(`Added income of ${amount} dollars`);
        }
    }
    
    /**
     * Speak current balance
     */
    async speakBalance() {
        if (!window.appContext?.statistics) return;
        
        const stats = window.appContext.statistics;
        const balance = stats.totalBalance || 0;
        
        this.speak(`Your total balance is ${this.formatCurrency(balance)}`);
    }
    
    /**
     * Speak spending information
     */
    async speakSpending() {
        if (!window.appContext?.statistics) return;
        
        const stats = window.appContext.statistics;
        const spending = stats.monthlyExpenses || 0;
        
        this.speak(`You've spent ${this.formatCurrency(spending)} this month`);
    }
    
    /**
     * Speak budget status
     */
    async speakBudgetStatus() {
        if (!window.appContext?.statistics || !window.appContext?.budget) return;
        
        const stats = window.appContext.statistics;
        const budget = window.appContext.budget;
        
        const totalBudget = Object.values(budget).reduce((sum, amount) => sum + (amount || 0), 0);
        const remaining = totalBudget - (stats.monthlyExpenses || 0);
        
        if (remaining >= 0) {
            this.speak(`You have ${this.formatCurrency(remaining)} left in your budget this month`);
        } else {
            this.speak(`You're over budget by ${this.formatCurrency(Math.abs(remaining))}`);
        }
    }
    
    /**
     * Speak help information
     */
    speakHelp() {
        const helpText = `
            Here are some commands you can use:
            Say "go to" followed by dashboard, transactions, budget, or savings to navigate.
            Say "add expense" or "add income" to add a new transaction.
            Say "what's my balance" to hear your current balance.
            Say "how much did I spend" to hear your monthly spending.
            Say numbers with "dollars spent" to quickly add expenses.
            Say "stop" to stop listening.
        `;
        
        this.speak(helpText);
    }
    
    /**
     * Format currency for speech
     * @param {number} amount - Amount to format
     */
    formatCurrency(amount) {
        const formatted = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
        
        // Make it more natural for speech
        return formatted
            .replace('$', '')
            .replace('.00', ' dollars')
            .replace('.', ' dollars and ')
            .replace(/(\d+)¢/, '$1 cents');
    }
    
    /**
     * Show listening indicator
     */
    showListeningIndicator() {
        // Create or update indicator
        let indicator = document.getElementById('voice-indicator');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'voice-indicator';
            indicator.className = 'voice-indicator';
            indicator.innerHTML = `
                <div class="voice-indicator-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                    </svg>
                </div>
                <div class="voice-indicator-text">Listening...</div>
            `;
            document.body.appendChild(indicator);
        }
        
        indicator.classList.add('active');
    }
    
    /**
     * Hide listening indicator
     */
    hideListeningIndicator() {
        const indicator = document.getElementById('voice-indicator');
        if (indicator) {
            indicator.classList.remove('active');
        }
    }
    
    /**
     * Update listening indicator
     * @param {string} state - Indicator state
     */
    updateListeningIndicator(state) {
        const indicator = document.getElementById('voice-indicator');
        if (indicator) {
            const text = indicator.querySelector('.voice-indicator-text');
            
            switch (state) {
                case 'active':
                    text.textContent = 'Listening...';
                    indicator.classList.add('pulse');
                    break;
                    
                case 'processing':
                    text.textContent = 'Processing...';
                    indicator.classList.remove('pulse');
                    break;
                    
                default:
                    text.textContent = 'Ready';
            }
        }
    }
    
    /**
     * Play sound effect
     * @param {string} type - Sound type
     */
    playSound(type) {
        // Use Web Audio API for simple beeps
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            switch (type) {
                case 'start':
                    oscillator.frequency.value = 800;
                    gainNode.gain.value = 0.1;
                    break;
                    
                case 'stop':
                    oscillator.frequency.value = 400;
                    gainNode.gain.value = 0.1;
                    break;
            }
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            console.error('Failed to play sound:', error);
        }
    }
}

// Initialize voice command manager
window.voiceCommands = new VoiceCommandManager();

// Export for use in other modules
window.VoiceCommandManager = VoiceCommandManager;