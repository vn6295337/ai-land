// Supabase Client for AskMe Backend
// Connects to ai_models_main table shared with discoverer and ai-land

const { createClient } = require('@supabase/supabase-js');

// Validate required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('💡 Copy .env.example to .env and configure Supabase credentials');
    process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);

console.log('✅ Supabase client initialized');
console.log(`📊 Connected to: ${process.env.SUPABASE_URL}`);

/**
 * Fetch all models from ai_models_main table
 * @returns {Promise<Array>} Array of model objects
 */
async function getAllModels() {
    try {
        const { data, error } = await supabase
            .from('ai_models_main')
            .select('*')
            .order('inference_provider', { ascending: true })
            .order('human_readable_name', { ascending: true });

        if (error) {
            console.error('❌ Supabase query error:', error);
            throw error;
        }

        console.log(`✅ Fetched ${data.length} models from ai_models_main`);
        return data;
    } catch (error) {
        console.error('❌ Error fetching models:', error.message);
        throw error;
    }
}

/**
 * Fetch models by provider
 * @param {string} providerName - Provider name (google, groq, openrouter)
 * @returns {Promise<Array>} Array of model objects for the provider
 */
async function getModelsByProvider(providerName) {
    try {
        const { data, error} = await supabase
            .from('ai_models_main')
            .select('*')
            .eq('inference_provider', providerName)
            .order('human_readable_name', { ascending: true });

        if (error) {
            console.error(`❌ Supabase query error for provider ${providerName}:`, error);
            throw error;
        }

        console.log(`✅ Fetched ${data.length} models for provider: ${providerName}`);
        return data;
    } catch (error) {
        console.error(`❌ Error fetching models for ${providerName}:`, error.message);
        throw error;
    }
}

/**
 * Fetch specific model by ID
 * @param {string} modelId - Model ID
 * @returns {Promise<Object>} Model object
 */
async function getModelById(modelId) {
    try {
        const { data, error } = await supabase
            .from('ai_models_main')
            .select('*')
            .eq('model_id', modelId)
            .single();

        if (error) {
            console.error(`❌ Supabase query error for model ${modelId}:`, error);
            throw error;
        }

        console.log(`✅ Fetched model: ${modelId}`);
        return data;
    } catch (error) {
        console.error(`❌ Error fetching model ${modelId}:`, error.message);
        throw error;
    }
}

/**
 * Get list of available providers from ai_models_main
 * @returns {Promise<Array>} Array of unique provider names
 */
async function getAvailableProviders() {
    try {
        const { data, error } = await supabase
            .from('ai_models_main')
            .select('inference_provider')
            .order('inference_provider', { ascending: true });

        if (error) {
            console.error('❌ Supabase query error for providers:', error);
            throw error;
        }

        // Get unique provider names
        const providers = [...new Set(data.map(row => row.inference_provider))];
        console.log(`✅ Available providers: ${providers.join(', ')}`);
        return providers;
    } catch (error) {
        console.error('❌ Error fetching providers:', error.message);
        throw error;
    }
}

/**
 * Get model count by provider
 * @returns {Promise<Object>} Object with provider names as keys and counts as values
 */
async function getModelCountsByProvider() {
    try {
        const { data, error } = await supabase
            .from('ai_models_main')
            .select('inference_provider');

        if (error) {
            console.error('❌ Supabase query error for model counts:', error);
            throw error;
        }

        // Count models per provider
        const counts = data.reduce((acc, row) => {
            acc[row.inference_provider] = (acc[row.inference_provider] || 0) + 1;
            return acc;
        }, {});

        console.log('✅ Model counts by provider:', counts);
        return counts;
    } catch (error) {
        console.error('❌ Error fetching model counts:', error.message);
        throw error;
    }
}

module.exports = {
    supabase,
    getAllModels,
    getModelsByProvider,
    getModelById,
    getAvailableProviders,
    getModelCountsByProvider
};
