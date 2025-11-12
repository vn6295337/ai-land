#!/usr/bin/env node

/**
 * Backend Supabase Integration Script for Scout Agent
 * Uses the askme-backend-proxy to sync validated_models.json to Supabase
 */

const https = require('https');
const fs = require('fs');

// Configuration
const CONFIG = {
  backend: {
    baseUrl: 'https://askme-backend-proxy.onrender.com',
    syncEndpoint: '/api/scout/sync-supabase'
  },
  github: {
    owner: 'vn6295337',
    repo: 'askme',
    workflowFile: 'scout-agent.yml'
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
 * Fetch validated_models.json from the repository
 */
async function fetchValidatedModels() {
  console.log('📥 Fetching validated_models.json from repository...');
  
  const url = `https://api.github.com/repos/${CONFIG.github.owner}/${CONFIG.github.repo}/contents/scout-agent/validated_models.json`;
  const response = await makeRequest(url);
  
  if (!response.data.content) {
    throw new Error('validated_models.json not found in repository');
  }
  
  // Decode base64 content
  const content = Buffer.from(response.data.content, 'base64').toString('utf8');
  return JSON.parse(content);
}

/**
 * Flatten model data for Supabase insertion
 */
function flattenModelData(validatedModels) {
  console.log('🔄 Flattening model data...');
  
  const flattened = [];
  const metadata = validatedModels.metadata;
  
  validatedModels.models.forEach(model => {
    const flatRecord = {
      // Metadata fields
      validation_timestamp: metadata.timestamp,
      validation_trigger: metadata.trigger,
      validation_reason: metadata.reason,
      total_models_checked: metadata.total_models_checked,
      total_validated_models: metadata.total_validated_models,
      
      // Model fields
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
      
      // Capabilities (flattened)
      supports_chat: model.capabilities?.supports_chat || model.supports_chat,
      supports_completion: model.capabilities?.supports_completion || model.supports_completion,
      supports_vision: model.capabilities?.supports_vision || model.supports_vision,
      supports_function_calling: model.capabilities?.supports_function_calling || model.supports_function_calling,
      supports_streaming: model.capabilities?.supports_streaming || model.supports_streaming,
      max_context_length: model.capabilities?.max_context_length || model.max_context_length,
      input_cost_per_token: model.capabilities?.input_cost_per_token,
      output_cost_per_token: model.capabilities?.output_cost_per_token,
      deprecated: model.capabilities?.deprecated || model.deprecated,
      availability_status: model.capabilities?.availability_status || model.availability_status,
      
      // Add unique identifier
      record_id: `${model.provider}_${model.model_name}_${metadata.timestamp}`.replace(/[^a-zA-Z0-9_]/g, '_')
    };
    
    flattened.push(flatRecord);
  });
  
  return flattened;
}

/**
 * Send data to backend for Supabase sync
 */
async function syncViaBackend(flattenedData, metadata) {
  console.log('📤 Sending data to backend for Supabase sync...');
  
  const payload = {
    action: 'sync-validated-models',
    data: flattenedData,
    metadata: metadata,
    config: {
      supabase_url: CONFIG.supabase.url,
      table_name: CONFIG.supabase.table
    }
  };
  
  const headers = {};
  if (process.env.AGENT_AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.AGENT_AUTH_TOKEN}`;
  }
  
  const response = await makeRequest(`${CONFIG.backend.baseUrl}${CONFIG.backend.syncEndpoint}`, {
    method: 'POST',
    headers: headers,
    body: payload
  });
  
  if (response.status !== 200) {
    throw new Error(`Backend sync failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }
  
  console.log('✅ Successfully synced via backend');
  return response.data;
}

/**
 * Alternative: Direct Supabase sync if backend endpoint doesn't exist
 */
async function directSupabaseSync(flattenedData) {
  console.log('📤 Direct Supabase sync (fallback)...');
  
  // Check if we have access to environment variables
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseKey) {
    throw new Error('SUPABASE_ANON_KEY not available for direct sync');
  }
  
  const url = `${CONFIG.supabase.url}/rest/v1/${CONFIG.supabase.table}`;
  
  const response = await makeRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
      'Prefer': 'return=minimal'
    },
    body: flattenedData
  });
  
  if (response.status >= 400) {
    throw new Error(`Supabase sync failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }
  
  console.log('✅ Successfully uploaded to Supabase directly');
  return response.data;
}

/**
 * Check if backend sync endpoint exists
 */
async function checkBackendEndpoint() {
  try {
    const response = await makeRequest(`${CONFIG.backend.baseUrl}/health`);
    console.log('🔍 Backend health check:', response.status === 200 ? 'OK' : 'Failed');
    
    // Try to check if our specific endpoint exists
    const syncCheck = await makeRequest(`${CONFIG.backend.baseUrl}${CONFIG.backend.syncEndpoint}`, {
      method: 'POST',
      body: { test: true }
    });
    
    // If we get back available endpoints, the sync endpoint doesn't exist
    if (syncCheck.data && syncCheck.data.availableEndpoints) {
      console.log('📋 Available backend endpoints:', syncCheck.data.availableEndpoints.join(', '));
      return false;
    }
    
    return syncCheck.status < 500; // If it's not a server error, endpoint likely exists
  } catch (error) {
    console.log('⚠️  Backend endpoint check failed:', error.message);
    return false;
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🚀 Starting Supabase sync for Scout Agent validated models...');
    console.log('🎯 Using backend:', CONFIG.backend.baseUrl);
    
    // Step 1: Fetch validated models data
    const validatedModels = await fetchValidatedModels();
    console.log(`📊 Found ${validatedModels.models.length} validated models`);
    
    // Step 2: Flatten data for Supabase
    const flattenedData = flattenModelData(validatedModels);
    console.log(`🔄 Flattened ${flattenedData.length} records`);
    
    // Step 3: Check if backend endpoint exists
    const backendAvailable = await checkBackendEndpoint();
    
    let syncResult;
    if (backendAvailable) {
      // Step 4a: Sync via backend (preferred)
      console.log('📡 Using backend sync endpoint...');
      syncResult = await syncViaBackend(flattenedData, validatedModels.metadata);
    } else {
      // Step 4b: Direct sync (fallback)
      console.log('📡 Backend endpoint not available, trying direct sync...');
      syncResult = await directSupabaseSync(flattenedData);
    }
    
    // Summary
    console.log('\n📈 SYNC SUMMARY:');
    console.log(`   Models processed: ${validatedModels.models.length}`);
    console.log(`   Records uploaded: ${flattenedData.length}`);
    console.log(`   Validation timestamp: ${validatedModels.metadata.timestamp}`);
    console.log(`   Providers: ${validatedModels.metadata.providers_with_models.join(', ')}`);
    console.log(`   Sync method: ${backendAvailable ? 'Backend proxy' : 'Direct'}`);
    
    console.log('\n✨ Sync completed successfully!');
    
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    
    // Provide helpful debugging info
    console.error('\n🔍 Debug info:');
    console.error(`   Backend URL: ${CONFIG.backend.baseUrl}`);
    console.error(`   Supabase URL: ${CONFIG.supabase.url}`);
    console.error(`   Auth token available: ${!!process.env.AGENT_AUTH_TOKEN}`);
    console.error(`   Supabase key available: ${!!process.env.SUPABASE_ANON_KEY}`);
    
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { 
  main, 
  flattenModelData, 
  fetchValidatedModels, 
  syncViaBackend,
  directSupabaseSync 
};