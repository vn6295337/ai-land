#!/usr/bin/env node

/**
 * Fix AI21 data conversion - handle nested data.data structure
 */

import fs from 'fs';
import path from 'path';

class AI21DataFixer {
  constructor() {
    this.outputDir = './generated_outputs';
  }

  loadJSONData(filename) {
    const filePath = path.join(this.outputDir, filename);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data;
  }

  escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\t')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  fixAI21Data() {
    console.log('🧠 Analyzing AI21 Data Structure');
    console.log('================================');

    // Find the latest direct API fetch file
    const files = fs.readdirSync(this.outputDir);
    const directApiFile = files.find(f => f.startsWith('direct_api_fetch_') && f.endsWith('.json'));
    
    if (!directApiFile) {
      console.error('❌ No direct API fetch JSON file found');
      return;
    }

    const data = this.loadJSONData(directApiFile);
    
    if (!data.ai21) {
      console.log('❌ No AI21 data found');
      return;
    }

    console.log('AI21 Raw Structure:');
    console.log('===================');
    console.log('Status:', data.ai21.status);
    console.log('Count:', data.ai21.count);
    console.log('Data type:', typeof data.ai21.data);
    console.log('Data keys:', Object.keys(data.ai21.data || {}));
    
    if (data.ai21.data && data.ai21.data.data) {
      console.log('Nested data array length:', data.ai21.data.data.length);
      console.log('First model sample:');
      console.log(JSON.stringify(data.ai21.data.data[0], null, 2));
      
      // Convert AI21 models to CSV
      const models = data.ai21.data.data.map(model => ({
        id: model.id || '',
        name: model.name || '',
        updated: model.updated || '',
        context_length: model.context_length || 0,
        quantization: model.quantization || '',
        max_completion_tokens: model.max_completion_tokens || 0
      }));

      console.log(`\n✅ Found ${models.length} AI21 models:`);
      models.forEach((model, i) => {
        console.log(`${i + 1}. ${model.name} (${model.id})`);
        console.log(`   Context: ${model.context_length}, Max tokens: ${model.max_completion_tokens}`);
      });

      // Create proper CSV for AI21
      const headers = ['id', 'name', 'updated', 'context_length', 'quantization', 'max_completion_tokens'];
      const csvContent = [
        headers.join('\t'),
        ...models.map(model => 
          headers.map(header => this.escapeCSV(model[header])).join('\t')
        )
      ].join('\n');

      // Save corrected AI21 sheet
      fs.writeFileSync(`${this.outputDir}/sheet_ai21_fixed.tsv`, csvContent);
      console.log(`\n✅ Created corrected AI21 sheet: sheet_ai21_fixed.tsv`);

      // Also create CSV version
      const csvVersion = csvContent.replace(/\t/g, ',');
      fs.writeFileSync(`${this.outputDir}/sheet_ai21_fixed.csv`, csvVersion);
      console.log(`✅ Created corrected AI21 CSV: sheet_ai21_fixed.csv`);

      return { models, csvContent };
    } else {
      console.log('❌ AI21 data.data not found or empty');
      return null;
    }
  }

  analyzeAllProviders() {
    console.log('\n📊 PROVIDER DATA STRUCTURE ANALYSIS');
    console.log('====================================');

    const files = fs.readdirSync(this.outputDir);
    const directApiFile = files.find(f => f.startsWith('direct_api_fetch_') && f.endsWith('.json'));
    const data = this.loadJSONData(directApiFile);

    Object.keys(data).forEach(provider => {
      console.log(`\n${provider.toUpperCase()}:`);
      const providerData = data[provider];
      
      if (providerData.error) {
        console.log(`  ❌ Error: ${providerData.error}`);
      } else if (providerData.status) {
        console.log(`  ✅ Status: ${providerData.status}`);
        console.log(`  📊 Count: ${providerData.count || 'N/A'}`);
        
        if (providerData.data) {
          console.log(`  📁 Data type: ${typeof providerData.data}`);
          
          if (Array.isArray(providerData.data)) {
            console.log(`  📋 Array length: ${providerData.data.length}`);
          } else if (typeof providerData.data === 'object') {
            const keys = Object.keys(providerData.data);
            console.log(`  🔑 Object keys: ${keys.join(', ')}`);
            
            // Check for nested arrays
            keys.forEach(key => {
              const nested = providerData.data[key];
              if (Array.isArray(nested)) {
                console.log(`    📋 ${key}: array with ${nested.length} items`);
              } else if (typeof nested === 'object' && nested !== null) {
                console.log(`    📁 ${key}: object with keys [${Object.keys(nested).join(', ')}]`);
              }
            });
          }
        }
      }
    });
  }
}

// Run the fixer
const fixer = new AI21DataFixer();
fixer.fixAI21Data();
fixer.analyzeAllProviders();