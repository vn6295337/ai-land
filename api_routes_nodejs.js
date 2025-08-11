// api_routes_nodejs.js - AI Models API Gateway routes for Node.js
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with environment variables
const supabaseUrl = process.env.SUPABASE_AI_MODELS_DISCOVERY_URL;
const supabaseServiceKey = process.env.supabase_ai_models_discovery_service_key;
const apiSecretKey = process.env.AI_MODELS_DISCOVERY_API_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Middleware to verify API key
const verifyApiKey = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    if (token !== apiSecretKey) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    next();
};

// Health check endpoint
const healthCheck = (req, res) => {
    res.json({ status: 'healthy', service: 'ai-models-api-gateway' });
};

// Replace all models endpoint
const replaceAllModels = async (req, res) => {
    try {
        const modelsData = req.body.models || [];
        
        if (!modelsData.length) {
            return res.status(400).json({ error: 'No models data provided' });
        }
        
        console.log(`Starting replace operation with ${modelsData.length} models`);
        
        // Clear existing data
        await supabase.from('ai_models_discovery').delete().neq('id', 0);
        console.log('Cleared existing data');
        
        // Insert new data in batches
        let insertedCount = 0;
        const batchSize = 100;
        
        for (let i = 0; i < modelsData.length; i += batchSize) {
            const batch = modelsData.slice(i, i + batchSize);
            await supabase.from('ai_models_discovery').insert(batch);
            insertedCount += batch.length;
            console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}: ${batch.length} models`);
        }
        
        console.log(`Successfully replaced all models: ${insertedCount} total`);
        
        res.json({
            status: 'success',
            operation: 'replace_all',
            models_inserted: insertedCount,
            batches_processed: Math.ceil(modelsData.length / batchSize)
        });
        
    } catch (error) {
        console.error('Error in replace_all_models:', error);
        res.status(500).json({ error: error.message });
    }
};

// Insert staging data endpoint
const insertStagingData = async (req, res) => {
    try {
        const stagingData = req.body.urls || [];
        
        if (!stagingData.length) {
            return res.status(400).json({ error: 'No staging data provided' });
        }
        
        await supabase.from('ai_models_staging').insert(stagingData);
        
        res.json({
            status: 'success',
            operation: 'staging_insert',
            records_inserted: stagingData.length
        });
        
    } catch (error) {
        console.error('Error in insert_staging_data:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    verifyApiKey,
    healthCheck,
    replaceAllModels,
    insertStagingData
};