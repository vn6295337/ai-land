#!/usr/bin/env node

/**
 * API Key Rotation Monitor
 * Provides monitoring, logging, and statistics for API key rotation
 */

import fs from 'fs/promises';
import path from 'path';

class RotationMonitor {
  constructor(keyManager) {
    this.keyManager = keyManager;
    this.statsHistory = [];
    this.alertsLog = [];
    this.rotationEvents = [];
    this.monitoringConfig = {
      logInterval: 300000, // 5 minutes
      statsRetention: 86400000, // 24 hours
      alertThreshold: 0.8 // Alert when 80% of keys have errors
    };
    
    this.startMonitoring();
  }
  
  startMonitoring() {
    console.log('📊 Starting API key rotation monitoring...');
    
    // Periodic statistics collection
    setInterval(() => {
      this.collectStats();
    }, this.monitoringConfig.logInterval);
    
    // Check for alerts
    setInterval(() => {
      this.checkAlerts();
    }, this.monitoringConfig.logInterval);
    
    // Cleanup old data
    setInterval(() => {
      this.cleanupOldData();
    }, this.monitoringConfig.logInterval * 4);
  }
  
  collectStats() {
    const timestamp = Date.now();
    const stats = {
      timestamp,
      providers: {}
    };
    
    // Collect stats for each provider
    Object.keys(this.keyManager.apiKeyPools).forEach(provider => {
      const providerStats = this.keyManager.getRotationStats(provider);
      const pool = this.keyManager.apiKeyPools[provider];
      
      stats.providers[provider] = {
        ...providerStats,
        keyPoolSize: pool.length,
        healthyKeys: this.countHealthyKeys(provider),
        averageUsage: this.calculateAverageUsage(provider),
        rotationRate: this.calculateRotationRate(provider)
      };
    });
    
    this.statsHistory.push(stats);
    console.log(`📊 Collected rotation stats at ${new Date(timestamp).toISOString()}`);
  }
  
  countHealthyKeys(provider) {
    const errors = this.keyManager.keyErrors[provider] || {};
    const maxErrors = this.keyManager.config.maxErrorsPerKey;
    
    return Object.values(errors).filter(errorCount => errorCount < maxErrors).length;
  }
  
  calculateAverageUsage(provider) {
    const usage = this.keyManager.keyUsageCount[provider] || {};
    const values = Object.values(usage);
    
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }
  
  calculateRotationRate(provider) {
    const recentEvents = this.rotationEvents
      .filter(event => 
        event.provider === provider && 
        event.timestamp > Date.now() - 3600000 // Last hour
      );
    
    return recentEvents.length;
  }
  
  checkAlerts() {
    Object.keys(this.keyManager.apiKeyPools).forEach(provider => {
      const pool = this.keyManager.apiKeyPools[provider];
      const healthyKeys = this.countHealthyKeys(provider);
      
      if (pool.length > 0) {
        const healthRatio = healthyKeys / pool.length;
        
        if (healthRatio < this.monitoringConfig.alertThreshold) {
          this.createAlert(provider, 'key_health_low', {
            healthyKeys,
            totalKeys: pool.length,
            healthRatio: Math.round(healthRatio * 100)
          });
        }
      }
      
      // Check for stuck rotation
      const lastRotation = this.keyManager.lastRotationTime[provider];
      const timeSinceRotation = Date.now() - lastRotation;
      const rotationInterval = this.keyManager.config.rotationIntervalMs;
      
      if (pool.length > 1 && timeSinceRotation > rotationInterval * 3) {
        this.createAlert(provider, 'rotation_stuck', {
          timeSinceRotation: Math.round(timeSinceRotation / 60000),
          expectedInterval: Math.round(rotationInterval / 60000)
        });
      }
    });
  }
  
  createAlert(provider, alertType, details) {
    const alert = {
      timestamp: Date.now(),
      provider,
      type: alertType,
      details,
      id: `${provider}_${alertType}_${Date.now()}`
    };
    
    this.alertsLog.push(alert);
    
    console.log(`🚨 ALERT: ${alertType} for ${provider}:`, details);
    
    // Auto-remediation for certain alerts
    if (alertType === 'rotation_stuck' && this.keyManager.apiKeyPools[provider].length > 1) {
      console.log(`🔧 Auto-remediation: Force rotating ${provider} key`);
      this.keyManager.rotateKey(provider, 'auto_remediation');
    }
  }
  
  logRotationEvent(provider, oldIndex, newIndex, reason) {
    const event = {
      timestamp: Date.now(),
      provider,
      oldIndex,
      newIndex,
      reason
    };
    
    this.rotationEvents.push(event);
    console.log(`🔄 Rotation logged: ${provider} ${oldIndex}→${newIndex} (${reason})`);
  }
  
  cleanupOldData() {
    const cutoff = Date.now() - this.monitoringConfig.statsRetention;
    
    // Clean up old stats
    this.statsHistory = this.statsHistory.filter(stat => stat.timestamp > cutoff);
    
    // Clean up old alerts
    this.alertsLog = this.alertsLog.filter(alert => alert.timestamp > cutoff);
    
    // Clean up old rotation events
    this.rotationEvents = this.rotationEvents.filter(event => event.timestamp > cutoff);
    
    console.log('🧹 Cleaned up old monitoring data');
  }
  
  getProviderHealth(provider) {
    const pool = this.keyManager.apiKeyPools[provider];
    if (!pool || pool.length === 0) {
      return { status: 'no_keys', health: 0 };
    }
    
    const healthyKeys = this.countHealthyKeys(provider);
    const health = healthyKeys / pool.length;
    
    let status = 'healthy';
    if (health < 0.3) status = 'critical';
    else if (health < 0.6) status = 'warning';
    
    return {
      status,
      health: Math.round(health * 100),
      healthyKeys,
      totalKeys: pool.length
    };
  }
  
  getSystemSummary() {
    const summary = {
      timestamp: Date.now(),
      providers: {},
      system: {
        totalAlerts: this.alertsLog.length,
        recentRotations: this.rotationEvents.filter(e => e.timestamp > Date.now() - 3600000).length,
        monitoringUptime: Date.now() - (this.statsHistory[0]?.timestamp || Date.now())
      }
    };
    
    Object.keys(this.keyManager.apiKeyPools).forEach(provider => {
      summary.providers[provider] = this.getProviderHealth(provider);
    });
    
    return summary;
  }
  
  async exportStats(outputPath = './generated_outputs/rotation_stats.json') {
    const exportData = {
      summary: this.getSystemSummary(),
      statsHistory: this.statsHistory.slice(-100), // Last 100 entries
      alertsLog: this.alertsLog.slice(-50), // Last 50 alerts
      rotationEvents: this.rotationEvents.slice(-100), // Last 100 rotations
      exportedAt: new Date().toISOString()
    };
    
    try {
      await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2));
      console.log(`📊 Rotation stats exported to ${outputPath}`);
    } catch (error) {
      console.error('❌ Failed to export rotation stats:', error.message);
    }
  }
  
  printHealthDashboard() {
    console.log('\n🎯 API Key Rotation Health Dashboard');
    console.log('=====================================');
    
    Object.keys(this.keyManager.apiKeyPools).forEach(provider => {
      const health = this.getProviderHealth(provider);
      const current = this.keyManager.rotationIndex[provider];
      const usage = this.calculateAverageUsage(provider);
      
      const statusIcon = {
        'no_keys': '❌',
        'critical': '🔴',
        'warning': '🟡',
        'healthy': '✅'
      }[health.status];
      
      console.log(`${statusIcon} ${provider.toUpperCase()}:`);
      console.log(`   Health: ${health.health}% (${health.healthyKeys}/${health.totalKeys} keys)`);
      console.log(`   Current: Key ${current}, Avg Usage: ${Math.round(usage)}`);
    });
    
    const recentAlerts = this.alertsLog.filter(a => a.timestamp > Date.now() - 3600000);
    console.log(`\n🚨 Recent Alerts: ${recentAlerts.length}`);
    console.log('=====================================\n');
  }
}

export default RotationMonitor;