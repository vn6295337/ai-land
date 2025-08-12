-- Remove the conflicting permissive policies
-- Run this in Supabase SQL Editor

DROP POLICY "Allow public deletes" ON ai_models_discovery;
DROP POLICY "Allow public inserts" ON ai_models_discovery;
DROP POLICY "Allow public updates" ON ai_models_discovery;

-- Also remove the duplicate read policy
DROP POLICY "Allow public read access" ON ai_models_discovery;

-- Keep only these policies:
-- 1. "Public read access" - SELECT only
-- 2. "Public read only" - restrictive for anon role  
-- 3. "Service role full access discovery" - full access for API Gateway

-- Verify final policies
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'ai_models_discovery'
ORDER BY policyname;