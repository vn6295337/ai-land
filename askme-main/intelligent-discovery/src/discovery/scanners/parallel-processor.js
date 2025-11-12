/**
 * Parallel Processing for Large-Scale Scanning
 * Module 4, Step 22: Add parallel processing for large-scale scanning
 * 
 * Features:
 * - Worker thread-based parallel processing
 * - Dynamic work distribution and load balancing
 * - Memory-efficient streaming processing
 * - Fault tolerance and error recovery
 * - Resource monitoring and throttling
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { cpus } from 'os';
import { logger } from '../../core/infrastructure/logger.js';
import { config } from '../../core/infrastructure/config.js';
import { rateLimiter } from '../providers/ratelimiter.js';
import { ProcessingError } from '../../core/infrastructure/errors.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ParallelProcessor {
    constructor() {
        this.maxWorkers = Math.min(cpus().length, 8); // Limit to 8 workers max
        this.activeWorkers = new Map();
        this.workQueue = [];
        this.completedJobs = [];
        this.failedJobs = [];
        this.isProcessing = false;
        this.resourceMonitor = null;
        this.processingStats = {
            totalJobs: 0,
            completedJobs: 0,
            failedJobs: 0,
            activeWorkers: 0,
            avgProcessingTime: 0,
            throughput: 0
        };
        
        this.setupResourceMonitoring();
    }

    /**
     * Initialize the parallel processor
     */
    async initialize() {
        try {
            logger.info('🚀 Initializing Parallel Processor...', {
                maxWorkers: this.maxWorkers,
                cpuCount: cpus().length,
                component: 'ParallelProcessor'
            });

            // Test worker creation
            await this.testWorkerCreation();

            logger.info('✅ Parallel Processor initialized', {
                maxWorkers: this.maxWorkers,
                component: 'ParallelProcessor'
            });

            return {
                processor: 'ParallelProcessor',
                initialized: true,
                maxWorkers: this.maxWorkers,
                availableCPUs: cpus().length
            };
        } catch (error) {
            logger.error('❌ Failed to initialize Parallel Processor', {
                error: error.message,
                component: 'ParallelProcessor'
            });
            throw new ProcessingError(`Parallel processor initialization failed: ${error.message}`);
        }
    }

    /**
     * Process models in parallel batches
     */
    async processModelsParallel(models, processingFunction, options = {}) {
        try {
            const {
                batchSize = 100,
                maxConcurrency = this.maxWorkers,
                enableRetry = true,
                maxRetries = 3,
                retryDelay = 1000,
                onProgress = null,
                memoryLimit = 512 * 1024 * 1024, // 512MB per worker
                timeoutPerBatch = 300000 // 5 minutes
            } = options;

            if (this.isProcessing) {
                throw new ProcessingError('Parallel processing already in progress');
            }

            logger.info('🔄 Starting parallel model processing', {
                totalModels: models.length,
                batchSize,
                maxConcurrency,
                estimatedBatches: Math.ceil(models.length / batchSize),
                component: 'ParallelProcessor'
            });

            this.isProcessing = true;
            const startTime = Date.now();
            
            try {
                // Create batches
                const batches = this.createBatches(models, batchSize);
                
                // Initialize processing stats
                this.processingStats = {
                    totalJobs: batches.length,
                    completedJobs: 0,
                    failedJobs: 0,
                    activeWorkers: 0,
                    avgProcessingTime: 0,
                    throughput: 0,
                    startTime
                };

                // Create work items
                const workItems = batches.map((batch, index) => ({
                    id: `batch_${index}`,
                    batch,
                    batchIndex: index,
                    processingFunction: processingFunction.toString(),
                    options: {
                        enableRetry,
                        maxRetries,
                        retryDelay,
                        memoryLimit,
                        timeoutPerBatch
                    }
                }));

                // Process batches in parallel
                const results = await this.executeParallelWork(
                    workItems,
                    maxConcurrency,
                    onProgress
                );

                // Aggregate results
                const aggregatedResults = this.aggregateResults(results);
                
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                // Update final stats
                this.processingStats.avgProcessingTime = duration / batches.length;
                this.processingStats.throughput = models.length / (duration / 1000);

                logger.info('✅ Parallel model processing completed', {
                    totalModels: models.length,
                    processedModels: aggregatedResults.processedModels.length,
                    failedModels: aggregatedResults.failedModels.length,
                    duration: `${duration}ms`,
                    throughput: `${this.processingStats.throughput.toFixed(2)} models/sec`,
                    component: 'ParallelProcessor'
                });

                return {
                    processedModels: aggregatedResults.processedModels,
                    failedModels: aggregatedResults.failedModels,
                    stats: {
                        ...this.processingStats,
                        duration,
                        successRate: ((aggregatedResults.processedModels.length / models.length) * 100).toFixed(2) + '%'
                    },
                    metadata: {
                        totalBatches: batches.length,
                        batchSize,
                        maxConcurrency,
                        timestamp: new Date().toISOString()
                    }
                };

            } finally {
                this.isProcessing = false;
                await this.cleanupWorkers();
            }

        } catch (error) {
            this.isProcessing = false;
            logger.error('❌ Parallel model processing failed', {
                error: error.message,
                totalModels: models.length,
                component: 'ParallelProcessor'
            });
            throw new ProcessingError(`Parallel processing failed: ${error.message}`);
        }
    }

    /**
     * Process large-scale provider scans in parallel
     */
    async processProviderScansParallel(providers, scanOptions = {}) {
        try {
            const {
                enableLoadBalancing = true,
                priorityOrder = ['openai', 'anthropic', 'google', 'huggingface'],
                resourceThrottling = true,
                maxMemoryUsage = 1024 * 1024 * 1024 // 1GB total
            } = scanOptions;

            logger.info('🌐 Starting parallel provider scanning', {
                providers: providers.length,
                enableLoadBalancing,
                resourceThrottling,
                component: 'ParallelProcessor'
            });

            const startTime = Date.now();

            // Create work items for each provider
            const workItems = providers.map(provider => ({
                id: `scan_${provider.name}`,
                type: 'provider_scan',
                provider,
                priority: priorityOrder.indexOf(provider.name) + 1,
                estimatedDuration: this.estimateProviderScanDuration(provider.name),
                memoryRequirement: this.estimateProviderMemoryUsage(provider.name)
            }));

            // Sort by priority and estimated resource usage
            if (enableLoadBalancing) {
                workItems.sort((a, b) => {
                    if (a.priority !== b.priority) {
                        return a.priority - b.priority;
                    }
                    return a.estimatedDuration - b.estimatedDuration;
                });
            }

            // Execute scans with resource monitoring
            const results = await this.executeProviderScans(
                workItems,
                { resourceThrottling, maxMemoryUsage }
            );

            const duration = Date.now() - startTime;

            logger.info('✅ Parallel provider scanning completed', {
                providersScanned: results.successful.length,
                providersFailed: results.failed.length,
                duration: `${duration}ms`,
                component: 'ParallelProcessor'
            });

            return {
                successful: results.successful,
                failed: results.failed,
                stats: {
                    totalProviders: providers.length,
                    successfulScans: results.successful.length,
                    failedScans: results.failed.length,
                    totalDuration: duration,
                    averageScanTime: results.successful.length > 0 ? 
                        (results.successful.reduce((sum, r) => sum + r.duration, 0) / results.successful.length) : 0
                },
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            logger.error('❌ Parallel provider scanning failed', {
                error: error.message,
                providers: providers.length,
                component: 'ParallelProcessor'
            });
            throw new ProcessingError(`Parallel provider scanning failed: ${error.message}`);
        }
    }

    /**
     * Execute parallel work with dynamic worker management
     */
    async executeParallelWork(workItems, maxConcurrency, onProgress) {
        return new Promise((resolve, reject) => {
            const results = [];
            const errors = [];
            let activeJobs = 0;
            let completedJobs = 0;
            let workIndex = 0;

            const processNextWork = async () => {
                if (workIndex >= workItems.length && activeJobs === 0) {
                    // All work completed
                    resolve({ results, errors });
                    return;
                }

                if (workIndex >= workItems.length || activeJobs >= maxConcurrency) {
                    // No more work or max concurrency reached
                    return;
                }

                const workItem = workItems[workIndex++];
                activeJobs++;
                this.processingStats.activeWorkers = activeJobs;

                try {
                    // Create and execute worker
                    const result = await this.executeWorkItem(workItem);
                    
                    results.push(result);
                    completedJobs++;
                    this.processingStats.completedJobs = completedJobs;

                    // Report progress
                    if (onProgress) {
                        onProgress({
                            completed: completedJobs,
                            total: workItems.length,
                            progress: (completedJobs / workItems.length * 100).toFixed(1) + '%',
                            currentJob: workItem.id
                        });
                    }

                } catch (error) {
                    errors.push({
                        workItem: workItem.id,
                        error: error.message
                    });
                    this.processingStats.failedJobs++;
                    
                    logger.warn('⚠️ Work item failed', {
                        workId: workItem.id,
                        error: error.message,
                        component: 'ParallelProcessor'
                    });
                }

                activeJobs--;
                this.processingStats.activeWorkers = activeJobs;

                // Process next work items
                setImmediate(() => {
                    processNextWork();
                    processNextWork(); // Start another if capacity allows
                });
            };

            // Start initial workers
            const initialWorkers = Math.min(maxConcurrency, workItems.length);
            for (let i = 0; i < initialWorkers; i++) {
                processNextWork();
            }
        });
    }

    /**
     * Execute individual work item in worker thread
     */
    async executeWorkItem(workItem) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(__filename, {
                workerData: {
                    isWorker: true,
                    workItem
                }
            });

            const timeout = setTimeout(() => {
                worker.terminate();
                reject(new Error(`Worker timeout for ${workItem.id}`));
            }, workItem.options?.timeoutPerBatch || 300000);

            worker.on('message', (result) => {
                clearTimeout(timeout);
                resolve(result);
            });

            worker.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });

            worker.on('exit', (code) => {
                clearTimeout(timeout);
                if (code !== 0) {
                    reject(new Error(`Worker exited with code ${code}`));
                }
            });

            // Track active worker
            this.activeWorkers.set(workItem.id, worker);
        });
    }

    /**
     * Execute provider scans with resource management
     */
    async executeProviderScans(workItems, options) {
        const successful = [];
        const failed = [];

        for (const workItem of workItems) {
            try {
                // Check resource constraints
                if (options.resourceThrottling) {
                    await this.waitForResources(workItem.memoryRequirement, options.maxMemoryUsage);
                }

                // Execute provider scan
                const scanResult = await this.executeProviderScan(workItem);
                successful.push(scanResult);

                logger.debug('✅ Provider scan completed', {
                    provider: workItem.provider.name,
                    duration: scanResult.duration,
                    component: 'ParallelProcessor'
                });

            } catch (error) {
                failed.push({
                    provider: workItem.provider.name,
                    error: error.message,
                    workItem: workItem.id
                });

                logger.warn('⚠️ Provider scan failed', {
                    provider: workItem.provider.name,
                    error: error.message,
                    component: 'ParallelProcessor'
                });
            }

            // Brief delay between provider scans
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return { successful, failed };
    }

    /**
     * Create processing batches from models array
     */
    createBatches(models, batchSize) {
        const batches = [];
        for (let i = 0; i < models.length; i += batchSize) {
            batches.push(models.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * Aggregate results from parallel processing
     */
    aggregateResults(results) {
        const processedModels = [];
        const failedModels = [];

        for (const result of results.results) {
            if (result.success) {
                processedModels.push(...(result.processedModels || []));
            } else {
                failedModels.push(...(result.failedModels || []));
            }
        }

        return {
            processedModels,
            failedModels,
            errors: results.errors
        };
    }

    /**
     * Setup resource monitoring
     */
    setupResourceMonitoring() {
        this.resourceMonitor = {
            memoryUsage: 0,
            cpuUsage: 0,
            activeWorkers: 0,
            lastUpdate: Date.now()
        };

        // Update resource stats periodically
        setInterval(() => {
            this.updateResourceStats();
        }, 5000); // Every 5 seconds
    }

    /**
     * Update resource statistics
     */
    updateResourceStats() {
        const memUsage = process.memoryUsage();
        this.resourceMonitor.memoryUsage = memUsage.heapUsed;
        this.resourceMonitor.activeWorkers = this.activeWorkers.size;
        this.resourceMonitor.lastUpdate = Date.now();
    }

    /**
     * Wait for sufficient resources
     */
    async waitForResources(requiredMemory, maxMemoryUsage) {
        while (this.resourceMonitor.memoryUsage + requiredMemory > maxMemoryUsage) {
            logger.debug('⏳ Waiting for memory resources', {
                currentUsage: this.resourceMonitor.memoryUsage,
                required: requiredMemory,
                maxUsage: maxMemoryUsage,
                component: 'ParallelProcessor'
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.updateResourceStats();
        }
    }

    /**
     * Estimate provider scan duration
     */
    estimateProviderScanDuration(providerName) {
        const estimates = {
            'huggingface': 600000,  // 10 minutes
            'openai': 60000,        // 1 minute
            'anthropic': 120000,    // 2 minutes
            'google': 90000         // 1.5 minutes
        };
        return estimates[providerName] || 300000; // 5 minutes default
    }

    /**
     * Estimate provider memory usage
     */
    estimateProviderMemoryUsage(providerName) {
        const estimates = {
            'huggingface': 256 * 1024 * 1024,  // 256MB
            'openai': 64 * 1024 * 1024,        // 64MB
            'anthropic': 64 * 1024 * 1024,     // 64MB
            'google': 128 * 1024 * 1024        // 128MB
        };
        return estimates[providerName] || 128 * 1024 * 1024; // 128MB default
    }

    /**
     * Execute provider scan (placeholder)
     */
    async executeProviderScan(workItem) {
        const startTime = Date.now();
        
        // Apply rate limiting
        await rateLimiter.acquirePermission(workItem.provider.name, {
            priority: 'normal',
            timeout: 30000
        });

        // Simulate scan execution
        await new Promise(resolve => setTimeout(resolve, 100));

        return {
            provider: workItem.provider.name,
            workId: workItem.id,
            success: true,
            duration: Date.now() - startTime,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Test worker creation capability
     */
    async testWorkerCreation() {
        return new Promise((resolve, reject) => {
            const testWorker = new Worker(__filename, {
                workerData: {
                    isWorker: true,
                    workItem: {
                        id: 'test',
                        type: 'test',
                        batch: []
                    }
                }
            });

            const timeout = setTimeout(() => {
                testWorker.terminate();
                reject(new Error('Worker test timeout'));
            }, 5000);

            testWorker.on('message', () => {
                clearTimeout(timeout);
                testWorker.terminate();
                resolve();
            });

            testWorker.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    /**
     * Cleanup all active workers
     */
    async cleanupWorkers() {
        const cleanupPromises = Array.from(this.activeWorkers.values()).map(worker => {
            return new Promise((resolve) => {
                worker.terminate().then(resolve).catch(resolve);
            });
        });

        await Promise.all(cleanupPromises);
        this.activeWorkers.clear();

        logger.debug('🧹 Workers cleaned up', {
            component: 'ParallelProcessor'
        });
    }

    /**
     * Get processor status
     */
    getStatus() {
        return {
            processor: 'ParallelProcessor',
            isProcessing: this.isProcessing,
            maxWorkers: this.maxWorkers,
            activeWorkers: this.activeWorkers.size,
            stats: this.processingStats,
            resourceMonitor: this.resourceMonitor,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            await this.cleanupWorkers();
            this.workQueue = [];
            this.completedJobs = [];
            this.failedJobs = [];
            this.isProcessing = false;

            logger.info('🧹 Parallel Processor cleaned up', {
                component: 'ParallelProcessor'
            });
        } catch (error) {
            logger.error('❌ Error during Parallel Processor cleanup', {
                error: error.message,
                component: 'ParallelProcessor'
            });
        }
    }
}

// Worker thread code
if (!isMainThread && workerData?.isWorker) {
    (async () => {
        try {
            const { workItem } = workerData;
            
            if (workItem.type === 'test') {
                // Test worker
                parentPort.postMessage({ success: true, test: true });
                return;
            }

            // Process the batch
            const result = await processWorkItemInWorker(workItem);
            parentPort.postMessage(result);
            
        } catch (error) {
            parentPort.postMessage({
                success: false,
                error: error.message,
                workId: workerData.workItem?.id
            });
        }
    })();
}

/**
 * Process work item in worker thread
 */
async function processWorkItemInWorker(workItem) {
    try {
        const { batch, processingFunction, options } = workItem;
        
        // Recreate processing function from string
        const processFunc = eval(`(${processingFunction})`);
        
        const processedModels = [];
        const failedModels = [];

        for (const model of batch) {
            try {
                const processed = await processFunc(model);
                processedModels.push(processed);
            } catch (error) {
                failedModels.push({
                    model: model.id || 'unknown',
                    error: error.message
                });
            }
        }

        return {
            success: true,
            workId: workItem.id,
            batchIndex: workItem.batchIndex,
            processedModels,
            failedModels,
            stats: {
                processed: processedModels.length,
                failed: failedModels.length,
                total: batch.length
            }
        };

    } catch (error) {
        return {
            success: false,
            workId: workItem.id,
            error: error.message
        };
    }
}

// Export singleton instance
export const parallelProcessor = new ParallelProcessor();
export { ParallelProcessor, ProcessingError };