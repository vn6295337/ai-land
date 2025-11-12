#!/usr/bin/env node

/**
 * Test script for Supabase integration
 * Run this after adding the endpoint to your backend
 */

const https = require('https');

const CONFIG = {
  backend: 'https://askme-backend-proxy.onrender.com',
  endpoints: {
    health: '/api/scout/sync-health',
    sync: '/api/scout/sync-supabase'
  }
};

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      headers: {
        'User-Agent': 'askme-scout-agent-test/1.0.0',
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

async function testHealthEndpoint() {
  console.log('🔍 Testing health endpoint...');
  
  try {
    const response = await makeRequest(`${CONFIG.backend}${CONFIG.endpoints.health}`);
    
    if (response.status === 200) {
      console.log('✅ Health endpoint working');
      console.log(`   Supabase configured: ${response.data.environment?.supabase_configured}`);
      console.log(`   Auth configured: ${response.data.environment?.auth_configured}`);
      return true;
    } else {
      console.log(`❌ Health endpoint failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Health endpoint error: ${error.message}`);
    return false;
  }
}

async function testSyncEndpoint() {
  console.log('🧪 Testing sync endpoint with sample data...');
  
  // Create a small test payload
  const testPayload = {
    action: 'sync-validated-models',
    data: [
      {
        record_id: 'test_model_' + Date.now(),
        validation_timestamp: new Date().toISOString(),
        validation_trigger: 'manual_test',
        validation_reason: 'Testing integration',
        total_models_checked: 1,
        total_validated_models: 1,
        model_name: 'test-model',
        provider: 'test-provider',
        api_available: true,
        registration_required: false,
        free_tier: true,
        auth_method: 'test',
        documentation_url: 'https://example.com',
        backend_url: 'https://example.com',
        health_status: 'available',
        test_result: 'Integration test',
        response_time: 'N/A',
        last_validated: new Date().toISOString(),
        geographic_origin_verified: true,
        allowed_region: true,
        origin_reason: 'Test data',
        supports_chat: true,
        supports_completion: true,
        supports_vision: false,
        supports_function_calling: false,
        supports_streaming: true,
        max_context_length: '4K',
        input_cost_per_token: 'unknown',
        output_cost_per_token: 'unknown',
        deprecated: false,
        availability_status: 'stable'
      }
    ],
    metadata: {
      timestamp: new Date().toISOString(),
      trigger: 'manual_test',
      reason: 'Testing integration',
      total_models_checked: 1,
      total_validated_models: 1,
      providers_with_models: ['test-provider']
    },
    config: {
      table_name: 'validated_models'
    }
  };
  
  try {
    const response = await makeRequest(`${CONFIG.backend}${CONFIG.endpoints.sync}`, {
      method: 'POST',
      body: testPayload
    });
    
    if (response.status === 200) {
      console.log('✅ Sync endpoint working');
      console.log(`   Records uploaded: ${response.data.stats?.records_uploaded}`);
      console.log(`   Sync timestamp: ${response.data.stats?.sync_timestamp}`);
      return true;
    } else {
      console.log(`❌ Sync endpoint failed: ${response.status}`);
      console.log(`   Error: ${JSON.stringify(response.data, null, 2)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Sync endpoint error: ${error.message}`);
    return false;
  }
}

async function testFullIntegration() {
  console.log('🚀 Testing full integration with real data...');
  
  // Import the existing functions
  const { fetchValidatedModels, createFlattenedData } = require('./simple-supabase-sync.js');
  
  try {
    // Fetch real data
    const validatedModels = await fetchValidatedModels();
    const flattenedData = createFlattenedData(validatedModels);
    
    console.log(`📊 Fetched ${flattenedData.length} real model records`);
    
    // Create payload
    const payload = {
      action: 'sync-validated-models',
      data: flattenedData,
      metadata: validatedModels.metadata,
      config: {
        table_name: 'validated_models'
      }
    };
    
    // Send to backend
    const response = await makeRequest(`${CONFIG.backend}${CONFIG.endpoints.sync}`, {
      method: 'POST',
      body: payload
    });
    
    if (response.status === 200) {
      console.log('✅ Full integration test successful!');
      console.log(`   Records uploaded: ${response.data.stats?.records_uploaded}`);
      console.log(`   Providers: ${response.data.stats?.providers?.join(', ')}`);
      console.log(`   Validation timestamp: ${response.data.stats?.validation_timestamp}`);
      return true;
    } else {
      console.log(`❌ Full integration failed: ${response.status}`);
      console.log(`   Error: ${JSON.stringify(response.data, null, 2)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Full integration error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🧪 Starting Backend Integration Tests');
  console.log(`🎯 Backend: ${CONFIG.backend}`);
  console.log('');
  
  let allPassed = true;
  
  // Test 1: Health endpoint
  const healthOk = await testHealthEndpoint();
  allPassed = allPassed && healthOk;
  console.log('');
  
  if (!healthOk) {
    console.log('❌ Health check failed. Make sure you:');
    console.log('   1. Added the endpoint code to your backend');
    console.log('   2. Set SUPABASE_ANON_KEY environment variable');
    console.log('   3. Deployed the changes to Render');
    return;
  }
  
  // Test 2: Sync endpoint with test data
  const syncOk = await testSyncEndpoint();
  allPassed = allPassed && syncOk;
  console.log('');
  
  if (!syncOk) {
    console.log('❌ Sync test failed. Make sure you:');
    console.log('   1. Created the Supabase table using create-supabase-table.sql');
    console.log('   2. Table permissions allow inserts');
    console.log('   3. SUPABASE_ANON_KEY has correct permissions');
    return;
  }
  
  // Test 3: Full integration with real data
  console.log('🔄 Running full integration test...');
  const fullOk = await testFullIntegration();
  allPassed = allPassed && fullOk;
  console.log('');
  
  // Summary
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('✅ Your backend integration is working correctly');
    console.log('');
    console.log('🚀 Ready for production use:');
    console.log('   node supabase-sync-backend.js');
  } else {
    console.log('❌ Some tests failed. Check the output above for details.');
  }
}

if (require.main === module) {
  main();
}

module.exports = { testHealthEndpoint, testSyncEndpoint, testFullIntegration };