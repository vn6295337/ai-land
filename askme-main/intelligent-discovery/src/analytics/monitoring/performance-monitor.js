import { createLogger } from '../../core/infrastructure/logger.js';
import { qdrantManager } from '../../core/storage/qdrant.js';
import { cacheManager } from '../../core/storage/cache.js';
import { embeddingsManager } from '../../core/storage/embeddings.js';

class RealTimePerformanceMonitor {
  constructor() {
    this.logger = createLogger({ component: 'performance-monitor' });
    this.isInitialized = false;
    this.performanceMetrics = new Map();
    this.activeMonitors = new Map();
    this.alertQueue = [];
    
    // Monitoring configuration
    this.monitoringConfig = {
      samplingInterval: 5000,        // 5 seconds
      aggregationWindow: 60000,      // 1 minute
      retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
      alertThresholds: {
        response_time: { warning: 1000, critical: 3000 }, // ms
        error_rate: { warning: 0.05, critical: 0.1 },     // percentage
        memory_usage: { warning: 0.8, critical: 0.9 },    // percentage
        cpu_usage: { warning: 0.7, critical: 0.85 },      // percentage
        throughput: { warning: -0.3, critical: -0.5 },    // change percentage
        cache_hit_rate: { warning: 0.7, critical: 0.5 }   // minimum acceptable
      },
      batchSize: 100,
      maxConcurrentMonitors: 50
    };
    
    // Performance metrics categories
    this.metricsCategories = {
      'system': {
        description: 'System-level performance metrics',
        metrics: ['cpu_usage', 'memory_usage', 'disk_io', 'network_io', 'process_count'],
        collector: this.collectSystemMetrics.bind(this)
      },
      'application': {
        description: 'Application performance metrics',
        metrics: ['response_time', 'throughput', 'error_rate', 'active_connections', 'queue_depth'],
        collector: this.collectApplicationMetrics.bind(this)
      },
      'database': {
        description: 'Database performance metrics',
        metrics: ['query_time', 'connection_pool', 'cache_hit_rate', 'index_efficiency', 'storage_usage'],
        collector: this.collectDatabaseMetrics.bind(this)
      },
      'search': {
        description: 'Search engine performance metrics',
        metrics: ['search_latency', 'indexing_rate', 'query_complexity', 'result_quality', 'personalization_impact'],
        collector: this.collectSearchMetrics.bind(this)
      },
      'ml': {
        description: 'Machine learning performance metrics',
        metrics: ['model_inference_time', 'training_time', 'accuracy_drift', 'feature_importance', 'prediction_confidence'],
        collector: this.collectMLMetrics.bind(this)
      },
      'business': {
        description: 'Business-level performance metrics',
        metrics: ['user_satisfaction', 'conversion_rate', 'feature_adoption', 'user_retention', 'revenue_impact'],
        collector: this.collectBusinessMetrics.bind(this)
      }
    };
    
    // Alert severities and actions
    this.alertSeverities = {
      'info': { color: 'blue', priority: 1, autoResolve: true },
      'warning': { color: 'yellow', priority: 2, autoResolve: false },
      'critical': { color: 'red', priority: 3, autoResolve: false },
      'emergency': { color: 'purple', priority: 4, autoResolve: false }
    };
    
    // Performance trends
    this.trendAnalysis = {
      shortTerm: 5 * 60 * 1000,      // 5 minutes
      mediumTerm: 60 * 60 * 1000,    // 1 hour
      longTerm: 24 * 60 * 60 * 1000  // 24 hours
    };
  }

  async initialize() {
    try {
      this.logger.info('Initializing real-time performance monitor');
      
      // Initialize monitoring infrastructure
      await this.initializeMonitoringInfrastructure();
      
      // Setup metric collectors
      await this.setupMetricCollectors();
      
      // Initialize alert system
      await this.initializeAlertSystem();
      
      // Start performance monitoring
      await this.startPerformanceMonitoring();
      
      // Setup trend analysis
      await this.setupTrendAnalysis();
      
      this.isInitialized = true;
      this.logger.info('Real-time performance monitor initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize performance monitor', { error: error.message });
      throw error;
    }
  }

  async startMonitoring(target, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Performance monitor not initialized');
    }

    try {
      const monitorId = this.generateMonitorId(target);
      
      this.logger.info('Starting performance monitoring', {
        target: target.name || target.id,
        monitorId,
        categories: options.categories || Object.keys(this.metricsCategories)
      });

      const monitor = {
        id: monitorId,
        target: target,
        categories: options.categories || Object.keys(this.metricsCategories),
        interval: options.interval || this.monitoringConfig.samplingInterval,
        startTime: Date.now(),
        status: 'active',
        metrics: [],
        alerts: [],
        options: options
      };

      // Start metric collection
      const collector = this.createMetricCollector(monitor);
      monitor.collector = collector;

      this.activeMonitors.set(monitorId, monitor);

      // Begin collecting metrics
      await this.beginMetricCollection(monitor);

      this.logger.info('Performance monitoring started', {
        monitorId,
        target: target.name || target.id,
        metricsCount: monitor.categories.length
      });

      return monitorId;

    } catch (error) {
      this.logger.error('Failed to start performance monitoring', { target, error: error.message });
      throw error;
    }
  }

  async collectMetrics(monitorId, timestamp = Date.now()) {
    const monitor = this.activeMonitors.get(monitorId);
    if (!monitor || monitor.status !== 'active') {
      return null;
    }

    try {
      const metricsSnapshot = {
        monitorId: monitorId,
        timestamp: timestamp,
        target: monitor.target,
        metrics: {},
        alerts: [],
        trends: {}
      };

      // Collect metrics from each category
      for (const category of monitor.categories) {
        const categoryConfig = this.metricsCategories[category];
        if (!categoryConfig) continue;

        try {
          const categoryMetrics = await categoryConfig.collector(monitor.target, monitor.options);
          metricsSnapshot.metrics[category] = {
            ...categoryMetrics,
            collection_time: Date.now() - timestamp,
            status: 'success'
          };

          // Check for alerts
          const categoryAlerts = await this.checkMetricAlerts(category, categoryMetrics, monitor);
          metricsSnapshot.alerts.push(...categoryAlerts);

        } catch (error) {
          this.logger.warn(`Failed to collect ${category} metrics`, { monitorId, error: error.message });
          metricsSnapshot.metrics[category] = {
            status: 'error',
            error: error.message,
            collection_time: Date.now() - timestamp
          };
        }
      }

      // Calculate trends
      metricsSnapshot.trends = await this.calculateMetricTrends(monitorId, metricsSnapshot.metrics);

      // Store metrics
      await this.storeMetrics(metricsSnapshot);

      // Process alerts
      if (metricsSnapshot.alerts.length > 0) {
        await this.processAlerts(metricsSnapshot.alerts, monitor);
      }

      // Update monitor
      monitor.metrics.push(metricsSnapshot);
      monitor.lastCollection = timestamp;

      // Cleanup old metrics
      await this.cleanupOldMetrics(monitor);

      return metricsSnapshot;

    } catch (error) {
      this.logger.error('Failed to collect metrics', { monitorId, error: error.message });
      throw error;
    }
  }

  async collectSystemMetrics(target, options) {
    const metrics = {
      cpu_usage: await this.getCPUUsage(),
      memory_usage: await this.getMemoryUsage(),
      disk_io: await this.getDiskIO(),
      network_io: await this.getNetworkIO(),
      process_count: await this.getProcessCount(),
      load_average: await this.getLoadAverage(),
      uptime: process.uptime(),
      heap_usage: this.getHeapUsage()
    };

    return metrics;
  }

  async collectApplicationMetrics(target, options) {
    const metrics = {
      response_time: await this.getAverageResponseTime(),
      throughput: await this.getCurrentThroughput(),
      error_rate: await this.getErrorRate(),
      active_connections: await this.getActiveConnections(),
      queue_depth: await this.getQueueDepth(),
      cache_hit_rate: await this.getCacheHitRate(),
      api_calls_per_minute: await this.getAPICallsPerMinute(),
      concurrent_users: await this.getConcurrentUsers()
    };

    return metrics;
  }

  async collectDatabaseMetrics(target, options) {
    try {
      const metrics = {
        query_time: await this.getDatabaseQueryTime(),
        connection_pool: await this.getConnectionPoolStatus(),
        cache_hit_rate: await this.getDatabaseCacheHitRate(),
        index_efficiency: await this.getIndexEfficiency(),
        storage_usage: await this.getStorageUsage(),
        transaction_rate: await this.getTransactionRate(),
        lock_contention: await this.getLockContention(),
        replication_lag: await this.getReplicationLag()
      };

      return metrics;

    } catch (error) {
      this.logger.warn('Failed to collect database metrics', { error: error.message });
      return {
        query_time: 0,
        connection_pool: { active: 0, idle: 0, total: 0 },
        cache_hit_rate: 0,
        index_efficiency: 0,
        storage_usage: 0
      };
    }
  }

  async collectSearchMetrics(target, options) {
    const metrics = {
      search_latency: await this.getSearchLatency(),
      indexing_rate: await this.getIndexingRate(),
      query_complexity: await this.getAverageQueryComplexity(),
      result_quality: await this.getResultQuality(),
      personalization_impact: await this.getPersonalizationImpact(),
      facet_usage: await this.getFacetUsage(),
      cluster_performance: await this.getClusterPerformance(),
      vector_search_latency: await this.getVectorSearchLatency()
    };

    return metrics;
  }

  async collectMLMetrics(target, options) {
    const metrics = {
      model_inference_time: await this.getModelInferenceTime(),
      training_time: await this.getTrainingTime(),
      accuracy_drift: await this.getAccuracyDrift(),
      feature_importance: await this.getFeatureImportance(),
      prediction_confidence: await this.getPredictionConfidence(),
      model_memory_usage: await this.getModelMemoryUsage(),
      batch_processing_rate: await this.getBatchProcessingRate(),
      embedding_generation_rate: await this.getEmbeddingGenerationRate()
    };

    return metrics;
  }

  async collectBusinessMetrics(target, options) {
    const metrics = {
      user_satisfaction: await this.getUserSatisfactionScore(),
      conversion_rate: await this.getConversionRate(),
      feature_adoption: await this.getFeatureAdoptionRate(),
      user_retention: await this.getUserRetentionRate(),
      revenue_impact: await this.getRevenueImpact(),
      user_engagement: await this.getUserEngagement(),
      support_tickets: await this.getSupportTicketRate(),
      system_reliability: await this.getSystemReliability()
    };

    return metrics;
  }

  async checkMetricAlerts(category, metrics, monitor) {
    const alerts = [];
    const thresholds = this.monitoringConfig.alertThresholds;

    Object.entries(metrics).forEach(([metricName, value]) => {
      if (typeof value !== 'number') return;

      const threshold = thresholds[metricName];
      if (!threshold) return;

      let severity = null;
      let message = null;

      // Check for threshold violations
      if (metricName === 'throughput') {
        // Throughput alerts are based on percentage change
        const previousValue = this.getPreviousMetricValue(monitor.id, category, metricName);
        if (previousValue) {
          const changePercent = (value - previousValue) / previousValue;
          if (changePercent <= threshold.critical) {
            severity = 'critical';
            message = `Throughput dropped by ${Math.abs(changePercent * 100).toFixed(1)}%`;
          } else if (changePercent <= threshold.warning) {
            severity = 'warning';
            message = `Throughput dropped by ${Math.abs(changePercent * 100).toFixed(1)}%`;
          }
        }
      } else {
        // Standard threshold checks
        if (value >= threshold.critical) {
          severity = 'critical';
          message = `${metricName} is critically high: ${value}`;
        } else if (value >= threshold.warning) {
          severity = 'warning';
          message = `${metricName} is elevated: ${value}`;
        } else if (threshold.hasOwnProperty('minimum') && value <= threshold.minimum) {
          severity = 'warning';
          message = `${metricName} is below minimum threshold: ${value}`;
        }
      }

      if (severity) {
        alerts.push({
          id: this.generateAlertId(),
          timestamp: Date.now(),
          severity: severity,
          category: category,
          metric: metricName,
          value: value,
          threshold: threshold,
          message: message,
          monitor_id: monitor.id,
          target: monitor.target.name || monitor.target.id
        });
      }
    });

    return alerts;
  }

  async calculateMetricTrends(monitorId, currentMetrics) {
    const trends = {};

    for (const [category, metrics] of Object.entries(currentMetrics)) {
      if (metrics.status !== 'success') continue;

      trends[category] = {};

      for (const [metricName, value] of Object.entries(metrics)) {
        if (typeof value !== 'number') continue;

        // Calculate trends for different time windows
        const shortTrend = await this.calculateTrend(monitorId, category, metricName, this.trendAnalysis.shortTerm);
        const mediumTrend = await this.calculateTrend(monitorId, category, metricName, this.trendAnalysis.mediumTerm);
        const longTrend = await this.calculateTrend(monitorId, category, metricName, this.trendAnalysis.longTerm);

        trends[category][metricName] = {
          current: value,
          short_term: shortTrend,
          medium_term: mediumTrend,
          long_term: longTrend,
          direction: this.getTrendDirection(shortTrend),
          volatility: this.calculateVolatility(monitorId, category, metricName)
        };
      }
    }

    return trends;
  }

  async processAlerts(alerts, monitor) {
    for (const alert of alerts) {
      try {
        // Add to alert queue
        this.alertQueue.push(alert);

        // Log alert
        this.logger[alert.severity](`Performance alert: ${alert.message}`, {
          alert_id: alert.id,
          monitor_id: alert.monitor_id,
          metric: alert.metric,
          value: alert.value
        });

        // Store alert
        await this.storeAlert(alert);

        // Trigger alert actions
        await this.triggerAlertActions(alert, monitor);

      } catch (error) {
        this.logger.error('Failed to process alert', { alert, error: error.message });
      }
    }
  }

  async getPerformanceSnapshot(monitorId, timeRange = '1h') {
    try {
      const monitor = this.activeMonitors.get(monitorId);
      if (!monitor) {
        throw new Error(`Monitor ${monitorId} not found`);
      }

      const endTime = Date.now();
      const startTime = endTime - this.parseTimeRange(timeRange);

      const snapshot = {
        monitor_id: monitorId,
        target: monitor.target,
        time_range: { start: startTime, end: endTime },
        current_status: monitor.status,
        metrics_summary: {},
        alerts_summary: {},
        trends_summary: {},
        performance_score: 0
      };

      // Get metrics in time range
      const metricsInRange = await this.getMetricsInTimeRange(monitorId, startTime, endTime);

      // Calculate summary statistics
      snapshot.metrics_summary = this.calculateMetricsSummary(metricsInRange);
      snapshot.alerts_summary = this.calculateAlertsSummary(metricsInRange);
      snapshot.trends_summary = this.calculateTrendsSummary(metricsInRange);

      // Calculate overall performance score
      snapshot.performance_score = this.calculatePerformanceScore(snapshot);

      return snapshot;

    } catch (error) {
      this.logger.error('Failed to get performance snapshot', { monitorId, error: error.message });
      throw error;
    }
  }

  async stopMonitoring(monitorId) {
    try {
      const monitor = this.activeMonitors.get(monitorId);
      if (!monitor) {
        throw new Error(`Monitor ${monitorId} not found`);
      }

      this.logger.info('Stopping performance monitoring', { monitorId });

      // Stop the collector
      if (monitor.collector) {
        clearInterval(monitor.collector);
      }

      // Update status
      monitor.status = 'stopped';
      monitor.stopTime = Date.now();

      // Archive monitor data
      await this.archiveMonitorData(monitor);

      // Remove from active monitors
      this.activeMonitors.delete(monitorId);

      this.logger.info('Performance monitoring stopped', { monitorId });

    } catch (error) {
      this.logger.error('Failed to stop monitoring', { monitorId, error: error.message });
      throw error;
    }
  }

  // Helper methods for metric collection
  async getCPUUsage() {
    // Get CPU usage percentage
    const cpus = require('os').cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      Object.values(cpu.times).forEach(time => totalTick += time);
      totalIdle += cpu.times.idle;
    });

    return 1 - (totalIdle / totalTick);
  }

  async getMemoryUsage() {
    const totalMem = require('os').totalmem();
    const freeMem = require('os').freemem();
    return (totalMem - freeMem) / totalMem;
  }

  async getDiskIO() {
    // Simplified disk I/O metrics
    return {
      reads_per_sec: Math.random() * 100,
      writes_per_sec: Math.random() * 50,
      read_bytes_per_sec: Math.random() * 1024 * 1024,
      write_bytes_per_sec: Math.random() * 512 * 1024
    };
  }

  async getNetworkIO() {
    return {
      bytes_in_per_sec: Math.random() * 1024 * 1024,
      bytes_out_per_sec: Math.random() * 512 * 1024,
      packets_in_per_sec: Math.random() * 1000,
      packets_out_per_sec: Math.random() * 800
    };
  }

  async getProcessCount() {
    // Simplified process count
    return Object.keys(require('child_process').spawnSync('ps', ['aux']).stdout.toString().split('\n')).length;
  }

  async getLoadAverage() {
    return require('os').loadavg();
  }

  getHeapUsage() {
    const memUsage = process.memoryUsage();
    return {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: memUsage.heapUsed / memUsage.heapTotal
    };
  }

  // Application metrics helpers
  async getAverageResponseTime() {
    // Mock implementation - would connect to actual app metrics
    return Math.random() * 500 + 100;
  }

  async getCurrentThroughput() {
    return Math.random() * 100 + 50;
  }

  async getErrorRate() {
    return Math.random() * 0.05;
  }

  async getActiveConnections() {
    return Math.floor(Math.random() * 1000) + 100;
  }

  // Utility methods
  generateMonitorId(target) {
    return `monitor_${target.id || target.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  parseTimeRange(timeRange) {
    const units = { 'm': 60000, 'h': 3600000, 'd': 86400000 };
    const match = timeRange.match(/^(\d+)([mhd])$/);
    return match ? parseInt(match[1]) * units[match[2]] : 3600000;
  }

  getTrendDirection(trend) {
    if (trend > 0.05) return 'increasing';
    if (trend < -0.05) return 'decreasing';
    return 'stable';
  }

  calculatePerformanceScore(snapshot) {
    // Simplified performance score calculation
    let score = 100;
    
    // Deduct points for alerts
    score -= snapshot.alerts_summary.critical_count * 20;
    score -= snapshot.alerts_summary.warning_count * 5;
    
    // Adjust for trends
    Object.values(snapshot.trends_summary).forEach(trend => {
      if (trend.direction === 'decreasing' && trend.metric.includes('error')) {
        score += 5; // Good trend
      } else if (trend.direction === 'increasing' && trend.metric.includes('response_time')) {
        score -= 10; // Bad trend
      }
    });
    
    return Math.max(0, Math.min(100, score));
  }

  // Placeholder methods for complex operations
  async initializeMonitoringInfrastructure() { /* Implementation details */ }
  async setupMetricCollectors() { /* Implementation details */ }
  async initializeAlertSystem() { /* Implementation details */ }
  async startPerformanceMonitoring() { /* Implementation details */ }
  async setupTrendAnalysis() { /* Implementation details */ }
  createMetricCollector(monitor) { 
    return setInterval(() => this.collectMetrics(monitor.id), monitor.interval);
  }
  async beginMetricCollection(monitor) { /* Implementation details */ }
  async storeMetrics(snapshot) { /* Implementation details */ }
  async storeAlert(alert) { /* Implementation details */ }
  async triggerAlertActions(alert, monitor) { /* Implementation details */ }
  async cleanupOldMetrics(monitor) { /* Implementation details */ }
  getPreviousMetricValue(monitorId, category, metricName) { return null; }
  async calculateTrend(monitorId, category, metricName, timeWindow) { return 0; }
  calculateVolatility(monitorId, category, metricName) { return 0; }
  async getMetricsInTimeRange(monitorId, startTime, endTime) { return []; }
  calculateMetricsSummary(metrics) { return {}; }
  calculateAlertsSummary(metrics) { return { critical_count: 0, warning_count: 0 }; }
  calculateTrendsSummary(metrics) { return {}; }
  async archiveMonitorData(monitor) { /* Implementation details */ }
  
  // Additional metric collection methods would be implemented here
  async getDatabaseQueryTime() { return Math.random() * 100; }
  async getConnectionPoolStatus() { return { active: 5, idle: 15, total: 20 }; }
  async getDatabaseCacheHitRate() { return Math.random() * 0.3 + 0.7; }
  async getIndexEfficiency() { return Math.random() * 0.2 + 0.8; }
  async getStorageUsage() { return Math.random() * 0.3 + 0.4; }
  async getTransactionRate() { return Math.random() * 1000; }
  async getLockContention() { return Math.random() * 0.1; }
  async getReplicationLag() { return Math.random() * 100; }
  async getSearchLatency() { return Math.random() * 200 + 50; }
  async getIndexingRate() { return Math.random() * 1000; }
  async getAverageQueryComplexity() { return Math.random() * 5 + 1; }
  async getResultQuality() { return Math.random() * 0.2 + 0.8; }
  async getPersonalizationImpact() { return Math.random() * 0.3 + 0.1; }
  async getFacetUsage() { return Math.random() * 0.4 + 0.3; }
  async getClusterPerformance() { return Math.random() * 0.2 + 0.8; }
  async getVectorSearchLatency() { return Math.random() * 100 + 20; }
  async getModelInferenceTime() { return Math.random() * 500; }
  async getTrainingTime() { return Math.random() * 10000; }
  async getAccuracyDrift() { return Math.random() * 0.1; }
  async getFeatureImportance() { return Math.random() * 1; }
  async getPredictionConfidence() { return Math.random() * 0.2 + 0.8; }
  async getModelMemoryUsage() { return Math.random() * 2048; }
  async getBatchProcessingRate() { return Math.random() * 100; }
  async getEmbeddingGenerationRate() { return Math.random() * 1000; }
  async getUserSatisfactionScore() { return Math.random() * 2 + 3; }
  async getConversionRate() { return Math.random() * 0.1 + 0.05; }
  async getFeatureAdoptionRate() { return Math.random() * 0.3 + 0.4; }
  async getUserRetentionRate() { return Math.random() * 0.2 + 0.7; }
  async getRevenueImpact() { return Math.random() * 10000; }
  async getUserEngagement() { return Math.random() * 0.3 + 0.5; }
  async getSupportTicketRate() { return Math.random() * 50; }
  async getSystemReliability() { return Math.random() * 0.05 + 0.95; }
  async getQueueDepth() { return Math.floor(Math.random() * 100); }
  async getCacheHitRate() { return Math.random() * 0.3 + 0.7; }
  async getAPICallsPerMinute() { return Math.random() * 1000; }
  async getConcurrentUsers() { return Math.floor(Math.random() * 500) + 100; }

  getStats() {
    return {
      initialized: this.isInitialized,
      activeMonitors: this.activeMonitors.size,
      alertQueue: this.alertQueue.length,
      metricsCategories: Object.keys(this.metricsCategories).length,
      monitoringConfig: this.monitoringConfig
    };
  }

  async cleanup() {
    // Stop all active monitors
    for (const [monitorId, monitor] of this.activeMonitors) {
      await this.stopMonitoring(monitorId);
    }
    
    this.performanceMetrics.clear();
    this.activeMonitors.clear();
    this.alertQueue.length = 0;
    this.isInitialized = false;
    this.logger.info('Real-time performance monitor cleaned up');
  }
}

export const performanceMonitor = new RealTimePerformanceMonitor();