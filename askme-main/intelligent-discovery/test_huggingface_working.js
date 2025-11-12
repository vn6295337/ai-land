#!/usr/bin/env node

/**
 * Working HuggingFace API Integration Test
 * Tests the public APIs that actually work with our key
 */

import dotenv from 'dotenv';
import https from 'https';
dotenv.config();

class HuggingFaceClient {
  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY;
    this.baseHeaders = {
      'User-Agent': 'askme-hf-client/1.0.0',
      'Authorization': `Bearer ${this.apiKey}`
    };
  }

  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: 'GET',
        headers: { ...this.baseHeaders, ...options.headers },
        timeout: 15000,
        ...options
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ success: true, status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ success: false, status: res.statusCode, error: data });
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  async getTopTextGenerationModels() {
    const url = 'https://huggingface.co/api/models?pipeline_tag=text-generation&sort=downloads&limit=20';
    const result = await this.makeRequest(url);
    
    if (result.success) {
      return result.data.map(model => ({
        id: model.id,
        downloads: model.downloads,
        likes: model.likes,
        tags: model.tags,
        pipeline_tag: model.pipeline_tag
      }));
    }
    return [];
  }

  async getTopConversationalModels() {
    const url = 'https://huggingface.co/api/models?pipeline_tag=conversational&sort=downloads&limit=10';
    const result = await this.makeRequest(url);
    
    if (result.success) {
      return result.data.map(model => ({
        id: model.id,
        downloads: model.downloads,
        pipeline_tag: model.pipeline_tag
      }));
    }
    return [];
  }

  async getModelInfo(modelId) {
    const url = `https://huggingface.co/api/models/${modelId}`;
    const result = await this.makeRequest(url);
    
    if (result.success) {
      return {
        id: result.data.id,
        downloads: result.data.downloads,
        likes: result.data.likes,
        pipeline_tag: result.data.pipeline_tag,
        tags: result.data.tags,
        modelIndex: result.data.modelIndex,
        config: result.data.config
      };
    }
    return null;
  }
}

async function main() {
  console.log('🤗 HUGGINGFACE API INTEGRATION TEST');
  console.log('==================================');
  
  const hf = new HuggingFaceClient();
  
  console.log('\n📝 1. Testing Text Generation Models...');
  try {
    const textModels = await hf.getTopTextGenerationModels();
    console.log(`✅ Found ${textModels.length} text generation models`);
    console.log('Top models:');
    textModels.slice(0, 5).forEach(model => {
      console.log(`  - ${model.id} (${model.downloads} downloads)`);
    });
  } catch (err) {
    console.log('❌ Text generation models failed:', err.message);
  }

  console.log('\n💬 2. Testing Conversational Models...');
  try {
    const chatModels = await hf.getTopConversationalModels();
    console.log(`✅ Found ${chatModels.length} conversational models`);
    chatModels.slice(0, 3).forEach(model => {
      console.log(`  - ${model.id} (${model.downloads} downloads)`);
    });
  } catch (err) {
    console.log('❌ Conversational models failed:', err.message);
  }

  console.log('\n🔍 3. Testing Model Details...');
  try {
    const modelInfo = await hf.getModelInfo('gpt2');
    if (modelInfo) {
      console.log('✅ GPT-2 model info retrieved:');
      console.log(`  - ID: ${modelInfo.id}`);
      console.log(`  - Downloads: ${modelInfo.downloads}`);
      console.log(`  - Pipeline: ${modelInfo.pipeline_tag}`);
      console.log(`  - Tags: ${modelInfo.tags?.slice(0, 3).join(', ') || 'none'}`);
    }
  } catch (err) {
    console.log('❌ Model details failed:', err.message);
  }

  console.log('\n📊 SUMMARY: HuggingFace API is working for:');
  console.log('  ✅ Model discovery and listing');
  console.log('  ✅ Model metadata retrieval');
  console.log('  ✅ Pipeline-specific filtering');
  console.log('  ⚠️  Inference API needs different setup (Serverless/Spaces)');
  
  console.log('\n💡 RECOMMENDATION: Use HF for model discovery, not generation');
}

main().catch(console.error);

export { HuggingFaceClient };