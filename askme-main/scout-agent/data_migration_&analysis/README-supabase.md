# Supabase Integration for Scout Agent

This document explains how to sync validated model data from the GitHub workflow to Supabase.

## Overview

The `supabase-sync.js` script fetches the latest `validated_models.json` from the GitHub repository and uploads it to your Supabase database in a flattened format.

## Setup

### 1. Install Dependencies (if needed)
```bash
npm install axios @supabase/supabase-js @octokit/rest dotenv
```

### 2. Set Environment Variable
```bash
export SUPABASE_ANON_KEY="your_supabase_anon_key_here"
```

### 3. Create Supabase Table

Create a table called `validated_models` with the following structure:

```sql
CREATE TABLE validated_models (
    id SERIAL PRIMARY KEY,
    record_id VARCHAR UNIQUE NOT NULL,
    
    -- Metadata fields
    validation_timestamp TIMESTAMPTZ,
    validation_trigger VARCHAR,
    validation_reason TEXT,
    total_models_checked INTEGER,
    total_validated_models INTEGER,
    
    -- Model fields
    model_name VARCHAR NOT NULL,
    provider VARCHAR NOT NULL,
    api_available BOOLEAN,
    registration_required BOOLEAN,
    free_tier BOOLEAN,
    auth_method VARCHAR,
    documentation_url TEXT,
    backend_url TEXT,
    health_status VARCHAR,
    test_result TEXT,
    response_time VARCHAR,
    last_validated TIMESTAMPTZ,
    geographic_origin_verified BOOLEAN,
    allowed_region BOOLEAN,
    origin_reason TEXT,
    
    -- Capabilities (flattened)
    supports_chat BOOLEAN,
    supports_completion BOOLEAN,
    supports_vision BOOLEAN,
    supports_function_calling BOOLEAN,
    supports_streaming BOOLEAN,
    max_context_length VARCHAR,
    input_cost_per_token VARCHAR,
    output_cost_per_token VARCHAR,
    deprecated BOOLEAN,
    availability_status VARCHAR,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX idx_validated_models_provider ON validated_models(provider);
CREATE INDEX idx_validated_models_model_name ON validated_models(model_name);
CREATE INDEX idx_validated_models_validation_timestamp ON validated_models(validation_timestamp);
CREATE INDEX idx_validated_models_record_id ON validated_models(record_id);
```

## Usage

### Manual Sync
```bash
node supabase-sync.js
```

### Automated Sync (with cron)
```bash
# Add to crontab to run every hour
0 * * * * cd /path/to/scout-agent && SUPABASE_ANON_KEY="your_key" node supabase-sync.js >> sync.log 2>&1
```

## How It Works

1. **Fetch Latest Workflow**: Gets the most recent successful workflow run
2. **Download Data**: Fetches `validated_models.json` from the repository
3. **Flatten Structure**: Converts nested JSON to flat records suitable for SQL
4. **Upload to Supabase**: Inserts records using the REST API

## Data Structure

The script flattens the JSON structure:

**Original JSON:**
```json
{
  "metadata": { "timestamp": "...", "total_models_checked": 23 },
  "models": [
    {
      "model_name": "command",
      "provider": "cohere",
      "capabilities": { "supports_chat": true, "max_context_length": "4K" }
    }
  ]
}
```

**Flattened for Supabase:**
```json
{
  "record_id": "cohere_command_2025-07-23T11:56:13.030Z",
  "validation_timestamp": "2025-07-23T11:56:13.030Z",
  "total_models_checked": 23,
  "model_name": "command",
  "provider": "cohere",
  "supports_chat": true,
  "max_context_length": "4K"
}
```

## Configuration

Edit the `CONFIG` object in `supabase-sync.js` to customize:

```javascript
const CONFIG = {
  github: {
    owner: 'vn6295337',
    repo: 'askme',
    workflowFile: 'scout-agent.yml'
  },
  supabase: {
    url: 'https://pfmsevvxgvofqyrrtojk.supabase.co',
    table: 'validated_models'  // Change table name if needed
  }
};
```

## Error Handling

The script handles common errors:
- Missing environment variables
- GitHub API rate limits
- Supabase connection issues
- Invalid JSON data

## Security Notes

- Uses environment variables for sensitive data
- Only requires Supabase anon key (no service role key needed)
- Makes requests with proper User-Agent headers
- No GitHub token required (uses public API)

## Troubleshooting

### Common Issues:

1. **Missing SUPABASE_ANON_KEY**
   ```
   export SUPABASE_ANON_KEY="eyJ..."
   ```

2. **Table doesn't exist**
   - Create the table using the SQL above
   - Ensure table name matches CONFIG.supabase.table

3. **Rate limiting**
   - GitHub API allows 60 requests/hour for unauthenticated requests
   - Add GitHub token for higher limits if needed

4. **Network issues**
   - Check internet connectivity
   - Verify Supabase URL is correct