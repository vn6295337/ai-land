#!/usr/bin/env node

/**
 * Convert JSON API responses to CSV format with separate sheets for each provider
 */

import fs from 'fs';
import path from 'path';

class JSONToCSVConverter {
  constructor() {
    this.outputDir = './generated_outputs';
    this.csvData = {};
  }

  loadJSONData(filename) {
    const filePath = path.join(this.outputDir, filename);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return null;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`✅ Loaded JSON data from: ${filename}`);
      return data;
    } catch (error) {
      console.error(`❌ Error parsing JSON: ${error.message}`);
      return null;
    }
  }

  escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  arrayToCSV(array) {
    if (!Array.isArray(array) || array.length === 0) return '';
    return array.map(item => this.escapeCSV(item)).join(';');
  }

  objectToCSV(obj) {
    if (!obj || typeof obj !== 'object') return '';
    return Object.entries(obj)
      .map(([key, value]) => `${key}:${this.escapeCSV(value)}`)
      .join(';');
  }

  convertHuggingFace(data) {
    console.log('\n🤗 Converting HuggingFace data...');
    
    if (!data.huggingface) {
      console.log('❌ No HuggingFace data found');
      return;
    }

    const categories = Object.keys(data.huggingface);
    const allModels = [];

    categories.forEach(category => {
      const categoryData = data.huggingface[category];
      if (categoryData.data && Array.isArray(categoryData.data)) {
        categoryData.data.forEach(model => {
          allModels.push({
            category: category,
            model_id: model.id || '',
            model_name: model.modelId || model.id || '',
            likes: model.likes || 0,
            downloads: model.downloads || 0,
            private: model.private || false,
            pipeline_tag: model.pipeline_tag || '',
            library_name: model.library_name || '',
            created_at: model.createdAt || '',
            tags: this.arrayToCSV(model.tags || []),
            gated: model.gated || false,
            disabled: model.disabled || false
          });
        });
      }
    });

    if (allModels.length > 0) {
      const headers = Object.keys(allModels[0]);
      const csvContent = [
        headers.join(','),
        ...allModels.map(model => 
          headers.map(header => this.escapeCSV(model[header])).join(',')
        )
      ].join('\n');

      this.csvData['huggingface'] = csvContent;
      console.log(`✅ HuggingFace: ${allModels.length} models converted`);
    }
  }

  convertGoogle(data) {
    console.log('\n🔍 Converting Google AI data...');
    
    if (!data.google || !data.google.data || !data.google.data.models) {
      console.log('❌ No Google AI data found');
      return;
    }

    const models = data.google.data.models.map(model => ({
      name: model.name || '',
      version: model.version || '',
      display_name: model.displayName || '',
      description: model.description || '',
      input_token_limit: model.inputTokenLimit || 0,
      output_token_limit: model.outputTokenLimit || 0,
      supported_generation_methods: this.arrayToCSV(model.supportedGenerationMethods || []),
      top_k: model.topK || '',
      top_p: model.topP || '',
      temperature: model.temperature || ''
    }));

    if (models.length > 0) {
      const headers = Object.keys(models[0]);
      const csvContent = [
        headers.join(','),
        ...models.map(model => 
          headers.map(header => this.escapeCSV(model[header])).join(',')
        )
      ].join('\n');

      this.csvData['google'] = csvContent;
      console.log(`✅ Google AI: ${models.length} models converted`);
    }
  }

  convertCohere(data) {
    console.log('\n🎯 Converting Cohere data...');
    
    if (!data.cohere || !data.cohere.data || !data.cohere.data.models) {
      console.log('❌ No Cohere data found');
      return;
    }

    const models = data.cohere.data.models.map(model => ({
      name: model.name || '',
      endpoints: this.arrayToCSV(model.endpoints || []),
      finetuned: model.finetuned || false,
      context_length: model.context_length || 0,
      tokenizer_url: model.tokenizer_url || '',
      supports_vision: model.supports_vision || false,
      features: model.features || '',
      default_endpoints: this.arrayToCSV(model.default_endpoints || [])
    }));

    if (models.length > 0) {
      const headers = Object.keys(models[0]);
      const csvContent = [
        headers.join(','),
        ...models.map(model => 
          headers.map(header => this.escapeCSV(model[header])).join(',')
        )
      ].join('\n');

      this.csvData['cohere'] = csvContent;
      console.log(`✅ Cohere: ${models.length} models converted`);
    }
  }

  convertGroq(data) {
    console.log('\n⚡ Converting Groq data...');
    
    if (!data.groq || !data.groq.data || !data.groq.data.data) {
      console.log('❌ No Groq data found');
      return;
    }

    const models = data.groq.data.data.map(model => ({
      id: model.id || '',
      object: model.object || '',
      created: model.created || 0,
      owned_by: model.owned_by || '',
      active: model.active || false,
      context_window: model.context_window || 0,
      public_apps: model.public_apps || '',
      max_completion_tokens: model.max_completion_tokens || 0
    }));

    if (models.length > 0) {
      const headers = Object.keys(models[0]);
      const csvContent = [
        headers.join(','),
        ...models.map(model => 
          headers.map(header => this.escapeCSV(model[header])).join(',')
        )
      ].join('\n');

      this.csvData['groq'] = csvContent;
      console.log(`✅ Groq: ${models.length} models converted`);
    }
  }

  convertTogetherAI(data) {
    console.log('\n🤝 Converting Together AI data...');
    
    if (!data.together || !data.together.data) {
      console.log('❌ No Together AI data found');
      return;
    }

    const models = data.together.data.map(model => ({
      id: model.id || '',
      object: model.object || '',
      created: model.created || 0,
      type: model.type || '',
      running: model.running || false,
      display_name: model.display_name || '',
      organization: model.organization || '',
      link: model.link || '',
      context_length: model.context_length || 0,
      chat_template: model.config?.chat_template || '',
      stop_tokens: this.arrayToCSV(model.config?.stop || []),
      bos_token: model.config?.bos_token || '',
      eos_token: model.config?.eos_token || '',
      pricing_hourly: model.pricing?.hourly || 0,
      pricing_input: model.pricing?.input || 0,
      pricing_output: model.pricing?.output || 0,
      pricing_base: model.pricing?.base || 0,
      pricing_finetune: model.pricing?.finetune || 0
    }));

    if (models.length > 0) {
      const headers = Object.keys(models[0]);
      const csvContent = [
        headers.join(','),
        ...models.map(model => 
          headers.map(header => this.escapeCSV(model[header])).join(',')
        )
      ].join('\n');

      this.csvData['together_ai'] = csvContent;
      console.log(`✅ Together AI: ${models.length} models converted`);
    }
  }

  convertOpenRouter(data) {
    console.log('\n🔄 Converting OpenRouter data...');
    
    if (!data.openrouter || !data.openrouter.data || !data.openrouter.data.data) {
      console.log('❌ No OpenRouter data found');
      return;
    }

    const models = data.openrouter.data.data.map(model => ({
      id: model.id || '',
      canonical_slug: model.canonical_slug || '',
      hugging_face_id: model.hugging_face_id || '',
      name: model.name || '',
      created: model.created || 0,
      description: model.description || '',
      context_length: model.context_length || 0,
      modality: model.architecture?.modality || '',
      input_modalities: this.arrayToCSV(model.architecture?.input_modalities || []),
      output_modalities: this.arrayToCSV(model.architecture?.output_modalities || []),
      tokenizer: model.architecture?.tokenizer || '',
      instruct_type: model.architecture?.instruct_type || '',
      pricing_prompt: model.pricing?.prompt || '0',
      pricing_completion: model.pricing?.completion || '0',
      pricing_request: model.pricing?.request || '0',
      pricing_image: model.pricing?.image || '0',
      pricing_audio: model.pricing?.audio || '0',
      pricing_web_search: model.pricing?.web_search || '0',
      top_provider_context_length: model.top_provider?.context_length || 0,
      top_provider_max_completion_tokens: model.top_provider?.max_completion_tokens || 0,
      top_provider_is_moderated: model.top_provider?.is_moderated || false,
      supported_parameters: this.arrayToCSV(model.supported_parameters || [])
    }));

    if (models.length > 0) {
      const headers = Object.keys(models[0]);
      const csvContent = [
        headers.join(','),
        ...models.map(model => 
          headers.map(header => this.escapeCSV(model[header])).join(',')
        )
      ].join('\n');

      this.csvData['openrouter'] = csvContent;
      console.log(`✅ OpenRouter: ${models.length} models converted`);
    }
  }

  convertMistral(data) {
    console.log('\n🌀 Converting Mistral data...');
    
    if (!data.mistral || data.mistral.error) {
      console.log(`❌ Mistral error: ${data.mistral.error || 'No data'}`);
      // Create empty CSV with headers
      this.csvData['mistral'] = 'id,object,created,owned_by,root,parent,permissions\n# Mistral API returned 401 Unauthorized - API key needs refresh';
      return;
    }
  }

  convertAI21(data) {
    console.log('\n🧠 Converting AI21 data...');
    
    if (!data.ai21 || !data.ai21.data) {
      console.log('❌ No AI21 data found');
      return;
    }

    // AI21 returns different format, need to handle accordingly
    console.log('AI21 data structure:', typeof data.ai21.data);
    
    // Create placeholder for now since we need to see the actual structure
    this.csvData['ai21'] = 'model_name,model_type,status\n# AI21 API returned object format - needs investigation';
  }

  saveCSVFiles() {
    console.log('\n💾 Saving CSV files...');
    
    Object.keys(this.csvData).forEach(provider => {
      const filename = `${this.outputDir}/api_models_${provider}.csv`;
      fs.writeFileSync(filename, this.csvData[provider]);
      console.log(`✅ Saved: ${filename}`);
    });

    // Create a master index file
    const indexContent = [
      '# API Models CSV Files',
      '',
      'Generated CSV files from direct API responses:',
      '',
      ...Object.keys(this.csvData).map(provider => 
        `- **${provider.toUpperCase()}**: api_models_${provider}.csv`
      ),
      '',
      `Generated on: ${new Date().toISOString()}`,
      '',
      '## Provider Status:',
      ...Object.keys(this.csvData).map(provider => {
        const lines = this.csvData[provider].split('\n');
        const modelCount = lines.length - 1; // subtract header
        return `- ${provider.toUpperCase()}: ${modelCount} models`;
      })
    ].join('\n');

    fs.writeFileSync(`${this.outputDir}/api_models_index.md`, indexContent);
    console.log(`✅ Saved: api_models_index.md`);
  }

  convert() {
    console.log('🚀 JSON to CSV Converter');
    console.log('========================');

    // Find the latest direct API fetch file
    const files = fs.readdirSync(this.outputDir);
    const directApiFile = files.find(f => f.startsWith('direct_api_fetch_') && f.endsWith('.json'));
    
    if (!directApiFile) {
      console.error('❌ No direct API fetch JSON file found');
      return;
    }

    console.log(`📁 Processing: ${directApiFile}`);
    const data = this.loadJSONData(directApiFile);
    
    if (!data) {
      console.error('❌ Failed to load JSON data');
      return;
    }

    // Convert each provider
    this.convertHuggingFace(data);
    this.convertGoogle(data);
    this.convertCohere(data);
    this.convertGroq(data);
    this.convertTogetherAI(data);
    this.convertOpenRouter(data);
    this.convertMistral(data);
    this.convertAI21(data);

    // Save all CSV files
    this.saveCSVFiles();

    console.log('\n🎯 CONVERSION COMPLETE');
    console.log('======================');
    console.log(`✅ ${Object.keys(this.csvData).length} CSV files generated`);
    console.log('📁 Files saved to:', this.outputDir);
  }
}

// Run the converter
const converter = new JSONToCSVConverter();
converter.convert();