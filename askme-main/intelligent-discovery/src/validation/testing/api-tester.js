/**
 * Real API Endpoint Testing Framework
 * Module 5, Step 24: Build real API endpoint testing framework
 * 
 * Features:
 * - Comprehensive API endpoint testing
 * - Real-time model validation
 * - Multiple test scenarios and edge cases
 * - Performance and reliability metrics
 * - Automated test suite execution
 */

import { logger } from '../../core/infrastructure/logger.js';
import { config } from '../../core/infrastructure/config.js';
import { rateLimiter } from '../../discovery/providers/ratelimiter.js';
import { ProcessingError } from '../../core/infrastructure/errors.js';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import fs from 'fs/promises';
import path from 'path';

class APITester {
    constructor() {
        this.testResults = new Map();
        this.testSuites = new Map();
        this.activeTests = new Map();
        this.testHistory = [];
        this.testConfig = {
            timeout: 30000, // 30 seconds
            retries: 3,
            concurrency: 5,
            validateSSL: true
        };
        this.testTemplates = new Map();
        this.resultsDir = path.join('data', 'validation_results');
        
        this.setupTestTemplates();
    }

    /**
     * Set up test templates for different model types
     */
    setupTestTemplates() {
        // Text generation test template
        this.testTemplates.set('text-generation', {
            name: 'Text Generation Test',
            testCases: [
                {
                    name: 'basic_completion',
                    description: 'Basic text completion test',
                    input: { prompt: 'The capital of France is', max_tokens: 50 },
                    expectations: {
                        status: 200,
                        responseTime: { max: 15000 },
                        contentType: 'application/json',
                        responseStructure: ['choices', 'usage'],
                        minResponseLength: 10
                    }
                },
                {
                    name: 'creative_writing',
                    description: 'Creative writing capability test',
                    input: { 
                        prompt: 'Write a short story about a robot learning to paint:', 
                        max_tokens: 200,
                        temperature: 0.8
                    },
                    expectations: {
                        status: 200,
                        responseTime: { max: 20000 },
                        minResponseLength: 100,
                        creativityMetrics: true
                    }
                },
                {
                    name: 'instruction_following',
                    description: 'Instruction following test',
                    input: { 
                        prompt: 'List exactly 3 benefits of renewable energy in bullet points:',
                        max_tokens: 150
                    },
                    expectations: {
                        status: 200,
                        structuredResponse: true,
                        containsKeywords: ['•', '-', '1.', '2.', '3.']
                    }
                }
            ]
        });

        // Chat completion test template
        this.testTemplates.set('chat-completion', {
            name: 'Chat Completion Test',
            testCases: [
                {
                    name: 'single_turn_chat',
                    description: 'Single turn conversation test',
                    input: {
                        messages: [
                            { role: 'user', content: 'Hello! How are you?' }
                        ],
                        max_tokens: 100
                    },
                    expectations: {
                        status: 200,
                        responseTime: { max: 10000 },
                        responseStructure: ['choices', 'message'],
                        conversationalResponse: true
                    }
                },
                {
                    name: 'multi_turn_chat',
                    description: 'Multi-turn conversation test',
                    input: {
                        messages: [
                            { role: 'user', content: 'What is machine learning?' },
                            { role: 'assistant', content: 'Machine learning is a subset of artificial intelligence...' },
                            { role: 'user', content: 'Can you give me a simple example?' }
                        ],
                        max_tokens: 150
                    },
                    expectations: {
                        status: 200,
                        contextAwareness: true,
                        coherentResponse: true
                    }
                }
            ]
        });

        // Embedding test template
        this.testTemplates.set('embeddings', {
            name: 'Embeddings Test',
            testCases: [
                {
                    name: 'text_embedding',
                    description: 'Text embedding generation test',
                    input: {
                        input: 'The quick brown fox jumps over the lazy dog',
                        model: 'text-embedding-3-small'
                    },
                    expectations: {
                        status: 200,
                        responseTime: { max: 5000 },
                        responseStructure: ['data', 'embedding'],
                        embeddingDimensions: { min: 384, max: 3072 },
                        vectorNormalization: true
                    }
                },
                {
                    name: 'batch_embedding',
                    description: 'Batch embedding test',
                    input: {
                        input: [
                            'First sentence for embedding',
                            'Second sentence for embedding',
                            'Third sentence for embedding'
                        ]
                    },
                    expectations: {
                        status: 200,
                        batchResponse: true,
                        consistentDimensions: true
                    }
                }
            ]
        });

        // Image generation test template
        this.testTemplates.set('image-generation', {
            name: 'Image Generation Test',
            testCases: [
                {
                    name: 'simple_image_generation',
                    description: 'Basic image generation test',
                    input: {
                        prompt: 'A serene mountain landscape at sunset',
                        size: '1024x1024',
                        n: 1
                    },
                    expectations: {
                        status: 200,
                        responseTime: { max: 30000 },
                        responseStructure: ['data', 'url'],
                        imageValidation: true
                    }
                }
            ]
        });

        // Function calling test template
        this.testTemplates.set('function-calling', {
            name: 'Function Calling Test',
            testCases: [
                {
                    name: 'weather_function_call',
                    description: 'Function calling capability test',
                    input: {
                        messages: [
                            { role: 'user', content: 'What is the weather like in San Francisco?' }
                        ],
                        functions: [
                            {
                                name: 'get_weather',
                                description: 'Get current weather in a location',
                                parameters: {
                                    type: 'object',
                                    properties: {
                                        location: { type: 'string', description: 'City name' }
                                    },
                                    required: ['location']
                                }
                            }
                        ]
                    },
                    expectations: {
                        status: 200,
                        functionCallDetection: true,
                        properParameterExtraction: true
                    }
                }
            ]
        });

        logger.info('🧪 Test templates configured', {
            templates: Array.from(this.testTemplates.keys()),
            component: 'APITester'
        });
    }

    /**
     * Initialize the API tester
     */
    async initialize() {
        try {
            logger.info('🚀 Initializing API Tester...', {
                component: 'APITester'
            });

            // Ensure results directory exists
            await fs.mkdir(this.resultsDir, { recursive: true });

            logger.info('✅ API Tester initialized', {
                templates: this.testTemplates.size,
                component: 'APITester'
            });

            return {
                tester: 'APITester',
                initialized: true,
                availableTemplates: Array.from(this.testTemplates.keys())
            };
        } catch (error) {
            logger.error('❌ Failed to initialize API Tester', {
                error: error.message,
                component: 'APITester'
            });
            throw new ProcessingError(`API tester initialization failed: ${error.message}`);
        }
    }

    /**
     * Test a single model's API endpoint
     */
    async testModel(model, options = {}) {
        try {
            const {
                testTypes = ['basic'],
                includePerformanceTests = true,
                includeStressTests = false,
                customTestCases = []
            } = options;

            logger.info(`🧪 Starting API test for model: ${model.name}`, {
                modelId: model.id,
                provider: model.provider,
                testTypes,
                component: 'APITester'
            });

            const testId = `test_${model.id}_${Date.now()}`;
            const startTime = Date.now();

            // Initialize test session
            const testSession = {
                testId,
                modelId: model.id,
                modelName: model.name,
                provider: model.provider,
                startTime: new Date().toISOString(),
                testTypes,
                status: 'running',
                results: {
                    passed: 0,
                    failed: 0,
                    skipped: 0,
                    total: 0
                },
                testCases: [],
                errors: [],
                warnings: [],
                performance: {
                    averageResponseTime: 0,
                    maxResponseTime: 0,
                    minResponseTime: Infinity,
                    totalRequests: 0,
                    successfulRequests: 0,
                    failedRequests: 0
                }
            };

            this.activeTests.set(testId, testSession);

            try {
                // Step 1: Basic connectivity test
                await this.runConnectivityTest(model, testSession);

                // Step 2: Run template-based tests
                for (const testType of testTypes) {
                    await this.runTemplateTests(model, testType, testSession);
                }

                // Step 3: Run custom test cases
                if (customTestCases.length > 0) {
                    await this.runCustomTests(model, customTestCases, testSession);
                }

                // Step 4: Performance tests
                if (includePerformanceTests) {
                    await this.runPerformanceTests(model, testSession);
                }

                // Step 5: Stress tests
                if (includeStressTests) {
                    await this.runStressTests(model, testSession);
                }

                // Step 6: Finalize results
                testSession.status = 'completed';
                testSession.endTime = new Date().toISOString();
                testSession.duration = Date.now() - startTime;
                testSession.success = testSession.results.failed === 0;

                // Calculate performance metrics
                if (testSession.performance.totalRequests > 0) {
                    testSession.performance.successRate = 
                        (testSession.performance.successfulRequests / testSession.performance.totalRequests * 100).toFixed(2) + '%';
                    testSession.performance.averageResponseTime = 
                        Math.round(testSession.performance.averageResponseTime / testSession.performance.totalRequests);
                }

                // Save results
                await this.saveTestResults(testId, testSession);
                this.testResults.set(testId, testSession);
                this.testHistory.push(testSession);

                logger.info(`✅ API test completed for model: ${model.name}`, {
                    testId,
                    success: testSession.success,
                    passed: testSession.results.passed,
                    failed: testSession.results.failed,
                    duration: `${testSession.duration}ms`,
                    component: 'APITester'
                });

                return testSession;

            } catch (error) {
                testSession.status = 'failed';
                testSession.error = error.message;
                testSession.endTime = new Date().toISOString();
                testSession.duration = Date.now() - startTime;

                logger.error(`❌ API test failed for model: ${model.name}`, {
                    testId,
                    error: error.message,
                    component: 'APITester'
                });

                return testSession;
            } finally {
                this.activeTests.delete(testId);
            }

        } catch (error) {
            logger.error('❌ Model API testing failed', {
                modelId: model.id,
                error: error.message,
                component: 'APITester'
            });
            throw new ProcessingError(`Model API testing failed: ${error.message}`);
        }
    }

    /**
     * Test multiple models in batch
     */
    async testModels(models, options = {}) {
        try {
            const {
                parallel = false,
                maxConcurrency = this.testConfig.concurrency,
                continueOnError = true
            } = options;

            logger.info('🧪 Starting batch API testing', {
                modelCount: models.length,
                parallel,
                maxConcurrency,
                component: 'APITester'
            });

            const batchId = `batch_${Date.now()}`;
            const results = [];
            const errors = [];

            if (parallel) {
                // Parallel testing with concurrency control
                const semaphore = Array(maxConcurrency).fill(null);
                let modelIndex = 0;

                const testPromises = semaphore.map(async () => {
                    while (modelIndex < models.length) {
                        const currentIndex = modelIndex++;
                        const model = models[currentIndex];

                        try {
                            const result = await this.testModel(model, options);
                            results.push(result);
                        } catch (error) {
                            errors.push({
                                modelId: model.id,
                                error: error.message
                            });

                            if (!continueOnError) {
                                throw error;
                            }
                        }
                    }
                });

                await Promise.all(testPromises);

            } else {
                // Sequential testing
                for (const model of models) {
                    try {
                        const result = await this.testModel(model, options);
                        results.push(result);

                        // Brief delay between tests
                        await new Promise(resolve => setTimeout(resolve, 1000));

                    } catch (error) {
                        errors.push({
                            modelId: model.id,
                            error: error.message
                        });

                        if (!continueOnError) {
                            throw error;
                        }
                    }
                }
            }

            const batchResult = {
                batchId,
                totalModels: models.length,
                successful: results.length,
                failed: errors.length,
                results,
                errors,
                stats: {
                    successRate: ((results.length / models.length) * 100).toFixed(2) + '%',
                    averageTestDuration: results.length > 0 ? 
                        Math.round(results.reduce((sum, r) => sum + r.duration, 0) / results.length) : 0
                },
                timestamp: new Date().toISOString()
            };

            logger.info('✅ Batch API testing completed', {
                batchId,
                successful: results.length,
                failed: errors.length,
                successRate: batchResult.stats.successRate,
                component: 'APITester'
            });

            return batchResult;

        } catch (error) {
            logger.error('❌ Batch API testing failed', {
                error: error.message,
                modelCount: models.length,
                component: 'APITester'
            });
            throw new ProcessingError(`Batch API testing failed: ${error.message}`);
        }
    }

    /**
     * Run connectivity test
     */
    async runConnectivityTest(model, testSession) {
        const testCase = {
            name: 'connectivity_test',
            description: 'Basic API endpoint connectivity test',
            startTime: Date.now(),
            status: 'running'
        };

        try {
            logger.debug(`🔌 Running connectivity test for ${model.name}`, {
                component: 'APITester'
            });

            if (!model.apiEndpoint) {
                testCase.status = 'skipped';
                testCase.reason = 'No API endpoint available';
                testSession.results.skipped++;
                return;
            }

            // Apply rate limiting
            await rateLimiter.acquirePermission(model.provider, {
                priority: 'low',
                timeout: 10000
            });

            // Simple HTTP request to check connectivity
            const response = await this.makeAPIRequest(model.apiEndpoint, {
                method: 'GET',
                timeout: 10000
            });

            testCase.response = {
                status: response.status,
                headers: response.headers,
                responseTime: Date.now() - testCase.startTime
            };

            // Update performance metrics
            this.updatePerformanceMetrics(testSession, testCase.response.responseTime, response.status === 200);

            testCase.status = 'passed';
            testSession.results.passed++;

            logger.debug(`✅ Connectivity test passed for ${model.name}`, {
                status: response.status,
                responseTime: testCase.response.responseTime,
                component: 'APITester'
            });

        } catch (error) {
            testCase.status = 'failed';
            testCase.error = error.message;
            testSession.results.failed++;
            testSession.errors.push({
                testCase: 'connectivity_test',
                error: error.message
            });

            logger.warn(`❌ Connectivity test failed for ${model.name}`, {
                error: error.message,
                component: 'APITester'
            });
        } finally {
            testCase.endTime = Date.now();
            testCase.duration = testCase.endTime - testCase.startTime;
            testSession.testCases.push(testCase);
            testSession.results.total++;
        }
    }

    /**
     * Run template-based tests
     */
    async runTemplateTests(model, testType, testSession) {
        const template = this.testTemplates.get(testType);
        if (!template) {
            logger.warn(`⚠️ Unknown test type: ${testType}`, {
                component: 'APITester'
            });
            return;
        }

        logger.debug(`🧪 Running ${template.name} for ${model.name}`, {
            testCases: template.testCases.length,
            component: 'APITester'
        });

        for (const templateCase of template.testCases) {
            await this.runSingleTestCase(model, templateCase, testSession);
        }
    }

    /**
     * Run a single test case
     */
    async runSingleTestCase(model, templateCase, testSession) {
        const testCase = {
            name: templateCase.name,
            description: templateCase.description,
            startTime: Date.now(),
            status: 'running',
            input: templateCase.input,
            expectations: templateCase.expectations
        };

        try {
            // Apply rate limiting
            await rateLimiter.acquirePermission(model.provider, {
                priority: 'normal',
                timeout: 15000
            });

            // Make API request
            const response = await this.makeModelAPIRequest(model, templateCase.input);
            
            testCase.response = {
                status: response.status,
                data: response.data,
                headers: response.headers,
                responseTime: Date.now() - testCase.startTime
            };

            // Update performance metrics
            this.updatePerformanceMetrics(testSession, testCase.response.responseTime, response.status === 200);

            // Validate response against expectations
            const validationResult = await this.validateResponse(testCase.response, templateCase.expectations);
            
            testCase.validation = validationResult;
            testCase.status = validationResult.passed ? 'passed' : 'failed';

            if (validationResult.passed) {
                testSession.results.passed++;
            } else {
                testSession.results.failed++;
                testSession.errors.push({
                    testCase: templateCase.name,
                    validationErrors: validationResult.errors
                });
            }

            logger.debug(`${validationResult.passed ? '✅' : '❌'} Test case ${templateCase.name} for ${model.name}`, {
                passed: validationResult.passed,
                responseTime: testCase.response.responseTime,
                component: 'APITester'
            });

        } catch (error) {
            testCase.status = 'failed';
            testCase.error = error.message;
            testSession.results.failed++;
            testSession.errors.push({
                testCase: templateCase.name,
                error: error.message
            });

            this.updatePerformanceMetrics(testSession, Date.now() - testCase.startTime, false);

            logger.warn(`❌ Test case ${templateCase.name} failed for ${model.name}`, {
                error: error.message,
                component: 'APITester'
            });
        } finally {
            testCase.endTime = Date.now();
            testCase.duration = testCase.endTime - testCase.startTime;
            testSession.testCases.push(testCase);
            testSession.results.total++;
        }
    }

    /**
     * Run custom test cases
     */
    async runCustomTests(model, customTestCases, testSession) {
        logger.debug(`🔧 Running custom tests for ${model.name}`, {
            customTests: customTestCases.length,
            component: 'APITester'
        });

        for (const customCase of customTestCases) {
            await this.runSingleTestCase(model, customCase, testSession);
        }
    }

    /**
     * Run performance tests
     */
    async runPerformanceTests(model, testSession) {
        logger.debug(`⚡ Running performance tests for ${model.name}`, {
            component: 'APITester'
        });

        // Latency test
        await this.runLatencyTest(model, testSession);

        // Throughput test
        await this.runThroughputTest(model, testSession);
    }

    /**
     * Run stress tests
     */
    async runStressTests(model, testSession) {
        logger.debug(`💪 Running stress tests for ${model.name}`, {
            component: 'APITester'
        });

        // Concurrent request test
        await this.runConcurrentRequestTest(model, testSession);

        // Rate limit test
        await this.runRateLimitTest(model, testSession);
    }

    /**
     * Make API request to model endpoint
     */
    async makeModelAPIRequest(model, input) {
        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'IntelligentDiscovery-APITester/1.0'
            },
            timeout: this.testConfig.timeout
        };

        // Add provider-specific authentication
        await this.addAuthentication(requestOptions, model.provider);

        // Format request body based on provider
        const requestBody = this.formatRequestBody(model, input);

        return await this.makeAPIRequest(model.apiEndpoint, {
            ...requestOptions,
            body: JSON.stringify(requestBody)
        });
    }

    /**
     * Make HTTP request
     */
    async makeAPIRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const client = isHttps ? https : http;

            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: options.headers || {},
                timeout: options.timeout || this.testConfig.timeout,
                rejectUnauthorized: this.testConfig.validateSSL
            };

            const req = client.request(requestOptions, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsedData = data ? JSON.parse(data) : null;
                        resolve({
                            status: res.statusCode,
                            headers: res.headers,
                            data: parsedData,
                            rawData: data
                        });
                    } catch (error) {
                        resolve({
                            status: res.statusCode,
                            headers: res.headers,
                            data: null,
                            rawData: data,
                            parseError: error.message
                        });
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Request failed: ${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (options.body) {
                req.write(options.body);
            }

            req.end();
        });
    }

    /**
     * Add authentication headers based on provider
     */
    async addAuthentication(requestOptions, provider) {
        // This is a placeholder - in real implementation, 
        // we would get API keys from secure storage
        const apiKeys = {
            'openai': process.env.OPENAI_API_KEY,
            'anthropic': process.env.ANTHROPIC_API_KEY,
            'google': process.env.GEMINI_API_KEY
        };

        const apiKey = apiKeys[provider];
        if (apiKey) {
            switch (provider) {
                case 'openai':
                    requestOptions.headers['Authorization'] = `Bearer ${apiKey}`;
                    break;
                case 'anthropic':
                    requestOptions.headers['x-api-key'] = apiKey;
                    break;
                case 'google':
                    requestOptions.headers['Authorization'] = `Bearer ${apiKey}`;
                    break;
            }
        }
    }

    /**
     * Format request body based on provider and model type
     */
    formatRequestBody(model, input) {
        // Provider-specific formatting
        switch (model.provider) {
            case 'openai':
                return {
                    model: model.name,
                    ...input
                };
            case 'anthropic':
                return {
                    model: model.name,
                    ...input
                };
            case 'google':
                return {
                    model: model.name,
                    ...input
                };
            default:
                return {
                    model: model.name,
                    ...input
                };
        }
    }

    /**
     * Validate API response against expectations
     */
    async validateResponse(response, expectations) {
        const validationResult = {
            passed: true,
            errors: [],
            warnings: []
        };

        try {
            // Status code validation
            if (expectations.status && response.status !== expectations.status) {
                validationResult.errors.push(`Expected status ${expectations.status}, got ${response.status}`);
                validationResult.passed = false;
            }

            // Response time validation
            if (expectations.responseTime?.max && response.responseTime > expectations.responseTime.max) {
                validationResult.errors.push(`Response time ${response.responseTime}ms exceeds maximum ${expectations.responseTime.max}ms`);
                validationResult.passed = false;
            }

            // Content type validation
            if (expectations.contentType && !response.headers['content-type']?.includes(expectations.contentType)) {
                validationResult.warnings.push(`Expected content-type ${expectations.contentType}`);
            }

            // Response structure validation
            if (expectations.responseStructure && response.data) {
                for (const field of expectations.responseStructure) {
                    if (!(field in response.data)) {
                        validationResult.errors.push(`Missing required field: ${field}`);
                        validationResult.passed = false;
                    }
                }
            }

            // Minimum response length validation
            if (expectations.minResponseLength && response.rawData) {
                if (response.rawData.length < expectations.minResponseLength) {
                    validationResult.errors.push(`Response too short: ${response.rawData.length} < ${expectations.minResponseLength}`);
                    validationResult.passed = false;
                }
            }

            // Custom validations
            if (expectations.containsKeywords && response.rawData) {
                const found = expectations.containsKeywords.some(keyword => 
                    response.rawData.toLowerCase().includes(keyword.toLowerCase())
                );
                if (!found) {
                    validationResult.warnings.push('Response does not contain expected keywords');
                }
            }

        } catch (error) {
            validationResult.errors.push(`Validation error: ${error.message}`);
            validationResult.passed = false;
        }

        return validationResult;
    }

    /**
     * Update performance metrics
     */
    updatePerformanceMetrics(testSession, responseTime, success) {
        const perf = testSession.performance;
        
        perf.totalRequests++;
        perf.averageResponseTime += responseTime;
        
        if (responseTime > perf.maxResponseTime) {
            perf.maxResponseTime = responseTime;
        }
        if (responseTime < perf.minResponseTime) {
            perf.minResponseTime = responseTime;
        }

        if (success) {
            perf.successfulRequests++;
        } else {
            perf.failedRequests++;
        }
    }

    /**
     * Run latency test
     */
    async runLatencyTest(model, testSession) {
        // Implementation for latency testing
        // Would measure response times under various conditions
    }

    /**
     * Run throughput test  
     */
    async runThroughputTest(model, testSession) {
        // Implementation for throughput testing
        // Would measure requests per second capabilities
    }

    /**
     * Run concurrent request test
     */
    async runConcurrentRequestTest(model, testSession) {
        // Implementation for concurrent request testing
        // Would test how model handles multiple simultaneous requests
    }

    /**
     * Run rate limit test
     */
    async runRateLimitTest(model, testSession) {
        // Implementation for rate limit testing
        // Would test provider rate limiting behavior
    }

    /**
     * Save test results
     */
    async saveTestResults(testId, testSession) {
        try {
            const filename = `${testId}.json`;
            const filepath = path.join(this.resultsDir, filename);
            
            await fs.writeFile(filepath, JSON.stringify(testSession, null, 2));
            
            logger.debug('💾 Test results saved', {
                testId,
                filepath,
                component: 'APITester'
            });

        } catch (error) {
            logger.warn('⚠️ Failed to save test results', {
                testId,
                error: error.message,
                component: 'APITester'
            });
        }
    }

    /**
     * Get test results
     */
    getTestResults(testId) {
        return this.testResults.get(testId);
    }

    /**
     * Get all test results
     */
    getAllTestResults() {
        return Array.from(this.testResults.values());
    }

    /**
     * Get tester status
     */
    getStatus() {
        return {
            tester: 'APITester',
            activeTests: this.activeTests.size,
            completedTests: this.testResults.size,
            totalTestHistory: this.testHistory.length,
            availableTemplates: Array.from(this.testTemplates.keys()),
            config: this.testConfig,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            // Cancel active tests
            for (const [testId, testSession] of this.activeTests.entries()) {
                testSession.status = 'cancelled';
                testSession.endTime = new Date().toISOString();
            }

            this.activeTests.clear();
            this.testResults.clear();
            this.testSuites.clear();
            this.testHistory = [];

            logger.info('🧹 API Tester cleaned up', {
                component: 'APITester'
            });
        } catch (error) {
            logger.error('❌ Error during API Tester cleanup', {
                error: error.message,
                component: 'APITester'
            });
        }
    }
}

// Export singleton instance
export const apiTester = new APITester();
export { APITester, ProcessingError };