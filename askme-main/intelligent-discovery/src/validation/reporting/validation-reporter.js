/**
 * Validation Result Storage and Reporting
 * Module 5, Step 29: Add validation result storage and reporting
 * 
 * Features:
 * - Comprehensive validation result aggregation
 * - Multi-format report generation (JSON, HTML, CSV)
 * - Historical trend analysis and dashboards
 * - Comparative analysis across models
 * - Automated report scheduling and distribution
 */

import { logger } from '../../core/infrastructure/logger.js';
import { config } from '../../core/infrastructure/config.js';
import { qdrantManager } from '../../core/storage/qdrant.js';
import { cacheManager } from '../../core/storage/cache.js';
import { apiTester } from '../testing/api-tester.js';
import { capabilityVerifier } from '../capabilities/capability-verifier.js';
import { qualityAnalyzer } from '../quality/quality-analyzer.js';
import { benchmarkSuite } from '../performance/benchmark-suite.js';
import { reliabilityMonitor } from '../monitoring/reliability-monitor.js';
import { ProcessingError } from '../../core/infrastructure/errors.js';
import fs from 'fs/promises';
import path from 'path';

class ValidationReporter {
    constructor() {
        this.reportResults = new Map();
        this.reportTemplates = new Map();
        this.scheduledReports = new Map();
        this.reportHistory = [];
        this.reportingConfig = {
            defaultFormats: ['json', 'html'],
            retentionPeriod: 90 * 24 * 60 * 60 * 1000, // 90 days
            maxReportsPerModel: 50
        };
        this.reportsDir = path.join('data', 'validation_reports');
        
        this.setupReportTemplates();
    }

    /**
     * Set up report templates for different types of validation reports
     */
    setupReportTemplates() {
        // Comprehensive Validation Report
        this.reportTemplates.set('comprehensive', {
            name: 'Comprehensive Validation Report',
            description: 'Complete validation analysis including all aspects',
            sections: [
                'executive_summary',
                'api_testing',
                'capability_verification',
                'quality_analysis',
                'performance_benchmarks',
                'reliability_monitoring',
                'comparative_analysis',
                'recommendations'
            ],
            requiredData: ['apiTests', 'capabilities', 'quality', 'performance', 'reliability'],
            generator: this.generateComprehensiveReport.bind(this)
        });

        // Performance-focused Report
        this.reportTemplates.set('performance', {
            name: 'Performance Analysis Report',
            description: 'Focused on performance metrics and benchmarks',
            sections: [
                'performance_summary',
                'benchmark_results',
                'response_times',
                'throughput_analysis',
                'scalability_assessment',
                'performance_trends'
            ],
            requiredData: ['performance', 'benchmarks'],
            generator: this.generatePerformanceReport.bind(this)
        });

        // Quality Assessment Report
        this.reportTemplates.set('quality', {
            name: 'Quality Assessment Report',
            description: 'Focused on response quality and capability analysis',
            sections: [
                'quality_summary',
                'capability_verification',
                'response_analysis',
                'quality_metrics',
                'improvement_areas'
            ],
            requiredData: ['quality', 'capabilities'],
            generator: this.generateQualityReport.bind(this)
        });

        // Reliability Status Report
        this.reportTemplates.set('reliability', {
            name: 'Reliability Status Report',
            description: 'Uptime, reliability, and monitoring status',
            sections: [
                'reliability_summary',
                'uptime_analysis',
                'error_tracking',
                'alert_history',
                'service_health'
            ],
            requiredData: ['reliability', 'monitoring'],
            generator: this.generateReliabilityReport.bind(this)
        });

        // Comparative Analysis Report
        this.reportTemplates.set('comparative', {
            name: 'Comparative Analysis Report',
            description: 'Cross-model comparison and benchmarking',
            sections: [
                'comparison_summary',
                'performance_comparison',
                'quality_comparison',
                'capability_comparison',
                'cost_benefit_analysis',
                'recommendations'
            ],
            requiredData: ['multiple_models'],
            generator: this.generateComparativeReport.bind(this)
        });

        // Executive Dashboard Report
        this.reportTemplates.set('dashboard', {
            name: 'Executive Dashboard',
            description: 'High-level overview for stakeholders',
            sections: [
                'key_metrics',
                'status_overview',
                'trend_analysis',
                'critical_issues',
                'action_items'
            ],
            requiredData: ['summary_data'],
            generator: this.generateDashboardReport.bind(this)
        });

        logger.info('📋 Report templates configured', {
            templates: Array.from(this.reportTemplates.keys()),
            component: 'ValidationReporter'
        });
    }

    /**
     * Initialize the validation reporter
     */
    async initialize() {
        try {
            logger.info('🚀 Initializing Validation Reporter...', {
                component: 'ValidationReporter'
            });

            // Ensure reports directory exists
            await fs.mkdir(this.reportsDir, { recursive: true });

            // Create subdirectories for different formats
            await fs.mkdir(path.join(this.reportsDir, 'json'), { recursive: true });
            await fs.mkdir(path.join(this.reportsDir, 'html'), { recursive: true });
            await fs.mkdir(path.join(this.reportsDir, 'csv'), { recursive: true });

            logger.info('✅ Validation Reporter initialized', {
                templates: this.reportTemplates.size,
                reportsDirectory: this.reportsDir,
                component: 'ValidationReporter'
            });

            return {
                reporter: 'ValidationReporter',
                initialized: true,
                availableTemplates: Array.from(this.reportTemplates.keys()),
                supportedFormats: ['json', 'html', 'csv']
            };
        } catch (error) {
            logger.error('❌ Failed to initialize Validation Reporter', {
                error: error.message,
                component: 'ValidationReporter'
            });
            throw new ProcessingError(`Validation reporter initialization failed: ${error.message}`);
        }
    }

    /**
     * Generate a validation report for a single model
     */
    async generateModelReport(model, reportType = 'comprehensive', options = {}) {
        try {
            const {
                formats = this.reportingConfig.defaultFormats,
                includeHistorical = true,
                timeRange = 30 * 24 * 60 * 60 * 1000, // 30 days
                saveToDatabase = true,
                includeRawData = false
            } = options;

            logger.info(`📊 Generating ${reportType} report for model: ${model.name}`, {
                modelId: model.id,
                provider: model.provider,
                formats: formats.length,
                component: 'ValidationReporter'
            });

            const reportId = `report_${model.id}_${reportType}_${Date.now()}`;
            const startTime = Date.now();

            // Initialize report session
            const reportSession = {
                reportId,
                reportType,
                modelId: model.id,
                modelName: model.name,
                provider: model.provider,
                startTime: new Date().toISOString(),
                options,
                status: 'generating',
                
                // Data collection
                collectedData: {},
                reportData: {},
                
                // Generated outputs
                generatedReports: {},
                
                // Metadata
                metadata: {
                    version: '1.0.0',
                    generatedBy: 'ValidationReporter',
                    formats: formats
                },
                
                errors: [],
                warnings: []
            };

            try {
                // Get report template
                const template = this.reportTemplates.get(reportType);
                if (!template) {
                    throw new ProcessingError(`Unknown report type: ${reportType}`);
                }

                // Step 1: Collect validation data
                reportSession.collectedData = await this.collectValidationData(model, template, options);

                // Step 2: Generate report content
                reportSession.reportData = await template.generator(model, reportSession.collectedData, options);

                // Step 3: Generate reports in requested formats
                for (const format of formats) {
                    const generatedReport = await this.generateReportInFormat(
                        reportSession.reportData,
                        format,
                        reportId,
                        template
                    );
                    reportSession.generatedReports[format] = generatedReport;
                }

                // Step 4: Save to database if requested
                if (saveToDatabase) {
                    await this.saveReportToDatabase(reportSession);
                }

                reportSession.status = 'completed';
                reportSession.endTime = new Date().toISOString();
                reportSession.duration = Date.now() - startTime;

                // Store report session
                this.reportResults.set(reportId, reportSession);
                this.reportHistory.push(reportSession);

                // Cleanup old reports
                await this.cleanupOldReports(model.id);

                logger.info(`✅ Model report generated: ${model.name}`, {
                    reportId,
                    reportType,
                    formats: formats.join(', '),
                    duration: `${reportSession.duration}ms`,
                    component: 'ValidationReporter'
                });

                return reportSession;

            } catch (error) {
                reportSession.status = 'failed';
                reportSession.error = error.message;
                reportSession.endTime = new Date().toISOString();
                reportSession.duration = Date.now() - startTime;

                logger.error(`❌ Model report generation failed: ${model.name}`, {
                    reportId,
                    reportType,
                    error: error.message,
                    component: 'ValidationReporter'
                });

                return reportSession;
            }

        } catch (error) {
            logger.error('❌ Model report generation failed', {
                modelId: model.id,
                reportType,
                error: error.message,
                component: 'ValidationReporter'
            });
            throw new ProcessingError(`Model report generation failed: ${error.message}`);
        }
    }

    /**
     * Generate comparative report across multiple models
     */
    async generateComparativeReport(models, options = {}) {
        try {
            const {
                formats = this.reportingConfig.defaultFormats,
                includeDetailed = true,
                focusAreas = ['performance', 'quality', 'reliability'],
                saveResults = true
            } = options;

            logger.info('📊 Generating comparative analysis report', {
                modelCount: models.length,
                focusAreas: focusAreas.length,
                formats: formats.length,
                component: 'ValidationReporter'
            });

            const reportId = `comparative_${Date.now()}`;
            const startTime = Date.now();

            // Collect data for all models
            const modelData = new Map();
            for (const model of models) {
                try {
                    const data = await this.collectValidationData(model, { requiredData: focusAreas }, options);
                    modelData.set(model.id, { model, data });
                } catch (error) {
                    logger.warn(`⚠️ Failed to collect data for model: ${model.name}`, {
                        error: error.message,
                        component: 'ValidationReporter'
                    });
                }
            }

            // Generate comparative analysis
            const comparativeData = await this.generateComparativeAnalysis(modelData, focusAreas);

            // Generate report in requested formats
            const generatedReports = {};
            for (const format of formats) {
                const reportContent = await this.generateComparativeReportContent(comparativeData, format);
                const savedReport = await this.saveReportFile(reportContent, reportId, format, 'comparative');
                generatedReports[format] = savedReport;
            }

            const reportSession = {
                reportId,
                reportType: 'comparative',
                modelCount: models.length,
                modelIds: models.map(m => m.id),
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                duration: Date.now() - startTime,
                focusAreas,
                comparativeData,
                generatedReports,
                status: 'completed'
            };

            this.reportResults.set(reportId, reportSession);

            logger.info('✅ Comparative report generated', {
                reportId,
                modelsAnalyzed: modelData.size,
                duration: `${reportSession.duration}ms`,
                component: 'ValidationReporter'
            });

            return reportSession;

        } catch (error) {
            logger.error('❌ Comparative report generation failed', {
                error: error.message,
                modelCount: models.length,
                component: 'ValidationReporter'
            });
            throw new ProcessingError(`Comparative report generation failed: ${error.message}`);
        }
    }

    /**
     * Collect validation data from all sources
     */
    async collectValidationData(model, template, options) {
        const collectedData = {
            model: {
                id: model.id,
                name: model.name,
                provider: model.provider,
                capabilities: model.capabilities || [],
                metadata: model
            },
            collectionTimestamp: new Date().toISOString(),
            timeRange: options.timeRange || 30 * 24 * 60 * 60 * 1000
        };

        logger.debug(`📥 Collecting validation data for: ${model.name}`, {
            requiredData: template.requiredData,
            component: 'ValidationReporter'
        });

        // Collect API testing results
        if (template.requiredData.includes('apiTests')) {
            try {
                const apiTestResults = apiTester.getAllTestResults()
                    .filter(test => test.modelId === model.id)
                    .slice(-10); // Last 10 test results
                collectedData.apiTests = {
                    recentResults: apiTestResults,
                    summary: this.summarizeApiTests(apiTestResults)
                };
            } catch (error) {
                collectedData.errors = collectedData.errors || [];
                collectedData.errors.push(`API test collection failed: ${error.message}`);
            }
        }

        // Collect capability verification results
        if (template.requiredData.includes('capabilities')) {
            try {
                const capabilityResults = capabilityVerifier.getAllVerificationResults()
                    .filter(verification => verification.modelId === model.id)
                    .slice(-5); // Last 5 verification results
                collectedData.capabilities = {
                    recentResults: capabilityResults,
                    summary: this.summarizeCapabilities(capabilityResults)
                };
            } catch (error) {
                collectedData.errors = collectedData.errors || [];
                collectedData.errors.push(`Capability collection failed: ${error.message}`);
            }
        }

        // Collect quality analysis results
        if (template.requiredData.includes('quality')) {
            try {
                const qualityResults = qualityAnalyzer.getAllAnalysisResults()
                    .filter(analysis => analysis.modelId === model.id || analysis.context?.modelId === model.id)
                    .slice(-10); // Last 10 analysis results
                collectedData.quality = {
                    recentResults: qualityResults,
                    summary: this.summarizeQuality(qualityResults)
                };
            } catch (error) {
                collectedData.errors = collectedData.errors || [];
                collectedData.errors.push(`Quality collection failed: ${error.message}`);
            }
        }

        // Collect performance benchmark results
        if (template.requiredData.includes('performance') || template.requiredData.includes('benchmarks')) {
            try {
                const benchmarkResults = benchmarkSuite.getAllBenchmarkResults()
                    .filter(benchmark => benchmark.modelId === model.id)
                    .slice(-5); // Last 5 benchmark results
                collectedData.performance = {
                    recentResults: benchmarkResults,
                    summary: this.summarizePerformance(benchmarkResults)
                };
            } catch (error) {
                collectedData.errors = collectedData.errors || [];
                collectedData.errors.push(`Performance collection failed: ${error.message}`);
            }
        }

        // Collect reliability monitoring results
        if (template.requiredData.includes('reliability') || template.requiredData.includes('monitoring')) {
            try {
                const reliabilityData = reliabilityMonitor.getMonitoringHistory()
                    .filter(session => session.modelId === model.id)
                    .slice(-10); // Last 10 monitoring sessions
                collectedData.reliability = {
                    recentResults: reliabilityData,
                    summary: this.summarizeReliability(reliabilityData)
                };
            } catch (error) {
                collectedData.errors = collectedData.errors || [];
                collectedData.errors.push(`Reliability collection failed: ${error.message}`);
            }
        }

        return collectedData;
    }

    /**
     * Report generators for different templates
     */

    async generateComprehensiveReport(model, collectedData, options) {
        return {
            reportType: 'comprehensive',
            model: collectedData.model,
            generatedAt: new Date().toISOString(),
            
            executiveSummary: {
                modelName: model.name,
                provider: model.provider,
                overallScore: this.calculateOverallScore(collectedData),
                keyStrengths: this.identifyKeyStrengths(collectedData),
                keyWeaknesses: this.identifyKeyWeaknesses(collectedData),
                recommendation: this.generateRecommendation(collectedData)
            },
            
            apiTesting: this.formatApiTestingSection(collectedData.apiTests),
            capabilityVerification: this.formatCapabilitySection(collectedData.capabilities),
            qualityAnalysis: this.formatQualitySection(collectedData.quality),
            performanceBenchmarks: this.formatPerformanceSection(collectedData.performance),
            reliabilityMonitoring: this.formatReliabilitySection(collectedData.reliability),
            
            comparativeAnalysis: await this.generateComparativeContext(model, collectedData),
            
            recommendations: this.generateDetailedRecommendations(collectedData),
            
            technicalDetails: {
                dataCollectionPeriod: options.timeRange || '30 days',
                totalDataPoints: this.countDataPoints(collectedData),
                lastUpdated: new Date().toISOString()
            }
        };
    }

    async generatePerformanceReport(model, collectedData, options) {
        return {
            reportType: 'performance',
            model: collectedData.model,
            generatedAt: new Date().toISOString(),
            
            performanceSummary: {
                overallPerformanceGrade: this.calculatePerformanceGrade(collectedData.performance),
                averageResponseTime: this.calculateAverageResponseTime(collectedData.performance),
                throughputCapacity: this.calculateThroughput(collectedData.performance),
                reliabilityScore: this.calculateReliabilityScore(collectedData.reliability)
            },
            
            benchmarkResults: this.formatBenchmarkResults(collectedData.performance),
            responseTimeAnalysis: this.analyzeResponseTimes(collectedData.performance),
            throughputAnalysis: this.analyzeThroughput(collectedData.performance),
            scalabilityAssessment: this.assessScalability(collectedData.performance),
            performanceTrends: this.analyzePerformanceTrends(collectedData.performance),
            
            optimization: {
                bottlenecks: this.identifyBottlenecks(collectedData.performance),
                recommendations: this.generatePerformanceRecommendations(collectedData.performance)
            }
        };
    }

    async generateQualityReport(model, collectedData, options) {
        return {
            reportType: 'quality',
            model: collectedData.model,
            generatedAt: new Date().toISOString(),
            
            qualitySummary: {
                overallQualityScore: this.calculateOverallQualityScore(collectedData.quality),
                capabilityVerificationRate: this.calculateCapabilityVerificationRate(collectedData.capabilities),
                consistencyScore: this.calculateConsistencyScore(collectedData.quality)
            },
            
            capabilityVerification: this.formatCapabilityVerification(collectedData.capabilities),
            responseAnalysis: this.analyzeResponseQuality(collectedData.quality),
            qualityMetrics: this.formatQualityMetrics(collectedData.quality),
            improvementAreas: this.identifyImprovementAreas(collectedData.quality, collectedData.capabilities),
            
            qualityTrends: this.analyzeQualityTrends(collectedData.quality),
            
            enhancement: {
                prioritizedImprovements: this.prioritizeImprovements(collectedData.quality),
                actionPlan: this.generateQualityActionPlan(collectedData.quality)
            }
        };
    }

    async generateReliabilityReport(model, collectedData, options) {
        return {
            reportType: 'reliability',
            model: collectedData.model,
            generatedAt: new Date().toISOString(),
            
            reliabilitySummary: {
                overallUptimePercentage: this.calculateOverallUptime(collectedData.reliability),
                averageResponseTime: this.calculateAverageResponseTime(collectedData.reliability),
                errorRate: this.calculateErrorRate(collectedData.reliability),
                reliabilityGrade: this.calculateReliabilityGrade(collectedData.reliability)
            },
            
            uptimeAnalysis: this.analyzeUptime(collectedData.reliability),
            errorTracking: this.analyzeErrors(collectedData.reliability),
            alertHistory: this.formatAlertHistory(collectedData.reliability),
            serviceHealth: this.assessServiceHealth(collectedData.reliability),
            
            reliability: {
                slaCompliance: this.checkSLACompliance(collectedData.reliability),
                improvements: this.generateReliabilityImprovements(collectedData.reliability)
            }
        };
    }

    async generateComparativeReport(models, comparativeData, options) {
        return {
            reportType: 'comparative',
            modelsAnalyzed: models.length,
            generatedAt: new Date().toISOString(),
            
            comparisonSummary: {
                topPerformer: comparativeData.rankings.overall[0],
                categoryLeaders: comparativeData.categoryLeaders,
                keyInsights: comparativeData.insights
            },
            
            performanceComparison: comparativeData.performance,
            qualityComparison: comparativeData.quality,
            capabilityComparison: comparativeData.capabilities,
            costBenefitAnalysis: comparativeData.costBenefit,
            
            recommendations: comparativeData.recommendations,
            
            methodology: {
                comparisonCriteria: comparativeData.criteria,
                weightings: comparativeData.weightings,
                dataRange: comparativeData.dataRange
            }
        };
    }

    async generateDashboardReport(model, collectedData, options) {
        return {
            reportType: 'dashboard',
            model: collectedData.model,
            generatedAt: new Date().toISOString(),
            
            keyMetrics: {
                overallHealthScore: this.calculateOverallHealthScore(collectedData),
                uptimePercentage: this.getLatestUptime(collectedData.reliability),
                averageResponseTime: this.getLatestResponseTime(collectedData.performance),
                qualityScore: this.getLatestQualityScore(collectedData.quality),
                lastUpdated: new Date().toISOString()
            },
            
            statusOverview: {
                operational: this.isOperational(collectedData),
                alerts: this.getActiveAlerts(collectedData.reliability),
                trends: this.getKeyTrends(collectedData)
            },
            
            trendAnalysis: {
                performance: this.getPerformanceTrend(collectedData.performance),
                quality: this.getQualityTrend(collectedData.quality),
                reliability: this.getReliabilityTrend(collectedData.reliability)
            },
            
            criticalIssues: this.identifyCriticalIssues(collectedData),
            actionItems: this.generateActionItems(collectedData)
        };
    }

    /**
     * Generate report in specific format
     */
    async generateReportInFormat(reportData, format, reportId, template) {
        switch (format.toLowerCase()) {
            case 'json':
                return await this.generateJSONReport(reportData, reportId, template);
            case 'html':
                return await this.generateHTMLReport(reportData, reportId, template);
            case 'csv':
                return await this.generateCSVReport(reportData, reportId, template);
            default:
                throw new ProcessingError(`Unsupported report format: ${format}`);
        }
    }

    async generateJSONReport(reportData, reportId, template) {
        const filename = `${reportId}.json`;
        const filepath = path.join(this.reportsDir, 'json', filename);
        
        const jsonContent = JSON.stringify(reportData, null, 2);
        await fs.writeFile(filepath, jsonContent);
        
        return {
            format: 'json',
            filename,
            filepath,
            size: jsonContent.length,
            url: `/reports/json/${filename}`
        };
    }

    async generateHTMLReport(reportData, reportId, template) {
        const filename = `${reportId}.html`;
        const filepath = path.join(this.reportsDir, 'html', filename);
        
        const htmlContent = this.generateHTMLContent(reportData, template);
        await fs.writeFile(filepath, htmlContent);
        
        return {
            format: 'html',
            filename,
            filepath,
            size: htmlContent.length,
            url: `/reports/html/${filename}`
        };
    }

    async generateCSVReport(reportData, reportId, template) {
        const filename = `${reportId}.csv`;
        const filepath = path.join(this.reportsDir, 'csv', filename);
        
        const csvContent = this.generateCSVContent(reportData, template);
        await fs.writeFile(filepath, csvContent);
        
        return {
            format: 'csv',
            filename,
            filepath,
            size: csvContent.length,
            url: `/reports/csv/${filename}`
        };
    }

    /**
     * Generate HTML content for report
     */
    generateHTMLContent(reportData, template) {
        const title = `${template.name} - ${reportData.model?.name || 'Model Report'}`;
        
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #e9e9e9; border-radius: 3px; }
        .score-excellent { color: #4CAF50; font-weight: bold; }
        .score-good { color: #8BC34A; font-weight: bold; }
        .score-warning { color: #FF9800; font-weight: bold; }
        .score-poor { color: #f44336; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .chart-placeholder { background: #f9f9f9; height: 200px; display: flex; align-items: center; justify-content: center; border: 1px solid #ddd; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${title}</h1>
        <p><strong>Generated:</strong> ${reportData.generatedAt}</p>
        <p><strong>Model:</strong> ${reportData.model?.name} (${reportData.model?.provider})</p>
    </div>
    
    ${this.generateHTMLSections(reportData, template)}
    
    <div class="section">
        <h2>Technical Details</h2>
        <p><strong>Report ID:</strong> ${reportData.reportId || 'N/A'}</p>
        <p><strong>Data Collection Period:</strong> ${reportData.technicalDetails?.dataCollectionPeriod || 'N/A'}</p>
        <p><strong>Total Data Points:</strong> ${reportData.technicalDetails?.totalDataPoints || 'N/A'}</p>
    </div>
</body>
</html>`;
    }

    generateHTMLSections(reportData, template) {
        let html = '';
        
        // Executive Summary
        if (reportData.executiveSummary) {
            html += `
    <div class="section">
        <h2>Executive Summary</h2>
        <div class="metric">Overall Score: <span class="score-${this.getScoreClass(reportData.executiveSummary.overallScore)}">${(reportData.executiveSummary.overallScore * 100).toFixed(1)}%</span></div>
        <h3>Key Strengths</h3>
        <ul>${reportData.executiveSummary.keyStrengths?.map(s => `<li>${s}</li>`).join('') || '<li>No data available</li>'}</ul>
        <h3>Key Weaknesses</h3>
        <ul>${reportData.executiveSummary.keyWeaknesses?.map(w => `<li>${w}</li>`).join('') || '<li>No data available</li>'}</ul>
    </div>`;
        }
        
        // Performance Summary
        if (reportData.performanceSummary) {
            html += `
    <div class="section">
        <h2>Performance Summary</h2>
        <div class="metric">Grade: ${reportData.performanceSummary.overallPerformanceGrade}</div>
        <div class="metric">Avg Response Time: ${reportData.performanceSummary.averageResponseTime}ms</div>
        <div class="metric">Throughput: ${reportData.performanceSummary.throughputCapacity} req/s</div>
    </div>`;
        }
        
        // Reliability Summary
        if (reportData.reliabilitySummary) {
            html += `
    <div class="section">
        <h2>Reliability Summary</h2>
        <div class="metric">Uptime: <span class="score-${this.getUptimeClass(reportData.reliabilitySummary.overallUptimePercentage)}">${reportData.reliabilitySummary.overallUptimePercentage}%</span></div>
        <div class="metric">Error Rate: ${reportData.reliabilitySummary.errorRate}%</div>
        <div class="metric">Grade: ${reportData.reliabilitySummary.reliabilityGrade}</div>
    </div>`;
        }
        
        return html;
    }

    /**
     * Generate CSV content for report
     */
    generateCSVContent(reportData, template) {
        const lines = [];
        lines.push('Report Type,Model Name,Provider,Generated At');
        lines.push(`${reportData.reportType},${reportData.model?.name},${reportData.model?.provider},${reportData.generatedAt}`);
        lines.push('');
        
        // Add metrics data
        if (reportData.executiveSummary) {
            lines.push('Metric,Value');
            lines.push(`Overall Score,${(reportData.executiveSummary.overallScore * 100).toFixed(1)}%`);
        }
        
        if (reportData.performanceSummary) {
            lines.push('Performance Metric,Value');
            lines.push(`Grade,${reportData.performanceSummary.overallPerformanceGrade}`);
            lines.push(`Average Response Time,${reportData.performanceSummary.averageResponseTime}ms`);
            lines.push(`Throughput,${reportData.performanceSummary.throughputCapacity} req/s`);
        }
        
        if (reportData.reliabilitySummary) {
            lines.push('Reliability Metric,Value');
            lines.push(`Uptime,${reportData.reliabilitySummary.overallUptimePercentage}%`);
            lines.push(`Error Rate,${reportData.reliabilitySummary.errorRate}%`);
            lines.push(`Grade,${reportData.reliabilitySummary.reliabilityGrade}`);
        }
        
        return lines.join('\n');
    }

    /**
     * Summary and analysis helper methods
     */

    summarizeApiTests(apiTestResults) {
        if (!apiTestResults || apiTestResults.length === 0) {
            return { totalTests: 0, successRate: 0, averageResponseTime: 0 };
        }

        const totalTests = apiTestResults.length;
        const successfulTests = apiTestResults.filter(test => test.success).length;
        const totalResponseTime = apiTestResults.reduce((sum, test) => sum + (test.duration || 0), 0);

        return {
            totalTests,
            successfulTests,
            successRate: (successfulTests / totalTests * 100).toFixed(2) + '%',
            averageResponseTime: Math.round(totalResponseTime / totalTests) + 'ms'
        };
    }

    summarizeCapabilities(capabilityResults) {
        if (!capabilityResults || capabilityResults.length === 0) {
            return { totalVerifications: 0, verifiedCapabilities: 0, averageScore: 0 };
        }

        const totalVerifications = capabilityResults.length;
        const verifiedCapabilities = capabilityResults.filter(result => result.summary?.verified > 0).length;
        const totalScore = capabilityResults.reduce((sum, result) => sum + (result.overallScore || 0), 0);

        return {
            totalVerifications,
            verifiedCapabilities,
            verificationRate: (verifiedCapabilities / totalVerifications * 100).toFixed(2) + '%',
            averageScore: (totalScore / totalVerifications).toFixed(3)
        };
    }

    summarizeQuality(qualityResults) {
        if (!qualityResults || qualityResults.length === 0) {
            return { totalAnalyses: 0, averageScore: 0, topGrade: 'N/A' };
        }

        const totalAnalyses = qualityResults.length;
        const totalScore = qualityResults.reduce((sum, result) => sum + (result.overallScore || 0), 0);
        const grades = qualityResults.map(result => result.qualityGrade).filter(Boolean);

        return {
            totalAnalyses,
            averageScore: (totalScore / totalAnalyses).toFixed(3),
            averageGrade: this.getMostCommonGrade(grades),
            consistentQuality: this.calculateQualityConsistency(qualityResults)
        };
    }

    summarizePerformance(benchmarkResults) {
        if (!benchmarkResults || benchmarkResults.length === 0) {
            return { totalBenchmarks: 0, averageScore: 0, grade: 'N/A' };
        }

        const totalBenchmarks = benchmarkResults.length;
        const totalScore = benchmarkResults.reduce((sum, result) => sum + (result.overallScore || 0), 0);
        const grades = benchmarkResults.map(result => result.performanceGrade).filter(Boolean);

        return {
            totalBenchmarks,
            averageScore: (totalScore / totalBenchmarks).toFixed(3),
            averageGrade: this.getMostCommonGrade(grades),
            latestGrade: grades[grades.length - 1] || 'N/A'
        };
    }

    summarizeReliability(reliabilityData) {
        if (!reliabilityData || reliabilityData.length === 0) {
            return { totalSessions: 0, averageUptime: 0, grade: 'N/A' };
        }

        const totalSessions = reliabilityData.length;
        const totalUptime = reliabilityData.reduce((sum, session) => sum + (session.statistics?.uptimePercentage || 0), 0);
        const grades = reliabilityData.map(session => session.statistics?.reliabilityGrade).filter(Boolean);

        return {
            totalSessions,
            averageUptime: (totalUptime / totalSessions).toFixed(2) + '%',
            averageGrade: this.getMostCommonGrade(grades),
            totalAlerts: reliabilityData.reduce((sum, session) => sum + (session.alerts?.length || 0), 0)
        };
    }

    // Analysis methods
    calculateOverallScore(collectedData) {
        let totalScore = 0;
        let components = 0;

        if (collectedData.performance?.summary?.averageScore) {
            totalScore += parseFloat(collectedData.performance.summary.averageScore);
            components++;
        }

        if (collectedData.quality?.summary?.averageScore) {
            totalScore += parseFloat(collectedData.quality.summary.averageScore);
            components++;
        }

        if (collectedData.capabilities?.summary?.averageScore) {
            totalScore += parseFloat(collectedData.capabilities.summary.averageScore);
            components++;
        }

        if (collectedData.reliability?.summary?.averageUptime) {
            const uptimeScore = parseFloat(collectedData.reliability.summary.averageUptime.replace('%', '')) / 100;
            totalScore += uptimeScore;
            components++;
        }

        return components > 0 ? totalScore / components : 0;
    }

    identifyKeyStrengths(collectedData) {
        const strengths = [];
        
        if (collectedData.performance?.summary?.averageScore >= 0.8) {
            strengths.push('Excellent performance benchmarks');
        }
        
        if (collectedData.quality?.summary?.averageScore >= 0.8) {
            strengths.push('High-quality response generation');
        }
        
        if (collectedData.reliability?.summary?.averageUptime >= '95%') {
            strengths.push('Reliable uptime and availability');
        }
        
        if (collectedData.capabilities?.summary?.verificationRate >= '80%') {
            strengths.push('Strong capability verification');
        }

        return strengths.length > 0 ? strengths : ['Consistent basic functionality'];
    }

    identifyKeyWeaknesses(collectedData) {
        const weaknesses = [];
        
        if (collectedData.performance?.summary?.averageScore < 0.6) {
            weaknesses.push('Performance optimization needed');
        }
        
        if (collectedData.quality?.summary?.averageScore < 0.6) {
            weaknesses.push('Response quality improvement required');
        }
        
        if (collectedData.reliability?.summary?.averageUptime < '90%') {
            weaknesses.push('Reliability and uptime issues');
        }
        
        if (collectedData.capabilities?.summary?.verificationRate < '60%') {
            weaknesses.push('Capability verification concerns');
        }

        return weaknesses.length > 0 ? weaknesses : ['Minor optimization opportunities'];
    }

    // Utility methods
    getMostCommonGrade(grades) {
        if (!grades || grades.length === 0) return 'N/A';
        
        const gradeCount = {};
        grades.forEach(grade => {
            gradeCount[grade] = (gradeCount[grade] || 0) + 1;
        });
        
        return Object.keys(gradeCount).reduce((a, b) => gradeCount[a] > gradeCount[b] ? a : b);
    }

    getScoreClass(score) {
        if (score >= 0.9) return 'excellent';
        if (score >= 0.8) return 'good';
        if (score >= 0.6) return 'warning';
        return 'poor';
    }

    getUptimeClass(uptime) {
        const uptimeNum = typeof uptime === 'string' ? parseFloat(uptime) : uptime;
        if (uptimeNum >= 99) return 'excellent';
        if (uptimeNum >= 95) return 'good';
        if (uptimeNum >= 90) return 'warning';
        return 'poor';
    }

    countDataPoints(collectedData) {
        let total = 0;
        
        if (collectedData.apiTests?.recentResults) {
            total += collectedData.apiTests.recentResults.length;
        }
        if (collectedData.capabilities?.recentResults) {
            total += collectedData.capabilities.recentResults.length;
        }
        if (collectedData.quality?.recentResults) {
            total += collectedData.quality.recentResults.length;
        }
        if (collectedData.performance?.recentResults) {
            total += collectedData.performance.recentResults.length;
        }
        if (collectedData.reliability?.recentResults) {
            total += collectedData.reliability.recentResults.length;
        }
        
        return total;
    }

    // Placeholder methods for detailed analysis (would be implemented based on specific requirements)
    async generateComparativeContext(model, collectedData) {
        return { message: 'Comparative analysis not yet implemented' };
    }

    generateDetailedRecommendations(collectedData) {
        return ['Review performance metrics', 'Monitor quality trends', 'Maintain reliability standards'];
    }

    calculateQualityConsistency(qualityResults) {
        return 'Consistent'; // Placeholder
    }

    // Additional placeholder methods would be implemented based on specific analysis requirements
    formatApiTestingSection(apiTests) { return apiTests; }
    formatCapabilitySection(capabilities) { return capabilities; }
    formatQualitySection(quality) { return quality; }
    formatPerformanceSection(performance) { return performance; }
    formatReliabilitySection(reliability) { return reliability; }

    /**
     * Save report to database
     */
    async saveReportToDatabase(reportSession) {
        try {
            // Save to Qdrant vector database for searchability
            const embedding = await embeddingsManager.generateTextEmbedding(
                `${reportSession.reportData.reportType} report for ${reportSession.modelName} generated ${reportSession.startTime}`
            );

            const reportDocument = {
                id: reportSession.reportId,
                reportType: reportSession.reportType,
                modelId: reportSession.modelId,
                modelName: reportSession.modelName,
                provider: reportSession.provider,
                generatedAt: reportSession.startTime,
                overallScore: reportSession.reportData.executiveSummary?.overallScore || 0,
                formats: Object.keys(reportSession.generatedReports),
                metadata: {
                    duration: reportSession.duration,
                    status: reportSession.status,
                    version: reportSession.metadata.version
                }
            };

            await qdrantManager.upsertPoints('validation_reports', [
                {
                    id: reportSession.reportId,
                    vector: embedding,
                    payload: reportDocument
                }
            ]);

            // Cache recent report for quick access
            await cacheManager.cacheApiResponse('validation_reports', reportSession.reportId, {}, reportSession, {
                ttl: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            logger.debug('💾 Report saved to database', {
                reportId: reportSession.reportId,
                modelName: reportSession.modelName,
                component: 'ValidationReporter'
            });

        } catch (error) {
            logger.warn('⚠️ Failed to save report to database', {
                reportId: reportSession.reportId,
                error: error.message,
                component: 'ValidationReporter'
            });
        }
    }

    /**
     * Cleanup old reports
     */
    async cleanupOldReports(modelId) {
        try {
            const modelReports = this.reportHistory
                .filter(report => report.modelId === modelId)
                .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

            if (modelReports.length > this.reportingConfig.maxReportsPerModel) {
                const reportsToRemove = modelReports.slice(this.reportingConfig.maxReportsPerModel);
                
                for (const report of reportsToRemove) {
                    // Remove from history
                    const index = this.reportHistory.findIndex(r => r.reportId === report.reportId);
                    if (index > -1) {
                        this.reportHistory.splice(index, 1);
                    }
                    
                    // Remove files
                    try {
                        for (const [format, fileInfo] of Object.entries(report.generatedReports || {})) {
                            if (fileInfo.filepath) {
                                await fs.unlink(fileInfo.filepath);
                            }
                        }
                    } catch (error) {
                        // File might already be deleted, ignore
                    }
                }

                logger.debug('🧹 Cleaned up old reports', {
                    modelId,
                    removedReports: reportsToRemove.length,
                    component: 'ValidationReporter'
                });
            }
        } catch (error) {
            logger.warn('⚠️ Failed to cleanup old reports', {
                modelId,
                error: error.message,
                component: 'ValidationReporter'
            });
        }
    }

    /**
     * Get report by ID
     */
    getReport(reportId) {
        return this.reportResults.get(reportId);
    }

    /**
     * Get all reports
     */
    getAllReports() {
        return Array.from(this.reportResults.values());
    }

    /**
     * Get reports by model
     */
    getReportsByModel(modelId) {
        return this.reportHistory.filter(report => report.modelId === modelId);
    }

    /**
     * Get reporter status
     */
    getStatus() {
        return {
            reporter: 'ValidationReporter',
            availableTemplates: Array.from(this.reportTemplates.keys()),
            supportedFormats: ['json', 'html', 'csv'],
            generatedReports: this.reportResults.size,
            totalReportHistory: this.reportHistory.length,
            reportsDirectory: this.reportsDir,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            this.reportResults.clear();
            this.reportTemplates.clear();
            this.scheduledReports.clear();
            this.reportHistory = [];

            logger.info('🧹 Validation Reporter cleaned up', {
                component: 'ValidationReporter'
            });
        } catch (error) {
            logger.error('❌ Error during Validation Reporter cleanup', {
                error: error.message,
                component: 'ValidationReporter'
            });
        }
    }
}

// Export singleton instance
export const validationReporter = new ValidationReporter();
export { ValidationReporter, ProcessingError };