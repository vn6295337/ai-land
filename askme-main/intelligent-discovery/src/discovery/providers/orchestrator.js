/**
 * LangChain Orchestration Framework
 * Module 3, Step 14: Create LangChain orchestration framework
 * 
 * Features:
 * - Unified interface for all AI providers
 * - Model discovery orchestration across providers
 * - Parallel and sequential processing coordination
 * - Error handling and fallback mechanisms
 * - Results aggregation and normalization
 */

import { logger } from '../../core/infrastructure/logger.js';
import { config } from '../../core/infrastructure/config.js';
import { cacheManager } from '../../core/storage/cache.js';
import { embeddingsManager } from '../../core/storage/embeddings.js';
import { ProcessingError } from '../../core/infrastructure/errors.js';

// Import all providers
import { huggingFaceProvider } from './huggingface.js';
import { openaiProvider } from './openai.js';
import { anthropicProvider } from './anthropic.js';
import { googleProvider } from './google.js';

class ProviderOrchestrator {
    constructor() {
        this.providers = new Map();
        this.isInitialized = false;
        this.discoveryConfig = config.getDiscoveryConfig();
        this.rateLimitConfig = config.getRateLimitConfig();
        this.discoveryResults = new Map();
        this.activeDiscoveries = new Set();
    }

    /**
     * Initialize the orchestrator and all providers
     */
    async initialize() {
        try {
            logger.info('🎼 Initializing Provider Orchestrator...', {
                component: 'ProviderOrchestrator'
            });

            // Register all available providers
            this.registerProvider('huggingface', huggingFaceProvider);
            this.registerProvider('openai', openaiProvider);
            this.registerProvider('anthropic', anthropicProvider);
            this.registerProvider('google', googleProvider);

            // Initialize available providers
            const initResults = await this.initializeProviders();
            
            this.isInitialized = true;

            logger.info('✅ Provider Orchestrator initialized successfully', {
                totalProviders: this.providers.size,
                initializedProviders: initResults.initialized.length,
                failedProviders: initResults.failed.length,
                component: 'ProviderOrchestrator'
            });

            return {
                orchestrator: 'initialized',
                providers: initResults,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('❌ Failed to initialize Provider Orchestrator', {
                error: error.message,
                component: 'ProviderOrchestrator'
            });
            throw new ProcessingError(`Orchestrator initialization failed: ${error.message}`);
        }
    }

    /**
     * Register a provider with the orchestrator
     */
    registerProvider(name, provider) {
        this.providers.set(name, {
            instance: provider,
            initialized: false,
            lastDiscovery: null,
            stats: null
        });

        logger.debug(`📝 Registered provider: ${name}`, {
            component: 'ProviderOrchestrator'
        });
    }

    /**
     * Initialize all registered providers
     */
    async initializeProviders() {
        const results = {
            initialized: [],
            failed: [],
            skipped: []
        };

        const initPromises = Array.from(this.providers.entries()).map(async ([name, providerData]) => {
            try {
                logger.debug(`🔄 Initializing provider: ${name}`, {
                    component: 'ProviderOrchestrator'
                });

                const initResult = await providerData.instance.initialize();
                
                providerData.initialized = true;
                providerData.stats = await providerData.instance.getStats();
                
                results.initialized.push({
                    name,
                    result: initResult,
                    stats: providerData.stats
                });

                logger.info(`✅ Provider initialized: ${name}`, {
                    component: 'ProviderOrchestrator'
                });
            } catch (error) {
                providerData.initialized = false;
                results.failed.push({
                    name,
                    error: error.message
                });

                logger.warn(`⚠️ Provider initialization failed: ${name}`, {
                    error: error.message,
                    component: 'ProviderOrchestrator'
                });
            }
        });

        await Promise.allSettled(initPromises);
        return results;
    }

    /**
     * Discover models from all providers
     */
    async discoverAllModels(options = {}) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            const {
                providers = null, // null = all providers
                parallel = true,
                includeEmbeddings = true,
                maxModelsPerProvider = this.discoveryConfig.maxModelsPerProvider,
                timeout = this.discoveryConfig.timeout
            } = options;

            logger.info('🔍 Starting comprehensive model discovery', {
                requestedProviders: providers || 'all',
                parallel,
                maxModelsPerProvider,
                timeout,
                component: 'ProviderOrchestrator'
            });

            // Get list of providers to discover from
            const providersToDiscover = providers 
                ? providers.filter(name => this.providers.has(name))
                : Array.from(this.providers.keys()).filter(name => this.providers.get(name).initialized);

            if (providersToDiscover.length === 0) {
                throw new ProcessingError('No initialized providers available for discovery');
            }

            // Execute discovery
            const discoveryResults = parallel 
                ? await this.discoverModelsParallel(providersToDiscover, options)
                : await this.discoverModelsSequential(providersToDiscover, options);

            // Aggregate and normalize results
            const aggregatedResults = await this.aggregateDiscoveryResults(discoveryResults, options);

            // Generate embeddings if requested
            if (includeEmbeddings) {
                await this.generateModelEmbeddings(aggregatedResults.models);
            }

            // Cache comprehensive results
            await cacheManager.cacheApiResponse('orchestrator', 'comprehensive_discovery', options, aggregatedResults, {
                ttl: 1800 // 30 minutes cache for comprehensive discovery
            });

            logger.info('✅ Comprehensive model discovery completed', {
                totalModels: aggregatedResults.totalModels,
                byProvider: aggregatedResults.byProvider,
                duration: aggregatedResults.duration,
                component: 'ProviderOrchestrator'
            });

            return aggregatedResults;
        } catch (error) {
            logger.error('❌ Comprehensive model discovery failed', {
                error: error.message,
                options,
                component: 'ProviderOrchestrator'
            });
            throw new ProcessingError(`Model discovery failed: ${error.message}`);
        }
    }

    /**
     * Discover models from providers in parallel
     */
    async discoverModelsParallel(providerNames, options) {
        const startTime = Date.now();
        const results = new Map();

        logger.info(`🚀 Starting parallel discovery across ${providerNames.length} providers`, {
            providers: providerNames,
            component: 'ProviderOrchestrator'
        });

        // Create discovery promises with timeout
        const discoveryPromises = providerNames.map(async (providerName) => {
            const discoveryId = `${providerName}_${Date.now()}`;
            this.activeDiscoveries.add(discoveryId);

            try {
                const provider = this.providers.get(providerName);
                if (!provider || !provider.initialized) {
                    throw new Error(`Provider ${providerName} not initialized`);
                }

                logger.debug(`🔄 Starting discovery: ${providerName}`, {
                    component: 'ProviderOrchestrator'
                });

                // Add timeout wrapper
                const discoveryPromise = provider.instance.discoverModels({
                    limit: options.maxModelsPerProvider || this.discoveryConfig.maxModelsPerProvider
                });

                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Discovery timeout')), options.timeout || this.discoveryConfig.timeout);
                });

                const models = await Promise.race([discoveryPromise, timeoutPromise]);

                results.set(providerName, {
                    success: true,
                    models,
                    count: models.length,
                    timestamp: new Date().toISOString()
                });

                logger.info(`✅ Discovery completed: ${providerName}`, {
                    modelsFound: models.length,
                    component: 'ProviderOrchestrator'
                });

            } catch (error) {
                results.set(providerName, {
                    success: false,
                    error: error.message,
                    models: [],
                    count: 0,
                    timestamp: new Date().toISOString()
                });

                logger.warn(`⚠️ Discovery failed: ${providerName}`, {
                    error: error.message,
                    component: 'ProviderOrchestrator'
                });
            } finally {
                this.activeDiscoveries.delete(discoveryId);
            }
        });

        // Wait for all discoveries to complete
        await Promise.allSettled(discoveryPromises);

        const endTime = Date.now();
        logger.info('🏁 Parallel discovery completed', {
            duration: `${endTime - startTime}ms`,
            successful: Array.from(results.values()).filter(r => r.success).length,
            failed: Array.from(results.values()).filter(r => !r.success).length,
            component: 'ProviderOrchestrator'
        });

        return results;
    }

    /**
     * Discover models from providers sequentially
     */
    async discoverModelsSequential(providerNames, options) {
        const startTime = Date.now();
        const results = new Map();

        logger.info(`🔄 Starting sequential discovery across ${providerNames.length} providers`, {
            providers: providerNames,
            component: 'ProviderOrchestrator'
        });

        for (const providerName of providerNames) {
            const discoveryId = `${providerName}_${Date.now()}`;
            this.activeDiscoveries.add(discoveryId);

            try {
                const provider = this.providers.get(providerName);
                if (!provider || !provider.initialized) {
                    throw new Error(`Provider ${providerName} not initialized`);
                }

                logger.debug(`🔄 Starting discovery: ${providerName}`, {
                    component: 'ProviderOrchestrator'
                });

                const models = await provider.instance.discoverModels({
                    limit: options.maxModelsPerProvider || this.discoveryConfig.maxModelsPerProvider
                });

                results.set(providerName, {
                    success: true,
                    models,
                    count: models.length,
                    timestamp: new Date().toISOString()
                });

                logger.info(`✅ Discovery completed: ${providerName}`, {
                    modelsFound: models.length,
                    component: 'ProviderOrchestrator'
                });

            } catch (error) {
                results.set(providerName, {
                    success: false,
                    error: error.message,
                    models: [],
                    count: 0,
                    timestamp: new Date().toISOString()
                });

                logger.warn(`⚠️ Discovery failed: ${providerName}`, {
                    error: error.message,
                    component: 'ProviderOrchestrator'
                });
            } finally {
                this.activeDiscoveries.delete(discoveryId);
            }

            // Small delay between sequential requests to be respectful
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const endTime = Date.now();
        logger.info('🏁 Sequential discovery completed', {
            duration: `${endTime - startTime}ms`,
            component: 'ProviderOrchestrator'
        });

        return results;
    }

    /**
     * Aggregate and normalize discovery results
     */
    async aggregateDiscoveryResults(discoveryResults, options) {
        const startTime = Date.now();
        
        logger.info('📊 Aggregating discovery results', {
            providersProcessed: discoveryResults.size,
            component: 'ProviderOrchestrator'
        });

        const aggregated = {
            totalModels: 0,
            byProvider: {},
            models: [],
            successful: [],
            failed: [],
            duplicates: 0,
            timestamp: new Date().toISOString(),
            options
        };

        const seenModels = new Set();

        // Process results from each provider
        for (const [providerName, result] of discoveryResults.entries()) {
            aggregated.byProvider[providerName] = {
                success: result.success,
                count: result.count,
                timestamp: result.timestamp
            };

            if (result.success) {
                aggregated.successful.push(providerName);
                
                // Add models with deduplication
                for (const model of result.models) {
                    const modelKey = `${model.provider}:${model.id}`;
                    
                    if (seenModels.has(modelKey)) {
                        aggregated.duplicates++;
                        logger.debug('🔄 Duplicate model detected', {
                            modelId: model.id,
                            provider: model.provider,
                            component: 'ProviderOrchestrator'
                        });
                    } else {
                        seenModels.add(modelKey);
                        aggregated.models.push(model);
                        aggregated.totalModels++;
                    }
                }
            } else {
                aggregated.failed.push({
                    provider: providerName,
                    error: result.error
                });
            }
        }

        // Sort models by provider and name for consistency
        aggregated.models.sort((a, b) => {
            if (a.provider !== b.provider) {
                return a.provider.localeCompare(b.provider);
            }
            return a.name.localeCompare(b.name);
        });

        const endTime = Date.now();
        aggregated.duration = `${endTime - startTime}ms`;

        logger.info('✅ Discovery results aggregated', {
            totalModels: aggregated.totalModels,
            duplicatesRemoved: aggregated.duplicates,
            successfulProviders: aggregated.successful.length,
            failedProviders: aggregated.failed.length,
            component: 'ProviderOrchestrator'
        });

        return aggregated;
    }

    /**
     * Generate embeddings for discovered models
     */
    async generateModelEmbeddings(models) {
        try {
            logger.info('🧠 Generating embeddings for discovered models', {
                modelCount: models.length,
                component: 'ProviderOrchestrator'
            });

            const embeddingPromises = models.map(async (model) => {
                try {
                    // Generate embedding for the model metadata
                    const embedding = await embeddingsManager.generateModelEmbedding(model);
                    model.embedding = embedding;
                    
                    return { success: true, modelId: model.id };
                } catch (error) {
                    logger.warn('⚠️ Failed to generate embedding for model', {
                        modelId: model.id,
                        provider: model.provider,
                        error: error.message,
                        component: 'ProviderOrchestrator'
                    });
                    return { success: false, modelId: model.id, error: error.message };
                }
            });

            const embeddingResults = await Promise.allSettled(embeddingPromises);
            const successful = embeddingResults.filter(r => r.status === 'fulfilled' && r.value.success).length;

            logger.info('✅ Model embeddings generated', {
                successful,
                failed: models.length - successful,
                component: 'ProviderOrchestrator'
            });

        } catch (error) {
            logger.error('❌ Failed to generate model embeddings', {
                error: error.message,
                component: 'ProviderOrchestrator'
            });
        }
    }

    /**
     * Get specific models by criteria
     */
    async findModels(criteria = {}) {
        try {
            const {
                provider = null,
                task = null,
                capabilities = null,
                name = null,
                limit = 100
            } = criteria;

            logger.info('🔍 Finding models by criteria', {
                criteria,
                component: 'ProviderOrchestrator'
            });

            // Check cache first
            const cacheKey = `find_models_${JSON.stringify(criteria)}`;
            const cached = await cacheManager.get(cacheKey);
            if (cached) {
                logger.debug('📋 Retrieved filtered models from cache', {
                    count: cached.length,
                    component: 'ProviderOrchestrator'
                });
                return cached;
            }

            // Get comprehensive model list
            const allModels = await this.discoverAllModels({ includeEmbeddings: false });
            
            // Filter models based on criteria
            let filteredModels = allModels.models;

            if (provider) {
                filteredModels = filteredModels.filter(model => model.provider === provider);
            }

            if (task) {
                filteredModels = filteredModels.filter(model => model.task === task);
            }

            if (capabilities) {
                const requiredCapabilities = Array.isArray(capabilities) ? capabilities : [capabilities];
                filteredModels = filteredModels.filter(model => 
                    requiredCapabilities.every(cap => model.capabilities.includes(cap))
                );
            }

            if (name) {
                const searchTerm = name.toLowerCase();
                filteredModels = filteredModels.filter(model => 
                    model.name.toLowerCase().includes(searchTerm) ||
                    model.id.toLowerCase().includes(searchTerm)
                );
            }

            // Apply limit
            const results = filteredModels.slice(0, limit);

            // Cache results
            await cacheManager.set(cacheKey, results, { ttl: 1800 });

            logger.info('✅ Models found', {
                totalFound: filteredModels.length,
                returned: results.length,
                criteria,
                component: 'ProviderOrchestrator'
            });

            return results;
        } catch (error) {
            logger.error('❌ Failed to find models', {
                error: error.message,
                criteria,
                component: 'ProviderOrchestrator'
            });
            throw new ProcessingError(`Model search failed: ${error.message}`);
        }
    }

    /**
     * Get orchestrator statistics
     */
    async getStats() {
        const stats = {
            orchestrator: 'ProviderOrchestrator',
            isInitialized: this.isInitialized,
            providers: {},
            discoveries: {
                active: this.activeDiscoveries.size,
                cached: this.discoveryResults.size
            },
            configuration: {
                discovery: this.discoveryConfig,
                rateLimit: this.rateLimitConfig
            },
            timestamp: new Date().toISOString()
        };

        // Get stats from each provider
        for (const [name, providerData] of this.providers.entries()) {
            try {
                stats.providers[name] = {
                    initialized: providerData.initialized,
                    lastDiscovery: providerData.lastDiscovery,
                    stats: providerData.initialized ? await providerData.instance.getStats() : null
                };
            } catch (error) {
                stats.providers[name] = {
                    initialized: providerData.initialized,
                    error: error.message
                };
            }
        }

        return stats;
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            logger.info('🧹 Cleaning up Provider Orchestrator', {
                component: 'ProviderOrchestrator'
            });

            // Clear active discoveries
            this.activeDiscoveries.clear();
            this.discoveryResults.clear();

            // Cleanup all providers
            const cleanupPromises = Array.from(this.providers.values()).map(async (providerData) => {
                if (providerData.initialized) {
                    try {
                        await providerData.instance.cleanup();
                    } catch (error) {
                        logger.warn('⚠️ Provider cleanup failed', {
                            error: error.message,
                            component: 'ProviderOrchestrator'
                        });
                    }
                }
            });

            await Promise.allSettled(cleanupPromises);

            this.providers.clear();
            this.isInitialized = false;

            logger.info('✅ Provider Orchestrator cleaned up', {
                component: 'ProviderOrchestrator'
            });
        } catch (error) {
            logger.error('❌ Error during orchestrator cleanup', {
                error: error.message,
                component: 'ProviderOrchestrator'
            });
        }
    }
}

// Export singleton instance
export const providerOrchestrator = new ProviderOrchestrator();
export { ProviderOrchestrator, ProcessingError };