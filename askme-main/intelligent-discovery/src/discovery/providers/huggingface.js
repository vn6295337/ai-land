/**
 * HuggingFace Hub API Client
 * Module 3, Step 12: Initialize HuggingFace Hub API client
 * 
 * Features:
 * - Model discovery from 400k+ models on HuggingFace Hub
 * - Repository information and metadata extraction
 * - Rate limiting and quota management
 * - Model filtering and categorization
 * - Integration with caching layer
 */

import { HfApi } from '@huggingface/hub';
import { logger } from '../../core/infrastructure/logger.js';
import { config } from '../../core/infrastructure/config.js';
import { cacheManager } from '../../core/storage/cache.js';
import { ProcessingError } from '../../core/infrastructure/errors.js';

class HuggingFaceProvider {
    constructor() {
        this.client = null;
        this.isInitialized = false;
        this.apiKey = null;
        this.baseUrl = 'https://huggingface.co/api';
        this.rateLimiter = null;
        this.maxModelsPerRequest = 100;
        this.supportedTasks = [
            'text-generation',
            'text2text-generation',
            'conversational',
            'question-answering',
            'summarization',
            'translation',
            'text-classification',
            'token-classification',
            'fill-mask',
            'sentence-similarity',
            'feature-extraction',
            'zero-shot-classification',
            'image-classification',
            'image-to-text',
            'text-to-image',
            'image-to-image',
            'object-detection',
            'automatic-speech-recognition',
            'text-to-speech',
            'audio-classification'
        ];
    }

    /**
     * Initialize HuggingFace Hub client
     */
    async initialize() {
        try {
            logger.info('🤗 Initializing HuggingFace Hub API client...', {
                component: 'HuggingFaceProvider'
            });

            // Get API key from secure key manager
            try {
                this.apiKey = config.getSecureKey('huggingface');
                logger.debug('✅ HuggingFace API key loaded from secure manager', {
                    component: 'HuggingFaceProvider'
                });
            } catch (error) {
                logger.warn('⚠️ HuggingFace API key not configured, using anonymous access', {
                    component: 'HuggingFaceProvider'
                });
            }

            // Initialize HuggingFace API client
            this.client = new HfApi({
                apiKey: this.apiKey,
                fetch: fetch // Use global fetch
            });

            // Test connection
            await this.testConnection();
            this.isInitialized = true;

            logger.info('✅ HuggingFace Hub API client initialized successfully', {
                hasApiKey: !!this.apiKey,
                supportedTasks: this.supportedTasks.length,
                component: 'HuggingFaceProvider'
            });

            return {
                provider: 'huggingface',
                initialized: true,
                authenticated: !!this.apiKey,
                supportedTasks: this.supportedTasks
            };
        } catch (error) {
            logger.error('❌ Failed to initialize HuggingFace Hub client', {
                error: error.message,
                component: 'HuggingFaceProvider'
            });
            throw new ProcessingError(`HuggingFace initialization failed: ${error.message}`);
        }
    }

    /**
     * Test connection to HuggingFace Hub
     */
    async testConnection() {
        try {
            // Try to fetch a simple model to test connection
            const testResponse = await fetch(`${this.baseUrl}/models/microsoft/DialoGPT-medium`, {
                headers: {
                    ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                }
            });

            if (!testResponse.ok) {
                throw new Error(`HTTP ${testResponse.status}: ${testResponse.statusText}`);
            }

            logger.debug('🔗 HuggingFace Hub connection test successful', {
                component: 'HuggingFaceProvider'
            });
        } catch (error) {
            throw new ProcessingError(`HuggingFace connection test failed: ${error.message}`);
        }
    }

    /**
     * Discover models with optional filtering
     */
    async discoverModels(options = {}) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            const {
                task = null,
                library = null,
                language = null,
                limit = 1000,
                sort = 'downloads',
                direction = -1,
                search = null
            } = options;

            logger.info('🔍 Starting HuggingFace model discovery', {
                task,
                library,
                language,
                limit,
                sort,
                search: search ? search.substring(0, 50) : null,
                component: 'HuggingFaceProvider'
            });

            // Check cache first
            const cacheKey = `hf_models_${JSON.stringify(options)}`;
            const cached = await cacheManager.getCachedApiResponse('huggingface', 'models', options);
            if (cached) {
                logger.info('📋 Retrieved models from cache', {
                    count: cached.length,
                    component: 'HuggingFaceProvider'
                });
                return cached;
            }

            // Build API parameters
            const params = new URLSearchParams();
            if (task) params.append('pipeline_tag', task);
            if (library) params.append('library', library);
            if (language) params.append('language', language);
            if (search) params.append('search', search);
            params.append('limit', Math.min(limit, 10000).toString());
            params.append('sort', sort);
            params.append('direction', direction.toString());

            // Fetch models from HuggingFace Hub
            const response = await fetch(`${this.baseUrl}/models?${params}`, {
                headers: {
                    'Accept': 'application/json',
                    ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const models = await response.json();
            
            // Process and normalize model data
            const processedModels = await this.processModels(models);

            // Cache the results
            await cacheManager.cacheApiResponse('huggingface', 'models', options, processedModels, {
                ttl: 3600 // 1 hour cache
            });

            logger.info('✅ HuggingFace model discovery completed', {
                discovered: processedModels.length,
                filtered: models.length - processedModels.length,
                component: 'HuggingFaceProvider'
            });

            return processedModels;
        } catch (error) {
            logger.error('❌ HuggingFace model discovery failed', {
                error: error.message,
                options,
                component: 'HuggingFaceProvider'
            });
            throw new ProcessingError(`Model discovery failed: ${error.message}`);
        }
    }

    /**
     * Get detailed model information
     */
    async getModelDetails(modelId) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            logger.debug('📊 Fetching model details', {
                modelId,
                component: 'HuggingFaceProvider'
            });

            // Check cache first
            const cached = await cacheManager.getCachedApiResponse('huggingface', 'model_details', { modelId });
            if (cached) {
                return cached;
            }

            // Fetch model details
            const response = await fetch(`${this.baseUrl}/models/${modelId}`, {
                headers: {
                    'Accept': 'application/json',
                    ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const modelData = await response.json();
            const processedModel = await this.processModel(modelData);

            // Cache the result
            await cacheManager.cacheApiResponse('huggingface', 'model_details', { modelId }, processedModel, {
                ttl: 7200 // 2 hour cache for detailed info
            });

            return processedModel;
        } catch (error) {
            logger.error('❌ Failed to fetch model details', {
                error: error.message,
                modelId,
                component: 'HuggingFaceProvider'
            });
            throw new ProcessingError(`Model details fetch failed: ${error.message}`);
        }
    }

    /**
     * Process and normalize model data
     */
    async processModels(rawModels) {
        const processedModels = [];

        for (const model of rawModels) {
            try {
                const processed = await this.processModel(model);
                if (processed) {
                    processedModels.push(processed);
                }
            } catch (error) {
                logger.warn('⚠️ Failed to process model', {
                    modelId: model.id || 'unknown',
                    error: error.message,
                    component: 'HuggingFaceProvider'
                });
            }
        }

        return processedModels;
    }

    /**
     * Process and normalize individual model
     */
    async processModel(rawModel) {
        try {
            // Extract and normalize model information
            const model = {
                // Basic identification
                id: rawModel.id,
                name: rawModel.id.split('/').pop(),
                fullName: rawModel.id,
                provider: 'huggingface',
                
                // Model metadata
                description: rawModel.cardData?.description || rawModel.description || null,
                author: rawModel.author || rawModel.id.split('/')[0],
                createdAt: rawModel.created_at || rawModel.createdAt,
                lastModified: rawModel.last_modified || rawModel.lastModified,
                
                // Technical details
                task: rawModel.pipeline_tag || null,
                library: rawModel.library_name || null,
                language: rawModel.language || rawModel.cardData?.language || null,
                license: rawModel.cardData?.license || null,
                
                // Usage statistics
                downloads: rawModel.downloads || 0,
                likes: rawModel.likes || 0,
                
                // Model configuration
                tags: rawModel.tags || [],
                datasets: rawModel.datasets || [],
                metrics: rawModel.cardData?.model_index?.[0]?.results || [],
                
                // API information
                inference: rawModel.inference || 'unknown',
                hosted_inference_api: rawModel.cardData?.inference !== false,
                
                // URLs and resources
                url: `https://huggingface.co/${rawModel.id}`,
                apiUrl: `https://api-inference.huggingface.co/models/${rawModel.id}`,
                
                // Capabilities (inferred from task and tags)
                capabilities: this.inferCapabilities(rawModel),
                
                // Use cases (inferred from description and task)
                useCases: this.inferUseCases(rawModel),
                
                // Model size and requirements (if available)
                modelSize: rawModel.cardData?.model_size || null,
                requirements: this.inferRequirements(rawModel),
                
                // Validation status
                validated: false,
                validationResults: null,
                
                // Discovery metadata
                discoveredAt: new Date().toISOString(),
                source: 'huggingface_hub'
            };

            return model;
        } catch (error) {
            logger.error('❌ Error processing individual model', {
                modelId: rawModel.id || 'unknown',
                error: error.message,
                component: 'HuggingFaceProvider'
            });
            return null;
        }
    }

    /**
     * Infer model capabilities from task and tags
     */
    inferCapabilities(modelData) {
        const capabilities = [];
        const task = modelData.pipeline_tag;
        const tags = modelData.tags || [];

        // Task-based capabilities
        const taskCapabilities = {
            'text-generation': ['chat', 'completion', 'creative_writing'],
            'text2text-generation': ['translation', 'summarization', 'paraphrasing'],
            'conversational': ['chat', 'dialogue'],
            'question-answering': ['qa', 'information_retrieval'],
            'summarization': ['summarization', 'text_processing'],
            'translation': ['translation', 'multilingual'],
            'text-classification': ['classification', 'sentiment_analysis'],
            'image-classification': ['image_understanding', 'computer_vision'],
            'image-to-text': ['image_captioning', 'multimodal'],
            'text-to-image': ['image_generation', 'multimodal'],
            'automatic-speech-recognition': ['speech_to_text', 'audio_processing']
        };

        if (task && taskCapabilities[task]) {
            capabilities.push(...taskCapabilities[task]);
        }

        // Tag-based capabilities
        const tagCapabilities = {
            'multimodal': ['multimodal'],
            'multilingual': ['multilingual'],
            'code': ['code_generation', 'programming'],
            'math': ['mathematical_reasoning'],
            'reasoning': ['logical_reasoning'],
            'function-calling': ['function_calling', 'tool_use'],
            'streaming': ['streaming']
        };

        for (const tag of tags) {
            const lowerTag = tag.toLowerCase();
            for (const [key, caps] of Object.entries(tagCapabilities)) {
                if (lowerTag.includes(key)) {
                    capabilities.push(...caps);
                }
            }
        }

        return [...new Set(capabilities)]; // Remove duplicates
    }

    /**
     * Infer use cases from model data
     */
    inferUseCases(modelData) {
        const useCases = [];
        const task = modelData.pipeline_tag;
        const description = (modelData.cardData?.description || modelData.description || '').toLowerCase();
        const tags = modelData.tags || [];

        // Task-based use cases
        const taskUseCases = {
            'text-generation': ['content_creation', 'storytelling', 'code_generation'],
            'conversational': ['chatbot', 'customer_support', 'virtual_assistant'],
            'question-answering': ['information_retrieval', 'knowledge_base', 'research'],
            'summarization': ['document_processing', 'content_curation', 'research'],
            'translation': ['localization', 'communication', 'content_translation'],
            'text-classification': ['content_moderation', 'sentiment_analysis', 'categorization'],
            'image-classification': ['content_moderation', 'automated_tagging', 'quality_control'],
            'image-to-text': ['accessibility', 'content_description', 'automated_captioning'],
            'text-to-image': ['creative_design', 'marketing', 'content_generation']
        };

        if (task && taskUseCases[task]) {
            useCases.push(...taskUseCases[task]);
        }

        // Description-based use cases
        const descriptionUseCases = [
            ['business', 'enterprise', 'commercial'],
            ['research', 'academic', 'scientific'],
            ['education', 'learning', 'tutorial'],
            ['creative', 'art', 'design'],
            ['medical', 'healthcare', 'clinical'],
            ['legal', 'law', 'compliance'],
            ['financial', 'finance', 'banking']
        ];

        for (const [useCase, keywords] of descriptionUseCases) {
            if (keywords.some(keyword => description.includes(keyword))) {
                useCases.push(useCase);
            }
        }

        return [...new Set(useCases)]; // Remove duplicates
    }

    /**
     * Infer model requirements
     */
    inferRequirements(modelData) {
        const requirements = {
            memory: 'unknown',
            compute: 'unknown',
            gpu: false,
            apiKey: !!(this.apiKey)
        };

        const tags = modelData.tags || [];
        const modelSize = modelData.cardData?.model_size;

        // Infer GPU requirement from tags
        if (tags.some(tag => tag.toLowerCase().includes('gpu') || tag.toLowerCase().includes('cuda'))) {
            requirements.gpu = true;
            requirements.compute = 'high';
        }

        // Infer memory from model size if available
        if (modelSize) {
            const sizeStr = modelSize.toLowerCase();
            if (sizeStr.includes('7b') || sizeStr.includes('7 billion')) {
                requirements.memory = '14GB+';
                requirements.compute = 'high';
            } else if (sizeStr.includes('13b') || sizeStr.includes('13 billion')) {
                requirements.memory = '26GB+';
                requirements.compute = 'very_high';
            } else if (sizeStr.includes('30b') || sizeStr.includes('30 billion')) {
                requirements.memory = '60GB+';
                requirements.compute = 'very_high';
            }
        }

        return requirements;
    }

    /**
     * Get provider statistics
     */
    async getStats() {
        try {
            const stats = {
                provider: 'huggingface',
                isInitialized: this.isInitialized,
                authenticated: !!this.apiKey,
                supportedTasks: this.supportedTasks.length,
                maxModelsPerRequest: this.maxModelsPerRequest,
                baseUrl: this.baseUrl,
                timestamp: new Date().toISOString()
            };

            // Get some basic hub statistics if possible
            try {
                const response = await fetch(`${this.baseUrl}/models-tags-by-type`, {
                    headers: {
                        'Accept': 'application/json',
                        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                    }
                });

                if (response.ok) {
                    const hubStats = await response.json();
                    stats.hubStatistics = hubStats;
                }
            } catch (error) {
                // Hub stats not critical, continue without them
                logger.debug('Could not fetch hub statistics', {
                    error: error.message,
                    component: 'HuggingFaceProvider'
                });
            }

            return stats;
        } catch (error) {
            logger.error('❌ Failed to get HuggingFace stats', {
                error: error.message,
                component: 'HuggingFaceProvider'
            });
            return {
                provider: 'huggingface',
                isInitialized: this.isInitialized,
                error: error.message
            };
        }
    }

    /**
     * Search models by query
     */
    async searchModels(query, options = {}) {
        return await this.discoverModels({
            ...options,
            search: query
        });
    }

    /**
     * Get models by specific task
     */
    async getModelsByTask(task, options = {}) {
        if (!this.supportedTasks.includes(task)) {
            throw new ProcessingError(`Unsupported task: ${task}`);
        }

        return await this.discoverModels({
            ...options,
            task
        });
    }

    /**
     * Get trending models
     */
    async getTrendingModels(options = {}) {
        return await this.discoverModels({
            ...options,
            sort: 'downloads',
            direction: -1,
            limit: options.limit || 100
        });
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            this.client = null;
            this.isInitialized = false;
            this.apiKey = null;

            logger.info('🧹 HuggingFace provider cleaned up', {
                component: 'HuggingFaceProvider'
            });
        } catch (error) {
            logger.error('❌ Error during HuggingFace cleanup', {
                error: error.message,
                component: 'HuggingFaceProvider'
            });
        }
    }
}

// Export singleton instance
export const huggingFaceProvider = new HuggingFaceProvider();
export { HuggingFaceProvider, ProcessingError };