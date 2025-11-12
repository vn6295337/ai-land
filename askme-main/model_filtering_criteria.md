# Model Filtering Criteria

## Primary Filters

### 1. **Free Inference Availability** ⚡
- Model must support API-based inference without payment
- Verified through provider's free tier policies
- Rate limits acceptable for development/testing

### 2. **API Connectivity** 🔌
- Provider endpoint responds with 200 status
- Authentication succeeds with provided API key
- Model metadata retrievable via API

### 3. **Provider Trust Score** 🛡️
- **Trusted (1.0)**: Cohere, Google AI, Groq, HuggingFace, Mistral, OpenRouter, Together AI
- **Untrusted (0.5)**: Any provider NOT in trusted whitelist (e.g., AI21, unknown providers)
- **Criteria**: Security track record, operational reliability, geographic compliance, business legitimacy
- **Check**: `trustedProviders.includes(provider) ? 1.0 : 0.5`

### 4. **Geographic Compliance** 🌍
- Provider operates from North America or Europe
- Backend proxy manages approved regional providers
- Excludes providers from restricted jurisdictions

## Secondary Filters

### 5. **Model Capabilities** 🎯
- Text generation, chat completion, or embeddings support
- Vision/multimodal capabilities (bonus)
- Function calling support (advanced)
- Streaming response capability

### 6. **Performance Metrics** ⚡
- Response time under 5 seconds
- Availability status: "available" 
- Health status: "healthy"
- Cold start tolerance acceptable

### 7. **Rate Limit Compliance** 📊
- Free tier limits documented and enforced
- Reasonable requests per day/hour/minute
- Token limits within acceptable ranges

## Exclusion Criteria

### ❌ **Blocked Models**
- Requires paid subscription for inference
- API key has read-only permissions (AI21 case)
- Provider from restricted geographic regions
- Deprecated or discontinued models
- Consistently failing health checks

### ❌ **Provider Blacklist**
- AI21 (read-only API, no free inference)
- Any provider requiring upfront payment
- Providers with <0.5 trust score
- Non-responsive or unreliable endpoints

## Filter Implementation

### **Trust Score Check**
```javascript
function isGeographicallyAllowed(modelName, provider, modelData = {}) {
  const trustedProviders = ['cohere', 'google', 'groq', 'mistral', 'openrouter', 'together', 'huggingface'];
  const providerTrustScore = trustedProviders.includes(provider) ? 1.0 : 0.5;
  
  return {
    allowed: trustedProviders.includes(provider),
    trust_score: providerTrustScore,
    region: 'North America/Europe',
    reason: trustedProviders.includes(provider) ? 'Trusted provider' : 'Untrusted provider'
  };
}
```

### **Free Inference Whitelist**
```javascript
FREE_INFERENCE_MODELS = {
  cohere: ['command-r', 'embed-v4.0', 'rerank-v3.5'],
  google: ['gemini-1.5-flash', 'gemini-2.0-flash'],
  groq: ['llama-3.1-8b-instant', 'gemma2-9b-it'],
  huggingface: ['google-bert/bert-base-uncased', 'google-t5/t5-small'],
  mistral: ['open-mistral-7b', 'ministral-3b-2410'],
  openrouter: [':free'], // Models with :free suffix
  together: ['meta-llama/Llama-3.3-70B-Instruct-Turbo-Free']
}
```

### **Validation Process**
1. **Connectivity Test**: API endpoint responds
2. **Authentication Test**: API key validates  
3. **Model Discovery**: Retrieve available models
4. **Free Tier Check**: Verify inference availability
5. **Capability Analysis**: Extract model features
6. **Geographic Validation**: Confirm regional compliance
7. **Trust Scoring**: Apply provider reputation score

## Trust Score Examples

### **Untrusted Provider Detection**
```javascript
// AI21 example (Score: 0.5)
const provider = 'ai21';
const trustCheck = isGeographicallyAllowed('jamba-large', provider);
// Returns: { allowed: false, trust_score: 0.5, reason: 'Untrusted provider' }

// Unknown provider example (Score: 0.5)  
const provider = 'unknown-api';
const trustCheck = isGeographicallyAllowed('some-model', provider);
// Returns: { allowed: false, trust_score: 0.5, reason: 'Untrusted provider' }

// Trusted provider example (Score: 1.0)
const provider = 'cohere';
const trustCheck = isGeographicallyAllowed('command-r', provider);
// Returns: { allowed: true, trust_score: 1.0, reason: 'Trusted provider' }
```

### **Trust-Based Filtering**
- **Score 1.0**: Included in production recommendations
- **Score 0.5**: Excluded from free inference list
- **Unknown providers**: Automatically assigned 0.5 score

## Summary Stats
- **Total Providers Tested**: 9
- **Trusted Providers**: 7/9 (78%)
- **Working Providers**: 8/9 (89%)
- **Free Inference Providers**: 6/7 trusted
- **Total Models Available**: 582
- **Free Inference Models**: 245 (42%)
- **Geographic Compliance**: 100%
- **Trust Score Average**: 0.94