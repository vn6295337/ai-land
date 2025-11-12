/**
 * Rate Limiting and Quota Management
 * Module 3, Step 16: Implement rate limiting and quota management
 * 
 * Features:
 * - Provider-specific rate limiting
 * - Token bucket algorithm implementation
 * - Quota tracking and management
 * - Automatic backoff and retry logic
 * - Request prioritization and queuing
 */

import { logger } from '../../core/infrastructure/logger.js';
import { config } from '../../core/infrastructure/config.js';
import { ProcessingError } from '../../core/infrastructure/errors.js';

class RateLimiter {
    constructor() {
        this.limiters = new Map();
        this.quotas = new Map();
        this.requestQueues = new Map();
        this.backoffTimers = new Map();
        this.defaultConfig = config.getRateLimitConfig();
        this.setupProviderLimits();
    }

    /**
     * Set up provider-specific rate limits
     */
    setupProviderLimits() {
        // HuggingFace rate limits
        this.setProviderLimits('huggingface', {
            requestsPerMinute: 1000,
            requestsPerHour: 30000,
            requestsPerDay: 100000,
            burstLimit: 10,
            backoffMultiplier: 2,
            maxBackoffTime: 300000, // 5 minutes
            priority: 'normal'
        });

        // OpenAI rate limits
        this.setProviderLimits('openai', {
            requestsPerMinute: 3500,
            requestsPerHour: 200000,
            requestsPerDay: 1000000,
            tokensPerMinute: 350000,
            tokensPerDay: 10000000,
            burstLimit: 20,
            backoffMultiplier: 2,
            maxBackoffTime: 600000, // 10 minutes
            priority: 'high'
        });

        // Anthropic rate limits
        this.setProviderLimits('anthropic', {
            requestsPerMinute: 50,
            requestsPerHour: 1000,
            requestsPerDay: 10000,
            tokensPerMinute: 40000,
            tokensPerDay: 1000000,
            burstLimit: 5,
            backoffMultiplier: 2,
            maxBackoffTime: 600000,
            priority: 'high'
        });

        // Google AI rate limits
        this.setProviderLimits('google', {
            requestsPerMinute: 60,
            requestsPerHour: 1000,
            requestsPerDay: 15000,
            burstLimit: 10,
            backoffMultiplier: 2,
            maxBackoffTime: 300000,
            priority: 'high'
        });

        logger.info('⚡ Rate limiters configured for all providers', {
            providers: Array.from(this.limiters.keys()),
            component: 'RateLimiter'
        });
    }

    /**
     * Set provider-specific rate limits
     */
    setProviderLimits(provider, limits) {
        const limiter = {
            provider,
            limits,
            buckets: {
                minute: {
                    capacity: limits.requestsPerMinute,
                    tokens: limits.requestsPerMinute,
                    lastRefill: Date.now(),
                    refillRate: limits.requestsPerMinute / 60 // per second
                },
                hour: {
                    capacity: limits.requestsPerHour,
                    tokens: limits.requestsPerHour,
                    lastRefill: Date.now(),
                    refillRate: limits.requestsPerHour / 3600 // per second
                },
                day: {
                    capacity: limits.requestsPerDay,
                    tokens: limits.requestsPerDay,
                    lastRefill: Date.now(),
                    refillRate: limits.requestsPerDay / 86400 // per second
                }
            },
            tokenBuckets: limits.tokensPerMinute ? {
                minute: {
                    capacity: limits.tokensPerMinute,
                    tokens: limits.tokensPerMinute,
                    lastRefill: Date.now(),
                    refillRate: limits.tokensPerMinute / 60
                },
                day: limits.tokensPerDay ? {
                    capacity: limits.tokensPerDay,
                    tokens: limits.tokensPerDay,
                    lastRefill: Date.now(),
                    refillRate: limits.tokensPerDay / 86400
                } : null
            } : null,
            stats: {
                totalRequests: 0,
                rejectedRequests: 0,
                averageWaitTime: 0,
                lastRequest: null,
                quotaResetTime: null
            }
        };

        this.limiters.set(provider, limiter);
        this.requestQueues.set(provider, []);
        
        logger.debug(`⚡ Rate limiter configured: ${provider}`, {
            limits,
            component: 'RateLimiter'
        });
    }

    /**
     * Check if request is allowed and wait if necessary
     */
    async acquirePermission(provider, options = {}) {
        const {
            tokens = 1,
            priority = 'normal',
            timeout = 30000,
            retryOnLimit = true
        } = options;

        if (!this.limiters.has(provider)) {
            logger.warn(`⚠️ No rate limiter configured for provider: ${provider}`, {
                component: 'RateLimiter'
            });
            return { allowed: true, waitTime: 0 };
        }

        const limiter = this.limiters.get(provider);
        const startTime = Date.now();

        try {
            logger.debug(`🎫 Acquiring permission: ${provider}`, {
                tokens,
                priority,
                component: 'RateLimiter'
            });

            // Check if we're in backoff mode
            if (this.backoffTimers.has(provider)) {
                const backoffUntil = this.backoffTimers.get(provider);
                if (Date.now() < backoffUntil) {
                    const waitTime = backoffUntil - Date.now();
                    if (retryOnLimit && waitTime < timeout) {
                        logger.debug(`⏳ Waiting for backoff: ${provider}`, {
                            waitTime,
                            component: 'RateLimiter'
                        });
                        await this.sleep(waitTime);
                    } else {
                        throw new ProcessingError(`Provider ${provider} in backoff mode, wait ${waitTime}ms`);
                    }
                }
            }

            // Refill token buckets
            this.refillBuckets(limiter);

            // Check if request can be served immediately
            const canServe = this.checkLimits(limiter, tokens);
            
            if (canServe.allowed) {
                // Consume tokens
                this.consumeTokens(limiter, tokens);
                
                const waitTime = Date.now() - startTime;
                limiter.stats.totalRequests++;
                limiter.stats.lastRequest = new Date().toISOString();
                limiter.stats.averageWaitTime = (limiter.stats.averageWaitTime + waitTime) / 2;

                logger.debug(`✅ Permission granted: ${provider}`, {
                    tokens,
                    waitTime,
                    component: 'RateLimiter'
                });

                return { allowed: true, waitTime };
            }

            // Request needs to wait or be queued
            if (retryOnLimit) {
                const waitTime = canServe.retryAfter;
                
                if (waitTime > timeout) {
                    limiter.stats.rejectedRequests++;
                    throw new ProcessingError(`Rate limit exceeded for ${provider}, retry after ${waitTime}ms`);
                }

                // Queue the request if it can't be served immediately
                if (priority === 'high' || waitTime <= 5000) { // Wait up to 5 seconds
                    logger.info(`⏳ Rate limited, waiting: ${provider}`, {
                        waitTime,
                        priority,
                        component: 'RateLimiter'
                    });

                    await this.sleep(waitTime);
                    return await this.acquirePermission(provider, { 
                        ...options, 
                        timeout: timeout - waitTime 
                    });
                } else {
                    // Queue for later processing
                    return await this.queueRequest(provider, options);
                }
            }

            limiter.stats.rejectedRequests++;
            throw new ProcessingError(`Rate limit exceeded for ${provider}`);

        } catch (error) {
            logger.error(`❌ Failed to acquire permission: ${provider}`, {
                error: error.message,
                tokens,
                priority,
                component: 'RateLimiter'
            });
            throw error;
        }
    }

    /**
     * Refill token buckets based on time elapsed
     */
    refillBuckets(limiter) {
        const now = Date.now();

        // Refill request buckets
        for (const [period, bucket] of Object.entries(limiter.buckets)) {
            const timePassed = (now - bucket.lastRefill) / 1000; // seconds
            const tokensToAdd = Math.floor(timePassed * bucket.refillRate);
            
            if (tokensToAdd > 0) {
                bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
                bucket.lastRefill = now;
            }
        }

        // Refill token usage buckets if they exist
        if (limiter.tokenBuckets) {
            for (const [period, bucket] of Object.entries(limiter.tokenBuckets)) {
                if (bucket) {
                    const timePassed = (now - bucket.lastRefill) / 1000;
                    const tokensToAdd = Math.floor(timePassed * bucket.refillRate);
                    
                    if (tokensToAdd > 0) {
                        bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
                        bucket.lastRefill = now;
                    }
                }
            }
        }
    }

    /**
     * Check if limits allow the request
     */
    checkLimits(limiter, tokens) {
        // Check request limits
        for (const [period, bucket] of Object.entries(limiter.buckets)) {
            if (bucket.tokens < 1) {
                const refillTime = Math.ceil((1 - bucket.tokens) / bucket.refillRate * 1000);
                return {
                    allowed: false,
                    limitedBy: `${period}_requests`,
                    retryAfter: refillTime
                };
            }
        }

        // Check token limits if they exist
        if (limiter.tokenBuckets) {
            for (const [period, bucket] of Object.entries(limiter.tokenBuckets)) {
                if (bucket && bucket.tokens < tokens) {
                    const refillTime = Math.ceil((tokens - bucket.tokens) / bucket.refillRate * 1000);
                    return {
                        allowed: false,
                        limitedBy: `${period}_tokens`,
                        retryAfter: refillTime
                    };
                }
            }
        }

        return { allowed: true };
    }

    /**
     * Consume tokens from buckets
     */
    consumeTokens(limiter, tokens) {
        // Consume from request buckets
        for (const bucket of Object.values(limiter.buckets)) {
            bucket.tokens = Math.max(0, bucket.tokens - 1);
        }

        // Consume from token buckets if they exist
        if (limiter.tokenBuckets) {
            for (const bucket of Object.values(limiter.tokenBuckets)) {
                if (bucket) {
                    bucket.tokens = Math.max(0, bucket.tokens - tokens);
                }
            }
        }
    }

    /**
     * Queue request for later processing
     */
    async queueRequest(provider, options) {
        return new Promise((resolve, reject) => {
            const queue = this.requestQueues.get(provider);
            const queueItem = {
                options,
                resolve,
                reject,
                timestamp: Date.now()
            };

            // Insert based on priority
            if (options.priority === 'high') {
                queue.unshift(queueItem);
            } else {
                queue.push(queueItem);
            }

            logger.debug(`📥 Request queued: ${provider}`, {
                queueLength: queue.length,
                priority: options.priority,
                component: 'RateLimiter'
            });

            // Process queue after delay
            setTimeout(() => this.processQueue(provider), 1000);

            // Timeout handling
            setTimeout(() => {
                const index = queue.indexOf(queueItem);
                if (index !== -1) {
                    queue.splice(index, 1);
                    reject(new ProcessingError(`Request timeout for ${provider}`));
                }
            }, options.timeout || 30000);
        });
    }

    /**
     * Process queued requests
     */
    async processQueue(provider) {
        const queue = this.requestQueues.get(provider);
        if (queue.length === 0) return;

        const queueItem = queue.shift();
        
        try {
            const result = await this.acquirePermission(provider, {
                ...queueItem.options,
                timeout: queueItem.options.timeout - (Date.now() - queueItem.timestamp)
            });
            queueItem.resolve(result);
        } catch (error) {
            queueItem.reject(error);
        }

        // Continue processing queue if items remain
        if (queue.length > 0) {
            setTimeout(() => this.processQueue(provider), 100);
        }
    }

    /**
     * Handle rate limit exceeded response
     */
    handleRateLimitExceeded(provider, response) {
        const limiter = this.limiters.get(provider);
        if (!limiter) return;

        // Extract rate limit information from response headers
        const resetTime = this.extractResetTime(response);
        const retryAfter = this.extractRetryAfter(response);

        if (resetTime) {
            limiter.stats.quotaResetTime = new Date(resetTime).toISOString();
        }

        // Implement exponential backoff
        const backoffTime = retryAfter || (limiter.limits.backoffMultiplier * 1000);
        const maxBackoff = limiter.limits.maxBackoffTime;
        const actualBackoff = Math.min(backoffTime, maxBackoff);

        this.backoffTimers.set(provider, Date.now() + actualBackoff);

        logger.warn(`🚫 Rate limit exceeded: ${provider}`, {
            backoffTime: actualBackoff,
            resetTime: limiter.stats.quotaResetTime,
            component: 'RateLimiter'
        });

        // Clear backoff timer after the backoff period
        setTimeout(() => {
            this.backoffTimers.delete(provider);
            logger.info(`✅ Backoff cleared: ${provider}`, {
                component: 'RateLimiter'
            });
        }, actualBackoff);
    }

    /**
     * Extract reset time from response headers
     */
    extractResetTime(response) {
        if (!response || !response.headers) return null;

        // Common header patterns
        const resetHeaders = [
            'x-ratelimit-reset',
            'x-rate-limit-reset',
            'ratelimit-reset',
            'rate-limit-reset'
        ];

        for (const header of resetHeaders) {
            const value = response.headers[header] || response.headers[header.toLowerCase()];
            if (value) {
                // Handle both timestamp and seconds-from-now formats
                const resetTime = parseInt(value);
                return resetTime > 1000000000 ? resetTime * 1000 : Date.now() + (resetTime * 1000);
            }
        }

        return null;
    }

    /**
     * Extract retry after time from response headers
     */
    extractRetryAfter(response) {
        if (!response || !response.headers) return null;

        const retryAfter = response.headers['retry-after'] || response.headers['Retry-After'];
        if (retryAfter) {
            return parseInt(retryAfter) * 1000; // Convert to milliseconds
        }

        return null;
    }

    /**
     * Get rate limiter statistics
     */
    getStats(provider = null) {
        if (provider) {
            const limiter = this.limiters.get(provider);
            if (!limiter) {
                throw new ProcessingError(`No rate limiter found for provider: ${provider}`);
            }

            return {
                provider,
                limits: limiter.limits,
                currentTokens: Object.fromEntries(
                    Object.entries(limiter.buckets).map(([period, bucket]) => [
                        period,
                        { available: bucket.tokens, capacity: bucket.capacity }
                    ])
                ),
                currentTokenUsage: limiter.tokenBuckets ? Object.fromEntries(
                    Object.entries(limiter.tokenBuckets).map(([period, bucket]) => [
                        period,
                        bucket ? { available: bucket.tokens, capacity: bucket.capacity } : null
                    ])
                ) : null,
                stats: limiter.stats,
                queueLength: this.requestQueues.get(provider).length,
                inBackoff: this.backoffTimers.has(provider),
                timestamp: new Date().toISOString()
            };
        }

        // Return stats for all providers
        const allStats = {};
        for (const providerName of this.limiters.keys()) {
            allStats[providerName] = this.getStats(providerName);
        }

        return {
            rateLimiter: 'RateLimiter',
            providers: allStats,
            totalProviders: this.limiters.size,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Reset rate limits for a provider
     */
    resetLimits(provider) {
        const limiter = this.limiters.get(provider);
        if (!limiter) return false;

        // Reset all buckets to full capacity
        for (const bucket of Object.values(limiter.buckets)) {
            bucket.tokens = bucket.capacity;
            bucket.lastRefill = Date.now();
        }

        if (limiter.tokenBuckets) {
            for (const bucket of Object.values(limiter.tokenBuckets)) {
                if (bucket) {
                    bucket.tokens = bucket.capacity;
                    bucket.lastRefill = Date.now();
                }
            }
        }

        // Clear backoff
        this.backoffTimers.delete(provider);

        // Reset stats
        limiter.stats = {
            totalRequests: 0,
            rejectedRequests: 0,
            averageWaitTime: 0,
            lastRequest: null,
            quotaResetTime: null
        };

        logger.info(`🔄 Rate limits reset: ${provider}`, {
            component: 'RateLimiter'
        });

        return true;
    }

    /**
     * Sleep utility function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        try {
            // Clear all timers
            for (const timer of this.backoffTimers.values()) {
                clearTimeout(timer);
            }

            // Clear all queues
            for (const queue of this.requestQueues.values()) {
                queue.forEach(item => {
                    if (item.reject) {
                        item.reject(new Error('Rate limiter shutting down'));
                    }
                });
                queue.length = 0;
            }

            this.limiters.clear();
            this.quotas.clear();
            this.requestQueues.clear();
            this.backoffTimers.clear();

            logger.info('🧹 Rate limiter cleaned up', {
                component: 'RateLimiter'
            });
        } catch (error) {
            logger.error('❌ Error during rate limiter cleanup', {
                error: error.message,
                component: 'RateLimiter'
            });
        }
    }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();
export { RateLimiter, ProcessingError };