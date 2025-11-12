/**
 * Qdrant Vector Database Connection
 * Module 2, Step 7: Initialize Qdrant vector database connection
 * 
 * Features:
 * - Connection management with retry logic
 * - Collection management for model embeddings
 * - Health checking and monitoring
 * - Error handling with structured logging
 */

import { QdrantVectorStore } from '@langchain/qdrant';
import { logger } from '../infrastructure/logger.js';
import { config } from '../infrastructure/config.js';
import { DatabaseError } from '../infrastructure/errors.js';

class QdrantManager {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.collections = new Map();
        this.connectionAttempts = 0;
        this.maxRetries = config.database.maxRetries || 3;
        this.retryDelay = config.database.retryDelay || 2000;
    }

    /**
     * Initialize connection to Qdrant database
     */
    async initialize() {
        try {
            logger.info('🔌 Initializing Qdrant vector database connection...', {
                host: config.database.qdrant.host,
                port: config.database.qdrant.port,
                component: 'QdrantManager'
            });

            await this.connect();
            await this.healthCheck();
            await this.initializeCollections();

            logger.info('✅ Qdrant database initialized successfully', {
                collections: Array.from(this.collections.keys()),
                component: 'QdrantManager'
            });

            return true;
        } catch (error) {
            logger.error('❌ Failed to initialize Qdrant database', {
                error: error.message,
                attempts: this.connectionAttempts,
                component: 'QdrantManager'
            });
            throw new DatabaseError(`Qdrant initialization failed: ${error.message}`);
        }
    }

    /**
     * Establish connection to Qdrant with retry logic
     */
    async connect() {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                this.connectionAttempts = attempt;
                
                // Initialize Qdrant client
                this.client = new QdrantVectorStore({
                    url: config.database.url,
                    apiKey: config.database.qdrant.apiKey || undefined,
                    collectionName: 'temp', // Temporary collection for connection test
                });

                // Test connection
                await this.healthCheck();
                this.isConnected = true;

                logger.info('🔗 Connected to Qdrant database', {
                    attempt,
                    host: config.database.qdrant.host,
                    port: config.database.qdrant.port,
                    component: 'QdrantManager'
                });

                return;
            } catch (error) {
                logger.warn(`⚠️ Qdrant connection attempt ${attempt} failed`, {
                    error: error.message,
                    attempt,
                    maxRetries: this.maxRetries,
                    component: 'QdrantManager'
                });

                if (attempt === this.maxRetries) {
                    throw new DatabaseError(`Failed to connect to Qdrant after ${this.maxRetries} attempts: ${error.message}`);
                }

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
            }
        }
    }

    /**
     * Perform health check on Qdrant connection
     */
    async healthCheck() {
        try {
            // Simple health check - try to get cluster info
            const response = await fetch(`${config.database.url}/cluster`, {
                headers: {
                    ...(config.database.qdrant.apiKey && {
                        'Authorization': `Bearer ${config.database.qdrant.apiKey}`
                    })
                }
            });
            
            if (!response.ok) {
                throw new Error(`Health check failed with status: ${response.status}`);
            }

            const clusterInfo = await response.json();
            
            logger.debug('🏥 Qdrant health check passed', {
                status: response.status,
                component: 'QdrantManager'
            });

            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                clusterInfo
            };
        } catch (error) {
            logger.error('💀 Qdrant health check failed', {
                error: error.message,
                component: 'QdrantManager'
            });
            throw new DatabaseError(`Qdrant health check failed: ${error.message}`);
        }
    }

    /**
     * Initialize required collections for model storage
     */
    async initializeCollections() {
        const requiredCollections = [
            {
                name: 'model_embeddings',
                config: {
                    vectors: {
                        size: 384, // FastEmbed default size
                        distance: 'Cosine'
                    }
                }
            },
            {
                name: 'model_metadata',
                config: {
                    vectors: {
                        size: 384,
                        distance: 'Cosine'
                    }
                }
            },
            {
                name: 'provider_data',
                config: {
                    vectors: {
                        size: 384,
                        distance: 'Cosine'
                    }
                }
            }
        ];

        for (const collection of requiredCollections) {
            try {
                await this.createCollection(collection.name, collection.config);
                this.collections.set(collection.name, collection.config);
                
                logger.info(`📁 Collection '${collection.name}' initialized`, {
                    collection: collection.name,
                    config: collection.config,
                    component: 'QdrantManager'
                });
            } catch (error) {
                logger.error(`❌ Failed to initialize collection '${collection.name}'`, {
                    collection: collection.name,
                    error: error.message,
                    component: 'QdrantManager'
                });
                throw error;
            }
        }
    }

    /**
     * Create a collection in Qdrant
     */
    async createCollection(name, collectionConfig) {
        try {
            const response = await fetch(
                `${config.database.url}/collections/${name}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(config.database.qdrant.apiKey && {
                            'Authorization': `Bearer ${config.database.qdrant.apiKey}`
                        })
                    },
                    body: JSON.stringify(collectionConfig)
                }
            );

            if (response.status === 409) {
                // Collection already exists
                logger.debug(`📁 Collection '${name}' already exists`, {
                    collection: name,
                    component: 'QdrantManager'
                });
                return;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`HTTP ${response.status}: ${errorData.message || 'Unknown error'}`);
            }

            logger.info(`✅ Created collection '${name}'`, {
                collection: name,
                config: collectionConfig,
                component: 'QdrantManager'
            });
        } catch (error) {
            throw new DatabaseError(`Failed to create collection '${name}': ${error.message}`);
        }
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            connectionAttempts: this.connectionAttempts,
            collections: Array.from(this.collections.keys()),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Disconnect from Qdrant
     */
    async disconnect() {
        try {
            if (this.client) {
                // QdrantVectorStore doesn't have explicit disconnect method
                this.client = null;
            }
            
            this.isConnected = false;
            this.collections.clear();

            logger.info('🔌 Disconnected from Qdrant database', {
                component: 'QdrantManager'
            });
        } catch (error) {
            logger.error('❌ Error during Qdrant disconnection', {
                error: error.message,
                component: 'QdrantManager'
            });
            throw new DatabaseError(`Failed to disconnect from Qdrant: ${error.message}`);
        }
    }

    /**
     * Get collection information
     */
    async getCollectionInfo(collectionName) {
        try {
            const response = await fetch(
                `${config.database.url}/collections/${collectionName}`,
                {
                    method: 'GET',
                    headers: {
                        ...(config.database.qdrant.apiKey && {
                            'Authorization': `Bearer ${config.database.qdrant.apiKey}`
                        })
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const info = await response.json();
            return info.result;
        } catch (error) {
            throw new DatabaseError(`Failed to get collection info for '${collectionName}': ${error.message}`);
        }
    }

    /**
     * List all collections
     */
    async listCollections() {
        try {
            const response = await fetch(
                `${config.database.url}/collections`,
                {
                    method: 'GET',
                    headers: {
                        ...(config.database.qdrant.apiKey && {
                            'Authorization': `Bearer ${config.database.qdrant.apiKey}`
                        })
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.result.collections;
        } catch (error) {
            throw new DatabaseError(`Failed to list collections: ${error.message}`);
        }
    }
}

// Export singleton instance
export const qdrantManager = new QdrantManager();
export { QdrantManager, DatabaseError };