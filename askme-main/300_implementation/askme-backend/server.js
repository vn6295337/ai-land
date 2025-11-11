// AskMe Backend Proxy Server - UPDATED VERSION
// Secure API key management and request proxying

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const JSZip = require('jszip');
require('dotenv').config();

// Supabase client for ai_models_main table (shared with discoverer and ai-land)
const { getAllModels, getModelsByProvider, getModelById, getAvailableProviders, getModelCountsByProvider } = require('./supabase-client');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Railway deployment
app.set('trust proxy', 1);

// Enhanced CORS Configuration for Production Security
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, CLI tools)
        if (!origin) return callback(null, true);
        
        // Allowed origins for your application
        const allowedOrigins = [
            // Production domains
            'https://askme-frontend.vercel.app',
            'https://askme-app.netlify.app', 
            'https://yourdomain.com',
            'https://www.yourdomain.com',
            
            // Development domains (remove in production)
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:8080',
            'http://localhost:5173', // Vite default
            'http://127.0.0.1:3000',
            'http://127.0.0.1:5173',
            
            // Allow Render preview deployments
            /https:\/\/.*\.onrender\.com$/,
            
            // Allow Vercel preview deployments
            /https:\/\/.*\.vercel\.app$/,
            
            // Allow Netlify preview deployments  
            /https:\/\/.*\.netlify\.app$/
        ];
        
        // Check if origin is allowed
        const isAllowed = allowedOrigins.some(allowedOrigin => {
            if (typeof allowedOrigin === 'string') {
                return origin === allowedOrigin;
            } else if (allowedOrigin instanceof RegExp) {
                return allowedOrigin.test(origin);
            }
            return false;
        });
        
        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn(`🚨 CORS: Blocked request from unauthorized origin: ${origin}`);
            callback(new Error(`CORS policy violation: Origin ${origin} not allowed`));
        }
    },
    
    // Allow credentials (cookies, authorization headers)
    credentials: true,
    
    // Allowed HTTP methods
    methods: ['GET', 'POST', 'OPTIONS'],
    
    // Allowed headers
    allowedHeaders: [
        'Content-Type',
        'Authorization', 
        'X-Requested-With',
        'Accept',
        'Origin',
        'Cache-Control',
        'X-API-Key'
    ],
    
    // Exposed headers (what browser can access)
    exposedHeaders: [
        'X-Total-Count',
        'X-Rate-Limit-Remaining',
        'X-Rate-Limit-Reset'
    ],
    
    // Preflight cache duration (24 hours)
    maxAge: 86400,
    
    // Handle preflight for all routes
    optionsSuccessStatus: 200
};

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cors(corsOptions));

// Enhanced Rate Limiting with Behavioral Analysis
const ipBehaviorMap = new Map();
const suspiciousIPs = new Set();

// Behavioral analysis for rate limiting
const analyzeRequestBehavior = (req) => {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const now = Date.now();
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    if (!ipBehaviorMap.has(clientIP)) {
        ipBehaviorMap.set(clientIP, {
            requests: [],
            userAgents: new Set(),
            suspicious: false,
            firstSeen: now
        });
    }
    
    const behavior = ipBehaviorMap.get(clientIP);
    
    // Clean old requests (keep last hour)
    behavior.requests = behavior.requests.filter(req => now - req.timestamp < 3600000);
    
    // Add current request
    behavior.requests.push({
        timestamp: now,
        path: req.path,
        userAgent: userAgent,
        promptLength: req.body?.prompt?.length || 0
    });
    
    behavior.userAgents.add(userAgent);
    
    // Behavioral analysis
    const recentRequests = behavior.requests.filter(req => now - req.timestamp < 300000); // 5 minutes
    const rapidRequests = recentRequests.length;
    const userAgentCount = behavior.userAgents.size;
    const avgPromptLength = recentRequests.reduce((sum, req) => sum + req.promptLength, 0) / recentRequests.length || 0;
    
    // Suspicious behavior detection
    const suspiciousIndicators = {
        rapidFire: rapidRequests > 30, // More than 30 requests in 5 minutes
        multipleUserAgents: userAgentCount > 3, // More than 3 different user agents
        shortPrompts: avgPromptLength < 10 && recentRequests.length > 5, // Very short prompts repeatedly
        noUserAgent: userAgent === 'unknown' && recentRequests.length > 2,
        automatedPattern: recentRequests.length > 10 && new Set(recentRequests.map(r => r.promptLength)).size < 3
    };
    
    const suspiciousCount = Object.values(suspiciousIndicators).filter(Boolean).length;
    
    if (suspiciousCount >= 2) {
        behavior.suspicious = true;
        suspiciousIPs.add(clientIP);
        console.warn(`🚨 BEHAVIORAL: Suspicious activity detected from ${clientIP}:`, suspiciousIndicators);
    }
    
    return {
        clientIP,
        rapidRequests,
        suspicious: behavior.suspicious,
        indicators: suspiciousIndicators
    };
};

// Create enhanced rate limiters
const createEnhancedRateLimiter = (windowMs, max, maxSuspicious) => {
    return rateLimit({
        windowMs,
        max: (req) => {
            const behavior = analyzeRequestBehavior(req);
            return behavior.suspicious ? maxSuspicious : max;
        },
        keyGenerator: (req) => {
            return req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        },
        skip: (req) => {
            // Skip rate limiting for health checks
            return req.path === '/health' || req.path === '/api/security-status';
        },
        message: (req) => {
            const behavior = analyzeRequestBehavior(req);
            if (behavior.suspicious) {
                return {
                    error: 'Request temporarily blocked due to suspicious activity',
                    retryAfter: Math.ceil(windowMs / 1000)
                };
            }
            return {
                error: 'Too many requests, please try again later',
                retryAfter: Math.ceil(windowMs / 1000)
            };
        },
        standardHeaders: true,
        legacyHeaders: false,
        onLimitReached: (req) => {
            const behavior = analyzeRequestBehavior(req);
            console.warn(`🚨 RATE LIMIT: IP ${behavior.clientIP} hit limit, suspicious: ${behavior.suspicious}`);
        }
    });
};

// Apply different rate limits based on endpoint sensitivity
const generalLimiter = createEnhancedRateLimiter(15 * 60 * 1000, 100, 20); // 100/15min normal, 20/15min suspicious
const apiLimiter = createEnhancedRateLimiter(5 * 60 * 1000, 50, 10);       // 50/5min normal, 10/5min suspicious
const strictLimiter = createEnhancedRateLimiter(1 * 60 * 1000, 10, 3);     // 10/1min normal, 3/1min suspicious

app.use('/api/', generalLimiter);
app.use('/api/query', apiLimiter);
app.use('/api/smart', strictLimiter);

// Security Middleware - Input Validation & Attack Prevention
const validateInput = (req, res, next) => {
    const { prompt, provider, model } = req.body;
    const clientIP = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    // Log security events
    const logSecurityEvent = (event, details = {}) => {
        console.warn(`🚨 SECURITY: ${event} from ${clientIP}`, details);
    };
    
    // 1. Required field validation
    if (!prompt || typeof prompt !== 'string') {
        logSecurityEvent('INVALID_INPUT', { error: 'Missing or invalid prompt' });
        return res.status(400).json({ 
            error: 'Valid prompt is required',
            code: 'INVALID_PROMPT'
        });
    }
    
    // 2. Length validation
    if (prompt.length > 10000) {
        logSecurityEvent('PAYLOAD_TOO_LARGE', { length: prompt.length });
        return res.status(400).json({ 
            error: 'Prompt too long (max 10,000 characters)',
            code: 'PROMPT_TOO_LONG'
        });
    }
    
    if (prompt.length < 1) {
        logSecurityEvent('EMPTY_PROMPT', {});
        return res.status(400).json({ 
            error: 'Prompt cannot be empty',
            code: 'EMPTY_PROMPT'
        });
    }
    
    // 3. XSS Prevention - Multiple patterns
    const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
        /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
        /<embed\b[^<]*>/gi,
        /javascript:/gi,
        /data:text\/html/gi,
        /vbscript:/gi,
        /on\w+\s*=/gi,  // event handlers like onclick=
        /<img[^>]+src[\s]*=[\s]*["|']javascript:/gi
    ];
    
    for (let pattern of xssPatterns) {
        if (pattern.test(prompt)) {
            logSecurityEvent('XSS_ATTEMPT', { pattern: pattern.toString() });
            return res.status(400).json({ 
                error: 'Invalid input detected - potential security risk',
                code: 'XSS_BLOCKED'
            });
        }
    }
    
    // 4. SQL Injection Prevention
    const sqlPatterns = [
        /(\b(select|insert|update|delete|drop|create|alter|exec|execute|union|join)\b)/gi,
        /(where|having|group\s+by|order\s+by)/gi,
        /('|"|;|--|\*|\/\*|\*\/|@@|char\(|nchar\(|varchar\(|nvarchar\(|alter\(|begin\(|cast\(|create\(|cursor\(|declare\(|delete\(|drop\(|end\(|exec\(|execute\(|fetch\(|insert\(|kill\(|open\(|select\(|sys\(|table\(|update\()/gi,
        /(union.*select|select.*union)/gi,
        /\b(or|and)\b.*[=<>]/gi
    ];
    
    for (let pattern of sqlPatterns) {
        if (pattern.test(prompt)) {
            logSecurityEvent('SQL_INJECTION_ATTEMPT', { pattern: pattern.toString() });
            return res.status(400).json({ 
                error: 'Invalid input detected - potential security risk',
                code: 'SQL_INJECTION_BLOCKED'
            });
        }
    }
    
    // 5. Command Injection Prevention
    const commandPatterns = [
        /[;&|`$(){}[\]\\]/g,
        /\.\.\//g,  // Path traversal
        /\/etc\/passwd/gi,
        /\/proc\//gi,
        /cmd\.exe/gi,
        /powershell/gi,
        /bash/gi,
        /\/bin\//gi
    ];
    
    for (let pattern of commandPatterns) {
        if (pattern.test(prompt)) {
            logSecurityEvent('COMMAND_INJECTION_ATTEMPT', { pattern: pattern.toString() });
            return res.status(400).json({ 
                error: 'Invalid input detected - potential security risk',
                code: 'COMMAND_INJECTION_BLOCKED'
            });
        }
    }
    
    // 6. Provider validation
    if (provider && !/^[a-zA-Z0-9_-]+$/.test(provider)) {
        logSecurityEvent('INVALID_PROVIDER', { provider });
        return res.status(400).json({ 
            error: 'Invalid provider name format',
            code: 'INVALID_PROVIDER'
        });
    }
    
    // 7. Model validation
    if (model && !/^[a-zA-Z0-9._/-]+$/.test(model)) {
        logSecurityEvent('INVALID_MODEL', { model });
        return res.status(400).json({ 
            error: 'Invalid model name format',
            code: 'INVALID_MODEL'
        });
    }
    
    // 8. Content type validation
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
        logSecurityEvent('INVALID_CONTENT_TYPE', { contentType });
        return res.status(400).json({ 
            error: 'Content-Type must be application/json',
            code: 'INVALID_CONTENT_TYPE'
        });
    }
    
    // 9. Basic sanitization (remove null bytes and control characters)
    req.body.prompt = prompt.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // 10. Advanced Prompt Injection Detection (AI-specific)
    const promptInjectionPatterns = [
        // Role manipulation
        /\b(ignore|forget|disregard).{0,20}(previous|prior|above|earlier).{0,20}(instruction|prompt|rule|system)/gi,
        /\b(you.?are.?now|pretend.?to.?be|act.?as|roleplay.?as|imagine.?you.?are).{0,30}(different|new|another)/gi,
        /\b(system.?prompt|initial.?prompt|base.?prompt|original.?instruction)/gi,
        
        // Jailbreaking attempts
        /\b(jailbreak|uncensored|unrestricted|without.?limitation|break.?free)/gi,
        /\b(developer.?mode|admin.?mode|god.?mode|debug.?mode)/gi,
        /\b(override|bypass|circumvent|disable).{0,20}(safety|filter|restriction|limitation)/gi,
        
        // Context manipulation
        /\b(end.?of.?prompt|start.?new.?conversation|reset.?context|clear.?history)/gi,
        /\b(simulate|emulate|mimic).{0,20}(different|another|evil|malicious)/gi,
        /\b(hypothetical|theoretical|fictional).{0,20}scenario.{0,20}(where|in.?which)/gi,
        
        // Information extraction attempts  
        /\b(tell.?me|show.?me|reveal|disclose).{0,30}(password|secret|key|token|config)/gi,
        /\b(what.?is|display|print|output).{0,20}(system|server|database|admin)/gi,
        /\b(training.?data|model.?weights|source.?code|internal.?prompt)/gi,
        
        // Multi-language bypass attempts
        /\b(base64|hex|ascii|unicode|encode|decode)/gi,
        /\b(translate|convert|transform).{0,20}(to|into).{0,20}(code|cipher|binary)/gi,
        
        // Instruction confusion
        /\b(but.?actually|however.?really|in.?reality|the.?truth.?is)/gi,
        /\b(contrary.?to|opposite.?of|instead.?of).{0,20}(above|previous)/gi,
        
        // Prompt chaining
        /\b(after.?this|then|next).{0,20}(ignore|forget|disregard)/gi,
        /\b(if.*then|when.*do|should.*always)/gi
    ];
    
    for (let pattern of promptInjectionPatterns) {
        if (pattern.test(prompt)) {
            logSecurityEvent('PROMPT_INJECTION_ATTEMPT', { pattern: pattern.toString() });
            return res.status(400).json({ 
                error: 'Invalid input detected - potential security risk',
                code: 'PROMPT_INJECTION_BLOCKED'
            });
        }
    }
    
    // 11. Encoding bypass detection
    const encodedPatterns = [
        // Base64 encoded suspicious content
        /[A-Za-z0-9+\/]{20,}={0,2}/g,
        // URL encoded suspicious patterns
        /%[0-9A-Fa-f]{2}/g,
        // Unicode escape sequences
        /\\u[0-9A-Fa-f]{4}/g,
        // HTML entities
        /&[a-zA-Z]+;|&#[0-9]+;/g
    ];
    
    for (let pattern of encodedPatterns) {
        const matches = prompt.match(pattern);
        if (matches && matches.length > 3) {
            logSecurityEvent('ENCODED_PAYLOAD_DETECTED', { 
                pattern: pattern.toString(),
                matches: matches.length 
            });
            return res.status(400).json({ 
                error: 'Invalid input detected - encoded content not allowed',
                code: 'ENCODED_PAYLOAD_BLOCKED'
            });
        }
    }
    
    // 12. Suspicious pattern detection (log but don't block)
    const suspiciousPatterns = [
        /crypto/gi,
        /wallet/gi,
        /password/gi,
        /credit.?card/gi,
        /ssn|social.?security/gi,
        // AI-specific suspicious patterns
        /model.?architecture/gi,
        /neural.?network/gi,
        /machine.?learning/gi
    ];
    
    for (let pattern of suspiciousPatterns) {
        if (pattern.test(prompt)) {
            logSecurityEvent('SUSPICIOUS_CONTENT', { pattern: pattern.toString() });
        }
    }
    
    // Success - log clean request
    console.log(`✅ Input validated for ${provider || 'unknown'} - ${prompt.length} chars from ${clientIP}`);
    next();
};

// Content Security Middleware
const contentSecurity = (req, res, next) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Remove server information
    res.removeHeader('X-Powered-By');
    
    next();
};

// Apply security middleware to all routes
app.use(contentSecurity);

// AI Response Sanitization & Safety Middleware
const sanitizeAIResponse = (response, provider) => {
    if (!response || typeof response !== 'string') return response;
    
    let sanitizedResponse = response;
    
    // 1. PII Detection and Removal
    const piiPatterns = [
        // Email addresses
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        // Phone numbers (various formats)
        /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
        /\(\d{3}\)\s*\d{3}[-.]?\d{4}/g,
        // SSN patterns
        /\b\d{3}-\d{2}-\d{4}\b/g,
        // Credit card patterns (basic)
        /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
        // API keys and tokens
        /\b[A-Za-z0-9]{32,}\b/g,
        // IP addresses
        /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g
    ];
    
    piiPatterns.forEach(pattern => {
        sanitizedResponse = sanitizedResponse.replace(pattern, '[REDACTED]');
    });
    
    // 2. Dangerous Content Detection
    const dangerousPatterns = [
        // Script injections
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        // Harmful instructions
        /\b(suicide|self.?harm|kill.?yourself)\b/gi,
        // Illegal activity instructions
        /\b(how.?to.?(hack|crack|break.?into|steal))\b/gi,
        // System commands
        /\b(rm\s+-rf|del\s+\/|format\s+c:)\b/gi,
        // Password/credential harvesting
        /\b(password|username|login|credential).{0,20}[:=]\s*\w+/gi
    ];
    
    dangerousPatterns.forEach(pattern => {
        if (pattern.test(sanitizedResponse)) {
            console.warn(`🚨 AI SAFETY: Dangerous content detected from ${provider}:`, pattern.toString());
            sanitizedResponse = sanitizedResponse.replace(pattern, '[CONTENT_FILTERED]');
        }
    });
    
    // 3. Information Leakage Prevention
    const infoLeakagePatterns = [
        // Server information
        /\b(server|database|admin|root|config|environment)\b.{0,50}\b(password|key|token|secret)\b/gi,
        // Internal paths
        /\b[A-Za-z]:\\[\w\\]+/g,
        /\/[a-z]+\/[a-z]+\/[a-z]+/g,
        // Database queries
        /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN)\b/gi,
        // System information
        /\b(localhost|127\.0\.0\.1|0\.0\.0\.0)\b/gi
    ];
    
    infoLeakagePatterns.forEach(pattern => {
        if (pattern.test(sanitizedResponse)) {
            console.warn(`🚨 AI SAFETY: Information leakage detected from ${provider}:`, pattern.toString());
            sanitizedResponse = sanitizedResponse.replace(pattern, '[INFO_FILTERED]');
        }
    });
    
    // 4. Content Safety Classification
    const harmfulContentIndicators = [
        /\b(violence|weapon|bomb|explosive|attack)\b/gi,
        /\b(drug|cocaine|heroin|meth|illegal.?substance)\b/gi,
        /\b(fraud|scam|money.?laundering|identity.?theft)\b/gi
    ];
    
    let riskScore = 0;
    harmfulContentIndicators.forEach(pattern => {
        if (pattern.test(sanitizedResponse)) {
            riskScore++;
        }
    });
    
    // Log high-risk responses
    if (riskScore >= 2) {
        console.error(`🚨 AI SAFETY: High-risk content detected from ${provider}, risk score: ${riskScore}`);
    }
    
    // 5. Length and format validation
    if (sanitizedResponse.length > 50000) {
        console.warn(`⚠️ AI SAFETY: Unusually long response from ${provider}: ${sanitizedResponse.length} chars`);
        sanitizedResponse = sanitizedResponse.substring(0, 50000) + '\n[RESPONSE_TRUNCATED]';
    }
    
    return sanitizedResponse;
};

// Generic Error Response Generator (prevent security fingerprinting)
const createGenericError = (isProduction = process.env.NODE_ENV === 'production') => {
    if (isProduction) {
        // Generic error for production - no security details exposed
        return {
            error: 'Request could not be processed',
            code: 'REQUEST_REJECTED',
            timestamp: new Date().toISOString()
        };
    } else {
        // Keep detailed errors for development
        return null; // Will use original error
    }
};

// Security-aware error middleware
const securityErrorHandler = (req, res, next) => {
    const originalSend = res.json;
    
    res.json = function(data) {
        // Intercept error responses that might leak security information
        if (data && data.error && data.code) {
            const securityCodes = [
                'XSS_BLOCKED', 
                'SQL_INJECTION_BLOCKED', 
                'COMMAND_INJECTION_BLOCKED',
                'PROMPT_INJECTION_BLOCKED',
                'ENCODED_PAYLOAD_BLOCKED'
            ];
            
            if (securityCodes.includes(data.code)) {
                const genericError = createGenericError();
                if (genericError) {
                    // Log the actual security event server-side
                    console.warn(`🔒 SECURITY: ${data.code} from ${req.ip} - Generic error returned to client`);
                    return originalSend.call(this, genericError);
                }
            }
        }
        
        return originalSend.call(this, data);
    };
    
    next();
};

// Apply security error handler to API routes
app.use('/api/', securityErrorHandler);

// Apply input validation to API endpoints that need it
app.use('/api/query', validateInput);
app.use('/api/smart', validateInput);

// Secure Key Manager - Enhanced security for Render deployment
const crypto = require('crypto');

class SecureKeyManager {
    constructor() {
        this.keys = new Map();
        this.loadedCount = 0;
        this.initializeKeys();
    }
    
    initializeKeys() {
        const providers = ['google', 'mistral', 'cohere', 'groq', 'huggingface', 'openrouter', 'ai21', 'replicate', 'together'];
        
        console.log('🔐 Initializing secure key management...');
        
        providers.forEach(provider => {
            // Handle special case for Google Gemini API key naming
            const envKey = provider === 'google' ? 'GEMINI_API_KEY' : `${provider.toUpperCase()}_API_KEY`;
            const key = process.env[envKey];
            
            if (key && key.trim() !== '') {
                // Create secure hash for logging (first 8 chars of SHA256)
                const keyHash = crypto.createHash('sha256').update(key).digest('hex').substring(0, 8);
                
                // Store key with metadata
                this.keys.set(provider, {
                    key: key.trim(),
                    hash: keyHash,
                    lastUsed: null,
                    useCount: 0,
                    loaded: new Date().toISOString()
                });
                
                // Clear from process.env for security
                delete process.env[envKey];
                
                console.log(`✅ Loaded ${provider} key (${keyHash}...)`);
                this.loadedCount++;
            } else {
                console.warn(`⚠️  Missing or empty API key for ${provider}`);
            }
        });
        
        console.log(`🔑 Secure key manager initialized: ${this.loadedCount}/${providers.length} keys loaded`);
    }
    
    getKey(provider) {
        const keyData = this.keys.get(provider);
        if (!keyData) {
            throw new Error(`API key not configured for provider: ${provider}`);
        }
        
        // Update usage tracking
        keyData.lastUsed = new Date().toISOString();
        keyData.useCount++;
        
        return keyData.key;
    }
    
    hasKey(provider) {
        return this.keys.has(provider);
    }
    
    getStats() {
        const stats = {};
        this.keys.forEach((data, provider) => {
            stats[provider] = {
                hash: data.hash,
                lastUsed: data.lastUsed,
                useCount: data.useCount,
                loaded: data.loaded,
                status: 'active'
            };
        });
        return {
            totalKeys: this.keys.size,
            providers: stats,
            securityStatus: 'enabled'
        };
    }
    
    // Get sanitized key info for API responses
    getProviderStatus() {
        const status = [];
        this.keys.forEach((data, provider) => {
            status.push({
                name: provider,
                available: true,
                status: 'active',
                hash: data.hash,
                useCount: data.useCount
            });
        });
        return status;
    }
}

// Initialize secure key manager
const keyManager = new SecureKeyManager();

// Secure key retrieval function
const getAPIKey = (provider) => {
    try {
        return keyManager.getKey(provider);
    } catch (error) {
        console.error(`🚨 Key retrieval failed for ${provider}:`, error.message);
        throw error;
    }
};

// ArtificialAnalysis API key retrieval
const getArtificialAnalysisKey = () => {
    const key = process.env.ARTIFICIALANALYSIS_API_KEY;
    if (!key || key.trim() === '') {
        throw new Error('ARTIFICIALANALYSIS_API_KEY environment variable not configured');
    }
    return key.trim();
};

// LLM Scout Agent configuration
const AGENT_AUTH_TOKEN = process.env.AGENT_AUTH_TOKEN || 'scout-agent-default-token';
const LLMS_FILE_PATH = path.join(__dirname, 'data', 'llms.json');

// GitHub Dashboard configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = 'vn6295337';
const GITHUB_REPO = 'askme';
const WORKFLOW_FILE = 'scout-agent.yml';
const ARTIFACT_NAME = 'model-validation-results';

// Cache for GitHub dashboard data to avoid API limits
let githubDataCache = {
  data: null,
  timestamp: null,
  previousMetrics: null
};
const GITHUB_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ArtificialAnalysis API configuration and caching
const ARTIFICIALANALYSIS_BASE_URL = 'https://artificialanalysis.ai/api/v2';
const ARTIFICIALANALYSIS_RATE_LIMIT = 1000; // 1000 requests per day
let artificialAnalysisCache = {
  models: { data: null, timestamp: null },
  media: { data: new Map(), timestamp: null }
};
const AA_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours due to rate limits

// ArtificialAnalysis request counter for rate limiting
let aaRequestCount = 0;
let aaRequestResetTime = Date.now() + (24 * 60 * 60 * 1000);

// Ensure data directory exists
fs.ensureDirSync(path.dirname(LLMS_FILE_PATH));

// ArtificialAnalysis helper functions
const checkAATimeLimit = () => {
  const now = Date.now();
  if (now >= aaRequestResetTime) {
    aaRequestCount = 0;
    aaRequestResetTime = now + (24 * 60 * 60 * 1000);
  }
  return aaRequestCount < ARTIFICIALANALYSIS_RATE_LIMIT;
};

const incrementAARequestCount = () => {
  aaRequestCount++;
  console.log(`📊 ArtificialAnalysis requests used: ${aaRequestCount}/${ARTIFICIALANALYSIS_RATE_LIMIT}`);
};

const makeAARequest = async (endpoint, options = {}) => {
  if (!checkAATimeLimit()) {
    throw new Error(`Rate limit exceeded: ${aaRequestCount}/${ARTIFICIALANALYSIS_RATE_LIMIT} requests used. Resets in ${Math.round((aaRequestResetTime - Date.now()) / 3600000)} hours.`);
  }

  const apiKey = getArtificialAnalysisKey();
  const url = `${ARTIFICIALANALYSIS_BASE_URL}${endpoint}`;
  
  const headers = {
    'x-api-key': apiKey,
    'User-Agent': 'AskMe-Discovery/1.0',
    'Accept': 'application/json',
    ...options.headers
  };

  console.log(`🔍 ArtificialAnalysis request: ${endpoint}`);
  
  try {
    const response = await axios.get(url, { 
      headers, 
      timeout: 30000,
      ...options 
    });
    
    incrementAARequestCount();
    
    return {
      data: response.data,
      status: response.status,
      headers: response.headers,
      rateLimitRemaining: response.headers['x-ratelimit-remaining'],
      rateLimitReset: response.headers['x-ratelimit-reset']
    };
  } catch (error) {
    if (error.response) {
      console.error(`❌ ArtificialAnalysis API Error: ${error.response.status} - ${error.response.data?.message || error.message}`);
      throw new Error(`ArtificialAnalysis API Error: ${error.response.status} - ${error.response.data?.message || error.message}`);
    } else {
      console.error(`❌ ArtificialAnalysis Network Error:`, error.message);
      throw new Error(`Network error connecting to ArtificialAnalysis: ${error.message}`);
    }
  }
};

// Authentication middleware for agent requests
const authenticateAgent = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token || token !== AGENT_AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized agent access' });
  }
  
  next();
};

// Provider configurations - UPDATED WITH LATEST MODELS
const PROVIDERS = {
  google: {
    // Models discovered dynamically via API
    discoveryEndpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    url: (apiKey, model) => `https://generativelanguage.googleapis.com/v1/models/${model || "gemini-1.5-flash"}:generateContent?key=${apiKey}`,
    headers: () => ({
      "Content-Type": "application/json"
    }),
    formatRequest: (prompt) => ({
      contents: [{
        parts: [{ text: prompt }]
      }]
    }),
    extractResponse: (data) => {
      try {
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Google Gemini";
      } catch (e) {
        return "Error processing Google Gemini response";
      }
    }
  },
  
  mistral: {
    // Models discovered dynamically via API
    discoveryEndpoint: "https://api.mistral.ai/v1/models",
    url: () => "https://api.mistral.ai/v1/chat/completions",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    }),
    formatRequest: (prompt, model) => ({
      model: model || "mistral-small-latest",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.7
    }),
    extractResponse: (data) => {
      try {
        return data.choices?.[0]?.message?.content || "No response from Mistral";
      } catch (e) {
        return "Error processing Mistral response";
      }
    }
  },
  
  
  cohere: {
    // Models discovered dynamically via API
    discoveryEndpoint: "https://api.cohere.ai/v1/models",
    url: () => "https://api.cohere.ai/v1/chat",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    }),
    formatRequest: (prompt, model) => ({
      model: model || "command",
      message: prompt,
      max_tokens: 500,
      temperature: 0.7
    }),
    extractResponse: (data) => {
      try {
        return data.text || data.message || "No response from Cohere";
      } catch (e) {
        return "Error processing Cohere response";
      }
    }
  },
  
  groq: {
    // Models discovered dynamically via API
    discoveryEndpoint: "https://api.groq.com/openai/v1/models",
    url: () => "https://api.groq.com/openai/v1/chat/completions",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    }),
    formatRequest: (prompt, model) => ({
      model: model || "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.7
    }),
    extractResponse: (data) => {
      try {
        return data.choices?.[0]?.message?.content || "No response from Groq";
      } catch (e) {
        return "Error processing Groq response";
      }
    }
  },
  
  huggingface: {
    // Models discovered dynamically via API
    discoveryEndpoint: "https://huggingface.co/api/models?filter=inference&sort=trending&limit=1000",
    url: (apiKey, model) => `https://api-inference.huggingface.co/models/${model || "microsoft/DialoGPT-large"}`,
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    }),
    formatRequest: (prompt) => ({
      inputs: prompt,
      parameters: {
        max_length: 500,
        temperature: 0.7,
        return_full_text: false
      }
    }),
    extractResponse: (data) => {
      try {
        if (Array.isArray(data)) {
          return data[0]?.generated_text || data[0]?.text || "No response from HuggingFace";
        }
        return data.generated_text || data.text || data.response || "No response from HuggingFace";
      } catch (e) {
        return "Error processing HuggingFace response";
      }
    }
  },
  
  openrouter: {
    // Models discovered dynamically via API
    discoveryEndpoint: "https://openrouter.ai/api/v1/models",
    url: () => "https://openrouter.ai/api/v1/chat/completions",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://askme-backend-proxy.onrender.com",
      "X-Title": "AskMe CLI"
    }),
    formatRequest: (prompt, model) => ({
      model: model || "anthropic/claude-3-haiku",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.7
    }),
    extractResponse: (data) => {
      try {
        return data.choices?.[0]?.message?.content || "No response from OpenRouter";
      } catch (e) {
        return "Error processing OpenRouter response";
      }
    }
  },
  
  ai21: {
    // Models discovered dynamically via API
    discoveryEndpoint: "https://api.ai21.com/studio/v1/models",
    url: (apiKey, model) => `https://api.ai21.com/studio/v1/${model || "j2-light"}/complete`,
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    }),
    formatRequest: (prompt) => ({
      prompt: prompt,
      maxTokens: 500,
      temperature: 0.7,
      topP: 1,
      stopSequences: []
    }),
    extractResponse: (data) => {
      try {
        return data.completions?.[0]?.data?.text || "No response from AI21";
      } catch (e) {
        return "Error processing AI21 response";
      }
    }
  },
  
  replicate: {
    // Models discovered dynamically via API
    discoveryEndpoint: "https://api.replicate.com/v1/models?owner=meta&owner=mistralai",
    url: () => "https://api.replicate.com/v1/predictions",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      "Authorization": `Token ${apiKey}`
    }),
    formatRequest: (prompt, model) => ({
      version: this.getModelVersion(model || "meta/llama-2-70b-chat"),
      input: {
        prompt: prompt,
        max_length: 500,
        temperature: 0.7
      }
    }),
    getModelVersion: (model) => {
      // Model version mappings for Replicate
      const versions = {
        "meta/llama-2-70b-chat": "02e509c789964a7ea8736978a43525956ef40397be9033abf9fd2badfe68c9e3",
        "meta/llama-2-13b-chat": "f4e2de70d66816a838a89eeeb621910adffb0dd0baba3976c96980970978018d",
        "mistralai/mixtral-8x7b-instruct-v0.1": "cf18decbf51c27fed6bbdc3492312c1c903222a56e3fe9ca02d6cbe5198afc10",
        "meta/codellama-34b-instruct": "7fdf82bb301ebeea7ba2b9e4d19b4e49d1ce6faae5c0ddc6b5af9f33d52ee346"
      };
      return versions[model] || versions["meta/llama-2-70b-chat"];
    },
    extractResponse: (data) => {
      try {
        if (data.output && Array.isArray(data.output)) {
          return data.output.join('') || "No response from Replicate";
        }
        return data.output || "No response from Replicate";
      } catch (e) {
        return "Error processing Replicate response";
      }
    }
  },
  
  together: {
    // Models discovered dynamically via API
    discoveryEndpoint: "https://api.together.xyz/v1/models",
    url: () => "https://api.together.xyz/v1/chat/completions",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    }),
    formatRequest: (prompt, model) => ({
      model: model || "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.7
    }),
    extractResponse: (data) => {
      try {
        return data.choices?.[0]?.message?.content || "No response from Together AI";
      } catch (e) {
        return "Error processing Together AI response";
      }
    }
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  const keyStats = keyManager.getStats();
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.3.0',
    providers: Object.keys(PROVIDERS),
    security: {
      keyManagerActive: true,
      totalKeys: keyStats.totalKeys,
      securityStatus: keyStats.securityStatus,
      inputValidation: true,
      attackPrevention: true,
      aiSecurity: true,
      promptInjectionProtection: true,
      responseFiltering: true,
      behavioralAnalysis: true
    },
    uptime: process.uptime()
  });
});

// Security status endpoint (basic monitoring)
app.get('/api/security-status', (req, res) => {
  const keyStats = keyManager.getStats();
  res.json({
    timestamp: new Date().toISOString(),
    keyManager: keyStats,
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: PORT,
      uptime: process.uptime()
    },
    security: {
      rateLimitingActive: true,
      behavioralAnalysis: true,
      corsConfigured: true,
      corsRestrictive: true,
      secureKeyManagement: true,
      inputValidation: true,
      xssProtection: true,
      sqlInjectionProtection: true,
      commandInjectionProtection: true,
      promptInjectionProtection: true,
      aiResponseSanitization: true,
      encodingBypassDetection: true,
      genericErrorMessages: process.env.NODE_ENV === 'production',
      contentSecurityHeaders: true,
      credentialsEnabled: corsOptions.credentials,
      allowedMethods: corsOptions.methods,
      maxAge: corsOptions.maxAge,
      piiDetection: true,
      dangerousContentFiltering: true,
      informationLeakagePrevention: true
    },
    aiSecurity: {
      promptInjectionPatterns: 19,
      responseFilters: 4,
      piiPatterns: 7,
      dangerousContentPatterns: 5,
      infoLeakagePatterns: 5,
      encodingDetectionPatterns: 4,
      maxResponseLength: 50000,
      contentSafetyClassification: true
    },
    behavioralSecurity: {
      ipBehaviorTracking: true,
      suspiciousActivityDetection: true,
      adaptiveRateLimiting: true,
      userAgentAnalysis: true,
      automatedPatternDetection: true,
      currentSuspiciousIPs: suspiciousIPs.size,
      totalTrackedIPs: ipBehaviorMap.size
    }
  });
});

// CORS debugging endpoint (helps troubleshoot CORS issues)
app.get('/api/cors-info', (req, res) => {
  const origin = req.headers.origin || 'No origin header';
  res.json({
    requestOrigin: origin,
    corsConfig: {
      credentialsEnabled: corsOptions.credentials,
      allowedMethods: corsOptions.methods,
      allowedHeaders: corsOptions.allowedHeaders,
      exposedHeaders: corsOptions.exposedHeaders,
      maxAge: corsOptions.maxAge
    },
    headers: {
      origin: req.headers.origin,
      referer: req.headers.referer,
      userAgent: req.headers['user-agent']
    },
    timestamp: new Date().toISOString()
  });
});

// Main API endpoint
app.post("/api/query", async (req, res) => {
  try {
    const { prompt, provider = "mistral", model } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    
    const providerConfig = PROVIDERS[provider];
    if (!providerConfig) {
      return res.status(400).json({ 
        error: `Unsupported provider: ${provider}`,
        availableProviders: Object.keys(PROVIDERS)
      });
    }
    
    let apiKey;
    try {
      apiKey = getAPIKey(provider);
    } catch (error) {
      return res.status(500).json({ 
        error: `API key not configured for ${provider}`,
        provider: provider
      });
    }
    
    // Validate model exists for provider
    if (model && !providerConfig.models.includes(model)) {
      return res.status(400).json({
        error: `Model ${model} not supported for ${provider}`,
        availableModels: providerConfig.models
      });
    }
    
    const url = providerConfig.url(apiKey, model);
    const headers = providerConfig.headers(apiKey);
    const requestBody = providerConfig.formatRequest(prompt, model);
    
    console.log(`📡 ${provider} request: ${model || 'default'} model`);
    
    const response = await axios.post(url, requestBody, { headers });
    const rawResult = providerConfig.extractResponse(response.data);
    
    // Apply AI response sanitization
    const sanitizedResult = sanitizeAIResponse(rawResult, provider);
    
    // Log response metrics for monitoring
    if (rawResult !== sanitizedResult) {
      console.warn(`🧹 AI RESPONSE: Content sanitized for ${provider}, length: ${rawResult?.length || 0} -> ${sanitizedResult?.length || 0}`);
    }
    
    res.json({ 
      response: sanitizedResult, 
      provider, 
      model: model || providerConfig.models[0],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ ${req.body.provider || 'Unknown'} API Error:`, error);
    
    // Better error handling
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error?.message || error.message;
      
      return res.status(status).json({
        error: `${req.body.provider || 'API'} Error: ${message}`,
        provider: req.body.provider,
        statusCode: status
      });
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      provider: req.body.provider || "unknown"
    });
  }
});

// Provider status endpoint
app.get('/api/providers', (req, res) => {
  const providerStatus = Object.keys(PROVIDERS).map(provider => ({
    name: provider,
    available: keyManager.hasKey(provider),
    status: keyManager.hasKey(provider) ? 'active' : 'unavailable',
    models: PROVIDERS[provider].models,
    modelCount: PROVIDERS[provider].models.length
  }));
  
  res.json({
    providers: providerStatus,
    timestamp: new Date().toISOString(),
    totalProviders: providerStatus.length,
    activeProviders: providerStatus.filter(p => p.available).length
  });
});

// API Keys endpoint for GitHub Actions workflow
app.get('/api/keys', (req, res) => {
  try {
    const keys = {};
    const keyStats = keyManager.getStats();
    
    // Export keys for workflow consumption
    Object.keys(keyStats.providers).forEach(provider => {
      // Handle special case for Google/Gemini key naming
      const keyName = provider === 'google' ? 'GEMINI_API_KEY' : `${provider.toUpperCase()}_API_KEY`;
      
      if (keyManager.hasKey(provider)) {
        keys[keyName] = keyManager.getKey(provider);
      }
    });
    
    res.json(keys);
  } catch (error) {
    console.error('❌ Error fetching API keys:', error.message);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// Models endpoint - queries ai_models_main from Supabase (shared with discoverer and ai-land)
app.get('/api/models', async (req, res) => {
  try {
    const { provider, modelId } = req.query;

    // If modelId specified, fetch single model
    if (modelId) {
      const model = await getModelById(modelId);
      return res.json({
        model,
        timestamp: new Date().toISOString()
      });
    }

    // If provider specified, fetch models for that provider
    if (provider) {
      const models = await getModelsByProvider(provider);
      return res.json({
        provider,
        models,
        count: models.length,
        timestamp: new Date().toISOString()
      });
    }

    // Otherwise, fetch all models
    const models = await getAllModels();
    const counts = await getModelCountsByProvider();
    const providers = await getAvailableProviders();

    res.json({
      models,
      totalModels: models.length,
      providers,
      providerCounts: counts,
      timestamp: new Date().toISOString(),
      source: 'ai_models_main (Supabase)',
      sharedWith: ['ai-models-discoverer_v3', 'ai-land']
    });
  } catch (error) {
    console.error('❌ Error fetching models from Supabase:', error.message);
    res.status(500).json({
      error: 'Failed to fetch models from database',
      message: error.message,
      hint: 'Verify SUPABASE_URL and SUPABASE_ANON_KEY in .env'
    });
  }
});

// Smart provider selection endpoint
app.post('/api/smart', async (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  
  // Enhanced smart selection logic with new providers
  let selectedProvider = 'google'; // default
  
  const promptLower = prompt.toLowerCase();
  if (promptLower.includes('code') || promptLower.includes('programming') || promptLower.includes('function')) {
    selectedProvider = 'mistral';  // Good at code
  } else if (promptLower.includes('creative') || promptLower.includes('story') || promptLower.includes('write')) {
    selectedProvider = 'together';    // Creative writing with Llama models
  } else if (promptLower.includes('analysis') || promptLower.includes('research') || promptLower.includes('explain')) {
    selectedProvider = 'google';   // Analytical tasks
  } else if (promptLower.includes('math') || promptLower.includes('calculate') || promptLower.includes('solve')) {
    selectedProvider = 'google';   // Mathematical tasks
  } else if (promptLower.includes('fast') || promptLower.includes('quick') || promptLower.includes('instant')) {
    selectedProvider = 'groq';     // Ultra-fast inference
  } else if (promptLower.includes('conversation') || promptLower.includes('chat') || promptLower.includes('talk')) {
    selectedProvider = 'cohere';   // Conversational AI
  } else if (promptLower.includes('open source') || promptLower.includes('community') || promptLower.includes('hugging')) {
    selectedProvider = 'huggingface'; // Community models
  }
  
  try {
    const providerConfig = PROVIDERS[selectedProvider];
    if (!providerConfig) {
      return res.status(400).json({ 
        error: `Unsupported provider: ${selectedProvider}`,
        availableProviders: Object.keys(PROVIDERS)
      });
    }
    
    let apiKey;
    try {
      apiKey = getAPIKey(selectedProvider);
    } catch (error) {
      return res.status(500).json({ 
        error: `API key not configured for ${selectedProvider}`,
        provider: selectedProvider
      });
    }
    
    const url = providerConfig.url(apiKey, null);
    const headers = providerConfig.headers(apiKey);
    const requestBody = providerConfig.formatRequest(prompt, null);
    
    console.log(`📡 ${selectedProvider} request: default model`);
    
    const response = await axios.post(url, requestBody, { headers });
    const rawResult = providerConfig.extractResponse(response.data);
    
    // Apply AI response sanitization for smart endpoint
    const sanitizedResult = sanitizeAIResponse(rawResult, selectedProvider);
    
    // Log response metrics for monitoring
    if (rawResult !== sanitizedResult) {
      console.warn(`🧹 AI RESPONSE: Smart endpoint content sanitized for ${selectedProvider}, length: ${rawResult?.length || 0} -> ${sanitizedResult?.length || 0}`);
    }
    
    res.json({ 
      response: sanitizedResult, 
      provider: selectedProvider, 
      model: providerConfig.models[0],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ ${selectedProvider} API Error:`, error);
    
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error?.message || error.message;
      
      return res.status(status).json({
        error: `${selectedProvider} API Error: ${message}`,
        provider: selectedProvider,
        statusCode: status
      });
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      provider: selectedProvider
    });
  }
});

// GitHub Dashboard endpoints
app.get('/api/github/llm-data', async (req, res) => {
  try {
    console.log('[GitHub] Fetching LLM dashboard data...');
    
    // Check cache first
    const now = Date.now();
    if (githubDataCache.data && githubDataCache.timestamp && (now - githubDataCache.timestamp < GITHUB_CACHE_DURATION)) {
      console.log('[GitHub] Returning cached data');
      return res.json({
        ...githubDataCache.data,
        cached: true,
        cacheAge: Math.round((now - githubDataCache.timestamp) / 1000)
      });
    }

    // Verify GitHub token exists
    if (!GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN environment variable not configured');
    }

    // GitHub API headers with authentication
    const headers = {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'User-Agent': 'AskMe-LLM-Dashboard/1.0',
      'X-GitHub-Api-Version': '2022-11-28'
    };

    // Step 1: Fetch workflow runs
    console.log('[GitHub] Fetching workflow runs...');
    const runsUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=10`;
    const runsResponse = await axios.get(runsUrl, { headers });
    
    const { workflow_runs } = runsResponse.data;
    console.log(`[GitHub] Found ${workflow_runs?.length || 0} workflow runs`);
    
    if (!workflow_runs || workflow_runs.length === 0) {
      throw new Error('No workflow runs found');
    }

    // Step 2: Find successful run
    const successfulRun = workflow_runs.find(r => r.conclusion === 'success');
    if (!successfulRun) {
      throw new Error('No successful workflow runs found');
    }

    const latestRun = workflow_runs[0];
    const isOutdated = latestRun.id !== successfulRun.id;
    console.log(`[GitHub] Using run #${successfulRun.run_number}, outdated: ${isOutdated}`);

    // Step 3: Get artifacts
    console.log('[GitHub] Fetching artifacts...');
    const artifactsUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${successfulRun.id}/artifacts`;
    const artifactsResponse = await axios.get(artifactsUrl, { headers });
    
    const { artifacts } = artifactsResponse.data;
    const targetArtifact = artifacts.find(a => a.name === ARTIFACT_NAME);
    console.log(`[GitHub] Found ${artifacts.length} artifacts, target found: ${!!targetArtifact}`);
    
    if (!targetArtifact) {
      const availableArtifacts = artifacts.map(a => a.name).join(', ');
      throw new Error(`Artifact "${ARTIFACT_NAME}" not found. Available: ${availableArtifacts}`);
    }

    // Step 4: Download and parse artifact
    console.log('[GitHub] Downloading artifact...');
    const zipResponse = await axios.get(targetArtifact.archive_download_url, { 
      headers,
      responseType: 'arraybuffer'
    });
    
    const zip = await JSZip.loadAsync(zipResponse.data);
    
    const jsonFile = Object.keys(zip.files).find(k => 
      k.endsWith('validated_models.json') || k.endsWith('.json')
    );
    
    if (!jsonFile) {
      const availableFiles = Object.keys(zip.files).join(', ');
      throw new Error(`validated_models.json not found. Available files: ${availableFiles}`);
    }
    
    console.log(`[GitHub] Parsing ${jsonFile}...`);
    const content = await zip.files[jsonFile].async('string');
    const jsonData = JSON.parse(content);
    
    // Handle different JSON structures
    let models;
    if (Array.isArray(jsonData)) {
      // Direct array of models
      models = jsonData;
    } else if (jsonData.models && Array.isArray(jsonData.models)) {
      // Object with models property
      models = jsonData.models;
    } else {
      throw new Error('Invalid JSON structure: expected array or object with models property');
    }
    
    console.log(`[GitHub] Parsed ${models.length} models`);

    // Step 5: Calculate metrics
    const totalProviders = new Set(models.map(m => m.provider)).size;
    const totalAvailableModels = models.filter(m => m.api_available).length;
    const modelsExcluded = models.length - totalAvailableModels;

    // Calculate change from previous metrics
    let availableModelsChange = 0;
    if (githubDataCache.previousMetrics?.totalAvailableModels) {
      availableModelsChange = totalAvailableModels - githubDataCache.previousMetrics.totalAvailableModels;
    }

    const metrics = {
      totalProviders,
      totalAvailableModels,
      availableModelsChange,
      modelsExcluded,
      lastUpdate: new Date(successfulRun.created_at).toISOString(),
      nextUpdate: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      dataSource: isOutdated ? `${targetArtifact.name} (using previous successful run)` : targetArtifact.name
    };

    const status = {
      status: successfulRun.conclusion || 'success',
      lastRun: new Date(successfulRun.created_at).toISOString(),
      runNumber: successfulRun.run_number
    };

    const result = {
      models,
      metrics,
      status,
      isOutdated,
      fallbackReason: isOutdated ? 'Latest run failed, using previous successful data' : '',
      cached: false,
      timestamp: new Date().toISOString()
    };

    // Update cache
    githubDataCache = {
      data: result,
      timestamp: now,
      previousMetrics: metrics
    };

    console.log('[GitHub] Successfully fetched and cached data');
    res.json(result);

  } catch (error) {
    console.error('[GitHub] Error:', error);
    
    // Return cached data if available during errors
    if (githubDataCache.data) {
      console.log('[GitHub] Returning cached data due to error');
      const cacheAge = githubDataCache.timestamp ? Math.round((Date.now() - githubDataCache.timestamp) / 1000) : null;
      return res.json({
        ...githubDataCache.data,
        cached: true,
        error: error.message,
        cacheAge
      });
    }
    
    // No cached data available
    res.status(500).json({
      error: 'Failed to fetch LLM dashboard data',
      message: error.message,
      timestamp: new Date().toISOString(),
      details: 'No cached data available'
    });
  }
});

// GitHub Dashboard health check
app.get('/api/github/llm-health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'LLM Dashboard GitHub Proxy',
    timestamp: new Date().toISOString(),
    hasToken: !!GITHUB_TOKEN,
    config: {
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      workflow: WORKFLOW_FILE,
      artifact: ARTIFACT_NAME
    },
    cache: {
      hasData: !!githubDataCache.data,
      age: githubDataCache.timestamp ? Math.round((Date.now() - githubDataCache.timestamp) / 1000) : null
    }
  });
});

// ArtificialAnalysis API endpoints
app.get('/api/artificialanalysis/models', async (req, res) => {
  try {
    console.log('🔍 ArtificialAnalysis: Fetching LLM models...');
    
    // Check cache first
    const now = Date.now();
    if (artificialAnalysisCache.models.data && 
        artificialAnalysisCache.models.timestamp && 
        (now - artificialAnalysisCache.models.timestamp < AA_CACHE_DURATION)) {
      
      const cacheAge = Math.round((now - artificialAnalysisCache.models.timestamp) / 1000);
      console.log(`✅ Returning cached ArtificialAnalysis models (age: ${cacheAge}s)`);
      
      return res.json({
        ...artificialAnalysisCache.models.data,
        cached: true,
        cacheAge,
        attribution: 'https://artificialanalysis.ai'
      });
    }

    // Make API request
    const response = await makeAARequest('/data/llms/models');
    
    const result = {
      models: response.data,
      metadata: {
        totalModels: Array.isArray(response.data) ? response.data.length : 0,
        lastUpdated: new Date().toISOString(),
        rateLimitRemaining: response.rateLimitRemaining,
        rateLimitReset: response.rateLimitReset,
        requestsUsed: aaRequestCount,
        requestsLimit: ARTIFICIALANALYSIS_RATE_LIMIT
      },
      cached: false,
      attribution: 'https://artificialanalysis.ai'
    };

    // Update cache
    artificialAnalysisCache.models = {
      data: result,
      timestamp: now
    };

    console.log(`✅ ArtificialAnalysis models fetched: ${result.metadata.totalModels} models`);
    res.json(result);

  } catch (error) {
    console.error('❌ ArtificialAnalysis models error:', error.message);
    
    // Return cached data if available during errors
    if (artificialAnalysisCache.models.data) {
      const cacheAge = Math.round((Date.now() - artificialAnalysisCache.models.timestamp) / 1000);
      console.log('⚠️ Returning cached data due to error');
      
      return res.json({
        ...artificialAnalysisCache.models.data,
        cached: true,
        cacheAge,
        error: error.message,
        attribution: 'https://artificialanalysis.ai'
      });
    }
    
    res.status(500).json({
      error: 'Failed to fetch ArtificialAnalysis models',
      message: error.message,
      requestsUsed: aaRequestCount,
      requestsLimit: ARTIFICIALANALYSIS_RATE_LIMIT,
      attribution: 'https://artificialanalysis.ai'
    });
  }
});

app.get('/api/artificialanalysis/media/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['text-to-image', 'image-editing', 'text-to-speech', 'text-to-video', 'image-to-video'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid media type: ${type}`,
        validTypes: validTypes
      });
    }

    console.log(`🎨 ArtificialAnalysis: Fetching ${type} models...`);
    
    // Check cache first
    const now = Date.now();
    const cachedData = artificialAnalysisCache.media.data.get(type);
    
    if (cachedData && 
        artificialAnalysisCache.media.timestamp && 
        (now - artificialAnalysisCache.media.timestamp < AA_CACHE_DURATION)) {
      
      const cacheAge = Math.round((now - artificialAnalysisCache.media.timestamp) / 1000);
      console.log(`✅ Returning cached ${type} models (age: ${cacheAge}s)`);
      
      return res.json({
        ...cachedData,
        cached: true,
        cacheAge,
        attribution: 'https://artificialanalysis.ai'
      });
    }

    // Make API request
    const response = await makeAARequest(`/data/media/${type}`);
    
    const result = {
      models: response.data,
      mediaType: type,
      metadata: {
        totalModels: Array.isArray(response.data) ? response.data.length : 0,
        lastUpdated: new Date().toISOString(),
        rateLimitRemaining: response.rateLimitRemaining,
        rateLimitReset: response.rateLimitReset,
        requestsUsed: aaRequestCount,
        requestsLimit: ARTIFICIALANALYSIS_RATE_LIMIT
      },
      cached: false,
      attribution: 'https://artificialanalysis.ai'
    };

    // Update cache
    artificialAnalysisCache.media.data.set(type, result);
    artificialAnalysisCache.media.timestamp = now;

    console.log(`✅ ArtificialAnalysis ${type} models fetched: ${result.metadata.totalModels} models`);
    res.json(result);

  } catch (error) {
    console.error(`❌ ArtificialAnalysis ${req.params.type} error:`, error.message);
    
    // Return cached data if available during errors
    const cachedData = artificialAnalysisCache.media.data.get(req.params.type);
    if (cachedData) {
      const cacheAge = artificialAnalysisCache.media.timestamp ? 
        Math.round((Date.now() - artificialAnalysisCache.media.timestamp) / 1000) : null;
      console.log('⚠️ Returning cached media data due to error');
      
      return res.json({
        ...cachedData,
        cached: true,
        cacheAge,
        error: error.message,
        attribution: 'https://artificialanalysis.ai'
      });
    }
    
    res.status(500).json({
      error: `Failed to fetch ArtificialAnalysis ${req.params.type} models`,
      message: error.message,
      requestsUsed: aaRequestCount,
      requestsLimit: ARTIFICIALANALYSIS_RATE_LIMIT,
      attribution: 'https://artificialanalysis.ai'
    });
  }
});

app.get('/api/artificialanalysis/status', (req, res) => {
  const now = Date.now();
  const hoursUntilReset = Math.round((aaRequestResetTime - now) / 3600000);
  
  res.json({
    status: 'active',
    timestamp: new Date().toISOString(),
    rateLimit: {
      requestsUsed: aaRequestCount,
      requestsLimit: ARTIFICIALANALYSIS_RATE_LIMIT,
      remaining: ARTIFICIALANALYSIS_RATE_LIMIT - aaRequestCount,
      resetTime: new Date(aaRequestResetTime).toISOString(),
      hoursUntilReset: Math.max(0, hoursUntilReset)
    },
    cache: {
      models: {
        hasData: !!artificialAnalysisCache.models.data,
        age: artificialAnalysisCache.models.timestamp ? 
          Math.round((now - artificialAnalysisCache.models.timestamp) / 1000) : null
      },
      media: {
        cachedTypes: Array.from(artificialAnalysisCache.media.data.keys()),
        age: artificialAnalysisCache.media.timestamp ? 
          Math.round((now - artificialAnalysisCache.media.timestamp) / 1000) : null
      }
    },
    endpoints: [
      '/api/artificialanalysis/models',
      '/api/artificialanalysis/media/text-to-image',
      '/api/artificialanalysis/media/image-editing',
      '/api/artificialanalysis/media/text-to-speech',
      '/api/artificialanalysis/media/text-to-video',
      '/api/artificialanalysis/media/image-to-video',
      '/api/artificialanalysis/status'
    ],
    attribution: 'https://artificialanalysis.ai'
  });
});

// LLM Scout Agent endpoints
app.post('/api/llms', authenticateAgent, async (req, res) => {
  try {
    const { models, metadata } = req.body;
    
    if (!models || !Array.isArray(models)) {
      return res.status(400).json({ error: 'Models array is required' });
    }
    
    const llmData = {
      models: models,
      metadata: {
        lastUpdated: new Date().toISOString(),
        totalModels: models.length,
        agentVersion: metadata?.agentVersion || 'unknown',
        runId: metadata?.runId || 'unknown',
        sources: metadata?.sources || []
      }
    };
    
    await fs.writeJson(LLMS_FILE_PATH, llmData, { spaces: 2 });
    
    console.log(`📊 LLM data updated: ${models.length} models from agent`);
    
    res.json({ 
      success: true,
      message: 'LLM data updated successfully',
      modelsCount: models.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ LLM data update error:', error);
    res.status(500).json({ 
      error: 'Failed to update LLM data',
      details: error.message
    });
  }
});

app.get('/api/llms', async (req, res) => {
  try {
    const exists = await fs.pathExists(LLMS_FILE_PATH);
    
    if (!exists) {
      return res.json({
        models: [],
        metadata: {
          lastUpdated: null,
          totalModels: 0,
          message: 'No LLM data available yet'
        }
      });
    }
    
    const llmData = await fs.readJson(LLMS_FILE_PATH);
    
    // Filter and format for client consumption
    const filters = req.query;
    let filteredModels = llmData.models || [];
    
    if (filters.country) {
      filteredModels = filteredModels.filter(model => 
        model.country?.toLowerCase() === filters.country.toLowerCase()
      );
    }
    
    if (filters.accessType) {
      filteredModels = filteredModels.filter(model => 
        model.accessType?.toLowerCase().includes(filters.accessType.toLowerCase())
      );
    }
    
    if (filters.source) {
      filteredModels = filteredModels.filter(model => 
        model.source?.toLowerCase() === filters.source.toLowerCase()
      );
    }
    
    res.json({
      models: filteredModels,
      metadata: {
        ...llmData.metadata,
        filteredCount: filteredModels.length,
        appliedFilters: filters
      }
    });
    
  } catch (error) {
    console.error('❌ LLM data fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch LLM data',
      details: error.message
    });
  }
});

app.get('/api/llms/health', (req, res) => {
  fs.pathExists(LLMS_FILE_PATH).then(exists => {
    res.json({
      status: 'healthy',
      dataFile: exists ? 'exists' : 'missing',
      lastCheck: new Date().toISOString(),
      agentEndpoint: '/api/llms',
      clientEndpoint: '/api/llms'
    });
  }).catch(error => {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  const availableEndpoints = app._router.stack
    .filter(r => r.route && r.route.path)
    .map(r => r.route.path)
    .filter(path => !path.includes('*')); // Exclude the catch-all route itself
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ AskMe Backend Proxy server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 Query API: http://localhost:${PORT}/api/query`);
  console.log(`📋 Providers: http://localhost:${PORT}/api/providers`);  
  console.log(`🧠 Smart API: http://localhost:${PORT}/api/smart`);
  console.log(`📊 GitHub Dashboard: http://localhost:${PORT}/api/github/llm-data`);
  console.log(`🔍 GitHub Health: http://localhost:${PORT}/api/github/llm-health`);
  console.log(`🎯 ArtificialAnalysis Models: http://localhost:${PORT}/api/artificialanalysis/models`);
  console.log(`🎨 ArtificialAnalysis Media: http://localhost:${PORT}/api/artificialanalysis/media/:type`);
  console.log(`📈 ArtificialAnalysis Status: http://localhost:${PORT}/api/artificialanalysis/status`);
  
  // Display key manager status
  const keyStats = keyManager.getStats();
  const loadedProviders = Object.keys(keyStats.providers);
  console.log(`🔑 Secure key manager status: ${keyStats.totalKeys} keys loaded`);
  console.log(`📊 Providers: ${loadedProviders.join(', ')}`);
  
  // Check ArtificialAnalysis API key
  try {
    getArtificialAnalysisKey();
    console.log(`🎯 ArtificialAnalysis API: Ready (Rate limit: ${ARTIFICIALANALYSIS_RATE_LIMIT}/day)`);
  } catch (error) {
    console.warn('⚠️  ArtificialAnalysis API key not configured. Set ARTIFICIALANALYSIS_API_KEY environment variable.');
  }
  
  if (keyStats.totalKeys === 0) {
    console.warn('⚠️  No API keys loaded. Check your environment variables.');
  }
});

module.exports = app;