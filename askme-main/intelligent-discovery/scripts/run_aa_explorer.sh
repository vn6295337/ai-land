#!/bin/bash

# ArtificialAnalysis API Explorer Runner
# This script runs the Python explorer to discover available ArtificialAnalysis services

echo "🚀 Starting ArtificialAnalysis API Exploration..."
echo "================================================"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed. Please install Python3 to continue."
    exit 1
fi

# Check if requests library is available
python3 -c "import requests" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📦 Installing required Python packages..."
    pip3 install requests --user 2>/dev/null || {
        echo "⚠️  Could not install requests. Attempting to run anyway..."
    }
fi

# Run the explorer
echo "🔍 Running ArtificialAnalysis API exploration..."
cd "$(dirname "$0")"
python3 artificialanalysis_explorer.py

echo ""
echo "✅ Exploration complete!"
echo "📁 Check the generated JSON report for detailed results."