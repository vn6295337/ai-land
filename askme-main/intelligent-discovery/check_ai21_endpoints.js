#!/usr/bin/env node

/**
 * Check AI21 endpoints to find all models including Jurassic range
 */

import dotenv from 'dotenv';

dotenv.config();

class AI21EndpointChecker {
  constructor() {
    this.apiKey = process.env.AI21_API_KEY;
  }

  async makeRequest(url, options = {}) {
    const response = await fetch(url, {
      timeout: 10000,
      ...options
    });
    return response;
  }

  async checkEndpoint(url, description) {
    console.log(`\n📡 Testing: ${description}`);
    console.log(`URL: ${url}`);
    
    try {
      const response = await this.makeRequest(url, {
        headers: this.apiKey ? {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        } : {}
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Response structure:', typeof data);
        
        if (Array.isArray(data)) {
          console.log(`Models array length: ${data.length}`);
          if (data.length > 0) {
            console.log('First model sample:', JSON.stringify(data[0], null, 2));
          }
        } else if (typeof data === 'object') {
          console.log('Response keys:', Object.keys(data));
          
          // Check for nested arrays
          Object.keys(data).forEach(key => {
            const value = data[key];
            if (Array.isArray(value)) {
              console.log(`  ${key}: array with ${value.length} items`);
              if (value.length > 0) {
                console.log(`  First ${key} item:`, JSON.stringify(value[0], null, 2));
              }
            } else if (typeof value === 'object' && value !== null) {
              console.log(`  ${key}: object with keys [${Object.keys(value).join(', ')}]`);
            } else {
              console.log(`  ${key}: ${value}`);
            }
          });
        }
        
        return { success: true, data };
      } else {
        const errorText = await response.text();
        console.log(`Error: ${errorText}`);
        return { success: false, error: errorText };
      }
    } catch (error) {
      console.log(`Exception: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async checkAllEndpoints() {
    console.log('🧠 AI21 ENDPOINT COMPREHENSIVE CHECK');
    console.log('====================================');
    console.log('API Key:', this.apiKey ? '✅ Available' : '❌ Missing');
    
    if (!this.apiKey) {
      console.log('❌ Cannot proceed without API key');
      return;
    }

    const endpoints = [
      {
        url: 'https://api.ai21.com/studio/v1/models',
        description: 'Studio v1 Models (current endpoint)'
      },
      {
        url: 'https://api.ai21.com/v1/models',
        description: 'V1 Models (alternative)'
      },
      {
        url: 'https://api.ai21.com/studio/v1/j2-ultra/complete',
        description: 'J2-Ultra endpoint check (should fail but shows if model exists)'
      },
      {
        url: 'https://api.ai21.com/studio/v1/j2-mid/complete',
        description: 'J2-Mid endpoint check (should fail but shows if model exists)'
      },
      {
        url: 'https://api.ai21.com/studio/v1/j2-light/complete',
        description: 'J2-Light endpoint check (should fail but shows if model exists)'
      },
      {
        url: 'https://api.ai21.com/studio/v2/models',
        description: 'Studio v2 Models (newer version?)'
      },
      {
        url: 'https://api.ai21.com/models',
        description: 'Root models endpoint'
      }
    ];

    const results = {};
    
    for (const endpoint of endpoints) {
      const result = await this.checkEndpoint(endpoint.url, endpoint.description);
      results[endpoint.description] = result;
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n📊 ENDPOINT RESULTS SUMMARY');
    console.log('============================');
    
    Object.keys(results).forEach(desc => {
      const result = results[desc];
      if (result.success) {
        console.log(`✅ ${desc}: SUCCESS`);
        if (result.data && typeof result.data === 'object') {
          if (Array.isArray(result.data)) {
            console.log(`   📋 ${result.data.length} items`);
          } else if (result.data.data && Array.isArray(result.data.data)) {
            console.log(`   📋 ${result.data.data.length} models in data.data`);
          }
        }
      } else {
        console.log(`❌ ${desc}: ${result.error}`);
      }
    });

    // Check AI21 documentation patterns
    console.log('\n📚 CHECKING KNOWN AI21 MODEL PATTERNS');
    console.log('======================================');
    
    const knownModels = [
      'j2-ultra', 'j2-mid', 'j2-light', 
      'jurassic-2-ultra', 'jurassic-2-mid', 'jurassic-2-light',
      'jamba-large', 'jamba-mini', 'jamba-instruct'
    ];
    
    console.log('Known AI21 models from documentation:');
    knownModels.forEach(model => {
      console.log(`  - ${model}`);
    });
    
    return results;
  }
}

// Run the checker
const checker = new AI21EndpointChecker();
checker.checkAllEndpoints().catch(console.error);