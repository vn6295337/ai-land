// Debug dashboard data loading in browser environment
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://atilxlecbaqcksnrgzav.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0aWx4bGVjYmFxY2tzbnJnemF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzOTY5MTYsImV4cCI6MjA2Nzk3MjkxNn0.sYRFyQIEzZMlgg5RtHTXDSpvxl-KrJ8E7U3_UroIJog';

console.log('🏗️ Creating Supabase client...');
console.log('URL:', SUPABASE_URL);
console.log('Key prefix:', SUPABASE_ANON_KEY.substring(0, 20) + '...');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Simulate dashboard data fetching
async function simulateDashboardLoad() {
  console.log('\n🎯 Simulating dashboard data loading...');
  
  try {
    // Same query pattern as AiModelsVisualization.tsx
    const { data, error, count } = await supabase
      .from('ai_models_discovery')
      .select('provider, task_type', { count: 'exact' });
    
    if (error) {
      console.error('❌ Dashboard query error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return;
    }
    
    console.log(`✅ Retrieved ${count} models for dashboard`);
    
    // Process data like the dashboard does
    const providerStats = {};
    const taskTypeStats = {};
    
    data.forEach(item => {
      // Provider counting
      providerStats[item.provider] = (providerStats[item.provider] || 0) + 1;
      
      // Task type counting
      taskTypeStats[item.task_type] = (taskTypeStats[item.task_type] || 0) + 1;
    });
    
    console.log('\n📊 Provider Distribution:');
    Object.entries(providerStats)
      .sort(([,a], [,b]) => b - a)
      .forEach(([provider, count]) => {
        console.log(`  ${provider}: ${count} models`);
      });
    
    console.log('\n📋 Task Type Distribution (Top 10):');
    Object.entries(taskTypeStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([taskType, count]) => {
        console.log(`  ${taskType}: ${count} models`);
      });
    
    // Test timestamp queries
    const { data: timestampData, error: tsError } = await supabase
      .from('ai_models_discovery')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);
    
    if (tsError) {
      console.error('❌ Timestamp query failed:', tsError);
    } else {
      console.log('\n🕒 Latest update:', timestampData[0]?.updated_at);
    }
    
  } catch (err) {
    console.error('❌ Simulation failed:', err);
  }
}

simulateDashboardLoad();