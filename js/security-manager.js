/**
 * Security Manager Module
 * Handles encryption, decryption, and security operations
 * Implements AES encryption for sensitive data
 */

class SecurityManager {
    /**
     * Generate a secure key from password and salt
     * @param {string} password - User password
     * @param {string} salt - Salt value
     * @returns {string} Generated key
     */
    static generateKey(password, salt) {
        return CryptoJS.PBKDF2(password, salt, {
            keySize: 256 / 32,
            iterations: 1000
        }).toString();
    }
    
    /**
     * Encrypt data using AES
     * @param {*} data - Data to encrypt
     * @param {string} key - Encryption key
     * @returns {string} Encrypted data
     */
    static encrypt(data, key) {
        return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
    }
    
    /**
     * Decrypt data using AES
     * @param {string} encryptedData - Encrypted data
     * @param {string} key - Decryption key
     * @returns {*} Decrypted data
     */
    static decrypt(encryptedData, key) {
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedData, key);
            return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        } catch (error) {
            console.error('Decryption failed:', error);
            return null;
        }
    }
    
    /**
     * Hash PIN using SHA256
     * @param {string} pin - PIN to hash
     * @returns {string} Hashed PIN
     */
    static hashPin(pin) {
        return CryptoJS.SHA256(pin).toString();
    }
    
    /**
     * Generate family encryption key
     * @param {string} familyCode - Family code
     * @param {string} pin - Family PIN
     * @returns {string} Family encryption key
     */
    static generateFamilyKey(familyCode, pin) {
        return this.generateKey(pin, familyCode);
    }
    
    /**
     * Generate UUID v4
     * @returns {string} UUID
     */
    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    /**
     * Generate secure random string
     * @param {number} length - Length of string
     * @returns {string} Random string
     */
    static generateRandomString(length = 16) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        const values = new Uint32Array(length);
        crypto.getRandomValues(values);
        
        for (let i = 0; i < length; i++) {
            result += charset[values[i] % charset.length];
        }
        
        return result;
    }
    
    /**
     * Validate PIN strength
     * @param {string} pin - PIN to validate
     * @returns {Object} Validation result
     */
    static validatePin(pin) {
        const minLength = 4;
        const maxLength = 8;
        
        if (!pin || pin.length < minLength) {
            return {
                valid: false,
                message: `PIN must be at least ${minLength} digits`
            };
        }
        
        if (pin.length > maxLength) {
            return {
                valid: false,
                message: `PIN must be no more than ${maxLength} digits`
            };
        }
        
        if (!/^\d+$/.test(pin)) {
            return {
                valid: false,
                message: 'PIN must contain only numbers'
            };
        }
        
        // Check for sequential numbers
        const sequential = '0123456789';
        const reverseSequential = '9876543210';
        if (sequential.includes(pin) || reverseSequential.includes(pin)) {
            return {
                valid: false,
                message: 'PIN cannot be sequential numbers'
            };
        }
        
        // Check for repeated digits
        if (/^(\d)\1+$/.test(pin)) {
            return {
                valid: false,
                message: 'PIN cannot be all the same digit'
            };
        }
        
        return {
            valid: true,
            message: 'PIN is valid'
        };
    }
    
    /**
     * Sanitize input to prevent XSS
     * @param {string} input - Input to sanitize
     * @returns {string} Sanitized input
     */
    static sanitizeInput(input) {
        if (!input) return '';
        
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }
    
    /**
     * Create secure hash of sensitive data
     * @param {string} data - Data to hash
     * @returns {string} Hashed data
     */
    static createHash(data) {
        return CryptoJS.SHA256(data).toString();
    }
    
    /**
     * Compare hash with data
     * @param {string} data - Original data
     * @param {string} hash - Hash to compare
     * @returns {boolean} Match result
     */
    static verifyHash(data, hash) {
        return this.createHash(data) === hash;
    }
    
    /**
     * Encrypt for storage
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @param {string} encryptionKey - Encryption key
     * @returns {string} Encrypted value
     */
    static encryptForStorage(key, value, encryptionKey) {
        const data = {
            key,
            value,
            timestamp: Date.now()
        };
        
        return this.encrypt(data, encryptionKey);
    }
    
    /**
     * Decrypt from storage
     * @param {string} encryptedData - Encrypted data
     * @param {string} encryptionKey - Decryption key
     * @returns {*} Decrypted value
     */
    static decryptFromStorage(encryptedData, encryptionKey) {
        const data = this.decrypt(encryptedData, encryptionKey);
        if (!data) return null;
        
        return data.value;
    }
}

// Export for use in other modules
window.SecurityManager = SecurityManager;