#!/bin/bash
# NocoDB Setup for Supabase Visual Editing
# Run this to get Airtable-like interface for your validated_models table

echo "🚀 Setting up NocoDB for Supabase visual editing..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js required. Install with: sudo apt install nodejs npm"
    exit 1
fi

# Create NocoDB directory
mkdir -p nocodb-supabase
cd nocodb-supabase

# Install NocoDB
echo "📦 Installing NocoDB..."
npx create-nocodb-app@latest supabase-editor

echo "✅ NocoDB installed!"
echo ""
echo "🔧 Next steps:"
echo "1. cd nocodb-supabase/supabase-editor"
echo "2. npm start"
echo "3. Open http://localhost:8080"
echo "4. Connect to Supabase:"
echo "   - Host: db.pfmsevvxgvofqyrrtojk.supabase.co"
echo "   - Port: 5432"
echo "   - Database: postgres"
echo "   - Username: postgres"
echo "   - Password: [your Supabase password]"
echo ""
echo "📊 You'll get an Airtable-like interface for your validated_models table!"