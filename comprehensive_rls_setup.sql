-- =============================================================================
-- COMPREHENSIVE RLS POLICY SETUP FOR AI MODELS DISCOVERY
-- =============================================================================
-- This script creates a clean, secure RLS setup with no conflicts
-- Run this entire script in your Supabase SQL Editor

-- =============================================================================
-- STEP 1: CLEAN SLATE - Remove all existing policies
-- =============================================================================

-- Drop all existing policies on ai_models_discovery
DROP POLICY IF EXISTS "Allow public deletes" ON ai_models_discovery;
DROP POLICY IF EXISTS "Allow public inserts" ON ai_models_discovery;
DROP POLICY IF EXISTS "Allow public updates" ON ai_models_discovery;
DROP POLICY IF EXISTS "Allow public read access" ON ai_models_discovery;
DROP POLICY IF EXISTS "Public read access" ON ai_models_discovery;
DROP POLICY IF EXISTS "Public read only" ON ai_models_discovery;
DROP POLICY IF EXISTS "Service role full access discovery" ON ai_models_discovery;
DROP POLICY IF EXISTS "No public insert" ON ai_models_discovery;
DROP POLICY IF EXISTS "No public update" ON ai_models_discovery;
DROP POLICY IF EXISTS "No public delete" ON ai_models_discovery;

-- Drop all existing policies on ai_models_staging
DROP POLICY IF EXISTS "Service role full access staging" ON ai_models_staging;
DROP POLICY IF EXISTS "Deny public access on ai_models_staging" ON ai_models_staging;

-- =============================================================================
-- STEP 2: ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE ai_models_discovery ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_models_staging ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 3: CREATE SECURE POLICIES
-- =============================================================================

-- Policy 1: ai_models_discovery - Public can only SELECT (read)
CREATE POLICY "dashboard_public_read_only" 
ON ai_models_discovery 
FOR SELECT 
TO public 
USING (true);

-- Policy 2: ai_models_discovery - Service role has full access  
CREATE POLICY "api_gateway_full_access"
ON ai_models_discovery 
FOR ALL 
TO service_role 
USING (true)
WITH CHECK (true);

-- Policy 3: ai_models_staging - Service role only (completely private)
CREATE POLICY "staging_service_role_only"
ON ai_models_staging 
FOR ALL 
TO service_role 
USING (true)
WITH CHECK (true);

-- =============================================================================
-- STEP 4: CLEAN UP TEST DATA
-- =============================================================================

-- Remove any test records that may have been inserted during testing
DELETE FROM ai_models_discovery 
WHERE model_name IN ('test-rls', 'test-blocked', 'rls-test-final');

-- =============================================================================
-- STEP 5: VERIFICATION QUERIES
-- =============================================================================

-- Check that policies are correctly applied
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('ai_models_discovery', 'ai_models_staging')
ORDER BY tablename, policyname;

-- Verify table count (should show current data)
SELECT 'ai_models_discovery' as table_name, count(*) as record_count
FROM ai_models_discovery
UNION ALL
SELECT 'ai_models_staging' as table_name, count(*) as record_count  
FROM ai_models_staging;

-- =============================================================================
-- FINAL POLICY SUMMARY
-- =============================================================================

/*
FINAL SECURITY MODEL:

ai_models_discovery:
  ✅ PUBLIC (anon/authenticated): SELECT only (dashboard read access)
  ✅ SERVICE_ROLE: Full access (API Gateway operations)

ai_models_staging:  
  ❌ PUBLIC: No access (completely private)
  ✅ SERVICE_ROLE: Full access (API Gateway operations)

This ensures:
- Dashboard can read data with ANON keys (public GitHub repo safe)
- Only API Gateway can write data (authenticated endpoints)
- Staging table is completely private
- No conflicting policies
*/