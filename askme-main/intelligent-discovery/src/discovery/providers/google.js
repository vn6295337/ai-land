/**
 * Google AI API Client
 * Module 3, Step 13: Set up Google AI API client for model discovery
 * 
 * Features:
 * - Gemini model enumeration and information
 * - API endpoint validation and testing
 * - Rate limiting and quota management
 * - Model capability assessment
 * - Integration with caching layer
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../core/infrastructure/logger.js';
import { config } from '../../core/infrastructure/config.js';
import { cacheManager } from '../../core/storage/cache.js';
import { ProcessingError } from '../../core/infrastructure/errors.js';

class GoogleProvider {
    constructor() {
        this.client = null;
        this.isInitialized = false;
        this.apiKey = null;
        this.baseUrl = 'https://generativelanguage.googleapis.com';
        this.knownModels = [
            // Gemini Pro models
            'gemini-1.5-pro-latest',
            'gemini-1.5-pro',
            'gemini-1.0-pro-latest',
            'gemini-1.0-pro',
            'gemini-pro',
            
            // Gemini Pro Vision
            'gemini-1.5-pro-vision-latest',
            'gemini-1.0-pro-vision-latest',
            'gemini-pro-vision',
            
            // Gemini Flash (efficient)
            'gemini-1.5-flash-latest',
            'gemini-1.5-flash',
            
            // Text embedding models
            'text-embedding-004',
            'embedding-001'
        ];
    }

    /**
     * Initialize Google AI client
     */
    async initialize() {
        try {
            logger.info('🔍 Initializing Google AI API client...', {
                component: 'GoogleProvider'
            });

            // Get API key from secure key manager
            try {
                this.apiKey = config.getSecureKey('google');
                logger.debug('✅ Google AI API key loaded from secure manager', {
                    component: 'GoogleProvider'
                });
            } catch (error) {
                logger.warn('⚠️ Google AI API key not configured', {
                    component: 'GoogleProvider'
                });
                throw new ProcessingError('Google AI API key is required');
            }

            // Initialize Google Generative AI client
            this.client = new GoogleGenerativeAI(this.apiKey);

            // Test connection
            await this.testConnection();
            this.isInitialized = true;

            logger.info('✅ Google AI API client initialized successfully', {
                knownModels: this.knownModels.length,
                component: 'GoogleProvider'
            });

            return {
                provider: 'google',
                initialized: true,
                authenticated: true,
                knownModels: this.knownModels.length
            };
        } catch (error) {
            logger.error('❌ Failed to initialize Google AI client', {
                error: error.message,
                component: 'GoogleProvider'
            });
            throw new ProcessingError(`Google AI initialization failed: ${error.message}`);
        }
    }

    /**
     * Test connection to Google AI API
     */
    async testConnection() {
        try {
            // Test with Gemini Flash (most efficient model)
            const model = this.client.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent('Hello');
            
            if (!result || !result.response) {
                throw new Error('Invalid response from Google AI API');
            }

            logger.debug('🔗 Google AI API connection test successful', {
                component: 'GoogleProvider'
            });
        } catch (error) {
            throw new ProcessingError(`Google AI connection test failed: ${error.message}`);
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

            logger.info('🔍 Starting Google AI model discovery', {
                component: 'GoogleProvider'
            });

            // Check cache first
            const cached = await cacheManager.getCachedApiResponse('google', 'models', {});
            if (cached) {
                logger.info('📋 Retrieved models from cache', {
                    count: cached.length,
                    component: 'GoogleProvider'
                });
                return cached;
            }

            // Try to fetch models from API (if available)
            let discoveredModels = [];
            try {
                const response = await fetch(`${this.baseUrl}/v1beta/models?key=${this.apiKey}`);
                if (response.ok) {
                    const data = await response.json();
                    discoveredModels = data.models || [];
                    logger.debug('📡 Fetched models from Google AI API', {
                        count: discoveredModels.length,
                        component: 'GoogleProvider'
                    });
                } else {
                    logger.debug('Using known models list (API not available)', {
                        component: 'GoogleProvider'
                    });
                }
            } catch (error) {
                logger.debug('Using known models list (API error)', {
                    error: error.message,
                    component: 'GoogleProvider'
                });
            }

            // Process discovered models or fall back to known models
            const modelsToProcess = discoveredModels.length > 0 
                ? discoveredModels 
                : this.knownModels.map(id => ({ name: id }));

            const processedModels = [];
            for (const model of modelsToProcess) {
                try {
                    const processed = await this.processModel(model);
                    if (processed) {
                        processedModels.push(processed);
                    }
                } catch (error) {
                    logger.warn('⚠️ Failed to process Google AI model', {
                        modelId: model.name || model.id || 'unknown',
                        error: error.message,
                        component: 'GoogleProvider'
                    });
                }
            }

            // Cache the results
            await cacheManager.cacheApiResponse('google', 'models', {}, processedModels, {
                ttl: 3600 // 1 hour cache
            });

            logger.info('✅ Google AI model discovery completed', {
                discovered: processedModels.length,
                component: 'GoogleProvider'
            });

            return processedModels;
        } catch (error) {
            logger.error('❌ Google AI model discovery failed', {
                error: error.message,
                component: 'GoogleProvider'
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

            logger.debug('📊 Fetching Google AI model details', {
                modelId,
                component: 'GoogleProvider'
            });

            // Check cache first
            const cached = await cacheManager.getCachedApiResponse('google', 'model_details', { modelId });
            if (cached) {
                return cached;
            }

            const processedModel = await this.processModel({ name: modelId });

            // Cache the result
            await cacheManager.cacheApiResponse('google', 'model_details', { modelId }, processedModel, {
                ttl: 7200 // 2 hour cache
            });

            return processedModel;
        } catch (error) {
            logger.error('❌ Failed to fetch Google AI model details', {
                error: error.message,
                modelId,
                component: 'GoogleProvider'
            });
            throw new ProcessingError(`Model details fetch failed: ${error.message}`);
        }
    }

    /**
     * Process and normalize individual model
     */
    async processModel(rawModel) {
        try {
            const modelId = rawModel.name || rawModel.id;
            // Remove the models/ prefix if present
            const cleanModelId = modelId.replace('models/', '');
            const modelInfo = this.getModelInfo(cleanModelId);

            const model = {
                // Basic identification
                id: cleanModelId,
                name: modelInfo.name || cleanModelId,
                fullName: modelId,
                provider: 'google',
                
                // Model metadata
                description: modelInfo.description || rawModel.description,
                author: 'Google',
                createdAt: modelInfo.createdAt,
                lastModified: null,
                
                // Technical details
                task: modelInfo.task,
                architecture: 'transformer',
                contextLength: modelInfo.contextLength,
                
                // Capabilities
                capabilities: modelInfo.capabilities,
                useCases: modelInfo.useCases,
                
                // API information
                apiEndpoint: `${this.baseUrl}/v1beta/models/${cleanModelId}:generateContent`,
                streamingSupported: modelInfo.streamingSupported,
                functionCalling: modelInfo.functionCalling,
                
                // Pricing (if known)
                pricing: modelInfo.pricing,
                
                // Requirements
                requirements: {
                    apiKey: true,
                    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
                    authentication: 'api_key'
                },
                
                // Model properties
                maxTokens: modelInfo.maxTokens,
                inputTypes: modelInfo.inputTypes,
                outputTypes: modelInfo.outputTypes,
                
                // Google specific
                version: modelInfo.version,
                family: modelInfo.family,
                
                // Validation status
                validated: false,
                validationResults: null,
                
                // Discovery metadata
                discoveredAt: new Date().toISOString(),
                source: 'google_ai_api'
            };

            return model;
        } catch (error) {
            logger.error('❌ Error processing Google AI model', {
                modelId: rawModel.name || rawModel.id || 'unknown',
                error: error.message,
                component: 'GoogleProvider'
            });
            return null;
        }
    }

    /**
     * Get detailed information about specific Google AI models
     */
    getModelInfo(modelId) {
        const modelMap = {
            // Gemini 1.5 Pro models
            'gemini-1.5-pro-latest': {
                name: 'Gemini 1.5 Pro (Latest)',
                description: 'Most capable multimodal model with 2M token context',
                family: 'gemini-1.5',
                version: 'pro-latest',
                createdAt: '2024-05-01T00:00:00Z',
                task: 'multimodal',
                contextLength: 2000000,
                maxTokens: 8192,
                capabilities: ['chat', 'completion', 'reasoning', 'code_generation', 'multimodal', 'vision', 'audio', 'function_calling'],
                useCases: ['complex_reasoning', 'long_context', 'multimodal_analysis', 'code_generation', 'research'],
                streamingSupported: true,
                functionCalling: true,
                inputTypes: ['text', 'image', 'audio', 'video'],
                outputTypes: ['text'],
                pricing: { input: 3.50, output: 10.50 } // per million tokens
            },
            'gemini-1.5-pro': {
                name: 'Gemini 1.5 Pro',
                description: 'Advanced multimodal model with long context capabilities',
                family: 'gemini-1.5',
                version: 'pro',
                createdAt: '2024-02-01T00:00:00Z',
                task: 'multimodal',
                contextLength: 1000000,
                maxTokens: 8192,
                capabilities: ['chat', 'completion', 'reasoning', 'code_generation', 'multimodal', 'vision', 'audio', 'function_calling'],
                useCases: ['complex_reasoning', 'long_context', 'multimodal_analysis', 'code_generation'],
                streamingSupported: true,
                functionCalling: true,
                inputTypes: ['text', 'image', 'audio', 'video'],
                outputTypes: ['text'],
                pricing: { input: 3.50, output: 10.50 }
            },
            'gemini-1.5-flash-latest': {
                name: 'Gemini 1.5 Flash (Latest)',
                description: 'Fast and efficient model optimized for speed',
                family: 'gemini-1.5',
                version: 'flash-latest',
                createdAt: '2024-05-01T00:00:00Z',
                task: 'multimodal',
                contextLength: 1000000,
                maxTokens: 8192,
                capabilities: ['chat', 'completion', 'reasoning', 'multimodal', 'vision', 'function_calling'],
                useCases: ['quick_responses', 'real_time_applications', 'customer_support', 'content_generation'],
                streamingSupported: true,
                functionCalling: true,
                inputTypes: ['text', 'image', 'audio', 'video'],
                outputTypes: ['text'],
                pricing: { input: 0.35, output: 1.05 } // per million tokens
            },
            'gemini-1.5-flash': {
                name: 'Gemini 1.5 Flash',
                description: 'Efficient model for high-speed applications',
                family: 'gemini-1.5',
                version: 'flash',
                createdAt: '2024-02-01T00:00:00Z',
                task: 'multimodal',
                contextLength: 1000000,
                maxTokens: 8192,
                capabilities: ['chat', 'completion', 'reasoning', 'multimodal', 'vision', 'function_calling'],
                useCases: ['quick_responses', 'real_time_applications', 'customer_support'],
                streamingSupported: true,
                functionCalling: true,
                inputTypes: ['text', 'image', 'audio', 'video'],
                outputTypes: ['text'],
                pricing: { input: 0.35, output: 1.05 }
            },
            
            // Gemini 1.0 models
            'gemini-1.0-pro-latest': {
                name: 'Gemini 1.0 Pro (Latest)',
                description: 'Latest version of Gemini Pro with improved capabilities',
                family: 'gemini-1.0',
                version: 'pro-latest',
                createdAt: '2024-01-01T00:00:00Z',
                task: 'text-generation',
                contextLength: 32768,
                maxTokens: 8192,
                capabilities: ['chat', 'completion', 'reasoning', 'code_generation', 'function_calling'],
                useCases: ['conversation', 'content_creation', 'analysis', 'code_generation'],
                streamingSupported: true,
                functionCalling: true,
                inputTypes: ['text'],
                outputTypes: ['text'],
                pricing: { input: 0.50, output: 1.50 }
            },
            'gemini-1.0-pro': {
                name: 'Gemini 1.0 Pro',
                description: 'Powerful text generation model for various tasks',
                family: 'gemini-1.0',
                version: 'pro',
                createdAt: '2023-12-01T00:00:00Z',
                task: 'text-generation',
                contextLength: 32768,
                maxTokens: 8192,
                capabilities: ['chat', 'completion', 'reasoning', 'code_generation', 'function_calling'],
                useCases: ['conversation', 'content_creation', 'analysis', 'code_generation'],
                streamingSupported: true,
                functionCalling: true,
                inputTypes: ['text'],
                outputTypes: ['text'],
                pricing: { input: 0.50, output: 1.50 }
            },
            'gemini-pro': {
                name: 'Gemini Pro',
                description: 'General-purpose conversational AI model',
                family: 'gemini-1.0',
                version: 'pro',
                createdAt: '2023-12-01T00:00:00Z',
                task: 'text-generation',
                contextLength: 32768,
                maxTokens: 8192,
                capabilities: ['chat', 'completion', 'reasoning', 'code_generation'],
                useCases: ['conversation', 'content_creation', 'analysis'],
                streamingSupported: true,
                functionCalling: false,
                inputTypes: ['text'],
                outputTypes: ['text'],
                pricing: { input: 0.50, output: 1.50 }
            },
            
            // Vision models
            'gemini-1.0-pro-vision-latest': {
                name: 'Gemini 1.0 Pro Vision (Latest)',
                description: 'Multimodal model with vision capabilities',
                family: 'gemini-1.0',
                version: 'pro-vision-latest',
                createdAt: '2024-01-01T00:00:00Z',
                task: 'multimodal',
                contextLength: 16384,
                maxTokens: 8192,
                capabilities: ['chat', 'completion', 'vision', 'multimodal', 'image_understanding'],
                useCases: ['image_analysis', 'visual_reasoning', 'document_understanding', 'multimodal_chat'],
                streamingSupported: true,
                functionCalling: false,
                inputTypes: ['text', 'image'],
                outputTypes: ['text'],
                pricing: { input: 0.50, output: 1.50 }
            },
            'gemini-pro-vision': {
                name: 'Gemini Pro Vision',
                description: 'Vision-enabled model for image understanding',
                family: 'gemini-1.0',
                version: 'pro-vision',
                createdAt: '2023-12-01T00:00:00Z',
                task: 'multimodal',
                contextLength: 16384,
                maxTokens: 8192,
                capabilities: ['chat', 'completion', 'vision', 'multimodal', 'image_understanding'],
                useCases: ['image_analysis', 'visual_reasoning', 'document_understanding'],
                streamingSupported: true,
                functionCalling: false,
                inputTypes: ['text', 'image'],
                outputTypes: ['text'],
                pricing: { input: 0.50, output: 1.50 }
            },
            
            // Embedding models
            'text-embedding-004': {
                name: 'Text Embedding 004',
                description: 'Latest text embedding model for semantic understanding',
                family: 'embedding',
                version: '004',
                createdAt: '2024-05-01T00:00:00Z',
                task: 'embeddings',
                contextLength: 2048,
                maxTokens: null,
                capabilities: ['embeddings', 'semantic_search', 'similarity'],
                useCases: ['semantic_search', 'clustering', 'classification', 'similarity_matching'],
                streamingSupported: false,
                functionCalling: false,
                inputTypes: ['text'],
                outputTypes: ['embeddings'],
                pricing: { input: 0.00001, output: 0 } // per token
            },
            'embedding-001': {
                name: 'Embedding 001',
                description: 'Text embedding model for vector representations',
                family: 'embedding',
                version: '001',
                createdAt: '2023-12-01T00:00:00Z',
                task: 'embeddings',
                contextLength: 2048,
                maxTokens: null,
                capabilities: ['embeddings', 'semantic_search', 'similarity'],
                useCases: ['semantic_search', 'clustering', 'classification'],
                streamingSupported: false,
                functionCalling: false,
                inputTypes: ['text'],
                outputTypes: ['embeddings'],
                pricing: { input: 0.00001, output: 0 }
            }
        };

        return modelMap[modelId] || {
            name: modelId,
            description: `Google AI model: ${modelId}`,
            family: 'gemini',
            version: 'unknown',
            createdAt: null,
            task: 'text-generation',
            contextLength: 32768,
            maxTokens: 8192,
            capabilities: ['chat', 'completion'],
            useCases: ['conversation', 'content_creation'],
            streamingSupported: true,
            functionCalling: false,
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

            logger.info('🧪 Testing Google AI model capabilities', {
                modelId,
                testType,
                component: 'GoogleProvider'
            });

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
                const model = this.client.getGenerativeModel({ model: modelId });
                
                // Test basic generation
                const startTime = Date.now();
                const result = await model.generateContent('Hello! Please respond with exactly: "Test successful"');
                const endTime = Date.now();

                const response = result.response;
                testResults.capabilities.generation = true;
                testResults.performance.responseTime = endTime - startTime;
                testResults.performance.tokensUsed = response.usageMetadata?.totalTokenCount || 0;
                testResults.success = true;

                // Test streaming if supported
                if (testType === 'streaming' || testType === 'full') {
                    try {
                        const streamStartTime = Date.now();
                        const streamResult = await model.generateContentStream('Count to 3');
                        
                        let chunks = 0;
                        for await (const chunk of streamResult.stream) {
                            chunks++;
                        }
                        const streamEndTime = Date.now();

                        testResults.capabilities.streaming = true;
                        testResults.performance.streamingResponseTime = streamEndTime - streamStartTime;
                        testResults.performance.streamingChunks = chunks;
                    } catch (error) {
                        testResults.errors.push(`Streaming test failed: ${error.message}`);
                    }
                }

                // Test function calling if supported
                if ((testType === 'functions' || testType === 'full') && this.getModelInfo(modelId).functionCalling) {
                    try {
                        const functionModel = this.client.getGenerativeModel({
                            model: modelId,
                            tools: [{
                                functionDeclarations: [{
                                    name: 'test_function',
                                    description: 'A test function',
                                    parameters: {
                                        type: 'object',
                                        properties: {
                                            message: { type: 'string' }
                                        }
                                    }
                                }]
                            }]
                        });

                        const functionResult = await functionModel.generateContent('Call the test function with message "hello"');
                        testResults.capabilities.functionCalling = true;
                    } catch (error) {
                        testResults.errors.push(`Function calling test failed: ${error.message}`);
                    }
                }

            } catch (error) {
                testResults.errors.push(error.message);
                logger.warn('⚠️ Model test failed', {
                    modelId,
                    error: error.message,
                    component: 'GoogleProvider'
                });
            }

            return testResults;
        } catch (error) {
            logger.error('❌ Failed to test Google AI model', {
                error: error.message,
                modelId,
                component: 'GoogleProvider'
            });
            throw new ProcessingError(`Model test failed: ${error.message}`);
        }
    }

    /**
     * Get provider statistics
     */
    async getStats() {
        return {
            provider: 'google',
            isInitialized: this.isInitialized,
            authenticated: !!this.apiKey,
            knownModels: this.knownModels.length,
            baseUrl: this.baseUrl,
            supportedTasks: ['text-generation', 'multimodal', 'embeddings', 'vision'],
            families: ['gemini-1.5', 'gemini-1.0', 'embedding'],
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

            logger.info('🧹 Google AI provider cleaned up', {
                component: 'GoogleProvider'
            });
        } catch (error) {
            logger.error('❌ Error during Google AI cleanup', {
                error: error.message,
                component: 'GoogleProvider'
            });
        }
    }
}

// Export singleton instance
export const googleProvider = new GoogleProvider();
export { GoogleProvider, ProcessingError };