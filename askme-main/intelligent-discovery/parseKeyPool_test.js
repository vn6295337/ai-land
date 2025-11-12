#!/usr/bin/env node

/**
 * Test parseKeyPool function in isolation
 */

function parseKeyPool(baseEnvVar) {
  const keys = [];
  
  console.log(`\n=== Testing parseKeyPool('${baseEnvVar}') ===`);
  
  // Check for comma-separated keys in single variable
  const singleVar = process.env[baseEnvVar];
  console.log(`Direct lookup process.env['${baseEnvVar}']:`, singleVar ? 'EXISTS' : 'MISSING');
  
  if (singleVar) {
    console.log(`Value: "${singleVar}"`);
    console.log(`Length: ${singleVar.length}`);
    console.log(`Split by comma:`, singleVar.split(','));
    
    keys.push(...singleVar.split(',').map(k => k.trim()).filter(k => k));
    console.log(`Keys after processing:`, keys);
  }
  
  // Check for numbered environment variables
  let index = 1;
  while (process.env[`${baseEnvVar}_${index}`]) {
    console.log(`Found numbered key: ${baseEnvVar}_${index}`);
    keys.push(process.env[`${baseEnvVar}_${index}`]);
    index++;
  }
  
  const result = keys.filter(key => key && key.length > 0);
  console.log(`Final result: ${result.length} keys`);
  return result;
}

// Test all expected keys
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
  const result = parseKeyPool(key);
  console.log(`\n${key}: ${result.length} keys found`);
});

// Test existing keys
console.log('\n=== Testing Existing Keys ===');
const existingKeys = ['GEMINI_API_KEY', 'MISTRAL_API_KEY'];
existingKeys.forEach(key => {
  const result = parseKeyPool(key);
  console.log(`\n${key}: ${result.length} keys found`);
});

console.log('\n=== Manual Verification ===');
console.log('process.env.GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
console.log('process.env.GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
console.log('process.env.TOGETHER_API_KEY exists:', !!process.env.TOGETHER_API_KEY);