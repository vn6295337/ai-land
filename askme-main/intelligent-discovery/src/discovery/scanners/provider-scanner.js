/**
 * Provider-Specific Model Scanners
 * Module 4, Step 18: Create provider-specific model scanners
 * 
 * Features:
 * - Unified scanning interface across all providers
 * - Provider-specific optimization strategies
 * - Concurrent scanning with rate limiting
 * - Progress tracking and error handling
 * - Resumable scans and state management
 */

import { logger } from '../../core/infrastructure/logger.js';
import { config } from '../../core/infrastructure/config.js';
import { cacheManager } from '../../core/storage/cache.js';
import { rateLimiter } from '../providers/ratelimiter.js';
import { ProcessingError } from '../../core/infrastructure/errors.js';
import fs from 'fs/promises';
import path from 'path';

// Import all providers
import { huggingFaceProvider } from '../providers/huggingface.js';
import { openaiProvider } from '../providers/openai.js';
import { anthropicProvider } from '../providers/anthropic.js';
import { googleProvider } from '../providers/google.js';

class ProviderScanner {
    constructor() {
        this.providers = new Map();
        this.scanStrategies = new Map();
        this.activeScanners = new Map();
        this.scanResults = new Map();
        this.progressDir = path.join('data', 'scan_progress');
        this.resultsDir = path.join('data', 'scan_results');
        
        this.setupProviders();
        this.setupScanStrategies();
    }

    /**
     * Set up all available providers
     */
    setupProviders() {
        this.providers.set('huggingface', huggingFaceProvider);
        this.providers.set('openai', openaiProvider);
        this.providers.set('anthropic', anthropicProvider);
        this.providers.set('google', googleProvider);

        logger.info('📋 Provider scanners configured', {
            providers: Array.from(this.providers.keys()),
            component: 'ProviderScanner'
        });
    }

    /**
     * Set up provider-specific scanning strategies
     */
    setupScanStrategies() {
        // HuggingFace scanning strategy
        this.scanStrategies.set('huggingface', {
            name: 'HuggingFace Comprehensive Scan',
            type: 'paginated',
            batchSize: 100,
            maxConcurrent: 3,
            delayBetweenBatches: 1000,
            supportsFiltering: true,
            supportsResume: true,
            expectedCount: 400000,
            priority: 'high',
            scanner: this.scanHuggingFace.bind(this)
        });

        // OpenAI scanning strategy
        this.scanStrategies.set('openai', {
            name: 'OpenAI Models Scan',
            type: 'complete',
            batchSize: 50,
            maxConcurrent: 1,
            delayBetweenBatches: 2000,
            supportsFiltering: false,
            supportsResume: false,
            expectedCount: 50,
            priority: 'high',
            scanner: this.scanOpenAI.bind(this)
        });

        // Anthropic scanning strategy
        this.scanStrategies.set('anthropic', {
            name: 'Anthropic Claude Models Scan',
            type: 'complete',
            batchSize: 20,
            maxConcurrent: 1,
            delayBetweenBatches: 3000,
            supportsFiltering: false,
            supportsResume: false,
            expectedCount: 15,
            priority: 'high',
            scanner: this.scanAnthropic.bind(this)
        });

        // Google scanning strategy
        this.scanStrategies.set('google', {
            name: 'Google AI Models Scan',
            type: 'api_discovery',
            batchSize: 30,
            maxConcurrent: 2,
            delayBetweenBatches: 1500,
            supportsFiltering: true,
            supportsResume: false,
            expectedCount: 30,
            priority: 'high',
            scanner: this.scanGoogle.bind(this)
        });

        logger.info('⚙️ Scan strategies configured', {
            strategies: Array.from(this.scanStrategies.keys()),
            component: 'ProviderScanner'
        });
    }

    /**
     * Initialize scanner
     */
    async initialize() {
        try {
            logger.info('🚀 Initializing Provider Scanner...', {
                component: 'ProviderScanner'
            });

            // Ensure directories exist
            await fs.mkdir(this.progressDir, { recursive: true });
            await fs.mkdir(this.resultsDir, { recursive: true });

            // Initialize all providers
            const initResults = await this.initializeProviders();

            logger.info('✅ Provider Scanner initialized', {
                initializedProviders: initResults.initialized.length,
                failedProviders: initResults.failed.length,
                component: 'ProviderScanner'
            });

            return {
                scanner: 'ProviderScanner',
                initialized: true,
                providers: initResults
            };
        } catch (error) {
            logger.error('❌ Failed to initialize Provider Scanner', {
                error: error.message,
                component: 'ProviderScanner'
            });
            throw new ProcessingError(`Provider scanner initialization failed: ${error.message}`);
        }
    }

    /**
     * Initialize all providers
     */
    async initializeProviders() {
        const results = {
            initialized: [],
            failed: []
        };

        for (const [name, provider] of this.providers.entries()) {
            try {
                if (!provider.isInitialized) {
                    await provider.initialize();
                }
                results.initialized.push(name);
                
                logger.debug(`✅ Provider initialized: ${name}`, {
                    component: 'ProviderScanner'
                });
            } catch (error) {
                results.failed.push({ name, error: error.message });
                
                logger.warn(`⚠️ Provider initialization failed: ${name}`, {
                    error: error.message,
                    component: 'ProviderScanner'
                });
            }
        }

        return results;
    }

    /**
     * Scan specific provider
     */
    async scanProvider(providerName, options = {}) {
        try {
            if (!this.providers.has(providerName)) {
                throw new ProcessingError(`Unknown provider: ${providerName}`);
            }

            if (!this.scanStrategies.has(providerName)) {
                throw new ProcessingError(`No scan strategy for provider: ${providerName}`);
            }

            if (this.activeScanners.has(providerName)) {
                throw new ProcessingError(`Scan already active for provider: ${providerName}`);
            }

            const strategy = this.scanStrategies.get(providerName);
            const provider = this.providers.get(providerName);

            logger.info(`🔍 Starting provider scan: ${providerName}`, {
                strategy: strategy.name,
                type: strategy.type,
                expectedCount: strategy.expectedCount,
                options,
                component: 'ProviderScanner'
            });

            // Create scan context
            const scanContext = {
                providerName,
                strategy,
                provider,
                options: {
                    ...options,
                    batchSize: options.batchSize || strategy.batchSize,
                    maxConcurrent: options.maxConcurrent || strategy.maxConcurrent,
                    delayBetweenBatches: options.delayBetweenBatches || strategy.delayBetweenBatches
                },
                startTime: Date.now(),
                stats: {
                    totalProcessed: 0,
                    totalFound: 0,
                    totalErrors: 0,
                    batchesProcessed: 0
                },
                results: []
            };

            this.activeScanners.set(providerName, scanContext);

            try {
                // Execute provider-specific scan
                const results = await strategy.scanner(scanContext);

                // Finalize scan
                scanContext.endTime = Date.now();
                scanContext.duration = scanContext.endTime - scanContext.startTime;
                scanContext.status = 'completed';

                // Save results
                await this.saveScanResults(providerName, scanContext, results);

                this.activeScanners.delete(providerName);
                this.scanResults.set(providerName, {
                    ...scanContext,
                    results
                });

                logger.info(`✅ Provider scan completed: ${providerName}`, {
                    totalFound: scanContext.stats.totalFound,
                    duration: `${scanContext.duration}ms`,
                    component: 'ProviderScanner'
                });

                return {
                    providerName,
                    status: 'completed',
                    results,
                    stats: scanContext.stats,
                    duration: scanContext.duration,
                    summary: await this.generateProviderSummary(providerName, scanContext)
                };

            } catch (error) {
                scanContext.status = 'failed';
                scanContext.error = error.message;
                this.activeScanners.delete(providerName);

                throw error;
            }

        } catch (error) {
            logger.error(`❌ Provider scan failed: ${providerName}`, {
                error: error.message,
                component: 'ProviderScanner'
            });
            throw new ProcessingError(`Provider scan failed for ${providerName}: ${error.message}`);
        }
    }

    /**
     * Scan all providers
     */
    async scanAllProviders(options = {}) {
        try {
            const {
                parallel = true,
                providerPriority = ['openai', 'anthropic', 'google', 'huggingface'],
                continueOnError = true
            } = options;

            logger.info('🌐 Starting comprehensive provider scan', {
                parallel,
                providers: providerPriority,
                continueOnError,
                component: 'ProviderScanner'
            });

            const results = new Map();
            const errors = [];

            if (parallel) {
                // Scan all providers in parallel
                const scanPromises = providerPriority.map(async (providerName) => {
                    try {
                        const result = await this.scanProvider(providerName, options);
                        return { providerName, result };
                    } catch (error) {
                        return { providerName, error: error.message };
                    }
                });

                const scanResults = await Promise.allSettled(scanPromises);

                for (const promiseResult of scanResults) {
                    if (promiseResult.status === 'fulfilled') {
                        const { providerName, result, error } = promiseResult.value;
                        if (result) {
                            results.set(providerName, result);
                        } else {
                            errors.push({ providerName, error });
                        }
                    } else {
                        errors.push({ providerName: 'unknown', error: promiseResult.reason.message });
                    }
                }

            } else {
                // Scan providers sequentially
                for (const providerName of providerPriority) {
                    try {
                        const result = await this.scanProvider(providerName, options);
                        results.set(providerName, result);
                        
                        // Brief delay between providers
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                    } catch (error) {
                        errors.push({ providerName, error: error.message });
                        
                        if (!continueOnError) {
                            throw new ProcessingError(`Sequential scan failed at provider ${providerName}: ${error.message}`);
                        }
                        
                        logger.warn(`⚠️ Continuing after error in provider: ${providerName}`, {
                            error: error.message,
                            component: 'ProviderScanner'
                        });
                    }
                }
            }

            // Generate comprehensive summary
            const summary = await this.generateComprehensiveSummary(results, errors);

            logger.info('✅ Comprehensive provider scan completed', {
                successfulProviders: results.size,
                failedProviders: errors.length,
                totalModels: summary.totalModels,
                component: 'ProviderScanner'
            });

            return {
                results: Object.fromEntries(results),
                errors,
                summary
            };

        } catch (error) {
            logger.error('❌ Comprehensive provider scan failed', {
                error: error.message,
                component: 'ProviderScanner'
            });
            throw new ProcessingError(`Comprehensive scan failed: ${error.message}`);
        }
    }

    /**
     * HuggingFace-specific scanner
     */
    async scanHuggingFace(scanContext) {
        const { provider, options } = scanContext;
        const models = [];

        logger.info('🤗 Executing HuggingFace scan', {
            batchSize: options.batchSize,
            component: 'ProviderScanner'
        });

        // Use the comprehensive hub scanner for large-scale discovery
        const hubScanResult = await provider.discoverModels({
            limit: options.maxModels || 10000,
            sort: 'downloads',
            direction: -1
        });

        scanContext.stats.totalFound = hubScanResult.length;
        scanContext.stats.totalProcessed = hubScanResult.length;
        scanContext.stats.batchesProcessed = Math.ceil(hubScanResult.length / options.batchSize);

        return hubScanResult;
    }

    /**
     * OpenAI-specific scanner
     */
    async scanOpenAI(scanContext) {
        const { provider, options } = scanContext;

        logger.info('🤖 Executing OpenAI scan', {
            component: 'ProviderScanner'
        });

        // Rate limiting for OpenAI
        await rateLimiter.acquirePermission('openai', {
            priority: 'high',
            timeout: 30000
        });

        const models = await provider.discoverModels();

        // Test each model for capabilities
        const enhancedModels = [];
        for (const model of models) {
            try {
                // Add small delay between model tests
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Test basic capabilities
                const testResult = await provider.testModel(model.id, 'basic');
                model.testResults = testResult;
                
                enhancedModels.push(model);
                
            } catch (error) {
                logger.warn('⚠️ Model test failed', {
                    modelId: model.id,
                    error: error.message,
                    component: 'ProviderScanner'
                });
                // Include model even if test fails
                model.testResults = { error: error.message };
                enhancedModels.push(model);
            }
        }

        scanContext.stats.totalFound = enhancedModels.length;
        scanContext.stats.totalProcessed = models.length;
        scanContext.stats.batchesProcessed = 1;

        return enhancedModels;
    }

    /**
     * Anthropic-specific scanner
     */
    async scanAnthropic(scanContext) {
        const { provider, options } = scanContext;

        logger.info('🏛️ Executing Anthropic scan', {
            component: 'ProviderScanner'
        });

        // Rate limiting for Anthropic
        await rateLimiter.acquirePermission('anthropic', {
            priority: 'high',
            timeout: 30000
        });

        const models = await provider.discoverModels();

        // Test each model for capabilities
        const enhancedModels = [];
        for (const model of models) {
            try {
                // Add delay between model tests (Anthropic has strict rate limits)
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const testResult = await provider.testModel(model.id, 'basic');
                model.testResults = testResult;
                
                enhancedModels.push(model);
                
            } catch (error) {
                logger.warn('⚠️ Model test failed', {
                    modelId: model.id,
                    error: error.message,
                    component: 'ProviderScanner'
                });
                model.testResults = { error: error.message };
                enhancedModels.push(model);
            }
        }

        scanContext.stats.totalFound = enhancedModels.length;
        scanContext.stats.totalProcessed = models.length;
        scanContext.stats.batchesProcessed = 1;

        return enhancedModels;
    }

    /**
     * Google-specific scanner
     */
    async scanGoogle(scanContext) {
        const { provider, options } = scanContext;

        logger.info('🔍 Executing Google AI scan', {
            component: 'ProviderScanner'
        });

        // Rate limiting for Google
        await rateLimiter.acquirePermission('google', {
            priority: 'high',
            timeout: 30000
        });

        const models = await provider.discoverModels();

        // Test each model for capabilities
        const enhancedModels = [];
        for (const model of models) {
            try {
                // Add delay between model tests
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const testResult = await provider.testModel(model.id, 'basic');
                model.testResults = testResult;
                
                enhancedModels.push(model);
                
            } catch (error) {
                logger.warn('⚠️ Model test failed', {
                    modelId: model.id,
                    error: error.message,
                    component: 'ProviderScanner'
                });
                model.testResults = { error: error.message };
                enhancedModels.push(model);
            }
        }

        scanContext.stats.totalFound = enhancedModels.length;
        scanContext.stats.totalProcessed = models.length;
        scanContext.stats.batchesProcessed = 1;

        return enhancedModels;
    }

    /**
     * Save scan results
     */
    async saveScanResults(providerName, scanContext, results) {
        try {
            const filename = `${providerName}_scan_${Date.now()}.json`;
            const filepath = path.join(this.resultsDir, filename);

            const saveData = {
                provider: providerName,
                scanContext: {
                    ...scanContext,
                    provider: undefined, // Remove circular reference
                    results: undefined   // Saved separately
                },
                results,
                metadata: {
                    scanId: `${providerName}_${scanContext.startTime}`,
                    version: '1.0.0',
                    savedAt: new Date().toISOString()
                }
            };

            await fs.writeFile(filepath, JSON.stringify(saveData, null, 2));

            logger.debug(`💾 Scan results saved: ${providerName}`, {
                filepath,
                resultCount: results.length,
                component: 'ProviderScanner'
            });

        } catch (error) {
            logger.warn('⚠️ Failed to save scan results', {
                provider: providerName,
                error: error.message,
                component: 'ProviderScanner'
            });
        }
    }

    /**
     * Generate provider-specific summary
     */
    async generateProviderSummary(providerName, scanContext) {
        const strategy = this.scanStrategies.get(providerName);
        
        return {
            provider: {
                name: providerName,
                strategy: strategy.name,
                type: strategy.type,
                expectedCount: strategy.expectedCount
            },
            scan: {
                duration: scanContext.duration,
                durationFormatted: this.formatDuration(scanContext.duration),
                status: scanContext.status
            },
            models: {
                found: scanContext.stats.totalFound,
                processed: scanContext.stats.totalProcessed,
                errors: scanContext.stats.totalErrors,
                batches: scanContext.stats.batchesProcessed
            },
            performance: {
                modelsPerSecond: (scanContext.stats.totalFound / (scanContext.duration / 1000)).toFixed(2),
                successRate: ((1 - scanContext.stats.totalErrors / scanContext.stats.totalProcessed) * 100).toFixed(1) + '%'
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Generate comprehensive summary
     */
    async generateComprehensiveSummary(results, errors) {
        let totalModels = 0;
        let totalDuration = 0;
        const providerStats = {};

        for (const [providerName, result] of results.entries()) {
            totalModels += result.stats.totalFound;
            totalDuration += result.duration;
            
            providerStats[providerName] = {
                models: result.stats.totalFound,
                duration: result.duration,
                success: true
            };
        }

        for (const error of errors) {
            providerStats[error.providerName] = {
                models: 0,
                duration: 0,
                success: false,
                error: error.error
            };
        }

        return {
            overall: {
                totalModels,
                totalDuration: this.formatDuration(totalDuration),
                successfulProviders: results.size,
                failedProviders: errors.length,
                overallSuccessRate: ((results.size / (results.size + errors.length)) * 100).toFixed(1) + '%'
            },
            providers: providerStats,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Format duration in human readable format
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Get scanner status
     */
    getStatus() {
        const activeScans = {};
        for (const [provider, context] of this.activeScanners.entries()) {
            activeScans[provider] = {
                startTime: context.startTime,
                stats: context.stats,
                progress: context.progress || null
            };
        }

        return {
            scanner: 'ProviderScanner',
            availableProviders: Array.from(this.providers.keys()),
            activeScanners: Object.keys(activeScans),
            completedScans: Array.from(this.scanResults.keys()),
            activeScans,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Stop all active scans
     */
    async stopAllScans() {
        const stopped = [];
        
        for (const [providerName, context] of this.activeScanners.entries()) {
            context.status = 'stopped';
            context.stoppedAt = Date.now();
            stopped.push(providerName);
        }

        this.activeScanners.clear();

        logger.info('🛑 All active scans stopped', {
            stoppedProviders: stopped,
            component: 'ProviderScanner'
        });

        return {
            stopped: true,
            providers: stopped
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            await this.stopAllScans();
            
            this.providers.clear();
            this.scanStrategies.clear();
            this.scanResults.clear();

            logger.info('🧹 Provider Scanner cleaned up', {
                component: 'ProviderScanner'
            });
        } catch (error) {
            logger.error('❌ Error during Provider Scanner cleanup', {
                error: error.message,
                component: 'ProviderScanner'
            });
        }
    }
}

// Export singleton instance
export const providerScanner = new ProviderScanner();
export { ProviderScanner, ProcessingError };