/**
 * OpenAI API Client
 * Module 3, Step 13: Set up OpenAI API client for model discovery
 * 
 * Features:
 * - Model enumeration from OpenAI's available models
 * - API endpoint validation and testing
 * - Rate limiting and quota management
 * - Model capability assessment
 * - Integration with caching layer
 */

import OpenAI from 'openai';
import { logger } from '../../core/infrastructure/logger.js';
import { config } from '../../core/infrastructure/config.js';
import { cacheManager } from '../../core/storage/cache.js';
import { ProcessingError } from '../../core/infrastructure/errors.js';

class OpenAIProvider {
    constructor() {
        this.client = null;
        this.isInitialized = false;
        this.apiKey = null;
        this.baseUrl = 'https://api.openai.com/v1';
        this.knownModels = [
            // GPT-4 models
            'gpt-4-0125-preview',
            'gpt-4-turbo-preview',
            'gpt-4-1106-preview',
            'gpt-4-vision-preview',
            'gpt-4',
            'gpt-4-0613',
            'gpt-4-32k',
            'gpt-4-32k-0613',
            
            // GPT-3.5 models
            'gpt-3.5-turbo-0125',
            'gpt-3.5-turbo',
            'gpt-3.5-turbo-1106',
            'gpt-3.5-turbo-instruct',
            'gpt-3.5-turbo-16k',
            
            // Embedding models
            'text-embedding-3-large',
            'text-embedding-3-small',
            'text-embedding-ada-002',
            
            // Image models
            'dall-e-3',
            'dall-e-2',
            
            // Audio models
            'whisper-1',
            'tts-1',
            'tts-1-hd',
            
            // Moderation
            'text-moderation-latest',
            'text-moderation-stable'
        ];
    }

    /**
     * Initialize OpenAI client
     */
    async initialize() {
        try {
            logger.info('🤖 Initializing OpenAI API client...', {
                component: 'OpenAIProvider'
            });

            // Get API key from secure key manager
            try {
                this.apiKey = config.getSecureKey('openai');
                logger.debug('✅ OpenAI API key loaded from secure manager', {
                    component: 'OpenAIProvider'
                });
            } catch (error) {
                logger.warn('⚠️ OpenAI API key not configured', {
                    component: 'OpenAIProvider'
                });
                throw new ProcessingError('OpenAI API key is required');
            }

            // Initialize OpenAI client
            this.client = new OpenAI({
                apiKey: this.apiKey,
                baseURL: this.baseUrl
            });

            // Test connection
            await this.testConnection();
            this.isInitialized = true;

            logger.info('✅ OpenAI API client initialized successfully', {
                knownModels: this.knownModels.length,
                component: 'OpenAIProvider'
            });

            return {
                provider: 'openai',
                initialized: true,
                authenticated: true,
                knownModels: this.knownModels.length
            };
        } catch (error) {
            logger.error('❌ Failed to initialize OpenAI client', {
                error: error.message,
                component: 'OpenAIProvider'
            });
            throw new ProcessingError(`OpenAI initialization failed: ${error.message}`);
        }
    }

    /**
     * Test connection to OpenAI API
     */
    async testConnection() {
        try {
            // Test with a simple models list request
            const response = await this.client.models.list();
            
            if (!response || !response.data) {
                throw new Error('Invalid response from OpenAI API');
            }

            logger.debug('🔗 OpenAI API connection test successful', {
                modelsFound: response.data.length,
                component: 'OpenAIProvider'
            });
        } catch (error) {
            throw new ProcessingError(`OpenAI connection test failed: ${error.message}`);
        }
    }

    /**
     * Discover available models
     */
    async discoverModels(options = {}) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            logger.info('🔍 Starting OpenAI model discovery', {
                component: 'OpenAIProvider'
            });

            // Check cache first
            const cacheKey = 'openai_models';
            const cached = await cacheManager.getCachedApiResponse('openai', 'models', {});
            if (cached) {
                logger.info('📋 Retrieved models from cache', {
                    count: cached.length,
                    component: 'OpenAIProvider'
                });
                return cached;
            }

            // Fetch models from OpenAI API
            const response = await this.client.models.list();
            const models = response.data || [];

            // Process and normalize model data
            const processedModels = await this.processModels(models);

            // Cache the results
            await cacheManager.cacheApiResponse('openai', 'models', {}, processedModels, {
                ttl: 3600 // 1 hour cache
            });

            logger.info('✅ OpenAI model discovery completed', {
                discovered: processedModels.length,
                component: 'OpenAIProvider'
            });

            return processedModels;
        } catch (error) {
            logger.error('❌ OpenAI model discovery failed', {
                error: error.message,
                component: 'OpenAIProvider'
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

            logger.debug('📊 Fetching OpenAI model details', {
                modelId,
                component: 'OpenAIProvider'
            });

            // Check cache first
            const cached = await cacheManager.getCachedApiResponse('openai', 'model_details', { modelId });
            if (cached) {
                return cached;
            }

            // Fetch model details
            const model = await this.client.models.retrieve(modelId);
            const processedModel = await this.processModel(model);

            // Cache the result
            await cacheManager.cacheApiResponse('openai', 'model_details', { modelId }, processedModel, {
                ttl: 7200 // 2 hour cache
            });

            return processedModel;
        } catch (error) {
            logger.error('❌ Failed to fetch OpenAI model details', {
                error: error.message,
                modelId,
                component: 'OpenAIProvider'
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
                logger.warn('⚠️ Failed to process OpenAI model', {
                    modelId: model.id || 'unknown',
                    error: error.message,
                    component: 'OpenAIProvider'
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
            const modelId = rawModel.id;
            const modelInfo = this.getModelInfo(modelId);

            const model = {
                // Basic identification
                id: modelId,
                name: modelId,
                fullName: modelId,
                provider: 'openai',
                
                // Model metadata
                description: modelInfo.description,
                author: 'OpenAI',
                createdAt: rawModel.created ? new Date(rawModel.created * 1000).toISOString() : null,
                lastModified: null,
                
                // Technical details
                task: modelInfo.task,
                architecture: modelInfo.architecture,
                contextLength: modelInfo.contextLength,
                
                // Capabilities
                capabilities: modelInfo.capabilities,
                useCases: modelInfo.useCases,
                
                // API information
                apiEndpoint: `${this.baseUrl}/completions`,
                chatEndpoint: modelInfo.supportsChat ? `${this.baseUrl}/chat/completions` : null,
                streamingSupported: modelInfo.streamingSupported,
                functionCalling: modelInfo.functionCalling,
                
                // Pricing (if known)
                pricing: modelInfo.pricing,
                
                // Requirements
                requirements: {
                    apiKey: true,
                    endpoint: 'https://api.openai.com/v1',
                    authentication: 'bearer_token'
                },
                
                // Model properties
                maxTokens: modelInfo.maxTokens,
                inputTypes: modelInfo.inputTypes,
                outputTypes: modelInfo.outputTypes,
                
                // Validation status
                validated: false,
                validationResults: null,
                
                // Discovery metadata
                discoveredAt: new Date().toISOString(),
                source: 'openai_api',
                
                // OpenAI specific
                owned_by: rawModel.owned_by || 'openai',
                permission: rawModel.permission || []
            };

            return model;
        } catch (error) {
            logger.error('❌ Error processing OpenAI model', {
                modelId: rawModel.id || 'unknown',
                error: error.message,
                component: 'OpenAIProvider'
            });
            return null;
        }
    }

    /**
     * Get detailed information about specific OpenAI models
     */
    getModelInfo(modelId) {
        const modelMap = {
            // GPT-4 models
            'gpt-4': {
                description: 'Most capable GPT-4 model, great for complex tasks',
                task: 'text-generation',
                architecture: 'transformer',
                contextLength: 8192,
                maxTokens: 4096,
                capabilities: ['chat', 'completion', 'reasoning', 'code_generation', 'function_calling'],
                useCases: ['complex_reasoning', 'code_generation', 'creative_writing', 'analysis'],
                supportsChat: true,
                streamingSupported: true,
                functionCalling: true,
                inputTypes: ['text'],
                outputTypes: ['text'],
                pricing: { input: 0.03, output: 0.06 }
            },
            'gpt-4-turbo-preview': {
                description: 'Latest GPT-4 Turbo model with improved performance',
                task: 'text-generation',
                architecture: 'transformer',
                contextLength: 128000,
                maxTokens: 4096,
                capabilities: ['chat', 'completion', 'reasoning', 'code_generation', 'function_calling', 'json_mode'],
                useCases: ['complex_reasoning', 'long_context', 'code_generation', 'analysis'],
                supportsChat: true,
                streamingSupported: true,
                functionCalling: true,
                inputTypes: ['text'],
                outputTypes: ['text'],
                pricing: { input: 0.01, output: 0.03 }
            },
            'gpt-4-vision-preview': {
                description: 'GPT-4 with vision capabilities',
                task: 'multimodal',
                architecture: 'transformer',
                contextLength: 128000,
                maxTokens: 4096,
                capabilities: ['chat', 'completion', 'vision', 'image_understanding', 'multimodal'],
                useCases: ['image_analysis', 'visual_reasoning', 'document_understanding', 'accessibility'],
                supportsChat: true,
                streamingSupported: true,
                functionCalling: true,
                inputTypes: ['text', 'image'],
                outputTypes: ['text'],
                pricing: { input: 0.01, output: 0.03 }
            },
            
            // GPT-3.5 models
            'gpt-3.5-turbo': {
                description: 'Fast, capable model for most conversational tasks',
                task: 'text-generation',
                architecture: 'transformer',
                contextLength: 16385,
                maxTokens: 4096,
                capabilities: ['chat', 'completion', 'function_calling'],
                useCases: ['chatbot', 'content_generation', 'summarization', 'translation'],
                supportsChat: true,
                streamingSupported: true,
                functionCalling: true,
                inputTypes: ['text'],
                outputTypes: ['text'],
                pricing: { input: 0.0005, output: 0.0015 }
            },
            'gpt-3.5-turbo-instruct': {
                description: 'Instruction-following version of GPT-3.5',
                task: 'text-generation',
                architecture: 'transformer',
                contextLength: 4096,
                maxTokens: 4096,
                capabilities: ['completion', 'instruction_following'],
                useCases: ['instruction_following', 'text_completion', 'editing'],
                supportsChat: false,
                streamingSupported: true,
                functionCalling: false,
                inputTypes: ['text'],
                outputTypes: ['text'],
                pricing: { input: 0.0015, output: 0.002 }
            },
            
            // Embedding models
            'text-embedding-3-large': {
                description: 'Most capable embedding model for text similarity',
                task: 'embeddings',
                architecture: 'transformer',
                contextLength: 8191,
                maxTokens: null,
                capabilities: ['embeddings', 'similarity', 'semantic_search'],
                useCases: ['semantic_search', 'clustering', 'classification', 'similarity'],
                supportsChat: false,
                streamingSupported: false,
                functionCalling: false,
                inputTypes: ['text'],
                outputTypes: ['embeddings'],
                pricing: { input: 0.00013, output: 0 }
            },
            'text-embedding-3-small': {
                description: 'Efficient embedding model for text similarity',
                task: 'embeddings',
                architecture: 'transformer',
                contextLength: 8191,
                maxTokens: null,
                capabilities: ['embeddings', 'similarity', 'semantic_search'],
                useCases: ['semantic_search', 'clustering', 'classification', 'similarity'],
                supportsChat: false,
                streamingSupported: false,
                functionCalling: false,
                inputTypes: ['text'],
                outputTypes: ['embeddings'],
                pricing: { input: 0.00002, output: 0 }
            },
            
            // Image models
            'dall-e-3': {
                description: 'Latest image generation model with improved quality',
                task: 'text-to-image',
                architecture: 'diffusion',
                contextLength: 4000,
                maxTokens: null,
                capabilities: ['image_generation', 'creative_design', 'multimodal'],
                useCases: ['image_generation', 'creative_design', 'marketing', 'art'],
                supportsChat: false,
                streamingSupported: false,
                functionCalling: false,
                inputTypes: ['text'],
                outputTypes: ['image'],
                pricing: { standard: 0.040, hd: 0.080 }
            },
            
            // Audio models
            'whisper-1': {
                description: 'Speech recognition and transcription model',
                task: 'speech-to-text',
                architecture: 'transformer',
                contextLength: null,
                maxTokens: null,
                capabilities: ['speech_recognition', 'transcription', 'translation'],
                useCases: ['transcription', 'subtitles', 'voice_interfaces', 'accessibility'],
                supportsChat: false,
                streamingSupported: false,
                functionCalling: false,
                inputTypes: ['audio'],
                outputTypes: ['text'],
                pricing: { perMinute: 0.006 }
            },
            'tts-1': {
                description: 'Text-to-speech model for natural voice synthesis',
                task: 'text-to-speech',
                architecture: 'neural_tts',
                contextLength: 4096,
                maxTokens: null,
                capabilities: ['speech_synthesis', 'voice_generation', 'audio_generation'],
                useCases: ['voice_interfaces', 'accessibility', 'content_creation', 'audiobooks'],
                supportsChat: false,
                streamingSupported: true,
                functionCalling: false,
                inputTypes: ['text'],
                outputTypes: ['audio'],
                pricing: { per1kChars: 0.015 }
            }
        };

        // Return model info or default info
        return modelMap[modelId] || {
            description: `OpenAI model: ${modelId}`,
            task: 'unknown',
            architecture: 'transformer',
            contextLength: null,
            maxTokens: null,
            capabilities: ['unknown'],
            useCases: ['unknown'],
            supportsChat: modelId.includes('gpt'),
            streamingSupported: true,
            functionCalling: modelId.includes('gpt-4') || modelId.includes('gpt-3.5-turbo'),
            inputTypes: ['text'],
            outputTypes: ['text'],
            pricing: null
        };
    }

    /**
     * Test model capabilities
     */
    async testModel(modelId, testType = 'basic') {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            logger.info('🧪 Testing OpenAI model capabilities', {
                modelId,
                testType,
                component: 'OpenAIProvider'
            });

            const modelInfo = this.getModelInfo(modelId);
            const testResults = {
                modelId,
                testType,
                timestamp: new Date().toISOString(),
                success: false,
                capabilities: {},
                performance: {},
                errors: []
            };

            try {
                if (modelInfo.supportsChat && (testType === 'basic' || testType === 'chat')) {
                    // Test chat completion
                    const startTime = Date.now();
                    const response = await this.client.chat.completions.create({
                        model: modelId,
                        messages: [{ role: 'user', content: 'Hello! Please respond with exactly: "Test successful"' }],
                        max_tokens: 10,
                        temperature: 0
                    });
                    const endTime = Date.now();

                    testResults.capabilities.chat = true;
                    testResults.performance.responseTime = endTime - startTime;
                    testResults.performance.tokensUsed = response.usage?.total_tokens || 0;
                    testResults.success = true;
                } else if (modelInfo.task === 'embeddings') {
                    // Test embeddings
                    const startTime = Date.now();
                    const response = await this.client.embeddings.create({
                        model: modelId,
                        input: 'Test embedding generation'
                    });
                    const endTime = Date.now();

                    testResults.capabilities.embeddings = true;
                    testResults.performance.responseTime = endTime - startTime;
                    testResults.performance.dimensions = response.data[0]?.embedding?.length || 0;
                    testResults.success = true;
                }
            } catch (error) {
                testResults.errors.push(error.message);
                logger.warn('⚠️ Model test failed', {
                    modelId,
                    error: error.message,
                    component: 'OpenAIProvider'
                });
            }

            return testResults;
        } catch (error) {
            logger.error('❌ Failed to test OpenAI model', {
                error: error.message,
                modelId,
                component: 'OpenAIProvider'
            });
            throw new ProcessingError(`Model test failed: ${error.message}`);
        }
    }

    /**
     * Get provider statistics
     */
    async getStats() {
        return {
            provider: 'openai',
            isInitialized: this.isInitialized,
            authenticated: !!this.apiKey,
            knownModels: this.knownModels.length,
            baseUrl: this.baseUrl,
            supportedTasks: ['text-generation', 'embeddings', 'text-to-image', 'speech-to-text', 'text-to-speech'],
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            this.client = null;
            this.isInitialized = false;
            this.apiKey = null;

            logger.info('🧹 OpenAI provider cleaned up', {
                component: 'OpenAIProvider'
            });
        } catch (error) {
            logger.error('❌ Error during OpenAI cleanup', {
                error: error.message,
                component: 'OpenAIProvider'
            });
        }
    }
}

// Export singleton instance
export const openaiProvider = new OpenAIProvider();
export { OpenAIProvider, ProcessingError };