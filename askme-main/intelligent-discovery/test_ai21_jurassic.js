#!/usr/bin/env node

/**
 * Test AI21 Jurassic model endpoints directly
 */

import dotenv from 'dotenv';

dotenv.config();

class AI21JurassicTester {
  constructor() {
    this.apiKey = process.env.AI21_API_KEY;
  }

  async testModelEndpoint(modelName) {
    const url = `https://api.ai21.com/studio/v1/${modelName}/complete`;
    
    console.log(`\n🧪 Testing ${modelName}`);
    console.log(`URL: ${url}`);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: "Test",
          maxTokens: 1,
          temperature: 0
        })
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        console.log(`✅ ${modelName}: AVAILABLE`);
        return true;
      } else if (response.status === 404) {
        console.log(`❌ ${modelName}: NOT FOUND`);
        return false;
      } else {
        const errorText = await response.text();
        console.log(`⚠️  ${modelName}: ${errorText}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ ${modelName}: ${error.message}`);
      return false;
    }
  }

  async testAllJurassicModels() {
    console.log('🦕 AI21 JURASSIC MODEL AVAILABILITY TEST');
    console.log('=========================================');
    console.log('API Key:', this.apiKey ? '✅ Available' : '❌ Missing');
    
    if (!this.apiKey) {
      console.log('❌ Cannot proceed without API key');
      return;
    }

    const jurassicModels = [
      'j2-ultra',
      'j2-mid', 
      'j2-light',
      'jurassic-2-ultra',
      'jurassic-2-mid',
      'jurassic-2-light',
      'j2-large-instruct',
      'j2-grande-instruct'
    ];

    const jambaModels = [
      'jamba-large',
      'jamba-mini',
      'jamba-instruct'
    ];

    console.log('\n📋 Testing Jurassic-2 Models:');
    const jurassicResults = {};
    for (const model of jurassicModels) {
      jurassicResults[model] = await this.testModelEndpoint(model);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('\n📋 Testing Jamba Models:');
    const jambaResults = {};
    for (const model of jambaModels) {
      jambaResults[model] = await this.testModelEndpoint(model);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('\n📊 RESULTS SUMMARY');
    console.log('==================');
    
    console.log('\nJurassic-2 Models:');
    Object.keys(jurassicResults).forEach(model => {
      const status = jurassicResults[model] ? '✅ Available' : '❌ Not Found';
      console.log(`  ${model}: ${status}`);
    });

    console.log('\nJamba Models:');
    Object.keys(jambaResults).forEach(model => {
      const status = jambaResults[model] ? '✅ Available' : '❌ Not Found';
      console.log(`  ${model}: ${status}`);
    });

    const totalAvailable = Object.values({...jurassicResults, ...jambaResults}).filter(Boolean).length;
    console.log(`\n🎯 Total Available Models: ${totalAvailable}`);

    return { jurassicResults, jambaResults };
  }
}

// Run the tester
const tester = new AI21JurassicTester();
tester.testAllJurassicModels().catch(console.error);