/**
 * Reliability and Uptime Monitoring
 * Module 5, Step 28: Create reliability and uptime monitoring
 * 
 * Features:
 * - Continuous uptime monitoring
 * - Reliability metrics tracking
 * - Service health checks
 * - Downtime detection and alerting
 * - Historical reliability analysis
 */

import { logger } from '../../core/infrastructure/logger.js';
import { config } from '../../core/infrastructure/config.js';
import { apiTester } from '../testing/api-tester.js';
import { rateLimiter } from '../../discovery/providers/ratelimiter.js';
import { ProcessingError } from '../../core/infrastructure/errors.js';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

class ReliabilityMonitor extends EventEmitter {
    constructor() {
        super();
        this.monitoringSessions = new Map();
        this.reliabilityMetrics = new Map();
        this.healthChecks = new Map();
        this.monitoringHistory = [];
        this.alertThresholds = new Map();
        this.monitoringIntervals = new Map();
        this.isRunning = false;
        this.resultsDir = path.join('data', 'reliability_monitoring');
        
        this.setupAlertThresholds();
        this.setupHealthChecks();
    }

    /**
     * Set up alert thresholds for different reliability metrics
     */
    setupAlertThresholds() {
        this.alertThresholds.set('uptime', {
            critical: 0.95,    // 95% uptime
            warning: 0.98,     // 98% uptime
            normal: 0.99       // 99% uptime
        });

        this.alertThresholds.set('response_time', {
            critical: 30000,   // 30 seconds
            warning: 15000,    // 15 seconds
            normal: 10000      // 10 seconds
        });

        this.alertThresholds.set('error_rate', {
            critical: 0.10,    // 10% error rate
            warning: 0.05,     // 5% error rate
            normal: 0.02       // 2% error rate
        });

        this.alertThresholds.set('consecutive_failures', {
            critical: 5,       // 5 consecutive failures
            warning: 3,        // 3 consecutive failures
            normal: 1          // 1 failure is normal
        });

        logger.info('🚨 Alert thresholds configured', {
            thresholds: Array.from(this.alertThresholds.keys()),
            component: 'ReliabilityMonitor'
        });
    }

    /**
     * Set up health check configurations
     */
    setupHealthChecks() {
        this.healthChecks.set('basic_connectivity', {
            name: 'Basic Connectivity Check',
            description: 'Tests basic API connectivity',
            interval: 60000, // 1 minute
            timeout: 10000,  // 10 seconds
            retries: 2,
            testFunction: this.basicConnectivityCheck.bind(this)
        });

        this.healthChecks.set('response_quality', {
            name: 'Response Quality Check',
            description: 'Tests response quality and consistency',
            interval: 300000, // 5 minutes
            timeout: 20000,   // 20 seconds
            retries: 1,
            testFunction: this.responseQualityCheck.bind(this)
        });

        this.healthChecks.set('load_capacity', {
            name: 'Load Capacity Check',
            description: 'Tests performance under moderate load',
            interval: 600000, // 10 minutes
            timeout: 30000,   // 30 seconds
            retries: 1,
            testFunction: this.loadCapacityCheck.bind(this)
        });

        this.healthChecks.set('error_handling', {
            name: 'Error Handling Check',
            description: 'Tests error handling capabilities',
            interval: 900000, // 15 minutes
            timeout: 15000,   // 15 seconds
            retries: 1,
            testFunction: this.errorHandlingCheck.bind(this)
        });

        logger.info('🔍 Health checks configured', {
            checks: Array.from(this.healthChecks.keys()),
            component: 'ReliabilityMonitor'
        });
    }

    /**
     * Initialize the reliability monitor
     */
    async initialize() {
        try {
            logger.info('🚀 Initializing Reliability Monitor...', {
                component: 'ReliabilityMonitor'
            });

            // Ensure results directory exists
            await fs.mkdir(this.resultsDir, { recursive: true });

            // Load historical data if available
            await this.loadHistoricalData();

            logger.info('✅ Reliability Monitor initialized', {
                healthChecks: this.healthChecks.size,
                alertThresholds: this.alertThresholds.size,
                component: 'ReliabilityMonitor'
            });

            return {
                monitor: 'ReliabilityMonitor',
                initialized: true,
                availableHealthChecks: Array.from(this.healthChecks.keys())
            };
        } catch (error) {
            logger.error('❌ Failed to initialize Reliability Monitor', {
                error: error.message,
                component: 'ReliabilityMonitor'
            });
            throw new ProcessingError(`Reliability monitor initialization failed: ${error.message}`);
        }
    }

    /**
     * Start monitoring a model's reliability
     */
    async startMonitoring(model, options = {}) {
        try {
            const {
                healthChecks = Array.from(this.healthChecks.keys()),
                monitoringDuration = null, // Indefinite by default
                alertsEnabled = true,
                saveResults = true
            } = options;

            logger.info(`📊 Starting reliability monitoring: ${model.name}`, {
                modelId: model.id,
                provider: model.provider,
                healthChecks: healthChecks.length,
                component: 'ReliabilityMonitor'
            });

            const sessionId = `monitor_${model.id}_${Date.now()}`;
            const startTime = Date.now();

            // Initialize monitoring session
            const monitoringSession = {
                sessionId,
                modelId: model.id,
                modelName: model.name,
                provider: model.provider,
                startTime: new Date().toISOString(),
                healthChecks,
                options,
                status: 'running',
                
                // Metrics tracking
                metrics: {
                    totalChecks: 0,
                    successfulChecks: 0,
                    failedChecks: 0,
                    uptime: 1.0,
                    averageResponseTime: 0,
                    errorRate: 0,
                    consecutiveFailures: 0,
                    maxConsecutiveFailures: 0,
                    lastSuccessTime: new Date().toISOString(),
                    lastFailureTime: null
                },
                
                // Health check results
                healthCheckResults: [],
                
                // Alerts
                alerts: [],
                alertsEnabled,
                
                // Statistics
                statistics: {
                    uptimePercentage: 100,
                    meanTimeToFailure: 0,
                    meanTimeToRecovery: 0,
                    availabilityScore: 1.0
                },
                
                errors: [],
                warnings: []
            };

            this.monitoringSessions.set(sessionId, monitoringSession);

            // Start health check intervals
            await this.startHealthCheckIntervals(sessionId, model, healthChecks);

            // Set monitoring duration if specified
            if (monitoringDuration && monitoringDuration > 0) {
                setTimeout(() => {
                    this.stopMonitoring(sessionId);
                }, monitoringDuration);
            }

            // Emit monitoring started event
            this.emit('monitoringStarted', {
                sessionId,
                model: {
                    id: model.id,
                    name: model.name,
                    provider: model.provider
                }
            });

            logger.info(`✅ Reliability monitoring started: ${model.name}`, {
                sessionId,
                component: 'ReliabilityMonitor'
            });

            return monitoringSession;

        } catch (error) {
            logger.error('❌ Failed to start reliability monitoring', {
                modelId: model.id,
                error: error.message,
                component: 'ReliabilityMonitor'
            });
            throw new ProcessingError(`Failed to start monitoring: ${error.message}`);
        }
    }

    /**
     * Stop monitoring a specific session
     */
    async stopMonitoring(sessionId) {
        try {
            const session = this.monitoringSessions.get(sessionId);
            if (!session) {
                throw new ProcessingError(`Monitoring session not found: ${sessionId}`);
            }

            logger.info(`🛑 Stopping reliability monitoring: ${session.modelName}`, {
                sessionId,
                component: 'ReliabilityMonitor'
            });

            // Update session status
            session.status = 'stopped';
            session.endTime = new Date().toISOString();
            session.duration = Date.now() - new Date(session.startTime).getTime();

            // Stop health check intervals
            await this.stopHealthCheckIntervals(sessionId);

            // Calculate final statistics
            session.statistics = await this.calculateFinalStatistics(session);

            // Save results
            if (session.options.saveResults !== false) {
                await this.saveMonitoringResults(sessionId, session);
            }

            // Add to history
            this.monitoringHistory.push(session);

            // Remove from active sessions
            this.monitoringSessions.delete(sessionId);

            // Emit monitoring stopped event
            this.emit('monitoringStopped', {
                sessionId,
                duration: session.duration,
                finalStatistics: session.statistics
            });

            logger.info(`✅ Reliability monitoring stopped: ${session.modelName}`, {
                sessionId,
                duration: `${session.duration}ms`,
                uptime: `${(session.statistics.uptimePercentage || 0).toFixed(2)}%`,
                component: 'ReliabilityMonitor'
            });

            return session;

        } catch (error) {
            logger.error('❌ Failed to stop reliability monitoring', {
                sessionId,
                error: error.message,
                component: 'ReliabilityMonitor'
            });
            throw new ProcessingError(`Failed to stop monitoring: ${error.message}`);
        }
    }

    /**
     * Start health check intervals for a monitoring session
     */
    async startHealthCheckIntervals(sessionId, model, healthCheckNames) {
        const intervals = [];

        for (const checkName of healthCheckNames) {
            const healthCheck = this.healthChecks.get(checkName);
            if (!healthCheck) {
                logger.warn(`⚠️ Unknown health check: ${checkName}`, {
                    component: 'ReliabilityMonitor'
                });
                continue;
            }

            const intervalId = setInterval(async () => {
                await this.runHealthCheck(sessionId, model, checkName, healthCheck);
            }, healthCheck.interval);

            intervals.push({
                checkName,
                intervalId
            });

            // Run initial check immediately
            setTimeout(() => {
                this.runHealthCheck(sessionId, model, checkName, healthCheck);
            }, 1000);
        }

        this.monitoringIntervals.set(sessionId, intervals);
    }

    /**
     * Stop health check intervals for a monitoring session
     */
    async stopHealthCheckIntervals(sessionId) {
        const intervals = this.monitoringIntervals.get(sessionId);
        if (intervals) {
            for (const { intervalId } of intervals) {
                clearInterval(intervalId);
            }
            this.monitoringIntervals.delete(sessionId);
        }
    }

    /**
     * Run a specific health check
     */
    async runHealthCheck(sessionId, model, checkName, healthCheck) {
        const session = this.monitoringSessions.get(sessionId);
        if (!session || session.status !== 'running') {
            return;
        }

        logger.debug(`🔍 Running health check: ${checkName}`, {
            sessionId,
            model: model.name,
            component: 'ReliabilityMonitor'
        });

        const checkResult = {
            checkName,
            displayName: healthCheck.name,
            startTime: Date.now(),
            timestamp: new Date().toISOString(),
            status: 'running',
            success: false,
            responseTime: 0,
            error: null,
            details: {},
            retryCount: 0
        };

        try {
            // Execute health check with retry logic
            let lastError = null;
            let success = false;

            for (let attempt = 0; attempt <= healthCheck.retries; attempt++) {
                try {
                    checkResult.retryCount = attempt;
                    
                    const result = await Promise.race([
                        healthCheck.testFunction(model, healthCheck),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Health check timeout')), healthCheck.timeout)
                        )
                    ]);

                    // Health check succeeded
                    checkResult.success = true;
                    checkResult.details = result;
                    success = true;
                    break;

                } catch (error) {
                    lastError = error;
                    if (attempt < healthCheck.retries) {
                        // Wait before retry
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            }

            if (!success) {
                checkResult.error = lastError?.message || 'Health check failed';
            }

        } catch (error) {
            checkResult.error = error.message;
            checkResult.success = false;
        } finally {
            checkResult.endTime = Date.now();
            checkResult.responseTime = checkResult.endTime - checkResult.startTime;
            checkResult.status = 'completed';
        }

        // Update session metrics
        await this.updateSessionMetrics(session, checkResult);

        // Add to session results
        session.healthCheckResults.push(checkResult);

        // Check for alerts
        if (session.alertsEnabled) {
            await this.checkForAlerts(session, checkResult);
        }

        // Emit health check completed event
        this.emit('healthCheckCompleted', {
            sessionId,
            checkResult
        });

        logger.debug(`${checkResult.success ? '✅' : '❌'} Health check completed: ${checkName}`, {
            sessionId,
            success: checkResult.success,
            responseTime: checkResult.responseTime,
            component: 'ReliabilityMonitor'
        });
    }

    /**
     * Health check implementations
     */

    async basicConnectivityCheck(model, healthCheck) {
        try {
            // Apply rate limiting
            await rateLimiter.acquirePermission(model.provider, {
                priority: 'low',
                timeout: 5000
            });

            // Simple connectivity test
            const testResult = await apiTester.testModel(model, {
                testTypes: [],
                customTestCases: [{
                    name: 'connectivity_check',
                    input: { prompt: 'Hello', max_tokens: 10 },
                    expectations: { status: 200 }
                }]
            });

            const success = testResult.testCases[0]?.status === 'passed';
            const responseData = testResult.testCases[0]?.response?.data;

            return {
                success,
                hasResponse: !!responseData,
                responseSize: responseData ? JSON.stringify(responseData).length : 0,
                apiStatus: testResult.testCases[0]?.response?.status || 'unknown'
            };

        } catch (error) {
            throw new Error(`Connectivity check failed: ${error.message}`);
        }
    }

    async responseQualityCheck(model, healthCheck) {
        try {
            await rateLimiter.acquirePermission(model.provider, {
                priority: 'normal',
                timeout: 10000
            });

            // Test response quality with a standard prompt
            const testResult = await apiTester.testModel(model, {
                testTypes: [],
                customTestCases: [{
                    name: 'quality_check',
                    input: { 
                        prompt: 'Explain the concept of artificial intelligence in 100 words.',
                        max_tokens: 150
                    },
                    expectations: { status: 200 }
                }]
            });

            const success = testResult.testCases[0]?.status === 'passed';
            const responseData = testResult.testCases[0]?.response?.data;

            if (!success || !responseData) {
                throw new Error('No valid response received');
            }

            // Basic quality assessment
            const responseText = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
            const wordCount = (responseText.match(/\b\w+\b/g) || []).length;
            const hasRelevantContent = responseText.toLowerCase().includes('artificial intelligence') || 
                                     responseText.toLowerCase().includes('ai');

            return {
                success,
                wordCount,
                hasRelevantContent,
                responseLength: responseText.length,
                qualityScore: this.calculateBasicQualityScore(responseText)
            };

        } catch (error) {
            throw new Error(`Quality check failed: ${error.message}`);
        }
    }

    async loadCapacityCheck(model, healthCheck) {
        try {
            // Test with moderate concurrent load
            const concurrentRequests = 3;
            const promises = [];

            for (let i = 0; i < concurrentRequests; i++) {
                const promise = (async () => {
                    try {
                        await rateLimiter.acquirePermission(model.provider, {
                            priority: 'normal',
                            timeout: 8000
                        });

                        const testResult = await apiTester.testModel(model, {
                            testTypes: [],
                            customTestCases: [{
                                name: `load_test_${i}`,
                                input: { prompt: 'Brief response test', max_tokens: 50 },
                                expectations: { status: 200 }
                            }]
                        });

                        return {
                            index: i,
                            success: testResult.testCases[0]?.status === 'passed',
                            responseTime: testResult.duration || 0
                        };

                    } catch (error) {
                        return {
                            index: i,
                            success: false,
                            error: error.message
                        };
                    }
                })();

                promises.push(promise);
            }

            const results = await Promise.all(promises);
            const successfulRequests = results.filter(r => r.success).length;
            const averageResponseTime = results
                .filter(r => r.responseTime)
                .reduce((sum, r) => sum + r.responseTime, 0) / Math.max(1, successfulRequests);

            return {
                concurrentRequests,
                successfulRequests,
                successRate: successfulRequests / concurrentRequests,
                averageResponseTime,
                canHandleLoad: successfulRequests >= concurrentRequests * 0.8, // 80% success threshold
                results
            };

        } catch (error) {
            throw new Error(`Load capacity check failed: ${error.message}`);
        }
    }

    async errorHandlingCheck(model, healthCheck) {
        try {
            // Test error handling with invalid inputs
            const testCases = [
                {
                    name: 'empty_prompt',
                    input: { prompt: '', max_tokens: 10 },
                    expectError: true
                },
                {
                    name: 'excessive_tokens',
                    input: { prompt: 'Test', max_tokens: 100000 },
                    expectError: true
                },
                {
                    name: 'invalid_parameter',
                    input: { prompt: 'Test', temperature: 5.0 }, // Invalid temperature
                    expectError: true
                }
            ];

            const results = [];

            for (const testCase of testCases) {
                try {
                    await rateLimiter.acquirePermission(model.provider, {
                        priority: 'low',
                        timeout: 5000
                    });

                    const testResult = await apiTester.testModel(model, {
                        testTypes: [],
                        customTestCases: [testCase]
                    });

                    const success = testResult.testCases[0]?.status === 'passed';
                    const hasError = testResult.testCases[0]?.error;

                    results.push({
                        testCase: testCase.name,
                        success,
                        hasError: !!hasError,
                        errorHandled: testCase.expectError ? !!hasError : !hasError,
                        error: testResult.testCases[0]?.error
                    });

                } catch (error) {
                    results.push({
                        testCase: testCase.name,
                        success: false,
                        hasError: true,
                        errorHandled: testCase.expectError,
                        error: error.message
                    });
                }
            }

            const properlyHandledErrors = results.filter(r => r.errorHandled).length;
            const errorHandlingScore = properlyHandledErrors / results.length;

            return {
                testCases: results.length,
                properlyHandledErrors,
                errorHandlingScore,
                goodErrorHandling: errorHandlingScore >= 0.8,
                results
            };

        } catch (error) {
            throw new Error(`Error handling check failed: ${error.message}`);
        }
    }

    /**
     * Update session metrics based on health check result 
     */
    async updateSessionMetrics(session, checkResult) {
        const metrics = session.metrics;
        
        // Update basic counters
        metrics.totalChecks++;
        if (checkResult.success) {
            metrics.successfulChecks++;
            metrics.consecutiveFailures = 0;
            metrics.lastSuccessTime = checkResult.timestamp;
        } else {
            metrics.failedChecks++;
            metrics.consecutiveFailures++;
            metrics.lastFailureTime = checkResult.timestamp;
            
            if (metrics.consecutiveFailures > metrics.maxConsecutiveFailures) {
                metrics.maxConsecutiveFailures = metrics.consecutiveFailures;
            }
        }

        // Update uptime
        metrics.uptime = metrics.totalChecks > 0 ? metrics.successfulChecks / metrics.totalChecks : 1.0;

        // Update error rate
        metrics.errorRate = metrics.totalChecks > 0 ? metrics.failedChecks / metrics.totalChecks : 0.0;

        // Update average response time (only for successful checks)
        if (checkResult.success && checkResult.responseTime > 0) {
            const currentAverage = metrics.averageResponseTime || 0;
            const successfulCount = metrics.successfulChecks;
            metrics.averageResponseTime = ((currentAverage * (successfulCount - 1)) + checkResult.responseTime) / successfulCount;
        }

        // Update statistics
        session.statistics.uptimePercentage = metrics.uptime * 100;
        session.statistics.availabilityScore = this.calculateAvailabilityScore(metrics);
    }

    /**
     * Check for alert conditions and generate alerts
     */
    async checkForAlerts(session, checkResult) {
        const alerts = [];
        const metrics = session.metrics;

        // Check uptime alert
        const uptimeThresholds = this.alertThresholds.get('uptime');
        if (metrics.uptime < uptimeThresholds.critical) {
            alerts.push(this.createAlert('critical', 'uptime', `Uptime dropped to ${(metrics.uptime * 100).toFixed(2)}%`, session));
        } else if (metrics.uptime < uptimeThresholds.warning) {
            alerts.push(this.createAlert('warning', 'uptime', `Uptime is ${(metrics.uptime * 100).toFixed(2)}%`, session));
        }

        // Check response time alert
        const responseTimeThresholds = this.alertThresholds.get('response_time');
        if (checkResult.success && checkResult.responseTime > responseTimeThresholds.critical) {
            alerts.push(this.createAlert('critical', 'response_time', `Response time exceeded ${responseTimeThresholds.critical}ms`, session));
        } else if (checkResult.success && checkResult.responseTime > responseTimeThresholds.warning) {
            alerts.push(this.createAlert('warning', 'response_time', `Response time is ${checkResult.responseTime}ms`, session));
        }

        // Check error rate alert
        const errorRateThresholds = this.alertThresholds.get('error_rate');
        if (metrics.errorRate > errorRateThresholds.critical) {
            alerts.push(this.createAlert('critical', 'error_rate', `Error rate is ${(metrics.errorRate * 100).toFixed(2)}%`, session));
        } else if (metrics.errorRate > errorRateThresholds.warning) {
            alerts.push(this.createAlert('warning', 'error_rate', `Error rate is ${(metrics.errorRate * 100).toFixed(2)}%`, session));
        }

        // Check consecutive failures alert
        const failureThresholds = this.alertThresholds.get('consecutive_failures');
        if (metrics.consecutiveFailures >= failureThresholds.critical) {
            alerts.push(this.createAlert('critical', 'consecutive_failures', `${metrics.consecutiveFailures} consecutive failures`, session));
        } else if (metrics.consecutiveFailures >= failureThresholds.warning) {
            alerts.push(this.createAlert('warning', 'consecutive_failures', `${metrics.consecutiveFailures} consecutive failures`, session));
        }

        // Add alerts to session
        for (const alert of alerts) {
            session.alerts.push(alert);
            
            // Emit alert event
            this.emit('alert', {
                sessionId: session.sessionId,
                alert
            });

            logger.warn(`🚨 ${alert.severity.toUpperCase()} Alert: ${alert.message}`, {
                sessionId: session.sessionId,
                model: session.modelName,
                alertType: alert.type,
                component: 'ReliabilityMonitor'
            });
        }
    }

    /**
     * Create an alert object
     */
    createAlert(severity, type, message, session) {
        return {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            severity, // 'critical', 'warning', 'info'
            type,     // 'uptime', 'response_time', 'error_rate', 'consecutive_failures'
            message,
            timestamp: new Date().toISOString(),
            sessionId: session.sessionId,
            modelName: session.modelName,
            provider: session.provider,
            metrics: {
                uptime: session.metrics.uptime,
                errorRate: session.metrics.errorRate,
                consecutiveFailures: session.metrics.consecutiveFailures,
                averageResponseTime: session.metrics.averageResponseTime
            }
        };
    }

    /**
     * Calculate final statistics for a monitoring session
     */
    async calculateFinalStatistics(session) {
        const metrics = session.metrics;
        const duration = Date.now() - new Date(session.startTime).getTime();

        // Calculate Mean Time To Failure (MTTF)
        const failures = session.healthCheckResults.filter(r => !r.success);
        const successPeriods = [];
        let lastFailureTime = new Date(session.startTime).getTime();

        for (const failure of failures) {
            const failureTime = new Date(failure.timestamp).getTime();
            successPeriods.push(failureTime - lastFailureTime);
            lastFailureTime = failureTime;
        }

        const meanTimeToFailure = successPeriods.length > 0 ? 
            successPeriods.reduce((sum, period) => sum + period, 0) / successPeriods.length : duration;

        // Calculate Mean Time To Recovery (MTTR)
        const recoveryTimes = [];
        let inFailureState = false;
        let failureStartTime = null;

        for (const result of session.healthCheckResults) {
            if (!result.success && !inFailureState) {
                inFailureState = true;
                failureStartTime = new Date(result.timestamp).getTime();
            } else if (result.success && inFailureState) {
                inFailureState = false;
                if (failureStartTime) {
                    recoveryTimes.push(new Date(result.timestamp).getTime() - failureStartTime);
                }
            }
        }

        const meanTimeToRecovery = recoveryTimes.length > 0 ? 
            recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length : 0;

        return {
            uptimePercentage: (metrics.uptime * 100).toFixed(3),
            errorRate: (metrics.errorRate * 100).toFixed(3),
            averageResponseTime: Math.round(metrics.averageResponseTime || 0),
            totalHealthChecks: metrics.totalChecks,
            successfulHealthChecks: metrics.successfulChecks,
            failedHealthChecks: metrics.failedChecks,
            maxConsecutiveFailures: metrics.maxConsecutiveFailures,
            meanTimeToFailure: Math.round(meanTimeToFailure),
            meanTimeToRecovery: Math.round(meanTimeToRecovery),
            availabilityScore: this.calculateAvailabilityScore(metrics).toFixed(3),
            reliabilityGrade: this.determineReliabilityGrade(metrics),
            monitoringDuration: duration,
            alertsGenerated: session.alerts.length,
            criticalAlerts: session.alerts.filter(a => a.severity === 'critical').length,
            warningAlerts: session.alerts.filter(a => a.severity === 'warning').length
        };
    }

    /**
     * Calculate availability score based on multiple factors
     */
    calculateAvailabilityScore(metrics) {
        // Weighted scoring based on different reliability factors
        const uptimeWeight = 0.4;
        const responseTimeWeight = 0.2;
        const errorRateWeight = 0.3;
        const consistencyWeight = 0.1;

        // Uptime score (0-1)
        const uptimeScore = metrics.uptime;

        // Response time score (0-1, based on acceptable thresholds)
        const avgResponseTime = metrics.averageResponseTime || 0;
        const responseTimeScore = avgResponseTime > 0 ? 
            Math.max(0, 1 - (avgResponseTime / 20000)) : 1; // 20s as maximum acceptable

        // Error rate score (0-1)
        const errorRateScore = 1 - Math.min(1, metrics.errorRate * 5); // Scale error rate

        // Consistency score (based on consecutive failures)
        const consistencyScore = metrics.maxConsecutiveFailures > 0 ? 
            Math.max(0, 1 - (metrics.maxConsecutiveFailures / 10)) : 1; // 10 consecutive failures = 0 score

        // Calculate weighted average
        const availabilityScore = (
            uptimeScore * uptimeWeight +
            responseTimeScore * responseTimeWeight +
            errorRateScore * errorRateWeight +
            consistencyScore * consistencyWeight
        );

        return Math.max(0, Math.min(1, availabilityScore));
    }

    /**
     * Determine reliability grade based on metrics
     */
    determineReliabilityGrade(metrics) {
        const availabilityScore = this.calculateAvailabilityScore(metrics);
        
        if (availabilityScore >= 0.95) return 'Excellent';
        if (availabilityScore >= 0.90) return 'Good';
        if (availabilityScore >= 0.80) return 'Acceptable';
        if (availabilityScore >= 0.70) return 'Poor';
        return 'Unacceptable';
    }

    /**
     * Calculate basic quality score for response text
     */
    calculateBasicQualityScore(responseText) {
        let score = 0.5; // Base score

        // Length factor
        const wordCount = (responseText.match(/\b\w+\b/g) || []).length;
        if (wordCount >= 50) score += 0.2;
        if (wordCount >= 100) score += 0.1;

        // Coherence indicators
        if (responseText.includes('.') && responseText.includes(' ')) score += 0.1;
        
        // Content relevance (basic check)
        const hasSubstantialContent = wordCount >= 20 && responseText.length >= 100;
        if (hasSubstantialContent) score += 0.1;

        return Math.min(1, score);
    }

    /**
     * Load historical monitoring data
     */
    async loadHistoricalData() {
        try {
            const files = await fs.readdir(this.resultsDir);
            const monitoringFiles = files.filter(file => file.endsWith('_monitoring.json'));

            for (const file of monitoringFiles.slice(-10)) { // Load last 10 files
                try {
                    const filePath = path.join(this.resultsDir, file);
                    const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
                    this.monitoringHistory.push(data);
                } catch (error) {
                    logger.warn('⚠️ Failed to load historical data', {
                        file,
                        error: error.message,
                        component: 'ReliabilityMonitor'
                    });
                }
            }

            logger.debug('📂 Historical data loaded', {
                entriesLoaded: this.monitoringHistory.length,
                component: 'ReliabilityMonitor'
            });

        } catch (error) {
            // Directory might not exist yet
            logger.debug('No historical data found', {
                component: 'ReliabilityMonitor'
            });
        }
    }

    /**
     * Save monitoring results
     */
    async saveMonitoringResults(sessionId, session) {
        try {
            const filename = `${sessionId}_monitoring.json`;
            const filepath = path.join(this.resultsDir, filename);
            
            await fs.writeFile(filepath, JSON.stringify(session, null, 2));
            
            logger.debug('💾 Monitoring results saved', {
                sessionId,
                filepath,
                component: 'ReliabilityMonitor'
            });

        } catch (error) {
            logger.warn('⚠️ Failed to save monitoring results', {
                sessionId,
                error: error.message,
                component: 'ReliabilityMonitor'
            });
        }
    }

    /**
     * Get monitoring session
     */
    getMonitoringSession(sessionId) {
        return this.monitoringSessions.get(sessionId);
    }

    /**
     * Get all active monitoring sessions
     */
    getActiveMonitoringSessions() {
        return Array.from(this.monitoringSessions.values());
    }

    /**
     * Get monitoring history
     */
    getMonitoringHistory() {
        return this.monitoringHistory;
    }

    /**
     * Generate reliability report for a model
     */
    async generateReliabilityReport(modelId, timeRange = null) {
        try {
            // Filter history for the specific model
            let relevantSessions = this.monitoringHistory.filter(session => session.modelId === modelId);
            
            // Apply time range filter if specified
            if (timeRange) {
                const cutoffTime = new Date(Date.now() - timeRange).toISOString();
                relevantSessions = relevantSessions.filter(session => session.startTime >= cutoffTime);
            }

            if (relevantSessions.length === 0) {
                return {
                    modelId,
                    message: 'No monitoring data available for this model',
                    timeRange
                };
            }

            // Aggregate statistics
            const totalSessions = relevantSessions.length;
            const totalChecks = relevantSessions.reduce((sum, s) => sum + (s.metrics?.totalChecks || 0), 0);
            const totalSuccessfulChecks = relevantSessions.reduce((sum, s) => sum + (s.metrics?.successfulChecks || 0), 0);
            const totalAlerts = relevantSessions.reduce((sum, s) => sum + (s.alerts?.length || 0), 0);

            const averageUptime = totalChecks > 0 ? (totalSuccessfulChecks / totalChecks) * 100 : 0;
            const averageResponseTime = relevantSessions.reduce((sum, s) => sum + (s.metrics?.averageResponseTime || 0), 0) / totalSessions;

            return {
                modelId,
                reportGenerated: new Date().toISOString(),
                timeRange,
                summary: {
                    totalMonitoringSessions: totalSessions,
                    totalHealthChecks: totalChecks,
                    overallUptimePercentage: averageUptime.toFixed(2),
                    averageResponseTime: Math.round(averageResponseTime),
                    totalAlertsGenerated: totalAlerts,
                    reliabilityGrade: this.determineReliabilityGrade({ 
                        uptime: averageUptime / 100,
                        averageResponseTime,
                        errorRate: 1 - (averageUptime / 100),
                        maxConsecutiveFailures: 0
                    })
                },
                sessionBreakdown: relevantSessions.map(session => ({
                    sessionId: session.sessionId,
                    startTime: session.startTime,
                    duration: session.duration,
                    uptime: session.statistics?.uptimePercentage,
                    averageResponseTime: session.statistics?.averageResponseTime,
                    alertsGenerated: session.alerts?.length || 0
                })),
                trends: {
                    uptimeTrend: this.calculateTrend(relevantSessions.map(s => parseFloat(s.statistics?.uptimePercentage || 0))),
                    responseTimeTrend: this.calculateTrend(relevantSessions.map(s => s.statistics?.averageResponseTime || 0))
                }
            };

        } catch (error) {
            logger.error('❌ Failed to generate reliability report', {
                modelId,
                error: error.message,
                component: 'ReliabilityMonitor'
            });
            throw new ProcessingError(`Failed to generate reliability report: ${error.message}`);
        }
    }

    /**
     * Calculate trend direction for a series of values
     */
    calculateTrend(values) {
        if (values.length < 2) return 'insufficient_data';
        
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
        
        const change = ((secondAvg - firstAvg) / firstAvg) * 100;
        
        if (Math.abs(change) < 5) return 'stable';
        return change > 0 ? 'improving' : 'declining';
    }

    /**
     * Stop all active monitoring sessions
     */
    async stopAllMonitoring() {
        const activeSessions = Array.from(this.monitoringSessions.keys());
        
        for (const sessionId of activeSessions) {
            try {
                await this.stopMonitoring(sessionId);
            } catch (error) {
                logger.warn('⚠️ Failed to stop monitoring session', {
                    sessionId,
                    error: error.message,
                    component: 'ReliabilityMonitor'
                });
            }
        }

        logger.info('🛑 All monitoring sessions stopped', {
            stoppedSessions: activeSessions.length,
            component: 'ReliabilityMonitor'
        });
    }

    /**
     * Get monitor status
     */
    getStatus() {
        return {
            monitor: 'ReliabilityMonitor',
            isRunning: this.isRunning,
            activeMonitoringSessions: this.monitoringSessions.size,
            availableHealthChecks: Array.from(this.healthChecks.keys()),
            totalHistoricalSessions: this.monitoringHistory.length,
            configuredAlertThresholds: Array.from(this.alertThresholds.keys()),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            // Stop all monitoring sessions
            await this.stopAllMonitoring();

            // Clear data structures
            this.monitoringSessions.clear();
            this.reliabilityMetrics.clear();
            this.healthChecks.clear();
            this.monitoringHistory = [];
            this.alertThresholds.clear();
            this.monitoringIntervals.clear();

            // Remove all listeners
            this.removeAllListeners();

            logger.info('🧹 Reliability Monitor cleaned up', {
                component: 'ReliabilityMonitor'
            });
        } catch (error) {
            logger.error('❌ Error during Reliability Monitor cleanup', {
                error: error.message,
                component: 'ReliabilityMonitor'
            });
        }
    }
}

// Export singleton instance
export const reliabilityMonitor = new ReliabilityMonitor();
export { ReliabilityMonitor, ProcessingError };