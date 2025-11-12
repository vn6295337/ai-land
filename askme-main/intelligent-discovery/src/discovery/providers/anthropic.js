/**
 * Anthropic API Client
 * Module 3, Step 13: Set up Anthropic API client for model discovery
 * 
 * Features:
 * - Claude model enumeration and information
 * - API endpoint validation and testing
 * - Rate limiting and quota management
 * - Model capability assessment
 * - Integration with caching layer
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../core/infrastructure/logger.js';
import { config } from '../../core/infrastructure/config.js';
import { cacheManager } from '../../core/storage/cache.js';
import { ProcessingError } from '../../core/infrastructure/errors.js';

class AnthropicProvider {
    constructor() {
        this.client = null;
        this.isInitialized = false;
        this.apiKey = null;
        this.baseUrl = 'https://api.anthropic.com';
        this.knownModels = [
            // Claude 3 models
            'claude-3-opus-20240229',
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307',
            
            // Claude 2 models
            'claude-2.1',
            'claude-2.0',
            
            // Claude Instant
            'claude-instant-1.2'
        ];
    }

    /**
     * Initialize Anthropic client
     */
    async initialize() {
        try {
            logger.info('🏛️ Initializing Anthropic API client...', {
                component: 'AnthropicProvider'
            });

            // Get API key from secure key manager
            try {
                this.apiKey = config.getSecureKey('anthropic');
                logger.debug('✅ Anthropic API key loaded from secure manager', {
                    component: 'AnthropicProvider'
                });
            } catch (error) {
                logger.warn('⚠️ Anthropic API key not configured', {
                    component: 'AnthropicProvider'
                });
                throw new ProcessingError('Anthropic API key is required');
            }

            // Initialize Anthropic client
            this.client = new Anthropic({
                apiKey: this.apiKey,
                baseURL: this.baseUrl
            });

            // Test connection
            await this.testConnection();
            this.isInitialized = true;

            logger.info('✅ Anthropic API client initialized successfully', {
                knownModels: this.knownModels.length,
                component: 'AnthropicProvider'
            });

            return {
                provider: 'anthropic',
                initialized: true,
                authenticated: true,
                knownModels: this.knownModels.length
            };
        } catch (error) {
            logger.error('❌ Failed to initialize Anthropic client', {
                error: error.message,
                component: 'AnthropicProvider'
            });
            throw new ProcessingError(`Anthropic initialization failed: ${error.message}`);
        }
    }

    /**
     * Test connection to Anthropic API
     */
    async testConnection() {
        try {
            // Test with a simple message request to Claude
            const response = await this.client.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Hello' }]
            });

            if (!response || !response.content) {
                throw new Error('Invalid response from Anthropic API');
            }

            logger.debug('🔗 Anthropic API connection test successful', {
                component: 'AnthropicProvider'
            });
        } catch (error) {
            throw new ProcessingError(`Anthropic connection test failed: ${error.message}`);
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

            logger.info('🔍 Starting Anthropic model discovery', {
                component: 'AnthropicProvider'
            });

            // Check cache first
            const cached = await cacheManager.getCachedApiResponse('anthropic', 'models', {});
            if (cached) {
                logger.info('📋 Retrieved models from cache', {
                    count: cached.length,
                    component: 'AnthropicProvider'
                });
                return cached;
            }

            // Since Anthropic doesn't have a models endpoint, use known models
            const processedModels = [];
            for (const modelId of this.knownModels) {
                try {
                    const processed = await this.processModel({ id: modelId });
                    if (processed) {
                        processedModels.push(processed);
                    }
                } catch (error) {
                    logger.warn('⚠️ Failed to process Anthropic model', {
                        modelId,
                        error: error.message,
                        component: 'AnthropicProvider'
                    });
                }
            }

            // Cache the results
            await cacheManager.cacheApiResponse('anthropic', 'models', {}, processedModels, {
                ttl: 3600 // 1 hour cache
            });

            logger.info('✅ Anthropic model discovery completed', {
                discovered: processedModels.length,
                component: 'AnthropicProvider'
            });

            return processedModels;
        } catch (error) {
            logger.error('❌ Anthropic model discovery failed', {
                error: error.message,
                component: 'AnthropicProvider'
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

            logger.debug('📊 Fetching Anthropic model details', {
                modelId,
                component: 'AnthropicProvider'
            });

            // Check cache first
            const cached = await cacheManager.getCachedApiResponse('anthropic', 'model_details', { modelId });
            if (cached) {
                return cached;
            }

            const processedModel = await this.processModel({ id: modelId });

            // Cache the result
            await cacheManager.cacheApiResponse('anthropic', 'model_details', { modelId }, processedModel, {
                ttl: 7200 // 2 hour cache
            });

            return processedModel;
        } catch (error) {
            logger.error('❌ Failed to fetch Anthropic model details', {
                error: error.message,
                modelId,
                component: 'AnthropicProvider'
            });
            throw new ProcessingError(`Model details fetch failed: ${error.message}`);
        }
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
                name: modelInfo.name || modelId,
                fullName: modelId,
                provider: 'anthropic',
                
                // Model metadata
                description: modelInfo.description,
                author: 'Anthropic',
                createdAt: modelInfo.createdAt,
                lastModified: null,
                
                // Technical details
                task: 'text-generation',
                architecture: 'transformer',
                contextLength: modelInfo.contextLength,
                
                // Capabilities
                capabilities: modelInfo.capabilities,
                useCases: modelInfo.useCases,
                
                // API information
                apiEndpoint: `${this.baseUrl}/v1/messages`,
                streamingSupported: modelInfo.streamingSupported,
                functionCalling: modelInfo.functionCalling,
                
                // Pricing (if known)
                pricing: modelInfo.pricing,
                
                // Requirements
                requirements: {
                    apiKey: true,
                    endpoint: 'https://api.anthropic.com/v1/messages',
                    authentication: 'x_api_key'
                },
                
                // Model properties
                maxTokens: modelInfo.maxTokens,
                inputTypes: ['text'],
                outputTypes: ['text'],
                
                // Anthropic specific
                version: modelInfo.version,
                family: modelInfo.family,
                
                // Validation status
                validated: false,
                validationResults: null,
                
                // Discovery metadata
                discoveredAt: new Date().toISOString(),
                source: 'anthropic_known_models'
            };

            return model;
        } catch (error) {
            logger.error('❌ Error processing Anthropic model', {
                modelId: rawModel.id || 'unknown',
                error: error.message,
                component: 'AnthropicProvider'
            });
            return null;
        }
    }

    /**
     * Get detailed information about specific Anthropic models
     */
    getModelInfo(modelId) {
        const modelMap = {
            'claude-3-opus-20240229': {
                name: 'Claude 3 Opus',
                description: 'Most powerful Claude model, excels at complex reasoning and analysis',
                family: 'claude-3',
                version: 'opus',
                createdAt: '2024-02-29T00:00:00Z',
                contextLength: 200000,
                maxTokens: 4096,
                capabilities: ['chat', 'completion', 'reasoning', 'analysis', 'code_generation', 'multimodal', 'vision'],
                useCases: ['complex_reasoning', 'research', 'analysis', 'creative_writing', 'code_generation'],
                streamingSupported: true,
                functionCalling: false,
                pricing: { input: 15.00, output: 75.00 } // per million tokens
            },
            'claude-3-sonnet-20240229': {
                name: 'Claude 3 Sonnet',
                description: 'Balanced Claude model, great for most conversational and analytical tasks',
                family: 'claude-3',
                version: 'sonnet',
                createdAt: '2024-02-29T00:00:00Z',
                contextLength: 200000,
                maxTokens: 4096,
                capabilities: ['chat', 'completion', 'reasoning', 'analysis', 'code_generation', 'multimodal', 'vision'],
                useCases: ['conversation', 'content_creation', 'analysis', 'summarization', 'translation'],
                streamingSupported: true,
                functionCalling: false,
                pricing: { input: 3.00, output: 15.00 } // per million tokens
            },
            'claude-3-haiku-20240307': {
                name: 'Claude 3 Haiku',
                description: 'Fastest Claude model, optimized for speed and efficiency',
                family: 'claude-3',
                version: 'haiku',
                createdAt: '2024-03-07T00:00:00Z',
                contextLength: 200000,
                maxTokens: 4096,
                capabilities: ['chat', 'completion', 'quick_responses', 'multimodal', 'vision'],
                useCases: ['quick_responses', 'simple_tasks', 'customer_support', 'real_time_chat'],
                streamingSupported: true,
                functionCalling: false,
                pricing: { input: 0.25, output: 1.25 } // per million tokens
            },
            'claude-2.1': {
                name: 'Claude 2.1',
                description: 'Updated Claude 2 with improved accuracy and reduced hallucinations',
                family: 'claude-2',
                version: '2.1',
                createdAt: '2023-11-01T00:00:00Z',
                contextLength: 200000,
                maxTokens: 4096,
                capabilities: ['chat', 'completion', 'reasoning', 'analysis', 'code_generation'],
                useCases: ['conversation', 'content_creation', 'analysis', 'research', 'coding'],
                streamingSupported: true,
                functionCalling: false,
                pricing: { input: 8.00, output: 24.00 } // per million tokens
            },
            'claude-2.0': {
                name: 'Claude 2',
                description: 'Original Claude 2 model with strong reasoning capabilities',
                family: 'claude-2',
                version: '2.0',
                createdAt: '2023-07-01T00:00:00Z',
                contextLength: 100000,
                maxTokens: 4096,
                capabilities: ['chat', 'completion', 'reasoning', 'analysis', 'code_generation'],
                useCases: ['conversation', 'content_creation', 'analysis', 'research', 'coding'],
                streamingSupported: true,
                functionCalling: false,
                pricing: { input: 8.00, output: 24.00 } // per million tokens
            },
            'claude-instant-1.2': {
                name: 'Claude Instant 1.2',
                description: 'Fast and efficient Claude model for quick responses',
                family: 'claude-instant',
                version: '1.2',
                createdAt: '2023-08-01T00:00:00Z',
                contextLength: 100000,
                maxTokens: 4096,
                capabilities: ['chat', 'completion', 'quick_responses'],
                useCases: ['quick_responses', 'simple_tasks', 'customer_support', 'real_time_chat'],
                streamingSupported: true,
                functionCalling: false,
                pricing: { input: 0.80, output: 2.40 } // per million tokens
            }
        };

        return modelMap[modelId] || {
            name: modelId,
            description: `Anthropic Claude model: ${modelId}`,
            family: 'claude',
            version: 'unknown',
            createdAt: null,
            contextLength: 100000,
            maxTokens: 4096,
            capabilities: ['chat', 'completion'],
            useCases: ['conversation', 'content_creation'],
            streamingSupported: true,
            functionCalling: false,
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

            logger.info('🧪 Testing Anthropic model capabilities', {
                modelId,
                testType,
                component: 'AnthropicProvider'
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
                // Test basic message completion
                const startTime = Date.now();
                const response = await this.client.messages.create({
                    model: modelId,
                    max_tokens: 10,
                    messages: [{ role: 'user', content: 'Hello! Please respond with exactly: "Test successful"' }]
                });
                const endTime = Date.now();

                testResults.capabilities.chat = true;
                testResults.performance.responseTime = endTime - startTime;
                testResults.performance.tokensUsed = response.usage?.input_tokens + response.usage?.output_tokens || 0;
                testResults.success = true;

                // Test streaming if supported
                if (testType === 'streaming' || testType === 'full') {
                    try {
                        const streamStartTime = Date.now();
                        const stream = await this.client.messages.create({
                            model: modelId,
                            max_tokens: 10,
                            messages: [{ role: 'user', content: 'Count to 3' }],
                            stream: true
                        });

                        let chunks = 0;
                        for await (const chunk of stream) {
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

            } catch (error) {
                testResults.errors.push(error.message);
                logger.warn('⚠️ Model test failed', {
                    modelId,
                    error: error.message,
                    component: 'AnthropicProvider'
                });
            }

            return testResults;
        } catch (error) {
            logger.error('❌ Failed to test Anthropic model', {
                error: error.message,
                modelId,
                component: 'AnthropicProvider'
            });
            throw new ProcessingError(`Model test failed: ${error.message}`);
        }
    }

    /**
     * Get provider statistics
     */
    async getStats() {
        return {
            provider: 'anthropic',
            isInitialized: this.isInitialized,
            authenticated: !!this.apiKey,
            knownModels: this.knownModels.length,
            baseUrl: this.baseUrl,
            supportedTasks: ['text-generation', 'chat', 'reasoning', 'analysis'],
            families: ['claude-3', 'claude-2', 'claude-instant'],
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

            logger.info('🧹 Anthropic provider cleaned up', {
                component: 'AnthropicProvider'
            });
        } catch (error) {
            logger.error('❌ Error during Anthropic cleanup', {
                error: error.message,
                component: 'AnthropicProvider'
            });
        }
    }
}

// Export singleton instance
export const anthropicProvider = new AnthropicProvider();
export { AnthropicProvider, ProcessingError };