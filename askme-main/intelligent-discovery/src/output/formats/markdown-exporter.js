import { createLogger } from '../../core/infrastructure/logger.js';
import { jsonExporter } from './json-exporter.js';
import { csvExporter } from './csv-exporter.js';
import fs from 'fs/promises';
import path from 'path';

class MarkdownExporter {
  constructor() {
    this.logger = createLogger({ component: 'markdown-exporter' });
    this.isInitialized = false;
    this.markdownCache = new Map();
    
    // Markdown export configuration
    this.markdownConfig = {
      outputDirectory: './exports/markdown',
      encoding: 'utf8',
      includeTableOfContents: true,
      includeFrontmatter: true,
      maxContentLength: 1000000, // 1MB
      imageSupport: true,
      linkValidation: true
    };
    
    // Markdown document templates
    this.documentTemplates = {
      'model_catalog': {
        description: 'Comprehensive model catalog documentation',
        filename: 'AI_Model_Catalog.md',
        sections: [
          'overview', 'table_of_contents', 'statistics', 'providers',
          'model_categories', 'detailed_models', 'performance_comparison',
          'cost_analysis', 'recommendations', 'appendix'
        ],
        processor: this.generateModelCatalog.bind(this)
      },
      'provider_guide': {
        description: 'Provider-specific integration guides',
        filename: 'Provider_Integration_Guide.md',
        sections: [
          'overview', 'provider_list', 'authentication', 'api_documentation',
          'code_examples', 'best_practices', 'troubleshooting', 'resources'
        ],
        processor: this.generateProviderGuide.bind(this)
      },
      'performance_report': {
        description: 'Performance benchmarks and analysis',
        filename: 'Model_Performance_Report.md',
        sections: [
          'executive_summary', 'methodology', 'benchmark_results',
          'performance_trends', 'top_performers', 'recommendations', 'conclusions'
        ],
        processor: this.generatePerformanceReport.bind(this)
      },
      'api_reference': {
        description: 'API reference documentation',
        filename: 'API_Reference.md',
        sections: [
          'introduction', 'quick_start', 'authentication', 'endpoints',
          'request_response', 'code_examples', 'error_handling', 'sdks'
        ],
        processor: this.generateAPIReference.bind(this)
      },
      'user_manual': {
        description: 'User manual and getting started guide',
        filename: 'User_Manual.md',
        sections: [
          'introduction', 'getting_started', 'basic_usage', 'advanced_features',
          'use_cases', 'troubleshooting', 'faq', 'support'
        ],
        processor: this.generateUserManual.bind(this)
      },
      'comparison_guide': {
        description: 'Model comparison and selection guide',
        filename: 'Model_Comparison_Guide.md',
        sections: [
          'introduction', 'comparison_methodology', 'feature_comparison',
          'performance_comparison', 'cost_comparison', 'use_case_recommendations',
          'decision_matrix', 'conclusions'
        ],
        processor: this.generateComparisonGuide.bind(this)
      },
      'release_notes': {
        description: 'Release notes and changelog',
        filename: 'Release_Notes.md',
        sections: [
          'overview', 'latest_release', 'recent_changes', 'model_updates',
          'new_features', 'bug_fixes', 'deprecations', 'migration_guide'
        ],
        processor: this.generateReleaseNotes.bind(this)
      }
    };
    
    // Markdown formatting utilities
    this.formatters = {
      'heading': (text, level = 1) => `${'#'.repeat(level)} ${text}\n\n`,
      'bold': (text) => `**${text}**`,
      'italic': (text) => `*${text}*`,
      'code': (text) => `\`${text}\``,
      'code_block': (text, language = '') => `\`\`\`${language}\n${text}\n\`\`\`\n\n`,
      'link': (text, url) => `[${text}](${url})`,
      'image': (alt, url) => `![${alt}](${url})`,
      'table_row': (cells) => `| ${cells.join(' | ')} |\n`,
      'table_separator': (columns) => `| ${columns.map(() => '---').join(' | ')} |\n`,
      'list_item': (text, level = 0) => `${'  '.repeat(level)}- ${text}\n`,
      'numbered_item': (text, number, level = 0) => `${'  '.repeat(level)}${number}. ${text}\n`,
      'blockquote': (text) => `> ${text}\n\n`,
      'horizontal_rule': () => `---\n\n`,
      'badge': (label, message, color = 'blue') => `![${label}](https://img.shields.io/badge/${label}-${message}-${color})`
    };
    
    // Content generators
    this.contentGenerators = {
      'statistics_table': this.generateStatisticsTable.bind(this),
      'model_table': this.generateModelTable.bind(this),
      'performance_chart': this.generatePerformanceChart.bind(this),
      'cost_comparison': this.generateCostComparison.bind(this),
      'capability_matrix': this.generateCapabilityMatrix.bind(this),
      'provider_overview': this.generateProviderOverview.bind(this),
      'code_example': this.generateCodeExample.bind(this),
      'decision_tree': this.generateDecisionTree.bind(this)
    };
  }

  async initialize() {
    try {
      this.logger.info('Initializing Markdown exporter');
      
      // Create output directories
      await this.createOutputDirectories();
      
      // Load document templates
      await this.loadDocumentTemplates();
      
      // Initialize content generators
      await this.initializeContentGenerators();
      
      this.isInitialized = true;
      this.logger.info('Markdown exporter initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Markdown exporter', { error: error.message });
      throw error;
    }
  }

  async exportMarkdown(templateName, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Markdown exporter not initialized');
    }

    try {
      this.logger.info('Starting Markdown export', {
        template: templateName,
        options: Object.keys(options)
      });

      const template = this.documentTemplates[templateName];
      if (!template) {
        throw new Error(`Unknown Markdown template: ${templateName}`);
      }

      const startTime = Date.now();
      const exportId = this.generateExportId();

      // Get model data
      const modelData = await this.getModelData(options);
      
      // Generate document content
      const documentContent = await template.processor(modelData, options);
      
      // Add frontmatter if enabled
      let markdownContent = '';
      if (this.markdownConfig.includeFrontmatter) {
        markdownContent += this.generateFrontmatter(templateName, options) + '\n\n';
      }
      
      // Add table of contents if enabled
      if (this.markdownConfig.includeTableOfContents && template.sections.length > 3) {
        markdownContent += this.generateTableOfContents(template.sections) + '\n\n';
      }
      
      // Add main content
      markdownContent += documentContent;
      
      // Write markdown file
      const outputPath = await this.writeMarkdownFile(markdownContent, template.filename, options);
      
      // Generate export summary
      const exportSummary = {
        export_id: exportId,
        template: templateName,
        output_path: outputPath,
        content_length: markdownContent.length,
        sections_generated: template.sections.length,
        file_size: await this.getFileSize(outputPath),
        processing_time: Date.now() - startTime,
        data_integrity: {
          checksum: this.calculateChecksum(markdownContent),
          word_count: this.countWords(markdownContent),
          link_count: this.countLinks(markdownContent)
        }
      };

      this.logger.info('Markdown export completed', {
        template: templateName,
        content_length: exportSummary.content_length,
        file_size_kb: Math.round(exportSummary.file_size / 1024),
        processing_time: exportSummary.processing_time
      });

      return exportSummary;

    } catch (error) {
      this.logger.error('Markdown export failed', { template: templateName, error: error.message });
      throw error;
    }
  }

  // Template processors
  async generateModelCatalog(data, options) {
    this.logger.debug('Generating model catalog documentation');

    let content = '';
    
    // Overview section
    content += this.formatters.heading('AI Model Catalog', 1);
    content += 'A comprehensive catalog of validated AI models across multiple providers, ' +
               'including performance metrics, cost analysis, and integration guidance.\n\n';
    
    // Statistics section
    content += this.formatters.heading('Overview Statistics', 2);
    const stats = this.calculateCatalogStatistics(data);
    content += this.contentGenerators.statistics_table(stats);
    content += '\n\n';
    
    // Provider overview
    content += this.formatters.heading('Providers', 2);
    const providers = this.groupDataByProvider(data);
    for (const [providerName, models] of Object.entries(providers)) {
      content += this.contentGenerators.provider_overview(providerName, models);
    }
    content += '\n\n';
    
    // Model categories
    content += this.formatters.heading('Model Categories', 2);
    const categories = this.groupDataByModelType(data);
    for (const [categoryName, models] of Object.entries(categories)) {
      content += this.formatters.heading(this.formatCategoryName(categoryName), 3);
      content += `${models.length} models available in this category.\n\n`;
      content += this.contentGenerators.model_table(models.slice(0, 10)); // Top 10 per category
      content += '\n\n';
    }
    
    // Performance comparison
    content += this.formatters.heading('Performance Comparison', 2);
    content += 'Performance metrics comparison across top-performing models.\n\n';
    content += this.contentGenerators.performance_chart(data);
    content += '\n\n';
    
    // Cost analysis
    content += this.formatters.heading('Cost Analysis', 2);
    content += 'Cost comparison and efficiency analysis.\n\n';
    content += this.contentGenerators.cost_comparison(data);
    content += '\n\n';
    
    // Detailed model listings
    content += this.formatters.heading('Detailed Model Information', 2);
    const topModels = this.getTopModels(data, 20);
    for (const model of topModels) {
      content += this.generateDetailedModelSection(model);
    }
    
    // Recommendations
    content += this.formatters.heading('Recommendations', 2);
    content += this.generateRecommendationsSection(data);
    
    // Appendix
    content += this.formatters.heading('Appendix', 2);
    content += this.formatters.heading('Methodology', 3);
    content += 'This catalog is generated using automated validation and analysis of AI models ' +
               'from multiple sources. Performance metrics are collected through standardized benchmarks ' +
               'and real-world testing scenarios.\n\n';
    
    content += this.formatters.heading('Data Sources', 3);
    content += this.formatters.list_item('Hugging Face Hub - Open source models and metrics');
    content += this.formatters.list_item('Provider APIs - Official model specifications');
    content += this.formatters.list_item('Benchmark Suites - Performance and accuracy testing');
    content += this.formatters.list_item('Community Feedback - User ratings and reviews');
    content += '\n\n';
    
    return content;
  }

  async generateProviderGuide(data, options) {
    this.logger.debug('Generating provider integration guide');

    let content = '';
    
    // Overview
    content += this.formatters.heading('Provider Integration Guide', 1);
    content += 'Complete guide to integrating with AI model providers, including authentication, ' +
               'API usage, and best practices.\n\n';
    
    // Provider list
    content += this.formatters.heading('Supported Providers', 2);
    const providers = this.groupDataByProvider(data);
    const providerList = Object.keys(providers).map(provider => {
      const modelCount = providers[provider].length;
      return this.formatters.list_item(`${this.formatters.bold(provider)} - ${modelCount} models`);
    }).join('');
    content += providerList + '\n\n';
    
    // Provider-specific guides
    for (const [providerName, models] of Object.entries(providers)) {
      content += this.formatters.heading(providerName, 2);
      content += this.generateProviderSection(providerName, models);
    }
    
    return content;
  }

  async generatePerformanceReport(data, options) {
    this.logger.debug('Generating performance report');

    let content = '';
    
    // Executive summary
    content += this.formatters.heading('Model Performance Report', 1);
    content += this.formatters.heading('Executive Summary', 2);
    
    const performanceStats = this.calculatePerformanceStatistics(data);
    content += `This report analyzes the performance of ${data.length} AI models across multiple ` +
               `metrics. Key findings include:\n\n`;
    
    content += this.formatters.list_item(`Average accuracy: ${performanceStats.avgAccuracy.toFixed(2)}`);
    content += this.formatters.list_item(`Average latency: ${performanceStats.avgLatency.toFixed(0)}ms`);
    content += this.formatters.list_item(`Top performer: ${performanceStats.topPerformer.name}`);
    content += this.formatters.list_item(`Most cost-effective: ${performanceStats.mostCostEffective.name}`);
    content += '\n\n';
    
    // Methodology
    content += this.formatters.heading('Methodology', 2);
    content += 'Performance metrics are collected using standardized benchmarks and real-world ' +
               'testing scenarios. All tests are conducted under controlled conditions to ensure ' +
               'consistency and reproducibility.\n\n';
    
    // Benchmark results
    content += this.formatters.heading('Benchmark Results', 2);
    content += this.contentGenerators.performance_chart(data);
    content += '\n\n';
    
    // Top performers
    content += this.formatters.heading('Top Performers', 2);
    const topPerformers = this.getTopPerformers(data, 10);
    content += this.contentGenerators.model_table(topPerformers);
    content += '\n\n';
    
    return content;
  }

  async generateAPIReference(data, options) {
    this.logger.debug('Generating API reference documentation');

    let content = '';
    
    // Introduction
    content += this.formatters.heading('AI Model API Reference', 1);
    content += 'Comprehensive API reference for accessing and integrating AI models.\n\n';
    
    // Quick start
    content += this.formatters.heading('Quick Start', 2);
    content += 'Get started with our API in minutes:\n\n';
    content += this.contentGenerators.code_example('curl', this.generateQuickStartExample());
    content += '\n\n';
    
    // Authentication
    content += this.formatters.heading('Authentication', 2);
    content += 'All API requests require authentication using API keys:\n\n';
    content += this.contentGenerators.code_example('bash', 'export API_KEY="your-api-key-here"');
    content += '\n\n';
    
    // Endpoints
    content += this.formatters.heading('Endpoints', 2);
    content += this.generateEndpointsSection(data);
    
    // Code examples
    content += this.formatters.heading('Code Examples', 2);
    content += this.generateCodeExamplesSection(data);
    
    return content;
  }

  async generateUserManual(data, options) {
    this.logger.debug('Generating user manual');

    let content = '';
    
    // Introduction
    content += this.formatters.heading('AI Model Discovery User Manual', 1);
    content += 'Welcome to the AI Model Discovery System! This manual will help you find, ' +
               'compare, and integrate the perfect AI models for your use case.\n\n';
    
    // Getting started
    content += this.formatters.heading('Getting Started', 2);
    content += this.formatters.heading('System Requirements', 3);
    content += this.formatters.list_item('Node.js 18+ or Python 3.8+');
    content += this.formatters.list_item('API key from supported providers');
    content += this.formatters.list_item('Internet connection for model validation');
    content += '\n\n';
    
    // Basic usage
    content += this.formatters.heading('Basic Usage', 2);
    content += this.formatters.heading('Finding Models', 3);
    content += 'Use natural language queries to find models:\n\n';
    content += this.contentGenerators.code_example('javascript', 
      'const results = await nlSearch.processNaturalLanguageQuery(\n' +
      '  "Find models for code generation with low latency"\n' +
      ');'
    );
    content += '\n\n';
    
    // Use cases
    content += this.formatters.heading('Common Use Cases', 2);
    const useCases = this.extractCommonUseCases(data);
    for (const useCase of useCases) {
      content += this.formatters.heading(useCase.name, 3);
      content += `${useCase.description}\n\n`;
      content += this.formatters.bold('Recommended Models:') + '\n';
      for (const model of useCase.recommendedModels) {
        content += this.formatters.list_item(`${model.name} - ${model.reason}`);
      }
      content += '\n\n';
    }
    
    return content;
  }

  async generateComparisonGuide(data, options) {
    this.logger.debug('Generating comparison guide');

    let content = '';
    
    // Introduction
    content += this.formatters.heading('Model Comparison Guide', 1);
    content += 'A comprehensive guide to comparing and selecting AI models based on your specific needs.\n\n';
    
    // Comparison methodology
    content += this.formatters.heading('Comparison Methodology', 2);
    content += 'Our comparison framework evaluates models across five key dimensions:\n\n';
    content += this.formatters.list_item(this.formatters.bold('Performance') + ' - Speed, accuracy, and reliability');
    content += this.formatters.list_item(this.formatters.bold('Capabilities') + ' - Features and supported tasks');
    content += this.formatters.list_item(this.formatters.bold('Cost') + ' - Pricing and total cost of ownership');
    content += this.formatters.list_item(this.formatters.bold('Usability') + ' - Ease of integration and documentation');
    content += this.formatters.list_item(this.formatters.bold('Support') + ' - Community and enterprise support');
    content += '\n\n';
    
    // Feature comparison
    content += this.formatters.heading('Feature Comparison', 2);
    content += this.contentGenerators.capability_matrix(data);
    content += '\n\n';
    
    // Decision matrix
    content += this.formatters.heading('Decision Matrix', 2);
    content += this.contentGenerators.decision_tree(data);
    content += '\n\n';
    
    return content;
  }

  async generateReleaseNotes(data, options) {
    this.logger.debug('Generating release notes');

    let content = '';
    
    // Overview
    content += this.formatters.heading('Release Notes', 1);
    content += `Last updated: ${new Date().toLocaleDateString()}\n\n`;
    
    // Latest release
    content += this.formatters.heading('Latest Release - v1.0.0', 2);
    content += this.formatters.bold('Release Date:') + ` ${new Date().toLocaleDateString()}\n\n`;
    
    // New features
    content += this.formatters.heading('New Features', 3);
    content += this.formatters.list_item('RAG System - Natural language model discovery');
    content += this.formatters.list_item('Advanced Comparison - Multi-dimensional model analysis');
    content += this.formatters.list_item('Recommendation Engine - AI-powered model suggestions');
    content += this.formatters.list_item('Export System - Multiple output formats (JSON, CSV, Markdown)');
    content += '\n\n';
    
    // Model updates
    content += this.formatters.heading('Model Updates', 3);
    const recentModels = this.getRecentlyUpdatedModels(data, 10);
    for (const model of recentModels) {
      content += this.formatters.list_item(`${model.name} - Updated performance metrics and capabilities`);
    }
    content += '\n\n';
    
    return content;
  }

  // Content generators
  generateStatisticsTable(stats) {
    let table = '';
    table += this.formatters.table_row(['Metric', 'Value']);
    table += this.formatters.table_separator(['Metric', 'Value']);
    
    for (const [metric, value] of Object.entries(stats)) {
      table += this.formatters.table_row([this.formatMetricName(metric), value.toString()]);
    }
    
    return table + '\n';
  }

  generateModelTable(models) {
    let table = '';
    table += this.formatters.table_row(['Model', 'Provider', 'Type', 'Performance', 'Cost']);
    table += this.formatters.table_separator(['Model', 'Provider', 'Type', 'Performance', 'Cost']);
    
    for (const model of models) {
      table += this.formatters.table_row([
        model.name,
        model.provider,
        model.model_type,
        this.formatPerformanceScore(model.performance_metrics),
        this.formatCost(model.cost_data)
      ]);
    }
    
    return table + '\n';
  }

  generateCapabilityMatrix(data) {
    const capabilities = [
      'text_generation', 'code_generation', 'question_answering',
      'summarization', 'translation', 'image_generation'
    ];
    
    let table = '';
    table += this.formatters.table_row(['Model', ...capabilities]);
    table += this.formatters.table_separator(['Model', ...capabilities]);
    
    for (const model of data.slice(0, 10)) {
      const row = [model.name];
      for (const capability of capabilities) {
        const hasCapability = this.modelHasCapability(model, capability);
        row.push(hasCapability ? '✅' : '❌');
      }
      table += this.formatters.table_row(row);
    }
    
    return table + '\n';
  }

  generateCodeExample(language, code) {
    return this.formatters.code_block(code, language);
  }

  // Helper methods
  async getModelData(options) {
    return await jsonExporter.gatherModelData(options);
  }

  generateFrontmatter(templateName, options) {
    const frontmatter = {
      title: this.getDocumentTitle(templateName),
      description: this.documentTemplates[templateName].description,
      generated: new Date().toISOString(),
      version: '1.0.0',
      template: templateName
    };
    
    let yaml = '---\n';
    for (const [key, value] of Object.entries(frontmatter)) {
      yaml += `${key}: ${JSON.stringify(value)}\n`;
    }
    yaml += '---';
    
    return yaml;
  }

  generateTableOfContents(sections) {
    let toc = this.formatters.heading('Table of Contents', 2);
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionTitle = this.formatSectionTitle(section);
      const anchor = this.generateAnchor(sectionTitle);
      toc += this.formatters.numbered_item(
        this.formatters.link(sectionTitle, `#${anchor}`),
        i + 1
      );
    }
    
    return toc + '\n';
  }

  async writeMarkdownFile(content, filename, options) {
    const outputPath = path.join(this.markdownConfig.outputDirectory, filename);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    // Write file
    await fs.writeFile(outputPath, content, this.markdownConfig.encoding);
    
    return outputPath;
  }

  generateDetailedModelSection(model) {
    let section = '';
    
    section += this.formatters.heading(model.name, 3);
    section += `${this.formatters.bold('Provider:')} ${model.provider}\n`;
    section += `${this.formatters.bold('Type:')} ${model.model_type}\n\n`;
    
    if (model.description) {
      section += `${model.description}\n\n`;
    }
    
    // Capabilities
    if (model.capabilities && model.capabilities.length > 0) {
      section += this.formatters.bold('Capabilities:') + '\n';
      for (const capability of model.capabilities) {
        section += this.formatters.list_item(capability);
      }
      section += '\n';
    }
    
    // Performance metrics
    if (model.performance_metrics) {
      section += this.formatters.bold('Performance:') + '\n';
      section += this.formatters.list_item(`Accuracy: ${model.performance_metrics.accuracy || 'N/A'}`);
      section += this.formatters.list_item(`Latency: ${model.performance_metrics.latency || 'N/A'}ms`);
      section += this.formatters.list_item(`Throughput: ${model.performance_metrics.throughput || 'N/A'} tokens/sec`);
      section += '\n';
    }
    
    // Cost information
    if (model.cost_data) {
      section += this.formatters.bold('Pricing:') + '\n';
      section += this.formatters.list_item(`Cost per token: $${model.cost_data.cost_per_token || 'N/A'}`);
      section += '\n';
    }
    
    section += this.formatters.horizontal_rule();
    
    return section;
  }

  // Utility methods
  calculateCatalogStatistics(data) {
    const providers = new Set(data.map(m => m.provider)).size;
    const modelTypes = new Set(data.map(m => m.model_type)).size;
    const validatedModels = data.filter(m => m.validation_status === 'validated').length;
    
    return {
      'Total Models': data.length,
      'Providers': providers,
      'Model Types': modelTypes,
      'Validated Models': validatedModels,
      'Validation Rate': `${Math.round(validatedModels / data.length * 100)}%`
    };
  }

  groupDataByProvider(data) {
    return data.reduce((groups, model) => {
      const provider = model.provider || 'unknown';
      if (!groups[provider]) {
        groups[provider] = [];
      }
      groups[provider].push(model);
      return groups;
    }, {});
  }

  groupDataByModelType(data) {
    return data.reduce((groups, model) => {
      const type = model.model_type || 'unknown';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(model);
      return groups;
    }, {});
  }

  getTopModels(data, count) {
    return data
      .filter(m => m.confidence_score)
      .sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0))
      .slice(0, count);
  }

  generateExportId() {
    return `md_export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getFileSize(path) {
    const stats = await fs.stat(path);
    return stats.size;
  }

  calculateChecksum(content) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  countWords(content) {
    return content.split(/\s+/).filter(word => word.length > 0).length;
  }

  countLinks(content) {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    return (content.match(linkRegex) || []).length;
  }

  // Placeholder methods for complex operations
  async createOutputDirectories() { 
    await fs.mkdir(this.markdownConfig.outputDirectory, { recursive: true }); 
  }
  async loadDocumentTemplates() { /* Implementation details */ }
  async initializeContentGenerators() { /* Implementation details */ }
  generateProviderSection(provider, models) { return `Provider section for ${provider}\n\n`; }
  calculatePerformanceStatistics(data) { 
    return {
      avgAccuracy: 0.85,
      avgLatency: 150,
      topPerformer: { name: 'GPT-4' },
      mostCostEffective: { name: 'Claude-3-Haiku' }
    };
  }
  getTopPerformers(data, count) { return data.slice(0, count); }
  generateQuickStartExample() { return 'curl -X GET "https://api.example.com/models"'; }
  generateEndpointsSection(data) { return 'API endpoints documentation\n\n'; }
  generateCodeExamplesSection(data) { return 'Code examples section\n\n'; }
  extractCommonUseCases(data) { return []; }
  getRecentlyUpdatedModels(data, count) { return data.slice(0, count); }
  formatMetricName(metric) { return metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); }
  formatPerformanceScore(metrics) { return metrics?.accuracy ? `${Math.round(metrics.accuracy * 100)}%` : 'N/A'; }
  formatCost(costData) { return costData?.cost_per_token ? `$${costData.cost_per_token}` : 'N/A'; }
  modelHasCapability(model, capability) { 
    return model.capabilities?.some(cap => cap.toLowerCase().includes(capability.toLowerCase()));
  }
  getDocumentTitle(templateName) { 
    return templateName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  formatSectionTitle(section) { 
    return section.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  generateAnchor(title) { 
    return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }
  formatCategoryName(category) { 
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  generateRecommendationsSection(data) { return 'Recommendations based on analysis\n\n'; }
  generatePerformanceChart(data) { return 'Performance chart would be generated here\n\n'; }
  generateCostComparison(data) { return 'Cost comparison table\n\n'; }
  generateProviderOverview(provider, models) { return `**${provider}**: ${models.length} models\n\n`; }
  generateDecisionTree(data) { return 'Decision tree for model selection\n\n'; }

  getStats() {
    return {
      initialized: this.isInitialized,
      markdown_cache: this.markdownCache.size,
      document_templates: Object.keys(this.documentTemplates).length,
      formatters: Object.keys(this.formatters).length,
      content_generators: Object.keys(this.contentGenerators).length
    };
  }

  async cleanup() {
    this.markdownCache.clear();
    this.isInitialized = false;
    this.logger.info('Markdown exporter cleaned up');
  }
}

export const markdownExporter = new MarkdownExporter();