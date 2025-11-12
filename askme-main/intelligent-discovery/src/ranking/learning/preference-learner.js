import { createLogger } from '../../core/infrastructure/logger.js';
import { embeddingsManager } from '../../core/storage/embeddings.js';
import { qdrantManager } from '../../core/storage/qdrant.js';
import { cacheManager } from '../../core/storage/cache.js';

class UserPreferenceLearner {
  constructor() {
    this.logger = createLogger({ component: 'preference-learner' });
    this.isInitialized = false;
    this.userProfiles = new Map();
    this.learningModels = new Map();
    
    // Learning parameters
    this.learningConfig = {
      minInteractions: 5,           // Minimum interactions before learning
      decayFactor: 0.95,           // Time decay for older interactions
      adaptationRate: 0.1,         // Learning rate for preference updates
      confidenceThreshold: 0.7,    // Minimum confidence for recommendations
      maxProfileAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
    };
    
    // Interaction types and their weights
    this.interactionWeights = {
      'model_selected': 1.0,       // User selected a model
      'positive_feedback': 2.0,    // User gave positive feedback  
      'negative_feedback': -1.5,   // User gave negative feedback
      'task_completed': 1.5,       // User completed task with model
      'session_duration': 0.5,     // Long session indicates satisfaction
      'repeat_usage': 2.5,         // User used same model again
      'shared_result': 1.2,        // User shared the result
      'bookmarked': 1.8           // User bookmarked the model
    };
    
    // Preference dimensions
    this.preferenceDimensions = {
      'performance': 'Response speed and efficiency',
      'quality': 'Output quality and accuracy',
      'creativity': 'Creative and novel responses',
      'reliability': 'Consistent and stable performance',
      'ease_of_use': 'Simple and intuitive interface',
      'cost_efficiency': 'Cost-effective usage',
      'domain_expertise': 'Specialized knowledge areas',
      'customization': 'Ability to customize behavior'
    };
  }

  async initialize() {
    try {
      this.logger.info('Initializing user preference learning system');
      
      // Initialize learning models
      await this.initializeLearningModels();
      
      // Load existing user profiles
      await this.loadUserProfiles();
      
      // Initialize preference embeddings
      await this.initializePreferenceEmbeddings();
      
      // Setup periodic learning updates
      this.setupPeriodicLearning();
      
      this.isInitialized = true;
      this.logger.info('User preference learner initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize user preference learner', { error: error.message });
      throw error;
    }
  }

  async recordInteraction(userId, interaction) {
    if (!this.isInitialized) {
      throw new Error('Preference learner not initialized');
    }

    try {
      this.logger.debug('Recording user interaction', {
        userId,
        type: interaction.type,
        modelId: interaction.modelId
      });

      // Validate interaction
      const validatedInteraction = await this.validateInteraction(interaction);
      
      // Store interaction
      await this.storeInteraction(userId, validatedInteraction);
      
      // Update user profile incrementally
      await this.updateUserProfile(userId, validatedInteraction);
      
      // Trigger learning if enough data
      const profile = await this.getUserProfile(userId);
      if (profile.interactionCount >= this.learningConfig.minInteractions) {
        await this.triggerLearningUpdate(userId);
      }
      
    } catch (error) {
      this.logger.error('Failed to record interaction', { userId, error: error.message });
      throw error;
    }
  }

  async learnUserPreferences(userId, interactions = null) {
    try {
      this.logger.info('Learning user preferences', { userId });
      
      // Get user interactions if not provided
      if (!interactions) {
        interactions = await this.getUserInteractions(userId);
      }
      
      if (interactions.length < this.learningConfig.minInteractions) {
        this.logger.warn('Insufficient interactions for learning', { 
          userId, 
          count: interactions.length,
          required: this.learningConfig.minInteractions
        });
        return null;
      }
      
      // Analyze interaction patterns
      const patterns = await this.analyzeInteractionPatterns(interactions);
      
      // Extract preference features
      const preferenceFeatures = await this.extractPreferenceFeatures(interactions);
      
      // Build preference model
      const preferenceModel = await this.buildPreferenceModel(preferenceFeatures, patterns);
      
      // Validate preference model
      const validation = await this.validatePreferenceModel(preferenceModel, interactions);
      
      // Store learned preferences
      if (validation.confidence >= this.learningConfig.confidenceThreshold) {
        await this.storeUserPreferences(userId, preferenceModel, validation);
        this.logger.info('User preferences learned successfully', {
          userId,
          confidence: validation.confidence,
          dimensions: Object.keys(preferenceModel.dimensions)
        });
      }
      
      return preferenceModel;
      
    } catch (error) {
      this.logger.error('Failed to learn user preferences', { userId, error: error.message });
      throw error;
    }
  }

  async predictUserPreference(userId, modelId, context = {}) {
    try {
      // Get user profile
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile || userProfile.confidence < this.learningConfig.confidenceThreshold) {
        return { score: 0.5, confidence: 0.1, reasoning: 'Insufficient user data' };
      }
      
      // Get model features
      const modelFeatures = await this.getModelFeatures(modelId);
      
      // Calculate preference alignment
      const alignment = await this.calculatePreferenceAlignment(
        userProfile.preferences,
        modelFeatures,
        context
      );
      
      // Apply contextual adjustments
      const contextualAlignment = await this.applyContextualAdjustments(
        alignment,
        userProfile,
        context
      );
      
      // Generate prediction reasoning
      const reasoning = this.generatePredictionReasoning(
        userProfile,
        modelFeatures,
        contextualAlignment
      );
      
      return {
        score: contextualAlignment.score,
        confidence: contextualAlignment.confidence,
        reasoning,
        breakdown: contextualAlignment.breakdown
      };
      
    } catch (error) {
      this.logger.error('Failed to predict user preference', { userId, modelId, error: error.message });
      return { score: 0.5, confidence: 0.1, reasoning: 'Prediction failed' };
    }
  }

  async analyzeInteractionPatterns(interactions) {
    const patterns = {
      temporal: await this.analyzeTemporalPatterns(interactions),
      usage: await this.analyzeUsagePatterns(interactions),
      feedback: await this.analyzeFeedbackPatterns(interactions),
      context: await this.analyzeContextualPatterns(interactions),
      model: await this.analyzeModelPatterns(interactions)
    };
    
    return patterns;
  }

  async analyzeTemporalPatterns(interactions) {
    // Analyze when user interacts with models
    const timeDistribution = {};
    const dayDistribution = {};
    const durationPatterns = [];
    
    interactions.forEach(interaction => {
      const date = new Date(interaction.timestamp);
      const hour = date.getHours();
      const day = date.getDay();
      
      timeDistribution[hour] = (timeDistribution[hour] || 0) + 1;
      dayDistribution[day] = (dayDistribution[day] || 0) + 1;
      
      if (interaction.duration) {
        durationPatterns.push(interaction.duration);
      }
    });
    
    return {
      preferredHours: this.findTopValues(timeDistribution, 3),
      preferredDays: this.findTopValues(dayDistribution, 3),
      averageDuration: durationPatterns.length > 0 ? 
        durationPatterns.reduce((a, b) => a + b, 0) / durationPatterns.length : 0,
      sessionCount: interactions.length
    };
  }

  async analyzeUsagePatterns(interactions) {
    // Analyze how user uses models
    const taskTypes = {};
    const modelTypes = {};
    const repeatUsage = {};
    
    interactions.forEach(interaction => {
      if (interaction.taskType) {
        taskTypes[interaction.taskType] = (taskTypes[interaction.taskType] || 0) + 1;
      }
      
      if (interaction.modelType) {
        modelTypes[interaction.modelType] = (modelTypes[interaction.modelType] || 0) + 1;
      }
      
      if (interaction.modelId) {
        repeatUsage[interaction.modelId] = (repeatUsage[interaction.modelId] || 0) + 1;
      }
    });
    
    return {
      preferredTasks: this.findTopValues(taskTypes, 5),
      preferredModelTypes: this.findTopValues(modelTypes, 5),
      loyaltyModels: this.findTopValues(repeatUsage, 10),
      taskDiversity: Object.keys(taskTypes).length,
      modelDiversity: Object.keys(modelTypes).length
    };
  }

  async analyzeFeedbackPatterns(interactions) {
    // Analyze user feedback patterns
    const positiveFeatures = [];
    const negativeFeatures = [];
    const feedbackDistribution = { positive: 0, negative: 0, neutral: 0 };
    
    interactions.forEach(interaction => {
      if (interaction.feedback) {
        if (interaction.feedback.rating > 3) {
          feedbackDistribution.positive++;
          if (interaction.feedback.features) {
            positiveFeatures.push(...interaction.feedback.features);
          }
        } else if (interaction.feedback.rating < 3) {
          feedbackDistribution.negative++;
          if (interaction.feedback.features) {
            negativeFeatures.push(...interaction.feedback.features);
          }
        } else {
          feedbackDistribution.neutral++;
        }
      }
    });
    
    return {
      feedbackDistribution,
      likedFeatures: this.findMostCommon(positiveFeatures, 10),
      dislikedFeatures: this.findMostCommon(negativeFeatures, 10),
      feedbackRate: (feedbackDistribution.positive + feedbackDistribution.negative + feedbackDistribution.neutral) / interactions.length
    };
  }

  async analyzeContextualPatterns(interactions) {
    // Analyze contextual usage patterns
    const domainUsage = {};
    const complexityPreference = [];
    const urgencyPatterns = {};
    
    interactions.forEach(interaction => {
      if (interaction.context) {
        if (interaction.context.domain) {
          domainUsage[interaction.context.domain] = (domainUsage[interaction.context.domain] || 0) + 1;
        }
        
        if (interaction.context.complexity !== undefined) {
          complexityPreference.push(interaction.context.complexity);
        }
        
        if (interaction.context.urgency) {
          urgencyPatterns[interaction.context.urgency] = (urgencyPatterns[interaction.context.urgency] || 0) + 1;
        }
      }
    });
    
    return {
      preferredDomains: this.findTopValues(domainUsage, 5),
      complexityPreference: complexityPreference.length > 0 ? 
        complexityPreference.reduce((a, b) => a + b, 0) / complexityPreference.length : 0.5,
      urgencyPatterns: urgencyPatterns
    };
  }

  async analyzeModelPatterns(interactions) {
    // Analyze model selection patterns
    const providerPreference = {};
    const performanceWeights = [];
    const modelCharacteristics = {};
    
    interactions.forEach(interaction => {
      if (interaction.model) {
        if (interaction.model.provider) {
          providerPreference[interaction.model.provider] = (providerPreference[interaction.model.provider] || 0) + 1;
        }
        
        if (interaction.model.performance) {
          performanceWeights.push(interaction.model.performance);
        }
        
        if (interaction.model.characteristics) {
          Object.keys(interaction.model.characteristics).forEach(char => {
            modelCharacteristics[char] = (modelCharacteristics[char] || 0) + 1;
          });
        }
      }
    });
    
    return {
      preferredProviders: this.findTopValues(providerPreference, 5),
      performanceExpectation: performanceWeights.length > 0 ?
        performanceWeights.reduce((a, b) => a + b, 0) / performanceWeights.length : 0.7,
      preferredCharacteristics: this.findTopValues(modelCharacteristics, 10)
    };
  }

  async extractPreferenceFeatures(interactions) {
    const features = {};
    
    // Initialize preference dimensions
    Object.keys(this.preferenceDimensions).forEach(dim => {
      features[dim] = { score: 0.5, confidence: 0.1, evidence: [] };
    });
    
    // Extract features from interactions
    for (const interaction of interactions) {
      const weight = this.interactionWeights[interaction.type] || 1.0;
      const timeFactor = this.calculateTimeFactor(interaction.timestamp);
      const adjustedWeight = weight * timeFactor;
      
      // Update preference dimensions based on interaction
      await this.updatePreferenceDimensions(features, interaction, adjustedWeight);
    }
    
    // Normalize and calculate confidence
    this.normalizePreferenceFeatures(features, interactions.length);
    
    return features;
  }

  async updatePreferenceDimensions(features, interaction, weight) {
    // Update based on interaction type and model characteristics
    if (interaction.model && interaction.model.characteristics) {
      Object.entries(interaction.model.characteristics).forEach(([char, value]) => {
        if (features[char]) {
          features[char].score += (value * weight) * this.learningConfig.adaptationRate;
          features[char].confidence += 0.1;
          features[char].evidence.push({
            interaction: interaction.id,
            value,
            weight,
            timestamp: interaction.timestamp
          });
        }
      });
    }
    
    // Update based on feedback
    if (interaction.feedback && interaction.feedback.dimensionRatings) {
      Object.entries(interaction.feedback.dimensionRatings).forEach(([dim, rating]) => {
        if (features[dim]) {
          const normalizedRating = (rating - 1) / 4; // Convert 1-5 to 0-1
          features[dim].score += (normalizedRating * weight) * this.learningConfig.adaptationRate;
          features[dim].confidence += 0.15;
          features[dim].evidence.push({
            type: 'feedback',
            rating,
            weight,
            timestamp: interaction.timestamp
          });
        }
      });
    }
  }

  normalizePreferenceFeatures(features, interactionCount) {
    Object.keys(features).forEach(dim => {
      // Normalize score to 0-1 range
      features[dim].score = Math.max(0, Math.min(1, features[dim].score));
      
      // Calculate confidence based on evidence
      const evidenceCount = features[dim].evidence.length;
      features[dim].confidence = Math.min(1, evidenceCount / interactionCount);
      
      // Limit evidence to most recent items
      if (features[dim].evidence.length > 50) {
        features[dim].evidence = features[dim].evidence
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 50);
      }
    });
  }

  async buildPreferenceModel(features, patterns) {
    return {
      dimensions: features,
      patterns,
      metadata: {
        created: Date.now(),
        version: '1.0',
        algorithm: 'weighted_learning'
      },
      summary: this.generatePreferenceSummary(features, patterns)
    };
  }

  async validatePreferenceModel(model, interactions) {
    // Cross-validation using holdout method
    const testSize = Math.floor(interactions.length * 0.2);
    const testInteractions = interactions.slice(-testSize);
    const predictions = [];
    const actuals = [];
    
    for (const interaction of testInteractions) {
      if (interaction.feedback && interaction.feedback.rating) {
        const prediction = await this.simulatePreferencePrediction(model, interaction);
        predictions.push(prediction);
        actuals.push(interaction.feedback.rating / 5); // Normalize to 0-1
      }
    }
    
    // Calculate validation metrics
    const accuracy = this.calculateAccuracy(predictions, actuals);
    const mse = this.calculateMSE(predictions, actuals);
    const confidence = Math.max(0.1, Math.min(1, accuracy - mse));
    
    return {
      accuracy,
      mse,
      confidence,
      testSize: testInteractions.length,
      validationDate: Date.now()
    };
  }

  calculateTimeFactor(timestamp) {
    const age = Date.now() - timestamp;
    const maxAge = this.learningConfig.maxProfileAge;
    return Math.pow(this.learningConfig.decayFactor, age / maxAge);
  }

  generatePreferenceSummary(features, patterns) {
    const topPreferences = Object.entries(features)
      .filter(([_, feature]) => feature.confidence > 0.5)
      .sort(([_, a], [__, b]) => b.score - a.score)
      .slice(0, 5)
      .map(([dim, feature]) => ({ dimension: dim, score: feature.score }));
    
    return {
      topPreferences,
      primaryTaskTypes: patterns.usage.preferredTasks.slice(0, 3),
      preferredProviders: patterns.model.preferredProviders.slice(0, 3),
      usageCharacteristics: {
        taskDiversity: patterns.usage.taskDiversity,
        modelLoyalty: patterns.usage.loyaltyModels.length > 0,
        feedbackRate: patterns.feedback.feedbackRate
      }
    };
  }

  // Helper methods
  findTopValues(obj, limit) {
    return Object.entries(obj)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, limit)
      .map(([key, value]) => ({ key, value }));
  }

  findMostCommon(arr, limit) {
    const counts = {};
    arr.forEach(item => counts[item] = (counts[item] || 0) + 1);
    return this.findTopValues(counts, limit);
  }

  async calculatePreferenceAlignment(userPreferences, modelFeatures, context) {
    let totalScore = 0;
    let totalWeight = 0;
    const breakdown = {};
    
    Object.entries(userPreferences.dimensions).forEach(([dim, userPref]) => {
      if (modelFeatures[dim] && userPref.confidence > 0.3) {
        const alignment = 1 - Math.abs(userPref.score - modelFeatures[dim]);
        const weight = userPref.confidence;
        
        totalScore += alignment * weight;
        totalWeight += weight;
        
        breakdown[dim] = {
          userPreference: userPref.score,
          modelValue: modelFeatures[dim],
          alignment,
          weight
        };
      }
    });
    
    const avgConfidence = Object.values(userPreferences.dimensions)
      .reduce((sum, pref) => sum + pref.confidence, 0) / Object.keys(userPreferences.dimensions).length;
    
    return {
      score: totalWeight > 0 ? totalScore / totalWeight : 0.5,
      confidence: avgConfidence,
      breakdown
    };
  }

  // Placeholder methods for complex operations
  async initializeLearningModels() { /* Implementation details */ }
  async loadUserProfiles() { /* Implementation details */ }
  async initializePreferenceEmbeddings() { /* Implementation details */ }
  setupPeriodicLearning() { /* Implementation details */ }
  async validateInteraction(interaction) { return interaction; }
  async storeInteraction(userId, interaction) { /* Implementation details */ }
  async updateUserProfile(userId, interaction) { /* Implementation details */ }
  async triggerLearningUpdate(userId) { /* Implementation details */ }
  async getUserInteractions(userId) { return []; }
  async getUserProfile(userId) { return null; }
  async getModelFeatures(modelId) { return {}; }
  async applyContextualAdjustments(alignment, profile, context) { return alignment; }
  generatePredictionReasoning(profile, features, alignment) { return 'Preference-based prediction'; }
  async storeUserPreferences(userId, model, validation) { /* Implementation details */ }
  async simulatePreferencePrediction(model, interaction) { return 0.5; }
  calculateAccuracy(predictions, actuals) { return 0.8; }
  calculateMSE(predictions, actuals) { return 0.1; }

  getStats() {
    return {
      initialized: this.isInitialized,
      userProfileCount: this.userProfiles.size,
      learningModels: this.learningModels.size,
      preferenceDimensions: Object.keys(this.preferenceDimensions).length,
      interactionTypes: Object.keys(this.interactionWeights).length
    };
  }

  async cleanup() {
    this.userProfiles.clear();
    this.learningModels.clear();
    this.isInitialized = false;
    this.logger.info('User preference learner cleaned up');
  }
}

export const preferenceLearner = new UserPreferenceLearner();