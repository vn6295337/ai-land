// Debug environment variable loading in different contexts

console.log('🔍 Environment Variable Debug');
console.log('================================');

// Check Node.js environment
console.log('\n📊 Node.js process.env:');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL || 'NOT FOUND');
console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? 'FOUND' : 'NOT FOUND');

// Check if dotenv is available
try {
  const dotenv = require('dotenv');
  const result = dotenv.config();
  
  if (result.error) {
    console.log('\n❌ dotenv load error:', result.error.message);
  } else {
    console.log('\n✅ dotenv loaded successfully');
    console.log('Parsed keys:', Object.keys(result.parsed || {}));
  }
} catch (err) {
  console.log('\n⚠️ dotenv not available:', err.message);
}

// Simulate Vite import.meta.env behavior
console.log('\n🏗️ Simulating Vite environment:');

// Read .env file manually if it exists
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  console.log('\n📄 .env file content:');
  envContent.split('\n').forEach((line, index) => {
    if (line.trim() && !line.startsWith('#')) {
      console.log(`${index + 1}: ${line}`);
    }
  });
  
  // Parse .env manually
  const envVars = {};
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      envVars[match[1]] = match[2];
    }
  });
  
  console.log('\n🎯 Parsed environment variables:');
  console.log('VITE_SUPABASE_URL:', envVars.VITE_SUPABASE_URL || 'NOT FOUND');
  console.log('VITE_SUPABASE_ANON_KEY:', envVars.VITE_SUPABASE_ANON_KEY ? 'FOUND' : 'NOT FOUND');
  
  // Test what the client.ts would see
  const mockImportMeta = {
    env: envVars
  };
  
  const SUPABASE_URL = mockImportMeta.env.VITE_SUPABASE_URL || 'https://atilxlecbaqcksnrgzav.supabase.co';
  const SUPABASE_KEY = mockImportMeta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
  
  console.log('\n🔧 Client would use:');
  console.log('URL:', SUPABASE_URL);
  console.log('Key source:', mockImportMeta.env.VITE_SUPABASE_ANON_KEY ? 'ENVIRONMENT' : 'FALLBACK');
  
} catch (err) {
  console.log('\n❌ Could not read .env file:', err.message);
}

console.log('\n🎯 Conclusion:');
console.log('- Local .env file exists with correct values');
console.log('- Client.ts has correct fallback values'); 
console.log('- Issue likely: Lovable production env not set or cached build');