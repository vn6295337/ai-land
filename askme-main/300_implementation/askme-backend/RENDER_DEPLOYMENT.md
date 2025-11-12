# AskMe Backend - Render Deployment Guide

## Prerequisites

- GitHub account
- Render account (free tier available at https://render.com)
- Environment variables ready:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `GEMINI_API_KEY` (for Google provider)
  - `GROQ_API_KEY` (for Groq provider)
  - `OPENROUTER_API_KEY` (for OpenRouter provider)

## Deployment Steps

### Option 1: Automatic Deploy (Recommended)

1. **Push code to GitHub:**
   ```bash
   cd /home/km_project/askme-main/300_implementation/askme-backend
   git init
   git add .
   git commit -m "Initial backend setup for Render deployment"
   git branch -M main
   git remote add origin https://github.com/vn6295337/askme-backend.git
   git push -u origin main
   ```

2. **Connect to Render:**
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repository: `vn6295337/askme-backend`
   - Render will auto-detect `render.yaml` configuration

3. **Configure Environment Variables:**
   - In Render dashboard, go to Environment tab
   - Add the following variables:
     ```
     SUPABASE_URL=https://atilxlecbaqcksnrgzav.supabase.co
     SUPABASE_ANON_KEY=<your_anon_key>
     GEMINI_API_KEY=<your_gemini_key>
     GROQ_API_KEY=<your_groq_key>
     OPENROUTER_API_KEY=<your_openrouter_key>
     ```

4. **Deploy:**
   - Click "Create Web Service"
   - Render will automatically build and deploy
   - Deployment URL: `https://askme-backend.onrender.com`

### Option 2: Manual Blueprint Deploy

1. **Upload render.yaml to GitHub**

2. **Create New Blueprint Instance:**
   - Dashboard → "New +" → "Blueprint"
   - Select repository
   - Render reads render.yaml and creates service

3. **Add environment variables** as in Option 1

## Verify Deployment

Once deployed, test the endpoints:

```bash
# Health check
curl https://askme-backend.onrender.com/health

# Get models from Supabase
curl https://askme-backend.onrender.com/api/models

# Test query with Google provider
curl -X POST https://askme-backend.onrender.com/api/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Say hello in 5 words", "provider": "google"}'
```

Expected responses:
- `/health`: `{"status":"healthy",...}`
- `/api/models`: List of 75 models from ai_models_main
- `/api/query`: AI response from Google/Groq/OpenRouter

## Backend Endpoints

### GET /health
Health check with security and key manager status

### GET /api/models
Query ai_models_main table (shared with discoverer and ai-land)
- Query params: `provider`, `modelId`

### POST /api/query
Execute AI query with provider fallback
- Body: `{"prompt": "...", "provider": "google|groq|openrouter", "model": "..."}`
- Provider fallback: Google → Groq → OpenRouter (if no provider specified)

### GET /api/providers
List all available providers and their status

## Environment Variables on Render

Set in Dashboard → Environment tab:

| Variable | Value | Description |
|----------|-------|-------------|
| NODE_ENV | production | Production mode |
| PORT | 10000 | Render default port (auto-set) |
| SUPABASE_URL | https://atilxlecbaqcksnrgzav.supabase.co | Supabase project URL |
| SUPABASE_ANON_KEY | eyJhbGci... | Supabase anon key |
| GEMINI_API_KEY | AIzaSy... | Google Gemini API key |
| GROQ_API_KEY | gsk_... | Groq API key |
| OPENROUTER_API_KEY | sk-or-v1-... | OpenRouter API key |

## Free Tier Limitations

Render Free Tier:
- 750 hours/month (sufficient for 1 service 24/7)
- Spins down after 15 min inactivity
- Cold start: ~30 seconds
- No custom domains on free tier

## Monitoring

- **Logs**: Dashboard → Logs tab
- **Metrics**: Dashboard → Metrics tab (CPU, memory, requests)
- **Health**: Check `/health` endpoint every 5 minutes to prevent spin-down

## Troubleshooting

### Service won't start
- Check logs in Render dashboard
- Verify all environment variables are set
- Ensure `package.json` has all dependencies

### Supabase connection fails
- Verify SUPABASE_URL and SUPABASE_ANON_KEY
- Test connection: `curl <SUPABASE_URL>/rest/v1/ai_models_main?select=count`

### Provider API fails
- Check API keys are valid
- Verify rate limits not exceeded
- Review logs for specific error messages

## Auto-Deploy on Push

Render automatically redeploys on every push to main branch.

To disable:
- Dashboard → Settings → Auto-Deploy: OFF

## Custom Domain (Paid Plan)

To use custom domain:
1. Upgrade to paid plan ($7/month)
2. Dashboard → Settings → Custom Domain
3. Add CNAME record: `backend.askme.com` → `askme-backend.onrender.com`

---

**Created**: 2025-11-12
**Status**: Ready for deployment
