#!/usr/bin/env node

/**
 * Simple Mistral API key test
 */

import dotenv from 'dotenv';
dotenv.config();

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

console.log('Testing Mistral API Key...');
console.log('Key present:', !!MISTRAL_API_KEY);
console.log('Key length:', MISTRAL_API_KEY?.length || 0);
console.log('Key preview:', MISTRAL_API_KEY?.substring(0, 8) + '...' || 'N/A');

// Test the models endpoint
const testMistralModels = async () => {
  try {
    const response = await fetch('https://api.mistral.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('\nAPI Response:');
    console.log('Status:', response.status, response.statusText);
    
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('✅ SUCCESS - Models count:', data.data?.length || 0);
      return true;
    } else {
      console.log('❌ FAILED - API key may be invalid or expired');
      return false;
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
    return false;
  }
};

testMistralModels();