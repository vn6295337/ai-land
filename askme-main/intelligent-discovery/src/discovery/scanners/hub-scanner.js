/**
 * HuggingFace Hub Scanner for 400k+ Models
 * Module 4, Step 17: Build HuggingFace Hub scanner for 400k+ models
 * 
 * Features:
 * - Large-scale model discovery and enumeration
 * - Intelligent pagination and batching
 * - Memory-efficient streaming processing
 * - Progress tracking and resumable scans
 * - Advanced filtering and categorization
 */

import { logger } from '../../core/infrastructure/logger.js';
import { config } from '../../core/infrastructure/config.js';
import { cacheManager } from '../../core/storage/cache.js';
import { rateLimiter } from '../providers/ratelimiter.js';
import { huggingFaceProvider } from '../providers/huggingface.js';
import { ProcessingError } from '../../core/infrastructure/errors.js';
import fs from 'fs/promises';
import path from 'path';

class HuggingFaceHubScanner {
    constructor() {
        this.isInitialized = false;
        this.isScanning = false;
        this.scanProgress = null;
        this.resumeData = null;
        this.batchSize = 100;
        this.maxConcurrent = 5;
        this.delayBetweenBatches = 1000; // 1 second
        this.maxRetries = 3;
        this.progressFile = path.join('data', 'hub_scan_progress.json');
        this.resultsDir = path.join('data', 'hub_results');
        
        // Statistics
        this.stats = {
            totalProcessed: 0,
            totalFound: 0,
            totalFiltered: 0,
            totalErrors: 0,
            startTime: null,
            lastUpdate: null,
            estimatedRemaining: null,
            processingRate: 0
        };

        // Scanning filters
        this.defaultFilters = {
            minDownloads: 10,
            excludePrivate: true,
            excludeGated: true,
            maxModelSize: '50GB',
            supportedTasks: [
                'text-generation', 'text2text-generation', 'conversational',
                'question-answering', 'summarization', 'translation',
                'text-classification', 'image-classification', 'image-to-text',
                'text-to-image', 'automatic-speech-recognition', 'text-to-speech'
            ],
            supportedLibraries: ['transformers', 'diffusers', 'sentence-transformers', 'pytorch'],
            excludedTags: ['not-for-all-audiences', 'nsfw', 'adult-content']
        };
    }

    /**
     * Initialize the HuggingFace Hub scanner
     */
    async initialize() {
        try {
            logger.info('🚀 Initializing HuggingFace Hub Scanner...', {
                component: 'HuggingFaceHubScanner'
            });

            // Ensure data directories exist
            await fs.mkdir(this.resultsDir, { recursive: true });
            await fs.mkdir(path.dirname(this.progressFile), { recursive: true });

            // Initialize HuggingFace provider
            if (!huggingFaceProvider.isInitialized) {
                await huggingFaceProvider.initialize();
            }

            // Load previous scan progress if exists
            await this.loadScanProgress();

            this.isInitialized = true;

            logger.info('✅ HuggingFace Hub Scanner initialized', {
                hasResumeData: !!this.resumeData,
                component: 'HuggingFaceHubScanner'
            });

            return {
                scanner: 'HuggingFaceHubScanner',
                initialized: true,
                canResume: !!this.resumeData
            };
        } catch (error) {
            logger.error('❌ Failed to initialize HuggingFace Hub Scanner', {
                error: error.message,
                component: 'HuggingFaceHubScanner'
            });
            throw new ProcessingError(`Hub scanner initialization failed: ${error.message}`);
        }
    }

    /**
     * Start comprehensive hub scan
     */
    async startScan(options = {}) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            if (this.isScanning) {
                throw new ProcessingError('Hub scan already in progress');
            }

            const {
                filters = this.defaultFilters,
                resumeFromLast = true,
                maxModels = 400000,
                outputFormat = 'jsonl',
                enableStreaming = true,
                saveInterval = 1000 // Save progress every 1000 models
            } = options;

            logger.info('🔍 Starting comprehensive HuggingFace Hub scan', {
                maxModels,
                resumeFromLast,
                outputFormat,
                enableStreaming,
                component: 'HuggingFaceHubScanner'
            });

            this.isScanning = true;
            this.stats.startTime = Date.now();
            this.stats.lastUpdate = Date.now();

            // Initialize scan progress
            const scanId = `hub_scan_${Date.now()}`;
            this.scanProgress = {
                scanId,
                startTime: new Date().toISOString(),
                options: { filters, maxModels, outputFormat },
                currentOffset: resumeFromLast && this.resumeData ? this.resumeData.offset : 0,
                totalProcessed: resumeFromLast && this.resumeData ? this.resumeData.totalProcessed : 0,
                currentBatch: 0,
                status: 'running',
                lastSaveTime: Date.now()
            };

            // Create output stream if streaming enabled
            const outputFile = path.join(this.resultsDir, `${scanId}.${outputFormat}`);
            let outputStream = null;
            
            if (enableStreaming) {
                outputStream = await fs.open(outputFile, 'w');
            }

            try {
                // Execute the scan
                const results = await this.executeScan(filters, maxModels, {
                    outputStream,
                    saveInterval,
                    outputFormat
                });

                // Finalize scan
                this.scanProgress.status = 'completed';
                this.scanProgress.endTime = new Date().toISOString();
                this.scanProgress.totalDuration = Date.now() - this.stats.startTime;

                await this.saveScanProgress();

                if (outputStream) {
                    await outputStream.close();
                }

                logger.info('✅ HuggingFace Hub scan completed', {
                    scanId,
                    totalProcessed: this.stats.totalProcessed,
                    totalFound: this.stats.totalFound,
                    duration: this.scanProgress.totalDuration,
                    outputFile: enableStreaming ? outputFile : null,
                    component: 'HuggingFaceHubScanner'
                });

                return {
                    scanId,
                    results,
                    stats: this.stats,
                    outputFile: enableStreaming ? outputFile : null,
                    summary: await this.generateScanSummary()
                };

            } finally {
                if (outputStream) {
                    await outputStream.close();
                }
                this.isScanning = false;
            }

        } catch (error) {
            this.isScanning = false;
            this.scanProgress.status = 'failed';
            this.scanProgress.error = error.message;
            await this.saveScanProgress();

            logger.error('❌ HuggingFace Hub scan failed', {
                error: error.message,
                processed: this.stats.totalProcessed,
                component: 'HuggingFaceHubScanner'
            });
            throw new ProcessingError(`Hub scan failed: ${error.message}`);
        }
    }

    /**
     * Execute the main scanning logic
     */
    async executeScan(filters, maxModels, options) {
        const { outputStream, saveInterval, outputFormat } = options;
        const allModels = [];
        let offset = this.scanProgress.currentOffset;
        let processedInBatch = 0;

        logger.info('🔄 Starting hub scan execution', {
            startOffset: offset,
            maxModels,
            batchSize: this.batchSize,
            component: 'HuggingFaceHubScanner'
        });

        while (this.stats.totalProcessed < maxModels && this.isScanning) {
            try {
                // Rate limiting
                await rateLimiter.acquirePermission('huggingface', {
                    priority: 'normal',
                    timeout: 30000
                });

                // Fetch batch of models
                logger.debug(`📦 Fetching batch: offset ${offset}`, {
                    batchNumber: this.scanProgress.currentBatch + 1,
                    component: 'HuggingFaceHubScanner'
                });

                const batchModels = await this.fetchModelBatch(offset, filters);
                
                if (batchModels.length === 0) {
                    logger.info('📭 No more models to fetch, scan complete', {
                        totalProcessed: this.stats.totalProcessed,
                        component: 'HuggingFaceHubScanner'
                    });
                    break;
                }

                // Process and filter models
                const processedBatch = await this.processBatch(batchModels, filters);
                
                // Add to results
                if (outputStream) {
                    // Stream results to file
                    await this.writeModelsToStream(processedBatch, outputStream, outputFormat);
                } else {
                    // Keep in memory
                    allModels.push(...processedBatch);
                }

                // Update statistics
                this.stats.totalProcessed += batchModels.length;
                this.stats.totalFound += processedBatch.length;
                this.stats.totalFiltered += (batchModels.length - processedBatch.length);
                this.updateProcessingRate();

                // Update progress
                this.scanProgress.currentOffset = offset + batchModels.length;
                this.scanProgress.totalProcessed = this.stats.totalProcessed;
                this.scanProgress.currentBatch++;

                processedInBatch += batchModels.length;
                offset += this.batchSize;

                // Save progress periodically
                if (processedInBatch >= saveInterval) {
                    await this.saveScanProgress();
                    processedInBatch = 0;
                    
                    logger.info('💾 Progress saved', {
                        processed: this.stats.totalProcessed,
                        found: this.stats.totalFound,
                        rate: `${this.stats.processingRate.toFixed(1)} models/sec`,
                        component: 'HuggingFaceHubScanner'
                    });
                }

                // Brief delay between batches to be respectful
                await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));

            } catch (error) {
                this.stats.totalErrors++;
                
                logger.warn('⚠️ Batch processing error', {
                    error: error.message,
                    offset,
                    batch: this.scanProgress.currentBatch,
                    component: 'HuggingFaceHubScanner'
                });

                // Exponential backoff on errors
                const backoffTime = Math.min(this.delayBetweenBatches * Math.pow(2, this.stats.totalErrors), 30000);
                await new Promise(resolve => setTimeout(resolve, backoffTime));

                // Skip this batch and continue
                offset += this.batchSize;
                
                if (this.stats.totalErrors > this.maxRetries * 10) {
                    throw new ProcessingError(`Too many errors (${this.stats.totalErrors}), aborting scan`);
                }
            }
        }

        // Final progress save
        await this.saveScanProgress();

        return allModels;
    }

    /**
     * Fetch a batch of models from HuggingFace Hub
     */
    async fetchModelBatch(offset, filters) {
        try {
            // Build API request parameters
            const params = new URLSearchParams();
            params.append('limit', this.batchSize.toString());
            params.append('sort', 'downloads');
            params.append('direction', '-1');
            
            if (offset > 0) {
                // HuggingFace uses cursor-based pagination, simulate with search
                params.append('search', ''); // Empty search to get all models
            }

            // Add filters if specified
            if (filters.supportedTasks && filters.supportedTasks.length > 0) {
                // Try each task type (HF API doesn't support multiple pipeline_tag filters)
                const taskIndex = this.scanProgress.currentBatch % filters.supportedTasks.length;
                params.append('pipeline_tag', filters.supportedTasks[taskIndex]);
            }

            if (filters.supportedLibraries && filters.supportedLibraries.length > 0) {
                const libraryIndex = this.scanProgress.currentBatch % filters.supportedLibraries.length;
                params.append('library', filters.supportedLibraries[libraryIndex]);
            }

            // Fetch from HuggingFace API
            const response = await fetch(`https://huggingface.co/api/models?${params}`, {
                headers: {
                    'Accept': 'application/json',
                    ...(huggingFaceProvider.apiKey && {
                        'Authorization': `Bearer ${huggingFaceProvider.apiKey}`
                    })
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const models = await response.json();
            
            logger.debug(`📥 Fetched ${models.length} models from HF API`, {
                offset,
                component: 'HuggingFaceHubScanner'
            });

            return models || [];

        } catch (error) {
            logger.error('❌ Failed to fetch model batch', {
                error: error.message,
                offset,
                component: 'HuggingFaceHubScanner'
            });
            throw new ProcessingError(`Batch fetch failed: ${error.message}`);
        }
    }

    /**
     * Process and filter a batch of models
     */
    async processBatch(rawModels, filters) {
        const processedModels = [];

        for (const rawModel of rawModels) {
            try {
                // Apply filters
                if (!this.shouldIncludeModel(rawModel, filters)) {
                    continue;
                }

                // Process and normalize model data
                const processedModel = await huggingFaceProvider.processModel(rawModel);
                
                if (processedModel) {
                    // Add scan metadata
                    processedModel.scanMetadata = {
                        scannedAt: new Date().toISOString(),
                        scanId: this.scanProgress.scanId,
                        batchNumber: this.scanProgress.currentBatch,
                        source: 'hub_scanner'
                    };

                    processedModels.push(processedModel);
                }

            } catch (error) {
                logger.warn('⚠️ Failed to process model', {
                    modelId: rawModel.id || 'unknown',
                    error: error.message,
                    component: 'HuggingFaceHubScanner'
                });
            }
        }

        return processedModels;
    }

    /**
     * Apply filtering logic to determine if model should be included
     */
    shouldIncludeModel(model, filters) {
        // Download threshold
        if (filters.minDownloads && (model.downloads || 0) < filters.minDownloads) {
            return false;
        }

        // Private models
        if (filters.excludePrivate && model.private) {
            return false;
        }

        // Gated models
        if (filters.excludeGated && model.gated) {
            return false;
        }

        // Excluded tags
        if (filters.excludedTags && model.tags) {
            const hasExcludedTag = filters.excludedTags.some(excludedTag => 
                model.tags.some(tag => tag.toLowerCase().includes(excludedTag.toLowerCase()))
            );
            if (hasExcludedTag) {
                return false;
            }
        }

        // Task filter (if model has pipeline_tag)
        if (filters.supportedTasks && model.pipeline_tag) {
            if (!filters.supportedTasks.includes(model.pipeline_tag)) {
                return false;
            }
        }

        // Library filter
        if (filters.supportedLibraries && model.library_name) {
            if (!filters.supportedLibraries.includes(model.library_name)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Write models to output stream
     */
    async writeModelsToStream(models, outputStream, format) {
        try {
            for (const model of models) {
                let line;
                
                if (format === 'jsonl') {
                    line = JSON.stringify(model) + '\n';
                } else if (format === 'json') {
                    line = JSON.stringify(model, null, 2) + ',\n';
                } else {
                    throw new Error(`Unsupported output format: ${format}`);
                }

                await outputStream.write(line, 'utf8');
            }

            // Flush to ensure data is written
            await outputStream.sync();

        } catch (error) {
            logger.error('❌ Failed to write models to stream', {
                error: error.message,
                modelCount: models.length,
                component: 'HuggingFaceHubScanner'
            });
            throw error;
        }
    }

    /**
     * Update processing rate statistics
     */
    updateProcessingRate() {
        const now = Date.now();
        const timeDiff = (now - this.stats.lastUpdate) / 1000; // seconds
        
        if (timeDiff > 0) {
            this.stats.processingRate = this.stats.totalProcessed / ((now - this.stats.startTime) / 1000);
            
            // Estimate remaining time
            if (this.stats.processingRate > 0) {
                const remainingModels = 400000 - this.stats.totalProcessed; // Estimate total HF models
                this.stats.estimatedRemaining = remainingModels / this.stats.processingRate;
            }
        }

        this.stats.lastUpdate = now;
    }

    /**
     * Save scan progress to file
     */
    async saveScanProgress() {
        try {
            const progressData = {
                ...this.scanProgress,
                stats: this.stats,
                resumeData: {
                    offset: this.scanProgress.currentOffset,
                    totalProcessed: this.scanProgress.totalProcessed,
                    scanId: this.scanProgress.scanId
                },
                savedAt: new Date().toISOString()
            };

            await fs.writeFile(this.progressFile, JSON.stringify(progressData, null, 2));
            this.scanProgress.lastSaveTime = Date.now();

        } catch (error) {
            logger.warn('⚠️ Failed to save scan progress', {
                error: error.message,
                component: 'HuggingFaceHubScanner'
            });
        }
    }

    /**
     * Load previous scan progress
     */
    async loadScanProgress() {
        try {
            const progressData = await fs.readFile(this.progressFile, 'utf8');
            const parsed = JSON.parse(progressData);
            
            if (parsed.resumeData && parsed.status !== 'completed') {
                this.resumeData = parsed.resumeData;
                this.scanProgress = parsed;
                
                logger.info('📂 Loaded previous scan progress', {
                    scanId: this.resumeData.scanId,
                    offset: this.resumeData.offset,
                    totalProcessed: this.resumeData.totalProcessed,
                    component: 'HuggingFaceHubScanner'
                });
            }

        } catch (error) {
            // Progress file doesn't exist or is corrupted, start fresh
            logger.debug('No previous scan progress found', {
                component: 'HuggingFaceHubScanner'
            });
        }
    }

    /**
     * Generate scan summary
     */
    async generateScanSummary() {
        const totalDuration = Date.now() - this.stats.startTime;
        
        return {
            scan: {
                id: this.scanProgress?.scanId,
                status: this.scanProgress?.status,
                duration: totalDuration,
                durationFormatted: this.formatDuration(totalDuration)
            },
            models: {
                totalProcessed: this.stats.totalProcessed,
                totalFound: this.stats.totalFound,
                totalFiltered: this.stats.totalFiltered,
                filterRate: ((this.stats.totalFiltered / this.stats.totalProcessed) * 100).toFixed(1) + '%'
            },
            performance: {
                processingRate: this.stats.processingRate.toFixed(1) + ' models/sec',
                totalErrors: this.stats.totalErrors,
                errorRate: ((this.stats.totalErrors / this.stats.totalProcessed) * 100).toFixed(2) + '%'
            },
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
     * Get current scan status
     */
    getStatus() {
        return {
            scanner: 'HuggingFaceHubScanner',
            isInitialized: this.isInitialized,
            isScanning: this.isScanning,
            canResume: !!this.resumeData,
            currentProgress: this.scanProgress,
            stats: this.stats,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Stop current scan
     */
    async stopScan() {
        if (this.isScanning) {
            logger.info('🛑 Stopping HuggingFace Hub scan', {
                processed: this.stats.totalProcessed,
                component: 'HuggingFaceHubScanner'
            });

            this.isScanning = false;
            
            if (this.scanProgress) {
                this.scanProgress.status = 'stopped';
                this.scanProgress.stoppedAt = new Date().toISOString();
                await this.saveScanProgress();
            }

            return {
                stopped: true,
                finalStats: this.stats,
                canResume: true
            };
        }

        return { stopped: false, reason: 'No scan in progress' };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            if (this.isScanning) {
                await this.stopScan();
            }

            this.resumeData = null;
            this.scanProgress = null;
            this.isInitialized = false;

            logger.info('🧹 HuggingFace Hub Scanner cleaned up', {
                component: 'HuggingFaceHubScanner'
            });
        } catch (error) {
            logger.error('❌ Error during Hub Scanner cleanup', {
                error: error.message,
                component: 'HuggingFaceHubScanner'
            });
        }
    }
}

// Export singleton instance
export const huggingFaceHubScanner = new HuggingFaceHubScanner();
export { HuggingFaceHubScanner, ProcessingError };