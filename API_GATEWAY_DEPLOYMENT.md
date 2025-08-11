# API Gateway Deployment Guide

## 🚀 Quick Deployment Steps

### 1. Render.com Setup
Upload these files to your Render backend:
- `api_gateway.py` (main Flask API)
- `requirements.txt` (Python dependencies)

### 2. Environment Variables in Render
Configure these in your Render service:
```
SUPABASE_AI_MODELS_DISCOVERY_URL=https://atilxlecbaqcksnrgzav.supabase.co
supabase_ai_models_discovery_service_key=[your_service_role_key]
AI_MODELS_DISCOVERY_API_SECRET_KEY=[your_api_secret]
```

### 3. Writer Agent Configuration
Set these environment variables where Writer Agent runs:
```
AI_MODELS_API_URL=https://your-render-service.onrender.com
AI_MODELS_DISCOVERY_API_SECRET_KEY=[same_as_render]
```

## 📋 API Endpoints

### Health Check
```
GET /health
```

### Replace All Models (Apollo Agent)
```
POST /api/models/replace
Authorization: Bearer [your_api_secret]
Content-Type: application/json

{
  "models": [
    {
      "model_name": "example-model",
      "provider": "huggingface", 
      "task_type": "text-generation",
      "api_url": "https://example.com"
    }
  ]
}
```

### Insert Staging URLs (Scout Agent)
```
POST /api/staging/insert
Authorization: Bearer [your_api_secret]
Content-Type: application/json

{
  "urls": [
    {
      "url": "https://example.com",
      "source": "web_search",
      "raw_metadata": {},
      "discovery_timestamp": "2025-01-01T00:00:00Z"
    }
  ]
}
```

## 🔒 Security Architecture

```
Writer Agent → API Gateway (Render) → Supabase Database
Dashboard → Direct Read (ANON) → Supabase Database
```

- **Writer Agent**: Uses `AI_MODELS_DISCOVERY_API_SECRET_KEY` 
- **API Gateway**: Uses `supabase_ai_models_discovery_service_key`
- **Dashboard**: Uses public ANON key (read-only)

## 🧪 Testing

Run the integration test:
```bash
python test_api_integration.py
```

## 📁 File Structure
```
project/
├── api_gateway.py              # Main Flask API
├── requirements.txt            # Dependencies
├── writer_agent_client.py      # API client
├── apollo_agent_integration.py # Apollo integration
├── scout_agent_integration.py  # Scout integration
└── test_api_integration.py     # Test script
```

## ⚡ Usage Examples

### Apollo Agent Integration
```python
from apollo_agent_integration import ApolloAgentIntegration

apollo = ApolloAgentIntegration()
result = apollo.process_and_store_models(your_models_data)
```

### Scout Agent Integration  
```python
from scout_agent_integration import ScoutAgentIntegration

scout = ScoutAgentIntegration()
result = scout.stage_discovered_urls(your_urls_data)
```

## 🔄 Next Steps
1. Deploy API Gateway to Render.com
2. Configure environment variables
3. Update your agents to use integration classes
4. Test with sample data
5. Set up Supabase RLS policies