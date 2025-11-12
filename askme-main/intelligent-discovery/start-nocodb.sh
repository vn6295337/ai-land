#!/bin/bash

# NocoDB Startup Script for AskMe Project
echo "🚀 Starting NocoDB with Supabase integration..."

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local not found!"
    echo "📝 Copy .env.nocodb to .env.local and configure your settings:"
    echo "   cp .env.nocodb .env.local"
    echo "   nano .env.local"
    exit 1
fi

# Check for required environment variables
source .env.local

if [ -z "$SUPABASE_PASSWORD" ]; then
    echo "❌ SUPABASE_PASSWORD not set in .env.local"
    echo "📖 Get your password from: https://app.supabase.com/project/settings/database"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "❌ JWT_SECRET not set in .env.local"
    echo "🔑 Generate a random secret: openssl rand -base64 32"
    exit 1
fi

# Start Docker containers
echo "🐳 Starting Docker containers..."
docker-compose -f docker-compose-nocodb.yml --env-file .env.local up -d

# Wait for containers to start
echo "⏳ Waiting for containers to initialize..."
sleep 10

# Check container status
echo "📊 Container status:"
docker-compose -f docker-compose-nocodb.yml ps

# Show connection info
echo ""
echo "✅ NocoDB Setup Complete!"
echo "🌐 Access your dashboard at: http://localhost:8080"
echo ""
echo "📋 Next Steps:"
echo "1. Open http://localhost:8080 in your browser"
echo "2. Create your admin account"
echo "3. NocoDB will automatically connect to Supabase"
echo "4. Look for the 'validated_models' table"
echo ""
echo "🔧 Management Commands:"
echo "  View logs:    docker-compose -f docker-compose-nocodb.yml logs -f nocodb"
echo "  Stop:         docker-compose -f docker-compose-nocodb.yml down"
echo "  Restart:      docker-compose -f docker-compose-nocodb.yml restart nocodb"
echo ""
echo "📚 Full documentation: ./setup-nocodb.md"