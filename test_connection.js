// Test Lovable-Supabase connection
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://atilxlecbaqcksnrgzav.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0aWx4bGVjYmFxY2tzbnJnemF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzOTY5MTYsImV4cCI6MjA2Nzk3MjkxNn0.sYRFyQIEzZMlgg5RtHTXDSpvxl-KrJ8E7U3_UroIJog';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConnection() {
  console.log('🔍 Testing Supabase connection...');
  
  try {
    // Test 1: Count total models
    const { count, error: countError } = await supabase
      .from('ai_models_discovery')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Count query failed:', countError);
      return;
    }
    
    console.log(`✅ Total models: ${count}`);
    
    // Test 2: Get sample data
    const { data, error } = await supabase
      .from('ai_models_discovery')
      .select('provider, task_type, model_name')
      .limit(5);
    
    if (error) {
      console.error('❌ Sample query failed:', error);
      return;
    }
    
    console.log('✅ Sample data:', data);
    
    // Test 3: Get provider breakdown
    const { data: providers, error: providerError } = await supabase
      .from('ai_models_discovery')
      .select('provider, task_type')
      .limit(1000);
    
    if (providerError) {
      console.error('❌ Provider query failed:', providerError);
      return;
    }
    
    const stats = {};
    providers.forEach(row => {
      if (!stats[row.provider]) stats[row.provider] = new Set();
      stats[row.provider].add(row.task_type);
    });
    
    console.log('📊 Provider breakdown:');
    Object.entries(stats).forEach(([provider, taskTypes]) => {
      console.log(`  ${provider}: ${taskTypes.size} task types`);
    });
    
  } catch (err) {
    console.error('❌ Connection failed:', err);
  }
}

testConnection();