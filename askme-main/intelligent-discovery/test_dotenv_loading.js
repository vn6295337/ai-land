#!/usr/bin/env node

/**
 * Test dotenv loading explicitly
 */

import dotenv from 'dotenv';
import path from 'path';

console.log('=== BEFORE DOTENV LOADING ===');
console.log('AI21_API_KEY:', process.env.AI21_API_KEY ? '✅ EXISTS' : '❌ MISSING');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ EXISTS' : '❌ MISSING');

console.log('\n=== LOADING .env FILE ===');
const envPath = path.resolve('.env');
console.log('Looking for .env at:', envPath);

const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('❌ Error loading .env:', result.error.message);
} else {
  console.log('✅ .env loaded successfully');
  console.log('Parsed keys:', Object.keys(result.parsed || {}));
}

console.log('\n=== AFTER DOTENV LOADING ===');
const expectedKeys = [
  'AI21_API_KEY',
  'ARTIFICIALANALYSIS_API_KEY', 
  'COHERE_API_KEY',
  'GEMINI_API_KEY',
  'GROQ_API_KEY',
  'HUGGINGFACE_API_KEY',
  'MISTRAL_API_KEY',
  'OPENROUTER_API_KEY',
  'TOGETHER_API_KEY'
];

expectedKeys.forEach(key => {
  const value = process.env[key];
  const exists = value !== undefined;
  const preview = exists ? (value.length > 15 ? value.substring(0,15) + '...' : value) : 'MISSING';
  console.log(`${key}: ${exists ? '✅' : '❌'} ${preview}`);
});

console.log('\n=== TESTING APIKeyRotationManager AFTER DOTENV ===');
try {
  const module = await import('./api_key_rotation.js');
  const APIKeyRotationManager = module.default;
  const manager = new APIKeyRotationManager();
  
  console.log('\nManager results:');
  Object.keys(manager.apiKeyPools).forEach(provider => {
    const pool = manager.apiKeyPools[provider];
    console.log(`${provider}: ${pool.length} keys`);
  });
  
} catch (error) {
  console.error('Import error:', error.message);
}