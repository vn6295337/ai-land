-- Fix RLS Policies - Run in Supabase SQL Editor

-- First, drop the existing problematic policies
DROP POLICY IF EXISTS "No public insert" ON ai_models_discovery;
DROP POLICY IF EXISTS "No public update" ON ai_models_discovery; 
DROP POLICY IF EXISTS "No public delete" ON ai_models_discovery;

-- Create a single restrictive policy for public users (ANON role)
-- This allows ONLY SELECT, blocks all INSERT/UPDATE/DELETE
CREATE POLICY "Public read only" ON ai_models_discovery
    FOR ALL
    TO anon
    USING (
        CASE 
            WHEN current_setting('request.method', true) = 'GET' THEN true
            ELSE false
        END
    )
    WITH CHECK (false);

-- Alternative approach: Explicit policies for each operation
-- Comment out the above and use these if the first approach doesn't work

/*
CREATE POLICY "Allow public select only" ON ai_models_discovery
    FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Block public insert" ON ai_models_discovery
    FOR INSERT
    TO anon
    WITH CHECK (false);

CREATE POLICY "Block public update" ON ai_models_discovery
    FOR UPDATE
    TO anon
    USING (false)
    WITH CHECK (false);

CREATE POLICY "Block public delete" ON ai_models_discovery
    FOR DELETE
    TO anon
    USING (false);
*/

-- Clean up the test record
DELETE FROM ai_models_discovery WHERE model_name = 'test-rls';

-- Verify policies
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
WHERE tablename = 'ai_models_discovery'
ORDER BY policyname;