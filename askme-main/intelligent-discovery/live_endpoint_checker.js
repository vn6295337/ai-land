#!/usr/bin/env node

/**
 * Live Free LLM Endpoint Checker
 * Actually pings API endpoints and discovers available models
 */

import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import APIKeyRotationManager from './api_key_rotation.js';

// Load environment variables from .env file
dotenv.config();

class LiveEndpointChecker {
  constructor() {
    this.timestamp = new Date().toISOString();
    this.outputDir = './generated_outputs';
    this.timeout = 10000; // 10 second timeout
    this.discoveredModels = [];
    this.endpointResults = {};
    
    // Initialize API key rotation manager
    this.keyManager = new APIKeyRotationManager();
    
    // Legacy API keys object for backward compatibility
    this.apiKeys = {
      ai21: this.keyManager.getCurrentKey('ai21'),
      artificialanalysis: this.keyManager.getCurrentKey('artificialanalysis'),
      cohere: this.keyManager.getCurrentKey('cohere'),
      google: this.keyManager.getCurrentKey('google'),
      groq: this.keyManager.getCurrentKey('groq'),
      huggingface: this.keyManager.getCurrentKey('huggingface'),
      mistral: this.keyManager.getCurrentKey('mistral'),
      openrouter: this.keyManager.getCurrentKey('openrouter'),
      together: this.keyManager.getCurrentKey('together')
    };
  }

  async initialize() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      console.log(`📁 Output directory ready: ${this.outputDir}`);
    } catch (error) {
      console.error('Error creating output directory:', error.message);
    }
  }

  // Make HTTP request with timeout and key rotation
  async makeRequest(url, options = {}, provider = null) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      const result = {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data: response.ok ? await response.json().catch(() => null) : null
      };
      
      // Handle API key rotation based on response
      if (provider) {
        if (response.ok) {
          this.keyManager.recordSuccess(provider);
          this.keyManager.resetErrors(provider);
        } else if (response.status === 401 || response.status === 403) {
          this.keyManager.recordError(provider, 'auth_error');
        } else if (response.status === 429) {
          this.keyManager.recordError(provider, 'rate_limit');
        }
      }
      
      return result;
    } catch (error) {
      if (provider) {
        this.keyManager.recordError(provider, 'network_error');
      }
      
      return {
        ok: false,
        status: 0,
        statusText: error.message,
        data: null
      };
    }
  }

  // Get current API key for provider with rotation support
  getApiKey(provider) {
    return this.keyManager.getCurrentKey(provider);
  }

  // Make request with automatic key rotation retry
  async makeRequestWithRetry(url, options = {}, provider = null, maxRetries = 2) {
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Update API key for this attempt
      if (provider) {
        const currentKey = this.getApiKey(provider);
        if (currentKey && options.headers) {
          // Update Authorization header with current key
          if (options.headers.Authorization) {
            options.headers.Authorization = options.headers.Authorization.replace(/Bearer .+/, `Bearer ${currentKey}`);
          }
        }
      }
      
      const result = await this.makeRequest(url, options, provider);
      
      // If successful or not an auth/rate limit error, return result
      if (result.ok || (result.status !== 401 && result.status !== 403 && result.status !== 429)) {
        return result;
      }
      
      lastError = result;
      
      // Try rotating key for next attempt
      if (provider && attempt < maxRetries) {
        const rotated = this.keyManager.rotateKey(provider, `retry_attempt_${attempt + 1}`);
        if (!rotated) {
          break; // No more keys to try
        }
        console.log(`🔄 Retrying ${provider} request with rotated key (attempt ${attempt + 2})`);
      }
    }
    
    return lastError;
  }

  // Check HuggingFace models via API discovery
  async checkHuggingFaceModels() {
    console.log('🤗 Checking HuggingFace models via API discovery...');
    
    const huggingfaceKey = this.getApiKey('huggingface');
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Add API key if available for higher rate limits
    if (huggingfaceKey) {
      headers['Authorization'] = `Bearer ${huggingfaceKey}`;
      console.log('    🔑 Using HuggingFace API key for enhanced discovery');
    } else {
      console.log('    ⚠️  No HuggingFace API key - using public rate limits');
    }

    const results = [];
    
    // Define multiple API endpoints for comprehensive discovery
    const apiEndpoints = [
      {
        url: 'https://huggingface.co/api/models?task=text-generation&sort=downloads&limit=20&library=transformers',
        category: 'Text Generation',
        description: 'Popular text generation models'
      },
      {
        url: 'https://huggingface.co/api/models?task=text-to-image&sort=downloads&limit=10&library=diffusers',
        category: 'Text to Image', 
        description: 'Text-to-image generation models'
      },
      {
        url: 'https://huggingface.co/api/models?task=automatic-speech-recognition&sort=downloads&limit=5',
        category: 'Speech Recognition',
        description: 'Speech recognition models'
      },
      {
        url: 'https://huggingface.co/api/models?task=text-to-speech&sort=downloads&limit=5',
        category: 'Text to Speech',
        description: 'Text-to-speech models'
      }
    ];

    console.log(`    🔍 Discovering models from ${apiEndpoints.length} categories...`);

    for (const endpoint of apiEndpoints) {
      try {
        console.log(`  📡 Fetching: ${endpoint.description}`);
        
        const response = await this.makeRequest(endpoint.url, {
          method: 'GET',
          headers: headers
        });

        if (response.ok) {
          const models = response.data;
          console.log(`    ✅ Found ${models.length} ${endpoint.category.toLowerCase()} models`);
          
          // Filter for truly free/public models
          const freeModels = models.filter(model => {
            return !model.gated && // Not behind approval gate
                   !model.private && // Publicly available  
                   model.downloads > 100 && // Has some usage
                   !model.disabled && // Not disabled
                   (model.library_name === 'transformers' || 
                    model.library_name === 'diffusers' ||
                    model.library_name === 'sentence-transformers');
          });

          console.log(`    🆓 ${freeModels.length} free models after filtering`);

          // Process each free model
          for (const model of freeModels.slice(0, 10)) { // Limit to top 10 per category
            const modelInfo = {
              name: model.id.split('/').pop() || model.id,
              provider: 'HuggingFace',
              model_id: model.id,
              endpoint: `https://api-inference.huggingface.co/models/${model.id}`,
              status: 'available',
              response_time: null,
              error: null,
              cost: 'Free',
              context_window: this.getHFContextWindow(model),
              category: endpoint.category,
              requires_api_key: false,
              downloads: model.downloads,
              likes: model.likes,
              library: model.library_name,
              note: huggingfaceKey ? 'API key available for direct usage' : 'Available but may need API key for heavy usage'
            };

            results.push(modelInfo);
            this.discoveredModels.push(modelInfo);
            
            console.log(`      ✅ ${model.id} (${model.downloads} downloads)`);
          }
        } else {
          console.log(`    ❌ Failed to fetch ${endpoint.description}: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.log(`    ❌ Error fetching ${endpoint.description}: ${error.message}`);
      }
    }

    this.endpointResults.huggingface = {
      provider: 'HuggingFace', 
      total_models: results.length,
      available_models: results.length,
      endpoint_base: 'https://api-inference.huggingface.co/models/',
      requires_registration: false,
      api_key_status: huggingfaceKey ? 'available' : 'missing',
      categories_discovered: [...new Set(results.map(m => m.category))],
      models: results
    };

    console.log(`🎯 HuggingFace Discovery Complete: ${results.length} models from ${this.endpointResults.huggingface.categories_discovered.length} categories`);
    return results;
  }

  // Check Google AI Studio models
  async checkGoogleModels() {
    console.log('🔍 Checking Google AI Studio models...');
    
    const googleKey = this.getApiKey('google');
    if (!googleKey) {
      console.log('    ⚠️  No Google API key - skipping live tests');
      return [];
    }

    // Test actual models with API key
    const testModels = [
      { model_id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', context_window: 1000000, category: 'Multimodal' },
      { model_id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', context_window: 2000000, category: 'Reasoning Models' }
    ];

    const results = [];
    
    for (const model of testModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.model_id}:generateContent?key=${googleKey}`;
      console.log(`  🔍 Testing: ${model.name}`);
      
      const result = await this.makeRequestWithRetry(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: "Hello" }]
          }],
          generationConfig: {
            maxOutputTokens: 10,
            temperature: 0.1
          }
        })
      }, 'google');

      const modelInfo = {
        name: model.name,
        provider: 'Google',
        model_id: model.model_id,
        endpoint: url.split('?')[0], // Remove API key from endpoint
        status: result.ok ? 'available' : 'error',
        response_time: null,
        error: result.ok ? null : result.statusText,
        cost: 'Free (with limits)',
        context_window: model.context_window,
        category: model.category,
        requires_api_key: true,
        rate_limits: result.ok ? 'Within limits' : 'Unknown'
      };

      results.push(modelInfo);
      this.discoveredModels.push(modelInfo);
      
      console.log(`    ${result.ok ? '✅' : '❌'} ${model.name}: ${result.status} ${result.statusText}`);
    }

    this.endpointResults.google = {
      provider: 'Google AI Studio',
      total_models: testModels.length,
      available_models: results.filter(m => m.status === 'available').length,
      endpoint_base: 'https://generativelanguage.googleapis.com/v1beta/models/',
      requires_registration: true,
      api_key_required: true,
      api_key_status: 'available',
      models: results
    };

    return results;
  }

  // Check Groq models
  async checkGroqModels() {
    console.log('⚡ Checking Groq models...');
    
    const groqKey = this.getApiKey('groq');
    if (!groqKey) {
      console.log('    ⚠️  No Groq API key - using known free models');
      return this.getGroqFallbackModels();
    }

    // First get available models list
    const modelsUrl = 'https://api.groq.com/openai/v1/models';
    console.log(`  🔍 Testing: Groq models list`);
    
    const modelsResult = await this.makeRequestWithRetry(modelsUrl, {
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      }
    }, 'groq');

    let availableModels = [];
    if (modelsResult.ok && modelsResult.data && modelsResult.data.data) {
      availableModels = modelsResult.data.data
        .filter(model => model.id.includes('llama') || model.id.includes('mixtral'))
        .slice(0, 5); // Limit to 5 models
    }

    // Fallback to known models if API fails
    if (availableModels.length === 0) {
      availableModels = [
        { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B Versatile' },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' }
      ];
    }

    const results = [];
    
    // Test a quick completion with one model to verify API works
    if (availableModels.length > 0) {
      const testModel = availableModels[0];
      const completionUrl = 'https://api.groq.com/openai/v1/chat/completions';
      console.log(`  🔍 Testing completion with: ${testModel.id}`);
      
      const completionResult = await this.makeRequestWithRetry(completionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: testModel.id,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 10
        })
      }, 'groq');

      const apiWorking = completionResult.ok;
      console.log(`    ${apiWorking ? '✅' : '❌'} Groq API: ${completionResult.status} ${completionResult.statusText}`);

      // Create results for all available models
      availableModels.forEach(model => {
        const modelInfo = {
          name: model.name || model.id,
          provider: 'Groq',
          model_id: model.id,
          endpoint: 'https://api.groq.com/openai/v1/chat/completions',
          status: apiWorking ? 'available' : 'error',
          response_time: null,
          error: apiWorking ? null : completionResult.statusText,
          cost: 'Free (30 req/min)',
          context_window: model.context_length || 32768,
          category: 'Text Generation',
          requires_api_key: true,
          rate_limits: '30 requests/minute'
        };

        results.push(modelInfo);
        this.discoveredModels.push(modelInfo);
      });
    }

    this.endpointResults.groq = {
      provider: 'Groq',
      total_models: availableModels.length,
      available_models: results.filter(m => m.status === 'available').length,
      endpoint_base: 'https://api.groq.com/openai/v1/',
      requires_registration: true,
      api_key_required: true,
      api_key_status: 'available',
      rate_limit: '30 requests/minute',
      models: results
    };

    return results;
  }

  // Check OpenRouter free models
  async checkOpenRouterModels() {
    console.log('🔄 Checking OpenRouter free models...');
    
    const modelsUrl = 'https://openrouter.ai/api/v1/models';
    console.log(`  🔍 Testing: OpenRouter models list`);
    
    const result = await this.makeRequest(modelsUrl);
    
    let availableModels = [];
    if (result.ok && result.data && result.data.data) {
      // Filter for free models
      availableModels = result.data.data
        .filter(model => model.pricing && (
          model.pricing.prompt === '0' || 
          model.pricing.prompt === 0 ||
          model.pricing.completion === '0' ||
          model.pricing.completion === 0
        ))
        .slice(0, 5) // Limit to first 5 free models
        .map(model => ({
          name: model.name || model.id,
          provider: 'OpenRouter',
          model_id: model.id,
          endpoint: 'https://openrouter.ai/api/v1/chat/completions',
          status: 'available',
          response_time: null,
          error: null,
          cost: 'Free',
          context_window: model.context_length || 32768,
          category: 'Text Generation',
          requires_api_key: false
        }));
    } else {
      // Fallback to known free models
      availableModels = [
        {
          name: 'Mixtral 8x7B Instruct',
          provider: 'OpenRouter',
          model_id: 'mistralai/mixtral-8x7b-instruct',
          endpoint: 'https://openrouter.ai/api/v1/chat/completions',
          status: 'assumed_available',
          cost: 'Free',
          context_window: 32768,
          category: 'Text Generation'
        }
      ];
    }

    availableModels.forEach(model => this.discoveredModels.push(model));

    this.endpointResults.openrouter = {
      provider: 'OpenRouter',
      total_models: availableModels.length,
      available_models: availableModels.length,
      endpoint_base: 'https://openrouter.ai/api/v1/',
      requires_registration: false,
      models: availableModels
    };

    console.log(`    🔄 Found ${availableModels.length} free models on OpenRouter`);
    return availableModels;
  }

  // Check Cohere models
  async checkCohereModels() {
    console.log('🎯 Checking Cohere models...');
    
    if (!this.apiKeys.cohere) {
      console.log('    ⚠️  No Cohere API key - using known free models');
      return this.getCohereFallbackModels();
    }

    // Test Cohere generate endpoint
    const generateUrl = 'https://api.cohere.ai/v1/generate';
    console.log(`  🔍 Testing: Cohere generate`);
    
    const result = await this.makeRequest(generateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKeys.cohere}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'command',
        prompt: 'Hello',
        max_tokens: 10
      })
    });

    const models = [
      {
        name: 'Command',
        model_id: 'command',
        category: 'Text Generation',
        context_window: 4096
      },
      {
        name: 'Command Light',
        model_id: 'command-light',
        category: 'Text Generation', 
        context_window: 4096
      }
    ];

    const results = models.map(model => ({
      name: model.name,
      provider: 'Cohere',
      model_id: model.model_id,
      endpoint: 'https://api.cohere.ai/v1/generate',
      status: result.ok ? 'available' : 'error',
      response_time: null,
      error: result.ok ? null : result.statusText,
      cost: 'Free (trial credits)',
      context_window: model.context_window,
      category: model.category,
      requires_api_key: true
    }));

    results.forEach(model => this.discoveredModels.push(model));

    this.endpointResults.cohere = {
      provider: 'Cohere',
      total_models: models.length,
      available_models: results.filter(m => m.status === 'available').length,
      endpoint_base: 'https://api.cohere.ai/v1/',
      requires_registration: true,
      api_key_required: true,
      api_key_status: 'available',
      models: results
    };

    console.log(`    ${result.ok ? '✅' : '❌'} Cohere API: ${result.status} ${result.statusText}`);
    return results;
  }

  // Check Together AI models
  async checkTogetherModels() {
    console.log('🤝 Checking Together AI models...');
    
    if (!this.apiKeys.together) {
      console.log('    ⚠️  No Together API key - using known free models');
      return this.getTogetherFallbackModels();
    }

    // Get models list
    const modelsUrl = 'https://api.together.xyz/v1/models';
    console.log(`  🔍 Testing: Together AI models list`);
    
    const modelsResult = await this.makeRequest(modelsUrl, {
      headers: {
        'Authorization': `Bearer ${this.apiKeys.together}`,
        'Content-Type': 'application/json'
      }
    });

    let availableModels = [];
    if (modelsResult.ok && modelsResult.data) {
      // Filter for free/popular models
      availableModels = modelsResult.data
        .filter(model => 
          model.display_name && 
          (model.display_name.includes('Llama') || 
           model.display_name.includes('Mistral') ||
           model.display_name.includes('Code'))
        )
        .slice(0, 5); // Limit to 5 models
    }

    // Fallback models
    if (availableModels.length === 0) {
      availableModels = [
        { name: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', display_name: 'Llama 3.1 8B Instruct Turbo' },
        { name: 'mistralai/Mixtral-8x7B-Instruct-v0.1', display_name: 'Mixtral 8x7B Instruct' }
      ];
    }

    const results = availableModels.map(model => ({
      name: model.display_name || model.name,
      provider: 'Together AI',
      model_id: model.name,
      endpoint: 'https://api.together.xyz/v1/chat/completions',
      status: modelsResult.ok ? 'available' : 'error',
      response_time: null,
      error: modelsResult.ok ? null : modelsResult.statusText,
      cost: 'Free credits ($25/month)',
      context_window: model.context_length || 32768,
      category: 'Text Generation',
      requires_api_key: true
    }));

    results.forEach(model => this.discoveredModels.push(model));

    this.endpointResults.together = {
      provider: 'Together AI',
      total_models: availableModels.length,
      available_models: results.filter(m => m.status === 'available').length,
      endpoint_base: 'https://api.together.xyz/v1/',
      requires_registration: true,
      api_key_required: true,
      api_key_status: 'available',
      free_credits: '$25/month',
      models: results
    };

    console.log(`    ${modelsResult.ok ? '✅' : '❌'} Together AI: ${modelsResult.status} ${modelsResult.statusText}`);
    return results;
  }

  // Check Mistral models
  async checkMistralModels() {
    console.log('🌀 Checking Mistral models...');
    
    const mistralKey = this.getApiKey('mistral');
    if (!mistralKey) {
      console.log('    ⚠️  No Mistral API key - using fallback models');
      return this.getMistralFallbackModels();
    }

    try {
      // Use Mistral's models list API
      const modelsUrl = 'https://api.mistral.ai/v1/models';
      console.log(`  🔍 Fetching models from: ${modelsUrl}`);
      
      const response = await this.makeRequest(modelsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${mistralKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.log(`    ❌ Mistral API error: ${response.status} ${response.statusText}`);
        return this.getMistralFallbackModels();
      }

      const data = await response.json();
      const models = data.data || [];
      
      console.log(`    📊 Found ${models.length} Mistral models via API`);
      
      // Filter and map Mistral models
      const availableModels = models
        .filter(model => {
          return !model.id.includes('deprecated') && 
                 !model.id.includes('embed') &&
                 model.id.startsWith('open-');
        })
        .slice(0, 10)
        .map(model => ({
          name: this.formatMistralModelName(model.id),
          model_id: model.id,
          context_window: this.getMistralContextWindow(model.id),
          category: 'Text Generation'
        }));

      console.log(`    ✅ Filtered to ${availableModels.length} available Mistral models`);
      return this.processMistralModels(availableModels, true);
      
    } catch (error) {
      console.log(`    ❌ Error fetching Mistral models: ${error.message}`);
      return this.getMistralFallbackModels();
    }
  }

  formatMistralModelName(modelId) {
    const nameMap = {
      'open-mistral-7b': 'Mistral 7B',
      'open-mixtral-8x7b': 'Mixtral 8x7B',
      'open-mistral-nemo': 'Mistral Nemo 12B'
    };
    return nameMap[modelId] || modelId.replace(/^open-/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  getMistralContextWindow(modelId) {
    const contextMap = {
      'open-mistral-7b': 32768,
      'open-mixtral-8x7b': 32768,
      'open-mistral-nemo': 128000
    };
    return contextMap[modelId] || 32768;
  }

  processMistralModels(models, isLiveAPI = false) {
    const results = models.map(model => ({
      name: model.name,
      provider: 'Mistral',
      model_id: model.model_id,
      endpoint: 'https://api.mistral.ai/v1/chat/completions',
      status: isLiveAPI ? 'available' : 'known_available',
      response_time: null,
      error: null,
      cost: 'Free (trial credits)',
      context_window: model.context_window,
      category: model.category,
      requires_api_key: true
    }));

    results.forEach(model => this.discoveredModels.push(model));

    this.endpointResults.mistral = {
      provider: 'Mistral',
      total_models: models.length,
      available_models: results.length,
      endpoint_base: 'https://api.mistral.ai/v1/',
      requires_registration: true,
      api_key_required: true,
      api_key_status: isLiveAPI ? 'available' : 'fallback',
      models: results
    };

    console.log(`    📊 Processed ${results.length} Mistral models`);
    return results;
  }

  getMistralFallbackModels() {
    console.log('    🔄 Using Mistral fallback models');
    const models = [
      { name: 'Mistral 7B', model_id: 'open-mistral-7b', context_window: 32768, category: 'Text Generation' },
      { name: 'Mixtral 8x7B', model_id: 'open-mixtral-8x7b', context_window: 32768, category: 'Text Generation' }
    ];
    return this.processMistralModels(models, false);
  }

  // Check ArtificialAnalysis models
  async checkArtificialAnalysisModels() {
    console.log('📊 Checking ArtificialAnalysis models...');
    
    const aaKey = this.getApiKey('artificialanalysis');
    if (!aaKey) {
      console.log('    ⚠️  No ArtificialAnalysis API key - using fallback models');
      return this.getArtificialAnalysisFallbackModels();
    }

    const allModels = [];
    
    // Define all ArtificialAnalysis endpoints
    const endpoints = [
      { url: 'https://api.artificialanalysis.ai/data/llms/models', category: 'Text Generation', name: 'LLMs' },
      { url: 'https://api.artificialanalysis.ai/data/media/text-to-image', category: 'Text to Image', name: 'Text-to-Image' },
      { url: 'https://api.artificialanalysis.ai/data/media/image-editing', category: 'Image Editing', name: 'Image Editing' },
      { url: 'https://api.artificialanalysis.ai/data/media/text-to-speech', category: 'Text to Speech', name: 'Text-to-Speech' },
      { url: 'https://api.artificialanalysis.ai/data/media/text-to-video', category: 'Text to Video', name: 'Text-to-Video' },
      { url: 'https://api.artificialanalysis.ai/data/media/image-to-video', category: 'Image to Video', name: 'Image-to-Video' }
    ];

    // Check each endpoint
    for (const endpoint of endpoints) {
      console.log(`  🔍 Testing: ArtificialAnalysis ${endpoint.name} endpoint`);
      
      const result = await this.makeRequestWithRetry(endpoint.url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${aaKey}`,
          'Content-Type': 'application/json'
        }
      }, 'artificialanalysis');

      let endpointModels = [];
      if (result.ok && result.data) {
        // Filter for free models from the response
        const models = Array.isArray(result.data) ? result.data : result.data.models || [];
        
        endpointModels = models
          .filter(model => {
            // Look for free indicators in the model data
            const isFree = model.pricing?.free === true || 
                          model.cost === 0 || 
                          model.price === 0 ||
                          (model.pricing && (model.pricing.input === 0 || model.pricing.output === 0)) ||
                          model.tier === 'free' ||
                          model.name?.toLowerCase().includes('free');
            return isFree;
          })
          .slice(0, 5) // Limit to 5 models per endpoint
          .map(model => ({
            name: model.name || model.model_name || model.id,
            provider: 'ArtificialAnalysis',
            model_id: model.id || model.model_id || model.name,
            endpoint: endpoint.url,
            status: 'available',
            response_time: null,
            error: null,
            cost: 'Free',
            context_window: model.context_length || model.max_tokens || 4096,
            category: endpoint.category,
            requires_api_key: true,
            provider_info: {
              quality_score: model.quality || null,
              speed: model.speed || null,
              efficiency: model.efficiency || null,
              endpoint_type: endpoint.name
            }
          }));
      }

      allModels.push(...endpointModels);
      console.log(`    ${result.ok ? '✅' : '❌'} ${endpoint.name}: ${result.status} ${result.statusText} (${endpointModels.length} models)`);
    }

    // Fallback to sample models if no models found
    if (allModels.length === 0) {
      allModels = [
        {
          name: 'GPT-3.5 Turbo (via AA)',
          provider: 'ArtificialAnalysis',
          model_id: 'gpt-3.5-turbo',
          endpoint: 'https://api.artificialanalysis.ai/data/llms/models',
          status: 'assumed_available',
          cost: 'Free (limited)',
          context_window: 4096,
          category: 'Text Generation',
          requires_api_key: true
        },
        {
          name: 'DALL-E 2 (via AA)',
          provider: 'ArtificialAnalysis',
          model_id: 'dall-e-2',
          endpoint: 'https://api.artificialanalysis.ai/data/media/text-to-image',
          status: 'assumed_available',
          cost: 'Free (limited)',
          category: 'Text to Image',
          requires_api_key: true
        }
      ];
    }

    allModels.forEach(model => this.discoveredModels.push(model));

    this.endpointResults.artificialanalysis = {
      provider: 'ArtificialAnalysis',
      total_models: allModels.length,
      available_models: allModels.filter(m => m.status === 'available').length,
      endpoint_base: 'https://api.artificialanalysis.ai/data/',
      requires_registration: true,
      api_key_required: true,
      api_key_status: 'available',
      endpoints_checked: endpoints.length,
      categories: [...new Set(allModels.map(m => m.category))],
      models: allModels
    };

    console.log(`    📊 Found ${allModels.length} models across ${endpoints.length} ArtificialAnalysis endpoints`);
    
    return allModels;
  }

  // Categorize ArtificialAnalysis models
  categorizeAAModel(model) {
    const name = (model.name || '').toLowerCase();
    const id = (model.id || '').toLowerCase();
    
    if (name.includes('code') || id.includes('code')) return 'Code Generation';
    if (name.includes('chat') || id.includes('chat')) return 'Chat Models';
    if (name.includes('instruct') || id.includes('instruct')) return 'Instruction Following';
    if (name.includes('vision') || id.includes('vision')) return 'Multimodal';
    return 'Text Generation';
  }

  // Check AI21 models
  async checkAI21Models() {
    console.log('🧠 Checking AI21 models...');
    
    const ai21Key = this.getApiKey('ai21');
    if (!ai21Key) {
      console.log('    ⚠️  No AI21 API key - using fallback models');
      return this.getAI21FallbackModels();
    }

    try {
      // Use AI21's models list API
      const modelsUrl = 'https://api.ai21.com/studio/v1/models';
      console.log(`  🔍 Fetching models from: ${modelsUrl}`);
      
      const response = await this.makeRequest(modelsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ai21Key}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.log(`    ❌ AI21 API error: ${response.status} ${response.statusText}`);
        return this.getAI21FallbackModels();
      }

      const models = await response.json();
      
      console.log(`    📊 Found ${models.length} AI21 models via API`);
      
      // Filter and map AI21 models
      const availableModels = models
        .filter(model => {
          return model.model_type === 'j2' && 
                 !model.model_name.includes('deprecated');
        })
        .slice(0, 10)
        .map(model => ({
          name: this.formatAI21ModelName(model.model_name),
          model_id: model.model_name,
          context_window: this.getAI21ContextWindow(model.model_name),
          category: 'Text Generation'
        }));

      console.log(`    ✅ Filtered to ${availableModels.length} available AI21 models`);
      return this.processAI21Models(availableModels, true);
      
    } catch (error) {
      console.log(`    ❌ Error fetching AI21 models: ${error.message}`);
      return this.getAI21FallbackModels();
    }
  }

  formatAI21ModelName(modelId) {
    const nameMap = {
      'j2-ultra': 'Jurassic-2 Ultra',
      'j2-mid': 'Jurassic-2 Mid',
      'j2-light': 'Jurassic-2 Light'
    };
    return nameMap[modelId] || modelId.replace(/^j(\d+)-/, 'Jurassic-$1 ').replace(/\b\w/g, l => l.toUpperCase());
  }

  getAI21ContextWindow(modelId) {
    const contextMap = {
      'j2-ultra': 8192,
      'j2-mid': 8192,
      'j2-light': 8192
    };
    return contextMap[modelId] || 8192;
  }

  processAI21Models(models, isLiveAPI = false) {
    const results = models.map(model => ({
      name: model.name,
      provider: 'AI21',
      model_id: model.model_id,
      endpoint: `https://api.ai21.com/studio/v1/${model.model_id}/complete`,
      status: isLiveAPI ? 'available' : 'known_available',
      response_time: null,
      error: null,
      cost: 'Free (trial credits)',
      context_window: model.context_window,
      category: model.category,
      requires_api_key: true
    }));

    results.forEach(model => this.discoveredModels.push(model));

    this.endpointResults.ai21 = {
      provider: 'AI21',
      total_models: models.length,
      available_models: results.length,
      endpoint_base: 'https://api.ai21.com/studio/v1/',
      requires_registration: true,
      api_key_required: true,
      api_key_status: isLiveAPI ? 'available' : 'fallback',
      models: results
    };

    console.log(`    📊 Processed ${results.length} AI21 models`);
    return results;
  }

  getAI21FallbackModels() {
    console.log('    🔄 Using AI21 fallback models');
    const models = [
      { name: 'Jurassic-2 Ultra', model_id: 'j2-ultra', context_window: 8192, category: 'Text Generation' },
      { name: 'Jurassic-2 Mid', model_id: 'j2-mid', context_window: 8192, category: 'Text Generation' }
    ];
    return this.processAI21Models(models, false);
  }

  // Check service status endpoints
  async checkServiceStatus() {
    console.log('🏥 Checking service health...');
    
    const services = [
      { name: 'HuggingFace', url: 'https://huggingface.co/' },
      { name: 'Google AI', url: 'https://ai.google.dev/' },
      { name: 'Groq', url: 'https://groq.com/' },
      { name: 'OpenRouter', url: 'https://openrouter.ai/' },
      { name: 'Cohere', url: 'https://cohere.ai/' },
      { name: 'Together AI', url: 'https://together.ai/' },
      { name: 'Mistral', url: 'https://mistral.ai/' },
      { name: 'AI21', url: 'https://ai21.com/' },
      { name: 'ArtificialAnalysis', url: 'https://artificialanalysis.ai/' }
    ];

    const healthResults = {};
    
    for (const service of services) {
      console.log(`  🏥 Checking: ${service.name}`);
      const result = await this.makeRequest(service.url);
      
      healthResults[service.name.toLowerCase()] = {
        name: service.name,
        url: service.url,
        status: result.ok ? 'healthy' : 'unhealthy',
        response_code: result.status,
        checked_at: this.timestamp
      };
      
      console.log(`    ${result.ok ? '✅' : '❌'} ${service.name}: ${result.status}`);
    }

    return healthResults;
  }

  // Provider fallback methods for when API keys are missing
  getGroqFallbackModels() {
    const fallbackModels = [
      {
        name: 'Llama 3.1 70B Versatile',
        provider: 'Groq',
        model_id: 'llama-3.1-70b-versatile',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        status: 'known_available',
        cost: 'Free (30 req/min)',
        context_window: 131072,
        category: 'Text Generation',
        requires_api_key: true,
        note: 'API key required for access'
      },
      {
        name: 'Mixtral 8x7B',
        provider: 'Groq',
        model_id: 'mixtral-8x7b-32768',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        status: 'known_available',
        cost: 'Free (30 req/min)',
        context_window: 32768,
        category: 'Text Generation',
        requires_api_key: true,
        note: 'API key required for access'
      }
    ];
    
    fallbackModels.forEach(model => this.discoveredModels.push(model));
    
    this.endpointResults.groq = {
      provider: 'Groq',
      total_models: fallbackModels.length,
      available_models: fallbackModels.length,
      endpoint_base: 'https://api.groq.com/openai/v1/',
      requires_registration: true,
      api_key_required: true,
      api_key_status: 'missing',
      note: 'Known available models - API key needed for live testing',
      models: fallbackModels
    };
    
    return fallbackModels;
  }

  getCohereFallbackModels() {
    const fallbackModels = [
      {
        name: 'Command',
        provider: 'Cohere',
        model_id: 'command',
        endpoint: 'https://api.cohere.ai/v1/generate',
        status: 'known_available',
        cost: 'Free (trial credits)',
        context_window: 4096,
        category: 'Text Generation',
        requires_api_key: true,
        note: 'API key required for access'
      },
      {
        name: 'Command Light',
        provider: 'Cohere',
        model_id: 'command-light',
        endpoint: 'https://api.cohere.ai/v1/generate',
        status: 'known_available',
        cost: 'Free (trial credits)',
        context_window: 4096,
        category: 'Text Generation',
        requires_api_key: true,
        note: 'API key required for access'
      }
    ];
    
    fallbackModels.forEach(model => this.discoveredModels.push(model));
    
    this.endpointResults.cohere = {
      provider: 'Cohere',
      total_models: fallbackModels.length,
      available_models: fallbackModels.length,
      endpoint_base: 'https://api.cohere.ai/v1/',
      requires_registration: true,
      api_key_required: true,
      api_key_status: 'missing',
      note: 'Known available models - API key needed for live testing',
      models: fallbackModels
    };
    
    return fallbackModels;
  }

  getTogetherFallbackModels() {
    const fallbackModels = [
      {
        name: 'Llama 3.1 8B Instruct Turbo',
        provider: 'Together AI',
        model_id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        endpoint: 'https://api.together.xyz/v1/chat/completions',
        status: 'known_available',
        cost: 'Free credits ($25/month)',
        context_window: 32768,
        category: 'Text Generation',
        requires_api_key: true,
        note: 'API key required for access'
      },
      {
        name: 'Mixtral 8x7B Instruct',
        provider: 'Together AI',
        model_id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        endpoint: 'https://api.together.xyz/v1/chat/completions',
        status: 'known_available',
        cost: 'Free credits ($25/month)',
        context_window: 32768,
        category: 'Text Generation',
        requires_api_key: true,
        note: 'API key required for access'
      }
    ];
    
    fallbackModels.forEach(model => this.discoveredModels.push(model));
    
    this.endpointResults.together = {
      provider: 'Together AI',
      total_models: fallbackModels.length,
      available_models: fallbackModels.length,
      endpoint_base: 'https://api.together.xyz/v1/',
      requires_registration: true,
      api_key_required: true,
      api_key_status: 'missing',
      note: 'Known available models - API key needed for live testing',
      models: fallbackModels
    };
    
    return fallbackModels;
  }

  getAI21FallbackModels() {
    const fallbackModels = [
      {
        name: 'Jurassic-2 Ultra',
        provider: 'AI21',
        model_id: 'j2-ultra',
        endpoint: 'https://api.ai21.com/studio/v1/j2-ultra/complete',
        status: 'known_available',
        cost: 'Free (trial credits)',
        context_window: 8192,
        category: 'Text Generation',
        requires_api_key: true,
        note: 'API key required for access'
      },
      {
        name: 'Jurassic-2 Mid',
        provider: 'AI21',
        model_id: 'j2-mid',
        endpoint: 'https://api.ai21.com/studio/v1/j2-mid/complete',
        status: 'known_available',
        cost: 'Free (trial credits)',
        context_window: 8192,
        category: 'Text Generation',
        requires_api_key: true,
        note: 'API key required for access'
      }
    ];
    
    fallbackModels.forEach(model => this.discoveredModels.push(model));
    
    this.endpointResults.ai21 = {
      provider: 'AI21',
      total_models: fallbackModels.length,
      available_models: fallbackModels.length,
      endpoint_base: 'https://api.ai21.com/studio/v1/',
      requires_registration: true,
      api_key_required: true,
      api_key_status: 'missing',
      note: 'Known available models - API key needed for live testing',
      models: fallbackModels
    };
    
    return fallbackModels;
  }

  getArtificialAnalysisFallbackModels() {
    const fallbackModels = [
      {
        name: 'GPT-3.5 Turbo (via AA)',
        provider: 'ArtificialAnalysis',
        model_id: 'gpt-3.5-turbo',
        endpoint: 'https://api.artificialanalysis.ai/data/llms/models',
        status: 'known_available',
        cost: 'Free (limited)',
        context_window: 4096,
        category: 'Text Generation',
        requires_api_key: true,
        note: 'API key required for access'
      },
      {
        name: 'DALL-E 2 (via AA)',
        provider: 'ArtificialAnalysis',
        model_id: 'dall-e-2',
        endpoint: 'https://api.artificialanalysis.ai/data/media/text-to-image',
        status: 'known_available',
        cost: 'Free (limited)',
        category: 'Text to Image',
        requires_api_key: true,
        note: 'API key required for access'
      },
      {
        name: 'Whisper (via AA)',
        provider: 'ArtificialAnalysis',
        model_id: 'whisper-1',
        endpoint: 'https://api.artificialanalysis.ai/data/media/text-to-speech',
        status: 'known_available',
        cost: 'Free (limited)',
        category: 'Text to Speech',
        requires_api_key: true,
        note: 'API key required for access'
      }
    ];
    
    fallbackModels.forEach(model => this.discoveredModels.push(model));
    
    this.endpointResults.artificialanalysis = {
      provider: 'ArtificialAnalysis',
      total_models: fallbackModels.length,
      available_models: fallbackModels.length,
      endpoint_base: 'https://api.artificialanalysis.ai/data/',
      requires_registration: true,
      api_key_required: true,
      api_key_status: 'missing',
      endpoints_checked: 6,
      categories: ['Text Generation', 'Text to Image', 'Text to Speech'],
      note: 'Known available models - API key needed for live testing',
      models: fallbackModels
    };
    
    return fallbackModels;
  }

  // Helper functions
  getContextWindow(modelId) {
    if (modelId.includes('llama-3.1')) return 128000;
    if (modelId.includes('codellama')) return 16384;
    if (modelId.includes('mistral')) return 32768;
    if (modelId.includes('zephyr')) return 32768;
    return 32768; // default
  }

  getCategory(modelId) {
    if (modelId.includes('code')) return 'Code Generation';
    if (modelId.includes('chat') || modelId.includes('zephyr')) return 'Chat Models';
    return 'Text Generation';
  }

  getHFContextWindow(model) {
    // Try to get context window from model config or infer from model type
    if (model.config && model.config.max_position_embeddings) {
      return model.config.max_position_embeddings;
    }
    
    const modelId = model.id.toLowerCase();
    if (modelId.includes('llama-3.1')) return 128000;
    if (modelId.includes('llama-3')) return 8192;
    if (modelId.includes('llama-2')) return 4096;
    if (modelId.includes('codellama')) return 16384;
    if (modelId.includes('mistral-7b')) return 32768;
    if (modelId.includes('mixtral')) return 32768;
    if (modelId.includes('zephyr')) return 32768;
    if (modelId.includes('gpt-3.5')) return 4096;
    if (modelId.includes('gpt-4')) return 8192;
    if (modelId.includes('claude')) return 200000;
    if (modelId.includes('gemini')) return 1000000;
    
    // Default based on model task
    if (model.pipeline_tag === 'text-generation') return 4096;
    if (model.pipeline_tag === 'text-to-image') return 77; // CLIP text encoder
    if (model.pipeline_tag === 'automatic-speech-recognition') return 0; // Audio models
    if (model.pipeline_tag === 'text-to-speech') return 0; // Audio models
    
    return 4096; // fallback default
  }

  // Generate comprehensive results
  async generateResults() {
    const serviceHealth = await this.checkServiceStatus();

    const results = {
      discovery_metadata: {
        title: "Live Free LLM Endpoint Discovery",
        timestamp: this.timestamp,
        total_endpoints_checked: Object.keys(this.endpointResults).length,
        total_models_discovered: this.discoveredModels.length,
        discovery_method: "live_api_checking"
      },
      service_health: serviceHealth,
      provider_results: this.endpointResults,
      discovered_models: this.discoveredModels,
      summary: {
        providers_checked: Object.keys(this.endpointResults).length,
        models_available: this.discoveredModels.filter(m => m.status === 'available').length,
        models_assumed_available: this.discoveredModels.filter(m => m.status === 'assumed_available').length,
        free_models: this.discoveredModels.filter(m => m.cost === 'Free').length,
        registration_required: this.discoveredModels.filter(m => m.requires_api_key).length
      }
    };

    // Save detailed results
    const jsonPath = path.join(this.outputDir, 'live_endpoint_discovery.json');
    await fs.writeFile(jsonPath, JSON.stringify(results, null, 2));
    console.log(`✅ Live discovery results: ${jsonPath}`);

    // Generate CSV summary
    const csvData = [
      ['Model Name', 'Provider', 'Status', 'Cost', 'Context Window', 'Category', 'API Key Required']
    ];

    this.discoveredModels.forEach(model => {
      csvData.push([
        model.name,
        model.provider,
        model.status,
        model.cost,
        model.context_window?.toString() || 'Unknown',
        model.category,
        model.requires_api_key ? 'Yes' : 'No'
      ]);
    });

    const csvContent = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const csvPath = path.join(this.outputDir, 'live_models_discovery.csv');
    await fs.writeFile(csvPath, csvContent);
    console.log(`✅ Live discovery CSV: ${csvPath}`);

    return results;
  }

  async generateSummary(results) {
    console.log('\n🎯 LIVE ENDPOINT DISCOVERY COMPLETE');
    console.log('====================================');
    console.log(`Completed at: ${new Date(this.timestamp).toLocaleString()}`);
    console.log('');
    console.log('📊 Discovery Results:');
    console.log(`  🔍 Endpoints checked: ${results.discovery_metadata.total_endpoints_checked}`);
    console.log(`  ✅ Models discovered: ${results.discovery_metadata.total_models_discovered}`);
    console.log(`  🆓 Free models: ${results.summary.free_models}`);
    console.log(`  🔑 Require registration: ${results.summary.registration_required}`);
    console.log('');
    console.log('🏥 Service Health:');
    Object.values(results.service_health).forEach(service => {
      const status = service.status === 'healthy' ? '✅' : '❌';
      console.log(`  ${status} ${service.name}: ${service.status}`);
    });
    console.log('');
    console.log('📁 Generated Files:');
    console.log('  ✅ live_endpoint_discovery.json - Complete discovery results');
    console.log('  ✅ live_models_discovery.csv - Models summary');
    console.log('');
    console.log('🚀 Live discovery complete - real endpoint data!');
  }

  async run() {
    console.log('🚀 Starting Live Free LLM Endpoint Discovery...');
    console.log('');
    
    await this.initialize();
    
    // Check each provider (in parallel for better performance)
    const providerChecks = [
      this.checkHuggingFaceModels(),
      this.checkGoogleModels(),
      this.checkGroqModels(),
      this.checkOpenRouterModels(),
      this.checkCohereModels(),
      this.checkTogetherModels(),
      this.checkMistralModels(),
      this.checkAI21Models(),
      this.checkArtificialAnalysisModels()
    ];
    
    console.log('🔄 Running provider checks in parallel...');
    await Promise.allSettled(providerChecks);
    
    // Generate results
    const results = await this.generateResults();
    await this.generateSummary(results);
  }
}

// Run the live checker
const checker = new LiveEndpointChecker();
checker.run().catch(console.error);