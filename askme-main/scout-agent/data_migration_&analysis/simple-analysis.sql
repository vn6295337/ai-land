-- Simple Data Analysis - Run each query separately

-- Query 1: Basic counts
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT provider) as unique_providers,
    COUNT(DISTINCT validation_timestamp) as unique_validation_runs,
    COUNT(DISTINCT health_status) as health_status_values
FROM validated_models;

-- Query 2: Provider breakdown
SELECT 
    provider,
    COUNT(*) as model_count,
    COUNT(CASE WHEN supports_vision = true THEN 1 END) as vision_models,
    COUNT(CASE WHEN supports_function_calling = true THEN 1 END) as function_calling_models
FROM validated_models
GROUP BY provider
ORDER BY provider;

-- Query 3: Context lengths
SELECT 
    max_context_length,
    COUNT(*) as model_count
FROM validated_models
GROUP BY max_context_length
ORDER BY max_context_length;

-- Query 4: Health status check
SELECT 
    health_status,
    COUNT(*) as count
FROM validated_models
GROUP BY health_status;

-- Query 5: Sample of data to verify table exists
SELECT 
    provider,
    model_name,
    health_status,
    validation_timestamp
FROM validated_models
LIMIT 5;