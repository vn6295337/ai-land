// Secure Key Manager for Render.com
// Add this to the top of your server.js

const crypto = require('crypto');

class SecureKeyManager {
    constructor() {
        this.keys = new Map();
        this.initializeKeys();
    }
    
    initializeKeys() {
        const providers = ['google', 'mistral', 'llama', 'cohere', 'groq', 'huggingface', 'openrouter', 'ai21', 'replicate', 'qdrant'];
        
        providers.forEach(provider => {
            const envKey = `${provider.toUpperCase()}_API_KEY`;
            const key = process.env[envKey];
            
            if (key) {
                // Store with hash for logging
                const keyHash = crypto.createHash('sha256').update(key).digest('hex').substring(0, 8);
                this.keys.set(provider, {
                    key: key,
                    hash: keyHash,
                    lastUsed: null,
                    useCount: 0
                });
                
                // Clear from process.env
                delete process.env[envKey];
                console.log(`🔑 Loaded ${provider} key (${keyHash}...)`);
            }
        });
        
        // Also secure other sensitive vars
        if (process.env.GITHUB_TOKEN) {
            const hash = crypto.createHash('sha256').update(process.env.GITHUB_TOKEN).digest('hex').substring(0, 8);
            this.keys.set('github', {
                key: process.env.GITHUB_TOKEN,
                hash: hash,
                lastUsed: null,
                useCount: 0
            });
            delete process.env.GITHUB_TOKEN;
            console.log(`🔑 Loaded GitHub token (${hash}...)`);
        }
    }
    
    getKey(provider) {
        const keyData = this.keys.get(provider);
        if (!keyData) {
            throw new Error(`API key not found for provider: ${provider}`);
        }
        
        keyData.lastUsed = new Date();
        keyData.useCount++;
        return keyData.key;
    }
    
    getStats() {
        const stats = {};
        this.keys.forEach((data, provider) => {
            stats[provider] = {
                hash: data.hash,
                lastUsed: data.lastUsed,
                useCount: data.useCount
            };
        });
        return stats;
    }
}

// Initialize and export
const keyManager = new SecureKeyManager();

module.exports = { keyManager };

// Replace your API_KEYS object with:
// const API_KEYS = {
//     google: keyManager.getKey('google'),
//     mistral: keyManager.getKey('mistral'),
//     // etc...
// };