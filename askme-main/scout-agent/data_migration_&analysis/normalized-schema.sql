-- Normalized Database Schema for Scout Agent Model Data
-- Clean, efficient structure for validated AI model information

-- 1. PROVIDERS TABLE
-- Master list of AI model providers
CREATE TABLE providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    website_url TEXT,
    documentation_base_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. VALIDATION_RUNS TABLE  
-- Track each validation run from the GitHub workflow
CREATE TABLE validation_runs (
    id SERIAL PRIMARY KEY,
    run_timestamp TIMESTAMPTZ NOT NULL,
    trigger_type VARCHAR(50), -- 'workflow_dispatch', 'schedule', etc.
    trigger_reason TEXT,
    total_models_checked INTEGER,
    total_models_validated INTEGER,
    total_models_excluded INTEGER,
    geographic_filtering_enabled BOOLEAN DEFAULT true,
    run_status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MODELS TABLE
-- Core model information (relatively static)
CREATE TABLE models (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id),
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(150),
    model_family VARCHAR(50), -- 'gpt', 'llama', 'gemini', etc.
    model_size VARCHAR(20),   -- '7b', '70b', '8x7b', etc.
    is_open_source BOOLEAN DEFAULT false,
    official_documentation_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(provider_id, name)
);

-- 4. MODEL_CAPABILITIES TABLE
-- Technical capabilities of each model
CREATE TABLE model_capabilities (
    id SERIAL PRIMARY KEY,
    model_id INTEGER REFERENCES models(id),
    supports_chat BOOLEAN DEFAULT true,
    supports_completion BOOLEAN DEFAULT true,
    supports_vision BOOLEAN DEFAULT false,
    supports_function_calling BOOLEAN DEFAULT false,
    supports_streaming BOOLEAN DEFAULT true,
    max_context_tokens INTEGER, -- Normalized to integer
    max_context_display VARCHAR(20), -- '4K', '128K', etc.
    input_cost_per_1k_tokens DECIMAL(10,6),
    output_cost_per_1k_tokens DECIMAL(10,6),
    is_deprecated BOOLEAN DEFAULT false,
    deprecation_date DATE,
    replacement_model_id INTEGER REFERENCES models(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(model_id)
);

-- 5. MODEL_VALIDATIONS TABLE
-- Results from each validation run for each model
CREATE TABLE model_validations (
    id SERIAL PRIMARY KEY,
    validation_run_id INTEGER REFERENCES validation_runs(id),
    model_id INTEGER REFERENCES models(id),
    
    -- Availability status
    is_api_available BOOLEAN,
    requires_registration BOOLEAN,
    has_free_tier BOOLEAN,
    auth_method VARCHAR(50),
    backend_url TEXT,
    health_status VARCHAR(20), -- 'available', 'unavailable', 'limited'
    
    -- Test results
    test_result TEXT,
    response_time_ms INTEGER,
    error_message TEXT,
    
    -- Geographic compliance
    geographic_origin_verified BOOLEAN,
    is_allowed_region BOOLEAN,
    geographic_restriction_reason TEXT,
    
    -- Availability status
    availability_status VARCHAR(20), -- 'stable', 'beta', 'experimental'
    
    validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(validation_run_id, model_id)
);

-- 6. PROVIDER_ENDPOINTS TABLE
-- API endpoint information for each provider
CREATE TABLE provider_endpoints (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id),
    endpoint_type VARCHAR(30), -- 'chat', 'completion', 'embedding', etc.
    base_url TEXT NOT NULL,
    documentation_url TEXT,
    requires_api_key BOOLEAN DEFAULT true,
    rate_limit_requests_per_minute INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES for optimal performance
CREATE INDEX idx_models_provider_id ON models(provider_id);
CREATE INDEX idx_models_name ON models(name);
CREATE INDEX idx_model_validations_run_id ON model_validations(validation_run_id);
CREATE INDEX idx_model_validations_model_id ON model_validations(model_id);
CREATE INDEX idx_model_validations_health_status ON model_validations(health_status);
CREATE INDEX idx_model_validations_validated_at ON model_validations(validated_at);
CREATE INDEX idx_validation_runs_timestamp ON validation_runs(run_timestamp);

-- VIEWS for common queries

-- 1. Latest validation results for each model
CREATE OR REPLACE VIEW latest_model_status AS
SELECT DISTINCT ON (m.id)
    p.name as provider_name,
    m.name as model_name,
    m.display_name,
    mv.health_status,
    mv.is_api_available,
    mv.has_free_tier,
    mc.supports_vision,
    mc.supports_function_calling,
    mc.max_context_display,
    mv.availability_status,
    vr.run_timestamp as last_validated,
    mv.validated_at
FROM models m
JOIN providers p ON p.id = m.provider_id
LEFT JOIN model_validations mv ON mv.model_id = m.id
LEFT JOIN validation_runs vr ON vr.id = mv.validation_run_id
LEFT JOIN model_capabilities mc ON mc.model_id = m.id
ORDER BY m.id, vr.run_timestamp DESC;

-- 2. Provider summary with model counts
CREATE OR REPLACE VIEW provider_summary AS
SELECT 
    p.name as provider_name,
    p.display_name,
    COUNT(m.id) as total_models,
    COUNT(CASE WHEN mv.health_status = 'available' THEN 1 END) as available_models,
    COUNT(CASE WHEN mv.has_free_tier = true THEN 1 END) as free_tier_models,
    COUNT(CASE WHEN mc.supports_vision = true THEN 1 END) as vision_capable_models,
    COUNT(CASE WHEN mc.supports_function_calling = true THEN 1 END) as function_calling_models,
    MAX(vr.run_timestamp) as last_validation
FROM providers p
LEFT JOIN models m ON m.provider_id = p.id
LEFT JOIN (
    SELECT DISTINCT ON (model_id) 
        model_id, validation_run_id, health_status, has_free_tier, validated_at
    FROM model_validations 
    ORDER BY model_id, validated_at DESC
) mv ON mv.model_id = m.id
LEFT JOIN validation_runs vr ON vr.id = mv.validation_run_id
LEFT JOIN model_capabilities mc ON mc.model_id = m.id
GROUP BY p.id, p.name, p.display_name
ORDER BY p.name;

-- 3. Model capabilities overview
CREATE OR REPLACE VIEW model_capabilities_overview AS
SELECT 
    p.name as provider_name,
    m.name as model_name,
    mc.supports_chat,
    mc.supports_completion,
    mc.supports_vision,
    mc.supports_function_calling,
    mc.supports_streaming,
    mc.max_context_display,
    mc.max_context_tokens,
    CASE 
        WHEN mc.input_cost_per_1k_tokens IS NOT NULL 
        THEN CONCAT('$', mc.input_cost_per_1k_tokens::text, '/1K input')
        ELSE 'Unknown'
    END as input_pricing,
    CASE 
        WHEN mc.output_cost_per_1k_tokens IS NOT NULL 
        THEN CONCAT('$', mc.output_cost_per_1k_tokens::text, '/1K output')
        ELSE 'Unknown'
    END as output_pricing,
    mc.is_deprecated
FROM models m
JOIN providers p ON p.id = m.provider_id
LEFT JOIN model_capabilities mc ON mc.model_id = m.id
ORDER BY p.name, m.name;

-- Row Level Security (RLS) policies
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_endpoints ENABLE ROW LEVEL SECURITY;

-- Allow public read access (adjust as needed)
CREATE POLICY "Public read access" ON providers FOR SELECT USING (true);
CREATE POLICY "Public read access" ON validation_runs FOR SELECT USING (true);
CREATE POLICY "Public read access" ON models FOR SELECT USING (true);
CREATE POLICY "Public read access" ON model_capabilities FOR SELECT USING (true);
CREATE POLICY "Public read access" ON model_validations FOR SELECT USING (true);
CREATE POLICY "Public read access" ON provider_endpoints FOR SELECT USING (true);

-- Table comments for documentation
COMMENT ON TABLE providers IS 'AI model providers (OpenAI, Google, etc.)';
COMMENT ON TABLE validation_runs IS 'GitHub workflow validation runs';
COMMENT ON TABLE models IS 'AI models from various providers';
COMMENT ON TABLE model_capabilities IS 'Technical capabilities of each model';
COMMENT ON TABLE model_validations IS 'Validation results for each model per run';
COMMENT ON TABLE provider_endpoints IS 'API endpoints for each provider';

COMMENT ON VIEW latest_model_status IS 'Latest validation status for each model';
COMMENT ON VIEW provider_summary IS 'Summary statistics by provider';
COMMENT ON VIEW model_capabilities_overview IS 'Capabilities matrix for all models';