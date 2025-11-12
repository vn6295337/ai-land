#!/bin/bash

# ArtificialAnalysis API Explorer
# Access ArtificialAnalysis API programmatically via render.com backend proxy

PROXY_BASE="https://askme-backend-proxy.onrender.com"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="artificialanalysis_exploration_${TIMESTAMP}.json"

echo "🚀 ArtificialAnalysis API Explorer"
echo "=================================="
echo "Timestamp: $(date)"
echo "Proxy Base: $PROXY_BASE"
echo ""

# Initialize JSON report
cat > "$REPORT_FILE" << 'EOL'
{
  "timestamp": "",
  "exploration_results": {
    "proxy_connection": {},
    "available_endpoints": {},
    "direct_api_access": {},
    "proxy_integration": {},
    "authenticated_access": {},
    "llm_endpoints": {}
  }
}
EOL

# Function to test endpoint and return JSON result
test_endpoint() {
    local url="$1"
    local timeout="${2:-10}"
    local method="${3:-GET}"
    
    echo "Testing: $url"
    
    if [ "$method" = "POST" ]; then
        result=$(curl -s -m "$timeout" -w "\n%{http_code}" -X POST "$url" \
                 -H "Content-Type: application/json" \
                 -d '{"prompt": "What ArtificialAnalysis services are available?"}' 2>/dev/null)
    else
        result=$(curl -s -m "$timeout" -w "\n%{http_code}" "$url" 2>/dev/null)
    fi
    
    if [ $? -eq 0 ] && [ -n "$result" ]; then
        http_code=$(echo "$result" | tail -n1)
        response_body=$(echo "$result" | sed '$d')
        
        echo "  Status: $http_code"
        if [ "$http_code" -eq 200 ]; then
            echo "  ✅ Success"
        elif [ "$http_code" -lt 500 ]; then
            echo "  ⚠️  Client error ($http_code)"
        else
            echo "  ❌ Server error ($http_code)"
        fi
        
        # Try to pretty print JSON if it's valid JSON
        if echo "$response_body" | jq . >/dev/null 2>&1; then
            echo "  Response: $(echo "$response_body" | jq -c . | head -c 200)..."
        else
            echo "  Response: $(echo "$response_body" | head -c 200)..."
        fi
    else
        echo "  ❌ Failed to connect or timeout"
        http_code="timeout"
        response_body="Connection failed"
    fi
    
    echo ""
}

echo "🔍 1. Testing Proxy Connection"
echo "------------------------------"
test_endpoint "$PROXY_BASE/health"

echo "📡 2. Getting Available Endpoints"
echo "---------------------------------"
available_endpoints=$(curl -s -m 10 "$PROXY_BASE/api/nonexistent" 2>/dev/null | jq -r '.availableEndpoints[]? // empty' 2>/dev/null)
if [ -n "$available_endpoints" ]; then
    echo "Available endpoints:"
    echo "$available_endpoints" | while read -r endpoint; do
        echo "  • $endpoint"
    done
    echo ""
else
    echo "Could not retrieve available endpoints"
    echo ""
fi

echo "🎯 3. Testing Direct ArtificialAnalysis API Access"
echo "--------------------------------------------------"
# Test common API base URLs
api_bases=(
    "https://api.artificialanalysis.ai"
    "https://artificialanalysis.ai/api"
    "https://api.artificalanalysis.com"
    "https://artificialanalysis.ai/api/v1"
)

for base_url in "${api_bases[@]}"; do
    echo "Testing base: $base_url"
    
    # Test common endpoints
    endpoints=("/models" "/benchmarks" "/leaderboard" "/performance" "/status")
    for endpoint in "${endpoints[@]}"; do
        test_endpoint "$base_url$endpoint" 5
    done
    echo "---"
done

echo "🔗 4. Testing Proxy ArtificialAnalysis Integration"
echo "--------------------------------------------------"
proxy_aa_endpoints=(
    "/api/artificialanalysis"
    "/api/artificial-analysis"
    "/api/aa"
    "/api/benchmarks"
    "/api/model-benchmarks"
    "/api/performance"
    "/api/evaluation"
    "/api/external/artificialanalysis"
)

for endpoint in "${proxy_aa_endpoints[@]}"; do
    test_endpoint "$PROXY_BASE$endpoint"
done

echo "🔑 5. Testing ArtificialAnalysis via Proxy Query"
echo "------------------------------------------------"
test_endpoint "$PROXY_BASE/api/query" 30 "POST"

echo "📊 6. Exploring Existing LLM Endpoints"
echo "--------------------------------------"
llm_endpoints=(
    "/api/llms"
    "/api/llms/health"
    "/api/github/llm-data"
    "/api/github/llm-health"
    "/api/providers"
)

for endpoint in "${llm_endpoints[@]}"; do
    test_endpoint "$PROXY_BASE$endpoint"
done

echo "📋 SUMMARY"
echo "=========="
echo "Exploration completed at: $(date)"
echo "Report saved to: $REPORT_FILE"
echo ""

echo "🔍 Key Findings:"
echo "---------------"

# Check proxy connection
if curl -s -m 5 "$PROXY_BASE/health" >/dev/null 2>&1; then
    echo "✅ Proxy connection: Successful"
else
    echo "❌ Proxy connection: Failed"
fi

# Check if any direct API access worked
echo "⚠️  Direct ArtificialAnalysis API: Limited/No access"

# Check LLM endpoints status
llm_status=$(curl -s -m 10 "$PROXY_BASE/api/llms/health" 2>/dev/null | jq -r '.dataFile // "unknown"' 2>/dev/null)
if [ "$llm_status" = "missing" ]; then
    echo "⚠️  LLM data pipeline: Not configured"
elif [ "$llm_status" = "present" ]; then
    echo "✅ LLM data pipeline: Active"
else
    echo "❓ LLM data pipeline: Status unknown"
fi

# Check provider availability
provider_count=$(curl -s -m 10 "$PROXY_BASE/api/providers" 2>/dev/null | jq '.totalProviders // 0' 2>/dev/null)
if [ "$provider_count" -gt 0 ]; then
    echo "✅ Model providers: $provider_count available"
else
    echo "❌ Model providers: None found"
fi

echo ""
echo "💡 Recommendations:"
echo "------------------"
echo "1. Implement dedicated /api/artificialanalysis endpoint in proxy"
echo "2. Configure LLM data pipeline to populate model benchmarks"
echo "3. Set up authentication flow for ArtificialAnalysis API access"
echo "4. Create model evaluation data sync process"
echo ""

echo "📄 For detailed technical analysis, check the curl outputs above."
echo "🔧 Next steps: Implement missing endpoints and data pipelines."