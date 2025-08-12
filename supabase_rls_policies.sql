-- Supabase RLS Policies for AI Models Discovery
-- Run these commands in your Supabase SQL Editor

-- Enable RLS on ai_models_discovery table
ALTER TABLE ai_models_discovery ENABLE ROW LEVEL SECURITY;

-- Enable RLS on ai_models_staging table  
ALTER TABLE ai_models_staging ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow public read access to ai_models_discovery
-- This allows the dashboard to read data using ANON key
CREATE POLICY "Public read access on ai_models_discovery" 
ON ai_models_discovery 
FOR SELECT 
TO PUBLIC 
USING (true);

-- Policy 2: Allow service_role full access to ai_models_discovery
-- This allows the API Gateway to insert/update/delete using service_role key
CREATE POLICY "Service role full access on ai_models_discovery" 
ON ai_models_discovery 
FOR ALL 
TO service_role 
USING (true);

-- Policy 3: Deny public write access to ai_models_discovery
-- This ensures ANON keys cannot modify data
CREATE POLICY "Deny public writes on ai_models_discovery" 
ON ai_models_discovery 
FOR INSERT, UPDATE, DELETE 
TO PUBLIC 
USING (false);

-- Policy 4: Allow service_role full access to ai_models_staging
-- API Gateway needs full control over staging table
CREATE POLICY "Service role full access on ai_models_staging" 
ON ai_models_staging 
FOR ALL 
TO service_role 
USING (true);

-- Policy 5: Deny all public access to ai_models_staging
-- Staging table should be completely private
CREATE POLICY "Deny public access on ai_models_staging" 
ON ai_models_staging 
FOR ALL 
TO PUBLIC 
USING (false);

-- Verify policies are created
SELECT 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual 
FROM pg_policies 
WHERE tablename IN ('ai_models_discovery', 'ai_models_staging')
ORDER BY tablename, policyname;