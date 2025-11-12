import { createLogger } from '../../core/infrastructure/logger.js';
import { embeddingsManager } from '../../core/storage/embeddings.js';
import { qdrantManager } from '../../core/storage/qdrant.js';
import { cacheManager } from '../../core/storage/cache.js';

class MLModelScorer {
  constructor() {
    this.logger = createLogger({ component: 'ml-scorer' });
    this.isInitialized = false;
    this.scoreCache = new Map();
    this.modelFeatures = new Map();
    
    // ML scoring weights and parameters
    this.scoringWeights = {
      performance: 0.3,      // API performance metrics
      popularity: 0.2,       // Download count, stars, usage
      quality: 0.25,         // Response quality scores
      reliability: 0.15,     // Uptime and stability
      compatibility: 0.1     // Framework compatibility
    };
    
    // Feature extractors for different model aspects
    this.featureExtractors = {
      performance: this.extractPerformanceFeatures.bind(this),
      popularity: this.extractPopularityFeatures.bind(this),
      quality: this.extractQualityFeatures.bind(this),
      reliability: this.extractReliabilityFeatures.bind(this),
      compatibility: this.extractCompatibilityFeatures.bind(this)
    };
  }

  async initialize() {
    try {
      this.logger.info('Initializing ML-powered model scoring system');
      
      // Load pre-trained scoring models if available
      await this.loadScoringModels();
      
      // Initialize feature normalization parameters
      await this.initializeNormalization();
      
      // Load historical scoring data for training
      await this.loadHistoricalData();
      
      this.isInitialized = true;
      this.logger.info('ML model scorer initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize ML model scorer', { error: error.message });
      throw error;
    }
  }

  async scoreModel(modelId, context = {}) {
    if (!this.isInitialized) {
      throw new Error('ML scorer not initialized');
    }

    try {
      // Check cache first
      const cacheKey = `ml_score:${modelId}:${JSON.stringify(context)}`;
      const cachedScore = await cacheManager.get(cacheKey);
      if (cachedScore) {
        return cachedScore;
      }

      // Extract model features
      const features = await this.extractModelFeatures(modelId, context);
      
      // Calculate composite score using weighted features
      const score = await this.calculateCompositeScore(features);
      
      // Apply context-specific adjustments
      const adjustedScore = await this.applyContextualAdjustments(score, context);
      
      // Cache the result
      await cacheManager.set(cacheKey, adjustedScore, 3600); // 1 hour cache
      
      this.logger.debug('Model score calculated', {
        modelId,
        score: adjustedScore,
        features: Object.keys(features)
      });
      
      return adjustedScore;
      
    } catch (error) {
      this.logger.error('Failed to score model', { modelId, error: error.message });
      throw error;
    }
  }

  async batchScoreModels(modelIds, context = {}) {
    try {
      this.logger.info('Batch scoring models', { count: modelIds.length });
      
      const results = await Promise.allSettled(
        modelIds.map(modelId => this.scoreModel(modelId, context))
      );
      
      const scores = {};
      results.forEach((result, index) => {
        const modelId = modelIds[index];
        if (result.status === 'fulfilled') {
          scores[modelId] = result.value;
        } else {
          this.logger.warn('Failed to score model', { modelId, error: result.reason.message });
          scores[modelId] = { score: 0, confidence: 0, error: result.reason.message };
        }
      });
      
      return scores;
      
    } catch (error) {
      this.logger.error('Batch scoring failed', { error: error.message });
      throw error;
    }
  }

  async extractModelFeatures(modelId, context) {
    const features = {};
    
    // Extract features from different aspects
    for (const [aspect, extractor] of Object.entries(this.featureExtractors)) {
      try {
        features[aspect] = await extractor(modelId, context);
      } catch (error) {
        this.logger.warn(`Failed to extract ${aspect} features`, { modelId, error: error.message });
        features[aspect] = this.getDefaultFeatures(aspect);
      }
    }
    
    return features;
  }

  async extractPerformanceFeatures(modelId, context) {
    // Get performance metrics from validation data
    const performanceData = await qdrantManager.search(
      'model_metadata',
      await embeddingsManager.generateEmbedding(`performance ${modelId}`),
      { limit: 5 }
    );
    
    return {
      latency: this.normalizeValue(performanceData.averageLatency || 1000, 'latency'),
      throughput: this.normalizeValue(performanceData.throughput || 10, 'throughput'),
      tokenSpeed: this.normalizeValue(performanceData.tokenSpeed || 50, 'tokenSpeed'),
      memoryUsage: this.normalizeValue(performanceData.memoryUsage || 2048, 'memory'),
      scalability: this.normalizeValue(performanceData.scalabilityScore || 0.7, 'scalability')
    };
  }

  async extractPopularityFeatures(modelId, context) {
    // Get popularity metrics from model metadata
    const popularityData = await qdrantManager.search(
      'model_metadata',
      await embeddingsManager.generateEmbedding(`popularity ${modelId}`),
      { limit: 5 }
    );
    
    return {
      downloads: this.normalizeValue(popularityData.downloads || 0, 'downloads'),
      stars: this.normalizeValue(popularityData.stars || 0, 'stars'),
      forks: this.normalizeValue(popularityData.forks || 0, 'forks'),
      communityActivity: this.normalizeValue(popularityData.issues || 0, 'activity'),
      recentUpdates: this.normalizeValue(popularityData.lastUpdate || 0, 'updates')
    };
  }

  async extractQualityFeatures(modelId, context) {
    // Get quality metrics from validation results
    const qualityData = await qdrantManager.search(
      'model_metadata',
      await embeddingsManager.generateEmbedding(`quality ${modelId}`),
      { limit: 5 }
    );
    
    return {
      coherence: this.normalizeValue(qualityData.coherenceScore || 0.7, 'quality'),
      fluency: this.normalizeValue(qualityData.fluencyScore || 0.7, 'quality'),
      relevance: this.normalizeValue(qualityData.relevanceScore || 0.7, 'quality'),
      accuracy: this.normalizeValue(qualityData.accuracyScore || 0.7, 'quality'),
      creativity: this.normalizeValue(qualityData.creativityScore || 0.7, 'quality')
    };
  }

  async extractReliabilityFeatures(modelId, context) {
    // Get reliability metrics from monitoring data
    const reliabilityData = await qdrantManager.search(
      'model_metadata',
      await embeddingsManager.generateEmbedding(`reliability ${modelId}`),
      { limit: 5 }
    );
    
    return {
      uptime: this.normalizeValue(reliabilityData.uptime || 0.95, 'uptime'),
      errorRate: this.normalizeValue(reliabilityData.errorRate || 0.05, 'errorRate'),
      consistency: this.normalizeValue(reliabilityData.consistency || 0.8, 'quality'),
      availability: this.normalizeValue(reliabilityData.availability || 0.99, 'uptime'),
      responseStability: this.normalizeValue(reliabilityData.stability || 0.85, 'quality')
    };
  }

  async extractCompatibilityFeatures(modelId, context) {
    // Get compatibility information
    const compatibilityData = await qdrantManager.search(
      'model_metadata',
      await embeddingsManager.generateEmbedding(`compatibility ${modelId}`),
      { limit: 5 }
    );
    
    return {
      frameworkSupport: this.normalizeValue(compatibilityData.frameworks?.length || 1, 'count'),
      languageSupport: this.normalizeValue(compatibilityData.languages?.length || 1, 'count'),
      platformSupport: this.normalizeValue(compatibilityData.platforms?.length || 1, 'count'),
      apiCompatibility: this.normalizeValue(compatibilityData.apiVersion || 1, 'version'),
      integrationEase: this.normalizeValue(compatibilityData.integrationScore || 0.7, 'quality')
    };
  }

  async calculateCompositeScore(features) {
    let totalScore = 0;
    let totalWeight = 0;
    
    // Calculate weighted average of all feature aspects
    for (const [aspect, weight] of Object.entries(this.scoringWeights)) {
      if (features[aspect]) {
        const aspectScore = this.calculateAspectScore(features[aspect]);
        totalScore += aspectScore * weight;
        totalWeight += weight;
      }
    }
    
    const baseScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    
    // Apply confidence weighting based on feature completeness
    const confidence = this.calculateConfidence(features);
    
    return {
      score: Math.max(0, Math.min(1, baseScore)),
      confidence,
      breakdown: this.generateScoreBreakdown(features),
      timestamp: Date.now()
    };
  }

  calculateAspectScore(aspectFeatures) {
    const values = Object.values(aspectFeatures);
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  calculateConfidence(features) {
    const totalFeatures = Object.keys(this.featureExtractors).length;
    const extractedFeatures = Object.keys(features).length;
    return extractedFeatures / totalFeatures;
  }

  async applyContextualAdjustments(score, context) {
    let adjustedScore = { ...score };
    
    // Apply domain-specific adjustments
    if (context.domain) {
      adjustedScore = await this.applyDomainAdjustments(adjustedScore, context.domain);
    }
    
    // Apply use-case specific adjustments
    if (context.useCase) {
      adjustedScore = await this.applyUseCaseAdjustments(adjustedScore, context.useCase);
    }
    
    // Apply user preference adjustments
    if (context.userPreferences) {
      adjustedScore = await this.applyUserPreferenceAdjustments(adjustedScore, context.userPreferences);
    }
    
    return adjustedScore;
  }

  async applyDomainAdjustments(score, domain) {
    const domainWeights = {
      'code-generation': { performance: 1.2, quality: 1.1 },
      'creative-writing': { creativity: 1.3, quality: 1.1 },
      'data-analysis': { accuracy: 1.2, reliability: 1.1 },
      'conversational': { fluency: 1.2, consistency: 1.1 }
    };
    
    if (domainWeights[domain]) {
      // Apply domain-specific weight adjustments
      // This is a simplified version - real implementation would be more sophisticated
      score.score *= 1.05; // Small boost for domain relevance
    }
    
    return score;
  }

  async applyUseCaseAdjustments(score, useCase) {
    // Apply use-case specific scoring adjustments
    const useCaseBoosts = {
      'production': { reliability: 1.2, uptime: 1.2 },
      'research': { quality: 1.1, creativity: 1.1 },
      'prototype': { performance: 1.1, compatibility: 1.1 }
    };
    
    // Apply use-case adjustments
    return score;
  }

  async applyUserPreferenceAdjustments(score, preferences) {
    // Apply learned user preference adjustments
    if (preferences.preferredProviders?.length > 0) {
      // Boost scores for preferred providers
      score.score *= 1.02;
    }
    
    return score;
  }

  normalizeValue(value, type) {
    const normalizationParams = {
      latency: { min: 0, max: 5000, invert: true },
      throughput: { min: 0, max: 1000, invert: false },
      tokenSpeed: { min: 0, max: 500, invert: false },
      memory: { min: 0, max: 8192, invert: true },
      scalability: { min: 0, max: 1, invert: false },
      downloads: { min: 0, max: 1000000, invert: false },
      stars: { min: 0, max: 100000, invert: false },
      forks: { min: 0, max: 10000, invert: false },
      activity: { min: 0, max: 1000, invert: false },
      updates: { min: 0, max: 365, invert: true },
      quality: { min: 0, max: 1, invert: false },
      uptime: { min: 0, max: 1, invert: false },
      errorRate: { min: 0, max: 1, invert: true },
      count: { min: 0, max: 20, invert: false },
      version: { min: 0, max: 10, invert: false }
    };
    
    const params = normalizationParams[type] || { min: 0, max: 1, invert: false };
    let normalized = (value - params.min) / (params.max - params.min);
    normalized = Math.max(0, Math.min(1, normalized));
    
    return params.invert ? 1 - normalized : normalized;
  }

  getDefaultFeatures(aspect) {
    const defaults = {
      performance: { latency: 0.5, throughput: 0.5, tokenSpeed: 0.5, memoryUsage: 0.5, scalability: 0.5 },
      popularity: { downloads: 0.3, stars: 0.3, forks: 0.3, communityActivity: 0.3, recentUpdates: 0.3 },
      quality: { coherence: 0.5, fluency: 0.5, relevance: 0.5, accuracy: 0.5, creativity: 0.5 },
      reliability: { uptime: 0.5, errorRate: 0.5, consistency: 0.5, availability: 0.5, responseStability: 0.5 },
      compatibility: { frameworkSupport: 0.5, languageSupport: 0.5, platformSupport: 0.5, apiCompatibility: 0.5, integrationEase: 0.5 }
    };
    
    return defaults[aspect] || {};
  }

  generateScoreBreakdown(features) {
    const breakdown = {};
    
    for (const [aspect, weight] of Object.entries(this.scoringWeights)) {
      if (features[aspect]) {
        breakdown[aspect] = {
          score: this.calculateAspectScore(features[aspect]),
          weight,
          contribution: this.calculateAspectScore(features[aspect]) * weight,
          features: features[aspect]
        };
      }
    }
    
    return breakdown;
  }

  async loadScoringModels() {
    // Load pre-trained ML models for scoring
    // This would load actual ML models in a real implementation
    this.logger.debug('Loading pre-trained scoring models');
  }

  async initializeNormalization() {
    // Initialize feature normalization parameters
    this.logger.debug('Initializing feature normalization parameters');
  }

  async loadHistoricalData() {
    // Load historical scoring data for model training/validation
    this.logger.debug('Loading historical scoring data');
  }

  async updateScoringWeights(newWeights) {
    this.scoringWeights = { ...this.scoringWeights, ...newWeights };
    this.logger.info('Updated scoring weights', { weights: this.scoringWeights });
  }

  getStats() {
    return {
      initialized: this.isInitialized,
      cacheSize: this.scoreCache.size,
      scoringWeights: this.scoringWeights,
      featureExtractors: Object.keys(this.featureExtractors)
    };
  }

  async cleanup() {
    this.scoreCache.clear();
    this.modelFeatures.clear();
    this.isInitialized = false;
    this.logger.info('ML model scorer cleaned up');
  }
}

export const mlScorer = new MLModelScorer();