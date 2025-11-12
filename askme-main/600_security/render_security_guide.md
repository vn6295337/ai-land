# Render.com Security Configuration Guide

**Platform:** Render.com Hosting  
**Service URL:** https://askme-backend-proxy.onrender.com  
**Focus:** Securing API Keys & Environment Variables on Render  

---

## Current Security Status on Render

### ✅ What Render Does Well (Built-in Security)
- **Encrypted Environment Variables** - Stored encrypted at rest
- **HTTPS by Default** - All traffic encrypted in transit  
- **Container Isolation** - Each service runs in isolated containers
- **Automatic Updates** - Platform security patches applied automatically
- **Access Controls** - Dashboard access via authentication

### ⚠️ Remaining Risks (Platform Limitations)
- **Environment variables still accessible to application code**
- **Logs may contain sensitive data**
- **No secrets rotation automation**
- **Limited access controls within team**

---

## Render-Specific Security Hardening

### 1. Environment Variable Security (Immediate)

#### Current Render Setup
Your environment variables in Render dashboard:
```
GOOGLE_API_KEY=sk-abc123...
MISTRAL_API_KEY=sk-def456...
GROQ_API_KEY=gsk-xyz789...
```

#### Enhanced Security Pattern
Update your `server.js` to use a secure key retrieval pattern:

```javascript
// Add to top of server.js
const crypto = require('crypto');

class SecureKeyManager {
    constructor() {
        this.keys = new Map();
        this.initializeKeys();
    }
    
    initializeKeys() {
        // Load and hash keys on startup
        const providers = ['google', 'mistral', 'llama', 'cohere', 'groq', 'huggingface', 'openrouter', 'ai21', 'replicate'];
        
        providers.forEach(provider => {
            const envKey = `${provider.toUpperCase()}_API_KEY`;
            const key = process.env[envKey];
            
            if (key) {
                // Store hashed reference
                const keyHash = crypto.createHash('sha256').update(key).digest('hex').substring(0, 8);
                this.keys.set(provider, {
                    key: key,
                    hash: keyHash,
                    lastUsed: null,
                    useCount: 0
                });
                
                // Clear from process.env for security
                delete process.env[envKey];
                console.log(`🔑 Loaded ${provider} key (${keyHash}...)`);
            } else {
                console.warn(`⚠️  Missing API key for ${provider}`);
            }
        });
    }
    
    getKey(provider) {
        const keyData = this.keys.get(provider);
        if (!keyData) {
            throw new Error(`API key not found for provider: ${provider}`);
        }
        
        // Update usage tracking
        keyData.lastUsed = new Date();
        keyData.useCount++;
        
        return keyData.key;
    }
    
    getKeyStats() {
        const stats = {};
        this.keys.forEach((data, provider) => {
            stats[provider] = {
                hash: data.hash,
                lastUsed: data.lastUsed,
                useCount: data.useCount,
                status: 'active'
            };
        });
        return stats;
    }
    
    rotateKey(provider, newKey) {
        if (this.keys.has(provider)) {
            const keyHash = crypto.createHash('sha256').update(newKey).digest('hex').substring(0, 8);
            this.keys.set(provider, {
                key: newKey,
                hash: keyHash,
                lastUsed: null,
                useCount: 0
            });
            console.log(`🔄 Rotated ${provider} key (${keyHash}...)`);
        }
    }
}

// Initialize secure key manager
const keyManager = new SecureKeyManager();

// Replace existing API_KEYS object with secure access
const getAPIKey = (provider) => {
    try {
        return keyManager.getKey(provider);
    } catch (error) {
        console.error(`Key retrieval error for ${provider}:`, error.message);
        throw error;
    }
};
```

### 2. Render Dashboard Security Settings

#### Access Control
1. **Team Management** (if using team plan):
   ```
   Dashboard → Team → Members
   - Limit access to environment variables
   - Use role-based permissions
   - Remove unused team members
   ```

2. **Environment Variable Organization**:
   ```
   Recommended naming pattern:
   ASKME_GOOGLE_API_KEY=sk-...
   ASKME_MISTRAL_API_KEY=sk-...
   ASKME_GITHUB_TOKEN=ghp_...
   ASKME_AGENT_AUTH_TOKEN=secure-random-token
   ```

#### Logging Security
Update your logging to prevent key exposure:

```javascript
// Secure logging function
const secureLog = (message, data = {}) => {
    // Filter sensitive data
    const sanitized = JSON.stringify(data, (key, value) => {
        if (key.toLowerCase().includes('key') || 
            key.toLowerCase().includes('token') || 
            key.toLowerCase().includes('secret')) {
            return '[REDACTED]';
        }
        return value;
    });
    
    console.log(`${new Date().toISOString()} - ${message}`, sanitized);
};

// Replace console.log in API calls
// OLD: console.log(`📡 ${provider} request: ${model || 'default'} model`);
// NEW: secureLog(`📡 API Request`, { provider, model: model || 'default', timestamp: new Date() });
```

### 3. Render-Specific WAF Implementation

Since you can't install NGINX on Render, use Cloudflare as your WAF:

#### Step 1: Custom Domain Setup
1. **Get a domain** (free options):
   - Freenom (.tk, .ml, .ga domains)
   - GitHub Student Pack (free .me domain)
   - Use existing domain if available

2. **Connect to Render**:
   ```
   Render Dashboard → Service → Settings → Custom Domains
   Add: yourdomain.com
   ```

3. **Setup Cloudflare**:
   ```
   Cloudflare Dashboard → DNS
   CNAME: yourdomain.com → askme-backend-proxy.onrender.com
   Proxy Status: Proxied (orange cloud)
   ```

#### Step 2: Cloudflare WAF Rules (Free Tier)
```javascript
// Rule 1: Block script injection
Field: HTTP Request Body
Operator: contains  
Value: <script>
Action: Block

// Rule 2: Rate limit API endpoints
Path: /api/*
Rate: 50 requests per 5 minutes
Action: Block

// Rule 3: Geographic blocking (optional)
Country: High-risk countries
Action: Challenge

// Rule 4: Block large payloads
Content-Length: > 1MB
Action: Block

// Rule 5: User-Agent filtering
User-Agent: Does not contain "Mozilla"
Action: Challenge
```

### 4. Application-Level Security Updates

#### Update your server.js with Render-optimized security:

```javascript
// Enhanced middleware for Render deployment
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Trust Render's proxy
app.set('trust proxy', 1);

// Enhanced security headers for Render
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: [
                "'self'", 
                "https://generativelanguage.googleapis.com",
                "https://api.mistral.ai",
                "https://api.together.xyz",
                "https://api.cohere.ai",
                "https://api.groq.com",
                "https://api-inference.huggingface.co",
                "https://openrouter.ai",
                "https://api.ai21.com",
                "https://api.replicate.com"
            ],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Enhanced rate limiting for Render
const createRateLimiter = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: { error: message, retryAfter: Math.ceil(windowMs / 1000) },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            // Use X-Forwarded-For from Render's proxy
            return req.headers['x-forwarded-for'] || 
                   req.headers['x-real-ip'] || 
                   req.connection.remoteAddress;
        }
    });
};

// Apply different rate limits
app.use('/api/query', createRateLimiter(5 * 60 * 1000, 50, 'Too many API requests'));
app.use('/api/smart', createRateLimiter(5 * 60 * 1000, 30, 'Too many smart requests'));
app.use('/api/', createRateLimiter(15 * 60 * 1000, 100, 'Too many requests'));

// Enhanced CORS for production
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'https://yourdomain.com',
            'https://askme-frontend.vercel.app',
            'http://localhost:3000',
            'http://localhost:8080'
        ];
        
        if (allowedOrigins.some(allowedOrigin => origin.includes(allowedOrigin))) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Input validation middleware
const validateInput = (req, res, next) => {
    const { prompt, provider } = req.body;
    
    // Required field validation
    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Valid prompt is required' });
    }
    
    // Length validation
    if (prompt.length > 10000) {
        return res.status(400).json({ error: 'Prompt too long (max 10,000 characters)' });
    }
    
    // XSS prevention
    const xssPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
    if (xssPattern.test(prompt)) {
        secureLog('XSS attempt blocked', { ip: req.ip, userAgent: req.get('User-Agent') });
        return res.status(400).json({ error: 'Invalid input detected' });
    }
    
    // SQL injection prevention
    const sqlPatterns = [
        /(\b(select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
        /(union|join|where|having|group by|order by)/gi,
        /('|"|;|--|\*|\/\*|\*\/)/g
    ];
    
    for (let pattern of sqlPatterns) {
        if (pattern.test(prompt)) {
            secureLog('SQL injection attempt blocked', { ip: req.ip, userAgent: req.get('User-Agent') });
            return res.status(400).json({ error: 'Invalid input detected' });
        }
    }
    
    // Provider validation
    if (provider && !/^[a-zA-Z0-9_-]+$/.test(provider)) {
        return res.status(400).json({ error: 'Invalid provider name' });
    }
    
    // Basic sanitization
    req.body.prompt = prompt.trim();
    
    next();
};

// Apply validation to API endpoints
app.use('/api/query', validateInput);
app.use('/api/smart', validateInput);
```

### 5. Monitoring & Alerting for Render

#### Health Check Enhancement
```javascript
// Enhanced health check with security status
app.get('/health', (req, res) => {
    const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.1.0',
        environment: process.env.NODE_ENV || 'production',
        providers: Object.keys(PROVIDERS),
        security: {
            keysLoaded: keyManager.getKeyStats(),
            rateLimitActive: true,
            corsConfigured: true,
            helmetActive: true
        },
        uptime: process.uptime(),
        memory: process.memoryUsage()
    };
    
    res.json(healthData);
});

// Security status endpoint (protected)
app.get('/api/security-status', (req, res) => {
    // Simple authentication check
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.ADMIN_TOKEN}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.json({
        keyStats: keyManager.getKeyStats(),
        recentErrors: getRecentErrors(), // Implement this function
        requestMetrics: getRequestMetrics(), // Implement this function
        securityEvents: getSecurityEvents() // Implement this function
    });
});
```

### 6. Deployment Security Checklist

#### Pre-Deployment (Render Dashboard)
- [ ] Set all API keys in Environment Variables
- [ ] Set `NODE_ENV=production`
- [ ] Set `ADMIN_TOKEN` to secure random value
- [ ] Remove any test/debug environment variables
- [ ] Enable "Auto-Deploy" only from main branch

#### Post-Deployment
- [ ] Test all API endpoints
- [ ] Verify rate limiting works
- [ ] Check CORS policy
- [ ] Test input validation
- [ ] Monitor logs for errors
- [ ] Set up Cloudflare if using custom domain

---

## Next Steps

1. **Immediate (Today)**:
   - Update server.js with SecureKeyManager
   - Deploy enhanced security middleware
   - Test all endpoints still work

2. **This Week**:
   - Set up custom domain + Cloudflare WAF
   - Implement security monitoring
   - Create incident response plan

3. **Ongoing**:
   - Monitor security events
   - Regular API key rotation
   - Security testing

The key insight is that **Render provides good infrastructure security**, but we still need **application-level protection** against API abuse, injection attacks, and monitoring for suspicious activity.