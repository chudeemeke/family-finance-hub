/**
 * Biometric Authentication Manager
 * Handles Face ID/Touch ID for iPhone and Web Authentication API
 * Provides secure authentication using device biometrics
 */

class BiometricAuthManager {
    constructor() {
        this.isSupported = false;
        this.isEnrolled = false;
        this.credentials = null;
        this.rpName = 'Family Finance Hub';
        this.rpId = window.location.hostname;
        this.timeout = 60000; // 60 seconds
        
        this.checkSupport();
    }
    
    /**
     * Check if biometric authentication is supported
     */
    checkSupport() {
        // Check for Web Authentication API support
        if (window.PublicKeyCredential) {
            this.isSupported = true;
            this.authenticationType = 'webauthn';
            console.log('WebAuthn is supported');
            
            // Check if platform authenticator is available
            if (window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
                window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
                    .then(available => {
                        if (available) {
                            console.log('Platform authenticator is available');
                        }
                    });
            }
        }
        
        // Check for iOS specific APIs
        else if (this.isiOS() && window.webkit?.messageHandlers?.biometric) {
            this.isSupported = true;
            this.authenticationType = 'ios-webkit';
            console.log('iOS biometric authentication is supported');
        }
        
        // Check for Android biometric API
        else if (this.isAndroid() && window.BiometricAuth) {
            this.isSupported = true;
            this.authenticationType = 'android-native';
            console.log('Android biometric authentication is supported');
        }
        
        return this.isSupported;
    }
    
    /**
     * Check if running on iOS
     */
    isiOS() {
        return /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
    }
    
    /**
     * Check if running on Android
     */
    isAndroid() {
        return /Android/.test(navigator.userAgent);
    }
    
    /**
     * Check if biometric authentication is available
     */
    async isAvailable() {
        if (!this.isSupported) return false;
        
        try {
            switch (this.authenticationType) {
                case 'webauthn':
                    if (window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
                        return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
                    }
                    return true;
                    
                case 'ios-webkit':
                    return new Promise((resolve) => {
                        window.webkit.messageHandlers.biometric.postMessage({
                            action: 'isAvailable'
                        });
                        
                        window.handleBiometricResponse = (response) => {
                            resolve(response.available);
                        };
                    });
                    
                case 'android-native':
                    return window.BiometricAuth.isAvailable();
                    
                default:
                    return false;
            }
        } catch (error) {
            console.error('Failed to check biometric availability:', error);
            return false;
        }
    }
    
    /**
     * Enroll biometric authentication
     * @param {Object} user - User object
     */
    async enroll(user) {
        if (!this.isSupported) {
            throw new Error('Biometric authentication not supported on this device');
        }
        
        if (!user || !user.id || !user.name) {
            throw new Error('Invalid user object');
        }
        
        try {
            let credential;
            
            switch (this.authenticationType) {
                case 'webauthn':
                    credential = await this.enrollWebAuthn(user);
                    break;
                    
                case 'ios-webkit':
                    credential = await this.enrolliOS(user);
                    break;
                    
                case 'android-native':
                    credential = await this.enrollAndroid(user);
                    break;
                    
                default:
                    throw new Error('Unknown authentication type');
            }
            
            if (credential) {
                this.credentials = credential;
                this.isEnrolled = true;
                
                // Store credential info
                await this.saveCredentials(user.id, credential);
                
                // Track analytics
                if (window.Analytics) {
                    window.Analytics.trackEvent('biometric_enrolled', {
                        type: this.authenticationType
                    });
                }
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Biometric enrollment failed:', error);
            
            // Track error
            if (window.Analytics) {
                window.Analytics.trackError(error, {
                    action: 'biometric_enroll',
                    type: this.authenticationType
                });
            }
            
            throw error;
        }
    }
    
    /**
     * Enroll using WebAuthn
     * @param {Object} user - User object
     */
    async enrollWebAuthn(user) {
        // Generate challenge
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        
        // Create credential options
        const publicKeyCredentialCreationOptions = {
            challenge: challenge,
            rp: {
                name: this.rpName,
                id: this.rpId
            },
            user: {
                id: new TextEncoder().encode(user.id),
                name: user.name,
                displayName: user.displayName || user.name
            },
            pubKeyCredParams: [
                { alg: -7, type: 'public-key' },   // ES256
                { alg: -257, type: 'public-key' }  // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
                requireResidentKey: false
            },
            timeout: this.timeout,
            attestation: 'none'
        };
        
        // Create credential
        const credential = await navigator.credentials.create({
            publicKey: publicKeyCredentialCreationOptions
        });
        
        if (!credential) {
            throw new Error('Failed to create credential');
        }
        
        // Return credential info
        return {
            id: credential.id,
            rawId: this.arrayBufferToBase64(credential.rawId),
            type: credential.type,
            response: {
                clientDataJSON: this.arrayBufferToBase64(credential.response.clientDataJSON),
                attestationObject: this.arrayBufferToBase64(credential.response.attestationObject)
            }
        };
    }
    
    /**
     * Enroll using iOS WebKit
     * @param {Object} user - User object
     */
    async enrolliOS(user) {
        return new Promise((resolve, reject) => {
            window.webkit.messageHandlers.biometric.postMessage({
                action: 'enroll',
                userId: user.id,
                userName: user.name
            });
            
            window.handleBiometricResponse = (response) => {
                if (response.success) {
                    resolve(response.credential);
                } else {
                    reject(new Error(response.error || 'Enrollment failed'));
                }
            };
            
            // Timeout
            setTimeout(() => {
                reject(new Error('Enrollment timeout'));
            }, this.timeout);
        });
    }
    
    /**
     * Enroll using Android native
     * @param {Object} user - User object
     */
    async enrollAndroid(user) {
        const result = await window.BiometricAuth.enroll({
            userId: user.id,
            userName: user.name,
            title: 'Enable Biometric Login',
            subtitle: 'Use your fingerprint or face to login',
            description: 'Your biometric data is stored securely on your device',
            negativeButtonText: 'Cancel'
        });
        
        if (result.success) {
            return result.credential;
        } else {
            throw new Error(result.error || 'Enrollment failed');
        }
    }
    
    /**
     * Authenticate using biometrics
     * @param {string} userId - User ID
     */
    async authenticate(userId) {
        if (!this.isSupported) {
            throw new Error('Biometric authentication not supported');
        }
        
        if (!userId) {
            throw new Error('User ID is required');
        }
        
        try {
            let result;
            
            switch (this.authenticationType) {
                case 'webauthn':
                    result = await this.authenticateWebAuthn(userId);
                    break;
                    
                case 'ios-webkit':
                    result = await this.authenticateiOS(userId);
                    break;
                    
                case 'android-native':
                    result = await this.authenticateAndroid(userId);
                    break;
                    
                default:
                    throw new Error('Unknown authentication type');
            }
            
            if (result) {
                // Track analytics
                if (window.Analytics) {
                    window.Analytics.trackEvent('biometric_auth_success', {
                        type: this.authenticationType
                    });
                }
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Biometric authentication failed:', error);
            
            // Track error
            if (window.Analytics) {
                window.Analytics.trackError(error, {
                    action: 'biometric_auth',
                    type: this.authenticationType
                });
            }
            
            return false;
        }
    }
    
    /**
     * Authenticate using WebAuthn
     * @param {string} userId - User ID
     */
    async authenticateWebAuthn(userId) {
        // Get stored credentials
        const storedCredentials = await this.getCredentials(userId);
        if (!storedCredentials) {
            throw new Error('No credentials found for user');
        }
        
        // Generate challenge
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        
        // Create assertion options
        const publicKeyCredentialRequestOptions = {
            challenge: challenge,
            allowCredentials: [{
                id: this.base64ToArrayBuffer(storedCredentials.rawId),
                type: 'public-key',
                transports: ['internal']
            }],
            timeout: this.timeout,
            userVerification: 'required'
        };
        
        // Get assertion
        const assertion = await navigator.credentials.get({
            publicKey: publicKeyCredentialRequestOptions
        });
        
        if (!assertion) {
            throw new Error('Authentication failed');
        }
        
        // In a real app, you would verify this assertion on the server
        // For now, we'll just check that we got a valid response
        return assertion !== null;
    }
    
    /**
     * Authenticate using iOS WebKit
     * @param {string} userId - User ID
     */
    async authenticateiOS(userId) {
        return new Promise((resolve, reject) => {
            window.webkit.messageHandlers.biometric.postMessage({
                action: 'authenticate',
                userId: userId
            });
            
            window.handleBiometricResponse = (response) => {
                resolve(response.success);
            };
            
            // Timeout
            setTimeout(() => {
                reject(new Error('Authentication timeout'));
            }, this.timeout);
        });
    }
    
    /**
     * Authenticate using Android native
     * @param {string} userId - User ID
     */
    async authenticateAndroid(userId) {
        const result = await window.BiometricAuth.authenticate({
            userId: userId,
            title: 'Biometric Login',
            subtitle: 'Verify your identity',
            description: 'Place your finger on the sensor or look at the camera',
            negativeButtonText: 'Use PIN'
        });
        
        return result.success;
    }
    
    /**
     * Check if user has enrolled biometrics
     * @param {string} userId - User ID
     */
    async isEnrolled(userId) {
        const credentials = await this.getCredentials(userId);
        return credentials !== null;
    }
    
    /**
     * Save credentials securely
     * @param {string} userId - User ID
     * @param {Object} credentials - Credential data
     */
    async saveCredentials(userId, credentials) {
        const key = `ffh_biometric_${userId}`;
        
        // Encrypt credentials before storing
        const encrypted = window.SecurityManager.encrypt(credentials, userId);
        
        try {
            localStorage.setItem(key, encrypted);
        } catch (error) {
            console.error('Failed to save credentials:', error);
            
            // Try IndexedDB as fallback
            if (window.dbManager) {
                await window.dbManager.save('settings', {
                    id: key,
                    type: 'biometric_credential',
                    userId: userId,
                    data: encrypted
                });
            }
        }
    }
    
    /**
     * Get stored credentials
     * @param {string} userId - User ID
     */
    async getCredentials(userId) {
        const key = `ffh_biometric_${userId}`;
        
        try {
            // Try localStorage first
            const encrypted = localStorage.getItem(key);
            if (encrypted) {
                return window.SecurityManager.decrypt(encrypted, userId);
            }
            
            // Try IndexedDB
            if (window.dbManager) {
                const stored = await window.dbManager.get('settings', key);
                if (stored && stored.data) {
                    return window.SecurityManager.decrypt(stored.data, userId);
                }
            }
            
            return null;
        } catch (error) {
            console.error('Failed to get credentials:', error);
            return null;
        }
    }
    
    /**
     * Remove biometric enrollment
     * @param {string} userId - User ID
     */
    async unenroll(userId) {
        const key = `ffh_biometric_${userId}`;
        
        // Remove from localStorage
        localStorage.removeItem(key);
        
        // Remove from IndexedDB
        if (window.dbManager) {
            await window.dbManager.delete('settings', key);
        }
        
        this.isEnrolled = false;
        this.credentials = null;
        
        // Track analytics
        if (window.Analytics) {
            window.Analytics.trackEvent('biometric_unenrolled', {
                type: this.authenticationType
            });
        }
    }
    
    /**
     * Convert ArrayBuffer to Base64
     * @param {ArrayBuffer} buffer - Array buffer
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    
    /**
     * Convert Base64 to ArrayBuffer
     * @param {string} base64 - Base64 string
     */
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
    
    /**
     * Show biometric prompt
     * @param {Object} options - Prompt options
     */
    async showPrompt(options = {}) {
        const defaultOptions = {
            reason: 'Authenticate to access Family Finance Hub',
            fallbackLabel: 'Use PIN',
            cancelLabel: 'Cancel'
        };
        
        const promptOptions = { ...defaultOptions, ...options };
        
        // Create visual prompt
        const prompt = document.createElement('div');
        prompt.className = 'biometric-modal';
        prompt.innerHTML = `
            <div class="biometric-content">
                <div class="biometric-icon">
                    ${this.isiOS() ? '👤' : '👆'}
                </div>
                <h3>${this.isiOS() ? 'Face ID' : 'Touch ID'}</h3>
                <p>${promptOptions.reason}</p>
                <div class="biometric-actions">
                    <button class="biometric-cancel">${promptOptions.cancelLabel}</button>
                    <button class="biometric-fallback">${promptOptions.fallbackLabel}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(prompt);
        
        // Handle actions
        return new Promise((resolve) => {
            prompt.querySelector('.biometric-cancel').addEventListener('click', () => {
                document.body.removeChild(prompt);
                resolve({ success: false, reason: 'cancelled' });
            });
            
            prompt.querySelector('.biometric-fallback').addEventListener('click', () => {
                document.body.removeChild(prompt);
                resolve({ success: false, reason: 'fallback' });
            });
            
            // Auto-remove after authentication attempt
            setTimeout(() => {
                if (document.body.contains(prompt)) {
                    document.body.removeChild(prompt);
                }
            }, 5000);
        });
    }
}

// Initialize biometric manager
window.biometricAuth = new BiometricAuthManager();

// Export for use in other modules
window.BiometricAuthManager = BiometricAuthManager;