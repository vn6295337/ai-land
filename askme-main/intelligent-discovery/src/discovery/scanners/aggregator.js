/**
 * Model Data Aggregation and Deduplication
 * Module 4, Step 19: Implement model data aggregation and deduplication
 * 
 * Features:
 * - Cross-provider model deduplication
 * - Data normalization and standardization
 * - Intelligent model matching algorithms
 * - Conflict resolution and data merging
 * - Statistical analysis and reporting
 */

import { logger } from '../../core/infrastructure/logger.js';
import { config } from '../../core/infrastructure/config.js';
import { cacheManager } from '../../core/storage/cache.js';
import { embeddingsManager } from '../../core/storage/embeddings.js';
import { ProcessingError } from '../../core/infrastructure/errors.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

class ModelAggregator {
    constructor() {
        this.aggregationResults = new Map();
        this.deduplicationCache = new Map();
        this.matchingThresholds = {
            exact: 1.0,
            high: 0.95,
            medium: 0.85,
            low: 0.7
        };
        this.conflictResolutionStrategies = {
            'downloads': 'highest',
            'lastModified': 'latest',
            'description': 'longest',
            'capabilities': 'union',
            'pricing': 'lowest'
        };
        this.resultsDir = path.join('data', 'aggregation_results');
    }

    /**
     * Initialize the aggregator
     */
    async initialize() {
        try {
            logger.info('🔄 Initializing Model Aggregator...', {
                component: 'ModelAggregator'
            });

            // Ensure results directory exists
            await fs.mkdir(this.resultsDir, { recursive: true });

            logger.info('✅ Model Aggregator initialized', {
                component: 'ModelAggregator'
            });

            return {
                aggregator: 'ModelAggregator',
                initialized: true
            };
        } catch (error) {
            logger.error('❌ Failed to initialize Model Aggregator', {
                error: error.message,
                component: 'ModelAggregator'
            });
            throw new ProcessingError(`Aggregator initialization failed: ${error.message}`);
        }
    }

    /**
     * Aggregate models from multiple providers
     */
    async aggregateModels(providerResults, options = {}) {
        try {
            const {
                enableDeduplication = true,
                similarityThreshold = this.matchingThresholds.medium,
                conflictResolution = 'merge',
                includeProviderMetadata = true,
                generateEmbeddings = true
            } = options;

            logger.info('📊 Starting model aggregation', {
                providers: Object.keys(providerResults),
                enableDeduplication,
                similarityThreshold,
                conflictResolution,
                component: 'ModelAggregator'
            });

            const startTime = Date.now();
            const aggregationId = `aggregation_${startTime}`;

            // Step 1: Collect all models
            const allModels = await this.collectAllModels(providerResults, includeProviderMetadata);

            // Step 2: Normalize model data
            const normalizedModels = await this.normalizeModels(allModels);

            // Step 3: Generate embeddings if requested
            if (generateEmbeddings) {
                await this.generateModelEmbeddings(normalizedModels);
            }

            // Step 4: Perform deduplication
            let finalModels;
            let deduplicationStats;
            
            if (enableDeduplication) {
                const deduplicationResult = await this.deduplicateModels(
                    normalizedModels, 
                    similarityThreshold, 
                    conflictResolution
                );
                finalModels = deduplicationResult.models;
                deduplicationStats = deduplicationResult.stats;
            } else {
                finalModels = normalizedModels;
                deduplicationStats = { duplicatesFound: 0, duplicatesRemoved: 0 };
            }

            // Step 5: Generate aggregation statistics
            const stats = await this.generateAggregationStats(
                providerResults, 
                allModels, 
                finalModels, 
                deduplicationStats
            );

            // Step 6: Create final result
            const aggregationResult = {
                aggregationId,
                timestamp: new Date().toISOString(),
                options,
                models: finalModels,
                stats,
                duration: Date.now() - startTime,
                metadata: {
                    version: '1.0.0',
                    totalProviders: Object.keys(providerResults).length,
                    deduplicationEnabled: enableDeduplication,
                    embeddingsGenerated: generateEmbeddings
                }
            };

            // Step 7: Save results
            await this.saveAggregationResults(aggregationId, aggregationResult);

            // Step 8: Cache results
            await cacheManager.cacheApiResponse('aggregator', 'models', options, aggregationResult, {
                ttl: 3600 // 1 hour cache
            });

            this.aggregationResults.set(aggregationId, aggregationResult);

            logger.info('✅ Model aggregation completed', {
                aggregationId,
                totalModels: finalModels.length,
                duplicatesRemoved: deduplicationStats.duplicatesRemoved,
                duration: `${aggregationResult.duration}ms`,
                component: 'ModelAggregator'
            });

            return aggregationResult;

        } catch (error) {
            logger.error('❌ Model aggregation failed', {
                error: error.message,
                providers: Object.keys(providerResults || {}),
                component: 'ModelAggregator'
            });
            throw new ProcessingError(`Model aggregation failed: ${error.message}`);
        }
    }

    /**
     * Collect all models from provider results
     */
    async collectAllModels(providerResults, includeProviderMetadata) {
        const allModels = [];
        let totalCollected = 0;

        logger.info('📥 Collecting models from all providers', {
            providers: Object.keys(providerResults),
            component: 'ModelAggregator'
        });

        for (const [providerName, providerResult] of Object.entries(providerResults)) {
            try {
                const models = providerResult.results || providerResult.models || [];
                
                for (const model of models) {
                    // Add provider context
                    const enrichedModel = {
                        ...model,
                        aggregationMetadata: {
                            sourceProvider: providerName,
                            collectedAt: new Date().toISOString(),
                            originalProvider: model.provider || providerName
                        }
                    };

                    if (includeProviderMetadata) {
                        enrichedModel.providerStats = providerResult.stats;
                        enrichedModel.providerSummary = providerResult.summary;
                    }

                    allModels.push(enrichedModel);
                    totalCollected++;
                }

                logger.debug(`📦 Collected ${models.length} models from ${providerName}`, {
                    component: 'ModelAggregator'
                });

            } catch (error) {
                logger.warn(`⚠️ Failed to collect models from provider: ${providerName}`, {
                    error: error.message,
                    component: 'ModelAggregator'
                });
            }
        }

        logger.info('✅ Model collection completed', {
            totalCollected,
            providers: Object.keys(providerResults).length,
            component: 'ModelAggregator'
        });

        return allModels;
    }

    /**
     * Normalize model data across providers
     */
    async normalizeModels(models) {
        logger.info('🔄 Normalizing model data', {
            totalModels: models.length,
            component: 'ModelAggregator'
        });

        const normalizedModels = [];

        for (const model of models) {
            try {
                const normalized = await this.normalizeModelData(model);
                normalizedModels.push(normalized);
            } catch (error) {
                logger.warn('⚠️ Failed to normalize model', {
                    modelId: model.id || 'unknown',
                    provider: model.provider,
                    error: error.message,
                    component: 'ModelAggregator'
                });
                // Include original model if normalization fails
                normalizedModels.push(model);
            }
        }

        logger.info('✅ Model normalization completed', {
            normalized: normalizedModels.length,
            component: 'ModelAggregator'
        });

        return normalizedModels;
    }

    /**
     * Normalize individual model data
     */
    async normalizeModelData(model) {
        // Create normalized model structure
        const normalized = {
            // Core identification (standardized)
            id: this.normalizeModelId(model.id),
            name: model.name || model.id?.split('/').pop() || 'unknown',
            fullName: model.fullName || model.id,
            provider: model.provider || model.aggregationMetadata?.originalProvider,
            
            // Metadata (standardized)
            description: this.normalizeDescription(model.description),
            author: this.normalizeAuthor(model.author, model.provider),
            createdAt: this.normalizeDate(model.createdAt),
            lastModified: this.normalizeDate(model.lastModified),
            
            // Technical details (standardized)
            task: this.normalizeTask(model.task),
            architecture: model.architecture || 'unknown',
            contextLength: this.normalizeNumber(model.contextLength),
            maxTokens: this.normalizeNumber(model.maxTokens),
            
            // Capabilities (standardized array)
            capabilities: this.normalizeCapabilities(model.capabilities),
            useCases: this.normalizeUseCases(model.useCases),
            
            // Usage statistics (standardized)
            downloads: this.normalizeNumber(model.downloads) || 0,
            likes: this.normalizeNumber(model.likes) || 0,
            
            // API information (standardized)
            apiEndpoint: model.apiEndpoint,
            streamingSupported: this.normalizeBoolean(model.streamingSupported),
            functionCalling: this.normalizeBoolean(model.functionCalling),
            
            // Pricing (standardized structure)
            pricing: this.normalizePricing(model.pricing),
            
            // Requirements (standardized structure)
            requirements: this.normalizeRequirements(model.requirements),
            
            // Model properties
            inputTypes: this.normalizeArray(model.inputTypes) || ['text'],
            outputTypes: this.normalizeArray(model.outputTypes) || ['text'],
            
            // Tags and categories
            tags: this.normalizeArray(model.tags) || [],
            
            // Validation status
            validated: this.normalizeBoolean(model.validated) || false,
            validationResults: model.validationResults,
            testResults: model.testResults,
            
            // Embeddings (if generated)
            embedding: model.embedding,
            
            // Metadata preservation
            originalData: {
                provider: model.provider,
                originalId: model.id,
                sourceMetadata: model.aggregationMetadata
            },
            
            // Normalization metadata
            normalizationMetadata: {
                normalizedAt: new Date().toISOString(),
                version: '1.0.0'
            }
        };

        // Calculate model hash for deduplication
        normalized.modelHash = this.calculateModelHash(normalized);

        return normalized;
    }

    /**
     * Generate embeddings for models
     */
    async generateModelEmbeddings(models) {
        logger.info('🧠 Generating embeddings for models', {
            totalModels: models.length,
            component: 'ModelAggregator'
        });

        let successful = 0;
        let failed = 0;

        for (const model of models) {
            try {
                if (!model.embedding) {
                    const embedding = await embeddingsManager.generateModelEmbedding(model);
                    model.embedding = embedding;
                    successful++;
                }
            } catch (error) {
                logger.warn('⚠️ Failed to generate embedding for model', {
                    modelId: model.id,
                    provider: model.provider,
                    error: error.message,
                    component: 'ModelAggregator'
                });
                failed++;
            }
        }

        logger.info('✅ Embedding generation completed', {
            successful,
            failed,
            component: 'ModelAggregator'
        });
    }

    /**
     * Deduplicate models using multiple strategies
     */
    async deduplicateModels(models, similarityThreshold, conflictResolution) {
        logger.info('🔍 Starting model deduplication', {
            totalModels: models.length,
            similarityThreshold,
            conflictResolution,
            component: 'ModelAggregator'
        });

        const startTime = Date.now();
        const duplicateGroups = new Map();
        const processedModels = new Set();
        const finalModels = [];
        
        let duplicatesFound = 0;
        let duplicatesRemoved = 0;

        // Step 1: Find duplicate groups
        for (let i = 0; i < models.length; i++) {
            if (processedModels.has(i)) continue;

            const model = models[i];
            const duplicateGroup = [i];

            // Find all similar models
            for (let j = i + 1; j < models.length; j++) {
                if (processedModels.has(j)) continue;

                const otherModel = models[j];
                const similarity = await this.calculateModelSimilarity(model, otherModel);

                if (similarity >= similarityThreshold) {
                    duplicateGroup.push(j);
                    processedModels.add(j);
                    duplicatesFound++;
                }
            }

            processedModels.add(i);
            duplicateGroups.set(i, duplicateGroup);
        }

        // Step 2: Resolve conflicts and merge duplicates
        for (const [primaryIndex, groupIndices] of duplicateGroups.entries()) {
            if (groupIndices.length === 1) {
                // No duplicates, add as-is
                finalModels.push(models[primaryIndex]);
            } else {
                // Merge duplicates
                const groupModels = groupIndices.map(index => models[index]);
                const mergedModel = await this.mergeModels(groupModels, conflictResolution);
                finalModels.push(mergedModel);
                duplicatesRemoved += groupIndices.length - 1;

                logger.debug('🔗 Merged duplicate models', {
                    primaryId: models[primaryIndex].id,
                    duplicateCount: groupIndices.length - 1,
                    component: 'ModelAggregator'
                });
            }
        }

        const deduplicationStats = {
            duplicatesFound,
            duplicatesRemoved,
            originalCount: models.length,
            finalCount: finalModels.length,
            deduplicationRate: ((duplicatesRemoved / models.length) * 100).toFixed(1) + '%',
            duration: Date.now() - startTime
        };

        logger.info('✅ Model deduplication completed', {
            ...deduplicationStats,
            component: 'ModelAggregator'
        });

        return {
            models: finalModels,
            stats: deduplicationStats
        };
    }

    /**
     * Calculate similarity between two models
     */
    async calculateModelSimilarity(model1, model2) {
        let similarity = 0;
        let factors = 0;

        // Exact ID match (highest weight)
        if (model1.id === model2.id) {
            similarity += 1.0 * 0.4;
        } else if (this.normalizeModelId(model1.id) === this.normalizeModelId(model2.id)) {
            similarity += 0.9 * 0.4;
        }
        factors += 0.4;

        // Name similarity
        if (model1.name && model2.name) {
            const nameSimilarity = this.calculateStringSimilarity(model1.name, model2.name);
            similarity += nameSimilarity * 0.3;
        }
        factors += 0.3;

        // Provider and author
        if (model1.provider === model2.provider && model1.author === model2.author) {
            similarity += 1.0 * 0.2;
        } else if (model1.provider === model2.provider || model1.author === model2.author) {
            similarity += 0.5 * 0.2;
        }
        factors += 0.2;

        // Embedding similarity (if available)
        if (model1.embedding && model2.embedding) {
            const embeddingSimilarity = embeddingsManager.calculateSimilarity(
                model1.embedding, 
                model2.embedding
            );
            similarity += embeddingSimilarity * 0.1;
        }
        factors += 0.1;

        return factors > 0 ? similarity / factors : 0;
    }

    /**
     * Merge multiple models into one
     */
    async mergeModels(models, conflictResolution) {
        logger.debug('🔗 Merging models', {
            modelCount: models.length,
            primaryId: models[0].id,
            component: 'ModelAggregator'
        });

        // Start with the first model as base
        const mergedModel = { ...models[0] };

        // Merge data from other models
        for (let i = 1; i < models.length; i++) {
            const model = models[i];
            
            // Merge specific fields based on conflict resolution strategy
            for (const [field, strategy] of Object.entries(this.conflictResolutionStrategies)) {
                if (model[field] !== undefined) {
                    mergedModel[field] = this.resolveFieldConflict(
                        mergedModel[field], 
                        model[field], 
                        strategy
                    );
                }
            }

            // Merge arrays (union)
            for (const arrayField of ['capabilities', 'useCases', 'tags', 'inputTypes', 'outputTypes']) {
                if (Array.isArray(model[arrayField])) {
                    mergedModel[arrayField] = [
                        ...new Set([
                            ...(mergedModel[arrayField] || []),
                            ...model[arrayField]
                        ])
                    ];
                }
            }
        }

        // Add merge metadata
        mergedModel.mergeMetadata = {
            mergedAt: new Date().toISOString(),
            sourceModels: models.map(m => ({
                id: m.id,
                provider: m.provider,
                modelHash: m.modelHash
            })),
            conflictResolution,
            mergedCount: models.length
        };

        // Recalculate hash
        mergedModel.modelHash = this.calculateModelHash(mergedModel);

        return mergedModel;
    }

    /**
     * Resolve field conflicts based on strategy
     */
    resolveFieldConflict(currentValue, newValue, strategy) {
        if (currentValue === undefined || currentValue === null) {
            return newValue;
        }
        if (newValue === undefined || newValue === null) {
            return currentValue;
        }

        switch (strategy) {
            case 'highest':
                return Math.max(Number(currentValue) || 0, Number(newValue) || 0);
            
            case 'lowest':
                return Math.min(Number(currentValue) || 0, Number(newValue) || 0);
            
            case 'latest':
                const currentDate = new Date(currentValue);
                const newDate = new Date(newValue);
                return newDate > currentDate ? newValue : currentValue;
            
            case 'longest':
                return String(newValue).length > String(currentValue).length ? newValue : currentValue;
            
            case 'union':
                if (Array.isArray(currentValue) && Array.isArray(newValue)) {
                    return [...new Set([...currentValue, ...newValue])];
                }
                return newValue;
            
            default:
                return newValue; // Default to new value
        }
    }

    /**
     * Generate aggregation statistics
     */
    async generateAggregationStats(providerResults, allModels, finalModels, deduplicationStats) {
        const providerStats = {};
        let totalOriginalModels = 0;

        // Calculate per-provider statistics
        for (const [providerName, providerResult] of Object.entries(providerResults)) {
            const models = providerResult.results || providerResult.models || [];
            totalOriginalModels += models.length;
            
            providerStats[providerName] = {
                originalCount: models.length,
                contribution: models.length > 0 ? ((models.length / totalOriginalModels) * 100).toFixed(1) + '%' : '0%',
                averageQuality: this.calculateAverageQuality(models)
            };
        }

        // Calculate task distribution
        const taskDistribution = {};
        finalModels.forEach(model => {
            const task = model.task || 'unknown';
            taskDistribution[task] = (taskDistribution[task] || 0) + 1;
        });

        // Calculate provider distribution in final set
        const finalProviderDistribution = {};
        finalModels.forEach(model => {
            const provider = model.provider || 'unknown';
            finalProviderDistribution[provider] = (finalProviderDistribution[provider] || 0) + 1;
        });

        return {
            aggregation: {
                totalProvidersScanned: Object.keys(providerResults).length,
                totalModelsCollected: allModels.length,
                totalModelsFinal: finalModels.length,
                reductionRate: ((allModels.length - finalModels.length) / allModels.length * 100).toFixed(1) + '%'
            },
            deduplication: deduplicationStats,
            providers: providerStats,
            distribution: {
                byTask: taskDistribution,
                byProvider: finalProviderDistribution
            },
            quality: {
                averageDownloads: this.calculateAverage(finalModels, 'downloads'),
                modelsWithEmbeddings: finalModels.filter(m => m.embedding).length,
                validatedModels: finalModels.filter(m => m.validated).length,
                modelsWithTests: finalModels.filter(m => m.testResults).length
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Save aggregation results
     */
    async saveAggregationResults(aggregationId, results) {
        try {
            const filename = `${aggregationId}.json`;
            const filepath = path.join(this.resultsDir, filename);
            
            await fs.writeFile(filepath, JSON.stringify(results, null, 2));
            
            logger.debug('💾 Aggregation results saved', {
                aggregationId,
                filepath,
                modelCount: results.models.length,
                component: 'ModelAggregator'
            });

        } catch (error) {
            logger.warn('⚠️ Failed to save aggregation results', {
                aggregationId,
                error: error.message,
                component: 'ModelAggregator'
            });
        }
    }

    // Utility functions for normalization
    normalizeModelId(id) {
        return String(id || '').toLowerCase().trim();
    }

    normalizeDescription(description) {
        return description ? String(description).trim() : null;
    }

    normalizeAuthor(author, provider) {
        return author ? String(author).trim() : provider;
    }

    normalizeDate(date) {
        if (!date) return null;
        try {
            return new Date(date).toISOString();
        } catch {
            return null;
        }
    }

    normalizeTask(task) {
        return task ? String(task).toLowerCase().trim() : 'unknown';
    }

    normalizeNumber(value) {
        const num = Number(value);
        return isNaN(num) ? null : num;
    }

    normalizeCapabilities(capabilities) {
        if (!Array.isArray(capabilities)) return [];
        return capabilities.map(cap => String(cap).toLowerCase().trim()).filter(Boolean);
    }

    normalizeUseCases(useCases) {
        if (!Array.isArray(useCases)) return [];
        return useCases.map(uc => String(uc).toLowerCase().trim()).filter(Boolean);
    }

    normalizeBoolean(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value.toLowerCase() === 'true';
        return !!value;
    }

    normalizePricing(pricing) {
        if (!pricing || typeof pricing !== 'object') return null;
        
        const normalized = {};
        for (const [key, value] of Object.entries(pricing)) {
            const numValue = Number(value);
            if (!isNaN(numValue)) {
                normalized[key] = numValue;
            }
        }
        
        return Object.keys(normalized).length > 0 ? normalized : null;
    }

    normalizeRequirements(requirements) {
        if (!requirements || typeof requirements !== 'object') return {};
        return { ...requirements };
    }

    normalizeArray(arr) {
        if (!Array.isArray(arr)) return null;
        return arr.filter(item => item != null);
    }

    calculateModelHash(model) {
        // Create hash based on core identifying features
        const hashData = {
            id: model.id,
            name: model.name,
            provider: model.provider,
            author: model.author,
            task: model.task
        };
        
        return crypto
            .createHash('sha256')
            .update(JSON.stringify(hashData))
            .digest('hex')
            .substring(0, 16);
    }

    calculateStringSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        
        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();
        
        if (s1 === s2) return 1;
        
        // Simple Levenshtein-based similarity
        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;
        
        if (longer.length === 0) return 1;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    calculateAverageQuality(models) {
        if (!models.length) return 0;
        
        let totalScore = 0;
        let count = 0;
        
        models.forEach(model => {
            let score = 0;
            let factors = 0;
            
            // Downloads factor
            if (model.downloads > 0) {
                score += Math.min(model.downloads / 1000, 10); // Max 10 points
                factors += 10;
            }
            
            // Description factor
            if (model.description && model.description.length > 20) {
                score += 5;
            }
            factors += 5;
            
            // Capabilities factor
            if (model.capabilities && model.capabilities.length > 0) {
                score += Math.min(model.capabilities.length, 5);
            }
            factors += 5;
            
            if (factors > 0) {
                totalScore += score / factors;
                count++;
            }
        });
        
        return count > 0 ? (totalScore / count).toFixed(2) : 0;
    }

    calculateAverage(models, field) {
        const values = models
            .map(model => Number(model[field]))
            .filter(value => !isNaN(value) && value > 0);
        
        return values.length > 0 
            ? Math.round(values.reduce((sum, val) => sum + val, 0) / values.length)
            : 0;
    }

    /**
     * Get aggregator status
     */
    getStatus() {
        return {
            aggregator: 'ModelAggregator',
            completedAggregations: this.aggregationResults.size,
            cacheSize: this.deduplicationCache.size,
            matchingThresholds: this.matchingThresholds,
            conflictResolutionStrategies: this.conflictResolutionStrategies,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            this.aggregationResults.clear();
            this.deduplicationCache.clear();

            logger.info('🧹 Model Aggregator cleaned up', {
                component: 'ModelAggregator'
            });
        } catch (error) {
            logger.error('❌ Error during Model Aggregator cleanup', {
                error: error.message,
                component: 'ModelAggregator'
            });
        }
    }
}

// Export singleton instance
export const modelAggregator = new ModelAggregator();
export { ModelAggregator, ProcessingError };