/**
 * Production-ready Supabase sync endpoint for askme-backend-proxy
 * Add this to your Express.js backend
 */

// POST /api/scout/sync-supabase
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
          data: [], // Array of flattened model records
          metadata: {}, // Original metadata from validated_models.json
          config: {} // Supabase configuration
        }
      });
    }
    
    // Optional: Verify auth token if you want authentication
    const authToken = req.headers.authorization?.replace('Bearer ', '');
    if (process.env.AGENT_AUTH_TOKEN && authToken !== process.env.AGENT_AUTH_TOKEN) {
      console.log('❌ Invalid auth token provided');
      return res.status(401).json({ error: 'Invalid or missing auth token' });
    }
    
    // Get Supabase configuration
    const supabaseUrl = process.env.SUPABASE_URL || config.supabase_url || 'https://pfmsevvxgvofqyrrtojk.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const tableName = config.table_name || 'validated_models';
    
    if (!supabaseKey) {
      console.error('❌ SUPABASE_ANON_KEY environment variable missing');
      return res.status(500).json({ 
        error: 'Supabase configuration incomplete',
        message: 'SUPABASE_ANON_KEY environment variable is required'
      });
    }
    
    console.log(`📊 Syncing ${data.length} records to Supabase table: ${tableName}`);
    
    // Upload to Supabase using fetch (or axios if you prefer)
    const supabaseResponse = await fetch(`${supabaseUrl}/rest/v1/${tableName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Prefer': 'return=minimal' // Don't return inserted data to save bandwidth
      },
      body: JSON.stringify(data)
    });
    
    if (!supabaseResponse.ok) {
      const errorText = await supabaseResponse.text();
      console.error('❌ Supabase upload failed:', supabaseResponse.status, errorText);
      
      // Try to parse error for better debugging
      let errorDetail = errorText;
      try {
        const parsedError = JSON.parse(errorText);
        errorDetail = parsedError.message || parsedError.hint || errorText;
      } catch (e) {
        // Keep original error text
      }
      
      return res.status(500).json({
        error: 'Supabase upload failed',
        status: supabaseResponse.status,
        message: errorDetail,
        suggestion: supabaseResponse.status === 409 ? 
          'Records may already exist. Check for duplicate record_id values.' :
          'Check Supabase table schema and permissions.'
      });
    }
    
    console.log('✅ Successfully synced to Supabase');
    
    // Success response with useful information
    res.json({
      success: true,
      message: 'Models synced to Supabase successfully',
      stats: {
        records_uploaded: data.length,
        validation_timestamp: metadata.timestamp,
        providers: metadata.providers_with_models || [],
        total_models_validated: metadata.total_validated_models,
        total_models_checked: metadata.total_models_checked,
        sync_timestamp: new Date().toISOString()
      },
      supabase: {
        url: supabaseUrl,
        table: tableName,
        response_status: supabaseResponse.status
      }
    });
    
  } catch (error) {
    console.error('❌ Supabase sync error:', error);
    res.status(500).json({
      error: 'Internal server error during Supabase sync',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Optional: Health check endpoint for sync functionality
app.get('/api/scout/sync-health', (req, res) => {
  const hasSupabaseKey = !!process.env.SUPABASE_ANON_KEY;
  const hasAuthToken = !!process.env.AGENT_AUTH_TOKEN;
  
  res.json({
    status: 'ok',
    endpoint: '/api/scout/sync-supabase',
    environment: {
      supabase_configured: hasSupabaseKey,
      auth_configured: hasAuthToken,
      supabase_url: process.env.SUPABASE_URL || 'https://pfmsevvxgvofqyrrtojk.supabase.co'
    },
    instructions: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer <AGENT_AUTH_TOKEN>' // Optional
      },
      body: {
        action: 'sync-validated-models',
        data: [], // Array of flattened records
        metadata: {}, // Original metadata
        config: { table_name: 'validated_models' }
      }
    }
  });
});

// If using Express Router (alternative approach):
/*
const express = require('express');
const router = express.Router();

router.post('/sync-supabase', async (req, res) => {
  // ... same code as above
});

router.get('/sync-health', (req, res) => {
  // ... same code as above
});

module.exports = router;

// Then in your main app:
// app.use('/api/scout', require('./routes/scout'));
*/