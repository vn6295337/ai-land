# 🚀 NocoDB + Supabase Setup Guide

Connect NocoDB to your existing Supabase database for visual table editing and management.

## 📋 Prerequisites

- Docker and Docker Compose installed
- Existing Supabase project with `validated_models` table
- Supabase database password

## 🔧 Quick Setup

### 1. Get Your Supabase Database Password

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Navigate to your project → Settings → Database
3. Under "Connection Info", find your database password
4. Copy the connection string or password

### 2. Configure Environment

```bash
# Copy the environment template
cp .env.nocodb .env.local

# Edit with your actual values
nano .env.local
```

**Required values:**
- `SUPABASE_PASSWORD`: Your database password from Supabase
- `JWT_SECRET`: Generate a random 32+ character string

### 3. Start NocoDB

```bash
# Start the containers
docker-compose -f docker-compose-nocodb.yml --env-file .env.local up -d

# Check logs
docker-compose -f docker-compose-nocodb.yml logs -f nocodb
```

### 4. Access NocoDB

1. Open http://localhost:8080
2. Create admin account on first visit
3. NocoDB will automatically connect to your Supabase database

## 📊 Available Tables

Once connected, you'll see these tables from your Supabase database:

### `validated_models` Table
- **Purpose**: AI models validation results from GitHub Actions
- **Columns**: 25+ fields including model info, capabilities, costs
- **Features**: Real-time sync with GitHub workflow data

### Key Fields:
- `model_name`, `provider` - Model identification
- `api_available`, `free_tier` - Availability status  
- `supports_*` fields - Model capabilities
- `validation_timestamp` - Last check time

## 🎯 Use Cases

### 1. **Visual Data Exploration**
- Browse all validated AI models in a spreadsheet-like interface
- Filter by provider, capabilities, or pricing
- Sort by validation date or performance metrics

### 2. **Data Management**
- Edit model metadata directly through the UI
- Add custom fields for tracking internal notes
- Export data to CSV/JSON for analysis

### 3. **Dashboard Creation**
- Create custom views and filters
- Build charts showing model adoption trends
- Share read-only views with team members

### 4. **API Integration**
- Use NocoDB's auto-generated REST/GraphQL APIs
- Connect to external tools and workflows
- Build custom integrations

## 🔒 Security Configuration

### Supabase Connection Security
- Uses SSL/TLS encryption (`sslmode=require`)
- Connects via Supabase's connection pooler
- No direct internet access to database required

### NocoDB Security
- JWT-based authentication
- Admin user controls access
- Row-level security respects Supabase policies

## 🛠️ Advanced Configuration

### Custom Docker Override
Create `docker-compose.override.yml`:

```yaml
version: '3.8'
services:
  nocodb:
    environment:
      # Enable API documentation
      NC_DISABLE_SWAGGER: "false"
      
      # Custom branding
      NC_BRAND_NAME: "AskMe Model Dashboard"
      
      # Performance tuning
      NC_CONNECT_TO_EXTERNAL_DB_DISABLED: "false"
```

### SSL Certificate (Production)
For HTTPS access, add SSL certificates:

```yaml
nocodb:
  volumes:
    - ./ssl/cert.pem:/usr/app/ssl/cert.pem
    - ./ssl/key.pem:/usr/app/ssl/key.pem
  environment:
    NC_SSL_CERT: "/usr/app/ssl/cert.pem"
    NC_SSL_KEY: "/usr/app/ssl/key.pem"
```

## 📈 Monitoring & Maintenance

### Health Checks
```bash
# Check container status
docker-compose -f docker-compose-nocodb.yml ps

# View logs
docker-compose -f docker-compose-nocodb.yml logs nocodb

# Check database connection
docker-compose -f docker-compose-nocodb.yml exec nocodb nc_cli status
```

### Performance Optimization
- Redis caching enabled by default
- PostgreSQL connection pooling via Supabase
- Persistent volumes for data storage

### Backup Strategy
- NocoDB metadata backed up in mounted volumes
- Source data remains in Supabase (already backed up)
- Export custom views and configurations regularly

## 🚨 Troubleshooting

### Connection Issues
```bash
# Test Supabase connection manually
docker run --rm postgres:13 psql "postgres://postgres.pfmsevvxgvofqyrrtojk:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require" -c "SELECT COUNT(*) FROM validated_models;"
```

### Common Problems:

1. **"Connection refused"**
   - Check Supabase password is correct
   - Verify network connectivity
   - Ensure SSL mode is set to `require`

2. **"Table not found"**
   - Run the Supabase sync script first: `node scout-agent/data_migration_&analysis/supabase-sync.js`
   - Check table exists in Supabase dashboard

3. **"Permission denied"**
   - Verify Supabase user has proper permissions
   - Check RLS policies allow access

## 🔗 Integration with Existing Workflow

### Data Flow:
1. **GitHub Actions** → Validates AI models
2. **Supabase Sync Script** → Uploads results to database  
3. **NocoDB** → Provides visual interface for data
4. **Your Analysis** → Export, filter, and analyze via UI

### Next Steps:
- Set up automated syncing with cron jobs
- Create custom dashboards for different stakeholders
- Build API integrations with your existing tools
- Add notification systems for model status changes

---

*🎉 You now have a complete visual interface for your AI model validation data!*