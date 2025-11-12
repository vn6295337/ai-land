#!/usr/bin/env node

/**
 * Comprehensive Environment Variable Analysis
 * Investigates API key detection issues
 */

console.log('=== ENVIRONMENT DETECTION ===');
console.log('CLAUDECODE:', process.env.CLAUDECODE || 'undefined');
console.log('RENDER:', process.env.RENDER || 'undefined');
console.log('NODE_ENV:', process.env.NODE_ENV || 'undefined');
console.log('PORT:', process.env.PORT || 'undefined');

console.log('\n=== ALL ENVIRONMENT VARIABLES WITH "KEY" ===');
Object.keys(process.env)
  .filter(key => key.includes('KEY'))
  .sort()
  .forEach(key => {
    const value = process.env[key];
    const preview = value.length > 20 ? value.substring(0,20) + '...' : value;
    console.log(`${key}=${preview}`);
  });

console.log('\n=== EXACT PROVIDER KEY LOOKUP ===');
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

console.log('\n=== ALTERNATIVE KEY NAMING PATTERNS ===');
const alternatives = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY'
];

alternatives.forEach(key => {
  const value = process.env[key];
  const exists = value !== undefined;
  const preview = exists ? (value.length > 15 ? value.substring(0,15) + '...' : value) : 'MISSING';
  console.log(`${key}: ${exists ? '✅' : '❌'} ${preview}`);
});

console.log('\n=== CASE SENSITIVITY TEST ===');
const testKeys = ['mistral_api_key', 'MISTRAL_api_key', 'mistral_API_KEY'];
testKeys.forEach(key => {
  const value = process.env[key];
  console.log(`${key}: ${value ? '✅ ' + value.substring(0,10) + '...' : '❌ MISSING'}`);
});

console.log('\n=== WHITESPACE/ENCODING TEST ===');
if (process.env.MISTRAL_API_KEY) {
  const key = process.env.MISTRAL_API_KEY;
  console.log(`MISTRAL_API_KEY length: ${key.length}`);
  console.log(`MISTRAL_API_KEY first char code: ${key.charCodeAt(0)}`);
  console.log(`MISTRAL_API_KEY last char code: ${key.charCodeAt(key.length-1)}`);
  console.log(`MISTRAL_API_KEY trimmed equals original: ${key.trim() === key}`);
}

console.log('\n=== IMPORT TEST ===');
try {
  const module = await import('./api_key_rotation.js');
  const APIKeyRotationManager = module.default;
  const manager = new APIKeyRotationManager();
  
  console.log('API Key Manager created successfully');
  console.log('Manager pool keys:', Object.keys(manager.apiKeyPools));
  
  Object.keys(manager.apiKeyPools).forEach(provider => {
    const pool = manager.apiKeyPools[provider];
    console.log(`${provider}: ${pool.length} keys`);
  });
  
} catch (error) {
  console.error('Import error:', error.message);
}