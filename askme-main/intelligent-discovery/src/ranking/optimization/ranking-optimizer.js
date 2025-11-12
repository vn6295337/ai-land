import { createLogger } from '../../core/infrastructure/logger.js';
import { embeddingsManager } from '../../core/storage/embeddings.js';
import { qdrantManager } from '../../core/storage/qdrant.js';
import { cacheManager } from '../../core/storage/cache.js';
import { mlScorer } from '../scoring/ml-scorer.js';
import { contextRanker } from '../algorithms/context-ranker.js';
import { preferenceLearner } from '../learning/preference-learner.js';

class RankingOptimizer {
  constructor() {
    this.logger = createLogger({ component: 'ranking-optimizer' });
    this.isInitialized = false;
    this.optimizationHistory = new Map();
    this.performanceMetrics = new Map();
    
    // Optimization strategies and their weights
    this.optimizationStrategies = {
      diversity: {
        weight: 0.2,
        description: 'Ensure result diversity to avoid echo chambers',
        method: this.applyDiversityOptimization.bind(this)
      },
      freshness: {
        weight: 0.15,
        description: 'Boost newer and recently updated models',
        method: this.applyFreshnessOptimization.bind(this)
      },
      personalization: {
        weight: 0.25,
        description: 'Optimize based on user preferences and history',
        method: this.applyPersonalizationOptimization.bind(this)
      },
      performance: {
        weight: 0.2,
        description: 'Optimize based on real-world performance metrics',
        method: this.applyPerformanceOptimization.bind(this)
      },
      fairness: {
        weight: 0.1,
        description: 'Ensure fair representation across providers/models',
        method: this.applyFairnessOptimization.bind(this)
      },
      serendipity: {
        weight: 0.1,
        description: 'Introduce unexpected but potentially valuable results',
        method: this.applySerendipityOptimization.bind(this)
      }
    };
    
    // Optimization parameters
    this.optimizationParams = {
      diversityThreshold: 0.7,        // Minimum diversity score
      maxSimilarResults: 3,           // Maximum similar results in top 10
      freshnessBoostFactor: 1.2,      // Boost factor for fresh content
      personalizationWeight: 0.3,     // Weight for personalization
      fairnessQuota: 0.2,            // Minimum representation per provider
      serendipityRate: 0.05,         // Rate of serendipitous results
      learningRate: 0.1,             // Learning rate for optimization
      performanceWindow: 7 * 24 * 60 * 60 * 1000, // 7 days performance window
    };
    
    // Feedback mechanisms
    this.feedbackTypes = {
      'click_through': { weight: 1.0, description: 'User clicked on result' },
      'selection': { weight: 2.0, description: 'User selected result' },
      'positive_feedback': { weight: 3.0, description: 'User gave positive feedback' },
      'negative_feedback': { weight: -2.0, description: 'User gave negative feedback' },
      'task_completion': { weight: 2.5, description: 'User completed task successfully' },
      'session_duration': { weight: 1.5, description: 'Long session indicates satisfaction' },
      'repeat_usage': { weight: 3.5, description: 'User used same model again' }
    };
  }

  async initialize() {
    try {
      this.logger.info('Initializing ranking optimization system');
      
      // Initialize optimization models
      await this.initializeOptimizationModels();
      
      // Load historical optimization data
      await this.loadOptimizationHistory();
      
      // Initialize performance tracking
      await this.initializePerformanceTracking();
      
      // Setup feedback processing
      await this.setupFeedbackProcessing();
      
      // Initialize A/B testing framework
      await this.initializeABTesting();
      
      this.isInitialized = true;
      this.logger.info('Ranking optimizer initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize ranking optimizer', { error: error.message });
      throw error;
    }
  }

  async optimizeRanking(rankedModels, query, context = {}) {
    if (!this.isInitialized) {
      throw new Error('Ranking optimizer not initialized');
    }

    try {
      this.logger.info('Optimizing ranking results', {
        modelCount: rankedModels.length,
        query: query.substring(0, 100),
        strategies: Object.keys(this.optimizationStrategies)
      });

      // Create optimization context
      const optimizationContext = await this.createOptimizationContext(rankedModels, query, context);
      
      // Apply optimization strategies
      let optimizedRanking = [...rankedModels];
      const optimizationResults = {};
      
      for (const [strategyName, strategy] of Object.entries(this.optimizationStrategies)) {
        try {
          const strategyResult = await strategy.method(optimizedRanking, optimizationContext);
          optimizedRanking = strategyResult.optimizedRanking;
          optimizationResults[strategyName] = strategyResult.metrics;
          
          this.logger.debug(`Applied ${strategyName} optimization`, {
            improvement: strategyResult.metrics.improvement,
            modelsAffected: strategyResult.metrics.modelsAffected
          });
          
        } catch (error) {
          this.logger.warn(`Failed to apply ${strategyName} optimization`, { error: error.message });
          optimizationResults[strategyName] = { error: error.message };
        }
      }
      
      // Apply final ranking adjustments
      const finalRanking = await this.applyFinalAdjustments(optimizedRanking, optimizationContext);
      
      // Add optimization metadata
      const optimizedResults = this.addOptimizationMetadata(finalRanking, optimizationResults, optimizationContext);
      
      // Record optimization for learning
      await this.recordOptimization(query, rankedModels, optimizedResults, optimizationContext);
      
      this.logger.info('Ranking optimization completed', {
        originalCount: rankedModels.length,
        optimizedCount: optimizedResults.length,
        strategiesApplied: Object.keys(optimizationResults).length
      });
      
      return optimizedResults;
      
    } catch (error) {
      this.logger.error('Ranking optimization failed', { error: error.message });
      return rankedModels; // Return original ranking on failure
    }
  }

  async createOptimizationContext(rankedModels, query, context) {
    return {
      query,
      originalRanking: rankedModels,
      userContext: context,
      timestamp: Date.now(),
      sessionId: context.sessionId || this.generateSessionId(),
      userId: context.userId,
      queryEmbedding: await embeddingsManager.generateEmbedding(query),
      modelEmbeddings: await this.getModelEmbeddings(rankedModels),
      userProfile: context.userId ? await preferenceLearner.getUserProfile(context.userId) : null,
      performanceHistory: await this.getPerformanceHistory(rankedModels),
      diversityMatrix: await this.calculateDiversityMatrix(rankedModels),
      optimizationGoals: this.extractOptimizationGoals(context)
    };
  }

  async applyDiversityOptimization(rankedModels, context) {
    try {
      const diversityMatrix = context.diversityMatrix;
      const optimized = [];
      const selectedIds = new Set();
      
      // Select top model first
      if (rankedModels.length > 0) {
        optimized.push(rankedModels[0]);
        selectedIds.add(rankedModels[0].id);
      }
      
      // Select remaining models with diversity constraint
      for (let i = 1; i < rankedModels.length && optimized.length < 20; i++) {
        const candidate = rankedModels[i];
        
        // Calculate diversity score with already selected models
        let diversityScore = 0;
        for (const selected of optimized) {
          const similarity = diversityMatrix.get(`${candidate.id}-${selected.id}`) || 0;
          diversityScore += (1 - similarity);
        }
        diversityScore /= optimized.length;
        
        // Accept if diverse enough or if we need more results
        if (diversityScore >= this.optimizationParams.diversityThreshold || optimized.length < 5) {
          optimized.push({
            ...candidate,
            diversityBoost: diversityScore > this.optimizationParams.diversityThreshold ? 0.1 : 0
          });
          selectedIds.add(candidate.id);
        }
      }
      
      // Add remaining models if needed
      const remaining = rankedModels.filter(m => !selectedIds.has(m.id));
      optimized.push(...remaining);
      
      return {
        optimizedRanking: optimized,
        metrics: {
          improvement: (optimized.length - rankedModels.filter((_, i) => i < optimized.length && optimized[i].id === rankedModels[i].id).length) / rankedModels.length,
          modelsAffected: rankedModels.length - optimized.filter((m, i) => i < rankedModels.length && m.id === rankedModels[i].id).length,
          averageDiversity: this.calculateAverageDiversity(optimized, diversityMatrix)
        }
      };
      
    } catch (error) {
      this.logger.warn('Diversity optimization failed', { error: error.message });
      return { optimizedRanking: rankedModels, metrics: { error: error.message } };
    }
  }

  async applyFreshnessOptimization(rankedModels, context) {
    try {
      const now = Date.now();
      const optimized = rankedModels.map(model => {
        const modelAge = now - (model.updatedAt || model.createdAt || now - 365 * 24 * 60 * 60 * 1000);
        const ageInDays = modelAge / (24 * 60 * 60 * 1000);
        
        // Fresh models (< 30 days) get a boost
        let freshnessBoost = 0;
        if (ageInDays < 30) {
          freshnessBoost = (30 - ageInDays) / 30 * 0.1;
        }
        
        // Recently updated models get additional boost
        if (model.lastUpdate && (now - model.lastUpdate) < 7 * 24 * 60 * 60 * 1000) {
          freshnessBoost += 0.05;
        }
        
        return {
          ...model,
          freshnessBoost,
          adjustedScore: (model.scores?.combined?.score || 0.5) + freshnessBoost
        };
      });
      
      // Re-sort by adjusted score
      optimized.sort((a, b) => (b.adjustedScore || 0) - (a.adjustedScore || 0));
      
      return {
        optimizedRanking: optimized,
        metrics: {
          improvement: optimized.filter(m => m.freshnessBoost > 0).length / rankedModels.length,
          modelsAffected: optimized.filter(m => m.freshnessBoost > 0).length,
          averageFreshnessBoost: optimized.reduce((sum, m) => sum + (m.freshnessBoost || 0), 0) / optimized.length
        }
      };
      
    } catch (error) {
      this.logger.warn('Freshness optimization failed', { error: error.message });
      return { optimizedRanking: rankedModels, metrics: { error: error.message } };
    }
  }

  async applyPersonalizationOptimization(rankedModels, context) {
    try {
      if (!context.userProfile || !context.userId) {
        return { optimizedRanking: rankedModels, metrics: { skipped: 'No user profile available' } };
      }
      
      const optimized = [];
      
      for (const model of rankedModels) {
        // Get user preference prediction for this model
        const preferenceScore = await preferenceLearner.predictUserPreference(
          context.userId,
          model.id,
          { query: context.query }
        );
        
        // Apply personalization boost
        const personalizationBoost = (preferenceScore.score - 0.5) * this.optimizationParams.personalizationWeight;
        
        optimized.push({
          ...model,
          personalizationBoost,
          preferenceScore: preferenceScore.score,
          preferenceConfidence: preferenceScore.confidence,
          adjustedScore: (model.scores?.combined?.score || 0.5) + personalizationBoost
        });
      }
      
      // Re-sort by adjusted score
      optimized.sort((a, b) => (b.adjustedScore || 0) - (a.adjustedScore || 0));
      
      return {
        optimizedRanking: optimized,
        metrics: {
          improvement: optimized.filter(m => m.personalizationBoost > 0).length / rankedModels.length,
          modelsAffected: optimized.length,
          averagePersonalizationBoost: optimized.reduce((sum, m) => sum + Math.abs(m.personalizationBoost || 0), 0) / optimized.length,
          userProfileConfidence: context.userProfile.confidence
        }
      };
      
    } catch (error) {
      this.logger.warn('Personalization optimization failed', { error: error.message });
      return { optimizedRanking: rankedModels, metrics: { error: error.message } };
    }
  }

  async applyPerformanceOptimization(rankedModels, context) {
    try {
      const performanceWindow = Date.now() - this.optimizationParams.performanceWindow;
      const optimized = [];
      
      for (const model of rankedModels) {
        // Get recent performance metrics
        const recentPerformance = context.performanceHistory.get(model.id) || { score: 0.5, samples: 0 };
        
        // Apply performance boost based on recent performance
        let performanceBoost = 0;
        if (recentPerformance.samples >= 10) { // Minimum sample size
          performanceBoost = (recentPerformance.score - 0.5) * 0.15;
        }
        
        // Penalty for poor recent performance
        if (recentPerformance.score < 0.3 && recentPerformance.samples >= 5) {
          performanceBoost = -0.1;
        }
        
        optimized.push({
          ...model,
          performanceBoost,
          recentPerformance: recentPerformance.score,
          performanceSamples: recentPerformance.samples,
          adjustedScore: (model.scores?.combined?.score || 0.5) + performanceBoost
        });
      }
      
      // Re-sort by adjusted score
      optimized.sort((a, b) => (b.adjustedScore || 0) - (a.adjustedScore || 0));
      
      return {
        optimizedRanking: optimized,
        metrics: {
          improvement: optimized.filter(m => m.performanceBoost > 0).length / rankedModels.length,
          modelsAffected: optimized.filter(m => Math.abs(m.performanceBoost || 0) > 0.01).length,
          averagePerformanceBoost: optimized.reduce((sum, m) => sum + (m.performanceBoost || 0), 0) / optimized.length
        }
      };
      
    } catch (error) {
      this.logger.warn('Performance optimization failed', { error: error.message });
      return { optimizedRanking: rankedModels, metrics: { error: error.message } };
    }
  }

  async applyFairnessOptimization(rankedModels, context) {
    try {
      // Group models by provider
      const providerGroups = {};
      rankedModels.forEach(model => {
        const provider = model.provider || 'unknown';
        if (!providerGroups[provider]) {
          providerGroups[provider] = [];
        }
        providerGroups[provider].push(model);
      });
      
      // Calculate fair representation
      const providers = Object.keys(providerGroups);
      const minRepresentation = Math.max(1, Math.floor(rankedModels.length * this.optimizationParams.fairnessQuota / providers.length));
      
      const optimized = [];
      const providerCounts = {};
      
      // First pass: maintain top performers while ensuring minimum representation
      for (const model of rankedModels) {
        const provider = model.provider || 'unknown';
        const currentCount = providerCounts[provider] || 0;
        
        // Include if it's a top performer or if provider needs representation
        if (optimized.length < rankedModels.length * 0.3 || currentCount < minRepresentation) {
          optimized.push({
            ...model,
            fairnessBoost: currentCount < minRepresentation ? 0.05 : 0
          });
          providerCounts[provider] = currentCount + 1;
        }
      }
      
      // Second pass: add remaining models
      const remainingModels = rankedModels.filter(m => !optimized.find(opt => opt.id === m.id));
      optimized.push(...remainingModels.map(m => ({ ...m, fairnessBoost: 0 })));
      
      return {
        optimizedRanking: optimized,
        metrics: {
          improvement: providers.length / rankedModels.length, // Diversity improvement
          modelsAffected: optimized.filter(m => m.fairnessBoost > 0).length,
          providerDistribution: providerCounts,
          fairnessScore: this.calculateFairnessScore(providerCounts)
        }
      };
      
    } catch (error) {
      this.logger.warn('Fairness optimization failed', { error: error.message });
      return { optimizedRanking: rankedModels, metrics: { error: error.message } };
    }
  }

  async applySerendipityOptimization(rankedModels, context) {
    try {
      if (rankedModels.length < 10) {
        return { optimizedRanking: rankedModels, metrics: { skipped: 'Not enough models for serendipity' } };
      }
      
      const serendipityCount = Math.floor(rankedModels.length * this.optimizationParams.serendipityRate);
      const optimized = [...rankedModels];
      
      // Identify potential serendipitous results (lower ranked but potentially interesting)
      const candidates = rankedModels.slice(Math.floor(rankedModels.length * 0.5)); // Bottom 50%
      const serendipitousModels = this.selectSerendipitousModels(candidates, serendipityCount, context);
      
      // Insert serendipitous models at strategic positions
      serendipitousModels.forEach((model, index) => {
        const insertPosition = Math.min(10 + index * 3, optimized.length - 1);
        
        // Remove from current position
        const currentIndex = optimized.findIndex(m => m.id === model.id);
        if (currentIndex > insertPosition) {
          optimized.splice(currentIndex, 1);
          optimized.splice(insertPosition, 0, {
            ...model,
            serendipityBoost: 0.1,
            serendipityReason: 'Potentially interesting alternative'
          });
        }
      });
      
      return {
        optimizedRanking: optimized,
        metrics: {
          improvement: serendipitousModels.length / rankedModels.length,
          modelsAffected: serendipitousModels.length,
          serendipityRate: serendipitousModels.length / rankedModels.length
        }
      };
      
    } catch (error) {
      this.logger.warn('Serendipity optimization failed', { error: error.message });
      return { optimizedRanking: rankedModels, metrics: { error: error.message } };
    }
  }

  async applyFinalAdjustments(optimizedRanking, context) {
    // Apply any final adjustments based on business rules or constraints
    let finalRanking = [...optimizedRanking];
    
    // Ensure minimum quality threshold
    finalRanking = finalRanking.filter(model => 
      (model.adjustedScore || model.scores?.combined?.score || 0.5) >= 0.2
    );
    
    // Limit results if requested
    if (context.userContext.limit) {
      finalRanking = finalRanking.slice(0, context.userContext.limit);
    }
    
    // Re-calculate final positions
    finalRanking.forEach((model, index) => {
      model.finalPosition = index + 1;
      model.positionChange = (model.originalPosition || index + 1) - (index + 1);
    });
    
    return finalRanking;
  }

  addOptimizationMetadata(optimizedResults, optimizationResults, context) {
    return optimizedResults.map((model, index) => ({
      ...model,
      optimization: {
        strategies: Object.keys(optimizationResults),
        totalBoost: (model.diversityBoost || 0) + 
                   (model.freshnessBoost || 0) + 
                   (model.personalizationBoost || 0) + 
                   (model.performanceBoost || 0) + 
                   (model.fairnessBoost || 0) + 
                   (model.serendipityBoost || 0),
        optimizationScore: model.adjustedScore || model.scores?.combined?.score || 0.5,
        positionChange: model.positionChange || 0,
        optimizationContext: {
          sessionId: context.sessionId,
          timestamp: context.timestamp,
          hasUserProfile: !!context.userProfile
        }
      }
    }));
  }

  async recordOptimization(query, originalRanking, optimizedRanking, context) {
    try {
      const optimizationRecord = {
        query,
        timestamp: Date.now(),
        sessionId: context.sessionId,
        userId: context.userId,
        originalRanking: originalRanking.slice(0, 10).map(m => ({ id: m.id, position: m.position })),
        optimizedRanking: optimizedRanking.slice(0, 10).map(m => ({ id: m.id, position: m.finalPosition })),
        optimizationMetrics: this.calculateOptimizationMetrics(originalRanking, optimizedRanking),
        context: {
          hasUserProfile: !!context.userProfile,
          strategiesApplied: Object.keys(this.optimizationStrategies)
        }
      };
      
      // Store in optimization history
      this.optimizationHistory.set(context.sessionId, optimizationRecord);
      
      // Store in vector database for analysis
      await qdrantManager.upsert('optimization_history', [{
        id: context.sessionId,
        vector: context.queryEmbedding,
        payload: optimizationRecord
      }]);
      
    } catch (error) {
      this.logger.warn('Failed to record optimization', { error: error.message });
    }
  }

  async processFeedback(sessionId, modelId, feedbackType, feedbackData = {}) {
    try {
      if (!this.feedbackTypes[feedbackType]) {
        throw new Error(`Unknown feedback type: ${feedbackType}`);
      }
      
      const weight = this.feedbackTypes[feedbackType].weight;
      const optimization = this.optimizationHistory.get(sessionId);
      
      if (optimization) {
        // Update optimization performance metrics
        await this.updateOptimizationPerformance(optimization, modelId, weight, feedbackData);
        
        // Learn from feedback for future optimizations
        await this.learnFromFeedback(optimization, modelId, feedbackType, feedbackData);
      }
      
      // Update model performance metrics
      await this.updateModelPerformance(modelId, weight, feedbackData);
      
      this.logger.debug('Processed optimization feedback', {
        sessionId,
        modelId,
        feedbackType,
        weight
      });
      
    } catch (error) {
      this.logger.error('Failed to process feedback', { sessionId, modelId, feedbackType, error: error.message });
    }
  }

  // Helper methods
  async getModelEmbeddings(models) {
    const embeddings = new Map();
    
    for (const model of models.slice(0, 50)) { // Limit for performance
      try {
        const text = `${model.name} ${model.description || ''} ${model.tags?.join(' ') || ''}`;
        const embedding = await embeddingsManager.generateEmbedding(text);
        embeddings.set(model.id, embedding);
      } catch (error) {
        this.logger.warn('Failed to get model embedding', { modelId: model.id, error: error.message });
      }
    }
    
    return embeddings;
  }

  async calculateDiversityMatrix(models) {
    const matrix = new Map();
    const embeddings = await this.getModelEmbeddings(models);
    
    for (const model1 of models) {
      for (const model2 of models) {
        if (model1.id !== model2.id) {
          const embedding1 = embeddings.get(model1.id);
          const embedding2 = embeddings.get(model2.id);
          
          if (embedding1 && embedding2) {
            const similarity = await this.calculateCosineSimilarity(embedding1, embedding2);
            matrix.set(`${model1.id}-${model2.id}`, similarity);
          }
        }
      }
    }
    
    return matrix;
  }

  async calculateCosineSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  calculateAverageDiversity(models, diversityMatrix) {
    if (models.length < 2) return 1;
    
    let totalDiversity = 0;
    let pairCount = 0;
    
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        const similarity = diversityMatrix.get(`${models[i].id}-${models[j].id}`) || 0;
        totalDiversity += (1 - similarity);
        pairCount++;
      }
    }
    
    return pairCount > 0 ? totalDiversity / pairCount : 1;
  }

  selectSerendipitousModels(candidates, count, context) {
    // Select models that are different from the query but potentially interesting
    const selected = [];
    
    // Prioritize models with unique characteristics
    const uniqueModels = candidates.filter(model => {
      return model.tags && model.tags.length > 0 && 
             model.tags.some(tag => !context.query.toLowerCase().includes(tag.toLowerCase()));
    });
    
    // Select diverse candidates
    for (let i = 0; i < Math.min(count, uniqueModels.length); i++) {
      selected.push(uniqueModels[i]);
    }
    
    return selected;
  }

  calculateFairnessScore(providerCounts) {
    const counts = Object.values(providerCounts);
    if (counts.length === 0) return 0;
    
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
    
    // Lower variance = higher fairness
    return Math.max(0, 1 - (variance / mean));
  }

  calculateOptimizationMetrics(originalRanking, optimizedRanking) {
    const topK = Math.min(10, originalRanking.length);
    const originalTop = new Set(originalRanking.slice(0, topK).map(m => m.id));
    const optimizedTop = new Set(optimizedRanking.slice(0, topK).map(m => m.id));
    
    const intersection = new Set([...originalTop].filter(id => optimizedTop.has(id)));
    const stability = intersection.size / topK;
    
    return {
      stability,
      topKChanged: topK - intersection.size,
      totalPositionChanges: optimizedRanking.reduce((sum, model) => sum + Math.abs(model.positionChange || 0), 0)
    };
  }

  generateSessionId() {
    return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  extractOptimizationGoals(context) {
    const goals = ['relevance']; // Default goal
    
    if (context.userId) goals.push('personalization');
    if (context.diversityPreference) goals.push('diversity');
    if (context.performanceFocus) goals.push('performance');
    
    return goals;
  }

  // Placeholder methods for complex operations
  async initializeOptimizationModels() { /* Implementation details */ }
  async loadOptimizationHistory() { /* Implementation details */ }
  async initializePerformanceTracking() { /* Implementation details */ }
  async setupFeedbackProcessing() { /* Implementation details */ }
  async initializeABTesting() { /* Implementation details */ }
  async getPerformanceHistory(models) { 
    const history = new Map();
    models.forEach(model => {
      history.set(model.id, { score: 0.7 + Math.random() * 0.3, samples: Math.floor(Math.random() * 100) });
    });
    return history;
  }
  async updateOptimizationPerformance(optimization, modelId, weight, feedbackData) { /* Implementation details */ }
  async learnFromFeedback(optimization, modelId, feedbackType, feedbackData) { /* Implementation details */ }
  async updateModelPerformance(modelId, weight, feedbackData) { /* Implementation details */ }

  getStats() {
    return {
      initialized: this.isInitialized,
      optimizationHistory: this.optimizationHistory.size,
      performanceMetrics: this.performanceMetrics.size,
      strategies: Object.keys(this.optimizationStrategies),
      feedbackTypes: Object.keys(this.feedbackTypes)
    };
  }

  async cleanup() {
    this.optimizationHistory.clear();
    this.performanceMetrics.clear();
    this.isInitialized = false;
    this.logger.info('Ranking optimizer cleaned up');
  }
}

export const rankingOptimizer = new RankingOptimizer();