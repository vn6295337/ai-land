-- Database Analysis and Normalization Script
-- This script analyzes the flattened validated_models table and creates a clean, normalized schema

-- Step 1: Analyze current data structure
SELECT 'Current Data Analysis' as step;

-- Check data quality and unique values
SELECT 
    'Total Records' as metric,
    COUNT(*) as value
FROM validated_models

UNION ALL

SELECT 
    'Unique Providers' as metric,
    COUNT(DISTINCT provider) as value
FROM validated_models

UNION ALL

SELECT 
    'Unique Validation Runs' as metric,
    COUNT(DISTINCT validation_timestamp) as value
FROM validated_models

UNION ALL

SELECT 
    'Health Status Values' as metric,
    COUNT(DISTINCT health_status) as value
FROM validated_models;

-- Analyze providers and their models
SELECT 
    provider,
    COUNT(*) as model_count,
    COUNT(CASE WHEN supports_vision = true THEN 1 END) as vision_models,
    COUNT(CASE WHEN supports_function_calling = true THEN 1 END) as function_calling_models,
    STRING_AGG(DISTINCT max_context_length, ', ' ORDER BY max_context_length) as context_lengths
FROM validated_models
GROUP BY provider
ORDER BY provider;

-- Check for data inconsistencies
SELECT 'Data Quality Issues' as analysis;

-- Find models with unusual context lengths
SELECT 
    'Unusual Context Lengths' as issue,
    max_context_length,
    COUNT(*) as count
FROM validated_models
WHERE max_context_length NOT IN ('4K', '8K', '32K', '64K', '128K', '200K', '1M')
GROUP BY max_context_length;

-- Find models with missing or unusual data
SELECT 
    'Models with NULL/Empty Fields' as issue,
    COUNT(*) as count
FROM validated_models
WHERE model_name IS NULL 
   OR provider IS NULL 
   OR health_status IS NULL;

-- Check timestamp consistency
SELECT 
    'Validation Timestamp Analysis' as analysis,
    MIN(validation_timestamp) as earliest_validation,
    MAX(validation_timestamp) as latest_validation,
    COUNT(DISTINCT validation_timestamp) as unique_timestamps
FROM validated_models;