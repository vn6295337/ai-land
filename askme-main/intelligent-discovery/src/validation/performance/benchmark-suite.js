/**
 * Performance Benchmarking Suite
 * Module 5, Step 27: Build performance benchmarking suite
 * 
 * Features:
 * - Comprehensive performance benchmarking
 * - Multiple benchmark categories and tests
 * - Statistical performance analysis
 * - Comparative benchmarking across models
 * - Performance trend tracking and reporting
 */

import { logger } from '../../core/infrastructure/logger.js';
import { config } from '../../core/infrastructure/config.js';
import { apiTester } from '../testing/api-tester.js';
import { qualityAnalyzer } from '../quality/quality-analyzer.js';
import { rateLimiter } from '../../discovery/providers/ratelimiter.js';
import { ProcessingError } from '../../core/infrastructure/errors.js';
import fs from 'fs/promises';
import path from 'path';

class BenchmarkSuite {
    constructor() {
        this.benchmarkResults = new Map();
        this.benchmarkSuites = new Map();
        this.performanceHistory = [];
        this.benchmarkStandards = new Map();
        this.statisticalAnalyzer = null;
        this.resultsDir = path.join('data', 'benchmark_results');
        
        this.setupBenchmarkSuites();
        this.setupPerformanceStandards();
    }

    /**
     * Set up benchmark test suites for different performance aspects
     */
    setupBenchmarkSuites() {
        // Latency Benchmarks
        this.benchmarkSuites.set('latency', {
            name: 'Response Latency Benchmarks',
            description: 'Tests response time under various conditions',
            category: 'performance',
            weight: 0.3,
            tests: [
                {
                    name: 'cold_start_latency',
                    description: 'Measure initial response time',
                    timeout: 30000,
                    iterations: 3,
                    testFunction: this.benchmarkColdStartLatency.bind(this)
                },
                {
                    name: 'warm_latency',  
                    description: 'Measure response time after warm-up',
                    timeout: 15000,
                    iterations: 5,
                    warmupRequests: 2,
                    testFunction: this.benchmarkWarmLatency.bind(this)
                },
                {
                    name: 'concurrent_latency',
                    description: 'Measure response time under concurrent load',
                    timeout: 20000,
                    iterations: 3,
                    concurrency: 5,
                    testFunction: this.benchmarkConcurrentLatency.bind(this)
                }
            ]
        });

        // Throughput Benchmarks
        this.benchmarkSuites.set('throughput', {
            name: 'Throughput Benchmarks',
            description: 'Tests requests per second capacity',
            category: 'performance',
            weight: 0.25,
            tests: [
                {
                    name: 'sustained_throughput',
                    description: 'Measure sustained requests per second',
                    duration: 60000, // 1 minute
                    maxConcurrency: 10,
                    testFunction: this.benchmarkSustainedThroughput.bind(this)
                },
                {
                    name: 'burst_throughput',
                    description: 'Measure peak throughput capability',
                    duration: 30000, // 30 seconds
                    maxConcurrency: 20,
                    testFunction: this.benchmarkBurstThroughput.bind(this)
                },
                {
                    name: 'scaling_throughput',
                    description: 'Test throughput scaling with load',
                    concurrencyLevels: [1, 2, 5, 10, 15, 20],
                    testFunction: this.benchmarkScalingThroughput.bind(this)
                }
            ]
        });

        // Quality Benchmarks
        this.benchmarkSuites.set('quality', {
            name: 'Response Quality Benchmarks',
            description: 'Tests response quality across different scenarios',
            category: 'quality',
            weight: 0.35,
            tests: [
                {
                    name: 'consistency_benchmark',
                    description: 'Measure response consistency',
                    iterations: 10,
                    samePrompt: true,
                    testFunction: this.benchmarkResponseConsistency.bind(this)
                },
                {
                    name: 'quality_under_load',
                    description: 'Measure quality degradation under load',
                    loadLevels: [1, 5, 10],
                    qualityThreshold: 0.8,
                    testFunction: this.benchmarkQualityUnderLoad.bind(this)
                },
                {
                    name: 'complex_task_quality',
                    description: 'Quality on complex reasoning tasks',
                    complexityLevels: ['simple', 'moderate', 'complex'],
                    testFunction: this.benchmarkComplexTaskQuality.bind(this)
                }
            ]
        });

        // Reliability Benchmarks
        this.benchmarkSuites.set('reliability', {
            name: 'Reliability Benchmarks',
            description: 'Tests system reliability and error handling',
            category: 'reliability',
            weight: 0.2,
            tests: [
                {
                    name: 'error_rate_benchmark',
                    description: 'Measure error rates under normal load',
                    iterations: 50,
                    acceptableErrorRate: 0.02, // 2%
                    testFunction: this.benchmarkErrorRate.bind(this)
                },
                {
                    name: 'timeout_handling',
                    description: 'Test timeout and recovery behavior',
                    timeoutScenarios: [5000, 10000, 15000],
                    testFunction: this.benchmarkTimeoutHandling.bind(this)
                },
                {
                    name: 'rate_limit_handling',
                    description: 'Test rate limiting behavior',
                    rateLimitTests: true,
                    testFunction: this.benchmarkRateLimitHandling.bind(this)
                }
            ]
        });

        // Scalability Benchmarks
        this.benchmarkSuites.set('scalability', {
            name: 'Scalability Benchmarks',
            description: 'Tests performance scaling characteristics',
            category: 'scalability',
            weight: 0.15,
            tests: [
                {
                    name: 'load_scaling',
                    description: 'Performance scaling with increasing load',
                    loadSteps: [1, 2, 5, 10, 20, 50],
                    testFunction: this.benchmarkLoadScaling.bind(this)
                },
                {
                    name: 'token_scaling',
                    description: 'Performance scaling with token length',
                    tokenLengths: [100, 500, 1000, 2000, 4000],
                    testFunction: this.benchmarkTokenScaling.bind(this)
                }
            ]
        });

        // Memory Benchmarks
        this.benchmarkSuites.set('memory', {
            name: 'Memory Usage Benchmarks',
            description: 'Tests memory usage patterns',
            category: 'resource',
            weight: 0.1,
            tests: [
                {
                    name: 'memory_efficiency',
                    description: 'Measure memory usage efficiency',
                    iterations: 10,
                    testFunction: this.benchmarkMemoryEfficiency.bind(this)
                },
                {
                    name: 'memory_leaks',
                    description: 'Test for memory leaks over time',
                    duration: 300000, // 5 minutes
                    testFunction: this.benchmarkMemoryLeaks.bind(this)
                }
            ]
        });

        logger.info('🏁 Benchmark suites configured', {
            suites: Array.from(this.benchmarkSuites.keys()),
            totalTests: Array.from(this.benchmarkSuites.values()).reduce((sum, suite) => sum + suite.tests.length, 0),
            component: 'BenchmarkSuite'
        });
    }

    /**
     * Set up performance standards and thresholds
     */
    setupPerformanceStandards() {
        this.benchmarkStandards.set('latency_thresholds', {
            excellent: 2000,    // < 2s
            good: 5000,         // < 5s
            acceptable: 10000,  // < 10s
            poor: 15000,        // < 15s
            unacceptable: Infinity
        });

        this.benchmarkStandards.set('throughput_thresholds', {
            excellent: 10,      // >= 10 req/s
            good: 5,            // >= 5 req/s
            acceptable: 2,      // >= 2 req/s
            poor: 1,            // >= 1 req/s
            unacceptable: 0
        });

        this.benchmarkStandards.set('quality_thresholds', {
            excellent: 0.9,     // >= 90%
            good: 0.8,          // >= 80%
            acceptable: 0.7,    // >= 70%
            poor: 0.6,          // >= 60%
            unacceptable: 0
        });

        this.benchmarkStandards.set('reliability_thresholds', {
            excellent: 0.99,    // >= 99% uptime
            good: 0.95,         // >= 95% uptime
            acceptable: 0.90,   // >= 90% uptime
            poor: 0.85,         // >= 85% uptime
            unacceptable: 0
        });

        this.benchmarkStandards.set('benchmark_weights', {
            latency: 0.3,
            throughput: 0.25,
            quality: 0.35,
            reliability: 0.2,
            scalability: 0.15,
            memory: 0.1
        });

        logger.info('📊 Performance standards configured', {
            standards: Array.from(this.benchmarkStandards.keys()),
            component: 'BenchmarkSuite'
        });
    }

    /**
     * Initialize the benchmark suite
     */
    async initialize() {
        try {
            logger.info('🚀 Initializing Benchmark Suite...', {
                component: 'BenchmarkSuite'
            });

            // Ensure results directory exists
            await fs.mkdir(this.resultsDir, { recursive: true });

            // Initialize statistical analyzer
            this.statisticalAnalyzer = new StatisticalAnalyzer();

            logger.info('✅ Benchmark Suite initialized', {
                suites: this.benchmarkSuites.size,
                standards: this.benchmarkStandards.size,
                component: 'BenchmarkSuite'
            });

            return {
                suite: 'BenchmarkSuite',
                initialized: true,
                availableSuites: Array.from(this.benchmarkSuites.keys())
            };
        } catch (error) {
            logger.error('❌ Failed to initialize Benchmark Suite', {
                error: error.message,
                component: 'BenchmarkSuite'
            });
            throw new ProcessingError(`Benchmark suite initialization failed: ${error.message}`);
        }
    }

    /**
     * Run complete benchmark suite for a model
     */
    async runFullBenchmark(model, options = {}) {
        try {
            const {
                suites = Array.from(this.benchmarkSuites.keys()),
                includeComparative = false,
                generateReport = true,
                saveResults = true
            } = options;

            logger.info(`🏁 Starting full benchmark: ${model.name}`, {
                modelId: model.id,
                provider: model.provider,
                suites: suites.length,
                component: 'BenchmarkSuite'
            });

            const benchmarkId = `benchmark_${model.id}_${Date.now()}`;
            const startTime = Date.now();

            // Initialize benchmark session
            const benchmarkSession = {
                benchmarkId,
                modelId: model.id,
                modelName: model.name,
                provider: model.provider,
                startTime: new Date().toISOString(),
                suites: suites,
                results: {},
                overallScore: 0,
                performanceGrade: 'ungraded',
                status: 'running',
                statistics: {},
                comparative: {},
                errors: [],
                warnings: []
            };

            try {
                // Run each benchmark suite
                for (const suiteName of suites) {
                    const suiteResult = await this.runBenchmarkSuite(model, suiteName, options);
                    benchmarkSession.results[suiteName] = suiteResult;
                }

                // Calculate overall performance score
                benchmarkSession.overallScore = this.calculateOverallScore(benchmarkSession.results);
                benchmarkSession.performanceGrade = this.determinePerformanceGrade(benchmarkSession.overallScore);

                // Generate statistical analysis
                benchmarkSession.statistics = await this.generateStatisticalAnalysis(benchmarkSession);

                // Comparative analysis if requested
                if (includeComparative) {
                    benchmarkSession.comparative = await this.generateComparativeAnalysis(benchmarkSession);
                }

                // Generate detailed report
                if (generateReport) {
                    benchmarkSession.report = await this.generateBenchmarkReport(benchmarkSession);
                }

                benchmarkSession.status = 'completed';
                benchmarkSession.endTime = new Date().toISOString();
                benchmarkSession.duration = Date.now() - startTime;

                // Save results
                if (saveResults) {
                    await this.saveBenchmarkResults(benchmarkId, benchmarkSession);
                }

                this.benchmarkResults.set(benchmarkId, benchmarkSession);
                this.performanceHistory.push(benchmarkSession);

                logger.info(`✅ Full benchmark completed: ${model.name}`, {
                    benchmarkId,
                    overallScore: benchmarkSession.overallScore.toFixed(3),
                    performanceGrade: benchmarkSession.performanceGrade,
                    duration: `${benchmarkSession.duration}ms`,
                    component: 'BenchmarkSuite'
                });

                return benchmarkSession;

            } catch (error) {
                benchmarkSession.status = 'failed';
                benchmarkSession.error = error.message;
                benchmarkSession.endTime = new Date().toISOString();
                benchmarkSession.duration = Date.now() - startTime;

                logger.error(`❌ Full benchmark failed: ${model.name}`, {
                    benchmarkId,
                    error: error.message,
                    component: 'BenchmarkSuite'
                });

                return benchmarkSession;
            }

        } catch (error) {
            logger.error('❌ Full benchmark failed', {
                modelId: model.id,
                error: error.message,
                component: 'BenchmarkSuite'
            });
            throw new ProcessingError(`Full benchmark failed: ${error.message}`);
        }
    }

    /**
     * Run a specific benchmark suite
     */
    async runBenchmarkSuite(model, suiteName, options = {}) {
        const suite = this.benchmarkSuites.get(suiteName);
        if (!suite) {
            throw new ProcessingError(`Unknown benchmark suite: ${suiteName}`);
        }

        logger.info(`🎯 Running benchmark suite: ${suite.name}`, {
            modelId: model.id,
            tests: suite.tests.length,
            component: 'BenchmarkSuite'
        });

        const suiteResult = {
            suiteName,
            displayName: suite.name,
            category: suite.category,
            weight: suite.weight,
            startTime: Date.now(),
            testResults: [],
            overallScore: 0,
            status: 'running',
            statistics: {
                totalTests: suite.tests.length,
                passedTests: 0,
                failedTests: 0,
                averageScore: 0
            }
        };

        try {
            // Run each test in the suite
            for (const test of suite.tests) {
                const testResult = await this.runBenchmarkTest(model, test, suite, options);
                suiteResult.testResults.push(testResult);

                if (testResult.passed) {
                    suiteResult.statistics.passedTests++;
                } else {
                    suiteResult.statistics.failedTests++;
                }
            }

            // Calculate suite score
            suiteResult.overallScore = this.calculateSuiteScore(suiteResult.testResults);
            suiteResult.statistics.averageScore = suiteResult.overallScore;
            suiteResult.status = 'completed';

            logger.info(`✅ Benchmark suite completed: ${suite.name}`, {
                score: suiteResult.overallScore.toFixed(3),
                passed: suiteResult.statistics.passedTests,
                failed: suiteResult.statistics.failedTests,
                component: 'BenchmarkSuite'
            });

            return suiteResult;

        } catch (error) {
            suiteResult.status = 'failed';
            suiteResult.error = error.message;
            
            logger.error(`❌ Benchmark suite failed: ${suite.name}`, {
                error: error.message,
                component: 'BenchmarkSuite'
            });

            return suiteResult;
        } finally {
            suiteResult.endTime = Date.now();
            suiteResult.duration = suiteResult.endTime - suiteResult.startTime;
        }
    }

    /**
     * Run individual benchmark test
     */
    async runBenchmarkTest(model, test, suite, options) {
        logger.debug(`🧪 Running benchmark test: ${test.name}`, {
            component: 'BenchmarkSuite'
        });

        const testResult = {
            name: test.name,
            description: test.description,
            startTime: Date.now(),
            status: 'running',
            measurements: [],
            statistics: {},
            passed: false,
            score: 0,
            errors: []
        };

        try {
            // Execute the test function
            const measurements = await test.testFunction(model, test, options);
            testResult.measurements = measurements;

            // Calculate test statistics
            testResult.statistics = this.calculateTestStatistics(measurements);

            // Determine if test passed
            testResult.passed = this.evaluateTestResult(test, testResult.statistics, suite);
            testResult.score = this.calculateTestScore(test, testResult.statistics, suite);

            testResult.status = 'completed';

            logger.debug(`${testResult.passed ? '✅' : '❌'} Test ${test.name}: ${testResult.passed ? 'passed' : 'failed'}`, {
                score: testResult.score.toFixed(3),
                component: 'BenchmarkSuite'
            });

        } catch (error) {
            testResult.status = 'failed';
            testResult.error = error.message;
            testResult.errors.push(error.message);
            testResult.passed = false;
            testResult.score = 0;

            logger.error(`❌ Benchmark test failed: ${test.name}`, {
                error: error.message,
                component: 'BenchmarkSuite'
            });
        } finally {
            testResult.endTime = Date.now();
            testResult.duration = testResult.endTime - testResult.startTime;
        }

        return testResult;
    }

    /**
     * Benchmark test implementations
     */

    // Latency benchmark tests
    async benchmarkColdStartLatency(model, test, options) {
        const measurements = [];

        for (let i = 0; i < test.iterations; i++) {
            try {
                // Apply rate limiting
                await rateLimiter.acquirePermission(model.provider, {
                    priority: 'normal',
                    timeout: 15000
                });

                const startTime = Date.now();

                // Simple test request
                const testResult = await apiTester.testModel(model, {
                    testTypes: [],
                    customTestCases: [{
                        name: 'cold_start_test',
                        input: { prompt: 'Hello, how are you?', max_tokens: 50 },
                        expectations: { status: 200 }
                    }]
                });

                const responseTime = Date.now() - startTime;
                const success = testResult.testCases[0]?.status === 'passed';

                measurements.push({
                    iteration: i + 1,
                    responseTime,
                    success,
                    timestamp: new Date().toISOString()
                });

                // Add delay between iterations for cold start
                await new Promise(resolve => setTimeout(resolve, 5000));

            } catch (error) {
                measurements.push({
                    iteration: i + 1,
                    error: error.message,
                    success: false,
                    timestamp: new Date().toISOString()
                });
            }
        }

        return measurements;
    }

    async benchmarkWarmLatency(model, test, options) {
        const measurements = [];

        // Warm-up requests
        for (let i = 0; i < (test.warmupRequests || 2); i++) {
            try {
                await rateLimiter.acquirePermission(model.provider, {
                    priority: 'low',
                    timeout: 10000
                });

                await apiTester.testModel(model, {
                    testTypes: [],
                    customTestCases: [{
                        name: 'warmup_test',
                        input: { prompt: 'Warmup request', max_tokens: 20 },
                        expectations: { status: 200 }
                    }]
                });

                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                // Ignore warmup errors
            }
        }

        // Actual measurements
        for (let i = 0; i < test.iterations; i++) {
            try {
                await rateLimiter.acquirePermission(model.provider, {
                    priority: 'normal',
                    timeout: 15000
                });

                const startTime = Date.now();

                const testResult = await apiTester.testModel(model, {
                    testTypes: [],
                    customTestCases: [{
                        name: 'warm_latency_test',
                        input: { prompt: 'What is artificial intelligence?', max_tokens: 100 },
                        expectations: { status: 200 }
                    }]
                });

                const responseTime = Date.now() - startTime;
                const success = testResult.testCases[0]?.status === 'passed';

                measurements.push({
                    iteration: i + 1,
                    responseTime,
                    success,
                    timestamp: new Date().toISOString()
                });

                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                measurements.push({
                    iteration: i + 1,
                    error: error.message,
                    success: false,
                    timestamp: new Date().toISOString()
                });
            }
        }

        return measurements;
    }

    async benchmarkConcurrentLatency(model, test, options) {
        const measurements = [];
        const concurrency = test.concurrency || 5;

        for (let iteration = 0; iteration < test.iterations; iteration++) {
            const promises = [];

            for (let c = 0; c < concurrency; c++) {
                promises.push(this.singleLatencyMeasurement(model, `concurrent_${iteration}_${c}`));
            }

            try {
                const results = await Promise.all(promises);
                measurements.push({
                    iteration: iteration + 1,
                    concurrency,
                    results,
                    averageResponseTime: results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.length,
                    maxResponseTime: Math.max(...results.map(r => r.responseTime || 0)),
                    minResponseTime: Math.min(...results.map(r => r.responseTime || Infinity)),
                    successRate: results.filter(r => r.success).length / results.length,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                measurements.push({
                    iteration: iteration + 1,
                    error: error.message,
                    success: false,
                    timestamp: new Date().toISOString()
                });
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        return measurements;
    }

    async singleLatencyMeasurement(model, testId) {
        try {
            await rateLimiter.acquirePermission(model.provider, {
                priority: 'normal',
                timeout: 10000
            });

            const startTime = Date.now();

            const testResult = await apiTester.testModel(model, {
                testTypes: [],
                customTestCases: [{
                    name: testId,
                    input: { prompt: 'Explain quantum computing briefly', max_tokens: 150 },
                    expectations: { status: 200 }
                }]
            });

            const responseTime = Date.now() - startTime;
            const success = testResult.testCases[0]?.status === 'passed';

            return {
                testId,
                responseTime,
                success,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                testId,
                error: error.message,
                success: false,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Throughput benchmark tests
    async benchmarkSustainedThroughput(model, test, options) {
        const measurements = [];
        const duration = test.duration || 60000; // 1 minute
        const maxConcurrency = test.maxConcurrency || 10;
        
        const startTime = Date.now();
        let requestCount = 0;
        let successCount = 0;
        let errorCount = 0;

        logger.info(`🚀 Starting sustained throughput test for ${duration/1000}s`, {
            maxConcurrency,
            component: 'BenchmarkSuite'
        });

        const runRequest = async () => {
            while (Date.now() - startTime < duration) {
                try {
                    await rateLimiter.acquirePermission(model.provider, {
                        priority: 'normal',
                        timeout: 5000
                    });

                    const requestStartTime = Date.now();
                    requestCount++;

                    const testResult = await apiTester.testModel(model, {
                        testTypes: [],
                        customTestCases: [{
                            name: `throughput_${requestCount}`,
                            input: { prompt: 'Quick response test', max_tokens: 50 },
                            expectations: { status: 200 }
                        }]
                    });

                    const responseTime = Date.now() - requestStartTime;
                    const success = testResult.testCases[0]?.status === 'passed';

                    if (success) {
                        successCount++;
                    } else {
                        errorCount++;
                    }

                    measurements.push({
                        requestId: requestCount,
                        timestamp: new Date().toISOString(),
                        responseTime,
                        success
                    });

                } catch (error) {
                    errorCount++;
                    measurements.push({
                        requestId: requestCount,
                        timestamp: new Date().toISOString(),
                        error: error.message,
                        success: false
                    });
                }
            }
        };

        // Start concurrent request streams
        const promises = Array(maxConcurrency).fill().map(() => runRequest());
        await Promise.all(promises);

        const actualDuration = Date.now() - startTime;
        const throughput = (successCount / actualDuration) * 1000; // requests per second

        return [{
            totalRequests: requestCount,
            successfulRequests: successCount,
            failedRequests: errorCount,
            duration: actualDuration,
            throughput,
            successRate: requestCount > 0 ? successCount / requestCount : 0,
            measurements
        }];
    }

    async benchmarkBurstThroughput(model, test, options) {
        // Similar to sustained throughput but with higher concurrency for shorter duration
        const duration = test.duration || 30000; // 30 seconds
        const maxConcurrency = test.maxConcurrency || 20;

        return await this.benchmarkSustainedThroughput(model, {
            duration,
            maxConcurrency
        }, options);
    }

    async benchmarkScalingThroughput(model, test, options) {
        const measurements = [];
        const concurrencyLevels = test.concurrencyLevels || [1, 2, 5, 10, 15, 20];

        for (const concurrency of concurrencyLevels) {
            try {
                logger.info(`📈 Testing throughput at concurrency: ${concurrency}`, {
                    component: 'BenchmarkSuite'
                });

                const result = await this.benchmarkSustainedThroughput(model, {
                    duration: 30000, // 30 seconds per level
                    maxConcurrency: concurrency
                }, options);

                measurements.push({
                    concurrency,
                    ...result[0]
                });

                // Brief pause between concurrency levels
                await new Promise(resolve => setTimeout(resolve, 5000));

            } catch (error) {
                measurements.push({
                    concurrency,
                    error: error.message,
                    success: false
                });
            }
        }

        return measurements;
    }

    // Quality benchmark tests
    async benchmarkResponseConsistency(model, test, options) {
        const measurements = [];
        const prompt = 'Explain the concept of machine learning in simple terms.';
        const responses = [];

        // Generate multiple responses to the same prompt
        for (let i = 0; i < test.iterations; i++) {
            try {
                await rateLimiter.acquirePermission(model.provider, {
                    priority: 'normal',
                    timeout: 15000
                });

                const testResult = await apiTester.testModel(model, {
                    testTypes: [],
                    customTestCases: [{
                        name: `consistency_${i}`,
                        input: { prompt, max_tokens: 200, temperature: 0.7 },
                        expectations: { status: 200 }
                    }]
                });

                const response = testResult.testCases[0]?.response?.data;
                if (response) {
                    responses.push(response);
                }

                measurements.push({
                    iteration: i + 1,
                    success: testResult.testCases[0]?.status === 'passed',
                    responseLength: response ? JSON.stringify(response).length : 0,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                measurements.push({
                    iteration: i + 1,
                    error: error.message,
                    success: false,
                    timestamp: new Date().toISOString()
                });
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Analyze consistency
        if (responses.length > 1) {
            const consistencyScore = await this.calculateResponseConsistency(responses);
            measurements.push({
                type: 'consistency_analysis',
                consistencyScore,
                totalResponses: responses.length,
                analysis: 'Semantic similarity analysis of responses'
            });
        }

        return measurements;
    }

    async benchmarkQualityUnderLoad(model, test, options) {
        const measurements = [];
        const loadLevels = test.loadLevels || [1, 5, 10];
        const qualityThreshold = test.qualityThreshold || 0.8;

        for (const load of loadLevels) {
            try {
                logger.info(`🔍 Testing quality under load: ${load}`, {
                    component: 'BenchmarkSuite'
                });

                const promises = Array(load).fill().map(async (_, i) => {
                    try {
                        await rateLimiter.acquirePermission(model.provider, {
                            priority: 'normal',
                            timeout: 10000
                        });

                        const testResult = await apiTester.testModel(model, {
                            testTypes: [],
                            customTestCases: [{
                                name: `quality_load_${load}_${i}`,
                                input: { 
                                    prompt: 'Write a detailed explanation of neural networks and their applications',
                                    max_tokens: 300
                                },
                                expectations: { status: 200 }
                            }]
                        });

                        const response = testResult.testCases[0]?.response?.data;
                        if (response) {
                            // Analyze response quality
                            const qualityAnalysis = await qualityAnalyzer.analyzeResponseQuality(
                                response,
                                { prompt: 'Write a detailed explanation of neural networks and their applications' },
                                { metrics: ['coherence', 'relevance', 'accuracy'] }
                            );

                            return {
                                loadLevel: load,
                                requestIndex: i,
                                success: true,
                                qualityScore: qualityAnalysis.overallScore,
                                qualityGrade: qualityAnalysis.qualityGrade,
                                responseTime: testResult.duration
                            };
                        }

                        return {
                            loadLevel: load,
                            requestIndex: i,
                            success: false,
                            error: 'No response received'
                        };

                    } catch (error) {
                        return {
                            loadLevel: load,
                            requestIndex: i,
                            success: false,
                            error: error.message
                        };
                    }
                });

                const results = await Promise.all(promises);
                const successfulResults = results.filter(r => r.success);
                const averageQuality = successfulResults.length > 0 ? 
                    successfulResults.reduce((sum, r) => sum + r.qualityScore, 0) / successfulResults.length : 0;

                measurements.push({
                    loadLevel: load,
                    totalRequests: load,
                    successfulRequests: successfulResults.length,
                    averageQuality,
                    qualityDegradation: averageQuality < qualityThreshold,
                    results
                });

            } catch (error) {
                measurements.push({
                    loadLevel: load,
                    error: error.message,
                    success: false
                });
            }
        }

        return measurements;
    }

    async benchmarkComplexTaskQuality(model, test, options) {
        const measurements = [];
        const complexityLevels = test.complexityLevels || ['simple', 'moderate', 'complex'];
        
        const prompts = {
            simple: 'What is 2 + 2?',
            moderate: 'Explain the water cycle and its importance to the environment.',
            complex: 'Analyze the economic, social, and technological factors that contributed to the Industrial Revolution and discuss their long-term impacts on modern society.'
        };

        for (const complexity of complexityLevels) {
            try {
                logger.info(`🧠 Testing complex task quality: ${complexity}`, {
                    component: 'BenchmarkSuite'
                });

                await rateLimiter.acquirePermission(model.provider, {
                    priority: 'normal',
                    timeout: 20000
                });

                const testResult = await apiTester.testModel(model, {
                    testTypes: [],
                    customTestCases: [{
                        name: `complex_task_${complexity}`,
                        input: { 
                            prompt: prompts[complexity],
                            max_tokens: complexity === 'complex' ? 500 : 300
                        },
                        expectations: { status: 200 }
                    }]
                });

                const response = testResult.testCases[0]?.response?.data;
                if (response) {
                    // Comprehensive quality analysis for complex tasks
                    const qualityAnalysis = await qualityAnalyzer.analyzeResponseQuality(
                        response,
                        { prompt: prompts[complexity] },
                        { 
                            metrics: ['coherence', 'fluency', 'relevance', 'accuracy', 'creativity'],
                            benchmarkStandard: complexity === 'complex' ? 'academic' : 'general'
                        }
                    );

                    measurements.push({
                        complexity,
                        prompt: prompts[complexity],
                        success: true,
                        qualityScore: qualityAnalysis.overallScore,
                        qualityGrade: qualityAnalysis.qualityGrade,
                        responseTime: testResult.duration,
                        responseLength: JSON.stringify(response).length,
                        metrics: qualityAnalysis.metrics,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    measurements.push({
                        complexity,
                        success: false,
                        error: 'No response received',
                        timestamp: new Date().toISOString()
                    });
                }

            } catch (error) {
                measurements.push({
                    complexity,
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        return measurements;
    }

    // Reliability benchmark tests
    async benchmarkErrorRate(model, test, options) {
        const measurements = [];
        const iterations = test.iterations || 50;
        const acceptableErrorRate = test.acceptableErrorRate || 0.02;

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < iterations; i++) {
            try {
                await rateLimiter.acquirePermission(model.provider, {
                    priority: 'normal',
                    timeout: 10000
                });

                const testResult = await apiTester.testModel(model, {
                    testTypes: [],
                    customTestCases: [{
                        name: `error_rate_${i}`,
                        input: { prompt: 'Generate a response', max_tokens: 100 },
                        expectations: { status: 200 }
                    }]
                });

                const success = testResult.testCases[0]?.status === 'passed';
                if (success) {
                    successCount++;
                } else {
                    errorCount++;
                }

                measurements.push({
                    iteration: i + 1,
                    success,
                    error: testResult.testCases[0]?.error,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                errorCount++;
                measurements.push({
                    iteration: i + 1,
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const actualErrorRate = errorCount / iterations;
        const passed = actualErrorRate <= acceptableErrorRate;

        measurements.push({
            type: 'error_rate_summary',
            totalRequests: iterations,
            successfulRequests: successCount,
            failedRequests: errorCount,
            errorRate: actualErrorRate,
            acceptableErrorRate,
            passed
        });

        return measurements;
    }

    async benchmarkTimeoutHandling(model, test, options) {
        const measurements = [];
        const timeoutScenarios = test.timeoutScenarios || [5000, 10000, 15000];

        for (const timeout of timeoutScenarios) {
            try {
                logger.info(`⏱️ Testing timeout handling: ${timeout}ms`, {
                    component: 'BenchmarkSuite'
                });

                await rateLimiter.acquirePermission(model.provider, {
                    priority: 'normal',
                    timeout: timeout + 5000
                });

                const startTime = Date.now();

                const testResult = await Promise.race([
                    apiTester.testModel(model, {
                        testTypes: [],
                        customTestCases: [{
                            name: `timeout_${timeout}`,
                            input: { 
                                prompt: 'Write a very detailed analysis of artificial intelligence, machine learning, deep learning, and their applications across various industries.',
                                max_tokens: 1000
                            },
                            expectations: { status: 200 }
                        }]
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Test timeout')), timeout)
                    )
                ]);

                const responseTime = Date.now() - startTime;
                const success = testResult.testCases[0]?.status === 'passed';

                measurements.push({
                    timeoutThreshold: timeout,
                    responseTime,
                    success,
                    withinTimeout: responseTime < timeout,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                const responseTime = Date.now() - Date.now();
                measurements.push({
                    timeoutThreshold: timeout,
                    responseTime,
                    success: false,
                    error: error.message,
                    timedOut: error.message.includes('timeout'),
                    timestamp: new Date().toISOString()
                });
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        return measurements;
    }

    async benchmarkRateLimitHandling(model, test, options) {
        const measurements = [];
        
        // Attempt to trigger rate limiting
        const rapidRequests = 20;
        const promises = [];

        logger.info(`🚦 Testing rate limit handling with ${rapidRequests} rapid requests`, {
            component: 'BenchmarkSuite'
        });

        for (let i = 0; i < rapidRequests; i++) {
            promises.push(this.rapidRequest(model, i));
        }

        const results = await Promise.allSettled(promises);
        
        let rateLimitCount = 0;
        let successCount = 0;
        let errorCount = 0;

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const data = result.value;
                if (data.rateLimited) {
                    rateLimitCount++;
                } else if (data.success) {
                    successCount++;
                } else {
                    errorCount++;
                }

                measurements.push({
                    requestIndex: index,
                    ...data
                });
            } else {
                errorCount++;
                measurements.push({
                    requestIndex: index,
                    success: false,
                    error: result.reason.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        measurements.push({
            type: 'rate_limit_summary',
            totalRequests: rapidRequests,
            successfulRequests: successCount,
            rateLimitedRequests: rateLimitCount,
            errorRequests: errorCount,
            rateLimitDetected: rateLimitCount > 0,
            gracefulHandling: rateLimitCount > 0 && errorCount < rapidRequests * 0.5
        });

        return measurements;
    }

    async rapidRequest(model, index) {
        try {
            const startTime = Date.now();

            // Skip rate limiter for this test
            const testResult = await apiTester.testModel(model, {
                testTypes: [],
                customTestCases: [{
                    name: `rapid_${index}`,
                    input: { prompt: 'Quick test', max_tokens: 20 },
                    expectations: { status: 200 }
                }]
            });

            const responseTime = Date.now() - startTime;
            const success = testResult.testCases[0]?.status === 'passed';

            return {
                requestIndex: index,
                responseTime,
                success,
                rateLimited: false,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            const isRateLimit = error.message.toLowerCase().includes('rate') || 
                              error.message.toLowerCase().includes('limit') ||
                              error.message.toLowerCase().includes('429');

            return {
                requestIndex: index,
                success: false,
                rateLimited: isRateLimit,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Scalability benchmark tests
    async benchmarkLoadScaling(model, test, options) {
        const measurements = [];
        const loadSteps = test.loadSteps || [1, 2, 5, 10, 20, 50];

        for (const load of loadSteps) {
            try {
                logger.info(`📊 Testing load scaling: ${load} concurrent requests`, {
                    component: 'BenchmarkSuite'
                });

                const startTime = Date.now();
                const promises = Array(load).fill().map((_, i) => 
                    this.scalabilityRequest(model, `load_${load}_${i}`)
                );

                const results = await Promise.allSettled(promises);
                const endTime = Date.now();

                const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
                const failed = results.length - successful;
                const totalTime = endTime - startTime;
                const throughput = (successful / totalTime) * 1000; // req/s

                measurements.push({
                    loadLevel: load,
                    totalRequests: load,
                    successfulRequests: successful,
                    failedRequests: failed,
                    totalTime,
                    throughput,
                    successRate: successful / load,
                    results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason.message }),
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                measurements.push({
                    loadLevel: load,
                    error: error.message,
                    success: false,
                    timestamp: new Date().toISOString()
                });
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        return measurements;
    }

    async benchmarkTokenScaling(model, test, options) {
        const measurements = [];
        const tokenLengths = test.tokenLengths || [100, 500, 1000, 2000, 4000];

        for (const tokenLength of tokenLengths) {
            try {
                logger.info(`📝 Testing token scaling: ${tokenLength} max tokens`, {
                    component: 'BenchmarkSuite'
                });

                await rateLimiter.acquirePermission(model.provider, {
                    priority: 'normal',
                    timeout: 30000
                });

                const startTime = Date.now();

                const testResult = await apiTester.testModel(model, {
                    testTypes: [],
                    customTestCases: [{
                        name: `token_scaling_${tokenLength}`,
                        input: { 
                            prompt: 'Write a comprehensive essay about the history and future of artificial intelligence.',
                            max_tokens: tokenLength
                        },
                        expectations: { status: 200 }
                    }]
                });

                const responseTime = Date.now() - startTime;
                const success = testResult.testCases[0]?.status === 'passed';
                const response = testResult.testCases[0]?.response?.data;
                const actualTokens = response ? JSON.stringify(response).length : 0;

                measurements.push({
                    requestedTokens: tokenLength,
                    actualTokens,
                    responseTime,
                    success,
                    tokensPerSecond: actualTokens > 0 ? (actualTokens / responseTime) * 1000 : 0,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                measurements.push({
                    requestedTokens: tokenLength,
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }

            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        return measurements;
    }

    async scalabilityRequest(model, testId) {
        try {
            await rateLimiter.acquirePermission(model.provider, {
                priority: 'normal',
                timeout: 15000
            });

            const startTime = Date.now();

            const testResult = await apiTester.testModel(model, {
                testTypes: [],
                customTestCases: [{
                    name: testId,
                    input: { prompt: 'Scalability test request', max_tokens: 100 },
                    expectations: { status: 200 }
                }]
            });

            const responseTime = Date.now() - startTime;
            const success = testResult.testCases[0]?.status === 'passed';

            return {
                testId,
                responseTime,
                success,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                testId,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Memory benchmark tests
    async benchmarkMemoryEfficiency(model, test, options) {
        const measurements = [];
        const iterations = test.iterations || 10;

        for (let i = 0; i < iterations; i++) {
            try {
                const memBefore = process.memoryUsage();

                await rateLimiter.acquirePermission(model.provider, {
                    priority: 'normal',
                    timeout: 15000
                });

                const testResult = await apiTester.testModel(model, {
                    testTypes: [],
                    customTestCases: [{
                        name: `memory_${i}`,
                        input: { prompt: 'Memory efficiency test', max_tokens: 200 },
                        expectations: { status: 200 }
                    }]
                });

                const memAfter = process.memoryUsage();
                const memDelta = {
                    heapUsed: memAfter.heapUsed - memBefore.heapUsed,
                    heapTotal: memAfter.heapTotal - memBefore.heapTotal,
                    external: memAfter.external - memBefore.external
                };

                measurements.push({
                    iteration: i + 1,
                    memoryBefore: memBefore,
                    memoryAfter: memAfter,
                    memoryDelta: memDelta,
                    success: testResult.testCases[0]?.status === 'passed',
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                measurements.push({
                    iteration: i + 1,
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        return measurements;
    }

    async benchmarkMemoryLeaks(model, test, options) {
        const measurements = [];
        const duration = test.duration || 300000; // 5 minutes
        const interval = 30000; // 30 seconds

        const startTime = Date.now();
        let requestCount = 0;

        while (Date.now() - startTime < duration) {
            try {
                const memUsage = process.memoryUsage();
                
                await rateLimiter.acquirePermission(model.provider, {
                    priority: 'low',
                    timeout: 10000
                });

                await apiTester.testModel(model, {
                    testTypes: [],
                    customTestCases: [{
                        name: `memory_leak_${requestCount}`,
                        input: { prompt: 'Memory leak test', max_tokens: 100 },
                        expectations: { status: 200 }
                    }]
                });

                requestCount++;

                measurements.push({
                    timestamp: new Date().toISOString(),
                    elapsedTime: Date.now() - startTime,
                    requestCount,
                    memoryUsage: memUsage,
                    heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024)
                });

            } catch (error) {
                measurements.push({
                    timestamp: new Date().toISOString(),
                    elapsedTime: Date.now() - startTime,
                    requestCount,
                    error: error.message
                });
            }

            await new Promise(resolve => setTimeout(resolve, interval));
        }

        // Analyze for memory leaks
        if (measurements.length > 2) {
            const firstMem = measurements[0].memoryUsage?.heapUsed || 0;
            const lastMem = measurements[measurements.length - 1].memoryUsage?.heapUsed || 0;
            const memoryGrowth = lastMem - firstMem;
            const potentialLeak = memoryGrowth > 50 * 1024 * 1024; // 50MB growth

            measurements.push({
                type: 'memory_leak_analysis',
                initialMemory: firstMem,
                finalMemory: lastMem,
                memoryGrowth,
                potentialLeak,
                totalRequests: requestCount,
                testDuration: Date.now() - startTime
            });
        }

        return measurements;
    }

    /**
     * Calculate test statistics
     */
    calculateTestStatistics(measurements) {
        if (!measurements || measurements.length === 0) {
            return {};
        }

        const responseTimes = measurements
            .filter(m => m.responseTime && m.success)
            .map(m => m.responseTime);

        const successCount = measurements.filter(m => m.success).length;
        const totalCount = measurements.length;

        const statistics = {
            totalMeasurements: totalCount,
            successfulMeasurements: successCount,
            failedMeasurements: totalCount - successCount,
            successRate: totalCount > 0 ? successCount / totalCount : 0
        };

        if (responseTimes.length > 0) {
            statistics.responseTime = {
                average: responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length,
                min: Math.min(...responseTimes),
                max: Math.max(...responseTimes),
                median: this.calculateMedian(responseTimes),
                p95: this.calculatePercentile(responseTimes, 0.95),
                p99: this.calculatePercentile(responseTimes, 0.99)
            };
        }

        return statistics;
    }

    /**
     * Evaluate test result against thresholds
     */
    evaluateTestResult(test, statistics, suite) {
        // Basic success rate check
        if (statistics.successRate < 0.8) {
            return false;
        }

        // Suite-specific evaluations
        switch (suite.category) {
            case 'performance':
                if (statistics.responseTime) {
                    const latencyThresholds = this.benchmarkStandards.get('latency_thresholds');
                    return statistics.responseTime.average <= latencyThresholds.acceptable;
                }
                break;
            
            case 'quality':
                // Quality tests have their own scoring
                return statistics.successRate >= 0.9;
            
            case 'reliability':
                return statistics.successRate >= 0.95;
            
            default:
                return statistics.successRate >= 0.8;
        }

        return true;
    }

    /**
     * Calculate test score
     */
    calculateTestScore(test, statistics, suite) {
        if (!statistics.successRate) {
            return 0;
        }

        let score = statistics.successRate;

        // Apply suite-specific scoring
        switch (suite.category) {
            case 'performance':
                if (statistics.responseTime) {
                    const latencyThresholds = this.benchmarkStandards.get('latency_thresholds');
                    const avgResponseTime = statistics.responseTime.average;
                    
                    if (avgResponseTime <= latencyThresholds.excellent) {
                        score *= 1.0;
                    } else if (avgResponseTime <= latencyThresholds.good) {
                        score *= 0.9;
                    } else if (avgResponseTime <= latencyThresholds.acceptable) {
                        score *= 0.8;
                    } else {
                        score *= 0.6;
                    }
                }
                break;
            
            case 'quality':
                // Quality scores are already incorporated
                break;
            
            case 'reliability':
                // Higher weight on success rate for reliability
                score = Math.pow(statistics.successRate, 2);
                break;
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Calculate suite score
     */
    calculateSuiteScore(testResults) {
        if (!testResults || testResults.length === 0) {
            return 0;
        }

        const totalScore = testResults.reduce((sum, result) => sum + (result.score || 0), 0);
        return totalScore / testResults.length;
    }

    /**
     * Calculate overall benchmark score
     */
    calculateOverallScore(suiteResults) {
        if (!suiteResults || Object.keys(suiteResults).length === 0) {
            return 0;
        }

        let totalWeightedScore = 0;
        let totalWeight = 0;

        for (const [suiteName, suiteResult] of Object.entries(suiteResults)) {
            if (suiteResult.overallScore !== undefined && suiteResult.weight) {
                totalWeightedScore += suiteResult.overallScore * suiteResult.weight;
                totalWeight += suiteResult.weight;
            }
        }

        return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    }

    /**
     * Determine performance grade
     */
    determinePerformanceGrade(overallScore) {
        if (overallScore >= 0.9) return 'Excellent';
        if (overallScore >= 0.8) return 'Good';
        if (overallScore >= 0.7) return 'Acceptable';
        if (overallScore >= 0.6) return 'Poor';
        return 'Unacceptable';
    }

    /**
     * Generate statistical analysis
     */
    async generateStatisticalAnalysis(benchmarkSession) {
        const analysis = {
            summary: {
                totalSuites: Object.keys(benchmarkSession.results).length,
                overallScore: benchmarkSession.overallScore,
                performanceGrade: benchmarkSession.performanceGrade
            },
            suiteBreakdown: {},
            trends: {},
            insights: []
        };

        // Analyze each suite
        for (const [suiteName, suiteResult] of Object.entries(benchmarkSession.results)) {
            analysis.suiteBreakdown[suiteName] = {
                score: suiteResult.overallScore,
                weight: suiteResult.weight,
                status: suiteResult.status,
                testsPassed: suiteResult.statistics?.passedTests || 0,
                testsTotal: suiteResult.statistics?.totalTests || 0
            };
        }

        // Generate insights
        const weakSuites = Object.entries(analysis.suiteBreakdown)
            .filter(([_, data]) => data.score < 0.7)
            .map(([name, _]) => name);

        if (weakSuites.length > 0) {
            analysis.insights.push(`Weak performance areas: ${weakSuites.join(', ')}`);
        }

        const strongSuites = Object.entries(analysis.suiteBreakdown)
            .filter(([_, data]) => data.score >= 0.9)
            .map(([name, _]) => name);

        if (strongSuites.length > 0) {
            analysis.insights.push(`Strong performance areas: ${strongSuites.join(', ')}`);
        }

        return analysis;
    }

    /**
     * Generate comparative analysis
     */
    async generateComparativeAnalysis(benchmarkSession) {
        // Placeholder for comparative analysis against historical data
        return {
            message: 'Comparative analysis not yet implemented',
            historicalAverage: 'unknown',
            relativePerformance: 'unknown'
        };
    }

    /**
     * Generate benchmark report
     */
    async generateBenchmarkReport(benchmarkSession) {
        return {
            executive_summary: {
                modelName: benchmarkSession.modelName,
                provider: benchmarkSession.provider,
                overallScore: benchmarkSession.overallScore.toFixed(3),
                performanceGrade: benchmarkSession.performanceGrade,
                testDate: benchmarkSession.startTime,
                duration: benchmarkSession.duration
            },
            performance_breakdown: Object.fromEntries(
                Object.entries(benchmarkSession.results).map(([name, result]) => [
                    name,
                    {
                        score: result.overallScore?.toFixed(3),
                        status: result.status,
                        category: result.category
                    }
                ])
            ),
            recommendations: this.generateRecommendations(benchmarkSession),
            technical_details: {
                totalTests: Object.values(benchmarkSession.results).reduce(
                    (sum, result) => sum + (result.statistics?.totalTests || 0), 0
                ),
                successfulTests: Object.values(benchmarkSession.results).reduce(
                    (sum, result) => sum + (result.statistics?.passedTests || 0), 0
                )
            }
        };
    }

    /**
     * Generate recommendations based on benchmark results
     */
    generateRecommendations(benchmarkSession) {
        const recommendations = [];
        
        for (const [suiteName, suiteResult] of Object.entries(benchmarkSession.results)) {
            if (suiteResult.overallScore < 0.7) {
                switch (suiteName) {
                    case 'latency':
                        recommendations.push('Optimize response latency through caching or model optimization');
                        break;
                    case 'throughput':
                        recommendations.push('Consider scaling infrastructure to handle higher throughput');
                        break;
                    case 'quality':
                        recommendations.push('Review and improve response quality metrics');
                        break;
                    case 'reliability':
                        recommendations.push('Implement better error handling and retry mechanisms');
                        break;
                    case 'scalability':
                        recommendations.push('Optimize for better performance under load');
                        break;
                    case 'memory':
                        recommendations.push('Investigate memory usage patterns and potential leaks');
                        break;
                }
            }
        }

        if (benchmarkSession.overallScore < 0.6) {
            recommendations.push('Consider comprehensive performance optimization across all areas');
        }

        return recommendations;
    }

    // Utility methods
    calculateMedian(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    calculatePercentile(values, percentile) {
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * percentile) - 1;
        return sorted[Math.max(0, index)];
    }

    async calculateResponseConsistency(responses) {
        // Simplified consistency calculation based on response similarity
        if (responses.length < 2) return 1.0;

        let totalSimilarity = 0;
        let comparisons = 0;

        for (let i = 0; i < responses.length; i++) {
            for (let j = i + 1; j < responses.length; j++) {
                const similarity = this.calculateTextSimilarity(
                    JSON.stringify(responses[i]),
                    JSON.stringify(responses[j])
                );
                totalSimilarity += similarity;
                comparisons++;
            }
        }

        return comparisons > 0 ? totalSimilarity / comparisons : 1.0;
    }

    calculateTextSimilarity(text1, text2) {
        // Simple word-based similarity
        const words1 = new Set(text1.toLowerCase().match(/\b\w+\b/g) || []);
        const words2 = new Set(text2.toLowerCase().match(/\b\w+\b/g) || []);
        
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        
        return union.size > 0 ? intersection.size / union.size : 0;
    }

    /**
     * Save benchmark results
     */
    async saveBenchmarkResults(benchmarkId, benchmarkSession) {
        try {
            const filename = `${benchmarkId}.json`;
            const filepath = path.join(this.resultsDir, filename);
            
            await fs.writeFile(filepath, JSON.stringify(benchmarkSession, null, 2));
            
            logger.debug('💾 Benchmark results saved', {
                benchmarkId,
                filepath,
                component: 'BenchmarkSuite'
            });

        } catch (error) {
            logger.warn('⚠️ Failed to save benchmark results', {
                benchmarkId,
                error: error.message,
                component: 'BenchmarkSuite'
            });
        }
    }

    /**
     * Get benchmark results
     */
    getBenchmarkResults(benchmarkId) {
        return this.benchmarkResults.get(benchmarkId);
    }

    /**
     * Get all benchmark results
     */
    getAllBenchmarkResults() {
        return Array.from(this.benchmarkResults.values());
    }

    /**
     * Get suite status
     */
    getStatus() {
        return {
            suite: 'BenchmarkSuite',
            availableSuites: Array.from(this.benchmarkSuites.keys()),
            completedBenchmarks: this.benchmarkResults.size,
            totalPerformanceHistory: this.performanceHistory.length,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            this.benchmarkResults.clear();
            this.benchmarkSuites.clear();
            this.performanceHistory = [];
            this.benchmarkStandards.clear();

            logger.info('🧹 Benchmark Suite cleaned up', {
                component: 'BenchmarkSuite'
            });
        } catch (error) {
            logger.error('❌ Error during Benchmark Suite cleanup', {
                error: error.message,
                component: 'BenchmarkSuite'
            });
        }
    }
}

/**
 * Statistical Analyzer helper class
 */
class StatisticalAnalyzer {
    constructor() {
        this.analysisCache = new Map();
    }

    analyze(data) {
        // Statistical analysis implementation
        return {
            mean: this.calculateMean(data),
            median: this.calculateMedian(data),
            standardDeviation: this.calculateStandardDeviation(data),
            variance: this.calculateVariance(data)
        };
    }

    calculateMean(values) {
        return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
    }

    calculateMedian(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    calculateVariance(values) {
        const mean = this.calculateMean(values);
        return values.length > 0 ? 
            values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length : 0;
    }

    calculateStandardDeviation(values) {
        return Math.sqrt(this.calculateVariance(values));
    }
}

// Export singleton instance
export const benchmarkSuite = new BenchmarkSuite();
export { BenchmarkSuite, ProcessingError };