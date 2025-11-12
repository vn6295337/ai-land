import { createLogger } from '../../core/infrastructure/logger.js';
import { embeddingsManager } from '../../core/storage/embeddings.js';
import { qdrantManager } from '../../core/storage/qdrant.js';
import { cacheManager } from '../../core/storage/cache.js';
import { mlScorer } from '../scoring/ml-scorer.js';

class ContextAwareRanker {
  constructor() {
    this.logger = createLogger({ component: 'context-ranker' });
    this.isInitialized = false;
    this.rankingCache = new Map();
    
    // Context types and their importance weights
    this.contextTypes = {
      semantic: 0.3,        // Semantic similarity to query
      domain: 0.25,         // Domain-specific relevance
      task: 0.2,           // Task-specific suitability
      user: 0.15,          // User preference alignment
      temporal: 0.1        // Temporal relevance (recency, trends)
    };
    
    // Ranking algorithms for different contexts
    this.rankingAlgorithms = {
      semantic: this.semanticRanking.bind(this),
      domain: this.domainSpecificRanking.bind(this),
      task: this.taskBasedRanking.bind(this),
      user: this.userPreferenceRanking.bind(this),
      temporal: this.temporalRanking.bind(this)
    };
    
    // Context feature extractors
    this.contextFeatures = new Map();
  }

  async initialize() {
    try {
      this.logger.info('Initializing context-aware ranking system');
      
      // Initialize context analyzers
      await this.initializeContextAnalyzers();
      
      // Load domain-specific ranking models
      await this.loadDomainModels();
      
      // Initialize user preference models
      await this.initializeUserModels();
      
      // Load temporal trend data
      await this.loadTemporalData();
      
      this.isInitialized = true;
      this.logger.info('Context-aware ranker initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize context-aware ranker', { error: error.message });
      throw error;
    }
  }

  async rankModels(models, query, context = {}) {
    if (!this.isInitialized) {
      throw new Error('Context ranker not initialized');
    }

    try {
      this.logger.info('Ranking models with context awareness', {
        modelCount: models.length,
        query: query.substring(0, 100),
        contextTypes: Object.keys(context)
      });

      // Generate cache key
      const cacheKey = this.generateCacheKey(models, query, context);
      const cached = await cacheManager.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Extract query context features
      const queryContext = await this.extractQueryContext(query, context);
      
      // Calculate contextual scores for each model
      const scoredModels = await this.calculateContextualScores(models, queryContext);
      
      // Apply multi-dimensional ranking
      const rankedModels = await this.applyMultiDimensionalRanking(scoredModels, queryContext);
      
      // Apply final optimizations
      const optimizedRanking = await this.optimizeRanking(rankedModels, queryContext);
      
      // Cache results
      await cacheManager.set(cacheKey, optimizedRanking, 1800); // 30 minutes
      
      this.logger.info('Context-aware ranking completed', {
        rankedCount: optimizedRanking.length,
        topModel: optimizedRanking[0]?.modelId
      });
      
      return optimizedRanking;
      
    } catch (error) {
      this.logger.error('Context-aware ranking failed', { error: error.message });
      throw error;
    }
  }

  async extractQueryContext(query, providedContext) {
    const context = {
      query,
      timestamp: Date.now(),
      ...providedContext
    };

    // Extract semantic context
    context.semanticEmbedding = await embeddingsManager.generateEmbedding(query);
    context.semanticKeywords = this.extractKeywords(query);
    
    // Extract domain context
    context.detectedDomain = await this.detectDomain(query);
    context.domainConfidence = await this.calculateDomainConfidence(query, context.detectedDomain);
    
    // Extract task context
    context.taskType = await this.detectTaskType(query);
    context.taskComplexity = await this.assessTaskComplexity(query);
    
    // Extract intent context
    context.userIntent = await this.extractUserIntent(query);
    context.urgencyLevel = await this.assessUrgency(query, providedContext);
    
    // Extract technical context
    context.technicalRequirements = await this.extractTechnicalRequirements(query);
    context.performanceRequirements = await this.extractPerformanceRequirements(query);
    
    return context;
  }

  async calculateContextualScores(models, queryContext) {
    const scoredModels = [];
    
    for (const model of models) {
      try {
        // Get base ML score
        const baseScore = await mlScorer.scoreModel(model.id, queryContext);
        
        // Calculate context-specific scores
        const contextScores = {};
        for (const [contextType, algorithm] of Object.entries(this.rankingAlgorithms)) {
          contextScores[contextType] = await algorithm(model, queryContext);
        }
        
        // Combine scores
        const combinedScore = this.combineContextualScores(baseScore, contextScores);
        
        scoredModels.push({
          ...model,
          scores: {
            base: baseScore,
            contextual: contextScores,
            combined: combinedScore
          }
        });
        
      } catch (error) {
        this.logger.warn('Failed to score model', { modelId: model.id, error: error.message });
        scoredModels.push({
          ...model,
          scores: {
            base: { score: 0, confidence: 0 },
            contextual: {},
            combined: { score: 0, confidence: 0 }
          }
        });
      }
    }
    
    return scoredModels;
  }

  async semanticRanking(model, queryContext) {
    try {
      // Get model embedding
      const modelEmbedding = await embeddingsManager.generateEmbedding(
        `${model.name} ${model.description || ''} ${model.tags?.join(' ') || ''}`
      );
      
      // Calculate semantic similarity
      const similarity = await this.calculateCosineSimilarity(
        queryContext.semanticEmbedding,
        modelEmbedding
      );
      
      // Consider keyword overlap
      const keywordOverlap = this.calculateKeywordOverlap(
        queryContext.semanticKeywords,
        model.tags || []
      );
      
      return {
        similarity,
        keywordOverlap,
        score: similarity * 0.7 + keywordOverlap * 0.3,
        confidence: 0.9
      };
      
    } catch (error) {
      this.logger.warn('Semantic ranking failed', { modelId: model.id, error: error.message });
      return { score: 0.5, confidence: 0.1 };
    }
  }

  async domainSpecificRanking(model, queryContext) {
    try {
      const modelDomain = await this.detectModelDomain(model);
      const domainMatch = modelDomain === queryContext.detectedDomain ? 1.0 : 0.3;
      
      // Consider domain expertise
      const domainExpertise = await this.assessDomainExpertise(model, queryContext.detectedDomain);
      
      // Consider domain-specific performance
      const domainPerformance = await this.getDomainPerformance(model.id, queryContext.detectedDomain);
      
      return {
        domainMatch,
        expertise: domainExpertise,
        performance: domainPerformance,
        score: domainMatch * 0.4 + domainExpertise * 0.3 + domainPerformance * 0.3,
        confidence: queryContext.domainConfidence
      };
      
    } catch (error) {
      this.logger.warn('Domain ranking failed', { modelId: model.id, error: error.message });
      return { score: 0.5, confidence: 0.1 };
    }
  }

  async taskBasedRanking(model, queryContext) {
    try {
      // Assess task suitability
      const taskSuitability = await this.assessTaskSuitability(model, queryContext.taskType);
      
      // Consider complexity handling
      const complexityFit = await this.assessComplexityFit(model, queryContext.taskComplexity);
      
      // Consider task-specific performance
      const taskPerformance = await this.getTaskPerformance(model.id, queryContext.taskType);
      
      return {
        suitability: taskSuitability,
        complexityFit,
        performance: taskPerformance,
        score: taskSuitability * 0.4 + complexityFit * 0.3 + taskPerformance * 0.3,
        confidence: 0.8
      };
      
    } catch (error) {
      this.logger.warn('Task ranking failed', { modelId: model.id, error: error.message });
      return { score: 0.5, confidence: 0.1 };
    }
  }

  async userPreferenceRanking(model, queryContext) {
    try {
      if (!queryContext.userId) {
        return { score: 0.5, confidence: 0.1 };
      }
      
      // Get user preference profile
      const userProfile = await this.getUserProfile(queryContext.userId);
      
      // Calculate preference alignment
      const preferenceAlignment = await this.calculatePreferenceAlignment(model, userProfile);
      
      // Consider historical usage
      const usageHistory = await this.getUserModelHistory(queryContext.userId, model.id);
      
      // Consider feedback scores
      const userFeedback = await this.getUserFeedback(queryContext.userId, model.id);
      
      return {
        alignment: preferenceAlignment,
        history: usageHistory,
        feedback: userFeedback,
        score: preferenceAlignment * 0.5 + usageHistory * 0.2 + userFeedback * 0.3,
        confidence: userProfile.confidence || 0.5
      };
      
    } catch (error) {
      this.logger.warn('User preference ranking failed', { modelId: model.id, error: error.message });
      return { score: 0.5, confidence: 0.1 };
    }
  }

  async temporalRanking(model, queryContext) {
    try {
      // Consider model recency
      const recency = this.calculateRecency(model.createdAt || model.updatedAt);
      
      // Consider trending status
      const trendingScore = await this.getTrendingScore(model.id);
      
      // Consider maintenance activity
      const maintenanceScore = await this.getMaintenanceScore(model.id);
      
      // Consider version freshness
      const versionFreshness = await this.getVersionFreshness(model.id);
      
      return {
        recency,
        trending: trendingScore,
        maintenance: maintenanceScore,
        freshness: versionFreshness,
        score: recency * 0.3 + trendingScore * 0.3 + maintenanceScore * 0.2 + versionFreshness * 0.2,
        confidence: 0.7
      };
      
    } catch (error) {
      this.logger.warn('Temporal ranking failed', { modelId: model.id, error: error.message });
      return { score: 0.5, confidence: 0.1 };
    }
  }

  combineContextualScores(baseScore, contextScores) {
    let totalScore = baseScore.score * 0.3; // Base ML score weight
    let totalWeight = 0.3;
    
    // Add contextual scores with their weights
    for (const [contextType, weight] of Object.entries(this.contextTypes)) {
      if (contextScores[contextType]) {
        totalScore += contextScores[contextType].score * weight;
        totalWeight += weight;
      }
    }
    
    // Calculate combined confidence
    const confidences = [baseScore.confidence];
    Object.values(contextScores).forEach(score => {
      if (score.confidence !== undefined) {
        confidences.push(score.confidence);
      }
    });
    
    const combinedConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    
    return {
      score: totalWeight > 0 ? totalScore / totalWeight : 0,
      confidence: combinedConfidence,
      breakdown: {
        base: baseScore,
        contextual: contextScores
      }
    };
  }

  async applyMultiDimensionalRanking(scoredModels, queryContext) {
    // Sort by combined score
    const ranked = scoredModels.sort((a, b) => {
      const scoreA = a.scores.combined.score * a.scores.combined.confidence;
      const scoreB = b.scores.combined.score * b.scores.combined.confidence;
      return scoreB - scoreA;
    });
    
    // Apply diversity filtering to avoid too similar results
    const diversified = await this.applyDiversityFiltering(ranked, queryContext);
    
    return diversified;
  }

  async optimizeRanking(rankedModels, queryContext) {
    // Apply final optimizations
    let optimized = [...rankedModels];
    
    // Boost highly relevant models
    optimized = await this.boostHighRelevance(optimized, queryContext);
    
    // Apply fairness constraints
    optimized = await this.applyFairnessConstraints(optimized);
    
    // Add ranking metadata
    optimized = optimized.map((model, index) => ({
      ...model,
      ranking: {
        position: index + 1,
        score: model.scores.combined.score,
        confidence: model.scores.combined.confidence,
        reasoning: this.generateRankingReasoning(model, queryContext)
      }
    }));
    
    return optimized;
  }

  // Helper methods
  extractKeywords(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 10);
  }

  async detectDomain(query) {
    // Simple domain detection - could be enhanced with ML
    const domainKeywords = {
      'code': ['code', 'programming', 'development', 'software', 'algorithm'],
      'text': ['text', 'writing', 'content', 'article', 'document'],
      'chat': ['chat', 'conversation', 'dialogue', 'talk', 'discuss'],
      'analysis': ['analyze', 'analysis', 'data', 'research', 'study'],
      'creative': ['creative', 'story', 'poem', 'fiction', 'art']
    };
    
    const queryLower = query.toLowerCase();
    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some(keyword => queryLower.includes(keyword))) {
        return domain;
      }
    }
    
    return 'general';
  }

  async calculateDomainConfidence(query, domain) {
    // Calculate confidence in domain detection
    return 0.8; // Simplified
  }

  async detectTaskType(query) {
    // Detect task type from query
    const taskPatterns = {
      'generation': /generate|create|write|produce/i,
      'analysis': /analyze|examine|study|review/i,
      'question': /what|how|why|when|where/i,
      'translation': /translate|convert|transform/i,
      'summarization': /summarize|summary|brief/i
    };
    
    for (const [task, pattern] of Object.entries(taskPatterns)) {
      if (pattern.test(query)) {
        return task;
      }
    }
    
    return 'general';
  }

  async assessTaskComplexity(query) {
    // Simple complexity assessment
    const length = query.length;
    const sentences = query.split(/[.!?]+/).length;
    const complexity = Math.min(1, (length / 200 + sentences / 5) / 2);
    return complexity;
  }

  async extractUserIntent(query) {
    // Extract user intent from query
    return 'informational'; // Simplified
  }

  async assessUrgency(query, context) {
    // Assess urgency from query and context
    const urgentWords = ['urgent', 'asap', 'quickly', 'immediate', 'now'];
    const hasUrgent = urgentWords.some(word => 
      query.toLowerCase().includes(word)
    );
    return hasUrgent ? 0.9 : 0.5;
  }

  async extractTechnicalRequirements(query) {
    // Extract technical requirements
    return {};
  }

  async extractPerformanceRequirements(query) {
    // Extract performance requirements
    return {};
  }

  calculateKeywordOverlap(keywords1, keywords2) {
    const set1 = new Set(keywords1.map(k => k.toLowerCase()));
    const set2 = new Set(keywords2.map(k => k.toLowerCase()));
    const intersection = new Set([...set1].filter(k => set2.has(k)));
    const union = new Set([...set1, ...set2]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  async calculateCosineSimilarity(embedding1, embedding2) {
    // Calculate cosine similarity between embeddings
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

  generateCacheKey(models, query, context) {
    const modelIds = models.map(m => m.id).sort().join(',');
    const contextStr = JSON.stringify(context);
    return `context_ranking:${Buffer.from(query + modelIds + contextStr).toString('base64').slice(0, 50)}`;
  }

  generateRankingReasoning(model, queryContext) {
    // Generate human-readable reasoning for the ranking
    return `Ranked based on semantic similarity, domain expertise, and contextual relevance`;
  }

  // Placeholder methods for complex operations
  async initializeContextAnalyzers() { /* Implementation details */ }
  async loadDomainModels() { /* Implementation details */ }
  async initializeUserModels() { /* Implementation details */ }
  async loadTemporalData() { /* Implementation details */ }
  async detectModelDomain(model) { return 'general'; }
  async assessDomainExpertise(model, domain) { return 0.7; }
  async getDomainPerformance(modelId, domain) { return 0.8; }
  async assessTaskSuitability(model, taskType) { return 0.7; }
  async assessComplexityFit(model, complexity) { return 0.8; }
  async getTaskPerformance(modelId, taskType) { return 0.7; }
  async getUserProfile(userId) { return { confidence: 0.5 }; }
  async calculatePreferenceAlignment(model, profile) { return 0.6; }
  async getUserModelHistory(userId, modelId) { return 0.5; }
  async getUserFeedback(userId, modelId) { return 0.5; }
  calculateRecency(date) { return 0.8; }
  async getTrendingScore(modelId) { return 0.6; }
  async getMaintenanceScore(modelId) { return 0.7; }
  async getVersionFreshness(modelId) { return 0.8; }
  async applyDiversityFiltering(models, context) { return models; }
  async boostHighRelevance(models, context) { return models; }
  async applyFairnessConstraints(models) { return models; }

  getStats() {
    return {
      initialized: this.isInitialized,
      cacheSize: this.rankingCache.size,
      contextTypes: Object.keys(this.contextTypes),
      algorithms: Object.keys(this.rankingAlgorithms)
    };
  }

  async cleanup() {
    this.rankingCache.clear();
    this.contextFeatures.clear();
    this.isInitialized = false;
    this.logger.info('Context-aware ranker cleaned up');
  }
}

export const contextRanker = new ContextAwareRanker();