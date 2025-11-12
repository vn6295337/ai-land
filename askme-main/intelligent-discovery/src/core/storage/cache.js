/**
 * Local Caching Layer for API Responses
 * Module 2, Step 10: Set up local caching layer for API responses
 * 
 * Features:
 * - File-based and in-memory caching with TTL
 * - Automatic cache cleanup and management
 * - Provider-specific cache strategies
 * - Cache statistics and monitoring
 * - Compression and serialization
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../infrastructure/logger.js';
import { config } from '../infrastructure/config.js';
import { ProcessingError } from '../infrastructure/errors.js';

class CacheManager {
    constructor() {
        this.memoryCache = new Map();
        this.cacheDir = config.getCacheConfig().dir;
        this.defaultTtl = config.getCacheConfig().ttl;
        this.maxMemoryItems = 1000;
        this.compressionThreshold = 1024; // Compress items > 1KB
        this.stats = {
            hits: 0,
            misses: 0,
            writes: 0,
            evictions: 0
        };
        
        this.initialize();
    }

    /**
     * Initialize cache system
     */
    async initialize() {
        try {
            // Ensure cache directory exists
            await fs.mkdir(this.cacheDir, { recursive: true });
            
            // Clean up expired cache files on startup
            await this.cleanupExpiredFiles();
            
            logger.info('💾 Cache manager initialized', {
                cacheDir: this.cacheDir,
                defaultTtl: this.defaultTtl,
                maxMemoryItems: this.maxMemoryItems,
                component: 'CacheManager'
            });

            return true;
        } catch (error) {
            logger.error('❌ Failed to initialize cache manager', {
                error: error.message,
                component: 'CacheManager'
            });
            throw new ProcessingError(`Cache initialization failed: ${error.message}`);
        }
    }

    /**
     * Get item from cache (memory first, then disk)
     */
    async get(key, options = {}) {
        try {
            const cacheKey = this.generateCacheKey(key);
            
            // Check memory cache first
            const memoryItem = this.memoryCache.get(cacheKey);
            if (memoryItem && !this.isExpired(memoryItem)) {
                this.stats.hits++;
                logger.debug('📋 Cache hit (memory)', {
                    key: this.truncateKey(key),
                    component: 'CacheManager'
                });
                return memoryItem.data;
            }

            // Check disk cache
            const diskItem = await this.getFromDisk(cacheKey);
            if (diskItem && !this.isExpired(diskItem)) {
                // Promote to memory cache
                this.setInMemory(cacheKey, diskItem.data, diskItem.expiresAt);
                this.stats.hits++;
                logger.debug('📋 Cache hit (disk)', {
                    key: this.truncateKey(key),
                    component: 'CacheManager'
                });
                return diskItem.data;
            }

            this.stats.misses++;
            logger.debug('❌ Cache miss', {
                key: this.truncateKey(key),
                component: 'CacheManager'
            });
            return null;
        } catch (error) {
            logger.error('❌ Cache get error', {
                error: error.message,
                key: this.truncateKey(key),
                component: 'CacheManager'
            });
            return null;
        }
    }

    /**
     * Set item in cache (memory and disk)
     */
    async set(key, data, options = {}) {
        try {
            const cacheKey = this.generateCacheKey(key);
            const ttl = options.ttl || this.defaultTtl;
            const expiresAt = Date.now() + (ttl * 1000);
            const forceMemory = options.forceMemory || false;

            // Always store in memory for fast access
            this.setInMemory(cacheKey, data, expiresAt);

            // Store on disk for persistence (unless forced memory-only)
            if (!forceMemory) {
                await this.setOnDisk(cacheKey, data, expiresAt);
            }

            this.stats.writes++;
            logger.debug('💾 Cache set', {
                key: this.truncateKey(key),
                ttl,
                memoryOnly: forceMemory,
                dataSize: JSON.stringify(data).length,
                component: 'CacheManager'
            });

            return true;
        } catch (error) {
            logger.error('❌ Cache set error', {
                error: error.message,
                key: this.truncateKey(key),
                component: 'CacheManager'
            });
            return false;
        }
    }

    /**
     * Delete item from cache
     */
    async delete(key) {
        try {
            const cacheKey = this.generateCacheKey(key);
            
            // Remove from memory
            this.memoryCache.delete(cacheKey);
            
            // Remove from disk
            const filePath = this.getCacheFilePath(cacheKey);
            try {
                await fs.unlink(filePath);
            } catch (error) {
                // File might not exist, that's okay
            }

            logger.debug('🗑️ Cache delete', {
                key: this.truncateKey(key),
                component: 'CacheManager'
            });

            return true;
        } catch (error) {
            logger.error('❌ Cache delete error', {
                error: error.message,
                key: this.truncateKey(key),
                component: 'CacheManager'
            });
            return false;
        }
    }

    /**
     * Cache API response with provider-specific strategy
     */
    async cacheApiResponse(provider, endpoint, params, response, options = {}) {
        const cacheKey = this.generateApiCacheKey(provider, endpoint, params);
        const ttl = this.getProviderTtl(provider, options.ttl);
        
        return await this.set(cacheKey, {
            provider,
            endpoint,
            params,
            response,
            timestamp: Date.now()
        }, { ttl });
    }

    /**
     * Get cached API response
     */
    async getCachedApiResponse(provider, endpoint, params) {
        const cacheKey = this.generateApiCacheKey(provider, endpoint, params);
        const cached = await this.get(cacheKey);
        
        if (cached) {
            logger.info('🎯 API response cache hit', {
                provider,
                endpoint: this.truncateKey(endpoint),
                age: Date.now() - cached.timestamp,
                component: 'CacheManager'
            });
        }
        
        return cached?.response || null;
    }

    /**
     * Generate cache key for API requests
     */
    generateApiCacheKey(provider, endpoint, params) {
        const paramsStr = JSON.stringify(params || {});
        const combined = `api:${provider}:${endpoint}:${paramsStr}`;
        return this.generateCacheKey(combined);
    }

    /**
     * Get provider-specific TTL
     */
    getProviderTtl(provider, customTtl) {
        if (customTtl) return customTtl;
        
        // Provider-specific TTL strategies
        const providerTtls = {
            openai: 3600,      // 1 hour
            anthropic: 3600,   // 1 hour  
            google: 7200,      // 2 hours
            mistral: 3600,     // 1 hour
            cohere: 3600,      // 1 hour
            huggingface: 1800, // 30 minutes (more dynamic)
            groq: 1800,        // 30 minutes
            default: this.defaultTtl
        };

        return providerTtls[provider] || providerTtls.default;
    }

    /**
     * Generate hash-based cache key
     */
    generateCacheKey(input) {
        return crypto.createHash('sha256').update(input).digest('hex');
    }

    /**
     * Set item in memory cache with eviction
     */
    setInMemory(key, data, expiresAt) {
        // Evict oldest items if memory cache is full
        if (this.memoryCache.size >= this.maxMemoryItems) {
            const oldestKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(oldestKey);
            this.stats.evictions++;
        }

        this.memoryCache.set(key, {
            data,
            expiresAt,
            createdAt: Date.now()
        });
    }

    /**
     * Set item on disk with compression
     */
    async setOnDisk(key, data, expiresAt) {
        try {
            const filePath = this.getCacheFilePath(key);
            const cacheItem = {
                data,
                expiresAt,
                createdAt: Date.now()
            };

            let content = JSON.stringify(cacheItem);
            
            // Compress large items
            if (content.length > this.compressionThreshold) {
                const zlib = await import('zlib');
                content = zlib.gzipSync(Buffer.from(content)).toString('base64');
                cacheItem.compressed = true;
            }

            await fs.writeFile(filePath, typeof content === 'string' ? content : JSON.stringify(cacheItem));
        } catch (error) {
            logger.warn('⚠️ Failed to write cache to disk', {
                error: error.message,
                key: key.substring(0, 16),
                component: 'CacheManager'
            });
        }
    }

    /**
     * Get item from disk with decompression
     */
    async getFromDisk(key) {
        try {
            const filePath = this.getCacheFilePath(key);
            const content = await fs.readFile(filePath, 'utf8');
            
            let cacheItem;
            try {
                cacheItem = JSON.parse(content);
            } catch {
                // Might be compressed
                const zlib = await import('zlib');
                const decompressed = zlib.gunzipSync(Buffer.from(content, 'base64'));
                cacheItem = JSON.parse(decompressed.toString());
            }

            return cacheItem;
        } catch (error) {
            // File doesn't exist or is corrupted
            return null;
        }
    }

    /**
     * Get cache file path
     */
    getCacheFilePath(key) {
        return path.join(this.cacheDir, `${key}.cache`);
    }

    /**
     * Check if cache item is expired
     */
    isExpired(item) {
        return Date.now() > item.expiresAt;
    }

    /**
     * Clean up expired cache files
     */
    async cleanupExpiredFiles() {
        try {
            const files = await fs.readdir(this.cacheDir);
            const cacheFiles = files.filter(file => file.endsWith('.cache'));
            
            let cleanedCount = 0;
            for (const file of cacheFiles) {
                const filePath = path.join(this.cacheDir, file);
                try {
                    const content = await fs.readFile(filePath, 'utf8');
                    const cacheItem = JSON.parse(content);
                    
                    if (this.isExpired(cacheItem)) {
                        await fs.unlink(filePath);
                        cleanedCount++;
                    }
                } catch {
                    // Corrupted file, remove it
                    await fs.unlink(filePath);
                    cleanedCount++;
                }
            }

            if (cleanedCount > 0) {
                logger.info('🧹 Cleaned up expired cache files', {
                    cleaned: cleanedCount,
                    total: cacheFiles.length,
                    component: 'CacheManager'
                });
            }
        } catch (error) {
            logger.error('❌ Failed to cleanup cache files', {
                error: error.message,
                component: 'CacheManager'
            });
        }
    }

    /**
     * Clear all cache (memory and disk)
     */
    async clear() {
        try {
            // Clear memory cache
            this.memoryCache.clear();

            // Clear disk cache
            const files = await fs.readdir(this.cacheDir);
            const cacheFiles = files.filter(file => file.endsWith('.cache'));
            
            for (const file of cacheFiles) {
                await fs.unlink(path.join(this.cacheDir, file));
            }

            // Reset stats
            this.stats = {
                hits: 0,
                misses: 0,
                writes: 0,
                evictions: 0
            };

            logger.info('🗑️ All cache cleared', {
                filesRemoved: cacheFiles.length,
                component: 'CacheManager'
            });

            return true;
        } catch (error) {
            logger.error('❌ Failed to clear cache', {
                error: error.message,
                component: 'CacheManager'
            });
            return false;
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0 
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;

        return {
            ...this.stats,
            hitRate: `${hitRate}%`,
            memoryItems: this.memoryCache.size,
            maxMemoryItems: this.maxMemoryItems,
            cacheDir: this.cacheDir,
            defaultTtl: this.defaultTtl,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Truncate key for logging (security)
     */
    truncateKey(key) {
        return key.length > 50 ? `${key.substring(0, 50)}...` : key;
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            // Cleanup expired files one last time
            await this.cleanupExpiredFiles();
            
            // Clear memory cache
            this.memoryCache.clear();

            logger.info('🧹 CacheManager cleaned up', {
                component: 'CacheManager'
            });
        } catch (error) {
            logger.error('❌ Error during CacheManager cleanup', {
                error: error.message,
                component: 'CacheManager'
            });
        }
    }
}

// Export singleton instance
export const cacheManager = new CacheManager();
export { CacheManager, ProcessingError };