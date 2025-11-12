#!/usr/bin/env node

/**
 * Extract Mistral and AI21 models and add to CSV
 */

import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

class ModelExtractor {
  constructor() {
    this.mistralModels = [];
    this.ai21Models = [];
  }

  async getMistralModels() {
    console.log('🌀 FETCHING MISTRAL MODELS');
    console.log('==========================');
    
    try {
      const response = await fetch('https://api.mistral.ai/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Found ${data.data.length} Mistral models`);
        
        this.mistralModels = data.data.map(model => ({
          provider: 'Mistral',
          model_id: model.id,
          model_name: model.name || model.id,
          description: model.description || '',
          context_length: model.max_context_length || '',
          capabilities: Object.entries(model.capabilities || {})
            .filter(([key, value]) => value === true)
            .map(([key]) => key)
            .join('; '),
          temperature: model.default_model_temperature || '',
          aliases: (model.aliases || []).join('; '),
          created: model.created ? new Date(model.created * 1000).toISOString() : '',
          owned_by: model.owned_by || '',
          type: model.type || '',
          deprecation: model.deprecation || '',
          object: model.object || ''
        }));
        
        return true;
      } else {
        console.log(`❌ Mistral API failed: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ Mistral error: ${error.message}`);
      return false;
    }
  }

  async getAI21Models() {
    console.log('\n🧠 FETCHING AI21 MODELS');
    console.log('=======================');
    
    try {
      const response = await fetch('https://api.ai21.com/studio/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.AI21_API_KEY}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Found ${data.length || 0} AI21 models`);
        
        // Handle different response formats
        const models = Array.isArray(data) ? data : (data.models || data.data || []);
        
        this.ai21Models = models.map(model => ({
          provider: 'AI21',
          model_id: model.id || model.model_id || model.name,
          model_name: model.display_name || model.name || model.id,
          description: model.description || '',
          context_length: model.context_length || model.max_tokens || '',
          capabilities: (model.capabilities || []).join('; '),
          temperature: model.default_temperature || '',
          aliases: (model.aliases || []).join('; '),
          created: model.created_at || '',
          owned_by: 'ai21',
          type: model.type || 'base',
          deprecation: model.deprecated ? 'deprecated' : '',
          object: model.object || 'model'
        }));
        
        return true;
      } else {
        const errorText = await response.text();
        console.log(`❌ AI21 API failed: ${response.status} - ${errorText}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ AI21 error: ${error.message}`);
      return false;
    }
  }

  formatCSVRow(model) {
    const escape = (str) => {
      if (str === null || str === undefined) return '';
      return `"${String(str).replace(/"/g, '""')}"`;
    };

    return [
      escape(model.provider),
      escape(model.model_id),
      escape(model.model_name),
      escape(model.description),
      escape(model.context_length),
      escape(model.capabilities),
      escape(model.temperature),
      escape(model.aliases),
      escape(model.created),
      escape(model.owned_by),
      escape(model.type),
      escape(model.deprecation),
      escape(model.object)
    ].join(',');
  }

  async updateCSVFile() {
    const csvFile = './generated_outputs/api_models_all_providers_2025-08-01.csv';
    
    console.log('\n📝 UPDATING CSV FILE');
    console.log('===================');
    
    try {
      let content = '';
      
      if (fs.existsSync(csvFile)) {
        content = fs.readFileSync(csvFile, 'utf8');
        console.log('✅ Existing CSV file loaded');
      }

      // Create new sections for Mistral and AI21
      const newSections = [];

      if (this.mistralModels.length > 0) {
        newSections.push('\n=== SHEET: Mistral ===');
        newSections.push('provider,model_id,model_name,description,context_length,capabilities,temperature,aliases,created,owned_by,type,deprecation,object');
        
        this.mistralModels.forEach(model => {
          newSections.push(this.formatCSVRow(model));
        });
        
        console.log(`✅ Added ${this.mistralModels.length} Mistral models`);
      }

      if (this.ai21Models.length > 0) {
        newSections.push('\n=== SHEET: AI21 ===');
        newSections.push('provider,model_id,model_name,description,context_length,capabilities,temperature,aliases,created,owned_by,type,deprecation,object');
        
        this.ai21Models.forEach(model => {
          newSections.push(this.formatCSVRow(model));
        });
        
        console.log(`✅ Added ${this.ai21Models.length} AI21 models`);
      }

      // Append new sections to existing content
      const updatedContent = content + newSections.join('\n');
      
      fs.writeFileSync(csvFile, updatedContent);
      console.log(`💾 Updated CSV file: ${csvFile}`);
      
      return true;
    } catch (error) {
      console.log(`❌ CSV update error: ${error.message}`);
      return false;
    }
  }

  async run() {
    console.log('🚀 MODEL EXTRACTION TO CSV');
    console.log('==========================\n');
    
    const mistralSuccess = await this.getMistralModels();
    const ai21Success = await this.getAI21Models();
    
    if (mistralSuccess || ai21Success) {
      await this.updateCSVFile();
      
      console.log('\n📊 SUMMARY');
      console.log('==========');
      console.log(`Mistral models: ${this.mistralModels.length}`);
      console.log(`AI21 models: ${this.ai21Models.length}`);
      console.log(`Total new models: ${this.mistralModels.length + this.ai21Models.length}`);
    } else {
      console.log('\n❌ No models extracted - both APIs failed');
    }
  }
}

// Run the extractor
const extractor = new ModelExtractor();
extractor.run();