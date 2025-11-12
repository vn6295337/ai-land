# ArtificialAnalysis API Integration Guide

## Overview

ArtificialAnalysis provides comprehensive AI model evaluation data through their REST API. The API key `ARTIFICIALANALYSIS_API_KEY` is registered in render.com backend and can be used to access their services programmatically.

## API Documentation Summary

**Base URL:** `https://artificialanalysis.ai/api/v2`  
**Authentication:** `x-api-key` header  
**Rate Limit:** 1,000 requests per day  
**Attribution Required:** https://artificialanalysis.ai/

## Available Services

### 1. LLM Models (`/data/llms/models`)

**Primary endpoint for our intelligent discovery system**

**Returns:**
- Model unique identifiers
- Model names and creators
- Comprehensive benchmark scores
- Pricing information per token
- Performance metrics (speed, quality)
- Context window sizes
- Capability assessments

**Sample Data Structure:**
```json
{
  "id": "gpt-4-turbo",
  "name": "GPT-4 Turbo",
  "creator": "OpenAI",
  "benchmarks": {
    "intelligence_index": 85.2,
    "speed_tokens_per_second": 42.3,
    "cost_per_million_tokens": 10.0
  },
  "capabilities": ["text", "reasoning", "coding"],
  "context_window": 128000
}
```

### 2. Media Model Endpoints (BETA)

#### Text-to-Image (`/data/media/text-to-image`)
- Image generation model comparisons
- Quality metrics
- Speed benchmarks
- Pricing data

#### Image Editing (`/data/media/image-editing`) 
- Image manipulation models
- Editing capability scores
- Performance metrics

#### Text-to-Speech (`/data/media/text-to-speech`)
- Voice synthesis models
- Audio quality ratings
- Speed and naturalness scores

#### Text-to-Video (`/data/media/text-to-video`)
- Video generation models
- Quality assessments
- Processing time metrics

#### Image-to-Video (`/data/media/image-to-video`)
- Video creation from images
- Animation quality scores
- Performance benchmarks

## Integration with Our System

### Module 6: Intelligent Ranking Enhancement

```javascript
// Integrate ArtificialAnalysis data
const aaRanking = {
  intelligenceIndex: model.aa_intelligence_index,
  speedScore: model.aa_speed_tokens_per_second,
  costEfficiency: 1000 / model.aa_cost_per_million_tokens,
  overallScore: calculateCompositeScore(model.aa_metrics)
};
```

### Module 7: Advanced Search Enhancement

```javascript
// Add AA-powered search filters
const aaFilters = {
  benchmarkScore: { min: 70, max: 100 },
  speedRange: { min: 10, max: 100 }, // tokens/second
  costRange: { max: 50 }, // per million tokens
  capabilities: ['reasoning', 'coding', 'multimodal']
};
```

### Module 8: RAG System Enhancement

```javascript
// Use AA data for recommendations
const aaRecommendations = {
  topPerformers: getTopModels(aaData, 'intelligence_index'),
  bestValue: getBestValueModels(aaData),
  fastestModels: getFastestModels(aaData),
  specialized: getSpecializedModels(aaData, userRequirements)
};
```

## Scripts Created

### 1. `artificialanalysis_api_client.py`
- Comprehensive Python client
- Proxy-based access testing
- Report generation
- Fallback to curl if requests unavailable

### 2. `test_artificialanalysis_direct.sh`
- Direct API testing with API key
- All endpoint validation
- Performance metrics collection
- Integration recommendations

### 3. `artificialanalysis_explorer.sh`
- General exploration script
- Proxy connection testing
- Endpoint discovery
- Service documentation

## Implementation Recommendations

### 1. Backend Proxy Enhancement

Create dedicated endpoint in render.com backend:

```javascript
// /api/artificialanalysis/models
app.get('/api/artificialanalysis/models', async (req, res) => {
  try {
    const response = await fetch('https://artificialanalysis.ai/api/v2/data/llms/models', {
      headers: {
        'x-api-key': process.env.ARTIFICIALANALYSIS_API_KEY,
        'User-Agent': 'AskMe-Discovery/1.0'
      }
    });
    
    const data = await response.json();
    
    // Cache response for 24 hours due to rate limits
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json(data);
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch AA data' });
  }
});
```

### 2. Data Synchronization

```javascript
// Sync script to populate our database
const syncAAData = async () => {
  const aaModels = await fetchAAModels();
  
  for (const model of aaModels) {
    await updateModel(model.id, {
      aa_intelligence_index: model.benchmarks.intelligence_index,
      aa_speed: model.benchmarks.speed_tokens_per_second,
      aa_cost: model.benchmarks.cost_per_million_tokens,
      aa_last_updated: new Date()
    });
  }
};

// Run daily to stay within rate limits
schedule.scheduleJob('0 3 * * *', syncAAData);
```

### 3. Compass Framework Integration

Map AA data to our Model Compass framework:

```javascript
const mapToCompass = (aaModel) => ({
  archetype: determineArchetype(aaModel),
  taskComplexity: aaModel.benchmarks.intelligence_index > 80 ? 'complex' : 'simple',
  outputStyle: aaModel.capabilities.includes('creative') ? 'creative' : 'analytical',
  specialCapabilities: mapCapabilities(aaModel.capabilities),
  performance: {
    speed: aaModel.benchmarks.speed_tokens_per_second,
    cost: aaModel.benchmarks.cost_per_million_tokens,
    quality: aaModel.benchmarks.intelligence_index
  }
});
```

### 4. Caching Strategy

Due to 1,000 requests/day limit:

```javascript
const cacheStrategy = {
  models: '24 hours',        // Core model data
  benchmarks: '12 hours',    // Performance metrics
  pricing: '6 hours',        // Cost data (changes more frequently)
  capabilities: '48 hours'   // Model capabilities
};
```

## Next Steps

1. **Implement `/api/artificialanalysis` endpoint** in render.com backend
2. **Set up daily sync process** to populate our model database
3. **Create caching layer** to respect rate limits
4. **Add attribution links** in UI (required by terms)
5. **Integrate with compass framework** for enhanced recommendations
6. **Monitor API usage** to stay within limits

## Benefits for Our System

- **Real-time benchmarks**: Always current performance data
- **Comprehensive coverage**: 100+ models across providers
- **Professional metrics**: Industry-standard evaluation scores
- **Cost optimization**: Up-to-date pricing for recommendations
- **Capability mapping**: Detailed feature assessments
- **Media model support**: Beyond just text (images, video, audio)

## Rate Limit Management

- **1,000 requests/day** = ~41 requests/hour
- **Cache responses** for 24 hours minimum
- **Batch requests** when possible
- **Monitor usage** with request counting
- **Fallback to cached data** when limit reached

This integration will significantly enhance our intelligent discovery system with professional-grade model evaluation data.