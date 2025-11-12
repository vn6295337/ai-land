#!/usr/bin/env node

/**
 * Test Mistral API with updated key
 */

import dotenv from 'dotenv';

dotenv.config();

class MistralTester {
  constructor() {
    this.apiKey = process.env.MISTRAL_API_KEY;
  }

  async makeRequest(url, options = {}) {
    const response = await fetch(url, {
      timeout: 10000,
      ...options
    });
    return response;
  }

  async testMistralAPI() {
    console.log('🌀 MISTRAL API TEST WITH UPDATED KEY');
    console.log('====================================');
    console.log('API Key:', this.apiKey ? `✅ Available (${this.apiKey.substring(0, 8)}...)` : '❌ Missing');
    
    if (!this.apiKey) {
      console.log('❌ Cannot proceed without API key');
      return;
    }

    try {
      const url = 'https://api.mistral.ai/v1/models';
      console.log(`\n📡 Testing Mistral models endpoint:`);
      console.log(`URL: ${url}`);
      
      const response = await this.makeRequest(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ SUCCESS! Models returned: ${data.data ? data.data.length : 'N/A'}`);
        
        if (data.data && Array.isArray(data.data)) {
          console.log('\n📋 Available Mistral Models:');
          data.data.forEach((model, i) => {
            console.log(`${i + 1}. ${model.id || model.name || 'Unknown'}`);
            if (model.description) {
              console.log(`   Description: ${model.description}`);
            }
            if (model.max_context_length || model.context_length) {
              console.log(`   Context: ${model.max_context_length || model.context_length}`);
            }
            if (model.capabilities) {
              console.log(`   Capabilities: ${model.capabilities.join(', ')}`);
            }
            console.log('');
          });
          
          console.log(`🎯 Total Mistral models: ${data.data.length}`);
          
          // Save the data for CSV conversion
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `./generated_outputs/mistral_models_${timestamp}.json`;
          
          const fs = await import('fs');
          fs.default.writeFileSync(filename, JSON.stringify({
            mistral: {
              status: response.status,
              count: data.data.length,
              data: data
            }
          }, null, 2));
          
          console.log(`💾 Saved results to: ${filename}`);
          
          return { success: true, models: data.data, count: data.data.length };
        } else {
          console.log('⚠️  Response format unexpected');
          console.log('Raw response:', JSON.stringify(data, null, 2));
          return { success: true, models: [], count: 0 };
        }
      } else {
        const errorText = await response.text();
        console.log(`❌ API Error: ${errorText}`);
        return { success: false, error: errorText };
      }
    } catch (error) {
      console.log(`❌ Exception: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async testMistralCompletion() {
    console.log('\n🧪 Testing Mistral completion endpoint...');
    
    try {
      const url = 'https://api.mistral.ai/v1/chat/completions';
      console.log(`URL: ${url}`);
      
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'mistral-large-latest',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5
        })
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        console.log('✅ Mistral completion endpoint working');
        return true;
      } else {
        const errorText = await response.text();
        console.log(`❌ Completion test failed: ${errorText}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ Completion test exception: ${error.message}`);
      return false;
    }
  }
}

// Run the tester
const tester = new MistralTester();
tester.testMistralAPI()
  .then(result => {
    if (result && result.success) {
      return tester.testMistralCompletion();
    }
  })
  .catch(console.error);