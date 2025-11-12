-- Data Migration Script
-- Migrate from flattened validated_models table to normalized schema

-- Step 1: Populate providers table
INSERT INTO providers (name, display_name, documentation_base_url)
SELECT DISTINCT 
    provider,
    CASE provider
        WHEN 'google' THEN 'Google AI'
        WHEN 'openrouter' THEN 'OpenRouter'
        WHEN 'mistral' THEN 'Mistral AI'
        WHEN 'cohere' THEN 'Cohere'
        WHEN 'groq' THEN 'Groq'
        ELSE INITCAP(provider)
    END as display_name,
    CASE provider
        WHEN 'google' THEN 'https://ai.google.dev/docs'
        WHEN 'openrouter' THEN 'https://openrouter.ai/docs'
        WHEN 'mistral' THEN 'https://docs.mistral.ai'
        WHEN 'cohere' THEN 'https://docs.cohere.com'
        WHEN 'groq' THEN 'https://console.groq.com/docs'
        ELSE NULL
    END as documentation_base_url
FROM validated_models
ON CONFLICT (name) DO NOTHING;

-- Step 2: Create validation run record
INSERT INTO validation_runs (
    run_timestamp, 
    trigger_type, 
    trigger_reason,
    total_models_checked,
    total_models_validated,
    total_models_excluded
)
SELECT DISTINCT
    validation_timestamp,
    validation_trigger,
    validation_reason,
    total_models_checked,
    total_validated_models,
    (total_models_checked - total_validated_models) as total_models_excluded
FROM validated_models
ON CONFLICT DO NOTHING;

-- Step 3: Populate models table
INSERT INTO models (provider_id, name, display_name, model_family, model_size)
SELECT DISTINCT
    p.id as provider_id,
    vm.model_name,
    -- Generate display name
    CASE 
        WHEN vm.model_name LIKE '%-%' THEN REPLACE(INITCAP(vm.model_name), '-', ' ')
        WHEN vm.model_name LIKE '%_%' THEN REPLACE(INITCAP(vm.model_name), '_', ' ')
        ELSE INITCAP(vm.model_name)
    END as display_name,
    -- Extract model family
    CASE 
        WHEN vm.model_name LIKE 'gpt%' THEN 'gpt'
        WHEN vm.model_name LIKE 'claude%' THEN 'claude'
        WHEN vm.model_name LIKE 'llama%' THEN 'llama'
        WHEN vm.model_name LIKE 'gemini%' THEN 'gemini'
        WHEN vm.model_name LIKE 'gemma%' THEN 'gemma'
        WHEN vm.model_name LIKE 'mistral%' THEN 'mistral'
        WHEN vm.model_name LIKE 'mixtral%' THEN 'mixtral'
        WHEN vm.model_name LIKE 'command%' THEN 'command'
        WHEN vm.model_name LIKE 'wizardlm%' THEN 'wizardlm'
        ELSE 'other'
    END as model_family,
    -- Extract model size
    CASE 
        WHEN vm.model_name ~ '\d+b' THEN 
            REGEXP_REPLACE(vm.model_name, '.*?(\d+b).*', '\1', 'i')
        WHEN vm.model_name ~ '\d+x\d+b' THEN 
            REGEXP_REPLACE(vm.model_name, '.*?(\d+x\d+b).*', '\1', 'i')
        WHEN vm.model_name LIKE '%8b%' THEN '8b'
        WHEN vm.model_name LIKE '%70b%' THEN '70b'
        WHEN vm.model_name LIKE '%7b%' THEN '7b'
        WHEN vm.model_name LIKE '%13b%' THEN '13b'
        WHEN vm.model_name LIKE '%34b%' THEN '34b'
        ELSE NULL
    END as model_size
FROM validated_models vm
JOIN providers p ON p.name = vm.provider
ON CONFLICT (provider_id, name) DO NOTHING;

-- Step 4: Populate model_capabilities table
INSERT INTO model_capabilities (
    model_id,
    supports_chat,
    supports_completion,
    supports_vision,
    supports_function_calling,
    supports_streaming,
    max_context_tokens,
    max_context_display,
    is_deprecated
)
SELECT DISTINCT
    m.id as model_id,
    vm.supports_chat,
    vm.supports_completion,
    vm.supports_vision,
    vm.supports_function_calling,
    vm.supports_streaming,
    -- Convert context length to tokens (approximate)
    CASE vm.max_context_length
        WHEN '4K' THEN 4000
        WHEN '8K' THEN 8000
        WHEN '32K' THEN 32000
        WHEN '64K' THEN 64000
        WHEN '128K' THEN 128000
        WHEN '200K' THEN 200000
        WHEN '1M' THEN 1000000
        ELSE NULL
    END as max_context_tokens,
    vm.max_context_length as max_context_display,
    vm.deprecated
FROM validated_models vm
JOIN providers p ON p.name = vm.provider
JOIN models m ON m.provider_id = p.id AND m.name = vm.model_name
ON CONFLICT (model_id) DO NOTHING;

-- Step 5: Populate model_validations table
INSERT INTO model_validations (
    validation_run_id,
    model_id,
    is_api_available,
    requires_registration,
    has_free_tier,
    auth_method,
    backend_url,
    health_status,
    test_result,
    geographic_origin_verified,
    is_allowed_region,
    geographic_restriction_reason,
    availability_status,
    validated_at
)
SELECT 
    vr.id as validation_run_id,
    m.id as model_id,
    vm.api_available,
    vm.registration_required,
    vm.free_tier,
    vm.auth_method,
    vm.backend_url,
    vm.health_status,
    vm.test_result,
    vm.geographic_origin_verified,
    vm.allowed_region,
    vm.origin_reason,
    vm.availability_status,
    vm.last_validated
FROM validated_models vm
JOIN providers p ON p.name = vm.provider
JOIN models m ON m.provider_id = p.id AND m.name = vm.model_name
JOIN validation_runs vr ON vr.run_timestamp = vm.validation_timestamp
ON CONFLICT (validation_run_id, model_id) DO NOTHING;

-- Step 6: Populate provider_endpoints table with inferred data
INSERT INTO provider_endpoints (
    provider_id,
    endpoint_type,
    base_url,
    documentation_url,
    requires_api_key
)
SELECT DISTINCT
    p.id as provider_id,
    'chat' as endpoint_type,
    vm.backend_url,
    vm.documentation_url,
    CASE vm.auth_method
        WHEN 'backend_proxy' THEN false
        ELSE true
    END as requires_api_key
FROM validated_models vm
JOIN providers p ON p.name = vm.provider
WHERE vm.backend_url IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 7: Data quality verification queries
-- These help identify any issues with the migration

-- Check record counts match
SELECT 'Migration Verification' as check_type;

SELECT 
    'Original Records' as source,
    COUNT(*) as count
FROM validated_models

UNION ALL

SELECT 
    'Migrated Models' as source,
    COUNT(*) as count
FROM models

UNION ALL

SELECT 
    'Model Validations' as source,
    COUNT(*) as count
FROM model_validations;

-- Check for missing relationships
SELECT 
    'Models without capabilities' as issue,
    COUNT(*) as count
FROM models m
LEFT JOIN model_capabilities mc ON mc.model_id = m.id
WHERE mc.id IS NULL

UNION ALL

SELECT 
    'Models without validations' as issue,
    COUNT(*) as count
FROM models m
LEFT JOIN model_validations mv ON mv.model_id = m.id
WHERE mv.id IS NULL;

-- Show provider distribution
SELECT 
    p.display_name,
    COUNT(m.id) as model_count,
    COUNT(mv.id) as validation_count
FROM providers p
LEFT JOIN models m ON m.provider_id = p.id
LEFT JOIN model_validations mv ON mv.model_id = m.id
GROUP BY p.id, p.display_name
ORDER BY p.display_name;