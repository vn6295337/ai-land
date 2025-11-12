#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const { promisify } = require('util');

const writeFile = promisify(fs.writeFile);

// CLI argument parsing
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(arg => arg.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};

const UPDATE_BACKEND = getArg('update-backend') === 'true';
const BACKEND_URL = getArg('backend-url') || 'https://askme-backend-proxy.onrender.com';

// HTTP request helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'askme-scout-agent/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    const req = https.request(url, requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.data) {
      req.write(JSON.stringify(options.data));
    }
    
    req.end();
  });
}

// Save validated models for backend integration
async function saveValidationResults() {
  console.log('💾 Saving validation results for backend integration...');
  
  // Load validated models
  let validatedModels = [];
  try {
    const validatedData = JSON.parse(fs.readFileSync('validated_models.json', 'utf8'));
    validatedModels = validatedData.models || [];
  } catch (error) {
    console.warn('⚠️ Could not load validated models:', error.message);
  }

  // Load eligible models
  let eligibleModels = [];
  try {
    const eligibleData = JSON.parse(fs.readFileSync('api-eligible-models.json', 'utf8'));
    eligibleModels = eligibleData.eligible_models || [];
  } catch (error) {
    console.warn('⚠️ Could not load eligible models:', error.message);
  }

  console.log(`📊 Processing ${validatedModels.length} validated models and ${eligibleModels.length} eligible models`);

  // Create comprehensive update payload for future backend integration
  const updatePayload = {
    timestamp: new Date().toISOString(),
    scout_agent_version: '1.0',
    backend_url: BACKEND_URL,
    validation_summary: {
      total_models: validatedModels.length,
      total_eligible: eligibleModels.length,
      providers: ['google', 'mistral', 'cohere', 'groq', 'openrouter'],
      active_providers: [...new Set(validatedModels.map(m => m.provider))].length
    },
    validated_models: validatedModels,
    eligible_models: eligibleModels,
    dashboard_data: {
      provider_status: validatedModels.map(model => ({
        provider: model.provider,
        model_name: model.model_name,
        status: model.health_status || 'available',
        response_time: model.response_time || 'N/A',
        last_validated: model.last_validated || new Date().toISOString()
      })),
      performance_metrics: {
        total_providers: 5,
        active_providers: validatedModels.length,
        average_response_time: validatedModels.reduce((sum, m) => sum + (parseInt(m.response_time) || 0), 0) / validatedModels.length || 0,
        success_rate: validatedModels.filter(m => m.api_available).length / validatedModels.length * 100 || 0
      }
    }
  };

  try {
    // Save comprehensive validation results
    await writeFile('backend-integration-data.json', JSON.stringify(updatePayload, null, 2));
    console.log('✅ Validation results saved for backend integration');
    console.log(`📁 Data saved to backend-integration-data.json`);
    console.log(`📊 Dashboard data included for Lovable integration`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to save validation results:', error.message);
    return false;
  }
}

// Validate backend health
async function validateBackendHealth() {
  console.log('🔍 Validating backend health...');
  
  const healthChecks = [
    { name: 'General Health', url: `${BACKEND_URL}/health` },
    { name: 'Provider Status', url: `${BACKEND_URL}/api/providers` },
    { name: 'Model Validation', url: `${BACKEND_URL}/api/llms/health` }
  ];

  const results = [];

  for (const check of healthChecks) {
    try {
      console.log(`  Checking ${check.name}...`);
      const response = await makeRequest(check.url);
      
      results.push({
        check: check.name,
        status: 'healthy',
        response: response
      });
      
      console.log(`    ✅ ${check.name}: OK`);
    } catch (error) {
      results.push({
        check: check.name,
        status: 'unhealthy',
        error: error.message
      });
      
      console.log(`    ❌ ${check.name}: ${error.message}`);
    }
  }

  return results;
}

// Generate dashboard-compatible data
function generateDashboardData(validatedModels, healthChecks) {
  const dashboardData = {
    timestamp: new Date().toISOString(),
    overview: {
      total_providers: 5,
      active_providers: validatedModels.filter(m => m.api_available).length,
      health_status: healthChecks.filter(c => c.status === 'healthy').length / healthChecks.length * 100,
      last_update: new Date().toISOString()
    },
    providers: validatedModels.map(model => ({
      name: model.provider,
      model: model.model_name,
      status: model.health_status || 'available',
      response_time: model.response_time || 'N/A',
      auth_method: model.auth_method || 'backend_proxy',
      free_tier: model.free_tier || true,
      last_validated: model.last_validated || new Date().toISOString()
    })),
    performance: {
      average_response_time: validatedModels.reduce((sum, m) => {
        const time = parseInt(m.response_time) || 0;
        return sum + time;
      }, 0) / validatedModels.length || 0,
      success_rate: validatedModels.filter(m => m.api_available).length / validatedModels.length * 100 || 0,
      uptime: healthChecks.filter(c => c.status === 'healthy').length / healthChecks.length * 100 || 0
    },
    alerts: healthChecks.filter(c => c.status === 'unhealthy').map(check => ({
      type: 'error',
      message: `${check.check}: ${check.error}`,
      timestamp: new Date().toISOString()
    }))
  };

  return dashboardData;
}

// Main function
async function main() {
  console.log('🚀 Starting backend validation and dashboard data generation...');
  console.log(`📋 Backend URL: ${BACKEND_URL}`);
  console.log(`📋 Update backend: ${UPDATE_BACKEND}`);
  console.log(`📊 Generating dashboard data for Lovable integration`);
  
  const results = {
    timestamp: new Date().toISOString(),
    backend_url: BACKEND_URL,
    health_checks: [],
    model_update: null,
    dashboard_data: null,
    summary: {
      success: true,
      errors: []
    }
  };

  // Load validated models for dashboard
  let validatedModels = [];
  try {
    const validatedData = JSON.parse(fs.readFileSync('validated_models.json', 'utf8'));
    validatedModels = validatedData.models || [];
  } catch (error) {
    console.warn('⚠️ Could not load validated models:', error.message);
  }

  // Validate backend health
  results.health_checks = await validateBackendHealth();
  
  // Generate dashboard data
  results.dashboard_data = generateDashboardData(validatedModels, results.health_checks);

  // Save validation results for backend integration if requested
  if (UPDATE_BACKEND) {
    try {
      const saveSuccess = await saveValidationResults();
      results.model_update = {
        status: saveSuccess ? 'success' : 'failed',
        timestamp: new Date().toISOString(),
        message: saveSuccess ? 'Validation data saved for backend integration' : 'Failed to save validation data'
      };
      
      if (!saveSuccess) {
        results.summary.success = false;
        results.summary.errors.push('Failed to save validation results');
      }
    } catch (error) {
      results.model_update = {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      results.summary.success = false;
      results.summary.errors.push(`Validation save error: ${error.message}`);
    }
  }

  // Check for unhealthy services
  const unhealthyChecks = results.health_checks.filter(c => c.status === 'unhealthy');
  if (unhealthyChecks.length > 0) {
    results.summary.success = false;
    results.summary.errors.push(`${unhealthyChecks.length} health checks failed`);
  }

  // Save results
  await writeFile('backend-validation-results.json', JSON.stringify(results, null, 2));
  
  // Save dashboard data separately for Lovable integration
  await writeFile('dashboard-data.json', JSON.stringify(results.dashboard_data, null, 2));

  // Print summary
  console.log(`\n📊 Backend Validation Summary:`);
  console.log(`- Health checks: ${results.health_checks.filter(c => c.status === 'healthy').length}/${results.health_checks.length} passed`);
  console.log(`- Active providers: ${results.dashboard_data.overview.active_providers}/${results.dashboard_data.overview.total_providers}`);
  console.log(`- Average response time: ${results.dashboard_data.performance.average_response_time.toFixed(0)}ms`);
  console.log(`- Success rate: ${results.dashboard_data.performance.success_rate.toFixed(1)}%`);
  
  if (results.model_update) {
    console.log(`- Validation data save: ${results.model_update.status}`);
  }
  
  console.log(`- Overall status: ${results.summary.success ? '✅ Success' : '❌ Failed'}`);
  
  if (results.summary.errors.length > 0) {
    console.log(`\n❌ Errors encountered:`);
    results.summary.errors.forEach(error => {
      console.log(`  - ${error}`);
    });
  }

  console.log(`\n📁 Results saved to backend-validation-results.json`);
  console.log(`📊 Dashboard data saved to dashboard-data.json for Lovable integration`);
  
  // Exit with appropriate code
  process.exit(results.summary.success ? 0 : 1);
}

// Run the validation
if (require.main === module) {
  main().catch(error => {
    console.error('Backend validation failed:', error);
    process.exit(1);
  });
}

module.exports = { saveValidationResults, validateBackendHealth, generateDashboardData };
