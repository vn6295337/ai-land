# ArtificialAnalysis API Integration

This document describes the ArtificialAnalysis API integration added to the AskMe backend proxy server.

## Overview

ArtificialAnalysis provides comprehensive AI model evaluation data through their REST API. This integration adds endpoints to access their model benchmarks, performance metrics, and media model data while respecting their rate limits and caching requirements.

## Configuration

### Environment Variables

Add the following to your `.env` file or render.com environment variables:

```bash
ARTIFICIALANALYSIS_API_KEY=your_api_key_here
```

### Rate Limits

- **Daily Limit**: 1,000 requests per day
- **Cache Duration**: 24 hours (to respect rate limits)
- **Attribution Required**: https://artificialanalysis.ai

## API Endpoints

### 1. LLM Models - `/api/artificialanalysis/models`

Retrieves comprehensive LLM model data with benchmarks.

**Method**: `GET`  
**Response Format**:
```json
{
  "models": [
    {
      "id": "model-identifier",
      "name": "Model Name",
      "creator": "Provider",
      "benchmarks": {
        "intelligence_index": 85.2,
        "speed_tokens_per_second": 42.3,
        "cost_per_million_tokens": 10.0
      },
      "capabilities": ["text", "reasoning", "coding"],
      "context_window": 128000
    }
  ],
  "metadata": {
    "totalModels": 150,
    "lastUpdated": "2025-07-30T12:00:00Z",
    "rateLimitRemaining": 950,
    "requestsUsed": 50,
    "requestsLimit": 1000
  },
  "cached": false,
  "attribution": "https://artificialanalysis.ai"
}
```

### 2. Media Models - `/api/artificialanalysis/media/:type`

Retrieves media model data for specific types.

**Method**: `GET`  
**Parameters**:
- `type`: One of `text-to-image`, `image-editing`, `text-to-speech`, `text-to-video`, `image-to-video`

**Example**: `/api/artificialanalysis/media/text-to-image`

**Response Format**:
```json
{
  "models": [
    {
      "id": "image-model-id",
      "name": "Image Model",
      "creator": "Provider",
      "performance_metrics": {...}
    }
  ],
  "mediaType": "text-to-image",
  "metadata": {
    "totalModels": 25,
    "lastUpdated": "2025-07-30T12:00:00Z"
  },
  "cached": true,
  "cacheAge": 3600,
  "attribution": "https://artificialanalysis.ai"
}
```

### 3. Status - `/api/artificialanalysis/status`

Shows API status, rate limits, and cache information.

**Method**: `GET`  
**Response Format**:
```json
{
  "status": "active",
  "timestamp": "2025-07-30T12:00:00Z",
  "rateLimit": {
    "requestsUsed": 50,
    "requestsLimit": 1000,
    "remaining": 950,
    "resetTime": "2025-07-31T00:00:00Z",
    "hoursUntilReset": 12
  },
  "cache": {
    "models": {
      "hasData": true,
      "age": 3600
    },
    "media": {
      "cachedTypes": ["text-to-image", "text-to-speech"],
      "age": 1800
    }
  },
  "endpoints": [
    "/api/artificialanalysis/models",
    "/api/artificialanalysis/media/text-to-image",
    "..."
  ],
  "attribution": "https://artificialanalysis.ai"
}
```

## Features

### Intelligent Caching
- **24-hour cache** to respect daily rate limits
- **Separate caching** for models and media types
- **Cache fallback** during API errors
- **Cache age reporting** for monitoring

### Rate Limit Management
- **Request counting** with daily reset
- **Proactive blocking** when limit approached
- **Rate limit status** in all responses
- **Hours until reset** calculation

### Error Handling
- **Graceful degradation** with cached data
- **Detailed error messages** for debugging
- **HTTP status code mapping** for different errors
- **Network timeout handling** (30 seconds)

### Security
- **API key protection** via environment variables
- **Request validation** and sanitization
- **Attribution enforcement** in all responses
- **Timeout protection** against hanging requests

## Testing

### Test Script
Run the endpoint test script:
```bash
./scripts/test_aa_endpoints.sh [backend-url]
```

### Manual Testing
```bash
# Test status endpoint
curl https://askme-backend-proxy.onrender.com/api/artificialanalysis/status

# Test models endpoint  
curl https://askme-backend-proxy.onrender.com/api/artificialanalysis/models

# Test media endpoint
curl https://askme-backend-proxy.onrender.com/api/artificialanalysis/media/text-to-image
```

## Integration with Intelligent Discovery

### Module 6: Intelligent Ranking
```javascript
// Use AA benchmarks for scoring
const aaScore = {
  intelligence: model.aa_intelligence_index || 0,
  speed: model.aa_speed_tokens_per_second || 0,
  cost: model.aa_cost_per_million_tokens || 0
};
```

### Module 7: Advanced Search
```javascript
// Filter by AA performance metrics 
const filters = {
  minIntelligence: 70,
  maxCost: 50,
  minSpeed: 10
};
```

### Module 8: RAG System
```javascript
// Recommendations based on AA data
const recommendations = getAARecommendations(userQuery, aaModels);
```

## Monitoring

### Health Checks
- Check `/api/artificialanalysis/status` for service health
- Monitor `requestsUsed` vs `requestsLimit` 
- Track cache hit rates and ages
- Watch for API errors and timeouts

### Logs
- Request/response logging with sanitized API keys
- Rate limit usage tracking
- Cache hit/miss statistics
- Error rate monitoring

### Alerts
Set up alerts for:
- Rate limit usage > 90%
- API errors > 5%
- Cache misses > 80%
- Response time > 10 seconds

## Error Scenarios

### 401 Unauthorized
- Check `ARTIFICIALANALYSIS_API_KEY` is set correctly
- Verify API key is valid and active
- Ensure key has proper permissions

### 429 Rate Limited
- Check current usage at `/status` endpoint
- Wait for daily reset
- Consider caching optimization

### 500 Server Error
- Check ArtificialAnalysis service status
- Review server logs for details
- Verify network connectivity

### Network Timeouts
- Check internet connectivity
- Review firewall/proxy settings
- Consider retry logic implementation

## Deployment

### Environment Setup
1. Set `ARTIFICIALANALYSIS_API_KEY` in render.com environment
2. Restart backend service
3. Verify endpoints with test script
4. Monitor initial usage and caching

### Production Considerations
- Monitor daily rate limit usage
- Set up cache warming for critical data
- Implement backup data sources if needed
- Configure monitoring and alerting

## Support

### Documentation
- ArtificialAnalysis API docs: https://artificialanalysis.ai/documentation
- Rate limit info: 1,000 requests per day
- Attribution requirement: https://artificialanalysis.ai

### Troubleshooting
1. Check environment variables
2. Test API key directly with curl
3. Review server logs for errors
4. Monitor rate limit usage
5. Verify cache behavior

## Future Enhancements

### Planned Features
- **Model comparison API** for side-by-side analysis
- **Historical performance tracking** 
- **Custom benchmark integration**
- **Automated model recommendations**

### Optimization Opportunities
- **Selective data fetching** to reduce API calls
- **Background cache refresh** before expiration
- **Intelligent request batching**
- **Performance metric prioritization**