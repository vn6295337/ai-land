import { createLogger } from '../../core/infrastructure/logger.js';
import { embeddingsManager } from '../../core/storage/embeddings.js';
import { qdrantManager } from '../../core/storage/qdrant.js';
import { cacheManager } from '../../core/storage/cache.js';
import { mlScorer } from '../scoring/ml-scorer.js';

class DomainSpecificRanker {
  constructor() {
    this.logger = createLogger({ component: 'domain-ranker' });
    this.isInitialized = false;
    this.domainModels = new Map();
    this.domainEmbeddings = new Map();
    
    // Domain-specific ranking models and their characteristics
    this.domains = {
      'code-generation': {
        name: 'Code Generation',
        keywords: ['code', 'programming', 'development', 'algorithm', 'function', 'class', 'variable'],
        modelTypes: ['code-generation', 'programming-assistant', 'developer-tool'],
        qualityMetrics: ['code_correctness', 'syntax_accuracy', 'optimization', 'readability'],
        performanceWeights: { accuracy: 0.4, efficiency: 0.3, maintainability: 0.2, innovation: 0.1 },
        expertiseFactors: ['language_support', 'framework_knowledge', 'best_practices', 'debugging_capability']
      },
      'creative-writing': {
        name: 'Creative Writing',
        keywords: ['story', 'creative', 'narrative', 'fiction', 'poetry', 'literature', 'artistic'],
        modelTypes: ['text-generation', 'creative-assistant', 'storytelling'],
        qualityMetrics: ['creativity', 'coherence', 'style', 'originality'],
        performanceWeights: { creativity: 0.4, coherence: 0.25, style: 0.2, engagement: 0.15 },
        expertiseFactors: ['genre_knowledge', 'writing_techniques', 'character_development', 'plot_structure']
      },
      'data-analysis': {
        name: 'Data Analysis',
        keywords: ['data', 'analysis', 'statistics', 'visualization', 'insights', 'metrics', 'analytics'],
        modelTypes: ['analytical', 'data-science', 'statistical'],
        qualityMetrics: ['accuracy', 'insight_quality', 'statistical_validity', 'interpretation'],
        performanceWeights: { accuracy: 0.35, insight_depth: 0.25, methodology: 0.2, clarity: 0.2 },
        expertiseFactors: ['statistical_knowledge', 'tool_proficiency', 'domain_expertise', 'visualization_skills']
      },
      'conversational': {
        name: 'Conversational AI',
        keywords: ['chat', 'conversation', 'dialogue', 'assistant', 'help', 'support', 'interaction'],
        modelTypes: ['chat', 'conversational', 'assistant'],
        qualityMetrics: ['helpfulness', 'empathy', 'context_awareness', 'response_quality'],
        performanceWeights: { helpfulness: 0.3, empathy: 0.25, context_retention: 0.25, responsiveness: 0.2 },
        expertiseFactors: ['conversational_skills', 'emotional_intelligence', 'knowledge_breadth', 'personalization']
      },
      'research-analysis': {
        name: 'Research & Analysis',
        keywords: ['research', 'academic', 'analysis', 'study', 'investigation', 'evidence', 'scholarly'],
        modelTypes: ['research-assistant', 'analytical', 'academic'],
        qualityMetrics: ['factual_accuracy', 'depth', 'citation_quality', 'methodology'],
        performanceWeights: { accuracy: 0.35, depth: 0.25, methodology: 0.2, objectivity: 0.2 },
        expertiseFactors: ['research_methods', 'domain_knowledge', 'critical_thinking', 'source_evaluation']
      },
      'business-strategy': {
        name: 'Business Strategy',
        keywords: ['business', 'strategy', 'management', 'planning', 'analysis', 'decision', 'market'],
        modelTypes: ['business-assistant', 'strategic', 'analytical'],
        qualityMetrics: ['strategic_insight', 'practicality', 'market_awareness', 'roi_consideration'],
        performanceWeights: { strategic_value: 0.3, practicality: 0.25, market_insight: 0.25, roi: 0.2 },
        expertiseFactors: ['business_acumen', 'industry_knowledge', 'analytical_skills', 'strategic_thinking']
      },
      'technical-documentation': {
        name: 'Technical Documentation',
        keywords: ['documentation', 'technical', 'manual', 'guide', 'tutorial', 'specification', 'api'],
        modelTypes: ['documentation', 'technical-writer', 'instructional'],
        qualityMetrics: ['clarity', 'completeness', 'accuracy', 'usability'],
        performanceWeights: { clarity: 0.3, completeness: 0.25, accuracy: 0.25, structure: 0.2 },
        expertiseFactors: ['technical_writing', 'domain_expertise', 'user_experience', 'information_architecture']
      },
      'scientific-research': {
        name: 'Scientific Research',
        keywords: ['science', 'research', 'experiment', 'hypothesis', 'methodology', 'peer-review', 'publication'],
        modelTypes: ['scientific', 'research-assistant', 'academic'],
        qualityMetrics: ['scientific_rigor', 'methodology', 'accuracy', 'innovation'],
        performanceWeights: { rigor: 0.35, methodology: 0.25, accuracy: 0.25, innovation: 0.15 },
        expertiseFactors: ['scientific_method', 'domain_expertise', 'statistical_analysis', 'literature_review']
      }
    };
    
    // Domain detection patterns
    this.domainPatterns = this.buildDomainPatterns();
  }

  async initialize() {
    try {
      this.logger.info('Initializing domain-specific ranking system');
      
      // Initialize domain models
      await this.initializeDomainModels();
      
      // Generate domain embeddings
      await this.generateDomainEmbeddings();
      
      // Load domain-specific training data
      await this.loadDomainTrainingData();
      
      // Initialize domain expertise databases
      await this.initializeDomainExpertise();
      
      this.isInitialized = true;
      this.logger.info('Domain-specific ranker initialized successfully', {
        domains: Object.keys(this.domains).length
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize domain-specific ranker', { error: error.message });
      throw error;
    }
  }

  async rankModelsForDomain(models, query, domain, context = {}) {
    if (!this.isInitialized) {
      throw new Error('Domain ranker not initialized');
    }

    try {
      this.logger.info('Ranking models for domain', { 
        domain, 
        modelCount: models.length,
        query: query.substring(0, 100)
      });

      // Validate domain
      const domainConfig = this.domains[domain] || this.detectDomain(query);
      if (!domainConfig) {
        throw new Error(`Unknown domain: ${domain}`);
      }

      // Generate cache key
      const cacheKey = this.generateCacheKey(models, query, domain, context);
      const cached = await cacheManager.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Extract domain-specific query features
      const queryFeatures = await this.extractDomainQueryFeatures(query, domainConfig);
      
      // Calculate domain-specific scores for each model
      const scoredModels = await this.calculateDomainScores(models, queryFeatures, domainConfig, context);
      
      // Apply domain-specific ranking algorithms
      const rankedModels = await this.applyDomainRanking(scoredModels, queryFeatures, domainConfig);
      
      // Apply domain expertise weighting
      const expertiseWeighted = await this.applyExpertiseWeighting(rankedModels, domainConfig);
      
      // Cache results
      await cacheManager.set(cacheKey, expertiseWeighted, 1800); // 30 minutes
      
      this.logger.info('Domain-specific ranking completed', {
        domain,
        rankedCount: expertiseWeighted.length,
        topModel: expertiseWeighted[0]?.modelId
      });
      
      return expertiseWeighted;
      
    } catch (error) {
      this.logger.error('Domain-specific ranking failed', { domain, error: error.message });
      throw error;
    }
  }

  async detectDomain(query) {
    try {
      const queryLower = query.toLowerCase();
      const domainScores = {};
      
      // Score each domain based on keyword matches
      for (const [domainId, config] of Object.entries(this.domains)) {
        let score = 0;
        
        // Keyword matching
        config.keywords.forEach(keyword => {
          if (queryLower.includes(keyword)) {
            score += 1;
          }
        });
        
        // Pattern matching
        if (this.domainPatterns[domainId]) {
          this.domainPatterns[domainId].forEach(pattern => {
            if (pattern.test(queryLower)) {
              score += 0.5;
            }
          });
        }
        
        domainScores[domainId] = score;
      }
      
      // Get domain with highest score
      const bestDomain = Object.entries(domainScores)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (bestDomain && bestDomain[1] > 0) {
        return bestDomain[0];
      }
      
      // Use semantic similarity as fallback
      return await this.detectDomainSemantic(query);
      
    } catch (error) {
      this.logger.warn('Domain detection failed', { error: error.message });
      return 'general';
    }
  }

  async detectDomainSemantic(query) {
    try {
      const queryEmbedding = await embeddingsManager.generateEmbedding(query);
      let bestDomain = 'general';
      let bestSimilarity = 0;
      
      for (const [domainId, embedding] of this.domainEmbeddings.entries()) {
        const similarity = await this.calculateCosineSimilarity(queryEmbedding, embedding);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestDomain = domainId;
        }
      }
      
      return bestSimilarity > 0.3 ? bestDomain : 'general';
      
    } catch (error) {
      this.logger.warn('Semantic domain detection failed', { error: error.message });
      return 'general';
    }
  }

  async extractDomainQueryFeatures(query, domainConfig) {
    const features = {
      domain: domainConfig,
      query: query,
      queryEmbedding: await embeddingsManager.generateEmbedding(query),
      domainKeywords: this.extractDomainKeywords(query, domainConfig),
      complexityLevel: await this.assessDomainComplexity(query, domainConfig),
      taskType: await this.identifyDomainTask(query, domainConfig),
      qualityRequirements: await this.identifyQualityRequirements(query, domainConfig),
      expertiseLevel: await this.assessRequiredExpertise(query, domainConfig)
    };
    
    return features;
  }

  async calculateDomainScores(models, queryFeatures, domainConfig, context) {
    const scoredModels = [];
    
    for (const model of models) {
      try {
        // Get base ML score
        const baseScore = await mlScorer.scoreModel(model.id, { domain: domainConfig.name });
        
        // Calculate domain-specific scores
        const domainScores = {
          expertise: await this.calculateDomainExpertise(model, domainConfig),
          relevance: await this.calculateDomainRelevance(model, queryFeatures),
          quality: await this.calculateDomainQuality(model, domainConfig),
          specialization: await this.calculateDomainSpecialization(model, domainConfig),
          track_record: await this.calculateDomainTrackRecord(model, domainConfig)
        };
        
        // Combine scores using domain-specific weights
        const combinedScore = this.combineDomainScores(baseScore, domainScores, domainConfig);
        
        scoredModels.push({
          ...model,
          domainScores: {
            base: baseScore,
            domain: domainScores,
            combined: combinedScore
          }
        });
        
      } catch (error) {
        this.logger.warn('Failed to calculate domain score', { modelId: model.id, error: error.message });
        scoredModels.push({
          ...model,
          domainScores: {
            base: { score: 0.5, confidence: 0.1 },
            domain: {},
            combined: { score: 0.5, confidence: 0.1 }
          }
        });
      }
    }
    
    return scoredModels;
  }

  async calculateDomainExpertise(model, domainConfig) {
    try {
      // Check if model has domain-specific training
      const domainTraining = await this.checkDomainTraining(model, domainConfig);
      
      // Assess domain-specific capabilities
      const capabilities = await this.assessDomainCapabilities(model, domainConfig);
      
      // Check domain-specific performance history
      const performance = await this.getDomainPerformanceHistory(model.id, domainConfig.name);
      
      // Calculate expertise factors
      const expertiseFactors = {};
      for (const factor of domainConfig.expertiseFactors) {
        expertiseFactors[factor] = await this.assessExpertiseFactor(model, factor);
      }
      
      const expertiseScore = Object.values(expertiseFactors).reduce((sum, score) => sum + score, 0) / domainConfig.expertiseFactors.length;
      
      return {
        score: (domainTraining * 0.3 + capabilities * 0.3 + performance * 0.2 + expertiseScore * 0.2),
        details: {
          domainTraining,
          capabilities,
          performance,
          expertiseFactors
        }
      };
      
    } catch (error) {
      this.logger.warn('Failed to calculate domain expertise', { modelId: model.id, error: error.message });
      return { score: 0.5, details: {} };
    }
  }

  async calculateDomainRelevance(model, queryFeatures) {
    try {
      // Calculate semantic similarity to query
      const modelEmbedding = await embeddingsManager.generateEmbedding(
        `${model.name} ${model.description || ''} ${model.tags?.join(' ') || ''}`
      );
      
      const semanticSimilarity = await this.calculateCosineSimilarity(
        queryFeatures.queryEmbedding,
        modelEmbedding
      );
      
      // Check domain keyword matches
      const keywordRelevance = this.calculateKeywordRelevance(model, queryFeatures.domainKeywords);
      
      // Assess task type alignment
      const taskAlignment = await this.assessTaskAlignment(model, queryFeatures.taskType);
      
      return {
        score: semanticSimilarity * 0.4 + keywordRelevance * 0.3 + taskAlignment * 0.3,
        details: {
          semanticSimilarity,
          keywordRelevance,
          taskAlignment
        }
      };
      
    } catch (error) {
      this.logger.warn('Failed to calculate domain relevance', { modelId: model.id, error: error.message });
      return { score: 0.5, details: {} };
    }
  }

  async calculateDomainQuality(model, domainConfig) {
    try {
      // Get domain-specific quality metrics
      const qualityScores = {};
      
      for (const metric of domainConfig.qualityMetrics) {
        qualityScores[metric] = await this.getDomainQualityMetric(model.id, metric);
      }
      
      // Calculate weighted quality score
      const qualityValues = Object.values(qualityScores);
      const averageQuality = qualityValues.reduce((sum, score) => sum + score, 0) / qualityValues.length;
      
      return {
        score: averageQuality,
        details: qualityScores
      };
      
    } catch (error) {
      this.logger.warn('Failed to calculate domain quality', { modelId: model.id, error: error.message });
      return { score: 0.7, details: {} };
    }
  }

  async calculateDomainSpecialization(model, domainConfig) {
    try {
      // Check if model is specialized for this domain
      const isSpecialized = this.checkModelSpecialization(model, domainConfig);
      
      // Assess domain focus vs generalist approach
      const focusScore = await this.assessDomainFocus(model, domainConfig);
      
      // Check training data specificity
      const trainingSpecificity = await this.assessTrainingSpecificity(model, domainConfig);
      
      return {
        score: (isSpecialized ? 0.8 : 0.4) * 0.4 + focusScore * 0.3 + trainingSpecificity * 0.3,
        details: {
          isSpecialized,
          focusScore,
          trainingSpecificity
        }
      };
      
    } catch (error) {
      this.logger.warn('Failed to calculate domain specialization', { modelId: model.id, error: error.message });
      return { score: 0.5, details: {} };
    }
  }

  async calculateDomainTrackRecord(model, domainConfig) {
    try {
      // Get historical performance in this domain
      const historicalPerformance = await this.getDomainHistoricalPerformance(model.id, domainConfig.name);
      
      // Get user satisfaction scores for domain-specific tasks
      const userSatisfaction = await this.getDomainUserSatisfaction(model.id, domainConfig.name);
      
      // Get success rate for domain-specific tasks
      const successRate = await this.getDomainSuccessRate(model.id, domainConfig.name);
      
      return {
        score: historicalPerformance * 0.4 + userSatisfaction * 0.3 + successRate * 0.3,
        details: {
          historicalPerformance,
          userSatisfaction,
          successRate
        }
      };
      
    } catch (error) {
      this.logger.warn('Failed to calculate domain track record', { modelId: model.id, error: error.message });
      return { score: 0.6, details: {} };
    }
  }

  combineDomainScores(baseScore, domainScores, domainConfig) {
    // Use domain-specific performance weights
    const weights = domainConfig.performanceWeights;
    let totalScore = baseScore.score * 0.2; // Base score weight
    let totalWeight = 0.2;
    
    // Add domain-specific scores
    Object.entries(domainScores).forEach(([scoreType, scoreData]) => {
      const weight = weights[scoreType] || 0.1;
      totalScore += scoreData.score * weight;
      totalWeight += weight;
    });
    
    const combinedScore = totalWeight > 0 ? totalScore / totalWeight : 0.5;
    
    // Calculate combined confidence
    const confidences = [baseScore.confidence];
    Object.values(domainScores).forEach(score => {
      if (score.confidence !== undefined) {
        confidences.push(score.confidence);
      }
    });
    
    const combinedConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    
    return {
      score: combinedScore,
      confidence: combinedConfidence,
      breakdown: {
        base: baseScore,
        domain: domainScores
      }
    };
  }

  async applyDomainRanking(scoredModels, queryFeatures, domainConfig) {
    // Sort by combined domain score
    return scoredModels.sort((a, b) => {
      const scoreA = a.domainScores.combined.score * a.domainScores.combined.confidence;
      const scoreB = b.domainScores.combined.score * b.domainScores.combined.confidence;
      return scoreB - scoreA;
    });
  }

  async applyExpertiseWeighting(rankedModels, domainConfig) {
    // Apply additional weighting based on domain expertise
    return rankedModels.map((model, index) => ({
      ...model,
      domainRanking: {
        position: index + 1,
        score: model.domainScores.combined.score,
        confidence: model.domainScores.combined.confidence,
        domain: domainConfig.name,
        reasoning: this.generateDomainReasoning(model, domainConfig)
      }
    }));
  }

  // Helper methods
  buildDomainPatterns() {
    const patterns = {};
    
    Object.entries(this.domains).forEach(([domainId, config]) => {
      patterns[domainId] = [
        new RegExp(`\\b(${config.keywords.join('|')})\\b`, 'i'),
        new RegExp(`\\b(${config.modelTypes.join('|')})\\b`, 'i')
      ];
    });
    
    return patterns;
  }

  extractDomainKeywords(query, domainConfig) {
    const queryLower = query.toLowerCase();
    return domainConfig.keywords.filter(keyword => queryLower.includes(keyword));
  }

  calculateKeywordRelevance(model, domainKeywords) {
    const modelText = `${model.name} ${model.description || ''} ${model.tags?.join(' ') || ''}`.toLowerCase();
    const matches = domainKeywords.filter(keyword => modelText.includes(keyword));
    return domainKeywords.length > 0 ? matches.length / domainKeywords.length : 0;
  }

  checkModelSpecialization(model, domainConfig) {
    const modelText = `${model.name} ${model.description || ''} ${model.tags?.join(' ') || ''}`.toLowerCase();
    return domainConfig.modelTypes.some(type => modelText.includes(type));
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

  generateCacheKey(models, query, domain, context) {
    const modelIds = models.map(m => m.id).sort().join(',');
    const contextStr = JSON.stringify(context);
    return `domain_ranking:${domain}:${Buffer.from(query + modelIds + contextStr).toString('base64').slice(0, 50)}`;
  }

  generateDomainReasoning(model, domainConfig) {
    return `Ranked for ${domainConfig.name} based on domain expertise, specialization, and track record`;
  }

  // Placeholder methods for complex operations
  async initializeDomainModels() { /* Implementation details */ }
  async generateDomainEmbeddings() {
    for (const [domainId, config] of Object.entries(this.domains)) {
      const domainText = `${config.name} ${config.keywords.join(' ')} ${config.modelTypes.join(' ')}`;
      this.domainEmbeddings.set(domainId, await embeddingsManager.generateEmbedding(domainText));
    }
  }
  async loadDomainTrainingData() { /* Implementation details */ }
  async initializeDomainExpertise() { /* Implementation details */ }
  async assessDomainComplexity(query, domainConfig) { return 0.5; }
  async identifyDomainTask(query, domainConfig) { return 'general'; }
  async identifyQualityRequirements(query, domainConfig) { return domainConfig.qualityMetrics; }
  async assessRequiredExpertise(query, domainConfig) { return 0.7; }
  async checkDomainTraining(model, domainConfig) { return 0.6; }
  async assessDomainCapabilities(model, domainConfig) { return 0.7; }
  async getDomainPerformanceHistory(modelId, domain) { return 0.8; }
  async assessExpertiseFactor(model, factor) { return 0.7; }
  async assessTaskAlignment(model, taskType) { return 0.6; }
  async getDomainQualityMetric(modelId, metric) { return 0.7; }
  async assessDomainFocus(model, domainConfig) { return 0.6; }
  async assessTrainingSpecificity(model, domainConfig) { return 0.7; }
  async getDomainHistoricalPerformance(modelId, domain) { return 0.75; }
  async getDomainUserSatisfaction(modelId, domain) { return 0.8; }
  async getDomainSuccessRate(modelId, domain) { return 0.85; }

  getStats() {
    return {
      initialized: this.isInitialized,
      domains: Object.keys(this.domains).length,
      domainModels: this.domainModels.size,
      domainEmbeddings: this.domainEmbeddings.size,
      supportedDomains: Object.keys(this.domains)
    };
  }

  async cleanup() {
    this.domainModels.clear();
    this.domainEmbeddings.clear();
    this.isInitialized = false;
    this.logger.info('Domain-specific ranker cleaned up');
  }
}

export const domainRanker = new DomainSpecificRanker();