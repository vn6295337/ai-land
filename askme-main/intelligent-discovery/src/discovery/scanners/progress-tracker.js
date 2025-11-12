/**
 * Progress Tracking and Resumable Scans
 * Module 4, Step 23: Implement progress tracking and resumable scans
 * 
 * Features:
 * - Real-time progress tracking with detailed metrics
 * - Persistent scan state for resumability
 * - Checkpoint creation and recovery
 * - Progress reporting and visualization
 * - Scan interruption and graceful shutdown
 */

import { logger } from '../../core/infrastructure/logger.js';
import { config } from '../../core/infrastructure/config.js';
import { cacheManager } from '../../core/storage/cache.js';
import { ProcessingError } from '../../core/infrastructure/errors.js';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

class ProgressTracker extends EventEmitter {
    constructor() {
        super();
        this.activeSessions = new Map();
        this.checkpoints = new Map();
        this.progressDir = path.join('data', 'progress');
        this.checkpointDir = path.join('data', 'checkpoints');
        this.sessionLogDir = path.join('data', 'session_logs');
        
        // Progress tracking intervals
        this.trackingInterval = 5000; // 5 seconds
        this.checkpointInterval = 30000; // 30 seconds
        this.autoSaveInterval = 10000; // 10 seconds
        
        this.timers = new Map();
        this.isShuttingDown = false;
    }

    /**
     * Initialize the progress tracker
     */
    async initialize() {
        try {
            logger.info('📊 Initializing Progress Tracker...', {
                component: 'ProgressTracker'
            });

            // Ensure directories exist
            await fs.mkdir(this.progressDir, { recursive: true });
            await fs.mkdir(this.checkpointDir, { recursive: true });
            await fs.mkdir(this.sessionLogDir, { recursive: true });

            // Load previous sessions
            await this.loadPreviousSessions();

            // Setup graceful shutdown
            this.setupGracefulShutdown();

            logger.info('✅ Progress Tracker initialized', {
                previousSessions: this.activeSessions.size,
                component: 'ProgressTracker'
            });

            return {
                tracker: 'ProgressTracker',
                initialized: true,
                trackingInterval: this.trackingInterval,
                checkpointInterval: this.checkpointInterval
            };
        } catch (error) {
            logger.error('❌ Failed to initialize Progress Tracker', {
                error: error.message,
                component: 'ProgressTracker'
            });
            throw new ProcessingError(`Progress tracker initialization failed: ${error.message}`);
        }
    }

    /**
     * Start tracking a new scan session
     */
    async startTracking(sessionId, scanConfig) {
        try {
            if (this.activeSessions.has(sessionId)) {
                throw new ProcessingError(`Session already being tracked: ${sessionId}`);
            }

            logger.info('🎯 Starting progress tracking', {
                sessionId,
                scanType: scanConfig.type,
                component: 'ProgressTracker'
            });

            const session = {
                sessionId,
                scanConfig,
                startTime: Date.now(),
                lastUpdate: Date.now(),
                status: 'running',
                
                // Progress metrics
                progress: {
                    totalItems: scanConfig.totalItems || 0,
                    processedItems: 0,
                    skippedItems: 0,
                    failedItems: 0,
                    currentItem: null,
                    percentage: 0,
                    
                    // Throughput metrics
                    itemsPerSecond: 0,
                    averageItemTime: 0,
                    estimatedTimeRemaining: 0,
                    
                    // Phase tracking
                    currentPhase: scanConfig.phases?.[0] || 'scanning',
                    completedPhases: [],
                    totalPhases: scanConfig.phases?.length || 1
                },
                
                // Resource usage
                resources: {
                    memoryUsage: 0,
                    cpuUsage: 0,
                    networkRequests: 0,
                    cacheHits: 0,
                    cacheMisses: 0
                },
                
                // Error tracking
                errors: [],
                warnings: [],
                
                // Checkpoint data
                checkpoints: [],
                lastCheckpoint: null,
                
                // Resume data
                resumeData: scanConfig.resumeData || null,
                canResume: true,
                
                // Metadata
                metadata: {
                    version: '1.0.0',
                    createdBy: 'ProgressTracker',
                    environment: config.get('NODE_ENV')
                }
            };

            this.activeSessions.set(sessionId, session);

            // Start tracking timers
            this.startTrackingTimers(sessionId);

            // Create initial checkpoint
            await this.createCheckpoint(sessionId, 'session_start');

            // Emit start event
            this.emit('sessionStarted', { sessionId, session });

            logger.info('✅ Progress tracking started', {
                sessionId,
                totalItems: session.progress.totalItems,
                component: 'ProgressTracker'
            });

            return session;

        } catch (error) {
            logger.error('❌ Failed to start progress tracking', {
                sessionId,
                error: error.message,
                component: 'ProgressTracker'
            });
            throw new ProcessingError(`Failed to start tracking: ${error.message}`);
        }
    }

    /**
     * Update progress for a session
     */
    async updateProgress(sessionId, updates) {
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                throw new ProcessingError(`Session not found: ${sessionId}`);
            }

            const previousProcessed = session.progress.processedItems;
            const now = Date.now();

            // Update progress metrics
            if (updates.processedItems !== undefined) {
                session.progress.processedItems = updates.processedItems;
            }
            if (updates.skippedItems !== undefined) {
                session.progress.skippedItems = updates.skippedItems;
            }
            if (updates.failedItems !== undefined) {
                session.progress.failedItems = updates.failedItems;
            }
            if (updates.totalItems !== undefined) {
                session.progress.totalItems = updates.totalItems;
            }
            if (updates.currentItem !== undefined) {
                session.progress.currentItem = updates.currentItem;
            }

            // Calculate percentage
            if (session.progress.totalItems > 0) {
                session.progress.percentage = Math.round(
                    (session.progress.processedItems / session.progress.totalItems) * 100
                );
            }

            // Calculate throughput metrics
            const timeDiff = (now - session.lastUpdate) / 1000; // seconds
            const itemsDiff = session.progress.processedItems - previousProcessed;
            
            if (timeDiff > 0 && itemsDiff > 0) {
                session.progress.itemsPerSecond = itemsDiff / timeDiff;
                session.progress.averageItemTime = timeDiff / itemsDiff * 1000; // milliseconds
                
                // Estimate remaining time
                const remainingItems = session.progress.totalItems - session.progress.processedItems;
                if (session.progress.itemsPerSecond > 0) {
                    session.progress.estimatedTimeRemaining = remainingItems / session.progress.itemsPerSecond * 1000; // milliseconds
                }
            }

            // Update phase if provided
            if (updates.currentPhase !== undefined) {
                if (updates.currentPhase !== session.progress.currentPhase) {
                    // Phase changed - mark previous as completed
                    if (session.progress.currentPhase && 
                        !session.progress.completedPhases.includes(session.progress.currentPhase)) {
                        session.progress.completedPhases.push(session.progress.currentPhase);
                    }
                    session.progress.currentPhase = updates.currentPhase;
                    
                    logger.debug('📈 Phase transition', {
                        sessionId,
                        newPhase: updates.currentPhase,
                        completedPhases: session.progress.completedPhases.length,
                        component: 'ProgressTracker'
                    });
                }
            }

            // Update resource usage if provided
            if (updates.resources) {
                Object.assign(session.resources, updates.resources);
            }

            // Add errors and warnings
            if (updates.errors) {
                session.errors.push(...updates.errors.map(error => ({
                    ...error,
                    timestamp: new Date().toISOString()
                })));
            }
            if (updates.warnings) {
                session.warnings.push(...updates.warnings.map(warning => ({
                    ...warning,
                    timestamp: new Date().toISOString()
                })));
            }

            session.lastUpdate = now;

            // Emit progress update event
            this.emit('progressUpdate', {
                sessionId,
                progress: session.progress,
                updates
            });

            logger.debug('📊 Progress updated', {
                sessionId,
                processed: session.progress.processedItems,
                total: session.progress.totalItems,
                percentage: session.progress.percentage,
                phase: session.progress.currentPhase,
                component: 'ProgressTracker'
            });

            return session.progress;

        } catch (error) {
            logger.error('❌ Failed to update progress', {
                sessionId,
                error: error.message,
                component: 'ProgressTracker'
            });
            throw new ProcessingError(`Failed to update progress: ${error.message}`);
        }
    }

    /**
     * Create a checkpoint for resumability
     */
    async createCheckpoint(sessionId, checkpointType = 'periodic', checkpointData = {}) {
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                throw new ProcessingError(`Session not found: ${sessionId}`);
            }

            const checkpointId = `checkpoint_${sessionId}_${Date.now()}`;
            
            const checkpoint = {
                checkpointId,
                sessionId,
                type: checkpointType,
                timestamp: new Date().toISOString(),
                
                // Progress state
                progress: { ...session.progress },
                
                // Resume data
                resumeData: {
                    lastProcessedIndex: session.progress.processedItems,
                    currentPhase: session.progress.currentPhase,
                    completedPhases: [...session.progress.completedPhases],
                    scanConfig: session.scanConfig,
                    ...checkpointData
                },
                
                // Session metadata
                sessionMetadata: {
                    startTime: session.startTime,
                    lastUpdate: session.lastUpdate,
                    totalDuration: Date.now() - session.startTime
                },
                
                // Resource state
                resources: { ...session.resources },
                
                // Error summary
                errorSummary: {
                    totalErrors: session.errors.length,
                    totalWarnings: session.warnings.length,
                    recentErrors: session.errors.slice(-5), // Last 5 errors
                    recentWarnings: session.warnings.slice(-5) // Last 5 warnings
                }
            };

            // Save checkpoint to file
            const checkpointFile = path.join(this.checkpointDir, `${checkpointId}.json`);
            await fs.writeFile(checkpointFile, JSON.stringify(checkpoint, null, 2));

            // Update session
            session.checkpoints.push(checkpointId);
            session.lastCheckpoint = checkpointId;
            this.checkpoints.set(checkpointId, checkpoint);

            // Cleanup old checkpoints (keep last 10)
            if (session.checkpoints.length > 10) {
                const oldCheckpoints = session.checkpoints.splice(0, session.checkpoints.length - 10);
                for (const oldCheckpointId of oldCheckpoints) {
                    await this.cleanupCheckpoint(oldCheckpointId);
                }
            }

            logger.debug('💾 Checkpoint created', {
                sessionId,
                checkpointId,
                type: checkpointType,
                progress: checkpoint.progress.percentage,
                component: 'ProgressTracker'
            });

            // Emit checkpoint event
            this.emit('checkpointCreated', {
                sessionId,
                checkpointId,
                checkpoint
            });

            return checkpointId;

        } catch (error) {
            logger.error('❌ Failed to create checkpoint', {
                sessionId,
                checkpointType,
                error: error.message,
                component: 'ProgressTracker'
            });
            throw new ProcessingError(`Failed to create checkpoint: ${error.message}`);
        }
    }

    /**
     * Resume a scan from checkpoint
     */
    async resumeFromCheckpoint(checkpointId) {
        try {
            logger.info('🔄 Resuming from checkpoint', {
                checkpointId,
                component: 'ProgressTracker'
            });

            // Load checkpoint
            const checkpoint = await this.loadCheckpoint(checkpointId);
            if (!checkpoint) {
                throw new ProcessingError(`Checkpoint not found: ${checkpointId}`);
            }

            const sessionId = checkpoint.sessionId;
            
            // Check if session is already active
            if (this.activeSessions.has(sessionId)) {
                throw new ProcessingError(`Session already active: ${sessionId}`);
            }

            // Recreate session from checkpoint
            const session = {
                sessionId,
                scanConfig: checkpoint.resumeData.scanConfig,
                startTime: checkpoint.sessionMetadata.startTime,
                lastUpdate: Date.now(),
                status: 'resumed',
                
                progress: {
                    ...checkpoint.progress,
                    // Reset time-based metrics
                    itemsPerSecond: 0,
                    averageItemTime: 0,
                    estimatedTimeRemaining: 0
                },
                
                resources: { ...checkpoint.resources },
                errors: [], // Start fresh for errors
                warnings: [], // Start fresh for warnings
                checkpoints: [checkpointId],
                lastCheckpoint: checkpointId,
                
                resumeData: checkpoint.resumeData,
                canResume: true,
                
                metadata: {
                    ...checkpoint.sessionMetadata,
                    resumedAt: new Date().toISOString(),
                    resumedFromCheckpoint: checkpointId
                }
            };

            this.activeSessions.set(sessionId, session);

            // Start tracking timers
            this.startTrackingTimers(sessionId);

            // Emit resume event
            this.emit('sessionResumed', {
                sessionId,
                checkpointId,
                session
            });

            logger.info('✅ Session resumed from checkpoint', {
                sessionId,
                checkpointId,
                progressPercentage: session.progress.percentage,
                component: 'ProgressTracker'
            });

            return {
                sessionId,
                session,
                resumeData: checkpoint.resumeData
            };

        } catch (error) {
            logger.error('❌ Failed to resume from checkpoint', {
                checkpointId,
                error: error.message,
                component: 'ProgressTracker'
            });
            throw new ProcessingError(`Failed to resume from checkpoint: ${error.message}`);
        }
    }

    /**
     * Complete a tracking session
     */
    async completeSession(sessionId, completionData = {}) {
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                throw new ProcessingError(`Session not found: ${sessionId}`);
            }

            logger.info('🏁 Completing tracking session', {
                sessionId,
                finalProgress: session.progress.percentage,
                component: 'ProgressTracker'
            });

            // Update final session data
            session.status = 'completed';
            session.endTime = Date.now();
            session.totalDuration = session.endTime - session.startTime;

            // Add completion data
            if (completionData.finalResults) {
                session.finalResults = completionData.finalResults;
            }
            if (completionData.summary) {
                session.summary = completionData.summary;
            }

            // Create final checkpoint
            await this.createCheckpoint(sessionId, 'completion', {
                completionData,
                finalStatus: 'completed'
            });

            // Stop tracking timers
            this.stopTrackingTimers(sessionId);

            // Save final session log
            await this.saveSessionLog(sessionId, session);

            // Remove from active sessions
            this.activeSessions.delete(sessionId);

            // Emit completion event
            this.emit('sessionCompleted', {
                sessionId,
                session,
                completionData
            });

            logger.info('✅ Tracking session completed', {
                sessionId,
                totalDuration: session.totalDuration,
                finalProgress: session.progress.percentage,
                component: 'ProgressTracker'
            });

            return {
                sessionId,
                status: 'completed',
                totalDuration: session.totalDuration,
                finalProgress: session.progress
            };

        } catch (error) {
            logger.error('❌ Failed to complete session', {
                sessionId,
                error: error.message,
                component: 'ProgressTracker'
            });
            throw new ProcessingError(`Failed to complete session: ${error.message}`);
        }
    }

    /**
     * Pause a tracking session
     */
    async pauseSession(sessionId) {
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                throw new ProcessingError(`Session not found: ${sessionId}`);
            }

            logger.info('⏸️ Pausing tracking session', {
                sessionId,
                component: 'ProgressTracker'
            });

            session.status = 'paused';
            session.pausedAt = Date.now();

            // Create pause checkpoint
            await this.createCheckpoint(sessionId, 'pause');

            // Stop tracking timers
            this.stopTrackingTimers(sessionId);

            // Emit pause event
            this.emit('sessionPaused', { sessionId, session });

            return { sessionId, status: 'paused' };

        } catch (error) {
            logger.error('❌ Failed to pause session', {
                sessionId,
                error: error.message,
                component: 'ProgressTracker'
            });
            throw new ProcessingError(`Failed to pause session: ${error.message}`);
        }
    }

    /**
     * Resume a paused session
     */
    async resumeSession(sessionId) {
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                throw new ProcessingError(`Session not found: ${sessionId}`);
            }

            if (session.status !== 'paused') {
                throw new ProcessingError(`Session is not paused: ${sessionId}`);
            }

            logger.info('▶️ Resuming tracking session', {
                sessionId,
                component: 'ProgressTracker'
            });

            session.status = 'running';
            session.resumedAt = Date.now();

            // Start tracking timers
            this.startTrackingTimers(sessionId);

            // Emit resume event
            this.emit('sessionResumed', { sessionId, session });

            return { sessionId, status: 'running' };

        } catch (error) {
            logger.error('❌ Failed to resume session', {
                sessionId,
                error: error.message,
                component: 'ProgressTracker'
            });
            throw new ProcessingError(`Failed to resume session: ${error.message}`);
        }
    }

    /**
     * Get progress report for a session
     */
    getProgressReport(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new ProcessingError(`Session not found: ${sessionId}`);
        }

        const now = Date.now();
        const duration = now - session.startTime;

        return {
            sessionId,
            status: session.status,
            
            // Progress metrics
            progress: { ...session.progress },
            
            // Time metrics
            timing: {
                startTime: new Date(session.startTime).toISOString(),
                lastUpdate: new Date(session.lastUpdate).toISOString(),
                totalDuration: duration,
                totalDurationFormatted: this.formatDuration(duration),
                estimatedTimeRemaining: session.progress.estimatedTimeRemaining,
                estimatedTimeRemainingFormatted: this.formatDuration(session.progress.estimatedTimeRemaining)
            },
            
            // Resource usage
            resources: { ...session.resources },
            
            // Error summary
            errors: {
                total: session.errors.length,
                recent: session.errors.slice(-3), // Last 3 errors
                warnings: session.warnings.length
            },
            
            // Checkpoint info
            checkpoints: {
                total: session.checkpoints.length,
                lastCheckpoint: session.lastCheckpoint,
                lastCheckpointTime: session.lastCheckpoint ? 
                    this.checkpoints.get(session.lastCheckpoint)?.timestamp : null
            },
            
            // Resume capability
            canResume: session.canResume,
            
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get progress reports for all active sessions
     */
    getAllProgressReports() {
        const reports = {};
        
        for (const sessionId of this.activeSessions.keys()) {
            try {
                reports[sessionId] = this.getProgressReport(sessionId);
            } catch (error) {
                reports[sessionId] = {
                    sessionId,
                    error: error.message
                };
            }
        }

        return {
            activeSessions: this.activeSessions.size,
            reports,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Start tracking timers for a session
     */
    startTrackingTimers(sessionId) {
        // Auto-save timer
        const autoSaveTimer = setInterval(async () => {
            try {
                await this.autoSaveSession(sessionId);
            } catch (error) {
                logger.warn('⚠️ Auto-save failed', {
                    sessionId,
                    error: error.message,
                    component: 'ProgressTracker'
                });
            }
        }, this.autoSaveInterval);

        // Checkpoint timer
        const checkpointTimer = setInterval(async () => {
            try {
                await this.createCheckpoint(sessionId, 'periodic');
            } catch (error) {
                logger.warn('⚠️ Periodic checkpoint failed', {
                    sessionId,
                    error: error.message,
                    component: 'ProgressTracker'
                });
            }
        }, this.checkpointInterval);

        this.timers.set(sessionId, {
            autoSave: autoSaveTimer,
            checkpoint: checkpointTimer
        });
    }

    /**
     * Stop tracking timers for a session
     */
    stopTrackingTimers(sessionId) {
        const sessionTimers = this.timers.get(sessionId);
        if (sessionTimers) {
            clearInterval(sessionTimers.autoSave);
            clearInterval(sessionTimers.checkpoint);
            this.timers.delete(sessionId);
        }
    }

    /**
     * Auto-save session progress
     */
    async autoSaveSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return;

        const progressFile = path.join(this.progressDir, `${sessionId}_progress.json`);
        await fs.writeFile(progressFile, JSON.stringify({
            sessionId,
            progress: session.progress,
            lastUpdate: session.lastUpdate,
            status: session.status
        }, null, 2));
    }

    /**
     * Save complete session log
     */
    async saveSessionLog(sessionId, session) {
        try {
            const logFile = path.join(this.sessionLogDir, `${sessionId}_complete.json`);
            await fs.writeFile(logFile, JSON.stringify(session, null, 2));
            
            logger.debug('💾 Session log saved', {
                sessionId,
                logFile,
                component: 'ProgressTracker'
            });
        } catch (error) {
            logger.warn('⚠️ Failed to save session log', {
                sessionId,
                error: error.message,
                component: 'ProgressTracker'
            });
        }
    }

    /**
     * Load checkpoint from file
     */
    async loadCheckpoint(checkpointId) {
        try {
            const checkpointFile = path.join(this.checkpointDir, `${checkpointId}.json`);
            const checkpointData = await fs.readFile(checkpointFile, 'utf8');
            return JSON.parse(checkpointData);
        } catch (error) {
            return null;
        }
    }

    /**
     * Load previous sessions from progress files
     */
    async loadPreviousSessions() {
        try {
            const progressFiles = await fs.readdir(this.progressDir);
            
            for (const file of progressFiles) {
                if (file.endsWith('_progress.json')) {
                    try {
                        const filePath = path.join(this.progressDir, file);
                        const progressData = JSON.parse(await fs.readFile(filePath, 'utf8'));
                        
                        // Only load sessions that can be resumed
                        if (progressData.status === 'running' || progressData.status === 'paused') {
                            logger.debug('📂 Found resumable session', {
                                sessionId: progressData.sessionId,
                                status: progressData.status,
                                component: 'ProgressTracker'
                            });
                        }
                    } catch (error) {
                        logger.warn('⚠️ Failed to load progress file', {
                            file,
                            error: error.message,
                            component: 'ProgressTracker'
                        });
                    }
                }
            }
        } catch (error) {
            // Progress directory doesn't exist or is empty
            logger.debug('No previous sessions found', {
                component: 'ProgressTracker'
            });
        }
    }

    /**
     * Cleanup old checkpoint
     */
    async cleanupCheckpoint(checkpointId) {
        try {
            const checkpointFile = path.join(this.checkpointDir, `${checkpointId}.json`);
            await fs.unlink(checkpointFile);
            this.checkpoints.delete(checkpointId);
        } catch (error) {
            // File might not exist, ignore
        }
    }

    /**
     * Setup graceful shutdown handling
     */
    setupGracefulShutdown() {
        const gracefulShutdown = async (signal) => {
            if (this.isShuttingDown) return;
            this.isShuttingDown = true;

            logger.info(`🛑 Graceful shutdown initiated (${signal})`, {
                activeSessions: this.activeSessions.size,
                component: 'ProgressTracker'
            });

            // Create checkpoints for all active sessions
            const shutdownPromises = Array.from(this.activeSessions.keys()).map(async (sessionId) => {
                try {
                    await this.createCheckpoint(sessionId, 'shutdown');
                    await this.pauseSession(sessionId);
                } catch (error) {
                    logger.warn('⚠️ Failed to save session during shutdown', {
                        sessionId,
                        error: error.message,
                        component: 'ProgressTracker'
                    });
                }
            });

            await Promise.allSettled(shutdownPromises);
            
            logger.info('✅ Progress tracking shutdown completed', {
                component: 'ProgressTracker'
            });
        };

        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    }

    /**
     * Format duration in human readable format
     */
    formatDuration(ms) {
        if (!ms || ms < 0) return '0s';
        
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
     * Get tracker status
     */
    getStatus() {
        return {
            tracker: 'ProgressTracker',
            activeSessions: this.activeSessions.size,
            totalCheckpoints: this.checkpoints.size,
            trackingInterval: this.trackingInterval,
            checkpointInterval: this.checkpointInterval,
            autoSaveInterval: this.autoSaveInterval,
            isShuttingDown: this.isShuttingDown,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            this.isShuttingDown = true;

            // Stop all timers
            for (const sessionId of this.timers.keys()) {
                this.stopTrackingTimers(sessionId);
            }

            // Create final checkpoints for active sessions
            const cleanupPromises = Array.from(this.activeSessions.keys()).map(async (sessionId) => {
                try {
                    await this.createCheckpoint(sessionId, 'cleanup');
                } catch (error) {
                    logger.warn('⚠️ Failed to create cleanup checkpoint', {
                        sessionId,
                        error: error.message,
                        component: 'ProgressTracker'
                    });
                }
            });

            await Promise.allSettled(cleanupPromises);

            // Clear data structures
            this.activeSessions.clear();
            this.checkpoints.clear();
            this.timers.clear();

            // Remove all listeners
            this.removeAllListeners();

            logger.info('🧹 Progress Tracker cleaned up', {
                component: 'ProgressTracker'
            });
        } catch (error) {
            logger.error('❌ Error during Progress Tracker cleanup', {
                error: error.message,
                component: 'ProgressTracker'
            });
        }
    }
}

// Export singleton instance
export const progressTracker = new ProgressTracker();
export { ProgressTracker, ProcessingError };