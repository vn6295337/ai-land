#!/usr/bin/env node

/**
 * Supabase Integration Script for Scout Agent
 * Fetches validated_models.json from GitHub workflow runs and uploads to Supabase
 */

const https = require('https');
const fs = require('fs');

// Configuration
const CONFIG = {
  github: {
    owner: 'vn6295337',
    repo: 'askme',
    workflowFile: 'scout-agent.yml'
  },
  supabase: {
    url: 'https://pfmsevvxgvofqyrrtojk.supabase.co',
    // Add your anon key via environment variable: SUPABASE_ANON_KEY
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
        'Accept': 'application/vnd.github.v3+json',
        ...options.headers
      },
      ...options
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Fetch latest successful workflow run
 */
async function getLatestWorkflowRun() {
  console.log('📡 Fetching latest workflow runs...');
  
  const url = `https://api.github.com/repos/${CONFIG.github.owner}/${CONFIG.github.repo}/actions/workflows`;
  const workflows = await makeRequest(url);
  
  // Find scout-agent workflow
  const workflow = workflows.workflows?.find(w => w.name.includes('Scout Agent') || w.path.includes('scout-agent'));
  if (!workflow) {
    throw new Error('Scout Agent workflow not found');
  }
  
  // Get latest successful run
  const runsUrl = `https://api.github.com/repos/${CONFIG.github.owner}/${CONFIG.github.repo}/actions/workflows/${workflow.id}/runs?status=success&per_page=1`;
  const runs = await makeRequest(runsUrl);
  
  if (!runs.workflow_runs?.length) {
    throw new Error('No successful workflow runs found');
  }
  
  return runs.workflow_runs[0];
}

/**
 * Fetch validated_models.json from the repository
 */
async function fetchValidatedModels() {
  console.log('📥 Fetching validated_models.json from repository...');
  
  const url = `https://api.github.com/repos/${CONFIG.github.owner}/${CONFIG.github.repo}/contents/scout-agent/validated_models.json`;
  const response = await makeRequest(url);
  
  if (!response.content) {
    throw new Error('validated_models.json not found in repository');
  }
  
  // Decode base64 content
  const content = Buffer.from(response.content, 'base64').toString('utf8');
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
 * Upload data to Supabase
 */
async function uploadToSupabase(flattenedData) {
  console.log('📤 Uploading to Supabase...');
  
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseKey) {
    throw new Error('SUPABASE_ANON_KEY environment variable is required');
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
    body: JSON.stringify(flattenedData)
  });
  
  console.log('✅ Successfully uploaded to Supabase');
  return response;
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🚀 Starting Supabase sync for Scout Agent validated models...');
    
    // Check environment variables
    if (!process.env.SUPABASE_ANON_KEY) {
      console.error('❌ Missing SUPABASE_ANON_KEY environment variable');
      console.error('   Set it with: export SUPABASE_ANON_KEY="your_key_here"');
      process.exit(1);
    }
    
    // Step 1: Get latest workflow run info
    const latestRun = await getLatestWorkflowRun();
    console.log(`📋 Latest successful run: ${latestRun.html_url}`);
    console.log(`📅 Run completed: ${latestRun.updated_at}`);
    
    // Step 2: Fetch validated models data
    const validatedModels = await fetchValidatedModels();
    console.log(`📊 Found ${validatedModels.models.length} validated models`);
    
    // Step 3: Flatten data for Supabase
    const flattenedData = flattenModelData(validatedModels);
    console.log(`🔄 Flattened ${flattenedData.length} records`);
    
    // Step 4: Upload to Supabase
    await uploadToSupabase(flattenedData);
    
    // Summary
    console.log('\n📈 SYNC SUMMARY:');
    console.log(`   Models processed: ${validatedModels.models.length}`);
    console.log(`   Records uploaded: ${flattenedData.length}`);
    console.log(`   Validation timestamp: ${validatedModels.metadata.timestamp}`);
    console.log(`   Providers: ${validatedModels.metadata.providers_with_models.join(', ')}`);
    
    console.log('\n✨ Sync completed successfully!');
    
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, flattenModelData, fetchValidatedModels };