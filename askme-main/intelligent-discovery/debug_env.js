#!/usr/bin/env node

console.log('=== ENVIRONMENT VARIABLE EXACT NAMES ===');
Object.keys(process.env).filter(k => k.includes('API') || k.includes('KEY')).sort().forEach(k => {
  console.log(`${k}=${process.env[k].substring(0,15)}...`);
});

console.log('\n=== EXPECTED vs ACTUAL ===');
const expected = ['AI21_API_KEY', 'ARTIFICIALANALYSIS_API_KEY', 'COHERE_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'HUGGINGFACE_API_KEY', 'MISTRAL_API_KEY', 'OPENROUTER_API_KEY', 'TOGETHER_API_KEY'];

console.log('\n=== CURRENT ENVIRONMENT KEYS ===');
const current = ['AI21_API_KEY', 'ARTIFICIALANALYSIS_API_KEY', 'COHERE_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'HUGGINGFACE_API_KEY', 'MISTRAL_API_KEY', 'OPENROUTER_API_KEY', 'TOGETHER_API_KEY'];

expected.forEach(key => {
  const exists = process.env[key] !== undefined;
  const value = exists ? process.env[key].substring(0,10) + '...' : 'MISSING';
  console.log(`${key}: ${exists ? '✅' : '❌'} ${value}`);
});

current.forEach(key => {
  const exists = process.env[key] !== undefined;
  const value = exists ? process.env[key].substring(0,10) + '...' : 'MISSING';
  console.log(`${key}: ${exists ? '✅' : '❌'} ${value}`);
});

console.log('\n=== PATTERN MATCHING SEARCH ===');
Object.keys(process.env).forEach(k => {
  if (k.match(/AI21|COHERE|GROQ|HUGGING|OPENROUTER|TOGETHER|ARTIFICIAL/i)) {
    console.log(`FOUND: ${k}=${process.env[k].substring(0,15)}...`);
  }
});