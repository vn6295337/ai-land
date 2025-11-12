-- Supabase Table Schema for AI Model Discovery
-- Table: validated_models
-- This table stores discovered AI models from multiple providers

CREATE TABLE IF NOT EXISTS validated_models (
  -- Primary identifier
  id BIGSERIAL PRIMARY KEY,
  
  -- Core model information (always present)
  model_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  task_type TEXT NOT NULL,
  api_available BOOLEAN DEFAULT true,
  free_tier BOOLEAN DEFAULT false,
  
  -- Discovery metadata (always present)
  discovery_method TEXT DEFAULT 'direct_api_local',
  discovery_timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  -- Provider-specific fields (nullable)
  -- HuggingFace specific
  downloads BIGINT,
  likes INTEGER,
  pipeline_tag TEXT,
  library_name TEXT,
  
  -- Google/Gemini specific
  description TEXT,
  display_name TEXT,
  input_token_limit INTEGER,
  output_token_limit INTEGER,
  supported_generation_methods JSONB,
  version TEXT,
  
  -- Groq/Mistral specific
  object TEXT,
  owned_by TEXT,
  
  -- OpenRouter specific
  architecture JSONB,
  context_length INTEGER,
  per_request_limits JSONB,
  top_provider JSONB,
  
  -- Together AI specific
  config JSONB,
  
  -- Cohere specific
  tokenizer_url TEXT,
  
  -- Common timestamp fields (using different names for compatibility)
  created_at TIMESTAMPTZ,
  created INTEGER, -- Unix timestamp for some providers
  
  -- Search and indexing
  created_at_index TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(model_name, provider, discovery_timestamp)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_validated_models_provider ON validated_models(provider);
CREATE INDEX IF NOT EXISTS idx_validated_models_task_type ON validated_models(task_type);
CREATE INDEX IF NOT EXISTS idx_validated_models_free_tier ON validated_models(free_tier);
CREATE INDEX IF NOT EXISTS idx_validated_models_discovery_timestamp ON validated_models(discovery_timestamp);
CREATE INDEX IF NOT EXISTS idx_validated_models_model_name ON validated_models(model_name);

-- Enable Row Level Security (RLS)
ALTER TABLE validated_models ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow public read access
CREATE POLICY "Allow public read access" ON validated_models
  FOR SELECT TO public
  USING (true);

-- Allow authenticated inserts (for API keys with proper permissions)
CREATE POLICY "Allow authenticated inserts" ON validated_models
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Allow authenticated updates
CREATE POLICY "Allow authenticated updates" ON validated_models
  FOR UPDATE TO authenticated
  USING (true);

-- Allow authenticated deletes (for clearing old data)
CREATE POLICY "Allow authenticated deletes" ON validated_models
  FOR DELETE TO authenticated
  USING (true);

-- Comments for documentation
COMMENT ON TABLE validated_models IS 'Stores AI models discovered from various providers via API calls';
COMMENT ON COLUMN validated_models.model_name IS 'Unique identifier for the model from the provider';
COMMENT ON COLUMN validated_models.provider IS 'AI provider (huggingface, google, cohere, etc.)';
COMMENT ON COLUMN validated_models.task_type IS 'Type of AI task (text-generation, text-to-image, etc.)';
COMMENT ON COLUMN validated_models.free_tier IS 'Whether this model has free tier access';
COMMENT ON COLUMN validated_models.discovery_timestamp IS 'When this model was discovered by our system';