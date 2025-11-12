# API Key Rotation Setup Guide

## Overview
This guide explains how to configure API key rotation for the intelligent discovery system on render.com.

## 🔧 Render.com Environment Variables Setup

### Single Key Per Provider
```bash
AI21_API_KEY=your_ai21_key_here
COHERE_API_KEY=your_cohere_key_here
GEMINI_API_KEY=your_gemini_key_here
GROQ_API_KEY=your_groq_key_here
MISTRAL_API_KEY=your_mistral_key_here
OPENROUTER_API_KEY=your_openrouter_key_here
TOGETHER_API_KEY=your_together_key_here
```

### Multiple Keys Per Provider (Comma-Separated)
```bash
AI21_API_KEY=key1,key2,key3
COHERE_API_KEY=key1,key2
GEMINI_API_KEY=key1,key2,key3,key4
GROQ_API_KEY=key1,key2
MISTRAL_API_KEY=key1,key2,key3
OPENROUTER_API_KEY=key1,key2,key3
TOGETHER_API_KEY=key1,key2
```

### Multiple Keys Per Provider (Numbered Variables)
```bash
AI21_API_KEY_1=first_key
AI21_API_KEY_2=second_key
AI21_API_KEY_3=third_key

GEMINI_API_KEY_1=first_gemini_key
GEMINI_API_KEY_2=second_gemini_key
GEMINI_API_KEY_3=third_gemini_key
```

## ⚙️ Rotation Configuration

### Environment Variables for Rotation Settings
```bash
# Global rotation settings
MAX_USAGE_PER_KEY=50
ROTATION_INTERVAL_MS=300000
MAX_ERRORS_PER_KEY=3
ENABLE_AUTO_ROTATION=true

# Provider-specific settings (optional)
GOOGLE_MAX_USAGE=60
GROQ_MAX_USAGE=25
MISTRAL_MAX_USAGE=35
```

## 🚀 Usage Examples

### Basic Usage
```javascript
import LiveEndpointChecker from './live_endpoint_checker.js';

const checker = new LiveEndpointChecker();
await checker.run();
```

### Manual Key Rotation
```javascript
// Rotate to next key
checker.keyManager.rotateKey('google', 'manual');

// Rotate to specific key index
checker.keyManager.rotateToIndex('groq', 2);

// Get current key
const currentKey = checker.keyManager.getCurrentKey('mistral');
```

### Monitoring
```javascript
import RotationMonitor from './rotation_monitor.js';

const monitor = new RotationMonitor(checker.keyManager);

// Print health dashboard
monitor.printHealthDashboard();

// Export statistics
await monitor.exportStats();
```

## 🎯 Key Rotation Strategies

### 1. Usage-Based Rotation
- Keys rotate after reaching usage limit
- Default: 50 requests per key
- Configurable per provider

### 2. Time-Based Rotation
- Keys rotate after time interval
- Default: 5 minutes
- Prevents key staleness

### 3. Error-Based Rotation
- Keys rotate after error threshold
- Default: 3 errors per key
- Handles rate limits and auth issues

### 4. Manual Rotation
- Force rotation on demand
- Useful for maintenance
- Can target specific providers

## 📊 Monitoring Features

### Health Dashboard
```
🎯 API Key Rotation Health Dashboard
=====================================
✅ GOOGLE:
   Health: 100% (3/3 keys)
   Current: Key 1, Avg Usage: 23

🟡 GROQ:
   Health: 67% (2/3 keys)
   Current: Key 0, Avg Usage: 45

🚨 Recent Alerts: 2
=====================================
```

### Alert Types
- **key_health_low**: Too many keys with errors
- **rotation_stuck**: No rotation for extended period
- **rate_limit_exceeded**: Provider rate limits hit

### Statistics Export
- Usage patterns per key
- Rotation frequency
- Error rates
- Performance metrics

## 🔒 Security Best Practices

### Key Management
1. **Use separate keys for different environments**
2. **Rotate keys regularly (monthly)**
3. **Monitor for unusual usage patterns**
4. **Set up alerts for key exhaustion**

### Environment Variables
```bash
# Production
GEMINI_API_KEY_1=prod_key_1
GEMINI_API_KEY_2=prod_key_2

# Staging
GEMINI_API_KEY_1=staging_key_1
GEMINI_API_KEY_2=staging_key_2
```

## 🚨 Troubleshooting

### Common Issues

#### All Keys Exhausted
```javascript
// Check key health
const health = monitor.getProviderHealth('google');
if (health.status === 'critical') {
  console.log('Need fresh API keys for Google');
}
```

#### Rotation Not Working
```javascript
// Force manual rotation
checker.keyManager.rotateKey('groq', 'manual_fix');

// Reset error counts
checker.keyManager.resetErrors('groq');
```

#### High Error Rates
```javascript
// Check rotation stats
const stats = checker.keyManager.getRotationStats('mistral');
console.log('Error count:', stats.errorCount);
```

## 📈 Performance Optimization

### Provider-Specific Settings
```json
{
  "ai21": {
    "max_usage_per_key": 30,
    "rotation_interval_ms": 600000,
    "rate_limit_per_minute": 10
  },
  "groq": {
    "max_usage_per_key": 25,
    "rotation_interval_ms": 120000,
    "rate_limit_per_minute": 30
  }
}
```

### Monitoring Intervals
- **Stats Collection**: Every 5 minutes
- **Health Checks**: Every 5 minutes  
- **Data Cleanup**: Every 20 minutes
- **Statistics Retention**: 24 hours

## 🔧 Advanced Configuration

### Custom Rotation Logic
```javascript
// Override rotation decision
class CustomRotationManager extends APIKeyRotationManager {
  shouldRotate(provider, reason) {
    // Custom logic here
    return super.shouldRotate(provider, reason);
  }
}
```

### Integration with External Monitoring
```javascript
// Export to external systems
setInterval(async () => {
  const stats = monitor.getSystemSummary();
  await sendToExternalMonitoring(stats);
}, 300000);
```

## 📋 Deployment Checklist

- [ ] Configure API keys in render.com environment
- [ ] Set rotation parameters
- [ ] Enable monitoring
- [ ] Test key rotation functionality
- [ ] Set up alerts
- [ ] Document key sources and limits
- [ ] Plan key refresh schedule

## Support

For issues with API key rotation:
1. Check the health dashboard
2. Review rotation logs
3. Verify environment variables
4. Test manual rotation
5. Contact API providers for key issues