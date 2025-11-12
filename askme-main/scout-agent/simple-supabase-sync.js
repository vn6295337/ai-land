#!/usr/bin/env node

/**
 * Simple Supabase Sync Script
 * Works directly with Supabase since we need your backend's environment variables
 */

const https = require('https');

// Configuration
const CONFIG = {
  github: {
    owner: 'vn6295337',
    repo: 'askme'
  },
  supabase: {
    url: 'https://pfmsevvxgvofqyrrtojk.supabase.co',
    table: 'validated_models'
  }
};

/**
 * Make HTTP request wrapper
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      headers: {
        'User-Agent': 'askme-scout-agent/1.0.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });
    
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

/**
 * Fetch validated_models.json from repository
 */
async function fetchValidatedModels() {
  console.log('📥 Fetching validated_models.json from repository...');
  
  const url = `https://api.github.com/repos/${CONFIG.github.owner}/${CONFIG.github.repo}/contents/scout-agent/validated_models.json`;
  const response = await makeRequest(url);
  
  if (!response.data.content) {
    throw new Error('validated_models.json not found in repository');
  }
  
  const content = Buffer.from(response.data.content, 'base64').toString('utf8');
  return JSON.parse(content);
}

/**
 * Create flattened data for display
 */
function createFlattenedData(validatedModels) {
  console.log('🔄 Preparing data structure...');
  
  const flattened = [];
  const metadata = validatedModels.metadata;
  
  validatedModels.models.forEach(model => {
    const flatRecord = {
      record_id: `${model.provider}_${model.model_name}_${metadata.timestamp}`.replace(/[^a-zA-Z0-9_]/g, '_'),
      validation_timestamp: metadata.timestamp,
      validation_trigger: metadata.trigger,
      validation_reason: metadata.reason,
      total_models_checked: metadata.total_models_checked,
      total_validated_models: metadata.total_validated_models,
      model_name: model.model_name,
      provider: model.provider,
      api_available: model.api_available,
      registration_required: model.registration_required,
      free_tier: model.free_tier,
      auth_method: model.auth_method,
      documentation_url: model.documentation_url,
      backend_url: model.backend_url,
      health_status: model.health_status,
      test_result: model.test_result,
      response_time: model.response_time,
      last_validated: model.last_validated,
      geographic_origin_verified: model.geographic_origin_verified,
      allowed_region: model.allowed_region,
      origin_reason: model.origin_reason,
      supports_chat: model.capabilities?.supports_chat || model.supports_chat,
      supports_completion: model.capabilities?.supports_completion || model.supports_completion,
      supports_vision: model.capabilities?.supports_vision || model.supports_vision,
      supports_function_calling: model.capabilities?.supports_function_calling || model.supports_function_calling,
      supports_streaming: model.capabilities?.supports_streaming || model.supports_streaming,
      max_context_length: model.capabilities?.max_context_length || model.max_context_length,
      input_cost_per_token: model.capabilities?.input_cost_per_token,
      output_cost_per_token: model.capabilities?.output_cost_per_token,
      deprecated: model.capabilities?.deprecated || model.deprecated,
      availability_status: model.capabilities?.availability_status || model.availability_status
    };
    
    flattened.push(flatRecord);
  });
  
  return flattened;
}

/**
 * Save data locally for inspection
 */
function saveDataLocally(flattenedData, metadata) {
  const fs = require('fs');
  
  const outputData = {
    metadata: metadata,
    flattened_records: flattenedData,
    total_records: flattenedData.length,
    generated_at: new Date().toISOString()
  };
  
  fs.writeFileSync('./supabase-ready-data.json', JSON.stringify(outputData, null, 2));
  
  // Also create SQL insert statements
  const sqlStatements = flattenedData.map(record => {
    const values = Object.values(record).map(val => {
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'boolean') return val;
      if (typeof val === 'number') return val;
      return `'${String(val).replace(/'/g, "''")}'`;
    }).join(', ');
    
    return `INSERT INTO ${CONFIG.supabase.table} (${Object.keys(record).join(', ')}) VALUES (${values});`;
  });
  
  fs.writeFileSync('./supabase-insert.sql', sqlStatements.join('\n'));
  
  console.log('💾 Files created:');
  console.log('   - supabase-ready-data.json (complete data)');
  console.log('   - supabase-insert.sql (SQL statements)');
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🚀 Starting Scout Agent data preparation...');
    
    // Fetch and process data
    const validatedModels = await fetchValidatedModels();
    console.log(`📊 Found ${validatedModels.models.length} validated models`);
    
    const flattenedData = createFlattenedData(validatedModels);
    console.log(`🔄 Prepared ${flattenedData.length} records`);
    
    // Save locally for inspection
    saveDataLocally(flattenedData, validatedModels.metadata);
    
    // Show summary
    console.log('\n📈 DATA SUMMARY:');
    console.log(`   Models processed: ${validatedModels.models.length}`);
    console.log(`   Records prepared: ${flattenedData.length}`);
    console.log(`   Validation timestamp: ${validatedModels.metadata.timestamp}`);
    console.log(`   Providers: ${validatedModels.metadata.providers_with_models.join(', ')}`);
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Review the generated files:');
    console.log('   - supabase-ready-data.json');
    console.log('   - supabase-insert.sql');
    console.log('2. Add the backend endpoint from backend-endpoint-example.js to your backend');
    console.log('3. Create the Supabase table using the SQL from README-supabase.md');
    console.log('4. Run the backend sync script once endpoint is ready');
    
    console.log('\n✨ Data preparation completed!');
    
  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, fetchValidatedModels, createFlattenedData };