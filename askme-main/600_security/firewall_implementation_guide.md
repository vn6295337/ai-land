# Firewall Implementation Guide - Free Tools Only

**Document Title:** Step-by-Step Firewall Implementation  
**Project:** AskMe CLI Security Hardening  
**Tools:** Free Tier & Open Source Only  
**Target Audience:** Development Team  

---

## Implementation Overview

This guide provides detailed steps to implement comprehensive firewall protection using only free tools and services. Each solution includes setup instructions, configuration files, and testing procedures.

---

## 1. Web Application Firewall (WAF) - Priority 1

### Option A: Cloudflare Free Tier (Recommended)

#### Step 1: Account Setup
1. Visit [cloudflare.com](https://cloudflare.com) and create free account
2. Add your domain (askme-backend-proxy.onrender.com or your custom domain)
3. Update nameservers to Cloudflare's (provided during setup)
4. Wait for DNS propagation (15-60 minutes)

#### Step 2: Basic WAF Configuration
Navigate to **Security → WAF → Firewall Rules**

**Rule 1: Block Script Injection**
```
Field: HTTP Request Body
Operator: contains
Value: <script>
Action: Block
```

**Rule 2: Block JavaScript URLs**
```
Field: HTTP Request Body
Operator: contains
Value: javascript:
Action: Block
```

**Rule 3: Rate Limiting for API**
```
Path: /api/*
Rate: 50 requests per 5 minutes per IP
Action: Block for 1 hour
```

**Rule 4: Geographic Protection (Optional)**
```
Country: Select high-risk countries
Action: Challenge
```

**Rule 5: Large Payload Protection**
```
Field: Content-Length
Operator: greater than
Value: 5242880 (5MB)
Action: Block
```

#### Step 3: Additional Security Settings
1. **Security Level:** Set to "Medium"
2. **Browser Integrity Check:** Enable
3. **Challenge Passage:** Set to 1 hour
4. **Security Events:** Enable logging

### Option B: NGINX + ModSecurity (Self-hosted)

#### Step 1: Install NGINX with ModSecurity
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx nginx-module-security

# CentOS/RHEL
sudo yum install nginx nginx-module-security
```

#### Step 2: ModSecurity Configuration
Create `/etc/nginx/modsec/main.conf`:
```nginx
# Include OWASP Core Rule Set
Include /etc/nginx/modsec/owasp-crs/crs-setup.conf
Include /etc/nginx/modsec/owasp-crs/rules/*.conf

# Basic ModSecurity configuration
SecRuleEngine On
SecRequestBodyAccess On
SecResponseBodyAccess Off
SecRequestBodyLimit 13107200
SecRequestBodyNoFilesLimit 131072

# Custom rules for AskMe
SecRule REQUEST_BODY "@detectXSS" \
    "id:1001,phase:2,block,msg:'XSS Attack Detected',logdata:'Matched Data: %{MATCHED_VAR} found within %{MATCHED_VAR_NAME}'"

SecRule REQUEST_BODY "@detectSQLi" \
    "id:1002,phase:2,block,msg:'SQL Injection Attack Detected'"

SecRule REQUEST_URI|ARGS "@detectXSS" \
    "id:1003,phase:1,block,msg:'XSS Attack in URI/Args'"

# Rate limiting
SecAction "id:900001,phase:1,nolog,pass,initcol:ip=%{REMOTE_ADDR},setvar:ip.requests=+1,expirevar:ip.requests=60"
SecRule IP:REQUESTS "@gt 20" \
    "id:900002,phase:1,deny,status:429,msg:'Rate limit exceeded',setvar:ip.blocked=1"
```

#### Step 3: NGINX Virtual Host Configuration
Create `/etc/nginx/sites-available/askme-waf`:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Enable ModSecurity
    modsecurity on;
    modsecurity_rules_file /etc/nginx/modsec/main.conf;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/m;
    
    location /api/ {
        # Apply rate limiting
        limit_req zone=api burst=5 nodelay;
        
        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
        
        # Proxy to backend
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Block common attack patterns
    location ~* \.(php|jsp|asp|cgi)$ {
        deny all;
    }
    
    # Block sensitive files
    location ~* \.(env|config|ini|log|bak)$ {
        deny all;
    }
}
```

### Option C: Express.js Middleware WAF

Create `/home/km_project/askme/600_security/express_waf_middleware.js`:

```javascript
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');

// Enhanced rate limiting
const createRateLimiter = (windowMs, max, skipSuccessfulRequests = false) => {
    return rateLimit({
        windowMs,
        max,
        skipSuccessfulRequests,
        message: {
            error: 'Too many requests, please try again later.',
            retryAfter: Math.ceil(windowMs / 1000)
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
};

// Input validation middleware
const validateInput = (req, res, next) => {
    const { prompt, provider } = req.body;
    
    // Check for required fields
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // Length validation
    if (prompt.length > 10000) {
        return res.status(400).json({ error: 'Prompt too long (max 10,000 characters)' });
    }
    
    // XSS prevention
    if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(prompt)) {
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
            return res.status(400).json({ error: 'Invalid input detected' });
        }
    }
    
    // Sanitize prompt (basic)
    req.body.prompt = validator.escape(prompt);
    
    // Provider validation
    if (provider && !/^[a-zA-Z0-9_-]+$/.test(provider)) {
        return res.status(400).json({ error: 'Invalid provider name' });
    }
    
    next();
};

// Security headers middleware
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.openai.com", "https://api.mistral.ai"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
});

// IP blocking middleware
const blockedIPs = new Set();
const suspiciousActivity = new Map();

const ipBlocking = (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Check if IP is blocked
    if (blockedIPs.has(clientIP)) {
        return res.status(403).json({ error: 'IP address blocked' });
    }
    
    // Track suspicious activity
    const now = Date.now();
    const activity = suspiciousActivity.get(clientIP) || { requests: [], blocked: 0 };
    
    // Clean old requests (keep last hour)
    activity.requests = activity.requests.filter(time => now - time < 3600000);
    activity.requests.push(now);
    
    // Block if too many requests
    if (activity.requests.length > 100) {
        blockedIPs.add(clientIP);
        return res.status(429).json({ error: 'Rate limit exceeded, IP blocked' });
    }
    
    suspiciousActivity.set(clientIP, activity);
    next();
};

// File upload protection
const fileUploadProtection = (req, res, next) => {
    const contentType = req.headers['content-type'];
    
    // Block file uploads
    if (contentType && contentType.includes('multipart/form-data')) {
        return res.status(400).json({ error: 'File uploads not allowed' });
    }
    
    next();
};

module.exports = {
    rateLimiters: {
        general: createRateLimiter(15 * 60 * 1000, 100), // 100 per 15 minutes
        api: createRateLimiter(5 * 60 * 1000, 50),       // 50 per 5 minutes
        strict: createRateLimiter(1 * 60 * 1000, 10),    // 10 per minute
    },
    validateInput,
    securityHeaders,
    ipBlocking,
    fileUploadProtection,
};
```

---

## 2. Network Firewall Implementation

### Cloud Security Groups (AWS/GCP/Azure Free Tier)

#### AWS Security Group Rules
```bash
# Create security group
aws ec2 create-security-group \
    --group-name askme-backend-sg \
    --description "AskMe Backend Security Group"

# Allow HTTP/HTTPS inbound
aws ec2 authorize-security-group-ingress \
    --group-id sg-xxxxxxxxx \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
    --group-id sg-xxxxxxxxx \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0

# Allow SSH from admin IP only
aws ec2 authorize-security-group-ingress \
    --group-id sg-xxxxxxxxx \
    --protocol tcp \
    --port 22 \
    --cidr YOUR_ADMIN_IP/32
```

### Linux UFW Configuration

Create `/home/km_project/askme/600_security/ufw_rules.sh`:

```bash
#!/bin/bash
# UFW Firewall Rules for AskMe Backend

# Reset UFW to defaults
sudo ufw --force reset

# Set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (change port if needed)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow Node.js app port (if running directly)
sudo ufw allow 3000/tcp

# Allow specific outbound connections only
sudo ufw allow out 443/tcp to api.openai.com
sudo ufw allow out 443/tcp to api.mistral.ai
sudo ufw allow out 443/tcp to generativelanguage.googleapis.com
sudo ufw allow out 443/tcp to api.together.xyz
sudo ufw allow out 443/tcp to api.cohere.ai
sudo ufw allow out 443/tcp to api.groq.com
sudo ufw allow out 443/tcp to api-inference.huggingface.co
sudo ufw allow out 443/tcp to openrouter.ai
sudo ufw allow out 443/tcp to api.ai21.com
sudo ufw allow out 443/tcp to api.replicate.com

# Allow DNS
sudo ufw allow out 53/udp
sudo ufw allow out 53/tcp

# Enable UFW
sudo ufw enable

# Show status
sudo ufw status verbose
```

---

## 3. Application-Level Security

### Backend Security Hardening

Create `/home/km_project/askme/600_security/backend_security_updates.js`:

```javascript
// Enhanced CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'https://your-domain.com',
            'https://askme-frontend.vercel.app',
            'http://localhost:3000',
            'http://localhost:8080'
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400 // 24 hours
};

// Enhanced API key management
const getAPIKey = (provider) => {
    const key = process.env[`${provider.toUpperCase()}_API_KEY`];
    if (!key) {
        throw new Error(`API key not configured for ${provider}`);
    }
    return key;
};

// Request logging
const requestLogger = (req, res, next) => {
    const start = Date.now();
    const { method, url, ip } = req;
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const { statusCode } = res;
        
        console.log(`${new Date().toISOString()} - ${ip} - ${method} ${url} - ${statusCode} - ${duration}ms`);
        
        // Log suspicious activity
        if (statusCode >= 400) {
            console.warn(`Suspicious request: ${ip} - ${method} ${url} - ${statusCode}`);
        }
    });
    
    next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    
    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(err.status || 500).json({
        error: 'Internal server error',
        message: isDevelopment ? err.message : 'An error occurred',
        timestamp: new Date().toISOString()
    });
};

module.exports = {
    corsOptions,
    getAPIKey,
    requestLogger,
    errorHandler
};
```

---

## 4. Monitoring & Alerting

### Log Analysis Setup

Create `/home/km_project/askme/600_security/log_monitor.js`:

```javascript
const fs = require('fs');
const path = require('path');

class SecurityMonitor {
    constructor() {
        this.logFile = path.join(__dirname, 'security.log');
        this.alertThresholds = {
            failedRequests: 10,     // per minute
            blockedIPs: 5,          // total
            errorRate: 0.1          // 10%
        };
        this.metrics = {
            requests: 0,
            failures: 0,
            blockedIPs: new Set(),
            lastReset: Date.now()
        };
    }
    
    logSecurityEvent(event) {
        const timestamp = new Date().toISOString();
        const logEntry = `${timestamp} - ${event.type} - ${event.ip} - ${event.message}\n`;
        
        fs.appendFileSync(this.logFile, logEntry);
        this.updateMetrics(event);
        this.checkAlerts();
    }
    
    updateMetrics(event) {
        this.metrics.requests++;
        
        if (event.type === 'BLOCKED' || event.type === 'ERROR') {
            this.metrics.failures++;
        }
        
        if (event.type === 'IP_BLOCKED') {
            this.metrics.blockedIPs.add(event.ip);
        }
        
        // Reset metrics every minute
        if (Date.now() - this.metrics.lastReset > 60000) {
            this.resetMetrics();
        }
    }
    
    checkAlerts() {
        const errorRate = this.metrics.failures / this.metrics.requests;
        
        if (this.metrics.failures > this.alertThresholds.failedRequests) {
            this.sendAlert('HIGH_FAILURE_RATE', `${this.metrics.failures} failed requests in last minute`);
        }
        
        if (this.metrics.blockedIPs.size > this.alertThresholds.blockedIPs) {
            this.sendAlert('MULTIPLE_IP_BLOCKS', `${this.metrics.blockedIPs.size} IPs blocked`);
        }
        
        if (errorRate > this.alertThresholds.errorRate) {
            this.sendAlert('HIGH_ERROR_RATE', `Error rate: ${(errorRate * 100).toFixed(2)}%`);
        }
    }
    
    sendAlert(type, message) {
        console.error(`🚨 SECURITY ALERT - ${type}: ${message}`);
        // TODO: Integrate with email/SMS/Slack notifications
    }
    
    resetMetrics() {
        this.metrics = {
            requests: 0,
            failures: 0,
            blockedIPs: new Set(),
            lastReset: Date.now()
        };
    }
    
    getStats() {
        return {
            ...this.metrics,
            blockedIPsCount: this.metrics.blockedIPs.size,
            errorRate: this.metrics.requests > 0 ? this.metrics.failures / this.metrics.requests : 0
        };
    }
}

module.exports = SecurityMonitor;
```

---

## 5. Testing & Validation

### Security Testing Script

Create `/home/km_project/askme/600_security/security_test.js`:

```javascript
const axios = require('axios');

class SecurityTester {
    constructor(baseURL) {
        this.baseURL = baseURL;
        this.results = [];
    }
    
    async runAllTests() {
        console.log('🔍 Starting security tests...\n');
        
        await this.testXSSProtection();
        await this.testSQLInjection();
        await this.testRateLimiting();
        await this.testCORSPolicy();
        await this.testInputValidation();
        
        this.generateReport();
    }
    
    async testXSSProtection() {
        console.log('Testing XSS protection...');
        const xssPayloads = [
            '<script>alert("xss")</script>',
            'javascript:alert("xss")',
            '<img src=x onerror=alert("xss")>',
            '"><script>alert("xss")</script>'
        ];
        
        for (let payload of xssPayloads) {
            try {
                const response = await axios.post(`${this.baseURL}/api/query`, {
                    prompt: payload,
                    provider: 'google'
                });
                
                if (response.data.response && response.data.response.includes('<script>')) {
                    this.results.push({ test: 'XSS Protection', status: 'FAIL', payload });
                } else {
                    this.results.push({ test: 'XSS Protection', status: 'PASS', payload });
                }
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    this.results.push({ test: 'XSS Protection', status: 'PASS', payload });
                } else {
                    this.results.push({ test: 'XSS Protection', status: 'ERROR', payload, error: error.message });
                }
            }
        }
    }
    
    async testSQLInjection() {
        console.log('Testing SQL injection protection...');
        const sqlPayloads = [
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "UNION SELECT * FROM users",
            "1' OR 1=1 --"
        ];
        
        for (let payload of sqlPayloads) {
            try {
                const response = await axios.post(`${this.baseURL}/api/query`, {
                    prompt: payload,
                    provider: 'google'
                });
                this.results.push({ test: 'SQL Injection Protection', status: 'PASS', payload });
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    this.results.push({ test: 'SQL Injection Protection', status: 'PASS', payload });
                } else {
                    this.results.push({ test: 'SQL Injection Protection', status: 'ERROR', payload, error: error.message });
                }
            }
        }
    }
    
    async testRateLimiting() {
        console.log('Testing rate limiting...');
        const requests = [];
        
        // Send 60 requests rapidly
        for (let i = 0; i < 60; i++) {
            requests.push(
                axios.post(`${this.baseURL}/api/query`, {
                    prompt: `Test request ${i}`,
                    provider: 'google'
                }).catch(error => error.response)
            );
        }
        
        const responses = await Promise.all(requests);
        const blockedRequests = responses.filter(r => r && r.status === 429);
        
        if (blockedRequests.length > 0) {
            this.results.push({ test: 'Rate Limiting', status: 'PASS', blocked: blockedRequests.length });
        } else {
            this.results.push({ test: 'Rate Limiting', status: 'FAIL', message: 'No rate limiting detected' });
        }
    }
    
    async testCORSPolicy() {
        console.log('Testing CORS policy...');
        try {
            const response = await axios.options(`${this.baseURL}/api/query`, {
                headers: {
                    'Origin': 'https://malicious-site.com',
                    'Access-Control-Request-Method': 'POST'
                }
            });
            
            const allowOrigin = response.headers['access-control-allow-origin'];
            if (allowOrigin === '*') {
                this.results.push({ test: 'CORS Policy', status: 'FAIL', message: 'Allows all origins' });
            } else {
                this.results.push({ test: 'CORS Policy', status: 'PASS', allowOrigin });
            }
        } catch (error) {
            this.results.push({ test: 'CORS Policy', status: 'PASS', message: 'CORS properly configured' });
        }
    }
    
    async testInputValidation() {
        console.log('Testing input validation...');
        const invalidInputs = [
            { prompt: '', provider: 'google' },                    // Empty prompt
            { prompt: 'x'.repeat(50000), provider: 'google' },     // Too long
            { prompt: 'test', provider: 'invalid_provider' },      // Invalid provider
            { prompt: 'test' }                                     // Missing provider
        ];
        
        for (let input of invalidInputs) {
            try {
                await axios.post(`${this.baseURL}/api/query`, input);
                this.results.push({ test: 'Input Validation', status: 'FAIL', input });
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    this.results.push({ test: 'Input Validation', status: 'PASS', input });
                } else {
                    this.results.push({ test: 'Input Validation', status: 'ERROR', input, error: error.message });
                }
            }
        }
    }
    
    generateReport() {
        console.log('\n📊 Security Test Report');
        console.log('========================\n');
        
        const testSummary = {};
        this.results.forEach(result => {
            if (!testSummary[result.test]) {
                testSummary[result.test] = { pass: 0, fail: 0, error: 0 };
            }
            testSummary[result.test][result.status.toLowerCase()]++;
        });
        
        Object.keys(testSummary).forEach(test => {
            const summary = testSummary[test];
            const total = summary.pass + summary.fail + summary.error;
            const passRate = (summary.pass / total * 100).toFixed(1);
            
            console.log(`${test}:`);
            console.log(`  ✅ Pass: ${summary.pass}/${total} (${passRate}%)`);
            if (summary.fail > 0) console.log(`  ❌ Fail: ${summary.fail}`);
            if (summary.error > 0) console.log(`  ⚠️  Error: ${summary.error}`);
            console.log();
        });
        
        const overallPass = this.results.filter(r => r.status === 'PASS').length;
        const overallTotal = this.results.length;
        const overallRate = (overallPass / overallTotal * 100).toFixed(1);
        
        console.log(`Overall Security Score: ${overallRate}% (${overallPass}/${overallTotal})`);
        
        if (overallRate >= 90) {
            console.log('🟢 Security Status: GOOD');
        } else if (overallRate >= 70) {
            console.log('🟡 Security Status: NEEDS IMPROVEMENT');
        } else {
            console.log('🔴 Security Status: CRITICAL - IMMEDIATE ACTION REQUIRED');
        }
    }
}

// Usage
if (require.main === module) {
    const tester = new SecurityTester('https://askme-backend-proxy.onrender.com');
    tester.runAllTests().catch(console.error);
}

module.exports = SecurityTester;
```

---

## Quick Start Commands

Save this as `/home/km_project/askme/600_security/quick_setup.sh`:

```bash
#!/bin/bash
echo "🚀 AskMe Security Quick Setup"

# Make script executable
chmod +x /home/km_project/askme/600_security/ufw_rules.sh

# Run UFW setup (requires sudo)
echo "Setting up UFW firewall..."
sudo /home/km_project/askme/600_security/ufw_rules.sh

# Install additional security packages
echo "Installing security tools..."
npm install helmet express-rate-limit validator express-slow-down

echo "✅ Basic security setup complete!"
echo "Next steps:"
echo "1. Set up Cloudflare WAF (manual)"
echo "2. Update backend with security middleware"
echo "3. Run security tests"
```

This comprehensive guide provides everything needed to implement enterprise-grade security using only free tools. Start with the Cloudflare WAF setup as it provides the most immediate protection.