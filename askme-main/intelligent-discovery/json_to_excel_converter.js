#!/usr/bin/env node

/**
 * Convert JSON API responses to Excel format with separate sheets for each provider
 */

import fs from 'fs';
import path from 'path';

class JSONToExcelConverter {
  constructor() {
    this.outputDir = './generated_outputs';
    this.sheets = {};
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
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\t')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  arrayToString(array) {
    if (!Array.isArray(array) || array.length === 0) return '';
    return array.join('; ');
  }

  objectToString(obj) {
    if (!obj || typeof obj !== 'object') return '';
    return Object.entries(obj)
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ');
  }

  createSheet(sheetName, headers, rows) {
    if (rows.length === 0) {
      this.sheets[sheetName] = `${headers.join('\t')}\nNo data available`;
      return;
    }

    const csvContent = [
      headers.join('\t'),
      ...rows.map(row => 
        headers.map(header => this.escapeCSV(row[header] || '')).join('\t')
      )
    ].join('\n');

    this.sheets[sheetName] = csvContent;
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
            private: model.private ? 'Yes' : 'No',
            pipeline_tag: model.pipeline_tag || '',
            library_name: model.library_name || '',
            created_at: model.createdAt || '',
            tags: this.arrayToString(model.tags || []),
            gated: model.gated ? 'Yes' : 'No',
            disabled: model.disabled ? 'Yes' : 'No'
          });
        });
      }
    });

    const headers = ['category', 'model_id', 'model_name', 'likes', 'downloads', 'private', 'pipeline_tag', 'library_name', 'created_at', 'tags', 'gated', 'disabled'];
    this.createSheet('HuggingFace', headers, allModels);
    console.log(`✅ HuggingFace: ${allModels.length} models converted`);
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
      supported_generation_methods: this.arrayToString(model.supportedGenerationMethods || []),
      top_k: model.topK || '',
      top_p: model.topP || '',
      temperature: model.temperature || ''
    }));

    const headers = ['name', 'version', 'display_name', 'description', 'input_token_limit', 'output_token_limit', 'supported_generation_methods', 'top_k', 'top_p', 'temperature'];
    this.createSheet('Google_AI', headers, models);
    console.log(`✅ Google AI: ${models.length} models converted`);
  }

  convertCohere(data) {
    console.log('\n🎯 Converting Cohere data...');
    
    if (!data.cohere || !data.cohere.data || !data.cohere.data.models) {
      console.log('❌ No Cohere data found');
      return;
    }

    const models = data.cohere.data.models.map(model => ({
      name: model.name || '',
      endpoints: this.arrayToString(model.endpoints || []),
      finetuned: model.finetuned ? 'Yes' : 'No',
      context_length: model.context_length || 0,
      tokenizer_url: model.tokenizer_url || '',
      supports_vision: model.supports_vision ? 'Yes' : 'No',
      features: model.features || '',
      default_endpoints: this.arrayToString(model.default_endpoints || [])
    }));

    const headers = ['name', 'endpoints', 'finetuned', 'context_length', 'tokenizer_url', 'supports_vision', 'features', 'default_endpoints'];
    this.createSheet('Cohere', headers, models);
    console.log(`✅ Cohere: ${models.length} models converted`);
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
      active: model.active ? 'Yes' : 'No',
      context_window: model.context_window || 0,
      public_apps: model.public_apps || '',
      max_completion_tokens: model.max_completion_tokens || 0
    }));

    const headers = ['id', 'object', 'created', 'owned_by', 'active', 'context_window', 'public_apps', 'max_completion_tokens'];
    this.createSheet('Groq', headers, models);
    console.log(`✅ Groq: ${models.length} models converted`);
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
      running: model.running ? 'Yes' : 'No',
      display_name: model.display_name || '',
      organization: model.organization || '',
      link: model.link || '',
      context_length: model.context_length || 0,
      chat_template: model.config?.chat_template || '',
      stop_tokens: this.arrayToString(model.config?.stop || []),
      bos_token: model.config?.bos_token || '',
      eos_token: model.config?.eos_token || '',
      pricing_hourly: model.pricing?.hourly || 0,
      pricing_input: model.pricing?.input || 0,
      pricing_output: model.pricing?.output || 0,
      pricing_base: model.pricing?.base || 0,
      pricing_finetune: model.pricing?.finetune || 0
    }));

    const headers = ['id', 'object', 'created', 'type', 'running', 'display_name', 'organization', 'link', 'context_length', 'chat_template', 'stop_tokens', 'bos_token', 'eos_token', 'pricing_hourly', 'pricing_input', 'pricing_output', 'pricing_base', 'pricing_finetune'];
    this.createSheet('Together_AI', headers, models);
    console.log(`✅ Together AI: ${models.length} models converted`);
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
      description: (model.description || '').substring(0, 200), // Truncate long descriptions
      context_length: model.context_length || 0,
      modality: model.architecture?.modality || '',
      input_modalities: this.arrayToString(model.architecture?.input_modalities || []),
      output_modalities: this.arrayToString(model.architecture?.output_modalities || []),
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
      top_provider_is_moderated: model.top_provider?.is_moderated ? 'Yes' : 'No',
      supported_parameters: this.arrayToString(model.supported_parameters || [])
    }));

    const headers = ['id', 'canonical_slug', 'hugging_face_id', 'name', 'created', 'description', 'context_length', 'modality', 'input_modalities', 'output_modalities', 'tokenizer', 'instruct_type', 'pricing_prompt', 'pricing_completion', 'pricing_request', 'pricing_image', 'pricing_audio', 'pricing_web_search', 'top_provider_context_length', 'top_provider_max_completion_tokens', 'top_provider_is_moderated', 'supported_parameters'];
    this.createSheet('OpenRouter', headers, models);
    console.log(`✅ OpenRouter: ${models.length} models converted`);
  }

  convertMistral(data) {
    console.log('\n🌀 Converting Mistral data...');
    
    if (!data.mistral || data.mistral.error) {
      console.log(`❌ Mistral error: ${data.mistral.error || 'No data'}`);
      this.sheets['Mistral'] = 'Error\tStatus\nAPI Key Unauthorized\t401 - API key needs refresh';
      return;
    }
  }

  convertAI21(data) {
    console.log('\n🧠 Converting AI21 data...');
    
    if (!data.ai21 || !data.ai21.data) {
      console.log('❌ No AI21 data found');
      this.sheets['AI21'] = 'Error\tStatus\nNo Data\tAPI returned object format - needs investigation';
      return;
    }

    console.log('AI21 data structure:', typeof data.ai21.data);
    this.sheets['AI21'] = 'Error\tStatus\nObject Format\tAPI returned object instead of array - needs format analysis';
  }

  createSummarySheet() {
    console.log('\n📊 Creating summary sheet...');
    
    const summaryData = [];
    Object.keys(this.sheets).forEach(sheetName => {
      if (sheetName === 'Summary') return;
      
      const lines = this.sheets[sheetName].split('\n');
      const modelCount = Math.max(0, lines.length - 1); // subtract header, but handle error sheets
      
      summaryData.push({
        provider: sheetName,
        model_count: modelCount,
        status: sheetName === 'Mistral' || sheetName === 'AI21' ? 'Error' : 'Success',
        sheet_name: sheetName
      });
    });

    const headers = ['provider', 'model_count', 'status', 'sheet_name'];
    this.createSheet('Summary', headers, summaryData);
    console.log(`✅ Summary sheet created with ${summaryData.length} providers`);
  }

  saveExcelFile() {
    console.log('\n💾 Creating Excel-compatible file...');
    
    // Create a multi-sheet TSV file that can be opened in Excel
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `${this.outputDir}/api_models_all_providers_${timestamp}.tsv`;
    
    let content = '';
    Object.keys(this.sheets).forEach(sheetName => {
      content += `\n=== SHEET: ${sheetName} ===\n`;
      content += this.sheets[sheetName];
      content += '\n';
    });

    fs.writeFileSync(filename, content);
    console.log(`✅ Saved: ${filename}`);

    // Also create individual sheet files for easy import
    Object.keys(this.sheets).forEach(sheetName => {
      const sheetFile = `${this.outputDir}/sheet_${sheetName.toLowerCase()}.tsv`;
      fs.writeFileSync(sheetFile, this.sheets[sheetName]);
    });

    console.log(`✅ Created ${Object.keys(this.sheets).length} individual sheet files`);
    
    // Create instructions file
    const instructions = [
      '# Excel Import Instructions',
      '',
      '## Option 1: Import Multi-Sheet File',
      `1. Open Excel and import: api_models_all_providers_${timestamp}.tsv`,
      '2. Use "Text to Columns" with Tab delimiter',
      '3. Look for "=== SHEET: SheetName ===" markers to identify sheet boundaries',
      '',
      '## Option 2: Import Individual Sheets',
      'Import each sheet_*.tsv file as a separate worksheet:',
      ...Object.keys(this.sheets).map(sheet => `- sheet_${sheet.toLowerCase()}.tsv → ${sheet} tab`),
      '',
      '## Data Format',
      '- Tab-separated values (TSV)',
      '- First row contains headers',
      '- Complex data is semicolon-separated within cells',
      '',
      `Generated on: ${new Date().toISOString()}`,
      '',
      '## Sheet Summary:',
      ...Object.keys(this.sheets).map(sheet => {
        const lines = this.sheets[sheet].split('\n');
        const count = Math.max(0, lines.length - 1);
        return `- ${sheet}: ${count} rows`;
      })
    ].join('\n');

    fs.writeFileSync(`${this.outputDir}/excel_import_instructions.md`, instructions);
    console.log(`✅ Created import instructions`);
  }

  convert() {
    console.log('🚀 JSON to Excel Converter');
    console.log('==========================');

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

    // Create summary sheet
    this.createSummarySheet();

    // Save Excel-compatible file
    this.saveExcelFile();

    console.log('\n🎯 EXCEL CONVERSION COMPLETE');
    console.log('=============================');
    console.log(`✅ ${Object.keys(this.sheets).length} sheets generated`);
    console.log('📁 Files saved to:', this.outputDir);
    console.log('📖 See excel_import_instructions.md for import guide');
  }
}

// Run the converter
const converter = new JSONToExcelConverter();
converter.convert();