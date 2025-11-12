import { createLogger } from '../../core/infrastructure/logger.js';
import { jsonExporter } from '../../output/formats/json-exporter.js';
import { changeTracker } from '../../output/tracking/change-tracker.js';
import { createClient } from '@supabase/supabase-js';

class SupabaseSync {
  constructor() {
    this.logger = createLogger({ component: 'supabase-sync' });
    this.isInitialized = false;
    this.supabaseClient = null;
    this.syncHistory = new Map();
    
    // Supabase synchronization configuration
    this.syncConfig = {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_ANON_KEY,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      tableName: 'validated_models',
      batchSize: 1000,
      maxRetries: 3,
      retryDelay: 5000,
      timeoutMs: 30000,
      enableRealtime: true,
      conflictResolution: 'upsert'
    };
    
    // Database schema definition
    this.databaseSchema = {
      table_name: 'validated_models',
      primary_key: 'id',
      columns: {
        id: { type: 'text', nullable: false, primary: true },
        name: { type: 'text', nullable: false },
        provider: { type: 'text', nullable: false },
        model_type: { type: 'text', nullable: false },
        capabilities: { type: 'jsonb', nullable: true },
        performance_metrics: { type: 'jsonb', nullable: true },
        cost_data: { type: 'jsonb', nullable: true },
        availability_status: { type: 'text', nullable: false, default: 'unknown' },
        last_validated: { type: 'timestamptz', nullable: true },
        confidence_score: { type: 'real', nullable: false, default: 0 },
        created_at: { type: 'timestamptz', nullable: false, default: 'now()' },
        updated_at: { type: 'timestamptz', nullable: false, default: 'now()' },
        description: { type: 'text', nullable: true },
        parameters: { type: 'jsonb', nullable: true },
        training_data: { type: 'jsonb', nullable: true },
        hardware_requirements: { type: 'jsonb', nullable: true },
        api_endpoints: { type: 'jsonb', nullable: true },
        documentation_links: { type: 'jsonb', nullable: true },
        usage_examples: { type: 'jsonb', nullable: true },
        limitations: { type: 'jsonb', nullable: true },
        benchmark_results: { type: 'jsonb', nullable: true },
        user_ratings: { type: 'jsonb', nullable: true },
        popularity_score: { type: 'real', nullable: false, default: 0 },
        tags: { type: 'jsonb', nullable: true }
      },
      indexes: [
        { name: 'idx_validated_models_provider', columns: ['provider'] },
        { name: 'idx_validated_models_type', columns: ['model_type'] },
        { name: 'idx_validated_models_status', columns: ['availability_status'] },
        { name: 'idx_validated_models_updated', columns: ['updated_at'] },
        { name: 'idx_validated_models_confidence', columns: ['confidence_score'] },
        { name: 'idx_validated_models_popularity', columns: ['popularity_score'] }
      ],
      rls_policies: [
        {
          name: 'Enable read access for all users',
          command: 'SELECT',
          roles: ['anon', 'authenticated'],
          using: 'true'
        },
        {
          name: 'Enable insert for service role only',
          command: 'INSERT',
          roles: ['service_role'],
          check: 'true'
        },
        {
          name: 'Enable update for service role only',
          command: 'UPDATE',
          roles: ['service_role'],
          using: 'true'
        }
      ]
    };
    
    // Synchronization strategies
    this.syncStrategies = {
      'full_sync': {
        description: 'Complete database replacement',
        processor: this.performFullSync.bind(this)
      },
      'incremental_sync': {
        description: 'Update only changed records',
        processor: this.performIncrementalSync.bind(this)
      },
      'batch_upsert': {
        description: 'Batch upsert with conflict resolution',
        processor: this.performBatchUpsert.bind(this)
      },
      'change_based_sync': {
        description: 'Sync based on change tracking',
        processor: this.performChangeBasedSync.bind(this)
      }
    };
    
    // Data validation rules
    this.validationRules = {
      required_fields: ['id', 'name', 'provider', 'model_type'],
      field_validators: {
        id: (value) => typeof value === 'string' && value.length > 0,
        name: (value) => typeof value === 'string' && value.length > 0,
        provider: (value) => typeof value === 'string' && value.length > 0,
        model_type: (value) => typeof value === 'string' && value.length > 0,
        confidence_score: (value) => typeof value === 'number' && value >= 0 && value <= 1,
        popularity_score: (value) => typeof value === 'number' && value >= 0
      },
      json_fields: [
        'capabilities', 'performance_metrics', 'cost_data', 'parameters',
        'training_data', 'hardware_requirements', 'api_endpoints',
        'documentation_links', 'usage_examples', 'limitations',
        'benchmark_results', 'user_ratings', 'tags'
      ]
    };
    
    // Sync monitoring metrics
    this.syncMetrics = {
      total_syncs: 0,
      successful_syncs: 0,
      failed_syncs: 0,
      records_synced: 0,
      last_sync_duration: 0,
      average_sync_duration: 0,
      error_rate: 0
    };
  }

  async initialize() {
    try {
      this.logger.info('Initializing Supabase sync');
      
      // Validate configuration
      await this.validateConfiguration();
      
      // Initialize Supabase client
      await this.initializeSupabaseClient();
      
      // Verify database schema
      await this.verifyDatabaseSchema();
      
      // Setup real-time subscriptions if enabled
      if (this.syncConfig.enableRealtime) {
        await this.setupRealtimeSubscriptions();
      }
      
      // Load sync history
      await this.loadSyncHistory();
      
      this.isInitialized = true;
      this.logger.info('Supabase sync initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Supabase sync', { error: error.message });
      throw error;
    }
  }

  async syncToSupabase(data, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Supabase sync not initialized');
    }

    try {
      this.logger.info('Starting Supabase synchronization', {
        records: data?.length || 0,
        strategy: options.strategy || 'batch_upsert',
        dry_run: options.dryRun || false
      });

      const startTime = Date.now();
      const syncId = this.generateSyncId();

      // Prepare sync data
      let syncData = data;
      if (!syncData) {
        syncData = await this.prepareSyncData(options);
      }

      // Validate data before sync
      const validationResults = await this.validateSyncData(syncData);
      if (validationResults.errors.length > 0) {
        throw new Error(`Data validation failed: ${validationResults.errors.join(', ')}`);
      }

      // Select and execute sync strategy
      const strategy = this.syncStrategies[options.strategy || 'batch_upsert'];
      if (!strategy) {
        throw new Error(`Unknown sync strategy: ${options.strategy}`);
      }

      let syncResults;
      if (options.dryRun) {
        syncResults = await this.performDryRun(syncData, strategy);
      } else {
        syncResults = await strategy.processor(syncData, options);
      }

      // Generate sync record
      const syncRecord = {
        sync_id: syncId,
        timestamp: Date.now(),
        strategy: options.strategy || 'batch_upsert',
        dry_run: options.dryRun || false,
        input_records: syncData.length,
        sync_results: syncResults,
        processing_time: Date.now() - startTime,
        success: syncResults.success,
        metadata: {
          validation_results: validationResults,
          supabase_response: syncResults.supabase_response,
          options_applied: options
        }
      };

      // Update metrics
      this.updateSyncMetrics(syncRecord);

      // Store sync history
      await this.storeSyncRecord(syncRecord);
      this.syncHistory.set(syncId, syncRecord);

      this.logger.info('Supabase synchronization completed', {
        sync_id: syncId,
        success: syncRecord.success,
        records_processed: syncResults.records_processed,
        processing_time: syncRecord.processing_time
      });

      return syncRecord;

    } catch (error) {
      this.syncMetrics.failed_syncs++;
      this.logger.error('Supabase synchronization failed', { error: error.message });
      throw error;
    }
  }

  // Sync strategy implementations
  async performFullSync(data, options) {
    this.logger.debug('Performing full synchronization');

    const results = {
      success: false,
      records_processed: 0,
      records_inserted: 0,
      records_updated: 0,
      records_deleted: 0,
      errors: []
    };

    try {
      // Begin transaction
      await this.supabaseClient.rpc('begin_transaction');

      // Clear existing data (if specified)
      if (options.clearExisting) {
        const { error: deleteError } = await this.supabaseClient
          .from(this.syncConfig.tableName)
          .delete()
          .neq('id', ''); // Delete all records

        if (deleteError) {
          throw new Error(`Failed to clear existing data: ${deleteError.message}`);
        }
        results.records_deleted = await this.getTableRowCount();
      }

      // Insert all new data
      const batches = this.createBatches(data, this.syncConfig.batchSize);
      
      for (const batch of batches) {
        const { data: insertedData, error } = await this.supabaseClient
          .from(this.syncConfig.tableName)
          .insert(batch)
          .select();

        if (error) {
          results.errors.push(`Batch insert failed: ${error.message}`);
          continue;
        }

        results.records_inserted += insertedData?.length || 0;
        results.records_processed += batch.length;
      }

      // Commit transaction
      await this.supabaseClient.rpc('commit_transaction');
      
      results.success = results.errors.length === 0;
      
    } catch (error) {
      // Rollback transaction
      await this.supabaseClient.rpc('rollback_transaction');
      results.errors.push(`Transaction failed: ${error.message}`);
      results.success = false;
    }

    return results;
  }

  async performIncrementalSync(data, options) {
    this.logger.debug('Performing incremental synchronization');

    const results = {
      success: false,
      records_processed: 0,
      records_inserted: 0,
      records_updated: 0,
      errors: []
    };

    try {
      // Get existing records for comparison
      const existingRecords = await this.getExistingRecords();
      const existingIds = new Set(existingRecords.map(r => r.id));

      // Separate new and existing records
      const newRecords = data.filter(record => !existingIds.has(record.id));
      const updateRecords = data.filter(record => existingIds.has(record.id));

      // Insert new records
      if (newRecords.length > 0) {
        const insertBatches = this.createBatches(newRecords, this.syncConfig.batchSize);
        
        for (const batch of insertBatches) {
          const { data: insertedData, error } = await this.supabaseClient
            .from(this.syncConfig.tableName)
            .insert(batch)
            .select();

          if (error) {
            results.errors.push(`Insert batch failed: ${error.message}`);
            continue;
          }

          results.records_inserted += insertedData?.length || 0;
        }
      }

      // Update existing records
      if (updateRecords.length > 0) {
        for (const record of updateRecords) {
          const { data: updatedData, error } = await this.supabaseClient
            .from(this.syncConfig.tableName)
            .update({ ...record, updated_at: new Date().toISOString() })
            .eq('id', record.id)
            .select();

          if (error) {
            results.errors.push(`Update failed for ${record.id}: ${error.message}`);
            continue;
          }

          if (updatedData?.length > 0) {
            results.records_updated++;
          }
        }
      }

      results.records_processed = newRecords.length + updateRecords.length;
      results.success = results.errors.length === 0;

    } catch (error) {
      results.errors.push(`Incremental sync failed: ${error.message}`);
      results.success = false;
    }

    return results;
  }

  async performBatchUpsert(data, options) {
    this.logger.debug('Performing batch upsert synchronization');

    const results = {
      success: false,
      records_processed: 0,
      records_upserted: 0,
      errors: []
    };

    try {
      const batches = this.createBatches(data, this.syncConfig.batchSize);
      
      for (const batch of batches) {
        // Add updated_at timestamp to all records
        const batchWithTimestamp = batch.map(record => ({
          ...record,
          updated_at: new Date().toISOString()
        }));

        const { data: upsertedData, error } = await this.supabaseClient
          .from(this.syncConfig.tableName)
          .upsert(batchWithTimestamp, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          })
          .select();

        if (error) {
          results.errors.push(`Batch upsert failed: ${error.message}`);
          continue;
        }

        results.records_upserted += upsertedData?.length || 0;
        results.records_processed += batch.length;
      }

      results.success = results.errors.length === 0;

    } catch (error) {
      results.errors.push(`Batch upsert failed: ${error.message}`);
      results.success = false;
    }

    return results;
  }

  async performChangeBasedSync(data, options) {
    this.logger.debug('Performing change-based synchronization');

    const results = {
      success: false,
      records_processed: 0,
      changes_applied: 0,
      errors: []
    };

    try {
      // Get change tracking data
      const changes = options.changes || await this.getLatestChanges();
      
      if (!changes || changes.length === 0) {
        this.logger.info('No changes detected, skipping sync');
        results.success = true;
        return results;
      }

      // Process changes by type
      const changesByType = this.groupChangesByType(changes);

      // Handle model additions
      if (changesByType.model_added) {
        const addedModels = changesByType.model_added.map(change => change.added_data);
        const insertResults = await this.insertRecords(addedModels);
        results.changes_applied += insertResults.records_inserted;
        results.errors.push(...insertResults.errors);
      }

      // Handle model updates
      if (changesByType.model_updated || changesByType.performance_changed || 
          changesByType.cost_changed || changesByType.capabilities_changed) {
        const updateChanges = [
          ...(changesByType.model_updated || []),
          ...(changesByType.performance_changed || []),
          ...(changesByType.cost_changed || []),
          ...(changesByType.capabilities_changed || [])
        ];

        for (const change of updateChanges) {
          const updateResult = await this.updateRecord(change);
          if (updateResult.success) {
            results.changes_applied++;
          } else {
            results.errors.push(...updateResult.errors);
          }
        }
      }

      // Handle model deletions
      if (changesByType.model_removed) {
        const deletedIds = changesByType.model_removed.map(change => change.model_id);
        const deleteResults = await this.deleteRecords(deletedIds);
        results.changes_applied += deleteResults.records_deleted;
        results.errors.push(...deleteResults.errors);
      }

      results.records_processed = changes.length;
      results.success = results.errors.length === 0;

    } catch (error) {
      results.errors.push(`Change-based sync failed: ${error.message}`);
      results.success = false;
    }

    return results;
  }

  // Data validation and preparation
  async validateSyncData(data) {
    const validationResults = {
      valid_records: 0,
      invalid_records: 0,
      errors: [],
      warnings: []
    };

    for (const record of data) {
      const recordValidation = this.validateRecord(record);
      
      if (recordValidation.valid) {
        validationResults.valid_records++;
      } else {
        validationResults.invalid_records++;
        validationResults.errors.push(
          `Record ${record.id || 'unknown'}: ${recordValidation.errors.join(', ')}`
        );
      }
    }

    return validationResults;
  }

  validateRecord(record) {
    const validation = { valid: true, errors: [] };

    // Check required fields
    for (const field of this.validationRules.required_fields) {
      if (!record[field]) {
        validation.valid = false;
        validation.errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate field types and values
    for (const [field, validator] of Object.entries(this.validationRules.field_validators)) {
      if (record[field] !== undefined && !validator(record[field])) {
        validation.valid = false;
        validation.errors.push(`Invalid value for field: ${field}`);
      }
    }

    // Validate JSON fields
    for (const field of this.validationRules.json_fields) {
      if (record[field] !== undefined && typeof record[field] === 'object') {
        try {
          JSON.stringify(record[field]);
        } catch (error) {
          validation.valid = false;
          validation.errors.push(`Invalid JSON in field: ${field}`);
        }
      }
    }

    return validation;
  }

  async prepareSyncData(options) {
    this.logger.debug('Preparing sync data from exports');

    // Generate validated models JSON export
    const exportResult = await jsonExporter.exportValidatedModels({
      format: 'supabase_ready',
      ...options
    });

    if (!exportResult || !exportResult.output_path) {
      throw new Error('Failed to generate export data');
    }

    // Read and parse the exported data
    const fs = require('fs').promises;
    const exportContent = await fs.readFile(exportResult.output_path, 'utf8');
    const exportData = JSON.parse(exportContent);

    return exportData.models || [];
  }

  // Helper methods
  async validateConfiguration() {
    if (!this.syncConfig.supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is required');
    }
    
    if (!this.syncConfig.supabaseKey && !this.syncConfig.serviceRoleKey) {
      throw new Error('SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY is required');
    }
  }

  async initializeSupabaseClient() {
    const supabaseKey = this.syncConfig.serviceRoleKey || this.syncConfig.supabaseKey;
    
    this.supabaseClient = createClient(this.syncConfig.supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          'User-Agent': 'AI-Model-Discovery/1.0.0'
        }
      }
    });

    // Test connection
    const { data, error } = await this.supabaseClient
      .from(this.syncConfig.tableName)
      .select('count(*)')
      .limit(1);

    if (error && !error.message.includes('does not exist')) {
      throw new Error(`Failed to connect to Supabase: ${error.message}`);
    }
  }

  async verifyDatabaseSchema() {
    // This would verify that the database schema matches expectations
    // For now, we'll do a simple table existence check
    const { data, error } = await this.supabaseClient
      .from(this.syncConfig.tableName)
      .select('id')
      .limit(1);

    if (error && error.message.includes('does not exist')) {
      this.logger.warn(`Table ${this.syncConfig.tableName} does not exist. Please create it first.`);
      // Optionally, we could create the table here
    }
  }

  createBatches(data, batchSize) {
    const batches = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    return batches;
  }

  generateSyncId() {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  updateSyncMetrics(record) {
    this.syncMetrics.total_syncs++;
    
    if (record.success) {
      this.syncMetrics.successful_syncs++;
    } else {
      this.syncMetrics.failed_syncs++;
    }
    
    this.syncMetrics.records_synced += record.sync_results.records_processed || 0;
    this.syncMetrics.last_sync_duration = record.processing_time;
    
    // Calculate average duration
    this.syncMetrics.average_sync_duration = 
      (this.syncMetrics.average_sync_duration * (this.syncMetrics.total_syncs - 1) + 
       record.processing_time) / this.syncMetrics.total_syncs;
    
    // Calculate error rate
    this.syncMetrics.error_rate = this.syncMetrics.failed_syncs / this.syncMetrics.total_syncs;
  }

  // Placeholder methods for complex operations
  async setupRealtimeSubscriptions() { /* Implementation details */ }
  async loadSyncHistory() { /* Implementation details */ }
  async performDryRun(data, strategy) { 
    return { success: true, records_processed: data.length, dry_run: true }; 
  }
  async storeSyncRecord(record) { /* Implementation details */ }
  async getExistingRecords() { return []; }
  async getTableRowCount() { return 0; }
  async getLatestChanges() { return []; }
  groupChangesByType(changes) { 
    return changes.reduce((groups, change) => {
      if (!groups[change.type]) groups[change.type] = [];
      groups[change.type].push(change);
      return groups;
    }, {});
  }
  async insertRecords(records) { 
    return { records_inserted: records.length, errors: [] }; 
  }
  async updateRecord(change) { 
    return { success: true, errors: [] }; 
  }
  async deleteRecords(ids) { 
    return { records_deleted: ids.length, errors: [] }; 
  }

  getStats() {
    return {
      initialized: this.isInitialized,
      sync_history: this.syncHistory.size,
      metrics: this.syncMetrics,
      strategies: Object.keys(this.syncStrategies).length,
      table_name: this.syncConfig.tableName
    };
  }

  async cleanup() {
    if (this.supabaseClient) {
      // Close any open connections
      this.supabaseClient = null;
    }
    
    this.syncHistory.clear();
    this.isInitialized = false;
    this.logger.info('Supabase sync cleaned up');
  }
}

export const supabaseSync = new SupabaseSync();