#!/usr/bin/env node

/**
 * Direct API to Supabase Script
 * Bypasses all workflow complexity - uses local .env to ping APIs directly
 * and pushes JSON results straight to Supabase
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load local environment variables (the ones that work!)
dotenv.config();

class DirectAPIToSupabase {
  constructor() {
    this.results = [];
    this.totalModels = 0;
    this.timestamp = new Date().toISOString();
    this.backendKeys = null;
    
    // Initialize Supabase client (will be set up after fetching backend keys)
    this.supabaseUrl = process.env.SUPABASE_URL || 'https://pfmsevvxgvofqyrrtojk.supabase.co';
    this.supabaseKey = null;
    this.supabase = null;
  }

  // Fetch API keys from backend (like GitHub workflow does)
  async fetchAPIKeysFromBackend() {
    console.log('🔑 Fetching API keys from backend...');
    try {
      const response = await fetch('https://askme-backend-proxy.onrender.com/api/keys');
      
      if (!response.ok) {
        throw new Error(`Backend fetch failed: ${response.status}`);
      }
      
      this.backendKeys = await response.json();
      console.log('✅ Successfully fetched API keys from backend');
      console.log(`📊 Available providers: ${Object.keys(this.backendKeys).join(', ')}`);
      return true;
      
    } catch (error) {
      console.log('❌ Failed to fetch API keys from backend:', error.message);
      console.log('🔄 Falling back to local .env keys...');
      this.backendKeys = null;
      return false;
    }
  }

  // Get API key with backend fallback
  getAPIKey(keyName) {
    // Try backend keys first
    if (this.backendKeys && this.backendKeys[keyName]) {
      return this.backendKeys[keyName];
    }
    
    // Fallback to local environment
    return process.env[keyName];
  }

  // Initialize Supabase client after fetching keys
  initializeSupabase() {
    console.log('🔧 Initializing Supabase client...');
    
    // Try to get Supabase key from backend or environment
    this.supabaseKey = this.getAPIKey('SUPABASE_ANON_KEY') || process.env.SUPABASE_ANON_KEY;
    
    if (!this.supabaseKey) {
      console.log('⚠️ No SUPABASE_ANON_KEY found - will save to local JSON instead');
      this.supabase = null;
      return false;
    }
    
    try {
      this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
      console.log('✅ Supabase client initialized successfully');
      console.log(`📍 Supabase URL: ${this.supabaseUrl}`);
      return true;
    } catch (error) {
      console.log('⚠️ Supabase initialization failed - will save to local JSON instead');
      console.log(`   Error: ${error.message}`);
      this.supabase = null;
      return false;
    }
  }

  async makeRequest(url, options = {}) {
    try {
      const response = await fetch(url, {
        timeout: 15000,
        ...options
      });
      return response;
    } catch (error) {
      console.error(`Request failed: ${error.message}`);
      throw error;
    }
  }

  // HuggingFace - Multiple endpoints approach (like successful direct API)
  async fetchHuggingFace() {
    console.log('\n🤗 HUGGINGFACE - Multiple Task Endpoints');
    console.log('=========================================');
    
    const apiKey = this.getAPIKey('HUGGINGFACE_API_KEY');
    if (!apiKey) {
      console.log('❌ No HuggingFace API key');
      return;
    }
    
    const endpoints = [
      { url: 'https://huggingface.co/api/models?task=text-generation&sort=downloads&limit=100', task: 'text-generation' },
      { url: 'https://huggingface.co/api/models?task=text-to-image&sort=downloads&limit=100', task: 'text-to-image' },
      { url: 'https://huggingface.co/api/models?task=automatic-speech-recognition&sort=downloads&limit=100', task: 'asr' },
      { url: 'https://huggingface.co/api/models?task=text-to-speech&sort=downloads&limit=100', task: 'tts' },
      { url: 'https://huggingface.co/api/models?task=feature-extraction&sort=downloads&limit=100', task: 'embeddings' }
    ];

    let totalHFModels = 0;
    
    for (const { url, task } of endpoints) {
      try {
        console.log(`📡 Fetching ${task}...`);
        const response = await this.makeRequest(url);
        
        if (response.ok) {
          const data = await response.json();
          const models = data || [];
          console.log(`✅ ${task}: ${models.length} models`);
          
          // Add to results
          models.forEach(model => {
            this.results.push({
              model_name: model.id || model.modelId,
              provider: 'huggingface',
              task_type: task,
              api_available: true,
              free_tier: true,
              downloads: model.downloads || 0,
              likes: model.likes || 0,
              pipeline_tag: model.pipeline_tag,
              library_name: model.library_name,
              last_modified: model.lastModified,
              created_at: model.createdAt,
              discovery_timestamp: this.timestamp,
              discovery_method: 'direct_api_local'
            });
          });
          
          totalHFModels += models.length;
        } else {
          console.log(`❌ ${task}: HTTP ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ ${task}: ${error.message}`);
      }
    }
    
    console.log(`🎯 HuggingFace Total: ${totalHFModels} models`);
    this.totalModels += totalHFModels;
  }

  // Google Gemini
  async fetchGoogle() {
    console.log('\n🟦 GOOGLE GEMINI');
    console.log('================');
    
    const apiKey = this.getAPIKey('GEMINI_API_KEY');
    if (!apiKey) {
      console.log('❌ No Gemini API key');
      return;
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      console.log('📡 Fetching Gemini models...');
      
      const response = await this.makeRequest(url);
      
      if (response.ok) {
        const data = await response.json();
        const models = data.models || [];
        console.log(`✅ Google: ${models.length} models`);
        
        models.forEach(model => {
          this.results.push({
            model_name: model.name?.replace('models/', '') || model.displayName,
            provider: 'google',
            task_type: 'text-generation',
            api_available: true,
            free_tier: true,
            version: model.version,
            display_name: model.displayName,
            description: model.description,
            input_token_limit: model.inputTokenLimit,
            output_token_limit: model.outputTokenLimit,
            supported_generation_methods: model.supportedGenerationMethods,
            discovery_timestamp: this.timestamp,
            discovery_method: 'direct_api_local'
          });
        });
        
        this.totalModels += models.length;
      } else {
        console.log(`❌ Google: HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Google: ${error.message}`);
    }
  }

  // Cohere
  async fetchCohere() {
    console.log('\n🎯 COHERE');
    console.log('=========');
    
    const apiKey = this.getAPIKey('COHERE_API_KEY');
    if (!apiKey) {
      console.log('❌ No Cohere API key');
      return;
    }

    try {
      const url = 'https://api.cohere.com/v1/models';
      console.log('📡 Fetching Cohere models...');
      
      const response = await this.makeRequest(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const models = data.models || [];
        console.log(`✅ Cohere: ${models.length} models`);
        
        models.forEach(model => {
          this.results.push({
            model_name: model.name,
            provider: 'cohere',
            task_type: 'text-generation',
            api_available: true,
            free_tier: true,
            max_input_tokens: model.max_input_tokens,
            max_output_tokens: model.max_output_tokens,
            tokenizer_url: model.tokenizer_url,
            discovery_timestamp: this.timestamp,
            discovery_method: 'direct_api_local'
          });
        });
        
        this.totalModels += models.length;
      } else {
        console.log(`❌ Cohere: HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Cohere: ${error.message}`);
    }
  }

  // Groq
  async fetchGroq() {
    console.log('\n⚡ GROQ');
    console.log('=======');
    
    const apiKey = this.getAPIKey('GROQ_API_KEY');
    if (!apiKey) {
      console.log('❌ No Groq API key');
      return;
    }

    try {
      const url = 'https://api.groq.com/openai/v1/models';
      console.log('📡 Fetching Groq models...');
      
      const response = await this.makeRequest(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const models = data.data || [];
        console.log(`✅ Groq: ${models.length} models`);
        
        models.forEach(model => {
          this.results.push({
            model_name: model.id,
            provider: 'groq',
            task_type: 'text-generation',
            api_available: true,
            free_tier: true,
            object: model.object,
            created: model.created,
            owned_by: model.owned_by,
            discovery_timestamp: this.timestamp,
            discovery_method: 'direct_api_local'
          });
        });
        
        this.totalModels += models.length;
      } else {
        console.log(`❌ Groq: HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Groq: ${error.message}`);
    }
  }

  // Mistral
  async fetchMistral() {
    console.log('\n🌪️ MISTRAL');
    console.log('==========');
    
    const apiKey = this.getAPIKey('MISTRAL_API_KEY');
    if (!apiKey) {
      console.log('❌ No Mistral API key');
      return;
    }

    try {
      const url = 'https://api.mistral.ai/v1/models';
      console.log('📡 Fetching Mistral models...');
      
      const response = await this.makeRequest(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const models = data.data || [];
        console.log(`✅ Mistral: ${models.length} models`);
        
        models.forEach(model => {
          this.results.push({
            model_name: model.id,
            provider: 'mistral',
            task_type: 'text-generation',
            api_available: true,
            free_tier: model.id.includes('open-') || model.id.includes('ministral'),
            object: model.object,
            created: model.created,
            owned_by: model.owned_by,
            discovery_timestamp: this.timestamp,
            discovery_method: 'direct_api_local'
          });
        });
        
        this.totalModels += models.length;
      } else {
        console.log(`❌ Mistral: HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Mistral: ${error.message}`);
    }
  }

  // OpenRouter
  async fetchOpenRouter() {
    console.log('\n🔀 OPENROUTER');
    console.log('=============');
    
    const apiKey = this.getAPIKey('OPENROUTER_API_KEY');
    if (!apiKey) {
      console.log('❌ No OpenRouter API key');
      return;
    }

    try {
      const url = 'https://openrouter.ai/api/v1/models';
      console.log('📡 Fetching OpenRouter models...');
      
      const response = await this.makeRequest(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const models = data.data || [];
        console.log(`✅ OpenRouter: ${models.length} models`);
        
        models.forEach(model => {
          this.results.push({
            model_name: model.id,
            provider: 'openrouter',
            task_type: 'text-generation',
            api_available: true,
            free_tier: model.id.includes(':free') || model.pricing?.prompt === '0',
            context_length: model.context_length,
            architecture: model.architecture?.tokenizer,
            top_provider: model.top_provider?.context_length,
            per_request_limits: model.per_request_limits,
            discovery_timestamp: this.timestamp,
            discovery_method: 'direct_api_local'
          });
        });
        
        this.totalModels += models.length;
      } else {
        console.log(`❌ OpenRouter: HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ OpenRouter: ${error.message}`);
    }
  }

  // Together AI
  async fetchTogether() {
    console.log('\n🤝 TOGETHER AI');
    console.log('==============');
    
    const apiKey = this.getAPIKey('TOGETHER_API_KEY');
    if (!apiKey) {
      console.log('❌ No Together API key');
      return;
    }

    try {
      const url = 'https://api.together.xyz/v1/models';
      console.log('📡 Fetching Together models...');
      
      const response = await this.makeRequest(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const models = data || [];
        console.log(`✅ Together: ${models.length} models`);
        
        models.forEach(model => {
          this.results.push({
            model_name: model.id,
            provider: 'together',
            task_type: model.type || 'text-generation',
            api_available: true,
            free_tier: model.id.includes('Free') || model.pricing?.hourly === 0,
            context_length: model.context_length,
            config: model.config,
            created: model.created,
            description: model.description,
            discovery_timestamp: this.timestamp,
            discovery_method: 'direct_api_local'
          });
        });
        
        this.totalModels += models.length;
      } else {
        console.log(`❌ Together: HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Together: ${error.message}`);
    }
  }

  // Push all results to Supabase (or local JSON fallback)
  async pushToSupabase() {
    console.log('\n📤 SAVING RESULTS');
    console.log('==================');
    
    if (this.results.length === 0) {
      console.log('❌ No results to save');
      return;
    }
    
    // If no Supabase, save to local JSON
    if (!this.supabase) {
      return this.saveToLocalJSON();
    }

    try {
      // Test Supabase connection first
      console.log('🧪 Testing Supabase connection...');
      const { data: testData, error: testError } = await this.supabase
        .from('validated_models')
        .select('count(*)')
        .limit(1);
      
      if (testError) {
        console.log(`❌ Supabase connection test failed: ${testError.message}`);
        console.log('💾 Falling back to local JSON storage...');
        return this.saveToLocalJSON();
      }
      
      console.log('✅ Supabase connection successful');
      
      // Clear existing data (optional - or use upsert)
      console.log('🗑️ Clearing existing data...');
      await this.supabase.from('validated_models').delete().neq('id', 0);
      
      // Insert new data in batches (Supabase has limits)
      const batchSize = 100;
      let inserted = 0;
      
      for (let i = 0; i < this.results.length; i += batchSize) {
        const batch = this.results.slice(i, i + batchSize);
        
        console.log(`📤 Pushing batch ${Math.floor(i/batchSize) + 1}: ${batch.length} models...`);
        
        const { data, error } = await this.supabase
          .from('validated_models')
          .insert(batch);
        
        if (error) {
          console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, error.message);
          
          // Try individual inserts for this batch
          for (const model of batch) {
            try {
              await this.supabase.from('validated_models').insert([model]);
              inserted++;
            } catch (individualError) {
              console.error(`❌ Individual insert failed for ${model.model_name}:`, individualError.message);
            }
          }
        } else {
          inserted += batch.length;
          console.log(`✅ Batch ${Math.floor(i/batchSize) + 1} successful`);
        }
      }
      
      console.log(`\n🎉 SUPABASE UPLOAD COMPLETE`);
      console.log(`📊 Total models pushed: ${inserted}/${this.results.length}`);
      
    } catch (error) {
      console.error('❌ Supabase push failed:', error.message);
      return this.saveToLocalJSON();
    }
  }
  
  // Fallback: Save to local JSON
  async saveToLocalJSON() {
    import('fs').then(async (fs) => {
      const filename = `./generated_outputs/direct_api_results_${this.timestamp.replace(/[:.]/g, '-')}.json`;
      await fs.promises.writeFile(filename, JSON.stringify({
        timestamp: this.timestamp,
        total_models: this.totalModels, 
        discovery_method: 'direct_api_local',
        models: this.results
      }, null, 2));
      console.log(`💾 Results saved locally to: ${filename}`);
      console.log(`📈 Summary: ${this.totalModels} models discovered`);
    });
  }

  // Main execution
  async run() {
    console.log('🚀 DIRECT API TO SUPABASE');
    console.log('=========================');
    console.log(`📅 Timestamp: ${this.timestamp}`);
    console.log(`🎯 Target: Use backend API keys with local .env fallback`);
    
    // Fetch API keys from backend first
    await this.fetchAPIKeysFromBackend();
    
    // Initialize Supabase with fetched keys
    this.initializeSupabase();
    
    // Fetch from all providers
    await this.fetchHuggingFace();
    await this.fetchGoogle();
    await this.fetchCohere();
    await this.fetchGroq();
    await this.fetchMistral();
    await this.fetchOpenRouter();
    await this.fetchTogether();
    
    console.log(`\n📊 DISCOVERY SUMMARY`);
    console.log(`====================`);
    console.log(`🎯 Total models discovered: ${this.totalModels}`);
    console.log(`📦 Results array length: ${this.results.length}`);
    
    // Push to Supabase
    await this.pushToSupabase();
    
    console.log('\n✅ COMPLETE!');
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  const fetcher = new DirectAPIToSupabase();
  fetcher.run().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

export default DirectAPIToSupabase;