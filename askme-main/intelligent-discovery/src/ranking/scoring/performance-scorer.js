import { createLogger } from '../../core/infrastructure/logger.js';
import { qdrantManager } from '../../core/storage/qdrant.js';
import { cacheManager } from '../../core/storage/cache.js';
import { benchmarkSuite } from '../../validation/performance/benchmark-suite.js';
import { reliabilityMonitor } from '../../validation/monitoring/reliability-monitor.js';

class PerformanceBasedScorer {
  constructor() {
    this.logger = createLogger({ component: 'performance-scorer' });
    this.isInitialized = false;
    this.performanceCache = new Map();
    this.benchmarkHistory = new Map();
    
    // Performance scoring weights
    this.performanceWeights = {
      latency: 0.25,           // Response time importance
      throughput: 0.2,         // Requests per second
      reliability: 0.2,        // Uptime and stability
      scalability: 0.15,       // Handling increased load
      efficiency: 0.1,         // Resource utilization
      consistency: 0.1         // Response time variance
    };
    
    // Performance thresholds for scoring
    this.performanceThresholds = {
      excellent: { latency: 100, throughput: 100, reliability: 0.99 },
      good: { latency: 500, throughput: 50, reliability: 0.95 },
      average: { latency: 1000, throughput: 25, reliability: 0.9 },
      poor: { latency: 2000, throughput: 10, reliability: 0.8 }
    };
    
    // Benchmark categories and their impact
    this.benchmarkCategories = {
      'cold_start': { weight: 0.15, description: 'Initial response time' },
      'warm_response': { weight: 0.2, description: 'Steady-state response time' },
      'concurrent_load': { weight: 0.2, description: 'Performance under load' },
      'sustained_throughput': { weight: 0.15, description: 'Long-term performance' },
      'memory_efficiency': { weight: 0.1, description: 'Resource utilization' },
      'error_recovery': { weight: 0.1, description: 'Error handling capability' },
      'rate_limit_handling': { weight: 0.1, description: 'Rate limit compliance' }
    };
  }

  async initialize() {
    try {
      this.logger.info('Initializing performance-based scoring system');
      
      // Initialize performance monitoring
      await this.initializePerformanceMonitoring();
      
      // Load historical performance data
      await this.loadPerformanceHistory();
      
      // Initialize benchmark integration
      await this.initializeBenchmarkIntegration();
      
      // Setup performance tracking
      await this.setupPerformanceTracking();
      
      this.isInitialized = true;
      this.logger.info('Performance-based scorer initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize performance scorer', { error: error.message });
      throw error;
    }
  }

  async scoreModelPerformance(modelId, context = {}) {
    if (!this.isInitialized) {
      throw new Error('Performance scorer not initialized');
    }

    try {
      this.logger.debug('Scoring model performance', { modelId });
      
      // Check cache first
      const cacheKey = `perf_score:${modelId}:${JSON.stringify(context)}`;
      const cachedScore = await cacheManager.get(cacheKey);
      if (cachedScore && this.isCacheValid(cachedScore)) {
        return cachedScore;
      }
      
      // Gather performance metrics
      const performanceMetrics = await this.gatherPerformanceMetrics(modelId);
      
      // Run fresh benchmarks if needed
      const benchmarkResults = await this.getBenchmarkResults(modelId, context);
      
      // Get reliability metrics
      const reliabilityMetrics = await this.getReliabilityMetrics(modelId);
      
      // Calculate performance scores
      const performanceScore = await this.calculatePerformanceScore(
        performanceMetrics,
        benchmarkResults,
        reliabilityMetrics,
        context
      );
      
      // Apply contextual adjustments
      const adjustedScore = await this.applyContextualAdjustments(performanceScore, context);
      
      // Cache the result
      await cacheManager.set(cacheKey, adjustedScore, 1800); // 30 minutes
      
      this.logger.debug('Performance score calculated', {
        modelId,
        score: adjustedScore.score,
        confidence: adjustedScore.confidence
      });
      
      return adjustedScore;
      
    } catch (error) {
      this.logger.error('Failed to score model performance', { modelId, error: error.message });
      throw error;
    }
  }

  async gatherPerformanceMetrics(modelId) {
    try {
      // Query historical performance data from Qdrant
      const performanceData = await qdrantManager.search(
        'model_metadata',
        null,
        {
          filter: {
            must: [{ key: 'model_id', match: { value: modelId } }]
          },
          limit: 100
        }
      );
      
      // Aggregate performance metrics
      const metrics = {
        latency: await this.aggregateLatencyMetrics(performanceData),
        throughput: await this.aggregateThroughputMetrics(performanceData),
        errorRate: await this.aggregateErrorMetrics(performanceData),
        uptime: await this.aggregateUptimeMetrics(performanceData),
        resourceUsage: await this.aggregateResourceMetrics(performanceData)
      };
      
      return metrics;
      
    } catch (error) {
      this.logger.warn('Failed to gather performance metrics', { modelId, error: error.message });
      return this.getDefaultPerformanceMetrics();
    }
  }

  async getBenchmarkResults(modelId, context) {
    try {
      // Check if we have recent benchmark results
      const cachedBenchmarks = this.benchmarkHistory.get(modelId);
      if (cachedBenchmarks && this.areBenchmarksRecent(cachedBenchmarks)) {
        return cachedBenchmarks;
      }
      
      // Run fresh benchmarks
      this.logger.info('Running fresh benchmarks for model', { modelId });
      const benchmarkResults = await benchmarkSuite.runModelBenchmarks(modelId, {
        categories: Object.keys(this.benchmarkCategories),
        context: context
      });
      
      // Cache benchmark results
      this.benchmarkHistory.set(modelId, {
        results: benchmarkResults,
        timestamp: Date.now()
      });
      
      return benchmarkResults;
      
    } catch (error) {
      this.logger.warn('Failed to get benchmark results', { modelId, error: error.message });
      return this.getDefaultBenchmarkResults();
    }
  }

  async getReliabilityMetrics(modelId) {
    try {
      return await reliabilityMonitor.getModelReliabilityMetrics(modelId);
    } catch (error) {
      this.logger.warn('Failed to get reliability metrics', { modelId, error: error.message });
      return this.getDefaultReliabilityMetrics();
    }
  }

  async calculatePerformanceScore(performanceMetrics, benchmarkResults, reliabilityMetrics, context) {
    const scores = {};
    
    // Calculate latency score
    scores.latency = this.calculateLatencyScore(performanceMetrics.latency, benchmarkResults);
    
    // Calculate throughput score
    scores.throughput = this.calculateThroughputScore(performanceMetrics.throughput, benchmarkResults);
    
    // Calculate reliability score
    scores.reliability = this.calculateReliabilityScore(reliabilityMetrics);
    
    // Calculate scalability score
    scores.scalability = this.calculateScalabilityScore(benchmarkResults);
    
    // Calculate efficiency score
    scores.efficiency = this.calculateEfficiencyScore(performanceMetrics.resourceUsage, benchmarkResults);
    
    // Calculate consistency score
    scores.consistency = this.calculateConsistencyScore(performanceMetrics, benchmarkResults);
    
    // Calculate weighted composite score
    let totalScore = 0;
    let totalWeight = 0;
    const breakdown = {};
    
    Object.entries(this.performanceWeights).forEach(([metric, weight]) => {
      if (scores[metric] !== undefined) {
        totalScore += scores[metric].score * weight;
        totalWeight += weight;
        breakdown[metric] = {
          score: scores[metric].score,
          weight,
          contribution: scores[metric].score * weight,
          details: scores[metric].details
        };
      }
    });
    
    const compositeScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    const confidence = this.calculateScoreConfidence(scores, performanceMetrics, benchmarkResults);
    
    return {
      score: compositeScore,
      confidence,
      breakdown,
      metrics: {
        performance: performanceMetrics,
        benchmarks: benchmarkResults,
        reliability: reliabilityMetrics
      },
      timestamp: Date.now()
    };
  }

  calculateLatencyScore(latencyMetrics, benchmarkResults) {
    const avgLatency = latencyMetrics.average || 1000;
    const p95Latency = latencyMetrics.p95 || avgLatency * 1.5;
    const coldStartLatency = benchmarkResults.cold_start?.averageLatency || avgLatency * 2;
    
    // Score based on performance thresholds
    let latencyScore = 0;
    if (avgLatency <= this.performanceThresholds.excellent.latency) {
      latencyScore = 1.0;
    } else if (avgLatency <= this.performanceThresholds.good.latency) {
      latencyScore = 0.8;
    } else if (avgLatency <= this.performanceThresholds.average.latency) {
      latencyScore = 0.6;
    } else if (avgLatency <= this.performanceThresholds.poor.latency) {
      latencyScore = 0.4;
    } else {
      latencyScore = 0.2;
    }
    
    // Adjust for p95 performance
    const p95Penalty = Math.max(0, (p95Latency - avgLatency * 2) / avgLatency) * 0.1;
    latencyScore = Math.max(0, latencyScore - p95Penalty);
    
    // Adjust for cold start performance
    const coldStartPenalty = Math.max(0, (coldStartLatency - avgLatency * 3) / avgLatency) * 0.05;
    latencyScore = Math.max(0, latencyScore - coldStartPenalty);
    
    return {
      score: latencyScore,
      details: {
        average: avgLatency,
        p95: p95Latency,
        coldStart: coldStartLatency,
        threshold: this.getLatencyThreshold(latencyScore)
      }
    };
  }

  calculateThroughputScore(throughputMetrics, benchmarkResults) {
    const avgThroughput = throughputMetrics.requestsPerSecond || 10;
    const sustainedThroughput = benchmarkResults.sustained_throughput?.averageThroughput || avgThroughput * 0.8;
    const concurrentThroughput = benchmarkResults.concurrent_load?.averageThroughput || avgThroughput * 0.6;
    
    // Score based on performance thresholds
    let throughputScore = 0;
    if (avgThroughput >= this.performanceThresholds.excellent.throughput) {
      throughputScore = 1.0;
    } else if (avgThroughput >= this.performanceThresholds.good.throughput) {
      throughputScore = 0.8;
    } else if (avgThroughput >= this.performanceThresholds.average.throughput) {
      throughputScore = 0.6;
    } else if (avgThroughput >= this.performanceThresholds.poor.throughput) {
      throughputScore = 0.4;
    } else {
      throughputScore = 0.2;
    }
    
    // Adjust for sustained performance
    const sustainedRatio = sustainedThroughput / avgThroughput;
    const sustainedBonus = (sustainedRatio - 0.7) * 0.1;
    throughputScore = Math.min(1, throughputScore + sustainedBonus);
    
    // Adjust for concurrent performance
    const concurrentRatio = concurrentThroughput / avgThroughput;
    const concurrentBonus = (concurrentRatio - 0.5) * 0.05;
    throughputScore = Math.min(1, throughputScore + concurrentBonus);
    
    return {
      score: Math.max(0, throughputScore),
      details: {
        average: avgThroughput,
        sustained: sustainedThroughput,
        concurrent: concurrentThroughput,
        sustainedRatio,
        concurrentRatio
      }
    };
  }

  calculateReliabilityScore(reliabilityMetrics) {
    const uptime = reliabilityMetrics.uptime || 0.9;
    const errorRate = reliabilityMetrics.errorRate || 0.1;
    const availability = reliabilityMetrics.availability || 0.95;
    
    // Score based on reliability thresholds
    let reliabilityScore = 0;
    if (uptime >= this.performanceThresholds.excellent.reliability) {
      reliabilityScore = 1.0;
    } else if (uptime >= this.performanceThresholds.good.reliability) {
      reliabilityScore = 0.8;
    } else if (uptime >= this.performanceThresholds.average.reliability) {
      reliabilityScore = 0.6;
    } else if (uptime >= this.performanceThresholds.poor.reliability) {
      reliabilityScore = 0.4;
    } else {
      reliabilityScore = 0.2;
    }
    
    // Adjust for error rate
    const errorPenalty = errorRate * 0.5;
    reliabilityScore = Math.max(0, reliabilityScore - errorPenalty);
    
    // Adjust for availability
    const availabilityBonus = (availability - 0.9) * 0.2;
    reliabilityScore = Math.min(1, reliabilityScore + availabilityBonus);
    
    return {
      score: reliabilityScore,
      details: {
        uptime,
        errorRate,
        availability,
        reliabilityGrade: this.getReliabilityGrade(reliabilityScore)
      }
    };
  }

  calculateScalabilityScore(benchmarkResults) {
    const concurrentLoadResults = benchmarkResults.concurrent_load || {};
    const scalabilityMetrics = concurrentLoadResults.scalabilityMetrics || {};
    
    const loadCapacity = scalabilityMetrics.maxConcurrentRequests || 10;
    const performanceDegradation = scalabilityMetrics.performanceDegradation || 0.5;
    const resourceScaling = scalabilityMetrics.resourceScaling || 0.7;
    
    // Base scalability score
    let scalabilityScore = Math.min(1, loadCapacity / 100); // Normalize to 100 concurrent requests
    
    // Adjust for performance degradation under load
    const degradationPenalty = performanceDegradation * 0.3;
    scalabilityScore = Math.max(0, scalabilityScore - degradationPenalty);
    
    // Adjust for resource scaling efficiency
    const scalingBonus = (resourceScaling - 0.5) * 0.2;
    scalabilityScore = Math.min(1, scalabilityScore + scalingBonus);
    
    return {
      score: scalabilityScore,
      details: {
        loadCapacity,
        performanceDegradation,
        resourceScaling,
        scalabilityRating: this.getScalabilityRating(scalabilityScore)
      }
    };
  }

  calculateEfficiencyScore(resourceMetrics, benchmarkResults) {
    const memoryUsage = resourceMetrics.averageMemory || 1024; // MB
    const cpuUsage = resourceMetrics.averageCpu || 0.5; // 0-1
    const networkUsage = resourceMetrics.averageNetwork || 100; // KB/s
    
    const memoryEfficiencyResults = benchmarkResults.memory_efficiency || {};
    const memoryEfficiency = memoryEfficiencyResults.efficiency || 0.7;
    
    // Calculate resource efficiency
    const memoryScore = Math.max(0, 1 - (memoryUsage / 4096)); // Penalty for high memory usage
    const cpuScore = Math.max(0, 1 - cpuUsage); // Penalty for high CPU usage
    const networkScore = Math.max(0, 1 - (networkUsage / 1000)); // Penalty for high network usage
    
    // Weighted efficiency score
    const efficiencyScore = (memoryScore * 0.4 + cpuScore * 0.3 + networkScore * 0.2 + memoryEfficiency * 0.1);
    
    return {
      score: efficiencyScore,
      details: {
        memory: { usage: memoryUsage, score: memoryScore },
        cpu: { usage: cpuUsage, score: cpuScore },
        network: { usage: networkUsage, score: networkScore },
        memoryEfficiency,
        efficiencyGrade: this.getEfficiencyGrade(efficiencyScore)
      }
    };
  }

  calculateConsistencyScore(performanceMetrics, benchmarkResults) {
    const latencyVariance = performanceMetrics.latency?.variance || 0.2;
    const throughputVariance = performanceMetrics.throughput?.variance || 0.15;
    const responseTimeStability = benchmarkResults.warm_response?.stability || 0.8;
    
    // Calculate consistency based on variance
    const latencyConsistency = Math.max(0, 1 - latencyVariance);
    const throughputConsistency = Math.max(0, 1 - throughputVariance);
    
    // Weighted consistency score
    const consistencyScore = (latencyConsistency * 0.4 + throughputConsistency * 0.3 + responseTimeStability * 0.3);
    
    return {
      score: consistencyScore,
      details: {
        latencyVariance,
        throughputVariance,
        responseTimeStability,
        consistencyRating: this.getConsistencyRating(consistencyScore)
      }
    };
  }

  calculateScoreConfidence(scores, performanceMetrics, benchmarkResults) {
    const dataCompleteness = this.calculateDataCompleteness(performanceMetrics, benchmarkResults);
    const dataRecency = this.calculateDataRecency(performanceMetrics, benchmarkResults);
    const sampleSize = this.calculateSampleSize(performanceMetrics, benchmarkResults);
    
    return Math.min(1, (dataCompleteness * 0.4 + dataRecency * 0.3 + sampleSize * 0.3));
  }

  async applyContextualAdjustments(performanceScore, context) {
    let adjustedScore = { ...performanceScore };
    
    // Apply use-case specific adjustments
    if (context.useCase) {
      adjustedScore = await this.applyUseCaseAdjustments(adjustedScore, context.useCase);
    }
    
    // Apply load requirements adjustments
    if (context.expectedLoad) {
      adjustedScore = await this.applyLoadAdjustments(adjustedScore, context.expectedLoad);
    }
    
    // Apply SLA requirements adjustments
    if (context.slaRequirements) {
      adjustedScore = await this.applySLAAdjustments(adjustedScore, context.slaRequirements);
    }
    
    return adjustedScore;
  }

  // Helper methods for scoring
  aggregateLatencyMetrics(data) {
    if (!data || data.length === 0) return { average: 1000, p95: 1500, variance: 0.2 };
    
    const latencies = data.map(d => d.payload?.latency || 1000).filter(l => l > 0);
    const sorted = latencies.sort((a, b) => a - b);
    
    return {
      average: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p95: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
      variance: this.calculateVariance(latencies),
      count: latencies.length
    };
  }

  aggregateThroughputMetrics(data) {
    if (!data || data.length === 0) return { requestsPerSecond: 10, variance: 0.15 };
    
    const throughputs = data.map(d => d.payload?.throughput || 10).filter(t => t > 0);
    
    return {
      requestsPerSecond: throughputs.reduce((a, b) => a + b, 0) / throughputs.length,
      variance: this.calculateVariance(throughputs),
      count: throughputs.length
    };
  }

  aggregateErrorMetrics(data) {
    if (!data || data.length === 0) return { errorRate: 0.05, totalErrors: 0 };
    
    const errors = data.map(d => d.payload?.errorRate || 0);
    
    return {
      errorRate: errors.reduce((a, b) => a + b, 0) / errors.length,
      totalErrors: data.filter(d => d.payload?.hasError).length,
      count: data.length
    };
  }

  aggregateUptimeMetrics(data) {
    if (!data || data.length === 0) return { uptime: 0.9, availability: 0.95 };
    
    const uptimes = data.map(d => d.payload?.uptime || 0.9).filter(u => u >= 0 && u <= 1);
    
    return {
      uptime: uptimes.reduce((a, b) => a + b, 0) / uptimes.length,
      availability: Math.min(...uptimes),
      count: uptimes.length
    };
  }

  aggregateResourceMetrics(data) {
    if (!data || data.length === 0) return { averageMemory: 1024, averageCpu: 0.5, averageNetwork: 100 };
    
    const resources = data.map(d => d.payload?.resources || {});
    
    return {
      averageMemory: resources.reduce((sum, r) => sum + (r.memory || 1024), 0) / resources.length,
      averageCpu: resources.reduce((sum, r) => sum + (r.cpu || 0.5), 0) / resources.length,
      averageNetwork: resources.reduce((sum, r) => sum + (r.network || 100), 0) / resources.length
    };
  }

  calculateVariance(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  // Default values and utility methods
  getDefaultPerformanceMetrics() {
    return {
      latency: { average: 1000, p95: 1500, variance: 0.2 },
      throughput: { requestsPerSecond: 10, variance: 0.15 },
      errorRate: { errorRate: 0.05, totalErrors: 0 },
      uptime: { uptime: 0.9, availability: 0.95 },
      resourceUsage: { averageMemory: 1024, averageCpu: 0.5, averageNetwork: 100 }
    };
  }

  getDefaultBenchmarkResults() {
    return {
      cold_start: { averageLatency: 2000, stability: 0.7 },
      warm_response: { averageLatency: 800, stability: 0.85 },
      concurrent_load: { averageThroughput: 8, scalabilityMetrics: { maxConcurrentRequests: 10, performanceDegradation: 0.3, resourceScaling: 0.6 } },
      sustained_throughput: { averageThroughput: 9 },
      memory_efficiency: { efficiency: 0.7 }
    };
  }

  getDefaultReliabilityMetrics() {
    return {
      uptime: 0.9,
      errorRate: 0.05,
      availability: 0.95
    };
  }

  isCacheValid(cachedScore) {
    return cachedScore && (Date.now() - cachedScore.timestamp) < 1800000; // 30 minutes
  }

  areBenchmarksRecent(benchmarks) {
    return benchmarks && (Date.now() - benchmarks.timestamp) < 3600000; // 1 hour
  }

  // Grading methods
  getLatencyThreshold(score) {
    if (score >= 0.8) return 'excellent';
    if (score >= 0.6) return 'good';
    if (score >= 0.4) return 'average';
    return 'poor';
  }

  getReliabilityGrade(score) {
    if (score >= 0.9) return 'A';
    if (score >= 0.8) return 'B';
    if (score >= 0.7) return 'C';
    if (score >= 0.6) return 'D';
    return 'F';
  }

  getScalabilityRating(score) {
    if (score >= 0.8) return 'High';
    if (score >= 0.6) return 'Medium';
    if (score >= 0.4) return 'Low';
    return 'Very Low';
  }

  getEfficiencyGrade(score) {
    if (score >= 0.8) return 'Efficient';
    if (score >= 0.6) return 'Moderate';
    if (score >= 0.4) return 'Inefficient';
    return 'Very Inefficient';
  }

  getConsistencyRating(score) {
    if (score >= 0.8) return 'Very Consistent';
    if (score >= 0.6) return 'Consistent';
    if (score >= 0.4) return 'Somewhat Consistent';
    return 'Inconsistent';
  }

  // Placeholder methods for complex operations
  async initializePerformanceMonitoring() { /* Implementation details */ }
  async loadPerformanceHistory() { /* Implementation details */ }
  async initializeBenchmarkIntegration() { /* Implementation details */ }
  async setupPerformanceTracking() { /* Implementation details */ }
  calculateDataCompleteness(performanceMetrics, benchmarkResults) { return 0.8; }
  calculateDataRecency(performanceMetrics, benchmarkResults) { return 0.9; }
  calculateSampleSize(performanceMetrics, benchmarkResults) { return 0.7; }
  async applyUseCaseAdjustments(score, useCase) { return score; }
  async applyLoadAdjustments(score, expectedLoad) { return score; }
  async applySLAAdjustments(score, slaRequirements) { return score; }

  getStats() {
    return {
      initialized: this.isInitialized,
      cacheSize: this.performanceCache.size,
      benchmarkHistory: this.benchmarkHistory.size,
      performanceWeights: this.performanceWeights,
      benchmarkCategories: Object.keys(this.benchmarkCategories)
    };
  }

  async cleanup() {
    this.performanceCache.clear();
    this.benchmarkHistory.clear();
    this.isInitialized = false;
    this.logger.info('Performance-based scorer cleaned up');
  }
}

export const performanceScorer = new PerformanceBasedScorer();