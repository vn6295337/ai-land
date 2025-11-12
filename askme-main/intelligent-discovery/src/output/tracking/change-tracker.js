import { createLogger } from '../../core/infrastructure/logger.js';
import { jsonExporter } from '../formats/json-exporter.js';
import fs from 'fs/promises';
import path from 'path';

class ChangeTracker {
  constructor() {
    this.logger = createLogger({ component: 'change-tracker' });
    this.isInitialized = false;
    this.changeHistory = new Map();
    this.snapshotCache = new Map();
    
    // Change tracking configuration
    this.trackingConfig = {
      outputDirectory: './exports/changes',
      snapshotDirectory: './exports/snapshots',
      maxHistoryEntries: 1000,
      snapshotInterval: 24 * 60 * 60 * 1000, // 24 hours
      trackingEnabled: true,
      compressionEnabled: true,
      diffAlgorithm: 'myers'
    };
    
    // Change types and their priorities
    this.changeTypes = {
      'model_added': {
        priority: 'high',
        description: 'New model added to catalog',
        icon: '➕',
        color: 'green'
      },
      'model_removed': {
        priority: 'high',
        description: 'Model removed from catalog',
        icon: '➖',
        color: 'red'
      },
      'model_updated': {
        priority: 'medium',
        description: 'Model information updated',
        icon: '✏️',
        color: 'blue'
      },
      'performance_changed': {
        priority: 'medium',
        description: 'Performance metrics updated',
        icon: '📊',
        color: 'orange'
      },
      'cost_changed': {
        priority: 'medium',
        description: 'Pricing information updated',
        icon: '💰',
        color: 'yellow'
      },
      'availability_changed': {
        priority: 'high',
        description: 'Availability status changed',
        icon: '🔄',
        color: 'purple'
      },
      'capabilities_changed': {
        priority: 'medium',
        description: 'Model capabilities updated',
        icon: '🛠️',
        color: 'teal'
      },
      'validation_updated': {
        priority: 'low',
        description: 'Validation status updated',
        icon: '✅',
        color: 'green'
      },
      'metadata_changed': {
        priority: 'low',
        description: 'Metadata or documentation updated',
        icon: '📝',
        color: 'gray'
      }
    };
    
    // Diff report formats
    this.reportFormats = {
      'summary_report': {
        description: 'High-level summary of changes',
        filename: 'change_summary.md',
        processor: this.generateSummaryReport.bind(this)
      },
      'detailed_report': {
        description: 'Detailed diff report with full changes',
        filename: 'detailed_changes.md',
        processor: this.generateDetailedReport.bind(this)
      },
      'json_diff': {
        description: 'Machine-readable JSON diff format',
        filename: 'changes.json',
        processor: this.generateJSONDiff.bind(this)
      },
      'csv_changelog': {
        description: 'CSV format changelog for spreadsheet analysis',
        filename: 'changelog.csv',
        processor: this.generateCSVChangelog.bind(this)
      },
      'html_report': {
        description: 'Interactive HTML report with visualizations',
        filename: 'change_report.html',
        processor: this.generateHTMLReport.bind(this)
      }
    };
    
    // Diff algorithms
    this.diffAlgorithms = {
      'myers': this.myersDiff.bind(this),
      'patience': this.patienceDiff.bind(this),
      'histogram': this.histogramDiff.bind(this),
      'minimal': this.minimalDiff.bind(this)
    };
    
    // Change detection strategies
    this.detectionStrategies = {
      'deep_comparison': this.deepComparisonStrategy.bind(this),
      'hash_comparison': this.hashComparisonStrategy.bind(this),
      'field_tracking': this.fieldTrackingStrategy.bind(this),
      'semantic_diff': this.semanticDiffStrategy.bind(this)
    };
  }

  async initialize() {
    try {
      this.logger.info('Initializing change tracker');
      
      // Create output directories
      await this.createOutputDirectories();
      
      // Load change history
      await this.loadChangeHistory();
      
      // Initialize snapshot management
      await this.initializeSnapshotManagement();
      
      // Setup automatic change detection
      await this.setupAutomaticDetection();
      
      this.isInitialized = true;
      this.logger.info('Change tracker initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize change tracker', { error: error.message });
      throw error;
    }
  }

  async trackChanges(currentData, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Change tracker not initialized');
    }

    try {
      this.logger.info('Tracking changes in model data', {
        current_models: currentData.length,
        strategy: options.strategy || 'deep_comparison'
      });

      const startTime = Date.now();
      const changeId = this.generateChangeId();

      // Get previous snapshot for comparison
      const previousSnapshot = await this.getLatestSnapshot();
      
      if (!previousSnapshot) {
        this.logger.info('No previous snapshot found, creating initial snapshot');
        return await this.createInitialSnapshot(currentData, changeId);
      }

      // Detect changes using specified strategy
      const strategy = this.detectionStrategies[options.strategy || 'deep_comparison'];
      const detectedChanges = await strategy(previousSnapshot.data, currentData, options);

      // Filter and categorize changes
      const categorizedChanges = this.categorizeChanges(detectedChanges);

      // Generate change record
      const changeRecord = {
        change_id: changeId,
        timestamp: Date.now(),
        previous_snapshot_id: previousSnapshot.snapshot_id,
        current_data_checksum: this.calculateChecksum(currentData),
        changes: categorizedChanges,
        statistics: {
          total_changes: detectedChanges.length,
          changes_by_type: this.groupChangesByType(categorizedChanges),
          affected_models: this.getAffectedModels(categorizedChanges),
          processing_time: Date.now() - startTime
        },
        metadata: {
          detection_strategy: options.strategy || 'deep_comparison',
          change_threshold: options.threshold || 0.01,
          options_applied: options
        }
      };

      // Store change record
      await this.storeChangeRecord(changeRecord);

      // Create new snapshot if significant changes detected
      if (this.shouldCreateSnapshot(changeRecord)) {
        await this.createSnapshot(currentData, changeId);
      }

      // Update change history
      this.changeHistory.set(changeId, changeRecord);

      this.logger.info('Change tracking completed', {
        change_id: changeId,
        total_changes: changeRecord.statistics.total_changes,
        affected_models: changeRecord.statistics.affected_models,
        processing_time: changeRecord.statistics.processing_time
      });

      return changeRecord;

    } catch (error) {
      this.logger.error('Change tracking failed', { error: error.message });
      throw error;
    }
  }

  async generateDiffReport(changeId, formatName, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Change tracker not initialized');
    }

    try {
      this.logger.info('Generating diff report', {
        change_id: changeId,
        format: formatName
      });

      const format = this.reportFormats[formatName];
      if (!format) {
        throw new Error(`Unknown report format: ${formatName}`);
      }

      const changeRecord = this.changeHistory.get(changeId) || 
                          await this.loadChangeRecord(changeId);
      
      if (!changeRecord) {
        throw new Error(`Change record not found: ${changeId}`);
      }

      const startTime = Date.now();

      // Generate report content
      const reportContent = await format.processor(changeRecord, options);

      // Write report file
      const outputPath = await this.writeReportFile(
        reportContent, 
        format.filename, 
        changeId, 
        formatName
      );

      // Generate report summary
      const reportSummary = {
        report_id: this.generateReportId(),
        change_id: changeId,
        format: formatName,
        output_path: outputPath,
        file_size: await this.getFileSize(outputPath),
        generation_time: Date.now() - startTime,
        content_stats: this.analyzeReportContent(reportContent, formatName)
      };

      this.logger.info('Diff report generated', {
        format: formatName,
        file_size_kb: Math.round(reportSummary.file_size / 1024),
        generation_time: reportSummary.generation_time
      });

      return reportSummary;

    } catch (error) {
      this.logger.error('Diff report generation failed', { 
        change_id: changeId, 
        format: formatName, 
        error: error.message 
      });
      throw error;
    }
  }

  // Change detection strategies
  async deepComparisonStrategy(previousData, currentData, options) {
    const changes = [];
    
    // Create lookup maps for efficient comparison
    const previousModels = new Map(previousData.map(model => [model.id, model]));
    const currentModels = new Map(currentData.map(model => [model.id, model]));

    // Detect added models
    for (const [modelId, model] of currentModels) {
      if (!previousModels.has(modelId)) {
        changes.push({
          type: 'model_added',
          model_id: modelId,
          model_name: model.name,
          added_data: model,
          timestamp: Date.now()
        });
      }
    }

    // Detect removed models
    for (const [modelId, model] of previousModels) {
      if (!currentModels.has(modelId)) {
        changes.push({
          type: 'model_removed',
          model_id: modelId,
          model_name: model.name,
          removed_data: model,
          timestamp: Date.now()
        });
      }
    }

    // Detect updated models
    for (const [modelId, currentModel] of currentModels) {
      const previousModel = previousModels.get(modelId);
      if (previousModel) {
        const modelChanges = await this.compareModels(previousModel, currentModel);
        changes.push(...modelChanges);
      }
    }

    return changes;
  }

  async hashComparisonStrategy(previousData, currentData, options) {
    const changes = [];
    
    const previousHashes = new Map();
    const currentHashes = new Map();

    // Calculate hashes for previous data
    for (const model of previousData) {
      const hash = this.calculateModelHash(model);
      previousHashes.set(model.id, { model, hash });
    }

    // Calculate hashes for current data
    for (const model of currentData) {
      const hash = this.calculateModelHash(model);
      currentHashes.set(model.id, { model, hash });
    }

    // Compare hashes to detect changes
    for (const [modelId, current] of currentHashes) {
      const previous = previousHashes.get(modelId);
      
      if (!previous) {
        changes.push({
          type: 'model_added',
          model_id: modelId,
          model_name: current.model.name,
          added_data: current.model,
          timestamp: Date.now()
        });
      } else if (previous.hash !== current.hash) {
        const detailedChanges = await this.compareModels(previous.model, current.model);
        changes.push(...detailedChanges);
      }
    }

    // Detect removed models
    for (const [modelId, previous] of previousHashes) {
      if (!currentHashes.has(modelId)) {
        changes.push({
          type: 'model_removed',
          model_id: modelId,
          model_name: previous.model.name,
          removed_data: previous.model,
          timestamp: Date.now()
        });
      }
    }

    return changes;
  }

  async fieldTrackingStrategy(previousData, currentData, options) {
    const trackedFields = options.fields || [
      'name', 'provider', 'model_type', 'capabilities', 
      'performance_metrics', 'cost_data', 'availability_status'
    ];
    
    const changes = [];
    
    const previousModels = new Map(previousData.map(model => [model.id, model]));
    const currentModels = new Map(currentData.map(model => [model.id, model]));

    for (const [modelId, currentModel] of currentModels) {
      const previousModel = previousModels.get(modelId);
      
      if (!previousModel) {
        changes.push({
          type: 'model_added',
          model_id: modelId,
          model_name: currentModel.name,
          added_data: currentModel,
          timestamp: Date.now()
        });
        continue;
      }

      // Track specific fields
      for (const field of trackedFields) {
        const fieldChanges = await this.compareField(
          previousModel, 
          currentModel, 
          field
        );
        changes.push(...fieldChanges);
      }
    }

    return changes;
  }

  async semanticDiffStrategy(previousData, currentData, options) {
    // This would use semantic analysis to detect meaningful changes
    // For now, we'll use a simplified version that focuses on semantic fields
    const semanticFields = [
      'description', 'capabilities', 'use_cases', 'limitations'
    ];
    
    const changes = [];
    
    const previousModels = new Map(previousData.map(model => [model.id, model]));
    const currentModels = new Map(currentData.map(model => [model.id, model]));

    for (const [modelId, currentModel] of currentModels) {
      const previousModel = previousModels.get(modelId);
      
      if (previousModel) {
        for (const field of semanticFields) {
          const semanticChange = await this.detectSemanticChange(
            previousModel[field], 
            currentModel[field], 
            field
          );
          
          if (semanticChange) {
            changes.push({
              type: 'semantic_change',
              model_id: modelId,
              model_name: currentModel.name,
              field: field,
              semantic_change: semanticChange,
              timestamp: Date.now()
            });
          }
        }
      }
    }

    return changes;
  }

  // Model comparison methods
  async compareModels(previousModel, currentModel) {
    const changes = [];
    const modelId = currentModel.id;

    // Compare performance metrics
    if (this.hasSignificantChange(
      previousModel.performance_metrics, 
      currentModel.performance_metrics
    )) {
      changes.push({
        type: 'performance_changed',
        model_id: modelId,
        model_name: currentModel.name,
        field: 'performance_metrics',
        previous_value: previousModel.performance_metrics,
        current_value: currentModel.performance_metrics,
        change_details: this.analyzePerformanceChange(
          previousModel.performance_metrics,
          currentModel.performance_metrics
        ),
        timestamp: Date.now()
      });
    }

    // Compare cost data
    if (this.hasSignificantChange(previousModel.cost_data, currentModel.cost_data)) {
      changes.push({
        type: 'cost_changed',
        model_id: modelId,
        model_name: currentModel.name,
        field: 'cost_data',
        previous_value: previousModel.cost_data,
        current_value: currentModel.cost_data,
        change_details: this.analyzeCostChange(
          previousModel.cost_data,
          currentModel.cost_data
        ),
        timestamp: Date.now()
      });
    }

    // Compare availability status
    if (previousModel.availability_status !== currentModel.availability_status) {
      changes.push({
        type: 'availability_changed',
        model_id: modelId,
        model_name: currentModel.name,
        field: 'availability_status',
        previous_value: previousModel.availability_status,
        current_value: currentModel.availability_status,
        timestamp: Date.now()
      });
    }

    // Compare capabilities
    if (this.hasCapabilityChanges(previousModel.capabilities, currentModel.capabilities)) {
      changes.push({
        type: 'capabilities_changed',
        model_id: modelId,
        model_name: currentModel.name,
        field: 'capabilities',
        previous_value: previousModel.capabilities,
        current_value: currentModel.capabilities,
        change_details: this.analyzeCapabilityChanges(
          previousModel.capabilities,
          currentModel.capabilities
        ),
        timestamp: Date.now()
      });
    }

    return changes;
  }

  async compareField(previousModel, currentModel, field) {
    const changes = [];
    
    if (previousModel[field] !== currentModel[field]) {
      const changeType = this.inferChangeType(field);
      
      changes.push({
        type: changeType,
        model_id: currentModel.id,
        model_name: currentModel.name,
        field: field,
        previous_value: previousModel[field],
        current_value: currentModel[field],
        timestamp: Date.now()
      });
    }
    
    return changes;
  }

  // Report generators
  async generateSummaryReport(changeRecord, options) {
    let report = '';
    
    report += `# Change Summary Report\n\n`;
    report += `**Change ID:** ${changeRecord.change_id}\n`;
    report += `**Date:** ${new Date(changeRecord.timestamp).toLocaleDateString()}\n`;
    report += `**Total Changes:** ${changeRecord.statistics.total_changes}\n`;
    report += `**Affected Models:** ${changeRecord.statistics.affected_models}\n\n`;
    
    // Changes by type
    report += `## Changes by Type\n\n`;
    for (const [type, count] of Object.entries(changeRecord.statistics.changes_by_type)) {
      const typeConfig = this.changeTypes[type];
      const icon = typeConfig?.icon || '•';
      report += `${icon} **${this.formatChangeType(type)}:** ${count}\n`;
    }
    report += '\n';
    
    // Top changed models
    report += `## Most Changed Models\n\n`;
    const topChangedModels = this.getTopChangedModels(changeRecord.changes, 10);
    for (const model of topChangedModels) {
      report += `- **${model.name}** (${model.change_count} changes)\n`;
    }
    report += '\n';
    
    // Summary statistics
    report += `## Summary Statistics\n\n`;
    report += `- Processing Time: ${changeRecord.statistics.processing_time}ms\n`;
    report += `- Detection Strategy: ${changeRecord.metadata.detection_strategy}\n`;
    report += `- Previous Snapshot: ${changeRecord.previous_snapshot_id}\n\n`;
    
    return report;
  }

  async generateDetailedReport(changeRecord, options) {
    let report = '';
    
    report += `# Detailed Change Report\n\n`;
    report += `**Change ID:** ${changeRecord.change_id}\n`;
    report += `**Timestamp:** ${new Date(changeRecord.timestamp).toISOString()}\n\n`;
    
    // Group changes by type
    const changesByType = this.groupChangesByType(changeRecord.changes);
    
    for (const [type, changes] of Object.entries(changesByType)) {
      const typeConfig = this.changeTypes[type];
      report += `## ${typeConfig?.icon || '•'} ${this.formatChangeType(type)}\n\n`;
      
      for (const change of changes) {
        report += `### ${change.model_name || change.model_id}\n\n`;
        
        if (change.field) {
          report += `**Field:** ${change.field}\n`;
        }
        
        if (change.previous_value !== undefined) {
          report += `**Previous:** ${this.formatValue(change.previous_value)}\n`;
        }
        
        if (change.current_value !== undefined) {
          report += `**Current:** ${this.formatValue(change.current_value)}\n`;
        }
        
        if (change.change_details) {
          report += `**Details:** ${JSON.stringify(change.change_details, null, 2)}\n`;
        }
        
        report += '\n---\n\n';
      }
    }
    
    return report;
  }

  async generateJSONDiff(changeRecord, options) {
    return {
      change_record: changeRecord,
      diff_format: 'json',
      generated_at: new Date().toISOString(),
      options: options
    };
  }

  async generateCSVChangelog(changeRecord, options) {
    const csvRows = [];
    
    // Header
    csvRows.push([
      'timestamp', 'change_type', 'model_id', 'model_name', 
      'field', 'previous_value', 'current_value', 'change_details'
    ]);
    
    // Data rows
    for (const change of changeRecord.changes) {
      csvRows.push([
        new Date(change.timestamp).toISOString(),
        change.type,
        change.model_id || '',
        change.model_name || '',
        change.field || '',
        this.formatValueForCSV(change.previous_value),
        this.formatValueForCSV(change.current_value),
        change.change_details ? JSON.stringify(change.change_details) : ''
      ]);
    }
    
    // Convert to CSV string
    return csvRows.map(row => 
      row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
  }

  async generateHTMLReport(changeRecord, options) {
    // This would generate an interactive HTML report
    // For now, return a simple HTML structure
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Change Report - ${changeRecord.change_id}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .change-summary { background: #f5f5f5; padding: 15px; border-radius: 5px; }
        .change-type { margin: 10px 0; padding: 10px; border-left: 4px solid #007cba; }
        .stats { display: flex; gap: 20px; }
        .stat-box { background: white; padding: 10px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
    <h1>Change Report</h1>
    <div class="change-summary">
        <h2>Summary</h2>
        <p><strong>Change ID:</strong> ${changeRecord.change_id}</p>
        <p><strong>Date:</strong> ${new Date(changeRecord.timestamp).toLocaleString()}</p>
        <p><strong>Total Changes:</strong> ${changeRecord.statistics.total_changes}</p>
    </div>
    
    <div class="stats">
        ${Object.entries(changeRecord.statistics.changes_by_type).map(([type, count]) => `
            <div class="stat-box">
                <h3>${this.formatChangeType(type)}</h3>
                <p>${count} changes</p>
            </div>
        `).join('')}
    </div>
    
    <h2>Detailed Changes</h2>
    ${changeRecord.changes.map(change => `
        <div class="change-type">
            <h3>${change.model_name || change.model_id}</h3>
            <p><strong>Type:</strong> ${change.type}</p>
            ${change.field ? `<p><strong>Field:</strong> ${change.field}</p>` : ''}
        </div>
    `).join('')}
</body>
</html>`;
  }

  // Utility methods
  calculateChecksum(data) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  calculateModelHash(model) {
    // Create a stable hash of model data
    const relevantFields = {
      id: model.id,
      name: model.name,
      provider: model.provider,
      model_type: model.model_type,
      capabilities: model.capabilities,
      performance_metrics: model.performance_metrics,
      cost_data: model.cost_data,
      availability_status: model.availability_status
    };
    
    return this.calculateChecksum(relevantFields);
  }

  categorizeChanges(changes) {
    return changes.map(change => ({
      ...change,
      category: this.getChangeCategory(change.type),
      priority: this.changeTypes[change.type]?.priority || 'medium',
      impact_score: this.calculateChangeImpact(change)
    }));
  }

  generateChangeId() {
    return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateReportId() {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getFileSize(path) {
    const stats = await fs.stat(path);
    return stats.size;
  }

  // Placeholder methods for complex operations
  async createOutputDirectories() { 
    await fs.mkdir(this.trackingConfig.outputDirectory, { recursive: true });
    await fs.mkdir(this.trackingConfig.snapshotDirectory, { recursive: true });
  }
  async loadChangeHistory() { /* Implementation details */ }
  async initializeSnapshotManagement() { /* Implementation details */ }
  async setupAutomaticDetection() { /* Implementation details */ }
  async getLatestSnapshot() { return null; }
  async createInitialSnapshot(data, changeId) { return { snapshot_id: 'initial' }; }
  async createSnapshot(data, changeId) { /* Implementation details */ }
  async storeChangeRecord(record) { /* Implementation details */ }
  async loadChangeRecord(changeId) { return null; }
  shouldCreateSnapshot(changeRecord) { return changeRecord.statistics.total_changes > 10; }
  groupChangesByType(changes) { 
    return changes.reduce((groups, change) => {
      const type = change.type;
      if (!groups[type]) groups[type] = [];
      groups[type].push(change);
      return groups;
    }, {});
  }
  getAffectedModels(changes) { 
    return new Set(changes.map(c => c.model_id)).size;
  }
  async writeReportFile(content, filename, changeId, format) {
    const outputDir = path.join(this.trackingConfig.outputDirectory, changeId);
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, filename);
    await fs.writeFile(outputPath, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    return outputPath;
  }
  analyzeReportContent(content, format) { return { size: content.length }; }
  hasSignificantChange(prev, curr) { return JSON.stringify(prev) !== JSON.stringify(curr); }
  analyzePerformanceChange(prev, curr) { return { changed: true }; }
  analyzeCostChange(prev, curr) { return { changed: true }; }
  hasCapabilityChanges(prev, curr) { return JSON.stringify(prev) !== JSON.stringify(curr); }
  analyzeCapabilityChanges(prev, curr) { return { changed: true }; }
  inferChangeType(field) { 
    const fieldMap = {
      performance_metrics: 'performance_changed',
      cost_data: 'cost_changed',
      capabilities: 'capabilities_changed',
      availability_status: 'availability_changed'
    };
    return fieldMap[field] || 'model_updated';
  }
  async detectSemanticChange(prev, curr, field) { return null; }
  formatChangeType(type) { return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); }
  getTopChangedModels(changes, limit) { return []; }
  formatValue(value) { return typeof value === 'object' ? JSON.stringify(value) : String(value); }
  formatValueForCSV(value) { return typeof value === 'object' ? JSON.stringify(value) : String(value || ''); }
  getChangeCategory(type) { return 'general'; }
  calculateChangeImpact(change) { return 0.5; }
  
  // Diff algorithm implementations (simplified)
  myersDiff(prev, curr) { return []; }
  patienceDiff(prev, curr) { return []; }
  histogramDiff(prev, curr) { return []; }
  minimalDiff(prev, curr) { return []; }

  getStats() {
    return {
      initialized: this.isInitialized,
      change_history: this.changeHistory.size,
      snapshot_cache: this.snapshotCache.size,
      change_types: Object.keys(this.changeTypes).length,
      report_formats: Object.keys(this.reportFormats).length,
      diff_algorithms: Object.keys(this.diffAlgorithms).length
    };
  }

  async cleanup() {
    this.changeHistory.clear();
    this.snapshotCache.clear();
    this.isInitialized = false;
    this.logger.info('Change tracker cleaned up');
  }
}

export const changeTracker = new ChangeTracker();