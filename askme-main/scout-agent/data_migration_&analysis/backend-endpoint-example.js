/**
 * Example backend endpoint for Supabase sync
 * Add this to your askme-backend-proxy.onrender.com backend
 */

// Example Express.js endpoint
app.post('/api/scout/sync-supabase', async (req, res) => {
  try {
    const { action, data, metadata, config } = req.body;
    
    // Validate request
    if (action !== 'sync-validated-models' || !data || !Array.isArray(data)) {
      return res.status(400).json({ 
        error: 'Invalid request format',
        expected: { action: 'sync-validated-models', data: [], metadata: {}, config: {} }
      });
    }
    
    // Optional: Verify auth token
    const authToken = req.headers.authorization?.replace('Bearer ', '');
    if (process.env.AGENT_AUTH_TOKEN && authToken !== process.env.AGENT_AUTH_TOKEN) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }
    
    // Get Supabase credentials from environment
    const supabaseUrl = process.env.SUPABASE_URL || config.supabase_url;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const tableName = config.table_name || 'validated_models';
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ 
        error: 'Supabase configuration missing',
        missing: {
          url: !supabaseUrl,
          key: !supabaseKey
        }
      });
    }
    
    // Upload to Supabase
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
      throw new Error(`Supabase error: ${supabaseResponse.status} - ${errorText}`);
    }
    
    // Success response
    res.json({
      success: true,
      message: 'Models synced to Supabase successfully',
      stats: {
        records_uploaded: data.length,
        validation_timestamp: metadata.timestamp,
        providers: metadata.providers_with_models,
        total_models: metadata.total_validated_models
      }
    });
    
  } catch (error) {
    console.error('Supabase sync error:', error);
    res.status(500).json({
      error: 'Supabase sync failed',
      message: error.message
    });
  }
});

// Alternative: Simple proxy endpoint
app.post('/api/scout/supabase-proxy', async (req, res) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    
    const { table, data } = req.body;
    
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.text();
    
    res.status(response.status).json({
      success: response.ok,
      data: result || null
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});