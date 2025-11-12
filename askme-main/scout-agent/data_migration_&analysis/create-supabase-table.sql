-- Supabase table for Scout Agent validated models
-- Run this in your Supabase SQL Editor

CREATE TABLE validated_models (
    id SERIAL PRIMARY KEY,
    record_id VARCHAR UNIQUE NOT NULL,
    
    -- Validation metadata
    validation_timestamp TIMESTAMPTZ,
    validation_trigger VARCHAR(50),
    validation_reason TEXT,
    total_models_checked INTEGER,
    total_validated_models INTEGER,
    
    -- Model identification
    model_name VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    
    -- Model availability
    api_available BOOLEAN,
    registration_required BOOLEAN,
    free_tier BOOLEAN,
    auth_method VARCHAR(50),
    documentation_url TEXT,
    backend_url TEXT,
    
    -- Health status
    health_status VARCHAR(20),
    test_result TEXT,
    response_time VARCHAR(20),
    last_validated TIMESTAMPTZ,
    
    -- Geographic compliance
    geographic_origin_verified BOOLEAN,
    allowed_region BOOLEAN,
    origin_reason TEXT,
    
    -- Model capabilities (flattened from nested JSON)
    supports_chat BOOLEAN,
    supports_completion BOOLEAN,
    supports_vision BOOLEAN,
    supports_function_calling BOOLEAN,
    supports_streaming BOOLEAN,
    max_context_length VARCHAR(20),
    input_cost_per_token VARCHAR(20),
    output_cost_per_token VARCHAR(20),
    deprecated BOOLEAN,
    availability_status VARCHAR(20),
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_validated_models_provider ON validated_models(provider);
CREATE INDEX idx_validated_models_model_name ON validated_models(model_name);
CREATE INDEX idx_validated_models_validation_timestamp ON validated_models(validation_timestamp);
CREATE INDEX idx_validated_models_record_id ON validated_models(record_id);
CREATE INDEX idx_validated_models_health_status ON validated_models(health_status);
CREATE INDEX idx_validated_models_provider_model ON validated_models(provider, model_name);

-- Composite index for latest records per model
CREATE INDEX idx_validated_models_latest ON validated_models(provider, model_name, validation_timestamp DESC);

-- Enable Row Level Security (RLS) - recommended for production
ALTER TABLE validated_models ENABLE ROW LEVEL SECURITY;

-- Create policy to allow reading for authenticated users
-- Adjust this policy based on your security requirements
CREATE POLICY "Allow read access to validated_models" ON validated_models
    FOR SELECT USING (true); -- Allow all reads, or customize as needed

-- Create policy for service role inserts (for your backend)
CREATE POLICY "Allow insert for service role" ON validated_models
    FOR INSERT WITH CHECK (true); -- Your backend will use service role key

-- Optional: Create a view for the latest validation per model
CREATE OR REPLACE VIEW latest_validated_models AS
SELECT DISTINCT ON (provider, model_name) *
FROM validated_models
ORDER BY provider, model_name, validation_timestamp DESC;

-- Optional: Create a summary view by provider
CREATE OR REPLACE VIEW provider_model_summary AS
SELECT 
    provider,
    COUNT(*) as total_models,
    COUNT(CASE WHEN health_status = 'available' THEN 1 END) as available_models,
    COUNT(CASE WHEN free_tier = true THEN 1 END) as free_tier_models,
    COUNT(CASE WHEN supports_vision = true THEN 1 END) as vision_capable_models,
    COUNT(CASE WHEN supports_function_calling = true THEN 1 END) as function_calling_models,
    MAX(validation_timestamp) as last_validation
FROM latest_validated_models
GROUP BY provider
ORDER BY provider;

-- Grant permissions to your service role (replace 'service_role' with your actual role if different)
-- GRANT ALL ON validated_models TO service_role;
-- GRANT USAGE ON SEQUENCE validated_models_id_seq TO service_role;

COMMENT ON TABLE validated_models IS 'Scout Agent validated AI model data from GitHub workflow runs';
COMMENT ON COLUMN validated_models.record_id IS 'Unique identifier: provider_model_timestamp';
COMMENT ON COLUMN validated_models.validation_timestamp IS 'When the validation was performed';
COMMENT ON COLUMN validated_models.health_status IS 'Model endpoint health: available, unavailable, etc.';
COMMENT ON COLUMN validated_models.max_context_length IS 'Maximum context window size (e.g., "4K", "128K")';

-- Show table info
\d validated_models;