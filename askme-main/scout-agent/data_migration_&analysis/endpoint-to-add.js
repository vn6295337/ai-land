// Add this code to your Express app (app.js, server.js, or main backend file)
// Place it with your other route definitions

// Supabase sync endpoint for Scout Agent
app.post('/api/scout/sync-supabase', async (req, res) => {
  try {
    console.log('📤 Supabase sync request received');
    
    const { action, data, metadata, config } = req.body;
    
    // Validate request structure
    if (action !== 'sync-validated-models' || !data || !Array.isArray(data)) {
      return res.status(400).json({ 
        error: 'Invalid request format',
        expected: {
          action: 'sync-validated-models',
          data: [], 
          metadata: {}, 
          config: {}
        }
      });
    }
    
    // Optional: Verify auth token (uses your existing AGENT_AUTH_TOKEN)
    const authToken = req.headers.authorization?.replace('Bearer ', '');
    if (process.env.AGENT_AUTH_TOKEN && authToken !== process.env.AGENT_AUTH_TOKEN) {
      return res.status(401).json({ error: 'Invalid or missing auth token' });
    }
    
    // Get Supabase configuration (uses your existing SUPABASE_ANON_KEY)
    const supabaseUrl = process.env.SUPABASE_URL || 'https://pfmsevvxgvofqyrrtojk.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const tableName = config.table_name || 'validated_models';
    
    if (!supabaseKey) {
      return res.status(500).json({ 
        error: 'Supabase configuration incomplete',
        message: 'SUPABASE_ANON_KEY environment variable is required'
      });
    }
    
    console.log(`📊 Syncing ${data.length} records to Supabase`);
    
    // Upload to Supabase using fetch (no additional dependencies needed)
    const supabaseResponse = await fetch(`${supabaseUrl}/rest/v1/${tableName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(data)
    });
    
    if (!supabaseResponse.ok) {
      const errorText = await supabaseResponse.text();
      console.error('❌ Supabase upload failed:', supabaseResponse.status, errorText);
      
      return res.status(500).json({
        error: 'Supabase upload failed',
        status: supabaseResponse.status,
        message: errorText,
        suggestion: supabaseResponse.status === 409 ? 
          'Records may already exist. Check for duplicate record_id values.' :
          'Check Supabase table schema and permissions.'
      });
    }
    
    console.log('✅ Successfully synced to Supabase');
    
    // Success response
    res.json({
      success: true,
      message: 'Models synced to Supabase successfully',
      stats: {
        records_uploaded: data.length,
        validation_timestamp: metadata.timestamp,
        providers: metadata.providers_with_models || [],
        total_models_validated: metadata.total_validated_models,
        sync_timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Supabase sync error:', error);
    res.status(500).json({
      error: 'Internal server error during Supabase sync',
      message: error.message
    });
  }
});

// Health check endpoint (optional but recommended)
app.get('/api/scout/sync-health', (req, res) => {
  res.json({
    status: 'ok',
    endpoint: '/api/scout/sync-supabase',
    environment: {
      supabase_configured: !!process.env.SUPABASE_ANON_KEY,
      auth_configured: !!process.env.AGENT_AUTH_TOKEN,
      supabase_url: process.env.SUPABASE_URL || 'https://pfmsevvxgvofqyrrtojk.supabase.co'
    },
    instructions: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        action: 'sync-validated-models',
        data: [], 
        metadata: {}, 
        config: { table_name: 'validated_models' }
      }
    }
  });
});