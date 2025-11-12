#!/usr/bin/env node

/**
 * API Key Rotation Manager
 * Handles multiple API keys per provider with automatic rotation
 * Works with render.com environment variables
 */

class APIKeyRotationManager {
  constructor() {
    this.rotationIndex = {};
    this.keyUsageCount = {};
    this.keyErrors = {};
    this.lastRotationTime = {};
    
    // Initialize API key pools from environment
    this.apiKeyPools = {
      ai21: this.parseKeyPool('AI21_API_KEY'),
      artificialanalysis: this.parseKeyPool('ARTIFICIALANALYSIS_API_KEY'),
      cohere: this.parseKeyPool('COHERE_API_KEY'),
      google: this.parseKeyPool('GEMINI_API_KEY'),
      groq: this.parseKeyPool('GROQ_API_KEY'),
      huggingface: this.parseKeyPool('HUGGINGFACE_API_KEY'),
      mistral: this.parseKeyPool('MISTRAL_API_KEY'),
      openrouter: this.parseKeyPool('OPENROUTER_API_KEY'),
      together: this.parseKeyPool('TOGETHER_API_KEY')
    };
    
    // Rotation configuration
    this.config = {
      maxUsagePerKey: parseInt(process.env.MAX_USAGE_PER_KEY) || 50,
      rotationIntervalMs: parseInt(process.env.ROTATION_INTERVAL_MS) || 300000, // 5 minutes
      maxErrorsPerKey: parseInt(process.env.MAX_ERRORS_PER_KEY) || 3,
      enableAutoRotation: process.env.ENABLE_AUTO_ROTATION !== 'false'
    };
    
    this.initializeRotationState();
    console.log('🔄 API Key Rotation Manager initialized');
    this.logKeyPoolStatus();
  }
  
  /**
   * Parse API key pool from environment variables
   * Supports multiple formats:
   * - Single key: AI21_API_KEY=key1
   * - Multiple keys: AI21_API_KEY=key1,key2,key3
   * - Numbered keys: AI21_API_KEY_1=key1, AI21_API_KEY_2=key2
   */
  parseKeyPool(baseEnvVar) {
    const keys = [];
    
    // Check for comma-separated keys in single variable
    const singleVar = process.env[baseEnvVar];
    if (singleVar) {
      keys.push(...singleVar.split(',').map(k => k.trim()).filter(k => k));
    }
    
    // Check for numbered environment variables
    let index = 1;
    while (process.env[`${baseEnvVar}_${index}`]) {
      keys.push(process.env[`${baseEnvVar}_${index}`]);
      index++;
    }
    
    return keys.filter(key => key && key.length > 0);
  }
  
  initializeRotationState() {
    Object.keys(this.apiKeyPools).forEach(provider => {
      this.rotationIndex[provider] = 0;
      this.keyUsageCount[provider] = {};
      this.keyErrors[provider] = {};
      this.lastRotationTime[provider] = Date.now();
      
      // Initialize usage counters for each key
      this.apiKeyPools[provider].forEach((key, index) => {
        this.keyUsageCount[provider][index] = 0;
        this.keyErrors[provider][index] = 0;
      });
    });
  }
  
  /**
   * Get current API key for a provider
   */
  getCurrentKey(provider) {
    const pool = this.apiKeyPools[provider];
    if (!pool || pool.length === 0) {
      return null;
    }
    
    const currentIndex = this.rotationIndex[provider];
    return pool[currentIndex];
  }
  
  /**
   * Get all available keys for a provider
   */
  getAllKeys(provider) {
    return this.apiKeyPools[provider] || [];
  }
  
  /**
   * Record successful API key usage
   */
  recordSuccess(provider) {
    const currentIndex = this.rotationIndex[provider];
    this.keyUsageCount[provider][currentIndex]++;
    
    // Check if we should rotate based on usage
    if (this.config.enableAutoRotation && 
        this.keyUsageCount[provider][currentIndex] >= this.config.maxUsagePerKey) {
      this.rotateKey(provider, 'usage_limit');
    }
  }
  
  /**
   * Record API key error
   */
  recordError(provider, errorType = 'generic') {
    const currentIndex = this.rotationIndex[provider];
    this.keyErrors[provider][currentIndex]++;
    
    console.log(`⚠️  API key error for ${provider}: ${errorType} (${this.keyErrors[provider][currentIndex]} errors)`);
    
    // Check if we should rotate based on errors
    if (this.config.enableAutoRotation &&
        this.keyErrors[provider][currentIndex] >= this.config.maxErrorsPerKey) {
      this.rotateKey(provider, 'error_limit');
    }
  }
  
  /**
   * Manually rotate to next available key
   */
  rotateKey(provider, reason = 'manual') {
    const pool = this.apiKeyPools[provider];
    if (!pool || pool.length <= 1) {
      console.log(`🔄 Cannot rotate ${provider} - only ${pool?.length || 0} key(s) available`);
      return false;
    }
    
    const oldIndex = this.rotationIndex[provider];
    const newIndex = (oldIndex + 1) % pool.length;
    
    this.rotationIndex[provider] = newIndex;
    this.lastRotationTime[provider] = Date.now();
    
    console.log(`🔄 Rotated ${provider} API key: ${oldIndex} → ${newIndex} (reason: ${reason})`);
    return true;
  }
  
  /**
   * Check if time-based rotation is needed
   */
  checkTimeBasedRotation() {
    if (!this.config.enableAutoRotation) return;
    
    const now = Date.now();
    
    Object.keys(this.apiKeyPools).forEach(provider => {
      if (this.apiKeyPools[provider].length > 1) {
        const timeSinceRotation = now - this.lastRotationTime[provider];
        
        if (timeSinceRotation >= this.config.rotationIntervalMs) {
          this.rotateKey(provider, 'time_interval');
        }
      }
    });
  }
  
  /**
   * Get rotation statistics
   */
  getRotationStats(provider = null) {
    if (provider) {
      return {
        provider,
        totalKeys: this.apiKeyPools[provider]?.length || 0,
        currentIndex: this.rotationIndex[provider],
        currentKey: this.getCurrentKey(provider)?.substring(0, 10) + '...',
        usageCount: this.keyUsageCount[provider],
        errorCount: this.keyErrors[provider],
        lastRotation: new Date(this.lastRotationTime[provider]).toISOString()
      };
    }
    
    const stats = {};
    Object.keys(this.apiKeyPools).forEach(p => {
      stats[p] = this.getRotationStats(p);
    });
    return stats;
  }
  
  /**
   * Reset error count for a provider (useful after successful requests)
   */
  resetErrors(provider) {
    const currentIndex = this.rotationIndex[provider];
    this.keyErrors[provider][currentIndex] = 0;
    console.log(`✅ Reset error count for ${provider} key ${currentIndex}`);
  }
  
  /**
   * Get next available key without rotating
   */
  peekNextKey(provider) {
    const pool = this.apiKeyPools[provider];
    if (!pool || pool.length <= 1) return null;
    
    const nextIndex = (this.rotationIndex[provider] + 1) % pool.length;
    return pool[nextIndex];
  }
  
  /**
   * Force rotation to specific key index
   */
  rotateToIndex(provider, targetIndex) {
    const pool = this.apiKeyPools[provider];
    if (!pool || targetIndex >= pool.length || targetIndex < 0) {
      console.log(`❌ Invalid rotation index ${targetIndex} for ${provider}`);
      return false;
    }
    
    const oldIndex = this.rotationIndex[provider];
    this.rotationIndex[provider] = targetIndex;
    this.lastRotationTime[provider] = Date.now();
    
    console.log(`🎯 Force rotated ${provider} API key: ${oldIndex} → ${targetIndex}`);
    return true;
  }
  
  /**
   * Log current key pool status
   */
  logKeyPoolStatus() {
    console.log('\n🔑 API Key Pool Status:');
    Object.entries(this.apiKeyPools).forEach(([provider, keys]) => {
      const status = keys.length > 0 ? '✅' : '❌';
      const current = this.rotationIndex[provider];
      console.log(`  ${status} ${provider.toUpperCase()}: ${keys.length} key(s) [active: ${current}]`);
    });
    console.log('');
  }
  
  /**
   * Export current rotation state (for persistence)
   */
  exportState() {
    return {
      rotationIndex: { ...this.rotationIndex },
      keyUsageCount: JSON.parse(JSON.stringify(this.keyUsageCount)),
      keyErrors: JSON.parse(JSON.stringify(this.keyErrors)),
      lastRotationTime: { ...this.lastRotationTime },
      timestamp: Date.now()
    };
  }
  
  /**
   * Import rotation state (for persistence)
   */
  importState(state) {
    if (state && typeof state === 'object') {
      this.rotationIndex = { ...this.rotationIndex, ...state.rotationIndex };
      this.keyUsageCount = { ...this.keyUsageCount, ...state.keyUsageCount };
      this.keyErrors = { ...this.keyErrors, ...state.keyErrors };
      this.lastRotationTime = { ...this.lastRotationTime, ...state.lastRotationTime };
      
      console.log('📥 Imported rotation state from persistent storage');
    }
  }
}

export default APIKeyRotationManager;