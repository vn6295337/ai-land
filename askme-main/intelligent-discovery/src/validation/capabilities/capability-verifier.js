/**
 * Automated Capability Verification
 * Module 5, Step 25: Create automated capability verification
 * 
 * Features:
 * - Automated testing of claimed model capabilities
 * - Capability-specific test scenarios
 * - Performance and accuracy benchmarking
 * - Capability validation scoring
 * - Comprehensive capability reporting
 */

import { logger } from '../../core/infrastructure/logger.js';
import { config } from '../../core/infrastructure/config.js';
import { apiTester } from '../testing/api-tester.js';
import { embeddingsManager } from '../../core/storage/embeddings.js';
import { ProcessingError } from '../../core/infrastructure/errors.js';
import fs from 'fs/promises';
import path from 'path';

class CapabilityVerifier {
    constructor() {
        this.verificationResults = new Map();
        this.capabilityTests = new Map();
        this.verificationHistory = [];
        this.benchmarkData = new Map();
        this.capabilityScores = new Map();
        this.resultsDir = path.join('data', 'capability_verification');
        
        this.setupCapabilityTests();
        this.setupBenchmarkCriteria();
    }

    /**
     * Set up capability-specific test scenarios
     */
    setupCapabilityTests() {
        // Text Generation Capabilities
        this.capabilityTests.set('text-generation', {
            name: 'Text Generation Verification',
            description: 'Verify text generation capabilities',
            testScenarios: [
                {
                    name: 'creative_writing',
                    description: 'Test creative writing ability',
                    prompts: [
                        'Write a short poem about artificial intelligence',
                        'Create a story about a robot learning emotions',
                        'Describe a futuristic city in 100 words'
                    ],
                    evaluationCriteria: {
                        creativity: { weight: 0.4, minScore: 0.6 },
                        coherence: { weight: 0.3, minScore: 0.7 },
                        fluency: { weight: 0.3, minScore: 0.8 }
                    }
                },
                {
                    name: 'factual_writing',
                    description: 'Test factual and informative writing',
                    prompts: [
                        'Explain the process of photosynthesis',
                        'Describe the benefits of renewable energy',
                        'What are the key features of machine learning?'
                    ],
                    evaluationCriteria: {
                        accuracy: { weight: 0.5, minScore: 0.8 },
                        completeness: { weight: 0.3, minScore: 0.7 },
                        clarity: { weight: 0.2, minScore: 0.7 }
                    }
                },
                {
                    name: 'instruction_following',
                    description: 'Test ability to follow specific instructions',
                    prompts: [
                        'List exactly 5 advantages of cloud computing in bullet points',
                        'Write a haiku about technology',
                        'Summarize the following in one sentence: [context]'
                    ],
                    evaluationCriteria: {
                        instruction_adherence: { weight: 0.6, minScore: 0.8 },
                        format_compliance: { weight: 0.4, minScore: 0.9 }
                    }
                }
            ]
        });

        // Conversation Capabilities
        this.capabilityTests.set('conversation', {
            name: 'Conversation Verification',
            description: 'Verify conversational capabilities',
            testScenarios: [
                {
                    name: 'context_retention',
                    description: 'Test ability to maintain context across turns',
                    conversations: [
                        [
                            { role: 'user', content: 'My name is Alice and I work as a software engineer.' },
                            { role: 'user', content: 'What is my profession?' },
                            { role: 'user', content: 'What should I call you?' }
                        ]
                    ],
                    evaluationCriteria: {
                        context_awareness: { weight: 0.5, minScore: 0.8 },
                        memory_accuracy: { weight: 0.3, minScore: 0.9 },
                        natural_flow: { weight: 0.2, minScore: 0.7 }
                    }
                },
                {
                    name: 'persona_consistency',
                    description: 'Test consistency in maintaining persona',
                    systemPrompts: [
                        'You are a helpful assistant specialized in cooking.',
                        'You are a technical support representative.',
                        'You are a creative writing tutor.'
                    ],
                    evaluationCriteria: {
                        role_adherence: { weight: 0.6, minScore: 0.8 },
                        knowledge_relevance: { weight: 0.4, minScore: 0.7 }
                    }
                }
            ]
        });

        // Reasoning Capabilities
        this.capabilityTests.set('reasoning', {
            name: 'Reasoning Verification',
            description: 'Verify logical reasoning capabilities',
            testScenarios: [
                {
                    name: 'logical_reasoning',
                    description: 'Test logical deduction abilities',
                    problems: [
                        {
                            prompt: 'All birds can fly. Penguins are birds. Can penguins fly?',
                            expected_reasoning: 'identify logical inconsistency',
                            correct_answer: 'No, this is a logical fallacy'
                        },
                        {
                            prompt: 'If A > B and B > C, what is the relationship between A and C?',
                            expected_reasoning: 'transitive property',
                            correct_answer: 'A > C'
                        }
                    ],
                    evaluationCriteria: {
                        logical_accuracy: { weight: 0.6, minScore: 0.8 },
                        reasoning_clarity: { weight: 0.4, minScore: 0.7 }
                    }
                },
                {
                    name: 'mathematical_reasoning',
                    description: 'Test mathematical problem solving',
                    problems: [
                        {
                            prompt: 'If a train travels 120 km in 2 hours, what is its average speed?',
                            correct_answer: '60 km/h',
                            requires_calculation: true
                        },
                        {
                            prompt: 'What is 15% of 240?',
                            correct_answer: '36',
                            requires_calculation: true
                        }
                    ],
                    evaluationCriteria: {
                        calculation_accuracy: { weight: 0.7, minScore: 0.9 },
                        method_explanation: { weight: 0.3, minScore: 0.6 }
                    }
                }
            ]
        });

        // Code Generation Capabilities
        this.capabilityTests.set('code-generation', {
            name: 'Code Generation Verification',
            description: 'Verify programming and code generation capabilities',
            testScenarios: [
                {
                    name: 'basic_programming',
                    description: 'Test basic programming tasks',
                    tasks: [
                        {
                            prompt: 'Write a Python function to calculate factorial of a number',
                            language: 'python',
                            expected_features: ['def', 'factorial', 'recursive or iterative'],
                            test_cases: [
                                { input: 5, expected_output: 120 },
                                { input: 0, expected_output: 1 }
                            ]
                        },
                        {
                            prompt: 'Create a JavaScript function to reverse a string',
                            language: 'javascript',
                            expected_features: ['function', 'reverse', 'string manipulation']
                        }
                    ],
                    evaluationCriteria: {
                        syntax_correctness: { weight: 0.4, minScore: 0.9 },
                        functionality: { weight: 0.4, minScore: 0.8 },
                        code_quality: { weight: 0.2, minScore: 0.6 }
                    }
                },
                {
                    name: 'algorithm_implementation',
                    description: 'Test algorithm implementation abilities',
                    tasks: [
                        {
                            prompt: 'Implement binary search algorithm',
                            complexity_requirement: 'O(log n)',
                            expected_features: ['binary search', 'sorted array', 'divide and conquer']
                        }
                    ],
                    evaluationCriteria: {
                        algorithm_correctness: { weight: 0.5, minScore: 0.8 },
                        efficiency: { weight: 0.3, minScore: 0.7 },
                        code_clarity: { weight: 0.2, minScore: 0.6 }
                    }
                }
            ]
        });

        // Function Calling Capabilities
        this.capabilityTests.set('function-calling', {
            name: 'Function Calling Verification',
            description: 'Verify function calling and tool usage capabilities',
            testScenarios: [
                {
                    name: 'function_detection',
                    description: 'Test ability to detect when functions are needed',
                    scenarios: [
                        {
                            prompt: 'What is the current weather in New York?',
                            available_functions: ['get_weather'],
                            expected_behavior: 'call get_weather function'
                        },
                        {
                            prompt: 'Calculate 15 * 23 + 45',
                            available_functions: ['calculator'],
                            expected_behavior: 'call calculator function'
                        }
                    ],
                    evaluationCriteria: {
                        function_identification: { weight: 0.5, minScore: 0.8 },
                        parameter_accuracy: { weight: 0.5, minScore: 0.9 }
                    }
                }
            ]
        });

        // Multimodal Capabilities
        this.capabilityTests.set('multimodal', {
            name: 'Multimodal Verification',
            description: 'Verify multimodal understanding capabilities',
            testScenarios: [
                {
                    name: 'image_understanding',
                    description: 'Test image analysis and description',
                    tasks: [
                        {
                            type: 'image_description',
                            prompt: 'Describe what you see in this image',
                            evaluation_aspects: ['object_detection', 'scene_understanding', 'detail_accuracy']
                        },
                        {
                            type: 'image_qa',
                            prompt: 'Answer questions about the image content',
                            evaluation_aspects: ['visual_reasoning', 'accuracy', 'comprehension']
                        }
                    ],
                    evaluationCriteria: {
                        visual_accuracy: { weight: 0.4, minScore: 0.7 },
                        description_quality: { weight: 0.3, minScore: 0.6 },
                        detail_recognition: { weight: 0.3, minScore: 0.6 }
                    }
                }
            ]
        });

        logger.info('🧪 Capability tests configured', {
            capabilities: Array.from(this.capabilityTests.keys()),
            component: 'CapabilityVerifier'
        });
    }

    /**
     * Set up benchmark criteria for capability scoring
     */
    setupBenchmarkCriteria() {
        this.benchmarkData.set('performance_thresholds', {
            response_time: {
                excellent: 2000,    // < 2s
                good: 5000,         // < 5s  
                acceptable: 10000,  // < 10s
                poor: Infinity      // >= 10s
            },
            accuracy_scores: {
                excellent: 0.9,     // >= 90%
                good: 0.8,          // >= 80%
                acceptable: 0.7,    // >= 70%
                poor: 0.0           // < 70%
            },
            capability_weights: {
                'text-generation': 1.0,
                'conversation': 0.9,
                'reasoning': 1.2,
                'code-generation': 1.1,
                'function-calling': 0.8,
                'multimodal': 1.3
            }
        });

        logger.info('📊 Benchmark criteria configured', {
            component: 'CapabilityVerifier'
        });
    }

    /**
     * Initialize the capability verifier
     */
    async initialize() {
        try {
            logger.info('🚀 Initializing Capability Verifier...', {
                component: 'CapabilityVerifier'
            });

            // Ensure results directory exists
            await fs.mkdir(this.resultsDir, { recursive: true });

            logger.info('✅ Capability Verifier initialized', {
                capabilities: this.capabilityTests.size,
                component: 'CapabilityVerifier'
            });

            return {
                verifier: 'CapabilityVerifier',
                initialized: true,
                availableCapabilities: Array.from(this.capabilityTests.keys())
            };
        } catch (error) {
            logger.error('❌ Failed to initialize Capability Verifier', {
                error: error.message,
                component: 'CapabilityVerifier'
            });
            throw new ProcessingError(`Capability verifier initialization failed: ${error.message}`);
        }
    }

    /**
     * Verify capabilities of a single model
     */
    async verifyModelCapabilities(model, options = {}) {
        try {
            const {
                capabilities = model.capabilities || [],
                includePerformanceMetrics = true,
                generateDetailedReport = true,
                strictValidation = false
            } = options;

            logger.info(`🔍 Starting capability verification: ${model.name}`, {
                modelId: model.id,
                provider: model.provider,
                capabilities: capabilities.length,
                component: 'CapabilityVerifier'
            });

            const verificationId = `verification_${model.id}_${Date.now()}`;
            const startTime = Date.now();

            // Initialize verification session
            const verificationSession = {
                verificationId,
                modelId: model.id,
                modelName: model.name,
                provider: model.provider,
                startTime: new Date().toISOString(),
                claimedCapabilities: capabilities,
                verificationResults: new Map(),
                overallScore: 0,
                status: 'running',
                summary: {
                    verified: 0,
                    failed: 0,
                    partially_verified: 0,
                    total: capabilities.length
                },
                performance: {
                    totalTests: 0,
                    averageResponseTime: 0,
                    successfulTests: 0,
                    failedTests: 0
                },
                errors: [],
                warnings: []
            };

            try {
                // Verify each claimed capability
                for (const capability of capabilities) {
                    await this.verifyCapability(model, capability, verificationSession, options);
                }

                // Calculate overall score
                verificationSession.overallScore = this.calculateOverallScore(verificationSession);

                // Generate performance summary
                if (includePerformanceMetrics) {
                    await this.generatePerformanceSummary(verificationSession);
                }

                // Generate detailed report
                if (generateDetailedReport) {
                    verificationSession.detailedReport = await this.generateDetailedReport(verificationSession);
                }

                verificationSession.status = 'completed';
                verificationSession.endTime = new Date().toISOString();
                verificationSession.duration = Date.now() - startTime;

                // Save results
                await this.saveVerificationResults(verificationId, verificationSession);
                this.verificationResults.set(verificationId, verificationSession);
                this.verificationHistory.push(verificationSession);

                logger.info(`✅ Capability verification completed: ${model.name}`, {
                    verificationId,
                    overallScore: verificationSession.overallScore.toFixed(2),
                    verified: verificationSession.summary.verified,
                    failed: verificationSession.summary.failed,
                    duration: `${verificationSession.duration}ms`,
                    component: 'CapabilityVerifier'
                });

                return verificationSession;

            } catch (error) {
                verificationSession.status = 'failed';
                verificationSession.error = error.message;
                verificationSession.endTime = new Date().toISOString();
                verificationSession.duration = Date.now() - startTime;

                logger.error(`❌ Capability verification failed: ${model.name}`, {
                    verificationId,
                    error: error.message,
                    component: 'CapabilityVerifier'
                });

                return verificationSession;
            }

        } catch (error) {
            logger.error('❌ Model capability verification failed', {
                modelId: model.id,
                error: error.message,
                component: 'CapabilityVerifier'
            });
            throw new ProcessingError(`Model capability verification failed: ${error.message}`);
        }
    }

    /**
     * Verify a specific capability
     */
    async verifyCapability(model, capability, verificationSession, options) {
        try {
            logger.debug(`🧪 Verifying capability: ${capability} for ${model.name}`, {
                component: 'CapabilityVerifier'
            });

            const capabilityTest = this.capabilityTests.get(capability);
            if (!capabilityTest) {
                logger.warn(`⚠️ No test available for capability: ${capability}`, {
                    component: 'CapabilityVerifier'
                });

                verificationSession.verificationResults.set(capability, {
                    capability,
                    status: 'skipped',
                    reason: 'No test available',
                    score: 0
                });
                return;
            }

            const capabilityResult = {
                capability,
                testName: capabilityTest.name,
                status: 'running',
                startTime: Date.now(),
                scenarioResults: [],
                overallScore: 0,
                metrics: {
                    totalScenarios: capabilityTest.testScenarios.length,
                    passedScenarios: 0,
                    failedScenarios: 0,
                    averageScore: 0
                }
            };

            // Run test scenarios for this capability
            for (const scenario of capabilityTest.testScenarios) {
                const scenarioResult = await this.runTestScenario(model, capability, scenario, options);
                capabilityResult.scenarioResults.push(scenarioResult);

                if (scenarioResult.passed) {
                    capabilityResult.metrics.passedScenarios++;
                } else {
                    capabilityResult.metrics.failedScenarios++;
                }

                // Update verification session performance metrics
                verificationSession.performance.totalTests++;
                if (scenarioResult.passed) {
                    verificationSession.performance.successfulTests++;
                } else {
                    verificationSession.performance.failedTests++;
                }
                verificationSession.performance.averageResponseTime += scenarioResult.responseTime || 0;
            }

            // Calculate capability score
            capabilityResult.overallScore = this.calculateCapabilityScore(capabilityResult);
            capabilityResult.metrics.averageScore = capabilityResult.overallScore;

            // Determine verification status
            const thresholds = this.benchmarkData.get('performance_thresholds');
            if (capabilityResult.overallScore >= thresholds.accuracy_scores.good) {
                capabilityResult.status = 'verified';
                verificationSession.summary.verified++;
            } else if (capabilityResult.overallScore >= thresholds.accuracy_scores.acceptable) {
                capabilityResult.status = 'partially_verified';
                verificationSession.summary.partially_verified++;
            } else {
                capabilityResult.status = 'failed';
                verificationSession.summary.failed++;
            }

            capabilityResult.endTime = Date.now();
            capabilityResult.duration = capabilityResult.endTime - capabilityResult.startTime;

            verificationSession.verificationResults.set(capability, capabilityResult);

            logger.debug(`${capabilityResult.status === 'verified' ? '✅' : '❌'} Capability ${capability} verification: ${capabilityResult.status}`, {
                score: capabilityResult.overallScore.toFixed(2),
                passedScenarios: capabilityResult.metrics.passedScenarios,
                totalScenarios: capabilityResult.metrics.totalScenarios,
                component: 'CapabilityVerifier'
            });

        } catch (error) {
            logger.error(`❌ Failed to verify capability: ${capability}`, {
                modelId: model.id,
                error: error.message,
                component: 'CapabilityVerifier'
            });

            verificationSession.verificationResults.set(capability, {
                capability,
                status: 'error',
                error: error.message,
                score: 0
            });

            verificationSession.errors.push({
                capability,
                error: error.message
            });
        }
    }

    /**
     * Run a test scenario for a capability
     */
    async runTestScenario(model, capability, scenario, options) {
        try {
            const scenarioResult = {
                name: scenario.name,
                description: scenario.description,
                startTime: Date.now(),
                status: 'running',
                testResults: [],
                passed: false,
                score: 0,
                metrics: {}
            };

            logger.debug(`🎯 Running scenario: ${scenario.name}`, {
                capability,
                component: 'CapabilityVerifier'
            });

            // Execute scenario based on capability type
            switch (capability) {
                case 'text-generation':
                    await this.runTextGenerationScenario(model, scenario, scenarioResult);
                    break;
                case 'conversation':
                    await this.runConversationScenario(model, scenario, scenarioResult);
                    break;
                case 'reasoning':
                    await this.runReasoningScenario(model, scenario, scenarioResult);
                    break;
                case 'code-generation':
                    await this.runCodeGenerationScenario(model, scenario, scenarioResult);
                    break;
                case 'function-calling':
                    await this.runFunctionCallingScenario(model, scenario, scenarioResult);
                    break;
                case 'multimodal':
                    await this.runMultimodalScenario(model, scenario, scenarioResult);
                    break;
                default:
                    throw new Error(`Unknown capability type: ${capability}`);
            }

            // Evaluate scenario results
            scenarioResult.score = this.evaluateScenarioResults(scenario, scenarioResult);
            scenarioResult.passed = scenarioResult.score >= 0.7; // 70% threshold
            scenarioResult.status = scenarioResult.passed ? 'passed' : 'failed';
            scenarioResult.endTime = Date.now();
            scenarioResult.responseTime = scenarioResult.endTime - scenarioResult.startTime;

            return scenarioResult;

        } catch (error) {
            logger.error(`❌ Test scenario failed: ${scenario.name}`, {
                capability,
                error: error.message,
                component: 'CapabilityVerifier'
            });

            return {
                name: scenario.name,
                status: 'error',
                error: error.message,
                passed: false,
                score: 0,
                responseTime: Date.now() - Date.now()
            };
        }
    }

    /**
     * Run text generation scenario
     */
    async runTextGenerationScenario(model, scenario, scenarioResult) {
        for (const prompt of scenario.prompts) {
            try {
                // Create custom test case for API tester
                const testCase = {
                    name: `text_gen_${Date.now()}`,
                    description: scenario.description,
                    input: {
                        prompt: prompt,
                        max_tokens: 200,
                        temperature: 0.7
                    },
                    expectations: {
                        status: 200,
                        responseTime: { max: 15000 },
                        minResponseLength: 50
                    }
                };

                // Execute test using API tester
                const testResult = await apiTester.testModel(model, {
                    testTypes: [],
                    customTestCases: [testCase]
                });

                const apiResult = testResult.testCases[0];
                
                scenarioResult.testResults.push({
                    prompt,
                    response: apiResult.response?.data,
                    responseTime: apiResult.duration,
                    success: apiResult.status === 'passed',
                    error: apiResult.error
                });

            } catch (error) {
                scenarioResult.testResults.push({
                    prompt,
                    error: error.message,
                    success: false
                });
            }
        }
    }

    /**
     * Run conversation scenario
     */
    async runConversationScenario(model, scenario, scenarioResult) {
        if (scenario.conversations) {
            for (const conversation of scenario.conversations) {
                try {
                    const testCase = {
                        name: `conversation_${Date.now()}`,
                        description: scenario.description,
                        input: {
                            messages: conversation
                        },
                        expectations: {
                            status: 200,
                            responseTime: { max: 10000 }
                        }
                    };

                    const testResult = await apiTester.testModel(model, {
                        testTypes: [],
                        customTestCases: [testCase]
                    });

                    const apiResult = testResult.testCases[0];
                    
                    scenarioResult.testResults.push({
                        conversation,
                        response: apiResult.response?.data,
                        responseTime: apiResult.duration,
                        success: apiResult.status === 'passed',
                        error: apiResult.error
                    });

                } catch (error) {
                    scenarioResult.testResults.push({
                        conversation,
                        error: error.message,
                        success: false
                    });
                }
            }
        }
    }

    /**
     * Run reasoning scenario
     */
    async runReasoningScenario(model, scenario, scenarioResult) {
        for (const problem of scenario.problems) {
            try {
                const testCase = {
                    name: `reasoning_${Date.now()}`,
                    description: scenario.description,
                    input: {
                        prompt: problem.prompt,
                        max_tokens: 150
                    },
                    expectations: {
                        status: 200,
                        responseTime: { max: 10000 }
                    }
                };

                const testResult = await apiTester.testModel(model, {
                    testTypes: [],
                    customTestCases: [testCase]
                });

                const apiResult = testResult.testCases[0];
                
                // Evaluate reasoning quality
                const reasoningEvaluation = this.evaluateReasoning(
                    apiResult.response?.data,
                    problem.correct_answer,
                    problem.expected_reasoning
                );

                scenarioResult.testResults.push({
                    problem: problem.prompt,
                    response: apiResult.response?.data,
                    expectedAnswer: problem.correct_answer,
                    responseTime: apiResult.duration,
                    success: apiResult.status === 'passed',
                    reasoningEvaluation,
                    error: apiResult.error
                });

            } catch (error) {
                scenarioResult.testResults.push({
                    problem: problem.prompt,
                    error: error.message,
                    success: false
                });
            }
        }
    }

    /**
     * Run code generation scenario
     */
    async runCodeGenerationScenario(model, scenario, scenarioResult) {
        for (const task of scenario.tasks) {
            try {
                const testCase = {
                    name: `code_gen_${Date.now()}`,
                    description: scenario.description,
                    input: {
                        prompt: task.prompt,
                        max_tokens: 300
                    },
                    expectations: {
                        status: 200,
                        responseTime: { max: 15000 }
                    }
                };

                const testResult = await apiTester.testModel(model, {
                    testTypes: [],
                    customTestCases: [testCase]
                });

                const apiResult = testResult.testCases[0];
                
                // Evaluate code quality
                const codeEvaluation = this.evaluateGeneratedCode(
                    apiResult.response?.data,
                    task.language,
                    task.expected_features,
                    task.test_cases
                );

                scenarioResult.testResults.push({
                    task: task.prompt,
                    response: apiResult.response?.data,
                    language: task.language,
                    responseTime: apiResult.duration,
                    success: apiResult.status === 'passed',
                    codeEvaluation,
                    error: apiResult.error
                });

            } catch (error) {
                scenarioResult.testResults.push({
                    task: task.prompt,
                    error: error.message,
                    success: false
                });
            }
        }
    }

    /**
     * Run function calling scenario
     */
    async runFunctionCallingScenario(model, scenario, scenarioResult) {
        for (const testScenario of scenario.scenarios) {
            try {
                const testCase = {
                    name: `function_call_${Date.now()}`,
                    description: scenario.description,
                    input: {
                        messages: [
                            { role: 'user', content: testScenario.prompt }
                        ],
                        functions: testScenario.available_functions?.map(name => ({
                            name,
                            description: `${name} function`,
                            parameters: { type: 'object', properties: {} }
                        }))
                    },
                    expectations: {
                        status: 200,
                        responseTime: { max: 10000 }
                    }
                };

                const testResult = await apiTester.testModel(model, {
                    testTypes: [],
                    customTestCases: [testCase]
                });

                const apiResult = testResult.testCases[0];
                
                // Evaluate function calling behavior
                const functionEvaluation = this.evaluateFunctionCalling(
                    apiResult.response?.data,
                    testScenario.expected_behavior
                );

                scenarioResult.testResults.push({
                    scenario: testScenario.prompt,
                    response: apiResult.response?.data,
                    expectedBehavior: testScenario.expected_behavior,
                    responseTime: apiResult.duration,
                    success: apiResult.status === 'passed',
                    functionEvaluation,
                    error: apiResult.error
                });

            } catch (error) {
                scenarioResult.testResults.push({
                    scenario: testScenario.prompt,
                    error: error.message,
                    success: false
                });
            }
        }
    }

    /**
     * Run multimodal scenario
     */
    async runMultimodalScenario(model, scenario, scenarioResult) {
        // Placeholder for multimodal testing
        // In real implementation, this would handle image/audio inputs
        scenarioResult.testResults.push({
            note: 'Multimodal testing requires additional implementation',
            success: false
        });
    }

    /**
     * Evaluate scenario results based on criteria
     */
    evaluateScenarioResults(scenario, scenarioResult) {
        if (!scenario.evaluationCriteria) {
            return scenarioResult.testResults.length > 0 ? 0.5 : 0;
        }

        let totalScore = 0;
        let totalWeight = 0;

        for (const [criterion, config] of Object.entries(scenario.evaluationCriteria)) {
            const weight = config.weight || 1;
            let criterionScore = 0;

            // Calculate criterion score based on test results
            switch (criterion) {
                case 'accuracy':
                case 'logical_accuracy':
                case 'calculation_accuracy':
                    criterionScore = this.calculateAccuracyScore(scenarioResult.testResults);
                    break;
                case 'creativity':
                    criterionScore = this.calculateCreativityScore(scenarioResult.testResults);
                    break;
                case 'coherence':
                case 'fluency':
                case 'clarity':
                    criterionScore = this.calculateQualityScore(scenarioResult.testResults);
                    break;
                case 'instruction_adherence':
                case 'format_compliance':
                    criterionScore = this.calculateComplianceScore(scenarioResult.testResults);
                    break;
                default:
                    criterionScore = scenarioResult.testResults.filter(r => r.success).length / scenarioResult.testResults.length;
            }

            totalScore += criterionScore * weight;
            totalWeight += weight;
        }

        return totalWeight > 0 ? totalScore / totalWeight : 0;
    }

    /**
     * Calculate capability score
     */
    calculateCapabilityScore(capabilityResult) {
        if (capabilityResult.scenarioResults.length === 0) {
            return 0;
        }

        const scenarioScores = capabilityResult.scenarioResults.map(result => result.score);
        const averageScore = scenarioScores.reduce((sum, score) => sum + score, 0) / scenarioScores.length;

        // Apply capability weight
        const weights = this.benchmarkData.get('performance_thresholds').capability_weights;
        const weight = weights[capabilityResult.capability] || 1.0;

        return averageScore * weight;
    }

    /**
     * Calculate overall score for all capabilities
     */
    calculateOverallScore(verificationSession) {
        const capabilityResults = Array.from(verificationSession.verificationResults.values());
        if (capabilityResults.length === 0) {
            return 0;
        }

        const totalScore = capabilityResults.reduce((sum, result) => sum + (result.overallScore || 0), 0);
        return totalScore / capabilityResults.length;
    }

    // Evaluation helper methods
    calculateAccuracyScore(testResults) {
        const successfulTests = testResults.filter(r => r.success).length;
        return testResults.length > 0 ? successfulTests / testResults.length : 0;
    }

    calculateCreativityScore(testResults) {
        // Simplified creativity scoring based on response length and diversity
        let totalCreativity = 0;
        for (const result of testResults) {
            if (result.response && typeof result.response === 'string') {
                const length = result.response.length;
                const uniqueWords = new Set(result.response.toLowerCase().split(/\s+/)).size;
                totalCreativity += Math.min(1, (length / 100) * (uniqueWords / 50));
            }
        }
        return testResults.length > 0 ? totalCreativity / testResults.length : 0;
    }

    calculateQualityScore(testResults) {
        // Simplified quality scoring based on response completeness
        let totalQuality = 0;
        for (const result of testResults) {
            if (result.response && result.success) {
                totalQuality += 0.8; // Base quality for successful responses
            }
        }
        return testResults.length > 0 ? totalQuality / testResults.length : 0;
    }

    calculateComplianceScore(testResults) {
        // Simple compliance check based on successful execution
        return this.calculateAccuracyScore(testResults);
    }

    evaluateReasoning(response, correctAnswer, expectedReasoning) {
        // Simplified reasoning evaluation
        if (!response) return { score: 0, reasoning: 'No response' };
        
        const responseText = typeof response === 'string' ? response : JSON.stringify(response);
        const containsAnswer = correctAnswer ? responseText.toLowerCase().includes(correctAnswer.toLowerCase()) : false;
        const hasReasoning = responseText.length > 50; // Minimum reasoning length
        
        return {
            score: (containsAnswer ? 0.6 : 0) + (hasReasoning ? 0.4 : 0),
            containsCorrectAnswer: containsAnswer,
            hasReasoning: hasReasoning
        };
    }

    evaluateGeneratedCode(response, language, expectedFeatures, testCases) {
        // Simplified code evaluation
        if (!response) return { score: 0, evaluation: 'No code generated' };
        
        const codeText = typeof response === 'string' ? response : JSON.stringify(response);
        let score = 0;
        
        // Check for expected features
        let featuresFound = 0;
        if (expectedFeatures) {
            for (const feature of expectedFeatures) {
                if (codeText.toLowerCase().includes(feature.toLowerCase())) {
                    featuresFound++;
                }
            }
            score += (featuresFound / expectedFeatures.length) * 0.7;
        }
        
        // Check for language-specific syntax
        const hasLanguageSyntax = codeText.includes('def ') || codeText.includes('function ') || codeText.includes('{');
        if (hasLanguageSyntax) {
            score += 0.3;
        }
        
        return {
            score: Math.min(1, score),
            featuresFound,
            totalFeatures: expectedFeatures?.length || 0,
            hasValidSyntax: hasLanguageSyntax
        };
    }

    evaluateFunctionCalling(response, expectedBehavior) {
        // Simplified function calling evaluation
        if (!response) return { score: 0, evaluation: 'No response' };
        
        const responseText = typeof response === 'string' ? response : JSON.stringify(response);
        const hasFunction = responseText.includes('function') || responseText.includes('call');
        
        return {
            score: hasFunction ? 0.8 : 0.2,
            detectsFunctionNeed: hasFunction,
            expectedBehavior
        };
    }

    /**
     * Generate performance summary
     */
    async generatePerformanceSummary(verificationSession) {
        const perf = verificationSession.performance;
        
        if (perf.totalTests > 0) {
            perf.averageResponseTime = Math.round(perf.averageResponseTime / perf.totalTests);
            perf.successRate = ((perf.successfulTests / perf.totalTests) * 100).toFixed(2) + '%';
        }

        // Add performance grade
        const thresholds = this.benchmarkData.get('performance_thresholds');
        if (perf.averageResponseTime <= thresholds.response_time.excellent) {
            perf.performanceGrade = 'Excellent';
        } else if (perf.averageResponseTime <= thresholds.response_time.good) {
            perf.performanceGrade = 'Good';
        } else if (perf.averageResponseTime <= thresholds.response_time.acceptable) {
            perf.performanceGrade = 'Acceptable';
        } else {
            perf.performanceGrade = 'Poor';
        }
    }

    /**
     * Generate detailed report
     */
    async generateDetailedReport(verificationSession) {
        const report = {
            summary: {
                modelName: verificationSession.modelName,
                provider: verificationSession.provider,
                overallScore: verificationSession.overallScore,
                totalCapabilities: verificationSession.claimedCapabilities.length,
                verifiedCapabilities: verificationSession.summary.verified,
                failedCapabilities: verificationSession.summary.failed
            },
            capabilityBreakdown: {},
            recommendations: [],
            strengths: [],
            weaknesses: []
        };

        // Analyze each capability
        for (const [capability, result] of verificationSession.verificationResults) {
            report.capabilityBreakdown[capability] = {
                status: result.status,
                score: result.overallScore,
                scenarios: result.scenarioResults?.length || 0,
                passedScenarios: result.metrics?.passedScenarios || 0
            };

            // Identify strengths and weaknesses
            if (result.overallScore >= 0.8) {
                report.strengths.push(capability);
            } else if (result.overallScore < 0.6) {
                report.weaknesses.push(capability);
            }
        }

        // Generate recommendations
        if (report.weaknesses.length > 0) {
            report.recommendations.push(`Improve performance in: ${report.weaknesses.join(', ')}`);
        }
        
        if (verificationSession.performance.averageResponseTime > 5000) {
            report.recommendations.push('Optimize response time for better user experience');
        }

        return report;
    }

    /**
     * Save verification results
     */
    async saveVerificationResults(verificationId, verificationSession) {
        try {
            const filename = `${verificationId}.json`;
            const filepath = path.join(this.resultsDir, filename);
            
            // Convert Map to Object for JSON serialization
            const serializedSession = {
                ...verificationSession,
                verificationResults: Object.fromEntries(verificationSession.verificationResults)
            };
            
            await fs.writeFile(filepath, JSON.stringify(serializedSession, null, 2));
            
            logger.debug('💾 Verification results saved', {
                verificationId,
                filepath,
                component: 'CapabilityVerifier'
            });

        } catch (error) {
            logger.warn('⚠️ Failed to save verification results', {
                verificationId,
                error: error.message,
                component: 'CapabilityVerifier'
            });
        }
    }

    /**
     * Get verification results
     */
    getVerificationResults(verificationId) {
        return this.verificationResults.get(verificationId);
    }

    /**
     * Get all verification results
     */
    getAllVerificationResults() {
        return Array.from(this.verificationResults.values());
    }

    /**
     * Get verifier status
     */
    getStatus() {
        return {
            verifier: 'CapabilityVerifier',
            availableCapabilities: Array.from(this.capabilityTests.keys()),
            completedVerifications: this.verificationResults.size,
            totalVerificationHistory: this.verificationHistory.length,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            this.verificationResults.clear();
            this.capabilityTests.clear();
            this.verificationHistory = [];
            this.benchmarkData.clear();
            this.capabilityScores.clear();

            logger.info('🧹 Capability Verifier cleaned up', {
                component: 'CapabilityVerifier'
            });
        } catch (error) {
            logger.error('❌ Error during Capability Verifier cleanup', {
                error: error.message,
                component: 'CapabilityVerifier'
            });
        }
    }
}

// Export singleton instance
export const capabilityVerifier = new CapabilityVerifier();
export { CapabilityVerifier, ProcessingError };