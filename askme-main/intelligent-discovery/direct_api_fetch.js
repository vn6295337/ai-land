#!/usr/bin/env node

/**
 * Direct API fetching script - no processing, just raw responses
 */

import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

class DirectAPIFetcher {
  constructor() {
    this.results = {};
  }

  async makeRequest(url, options = {}) {
    const response = await fetch(url, {
      timeout: 10000,
      ...options
    });
    return response;
  }

  async fetchHuggingFace() {
    console.log('\n🤗 HUGGINGFACE API DIRECT FETCH');
    console.log('================================');
    
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    console.log('API Key:', apiKey ? '✅ Available' : '❌ Missing');
    
    const endpoints = [
      'https://huggingface.co/api/models?task=text-generation&sort=downloads&limit=50',
      'https://huggingface.co/api/models?task=text-to-image&sort=downloads&limit=50',
      'https://huggingface.co/api/models?task=automatic-speech-recognition&sort=downloads&limit=50',
      'https://huggingface.co/api/models?task=text-to-speech&sort=downloads&limit=50'
    ];

    this.results.huggingface = {};
    
    for (let i = 0; i < endpoints.length; i++) {
      const url = endpoints[i];
      const task = url.match(/task=([^&]+)/)[1];
      
      try {
        console.log(`\n📡 Fetching ${task}:`);
        console.log(`URL: ${url}`);
        
        const response = await this.makeRequest(url, {
          headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
        });
        
        console.log(`Status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`Models returned: ${Array.isArray(data) ? data.length : 'Not an array'}`);
          
          if (Array.isArray(data) && data.length > 0) {
            console.log('First model sample:', JSON.stringify(data[0], null, 2));
          }
          
          this.results.huggingface[task] = {
            status: response.status,
            count: Array.isArray(data) ? data.length : 0,
            data: data
          };
        } else {
          const errorText = await response.text();
          console.log(`Error: ${errorText}`);
          this.results.huggingface[task] = {
            status: response.status,
            error: errorText
          };
        }
      } catch (error) {
        console.log(`Exception: ${error.message}`);
        this.results.huggingface[task] = {
          error: error.message
        };
      }
    }
  }

  async fetchGoogle() {
    console.log('\n🔍 GOOGLE AI API DIRECT FETCH');
    console.log('==============================');
    
    const apiKey = process.env.GEMINI_API_KEY;
    console.log('API Key:', apiKey ? '✅ Available' : '❌ Missing');
    
    if (!apiKey) {
      this.results.google = { error: 'No API key' };
      return;
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      console.log(`\n📡 Fetching models:`);
      console.log(`URL: ${url}`);
      
      const response = await this.makeRequest(url);
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Models returned: ${data.models ? data.models.length : 'No models array'}`);
        
        if (data.models && data.models.length > 0) {
          console.log('First model sample:', JSON.stringify(data.models[0], null, 2));
        }
        
        this.results.google = {
          status: response.status,
          count: data.models ? data.models.length : 0,
          data: data
        };
      } else {
        const errorText = await response.text();
        console.log(`Error: ${errorText}`);
        this.results.google = {
          status: response.status,
          error: errorText
        };
      }
    } catch (error) {
      console.log(`Exception: ${error.message}`);
      this.results.google = { error: error.message };
    }
  }

  async fetchCohere() {
    console.log('\n🎯 COHERE API DIRECT FETCH');
    console.log('===========================');
    
    const apiKey = process.env.COHERE_API_KEY;
    console.log('API Key:', apiKey ? '✅ Available' : '❌ Missing');
    
    if (!apiKey) {
      this.results.cohere = { error: 'No API key' };
      return;
    }

    try {
      const url = 'https://api.cohere.com/v1/models';
      console.log(`\n📡 Fetching models:`);
      console.log(`URL: ${url}`);
      
      const response = await this.makeRequest(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Models returned: ${data.models ? data.models.length : 'No models array'}`);
        
        if (data.models && data.models.length > 0) {
          console.log('First model sample:', JSON.stringify(data.models[0], null, 2));
        }
        
        this.results.cohere = {
          status: response.status,
          count: data.models ? data.models.length : 0,
          data: data
        };
      } else {
        const errorText = await response.text();
        console.log(`Error: ${errorText}`);
        this.results.cohere = {
          status: response.status,
          error: errorText
        };
      }
    } catch (error) {
      console.log(`Exception: ${error.message}`);
      this.results.cohere = { error: error.message };
    }
  }

  async fetchMistral() {
    console.log('\n🌀 MISTRAL API DIRECT FETCH');
    console.log('============================');
    
    const apiKey = process.env.MISTRAL_API_KEY;
    console.log('API Key:', apiKey ? '✅ Available' : '❌ Missing');
    
    if (!apiKey) {
      this.results.mistral = { error: 'No API key' };
      return;
    }

    try {
      const url = 'https://api.mistral.ai/v1/models';
      console.log(`\n📡 Fetching models:`);
      console.log(`URL: ${url}`);
      
      const response = await this.makeRequest(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Models returned: ${data.data ? data.data.length : 'No data array'}`);
        
        if (data.data && data.data.length > 0) {
          console.log('First model sample:', JSON.stringify(data.data[0], null, 2));
        }
        
        this.results.mistral = {
          status: response.status,
          count: data.data ? data.data.length : 0,
          data: data
        };
      } else {
        const errorText = await response.text();
        console.log(`Error: ${errorText}`);
        this.results.mistral = {
          status: response.status,
          error: errorText
        };
      }
    } catch (error) {
      console.log(`Exception: ${error.message}`);
      this.results.mistral = { error: error.message };
    }
  }

  async fetchAI21() {
    console.log('\n🧠 AI21 API DIRECT FETCH');
    console.log('=========================');
    
    const apiKey = process.env.AI21_API_KEY;
    console.log('API Key:', apiKey ? '✅ Available' : '❌ Missing');
    
    if (!apiKey) {
      this.results.ai21 = { error: 'No API key' };
      return;
    }

    try {
      const url = 'https://api.ai21.com/studio/v1/models';
      console.log(`\n📡 Fetching models:`);
      console.log(`URL: ${url}`);
      
      const response = await this.makeRequest(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Models returned: ${Array.isArray(data) ? data.length : 'Not an array'}`);
        
        if (Array.isArray(data) && data.length > 0) {
          console.log('First model sample:', JSON.stringify(data[0], null, 2));
        }
        
        this.results.ai21 = {
          status: response.status,
          count: Array.isArray(data) ? data.length : 0,
          data: data
        };
      } else {
        const errorText = await response.text();
        console.log(`Error: ${errorText}`);
        this.results.ai21 = {
          status: response.status,
          error: errorText
        };
      }
    } catch (error) {
      console.log(`Exception: ${error.message}`);
      this.results.ai21 = { error: error.message };
    }
  }

  async fetchGroq() {
    console.log('\n⚡ GROQ API DIRECT FETCH');
    console.log('========================');
    
    const apiKey = process.env.GROQ_API_KEY;
    console.log('API Key:', apiKey ? '✅ Available' : '❌ Missing');
    
    if (!apiKey) {
      this.results.groq = { error: 'No API key' };
      return;
    }

    try {
      const url = 'https://api.groq.com/openai/v1/models';
      console.log(`\n📡 Fetching models:`);
      console.log(`URL: ${url}`);
      
      const response = await this.makeRequest(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Models returned: ${data.data ? data.data.length : 'No data array'}`);
        
        if (data.data && data.data.length > 0) {
          console.log('First model sample:', JSON.stringify(data.data[0], null, 2));
        }
        
        this.results.groq = {
          status: response.status,
          count: data.data ? data.data.length : 0,
          data: data
        };
      } else {
        const errorText = await response.text();
        console.log(`Error: ${errorText}`);
        this.results.groq = {
          status: response.status,
          error: errorText
        };
      }
    } catch (error) {
      console.log(`Exception: ${error.message}`);
      this.results.groq = { error: error.message };
    }
  }

  async fetchTogetherAI() {
    console.log('\n🤝 TOGETHER AI API DIRECT FETCH');
    console.log('================================');
    
    const apiKey = process.env.TOGETHER_API_KEY;
    console.log('API Key:', apiKey ? '✅ Available' : '❌ Missing');
    
    if (!apiKey) {
      this.results.together = { error: 'No API key' };
      return;
    }

    try {
      const url = 'https://api.together.xyz/v1/models';
      console.log(`\n📡 Fetching models:`);
      console.log(`URL: ${url}`);
      
      const response = await this.makeRequest(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Models returned: ${Array.isArray(data) ? data.length : 'Not an array'}`);
        
        if (Array.isArray(data) && data.length > 0) {
          console.log('First model sample:', JSON.stringify(data[0], null, 2));
        }
        
        this.results.together = {
          status: response.status,
          count: Array.isArray(data) ? data.length : 0,
          data: data
        };
      } else {
        const errorText = await response.text();
        console.log(`Error: ${errorText}`);
        this.results.together = {
          status: response.status,
          error: errorText
        };
      }
    } catch (error) {
      console.log(`Exception: ${error.message}`);
      this.results.together = { error: error.message };
    }
  }

  async fetchOpenRouter() {
    console.log('\n🔄 OPENROUTER API DIRECT FETCH');
    console.log('===============================');
    
    const apiKey = process.env.OPENROUTER_API_KEY;
    console.log('API Key:', apiKey ? '✅ Available' : '❌ Missing');

    try {
      const url = 'https://openrouter.ai/api/v1/models';
      console.log(`\n📡 Fetching models:`);
      console.log(`URL: ${url}`);
      
      const response = await this.makeRequest(url, {
        headers: apiKey ? {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        } : {}
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Models returned: ${data.data ? data.data.length : 'No data array'}`);
        
        if (data.data && data.data.length > 0) {
          console.log('First model sample:', JSON.stringify(data.data[0], null, 2));
        }
        
        this.results.openrouter = {
          status: response.status,
          count: data.data ? data.data.length : 0,
          data: data
        };
      } else {
        const errorText = await response.text();
        console.log(`Error: ${errorText}`);
        this.results.openrouter = {
          status: response.status,
          error: errorText
        };
      }
    } catch (error) {
      console.log(`Exception: ${error.message}`);
      this.results.openrouter = { error: error.message };
    }
  }

  async saveResults() {
    const outputDir = './generated_outputs';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${outputDir}/direct_api_fetch_${timestamp}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
    console.log(`\n💾 Results saved to: ${filename}`);
    
    // Summary
    console.log('\n🎯 DIRECT API FETCH SUMMARY');
    console.log('============================');
    Object.keys(this.results).forEach(provider => {
      const result = this.results[provider];
      if (result.error) {
        console.log(`${provider.toUpperCase()}: ❌ ${result.error}`);
      } else if (typeof result.count !== 'undefined') {
        console.log(`${provider.toUpperCase()}: ✅ ${result.count} models`);
      } else {
        console.log(`${provider.toUpperCase()}: ⚠️  Unknown result format`);
      }
    });
  }

  async runAll() {
    console.log('🚀 DIRECT API FETCH - ALL PROVIDERS');
    console.log('====================================');
    
    await this.fetchHuggingFace();
    await this.fetchGoogle();
    await this.fetchCohere();
    await this.fetchMistral();
    await this.fetchAI21();
    await this.fetchGroq();
    await this.fetchTogetherAI();
    await this.fetchOpenRouter();
    
    await this.saveResults();
  }
}

// Run the direct fetcher
const fetcher = new DirectAPIFetcher();
fetcher.runAll().catch(console.error);