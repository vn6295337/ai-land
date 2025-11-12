/**
 * Model Filtering and Categorization
 * Module 4, Step 20: Add model filtering and categorization
 * 
 * Features:
 * - Advanced filtering with multiple criteria
 * - Intelligent model categorization
 * - Custom filter expressions and rules
 * - Statistical filtering and outlier detection
 * - Category-based organization and tagging
 */

import { logger } from '../../core/infrastructure/logger.js';
import { config } from '../../core/infrastructure/config.js';
import { embeddingsManager } from '../../core/storage/embeddings.js';
import { ProcessingError } from '../../core/infrastructure/errors.js';

class ModelFilter {
    constructor() {
        this.filterCategories = new Map();
        this.filterRules = new Map();
        this.categoryHierarchy = new Map();
        this.statisticalThresholds = new Map();
        this.setupDefaultCategories();
        this.setupDefaultFilters();
        this.setupCategoryHierarchy();
    }

    /**
     * Set up default model categories
     */
    setupDefaultCategories() {
        const categories = {
            // By Task
            'text-generation': {
                name: 'Text Generation',
                description: 'Models for generating human-like text',
                keywords: ['text-generation', 'language-model', 'gpt', 'completion'],
                subcategories: ['conversational', 'creative-writing', 'code-generation']
            },
            'multimodal': {
                name: 'Multimodal',
                description: 'Models that work with multiple input types',
                keywords: ['multimodal', 'vision', 'image-to-text', 'text-to-image'],
                subcategories: ['vision-language', 'text-to-image', 'audio-text']
            },
            'embeddings': {
                name: 'Embeddings',
                description: 'Models for creating vector representations',
                keywords: ['embedding', 'sentence-transformer', 'feature-extraction'],
                subcategories: ['text-embeddings', 'image-embeddings', 'multimodal-embeddings']
            },
            'classification': {
                name: 'Classification',
                description: 'Models for categorizing and labeling',
                keywords: ['classification', 'sentiment', 'categorization'],
                subcategories: ['text-classification', 'image-classification', 'sentiment-analysis']
            },
            'audio': {
                name: 'Audio Processing',
                description: 'Models for audio and speech tasks',
                keywords: ['audio', 'speech', 'whisper', 'tts', 'asr'],
                subcategories: ['speech-to-text', 'text-to-speech', 'audio-classification']
            },
            
            // By Size/Scale
            'large-scale': {
                name: 'Large Scale',
                description: 'Large models requiring significant resources',
                criteria: { minParameters: 7000000000, minDownloads: 1000 }
            },
            'efficient': {
                name: 'Efficient',
                description: 'Lightweight models optimized for speed',
                criteria: { maxParameters: 1000000000, contextLength: { max: 4096 } }
            },
            
            // By Provider
            'enterprise': {
                name: 'Enterprise',
                description: 'Commercial models from major providers',
                providers: ['openai', 'anthropic', 'google']
            },
            'open-source': {
                name: 'Open Source',
                description: 'Community-driven open source models',
                providers: ['huggingface'],
                criteria: { minDownloads: 100 }
            },
            
            // By Quality
            'high-quality': {
                name: 'High Quality',
                description: 'Models with high engagement and validation',
                criteria: { 
                    minDownloads: 10000, 
                    minLikes: 100,
                    hasDescription: true,
                    validated: true 
                }
            },
            'experimental': {
                name: 'Experimental',
                description: 'New or experimental models',
                criteria: { 
                    maxDownloads: 1000,
                    recentlyCreated: 30 // days
                }
            }
        };

        for (const [key, category] of Object.entries(categories)) {
            this.filterCategories.set(key, {
                ...category,
                id: key,
                createdAt: new Date().toISOString()
            });
        }

        logger.info('📋 Default categories configured', {
            categories: Object.keys(categories),
            component: 'ModelFilter'
        });
    }

    /**
     * Set up default filter rules
     */
    setupDefaultFilters() {
        const filters = {
            // Quality filters
            'popular': {
                name: 'Popular Models',
                description: 'Models with high download counts',
                rule: (model) => (model.downloads || 0) >= 1000
            },
            'well-documented': {
                name: 'Well Documented',
                description: 'Models with comprehensive descriptions',
                rule: (model) => model.description && model.description.length >= 50
            },
            'recently-updated': {
                name: 'Recently Updated',
                description: 'Models updated in the last 6 months',
                rule: (model) => {
                    if (!model.lastModified) return false;
                    const sixMonthsAgo = new Date();
                    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                    return new Date(model.lastModified) > sixMonthsAgo;
                }
            },
            
            // Technical filters
            'has-api': {
                name: 'API Available',
                description: 'Models with accessible API endpoints',
                rule: (model) => !!model.apiEndpoint
            },
            'supports-streaming': {
                name: 'Streaming Support',
                description: 'Models that support streaming responses',
                rule: (model) => model.streamingSupported === true
            },
            'function-calling': {
                name: 'Function Calling',
                description: 'Models that support function calling',
                rule: (model) => model.functionCalling === true
            },
            
            // Content filters
            'safe-content': {
                name: 'Safe Content',
                description: 'Models suitable for general use',
                rule: (model) => {
                    const unsafeTags = ['nsfw', 'adult-content', 'not-for-all-audiences'];
                    return !model.tags?.some(tag => 
                        unsafeTags.some(unsafe => tag.toLowerCase().includes(unsafe))
                    );
                }
            },
            'english-language': {
                name: 'English Language',
                description: 'Models designed for English text',
                rule: (model) => {
                    const lang = model.language?.toLowerCase();
                    return !lang || lang === 'en' || lang === 'english' || lang === 'multilingual';
                }
            },
            
            // Performance filters
            'fast-inference': {
                name: 'Fast Inference',
                description: 'Models optimized for quick responses',
                rule: (model) => {
                    const contextLength = model.contextLength || 0;
                    const isEfficient = model.name?.toLowerCase().includes('fast') ||
                                      model.name?.toLowerCase().includes('efficient') ||
                                      model.name?.toLowerCase().includes('light') ||
                                      contextLength <= 4096;
                    return isEfficient;
                }
            }
        };

        for (const [key, filter] of Object.entries(filters)) {
            this.filterRules.set(key, {
                ...filter,
                id: key,
                createdAt: new Date().toISOString()
            });
        }

        logger.info('🔍 Default filters configured', {
            filters: Object.keys(filters),
            component: 'ModelFilter'
        });
    }

    /**
     * Set up category hierarchy
     */
    setupCategoryHierarchy() {
        const hierarchy = {
            'by-task': {
                name: 'By Task',
                children: ['text-generation', 'multimodal', 'embeddings', 'classification', 'audio']
            },
            'by-scale': {
                name: 'By Scale',
                children: ['large-scale', 'efficient']
            },
            'by-provider': {
                name: 'By Provider',
                children: ['enterprise', 'open-source']
            },
            'by-quality': {
                name: 'By Quality',
                children: ['high-quality', 'experimental']
            }
        };

        for (const [key, category] of Object.entries(hierarchy)) {
            this.categoryHierarchy.set(key, category);
        }

        logger.info('🏗️ Category hierarchy configured', {
            hierarchies: Object.keys(hierarchy),
            component: 'ModelFilter'
        });
    }

    /**
     * Filter models based on criteria
     */
    async filterModels(models, filterCriteria = {}) {
        try {
            const {
                categories = [],
                filters = [],
                customRules = [],
                includeStatisticalFilters = true,
                minQualityScore = 0,
                maxResults = null
            } = filterCriteria;

            logger.info('🔍 Starting model filtering', {
                totalModels: models.length,
                categories: categories.length,
                filters: filters.length,
                customRules: customRules.length,
                component: 'ModelFilter'
            });

            let filteredModels = [...models];

            // Apply category filters
            if (categories.length > 0) {
                filteredModels = await this.applyCategoryFilters(filteredModels, categories);
                logger.debug(`📂 Category filtering: ${filteredModels.length} models remaining`);
            }

            // Apply predefined filters
            if (filters.length > 0) {
                filteredModels = await this.applyPredefinedFilters(filteredModels, filters);
                logger.debug(`🔍 Predefined filtering: ${filteredModels.length} models remaining`);
            }

            // Apply custom rules
            if (customRules.length > 0) {
                filteredModels = await this.applyCustomRules(filteredModels, customRules);
                logger.debug(`⚙️ Custom filtering: ${filteredModels.length} models remaining`);
            }

            // Apply statistical filters
            if (includeStatisticalFilters) {
                filteredModels = await this.applyStatisticalFilters(filteredModels);
                logger.debug(`📊 Statistical filtering: ${filteredModels.length} models remaining`);
            }

            // Apply quality score filter
            if (minQualityScore > 0) {
                filteredModels = await this.applyQualityFilter(filteredModels, minQualityScore);
                logger.debug(`⭐ Quality filtering: ${filteredModels.length} models remaining`);
            }

            // Limit results if specified
            if (maxResults && filteredModels.length > maxResults) {
                // Sort by quality/popularity before limiting
                filteredModels = await this.sortModelsByQuality(filteredModels);
                filteredModels = filteredModels.slice(0, maxResults);
                logger.debug(`🔢 Limited to ${maxResults} results`);
            }

            // Add filter metadata
            filteredModels.forEach(model => {
                model.filterMetadata = {
                    filteredAt: new Date().toISOString(),
                    appliedFilters: { categories, filters, customRules },
                    qualityScore: this.calculateQualityScore(model)
                };
            });

            logger.info('✅ Model filtering completed', {
                originalCount: models.length,
                filteredCount: filteredModels.length,
                filterRate: ((models.length - filteredModels.length) / models.length * 100).toFixed(1) + '%',
                component: 'ModelFilter'
            });

            return {
                models: filteredModels,
                stats: {
                    originalCount: models.length,
                    filteredCount: filteredModels.length,
                    removedCount: models.length - filteredModels.length,
                    filterRate: ((models.length - filteredModels.length) / models.length * 100).toFixed(1) + '%'
                },
                appliedFilters: { categories, filters, customRules }
            };

        } catch (error) {
            logger.error('❌ Model filtering failed', {
                error: error.message,
                totalModels: models.length,
                component: 'ModelFilter'
            });
            throw new ProcessingError(`Model filtering failed: ${error.message}`);
        }
    }

    /**
     * Categorize models
     */
    async categorizeModels(models, options = {}) {
        try {
            const {
                includeHierarchy = true,
                generateEmbeddingCategories = true,
                calculateSimilarity = true
            } = options;

            logger.info('📂 Starting model categorization', {
                totalModels: models.length,
                includeHierarchy,
                generateEmbeddingCategories,
                component: 'ModelFilter'
            });

            const categorizedModels = new Map();
            const categoryStats = new Map();

            // Initialize category stats
            for (const category of this.filterCategories.keys()) {
                categoryStats.set(category, {
                    count: 0,
                    models: [],
                    averageQuality: 0,
                    totalDownloads: 0
                });
            }

            // Categorize each model
            for (const model of models) {
                const modelCategories = await this.classifyModel(model);
                
                // Add categories to model
                model.categories = modelCategories;
                
                // Update category stats
                for (const category of modelCategories) {
                    if (categoryStats.has(category)) {
                        const stats = categoryStats.get(category);
                        stats.count++;
                        stats.models.push(model);
                        stats.totalDownloads += model.downloads || 0;
                    }
                }

                // Store categorized model
                categorizedModels.set(model.id, model);
            }

            // Calculate average quality for each category
            for (const [category, stats] of categoryStats.entries()) {
                if (stats.count > 0) {
                    stats.averageQuality = this.calculateAverageQuality(stats.models);
                    stats.averageDownloads = Math.round(stats.totalDownloads / stats.count);
                }
            }

            // Generate embedding-based categories if requested
            let embeddingCategories = {};
            if (generateEmbeddingCategories) {
                embeddingCategories = await this.generateEmbeddingCategories(Array.from(categorizedModels.values()));
            }

            // Build hierarchy if requested
            let hierarchy = {};
            if (includeHierarchy) {
                hierarchy = this.buildCategoryHierarchy(categoryStats);
            }

            const result = {
                models: Array.from(categorizedModels.values()),
                categories: Object.fromEntries(categoryStats),
                hierarchy: includeHierarchy ? hierarchy : undefined,
                embeddingCategories: generateEmbeddingCategories ? embeddingCategories : undefined,
                stats: {
                    totalModels: models.length,
                    totalCategories: this.filterCategories.size,
                    averageCategoriesPerModel: models.length > 0 ? 
                        (Array.from(categorizedModels.values()).reduce((sum, model) => sum + model.categories.length, 0) / models.length).toFixed(1) : 0
                },
                timestamp: new Date().toISOString()
            };

            logger.info('✅ Model categorization completed', {
                categorizedModels: categorizedModels.size,
                activeCategories: Array.from(categoryStats.values()).filter(s => s.count > 0).length,
                component: 'ModelFilter'
            });

            return result;

        } catch (error) {
            logger.error('❌ Model categorization failed', {
                error: error.message,
                totalModels: models.length,
                component: 'ModelFilter'
            });
            throw new ProcessingError(`Model categorization failed: ${error.message}`);
        }
    }

    /**
     * Apply category filters
     */
    async applyCategoryFilters(models, categories) {
        const filtered = [];

        for (const model of models) {
            for (const categoryId of categories) {
                if (await this.modelMatchesCategory(model, categoryId)) {
                    filtered.push(model);
                    break; // Model matches at least one category
                }
            }
        }

        return filtered;
    }

    /**
     * Apply predefined filters
     */
    async applyPredefinedFilters(models, filterIds) {
        let filtered = models;

        for (const filterId of filterIds) {
            const filter = this.filterRules.get(filterId);
            if (filter) {
                filtered = filtered.filter(model => {
                    try {
                        return filter.rule(model);
                    } catch (error) {
                        logger.warn('⚠️ Filter rule error', {
                            filterId,
                            modelId: model.id,
                            error: error.message,
                            component: 'ModelFilter'
                        });
                        return false;
                    }
                });
            }
        }

        return filtered;
    }

    /**
     * Apply custom filter rules
     */
    async applyCustomRules(models, customRules) {
        let filtered = models;

        for (const rule of customRules) {
            try {
                if (typeof rule.condition === 'function') {
                    filtered = filtered.filter(rule.condition);
                } else if (typeof rule.condition === 'object') {
                    filtered = filtered.filter(model => this.evaluateCondition(model, rule.condition));
                }
            } catch (error) {
                logger.warn('⚠️ Custom rule error', {
                    rule: rule.name || 'unnamed',
                    error: error.message,
                    component: 'ModelFilter'
                });
            }
        }

        return filtered;
    }

    /**
     * Apply statistical filters to remove outliers
     */
    async applyStatisticalFilters(models) {
        if (models.length < 10) return models; // Not enough data for statistical filtering

        // Calculate statistical thresholds
        const downloads = models.map(m => m.downloads || 0).filter(d => d > 0);
        const contextLengths = models.map(m => m.contextLength || 0).filter(c => c > 0);

        if (downloads.length === 0) return models;

        // Remove extreme outliers (beyond 3 standard deviations)
        const downloadStats = this.calculateStatistics(downloads);
        const contextStats = contextLengths.length > 0 ? this.calculateStatistics(contextLengths) : null;

        const filtered = models.filter(model => {
            // Filter by download outliers
            if (model.downloads > 0) {
                const downloadZScore = Math.abs((model.downloads - downloadStats.mean) / downloadStats.stdDev);
                if (downloadZScore > 3) return false;
            }

            // Filter by context length outliers
            if (contextStats && model.contextLength > 0) {
                const contextZScore = Math.abs((model.contextLength - contextStats.mean) / contextStats.stdDev);
                if (contextZScore > 3) return false;
            }

            return true;
        });

        logger.debug('📊 Statistical filtering removed outliers', {
            originalCount: models.length,
            filteredCount: filtered.length,
            removedOutliers: models.length - filtered.length,
            component: 'ModelFilter'
        });

        return filtered;
    }

    /**
     * Apply quality score filter
     */
    async applyQualityFilter(models, minQualityScore) {
        return models.filter(model => {
            const qualityScore = this.calculateQualityScore(model);
            return qualityScore >= minQualityScore;
        });
    }

    /**
     * Sort models by quality score
     */
    async sortModelsByQuality(models) {
        return models.sort((a, b) => {
            const scoreA = this.calculateQualityScore(a);
            const scoreB = this.calculateQualityScore(b);
            return scoreB - scoreA; // Descending order
        });
    }

    /**
     * Classify a model into categories
     */
    async classifyModel(model) {
        const categories = [];

        for (const [categoryId, category] of this.filterCategories.entries()) {
            if (await this.modelMatchesCategory(model, categoryId)) {
                categories.push(categoryId);
            }
        }

        return categories;
    }

    /**
     * Check if model matches a specific category
     */
    async modelMatchesCategory(model, categoryId) {
        const category = this.filterCategories.get(categoryId);
        if (!category) return false;

        // Check keywords
        if (category.keywords) {
            const modelText = `${model.name} ${model.description} ${model.task} ${model.tags?.join(' ') || ''}`.toLowerCase();
            if (category.keywords.some(keyword => modelText.includes(keyword.toLowerCase()))) {
                return true;
            }
        }

        // Check providers
        if (category.providers && category.providers.includes(model.provider)) {
            return true;
        }

        // Check criteria
        if (category.criteria) {
            return this.evaluateCondition(model, category.criteria);
        }

        return false;
    }

    /**
     * Evaluate a condition object against a model
     */
    evaluateCondition(model, condition) {
        for (const [field, criteria] of Object.entries(condition)) {
            const modelValue = this.getNestedValue(model, field);

            if (criteria.min !== undefined && modelValue < criteria.min) return false;
            if (criteria.max !== undefined && modelValue > criteria.max) return false;
            if (criteria.equals !== undefined && modelValue !== criteria.equals) return false;
            if (criteria.includes !== undefined && !modelValue?.includes(criteria.includes)) return false;
            if (criteria.exists !== undefined && (!!modelValue) !== criteria.exists) return false;

            // Direct comparison for simple criteria
            if (typeof criteria === 'number' && modelValue < criteria) return false;
            if (typeof criteria === 'string' && modelValue !== criteria) return false;
            if (typeof criteria === 'boolean' && (!!modelValue) !== criteria) return false;
        }

        return true;
    }

    /**
     * Generate embedding-based categories
     */
    async generateEmbeddingCategories(models) {
        try {
            const modelsWithEmbeddings = models.filter(m => m.embedding);
            if (modelsWithEmbeddings.length < 10) {
                return { message: 'Not enough models with embeddings for clustering' };
            }

            // Simple clustering based on embedding similarity
            const clusters = await this.clusterModelsByEmbeddings(modelsWithEmbeddings);
            
            return {
                clusters,
                totalClusters: clusters.length,
                averageClusterSize: clusters.length > 0 ? 
                    (clusters.reduce((sum, cluster) => sum + cluster.models.length, 0) / clusters.length).toFixed(1) : 0
            };

        } catch (error) {
            logger.warn('⚠️ Failed to generate embedding categories', {
                error: error.message,
                component: 'ModelFilter'
            });
            return { error: error.message };
        }
    }

    /**
     * Cluster models by embeddings
     */
    async clusterModelsByEmbeddings(models, maxClusters = 10) {
        // Simple k-means-style clustering
        const clusters = [];
        const used = new Set();

        while (clusters.length < maxClusters && used.size < models.length) {
            // Find seed model (not yet used)
            let seed = null;
            for (const model of models) {
                if (!used.has(model.id)) {
                    seed = model;
                    break;
                }
            }

            if (!seed) break;

            // Create cluster with similar models
            const cluster = {
                id: `cluster_${clusters.length + 1}`, 
                seed: seed.id,
                models: [seed],
                centroid: [...seed.embedding]
            };

            used.add(seed.id);

            // Find similar models
            for (const model of models) {
                if (used.has(model.id)) continue;

                const similarity = embeddingsManager.calculateSimilarity(seed.embedding, model.embedding);
                if (similarity > 0.8) { // High similarity threshold
                    cluster.models.push(model);
                    used.add(model.id);
                }
            }

            if (cluster.models.length >= 2) { // Only keep clusters with multiple models
                clusters.push(cluster);
            }
        }

        return clusters;
    }

    /**
     * Build category hierarchy
     */
    buildCategoryHierarchy(categoryStats) {
        const hierarchy = {};

        for (const [hierarchyId, hierarchyData] of this.categoryHierarchy.entries()) {
            hierarchy[hierarchyId] = {
                ...hierarchyData,
                categories: {}
            };

            for (const categoryId of hierarchyData.children) {
                if (categoryStats.has(categoryId)) {
                    hierarchy[hierarchyId].categories[categoryId] = categoryStats.get(categoryId);
                }
            }
        }

        return hierarchy;
    }

    /**
     * Calculate quality score for a model
     */
    calculateQualityScore(model) {
        let score = 0;
        let maxScore = 0;

        // Downloads factor (0-30 points)
        if (model.downloads > 0) {
            score += Math.min(Math.log10(model.downloads) * 5, 30);
        }
        maxScore += 30;

        // Description quality (0-20 points)
        if (model.description) {
            const descLength = model.description.length;
            if (descLength > 20) score += Math.min(descLength / 20, 20);
        }
        maxScore += 20;

        // Capabilities (0-15 points)
        if (model.capabilities && model.capabilities.length > 0) {
            score += Math.min(model.capabilities.length * 3, 15);
        }
        maxScore += 15;

        // Validation status (0-15 points)
        if (model.validated) score += 15;
        if (model.testResults?.success) score += 5;
        maxScore += 20;

        // Recency (0-10 points)
        if (model.lastModified) {
            const daysSinceUpdate = (Date.now() - new Date(model.lastModified)) / (1000 * 60 * 60 * 24);
            if (daysSinceUpdate < 180) { // 6 months
                score += Math.max(10 - (daysSinceUpdate / 18), 0);
            }
        }
        maxScore += 10;

        return maxScore > 0 ? (score / maxScore) * 100 : 0;
    }

    /**
     * Calculate average quality for a set of models
     */
    calculateAverageQuality(models) {
        if (!models.length) return 0;
        
        const totalScore = models.reduce((sum, model) => sum + this.calculateQualityScore(model), 0);
        return (totalScore / models.length).toFixed(2);
    }

    /**
     * Calculate statistics for a numeric array
     */
    calculateStatistics(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        return {
            mean,
            median: sorted[Math.floor(sorted.length / 2)],
            stdDev,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            count: values.length
        };
    }

    /**
     * Get nested value from object using dot notation
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * Get available categories
     */
    getAvailableCategories() {
        return Object.fromEntries(this.filterCategories);
    }

    /**
     * Get available filters
     */
    getAvailableFilters() {
        return Object.fromEntries(this.filterRules);
    }

    /**
     * Get filter status
     */
    getStatus() {
        return {
            filter: 'ModelFilter',
            categories: this.filterCategories.size,
            filters: this.filterRules.size,
            hierarchies: this.categoryHierarchy.size,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            this.filterCategories.clear();
            this.filterRules.clear();
            this.categoryHierarchy.clear();
            this.statisticalThresholds.clear();

            logger.info('🧹 Model Filter cleaned up', {
                component: 'ModelFilter'
            });
        } catch (error) {
            logger.error('❌ Error during Model Filter cleanup', {
                error: error.message,
                component: 'ModelFilter'
            });
        }
    }
}

// Export singleton instance
export const modelFilter = new ModelFilter();
export { ModelFilter, ProcessingError };