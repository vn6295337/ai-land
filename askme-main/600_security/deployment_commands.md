# Deploy Security Updates to Render

## Method 1: Git Deployment (Recommended)

```bash
# Navigate to your backend directory
cd /path/to/your/askme-backend/

# Check current status
git status

# Add the updated server.js
git add server.js

# Commit with descriptive message
git commit -m "🔒 Add comprehensive security middleware

Security Features Added:
- Secure key manager (API keys cleared from process.env)
- Input validation (XSS, SQL injection, command injection)
- Security headers (X-Frame-Options, X-XSS-Protection, etc.)
- Attack pattern detection and logging
- Security monitoring endpoint

Addresses critical vulnerabilities:
- API key exposure prevention
- Cross-site scripting attacks
- SQL injection attempts
- Command injection attempts
- Malicious payload detection"

# Push to trigger Render auto-deployment
git push origin main
```

## Method 2: Manual Deployment

If not using Git:
1. Copy the updated `server.js` file
2. Upload to your Render service via dashboard
3. Trigger manual deployment

## Method 3: Render CLI (if installed)

```bash
# Deploy directly via Render CLI
render deploy --service-id your-service-id
```

## After Deployment

1. Check Render logs for security initialization messages
2. Run the security test script
3. Monitor for security events

Expected log messages:
```
🔐 Initializing secure key management...
✅ Loaded google key (abc12345...)
✅ Loaded mistral key (def67890...)
🔑 Secure key manager status: X keys loaded
```