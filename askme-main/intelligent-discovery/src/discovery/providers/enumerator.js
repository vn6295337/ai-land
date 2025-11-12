/**
 * Provider-Specific Model Enumeration Functions
 * Module 3, Step 15: Build provider-specific model enumeration functions
 * 
 * Features:
 * - Specialized enumeration logic for each provider
 * - Model categorization and filtering
 * - Batch processing and pagination
 * - Provider-specific optimizations
 * - Model validation and verification
 */

import { logger } from '../../core/infrastructure/logger.js';
import { config } from '../../core/infrastructure/config.js';
import { cacheManager } from '../../core/storage/cache.js';
import { ProcessingError } from '../../core/infrastructure/errors.js';

class ModelEnumerator {
    constructor() {
        this.providers = new Map();
        this.enumerationStrategies = new Map();
        this.filters = new Map();
        this.batchSizes = new Map();
        this.setupEnumerationStrategies();
    }

    /**
     * Set up provider-specific enumeration strategies
     */
    setupEnumerationStrategies() {
        // HuggingFace enumeration strategy
        this.enumerationStrategies.set('huggingface', {
            name: 'HuggingFace Hub Enumeration',
            batchSize: 100,
            maxTotal: 10000,
            supportsPagination: true,
            supportsFiltering: true,
            supportsSearch: true,
            sortOptions: ['downloads', 'created_at', 'modified', 'likes'],
            taskFilters: [
                'text-generation', 'text2text-generation', 'conversational',
                'question-answering', 'summarization', 'translation',
                'text-classification', 'image-classification', 'image-to-text',
                'text-to-image', 'automatic-speech-recognition'
            ],
            libraryFilters: ['transformers', 'diffusers', 'sentence-transformers'],
            languageFilters: ['en', 'multilingual', 'fr', 'es', 'de', 'zh'],
            enumerate: this.enumerateHuggingFaceModels.bind(this)
        });

        // OpenAI enumeration strategy
        this.enumerationStrategies.set('openai', {
            name: 'OpenAI Models Enumeration',
            batchSize: 50,
            maxTotal: 100,
            supportsPagination: false,
            supportsFiltering: false,
            supportsSearch: false,
            modelCategories: ['gpt-4', 'gpt-3.5', 'embedding', 'dall-e', 'whisper', 'tts'],
            enumerate: this.enumerateOpenAIModels.bind(this)
        });

        // Anthropic enumeration strategy
        this.enumerationStrategies.set('anthropic', {
            name: 'Anthropic Claude Models Enumeration',
            batchSize: 20,
            maxTotal: 20,
            supportsPagination: false,
            supportsFiltering: false,
            supportsSearch: false,
            modelFamilies: ['claude-3', 'claude-2', 'claude-instant'],
            enumerate: this.enumerateAnthropicModels.bind(this)
        });

        // Google enumeration strategy
        this.enumerationStrategies.set('google', {
            name: 'Google AI Models Enumeration',
            batchSize: 30,
            maxTotal: 50,
            supportsPagination: true,
            supportsFiltering: true,
            supportsSearch: false,
            modelFamilies: ['gemini-1.5', 'gemini-1.0', 'embedding'],
            taskTypes: ['generateContent', 'embedContent'],
            enumerate: this.enumerateGoogleModels.bind(this)
        });

        logger.info('📋 Enumeration strategies configured', {
            providers: Array.from(this.enumerationStrategies.keys()),
            component: 'ModelEnumerator'
        });
    }

    /**
     * Register a provider for enumeration
     */
    registerProvider(name, providerInstance) {
        this.providers.set(name, providerInstance);
        logger.debug(`📝 Registered provider for enumeration: ${name}`, {
            component: 'ModelEnumerator'
        });
    }

    /**
     * Enumerate models from specific provider with advanced options
     */
    async enumerateModels(providerName, options = {}) {
        try {
            if (!this.enumerationStrategies.has(providerName)) {
                throw new ProcessingError(`No enumeration strategy for provider: ${providerName}`);
            }

            const strategy = this.enumerationStrategies.get(providerName);
            const provider = this.providers.get(providerName);

            if (!provider) {
                throw new ProcessingError(`Provider not registered: ${providerName}`);
            }

            logger.info(`🔢 Starting model enumeration: ${providerName}`, {
                strategy: strategy.name,
                options,
                component: 'ModelEnumerator'
            });

            // Check cache first
            const cacheKey = `enumerate_${providerName}_${JSON.stringify(options)}`;
            const cached = await cacheManager.getCachedApiResponse('enumerator', providerName, options);
            if (cached) {
                logger.info('📋 Retrieved enumeration from cache', {
                    provider: providerName,
                    count: cached.models.length,
                    component: 'ModelEnumerator'
                });
                return cached;
            }

            // Execute provider-specific enumeration
            const result = await strategy.enumerate(provider, options);

            // Apply post-processing
            const processedResult = await this.postProcessEnumeration(providerName, result, options);

            // Cache results
            await cacheManager.cacheApiResponse('enumerator', providerName, options, processedResult, {
                ttl: 1800 // 30 minutes cache
            });

            logger.info(`✅ Model enumeration completed: ${providerName}`, {
                totalModels: processedResult.models.length,
                filtered: processedResult.filtered,
                duration: processedResult.duration,
                component: 'ModelEnumerator'
            });

            return processedResult;
        } catch (error) {
            logger.error(`❌ Model enumeration failed: ${providerName}`, {
                error: error.message,
                options,
                component: 'ModelEnumerator'
            });
            throw new ProcessingError(`Enumeration failed for ${providerName}: ${error.message}`);
        }
    }

    /**
     * HuggingFace-specific enumeration logic
     */
    async enumerateHuggingFaceModels(provider, options = {}) {
        const startTime = Date.now();
        const strategy = this.enumerationStrategies.get('huggingface');
        
        const {
            task = null,
            library = null,
            language = null,
            minDownloads = 0,
            maxModels = strategy.maxTotal,
            sort = 'downloads',
            includePrivate = false
        } = options;

        logger.info('🤗 Enumerating HuggingFace models', {
            task, library, language, minDownloads, maxModels, sort,
            component: 'ModelEnumerator'
        });

        const models = [];
        let totalFetched = 0;
        let filtered = 0;
        let offset = 0;

        try {
            // Use pagination to fetch all models
            while (totalFetched < maxModels) {
                const batchSize = Math.min(strategy.batchSize, maxModels - totalFetched);
                
                const batchModels = await provider.discoverModels({
                    task,
                    library,
                    language,
                    limit: batchSize,
                    sort,
                    direction: -1,
                    offset
                });

                if (batchModels.length === 0) {
                    break; // No more models
                }

                // Apply additional filters
                for (const model of batchModels) {
                    if (this.shouldIncludeHuggingFaceModel(model, options)) {
                        models.push(model);
                    } else {
                        filtered++;
                    }
                }

                totalFetched += batchModels.length;
                offset += batchSize;

                // Rate limiting delay
                await new Promise(resolve => setTimeout(resolve, 100));

                logger.debug(`📦 Processed batch: ${batchModels.length} models`, {
                    totalFetched,
                    totalAccepted: models.length,
                    filtered,
                    component: 'ModelEnumerator'
                });
            }

            return {
                models,
                totalFetched,
                filtered,
                strategy: strategy.name,
                duration: Date.now() - startTime,
                options
            };
        } catch (error) {
            throw new ProcessingError(`HuggingFace enumeration failed: ${error.message}`);
        }
    }

    /**
     * OpenAI-specific enumeration logic
     */
    async enumerateOpenAIModels(provider, options = {}) {
        const startTime = Date.now();
        const strategy = this.enumerationStrategies.get('openai');
        
        const {
            category = null,
            includeDeprecated = false,
            includeBeta = true
        } = options;

        logger.info('🤖 Enumerating OpenAI models', {
            category, includeDeprecated, includeBeta,
            component: 'ModelEnumerator'
        });

        try {
            // Get all models from OpenAI
            const allModels = await provider.discoverModels();
            const models = [];
            let filtered = 0;

            // Apply OpenAI-specific filtering
            for (const model of allModels) {
                if (this.shouldIncludeOpenAIModel(model, options)) {
                    models.push(model);
                } else {
                    filtered++;
                }
            }

            // Categorize models
            const categorized = this.categorizeOpenAIModels(models);

            return {
                models,
                categorized,
                totalFetched: allModels.length,
                filtered,
                strategy: strategy.name,
                duration: Date.now() - startTime,
                options
            };
        } catch (error) {
            throw new ProcessingError(`OpenAI enumeration failed: ${error.message}`);
        }
    }

    /**
     * Anthropic-specific enumeration logic
     */
    async enumerateAnthropicModels(provider, options = {}) {
        const startTime = Date.now();
        const strategy = this.enumerationStrategies.get('anthropic');
        
        const {
            family = null,
            includeInstant = true,
            minContextLength = 0
        } = options;

        logger.info('🏛️ Enumerating Anthropic models', {
            family, includeInstant, minContextLength,
            component: 'ModelEnumerator'
        });

        try {
            // Get all models from Anthropic
            const allModels = await provider.discoverModels();
            const models = [];
            let filtered = 0;

            // Apply Anthropic-specific filtering
            for (const model of allModels) {
                if (this.shouldIncludeAnthropicModel(model, options)) {
                    models.push(model);
                } else {
                    filtered++;
                }
            }

            // Group by family
            const byFamily = this.groupAnthropicModelsByFamily(models);

            return {
                models,
                byFamily,
                totalFetched: allModels.length,
                filtered,
                strategy: strategy.name,
                duration: Date.now() - startTime,
                options
            };
        } catch (error) {
            throw new ProcessingError(`Anthropic enumeration failed: ${error.message}`);
        }
    }

    /**
     * Google-specific enumeration logic
     */
    async enumerateGoogleModels(provider, options = {}) {
        const startTime = Date.now();
        const strategy = this.enumerationStrategies.get('google');
        
        const {
            family = null,
            task = null,
            includeVision = true,
            includeBeta = true
        } = options;

        logger.info('🔍 Enumerating Google AI models', {
            family, task, includeVision, includeBeta,
            component: 'ModelEnumerator'
        });

        try {
            // Get all models from Google
            const allModels = await provider.discoverModels();
            const models = [];
            let filtered = 0;

            // Apply Google-specific filtering
            for (const model of allModels) {
                if (this.shouldIncludeGoogleModel(model, options)) {
                    models.push(model);
                } else {
                    filtered++;
                }
            }

            // Group by family and capability
            const byFamily = this.groupGoogleModelsByFamily(models);
            const byCapability = this.groupGoogleModelsByCapability(models);

            return {
                models,
                byFamily,
                byCapability,
                totalFetched: allModels.length,
                filtered,
                strategy: strategy.name,
                duration: Date.now() - startTime,
                options
            };
        } catch (error) {
            throw new ProcessingError(`Google enumeration failed: ${error.message}`);
        }
    }

    /**
     * Filter logic for HuggingFace models
     */
    shouldIncludeHuggingFaceModel(model, options) {
        const { minDownloads = 0, includePrivate = false, excludeTags = [] } = options;

        // Check download threshold
        if (model.downloads < minDownloads) {
            return false;
        }

        // Check private status
        if (!includePrivate && model.private) {
            return false;
        }

        // Check excluded tags
        if (excludeTags.length > 0 && model.tags) {
            const hasExcludedTag = excludeTags.some(tag => model.tags.includes(tag));
            if (hasExcludedTag) {
                return false;
            }
        }

        return true;
    }

    /**
     * Filter logic for OpenAI models
     */
    shouldIncludeOpenAIModel(model, options) {
        const { category = null, includeDeprecated = false, includeBeta = true } = options;

        // Check category filter
        if (category) {
            const modelCategory = this.getOpenAIModelCategory(model.id);
            if (modelCategory !== category) {
                return false;
            }
        }

        // Check deprecated status
        if (!includeDeprecated && model.id.includes('deprecated')) {
            return false;
        }

        // Check beta status
        if (!includeBeta && (model.id.includes('beta') || model.id.includes('preview'))) {
            return false;
        }

        return true;
    }

    /**
     * Filter logic for Anthropic models
     */
    shouldIncludeAnthropicModel(model, options) {
        const { family = null, includeInstant = true, minContextLength = 0 } = options;

        // Check family filter
        if (family && !model.id.includes(family)) {
            return false;
        }

        // Check instant models
        if (!includeInstant && model.id.includes('instant')) {
            return false;
        }

        // Check context length
        if (minContextLength > 0 && model.contextLength < minContextLength) {
            return false;
        }

        return true;
    }

    /**
     * Filter logic for Google models
     */
    shouldIncludeGoogleModel(model, options) {
        const { family = null, task = null, includeVision = true, includeBeta = true } = options;

        // Check family filter
        if (family && !model.id.includes(family)) {
            return false;
        }

        // Check task filter
        if (task && model.task !== task) {
            return false;
        }

        // Check vision models
        if (!includeVision && model.id.includes('vision')) {
            return false;
        }

        // Check beta models
        if (!includeBeta && (model.id.includes('beta') || model.id.includes('preview'))) {
            return false;
        }

        return true;
    }

    /**
     * Get OpenAI model category
     */
    getOpenAIModelCategory(modelId) {
        if (modelId.startsWith('gpt-4')) return 'gpt-4';
        if (modelId.startsWith('gpt-3.5')) return 'gpt-3.5';
        if (modelId.includes('embedding')) return 'embedding';
        if (modelId.includes('dall-e')) return 'dall-e';
        if (modelId.includes('whisper')) return 'whisper';
        if (modelId.includes('tts')) return 'tts';
        return 'other';
    }

    /**
     * Categorize OpenAI models
     */
    categorizeOpenAIModels(models) {
        const categories = {
            'gpt-4': [],
            'gpt-3.5': [],
            'embedding': [],
            'dall-e': [],
            'whisper': [],
            'tts': [],
            'other': []
        };

        for (const model of models) {
            const category = this.getOpenAIModelCategory(model.id);
            categories[category].push(model);
        }

        return categories;
    }

    /**
     * Group Anthropic models by family
     */
    groupAnthropicModelsByFamily(models) {
        const families = {
            'claude-3': [],
            'claude-2': [],
            'claude-instant': [],
            'other': []
        };

        for (const model of models) {
            let family = 'other';
            if (model.id.includes('claude-3')) family = 'claude-3';
            else if (model.id.includes('claude-2')) family = 'claude-2';
            else if (model.id.includes('claude-instant')) family = 'claude-instant';

            families[family].push(model);
        }

        return families;
    }

    /**
     * Group Google models by family
     */
    groupGoogleModelsByFamily(models) {
        const families = {
            'gemini-1.5': [],
            'gemini-1.0': [],
            'embedding': [],
            'other': []
        };

        for (const model of models) {
            let family = 'other';
            if (model.id.includes('gemini-1.5')) family = 'gemini-1.5';
            else if (model.id.includes('gemini-1.0') || model.id === 'gemini-pro') family = 'gemini-1.0';
            else if (model.id.includes('embedding')) family = 'embedding';

            families[family].push(model);
        }

        return families;
    }

    /**
     * Group Google models by capability
     */
    groupGoogleModelsByCapability(models) {
        const capabilities = {
            'multimodal': [],
            'text-only': [],
            'embeddings': [],
            'vision': []
        };

        for (const model of models) {
            if (model.task === 'embeddings') {
                capabilities.embeddings.push(model);
            } else if (model.capabilities.includes('vision') || model.id.includes('vision')) {
                capabilities.vision.push(model);
                capabilities.multimodal.push(model);
            } else if (model.capabilities.includes('multimodal')) {
                capabilities.multimodal.push(model);
            } else {
                capabilities['text-only'].push(model);
            }
        }

        return capabilities;
    }

    /**
     * Post-process enumeration results
     */
    async postProcessEnumeration(providerName, result, options) {
        const startTime = Date.now();

        logger.debug(`🔄 Post-processing enumeration results: ${providerName}`, {
            modelCount: result.models.length,
            component: 'ModelEnumerator'
        });

        // Add enumeration metadata
        result.models.forEach(model => {
            model.enumerationMetadata = {
                enumeratedAt: new Date().toISOString(),
                enumerationStrategy: result.strategy,
                providerName,
                options
            };
        });

        // Sort models consistently
        result.models.sort((a, b) => {
            // Primary sort by downloads/popularity if available
            if (a.downloads && b.downloads) {
                return b.downloads - a.downloads;
            }
            // Secondary sort by name
            return a.name.localeCompare(b.name);
        });

        result.postProcessingDuration = Date.now() - startTime;

        logger.debug(`✅ Post-processing completed: ${providerName}`, {
            duration: result.postProcessingDuration,
            component: 'ModelEnumerator'
        });

        return result;
    }

    /**
     * Get enumeration statistics
     */
    getStats() {
        return {
            enumerator: 'ModelEnumerator',
            registeredProviders: Array.from(this.providers.keys()),
            availableStrategies: Array.from(this.enumerationStrategies.keys()),
            strategies: Object.fromEntries(
                Array.from(this.enumerationStrategies.entries()).map(([name, strategy]) => [
                    name,
                    {
                        name: strategy.name,
                        batchSize: strategy.batchSize,
                        maxTotal: strategy.maxTotal,
                        supportsPagination: strategy.supportsPagination,
                        supportsFiltering: strategy.supportsFiltering,
                        supportsSearch: strategy.supportsSearch
                    }
                ])
            ),
            timestamp: new Date().toISOString()
        };
    }
}

// Export singleton instance
export const modelEnumerator = new ModelEnumerator();
export { ModelEnumerator, ProcessingError };