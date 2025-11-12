/**
 * FastEmbed Text-to-Vector Conversion
 * Module 2, Step 9: Set up FastEmbed for text-to-vector conversion
 * 
 * Features:
 * - High-performance text embeddings generation
 * - Multiple embedding models support
 * - Batch processing for efficiency
 * - Caching for repeated texts
 * - Integration with Qdrant vector database
 */

import { FastEmbed } from 'fastembed';
import { logger } from '../infrastructure/logger.js';
import { config } from '../infrastructure/config.js';
import { ProcessingError } from '../infrastructure/errors.js';

class EmbeddingsManager {
    constructor() {
        this.embedModel = null;
        this.isInitialized = false;
        this.cache = new Map();
        this.modelName = config.embeddings?.model || 'BAAI/bge-small-en';
        this.maxCacheSize = config.embeddings?.maxCacheSize || 1000;
        this.batchSize = config.embeddings?.batchSize || 100;
    }

    /**
     * Initialize FastEmbed model
     */
    async initialize() {
        try {
            logger.info('🧠 Initializing FastEmbed text-to-vector conversion...', {
                model: this.modelName,
                component: 'EmbeddingsManager'
            });

            // Initialize FastEmbed with specified model
            this.embedModel = new FastEmbed({
                model: this.modelName,
                maxLength: 512, // Standard BERT-like limit
                cache: true     // Enable model caching
            });

            await this.embedModel.init();
            this.isInitialized = true;

            // Test embedding generation
            const testEmbedding = await this.generateEmbedding('test initialization');
            
            logger.info('✅ FastEmbed initialized successfully', {
                model: this.modelName,
                embeddingDimension: testEmbedding.length,
                component: 'EmbeddingsManager'
            });

            return {
                model: this.modelName,
                dimension: testEmbedding.length,
                initialized: true
            };
        } catch (error) {
            logger.error('❌ Failed to initialize FastEmbed', {
                error: error.message,
                model: this.modelName,
                component: 'EmbeddingsManager'
            });
            throw new ProcessingError(`FastEmbed initialization failed: ${error.message}`);
        }
    }

    /**
     * Generate embedding for a single text
     */
    async generateEmbedding(text) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            if (!text || typeof text !== 'string') {
                throw new Error('Text must be a non-empty string');
            }

            // Check cache first
            const cacheKey = this.getCacheKey(text);
            if (this.cache.has(cacheKey)) {
                logger.debug('📋 Retrieved embedding from cache', {
                    textLength: text.length,
                    component: 'EmbeddingsManager'
                });
                return this.cache.get(cacheKey);
            }

            // Generate embedding
            const embeddings = await this.embedModel.embed([text]);
            const embedding = embeddings[0];

            // Cache the result
            this.addToCache(cacheKey, embedding);

            logger.debug('🔢 Generated text embedding', {
                textLength: text.length,
                embeddingDimension: embedding.length,
                component: 'EmbeddingsManager'
            });

            return embedding;
        } catch (error) {
            logger.error('❌ Failed to generate embedding', {
                error: error.message,
                textLength: text?.length || 0,
                component: 'EmbeddingsManager'
            });
            throw new ProcessingError(`Embedding generation failed: ${error.message}`);
        }
    }

    /**
     * Generate embeddings for multiple texts (batch processing)
     */
    async generateEmbeddings(texts) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            if (!Array.isArray(texts) || texts.length === 0) {
                throw new Error('Texts must be a non-empty array');
            }

            // Validate all texts
            const validTexts = texts.filter(text => text && typeof text === 'string');
            if (validTexts.length !== texts.length) {
                logger.warn('⚠️ Some texts were filtered out (invalid format)', {
                    original: texts.length,
                    valid: validTexts.length,
                    component: 'EmbeddingsManager'
                });
            }

            // Check cache for each text
            const embeddings = [];
            const uncachedTexts = [];
            const uncachedIndices = [];

            for (let i = 0; i < validTexts.length; i++) {
                const text = validTexts[i];
                const cacheKey = this.getCacheKey(text);
                
                if (this.cache.has(cacheKey)) {
                    embeddings[i] = this.cache.get(cacheKey);
                } else {
                    uncachedTexts.push(text);
                    uncachedIndices.push(i);
                }
            }

            // Process uncached texts in batches
            if (uncachedTexts.length > 0) {
                logger.info('🔄 Processing batch embeddings', {
                    totalTexts: validTexts.length,
                    cached: validTexts.length - uncachedTexts.length,
                    toProcess: uncachedTexts.length,
                    batchSize: this.batchSize,
                    component: 'EmbeddingsManager'
                });

                for (let i = 0; i < uncachedTexts.length; i += this.batchSize) {
                    const batch = uncachedTexts.slice(i, i + this.batchSize);
                    const batchEmbeddings = await this.embedModel.embed(batch);

                    // Store embeddings and cache them
                    for (let j = 0; j < batch.length; j++) {
                        const originalIndex = uncachedIndices[i + j];
                        const text = batch[j];
                        const embedding = batchEmbeddings[j];

                        embeddings[originalIndex] = embedding;
                        this.addToCache(this.getCacheKey(text), embedding);
                    }

                    logger.debug(`✅ Processed batch ${Math.floor(i / this.batchSize) + 1}`, {
                        batchSize: batch.length,
                        processed: Math.min(i + this.batchSize, uncachedTexts.length),
                        total: uncachedTexts.length,
                        component: 'EmbeddingsManager'
                    });
                }
            }

            logger.info('✅ Batch embeddings generation completed', {
                totalEmbeddings: embeddings.length,
                dimension: embeddings[0]?.length || 0,
                component: 'EmbeddingsManager'
            });

            return embeddings;
        } catch (error) {
            logger.error('❌ Failed to generate batch embeddings', {
                error: error.message,
                textsCount: texts?.length || 0,
                component: 'EmbeddingsManager'
            });
            throw new ProcessingError(`Batch embedding generation failed: ${error.message}`);
        }
    }

    /**
     * Generate cache key for text
     */
    getCacheKey(text) {
        // Use first 100 chars + length as cache key to avoid storing full text
        const preview = text.substring(0, 100);
        return `${preview}_${text.length}`;
    }

    /**
     * Add embedding to cache with size management
     */
    addToCache(key, embedding) {
        // Remove oldest entries if cache is full
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, embedding);
    }

    /**
     * Generate embeddings for model metadata
     */
    async generateModelEmbedding(modelData) {
        try {
            // Create comprehensive text representation of model
            const modelText = this.modelDataToText(modelData);
            return await this.generateEmbedding(modelText);
        } catch (error) {
            logger.error('❌ Failed to generate model embedding', {
                error: error.message,
                modelId: modelData?.id || 'unknown',
                component: 'EmbeddingsManager'
            });
            throw new ProcessingError(`Model embedding generation failed: ${error.message}`);
        }
    }

    /**
     * Convert model data to searchable text
     */
    modelDataToText(modelData) {
        const parts = [];

        // Basic info
        if (modelData.id) parts.push(`Model: ${modelData.id}`);
        if (modelData.name) parts.push(`Name: ${modelData.name}`);
        if (modelData.description) parts.push(`Description: ${modelData.description}`);

        // Provider and architecture
        if (modelData.provider) parts.push(`Provider: ${modelData.provider}`);
        if (modelData.architecture) parts.push(`Architecture: ${modelData.architecture}`);
        if (modelData.type) parts.push(`Type: ${modelData.type}`);

        // Capabilities
        if (modelData.capabilities && Array.isArray(modelData.capabilities)) {
            parts.push(`Capabilities: ${modelData.capabilities.join(', ')}`);
        }

        // Use cases
        if (modelData.useCases && Array.isArray(modelData.useCases)) {
            parts.push(`Use Cases: ${modelData.useCases.join(', ')}`);
        }

        // Tags
        if (modelData.tags && Array.isArray(modelData.tags)) {
            parts.push(`Tags: ${modelData.tags.join(', ')}`);
        }

        return parts.join('. ');
    }

    /**
     * Get similarity score between two embeddings
     */
    calculateSimilarity(embedding1, embedding2) {
        try {
            if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
                throw new Error('Invalid embeddings for similarity calculation');
            }

            // Calculate cosine similarity
            let dotProduct = 0;
            let norm1 = 0;
            let norm2 = 0;

            for (let i = 0; i < embedding1.length; i++) {
                dotProduct += embedding1[i] * embedding2[i];
                norm1 += embedding1[i] * embedding1[i];
                norm2 += embedding2[i] * embedding2[i];
            }

            const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
            return Math.max(-1, Math.min(1, similarity)); // Clamp to [-1, 1]
        } catch (error) {
            logger.error('❌ Failed to calculate similarity', {
                error: error.message,
                component: 'EmbeddingsManager'
            });
            return 0;
        }
    }

    /**
     * Get embedding statistics
     */
    getStats() {
        return {
            isInitialized: this.isInitialized,
            model: this.modelName,
            cacheSize: this.cache.size,
            maxCacheSize: this.maxCacheSize,
            batchSize: this.batchSize,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Clear embedding cache
     */
    clearCache() {
        this.cache.clear();
        logger.info('🗑️ Embedding cache cleared', {
            component: 'EmbeddingsManager'
        });
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            this.clearCache();
            
            if (this.embedModel) {
                // FastEmbed doesn't have explicit cleanup method
                this.embedModel = null;
            }
            
            this.isInitialized = false;

            logger.info('🧹 EmbeddingsManager cleaned up', {
                component: 'EmbeddingsManager'
            });
        } catch (error) {
            logger.error('❌ Error during EmbeddingsManager cleanup', {
                error: error.message,
                component: 'EmbeddingsManager'
            });
        }
    }
}

// Export singleton instance
export const embeddingsManager = new EmbeddingsManager();
export { EmbeddingsManager, ProcessingError };