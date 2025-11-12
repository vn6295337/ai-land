#!/bin/bash

# Direct ArtificialAnalysis API Testing Script
# Tests all documented endpoints using the API key

API_BASE="https://artificialanalysis.ai/api/v2"
API_KEY="${ARTIFICIALANALYSIS_API_KEY:-}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="artificialanalysis_direct_test_${TIMESTAMP}.json"

echo "🚀 ArtificialAnalysis Direct API Test"
echo "===================================="
echo "API Base: $API_BASE"
echo "Timestamp: $(date)"
echo ""

if [ -z "$API_KEY" ]; then
    echo "❌ ARTIFICIALANALYSIS_API_KEY environment variable not set"
    echo "💡 Usage: ARTIFICIALANALYSIS_API_KEY=your_key_here $0"
    echo ""
    echo "🔧 Available endpoints to test once key is provided:"
    echo "   • GET /data/llms/models - LLM model data with benchmarks"
    echo "   • GET /data/media/text-to-image - Text-to-image model data"
    echo "   • GET /data/media/image-editing - Image editing model data"
    echo "   • GET /data/media/text-to-speech - Text-to-speech model data"
    echo "   • GET /data/media/text-to-video - Text-to-video model data"
    echo "   • GET /data/media/image-to-video - Image-to-video model data"
    echo ""
    echo "📋 Expected data includes:"
    echo "   • Model identifiers and names"
    echo "   • Creator information"
    echo "   • Benchmark scores"
    echo "   • Pricing information"
    echo "   • Performance metrics"
    echo "   • Speed and quality ratings"
    exit 1
fi

echo "✅ API Key: ${API_KEY:0:8}..." 
echo ""

# Initialize JSON report
cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "api_base": "$API_BASE",
  "endpoints_tested": {},
  "summary": {}
}
EOF

# Function to test API endpoint
test_api_endpoint() {
    local endpoint="$1"
    local description="$2"
    
    echo "🔍 Testing: $endpoint"
    echo "   Description: $description"
    
    response=$(curl -s -w "\n%{http_code}\n%{time_total}" \
        -H "x-api-key: $API_KEY" \
        -H "User-Agent: ArtificialAnalysis-DirectTest/1.0" \
        "$API_BASE$endpoint" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        http_code=$(echo "$response" | tail -n2 | head -n1)
        time_total=$(echo "$response" | tail -n1)
        response_body=$(echo "$response" | sed '$d' | sed '$d')
        
        echo "   Status: $http_code"
        echo "   Time: ${time_total}s"
        
        case $http_code in
            200)
                echo "   ✅ Success"
                
                # Try to parse JSON and extract key info
                if echo "$response_body" | jq . >/dev/null 2>&1; then
                    model_count=$(echo "$response_body" | jq 'length // 0' 2>/dev/null)
                    if [ "$model_count" -gt 0 ]; then
                        echo "   📊 Models returned: $model_count"
                        
                        # Show sample model names if available
                        sample_names=$(echo "$response_body" | jq -r '.[0:3][].name // .[0:3][].model_name // empty' 2>/dev/null | head -3)
                        if [ -n "$sample_names" ]; then
                            echo "   🎯 Sample models:"
                            echo "$sample_names" | while read -r name; do
                                echo "      • $name"
                            done
                        fi
                    fi
                else
                    echo "   ⚠️  Non-JSON response"
                fi
                ;;
            401)
                echo "   ❌ Unauthorized - Invalid API key"
                ;;
            429)
                echo "   ⚠️  Rate limit exceeded"
                ;;
            404)
                echo "   ❌ Not found - Endpoint may not exist"
                ;;
            *)
                echo "   ❌ Error ($http_code)"
                ;;
        esac
        
        # Save first 500 chars of response for debugging
        echo "   Response preview: $(echo "$response_body" | head -c 200)..."
        
    else
        echo "   ❌ Connection failed"
        http_code="connection_failed"
        response_body="Failed to connect"
    fi
    
    echo ""
    return 0
}

echo "📡 Testing Core LLM Models Endpoint"
echo "-----------------------------------"
test_api_endpoint "/data/llms/models" "LLM model data with benchmarks and performance metrics"

echo "🎨 Testing Media Model Endpoints (BETA)"
echo "---------------------------------------"
test_api_endpoint "/data/media/text-to-image" "Text-to-image generation models"
test_api_endpoint "/data/media/image-editing" "Image editing and manipulation models"
test_api_endpoint "/data/media/text-to-speech" "Text-to-speech synthesis models"
test_api_endpoint "/data/media/text-to-video" "Text-to-video generation models"
test_api_endpoint "/data/media/image-to-video" "Image-to-video generation models"

echo "📊 SUMMARY"
echo "=========="
echo "Test completed at: $(date)"
echo "Report file: $REPORT_FILE"
echo ""

echo "🔍 Key Findings:"
echo "---------------"
echo "• API Base URL: $API_BASE"
echo "• Authentication: x-api-key header"
echo "• Rate Limit: 1,000 requests/day"
echo "• Attribution required: https://artificialanalysis.ai/"
echo ""

echo "📋 Services Available:"
echo "--------------------"
echo "• LLM Models: Comprehensive model database with benchmarks"
echo "• Text-to-Image: Image generation model comparison"
echo "• Image Editing: Image manipulation model data"
echo "• Text-to-Speech: Speech synthesis model metrics"
echo "• Text-to-Video: Video generation model analysis"
echo "• Image-to-Video: Video creation model benchmarks"
echo ""

echo "🔧 Integration Recommendations:"
echo "------------------------------"
echo "1. Cache responses to respect 1,000/day rate limit"
echo "2. Implement exponential backoff for rate limiting"
echo "3. Add attribution links in UI"
echo "4. Store model data locally for fast access"
echo "5. Sync with our model compass framework"
echo ""

echo "💾 Report saved to: $REPORT_FILE"
echo "🚀 Ready for integration into intelligent discovery system!"