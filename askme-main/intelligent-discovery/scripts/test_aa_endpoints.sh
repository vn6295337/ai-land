#!/bin/bash

# Test ArtificialAnalysis API Endpoints
# Tests the newly configured endpoints in the backend server

BACKEND_URL="${1:-https://askme-backend-proxy.onrender.com}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="aa_endpoints_test_${TIMESTAMP}.log"

echo "🧪 Testing ArtificialAnalysis API Endpoints"
echo "============================================"
echo "Backend URL: $BACKEND_URL"
echo "Timestamp: $(date)"
echo "Report: $REPORT_FILE"
echo ""

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    local description="$3"
    
    echo "🔍 Testing: $name"
    echo "   URL: $url"
    echo "   Description: $description"
    
    response=$(curl -s -w "\n%{http_code}\n%{time_total}" "$url" 2>/dev/null)
    
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
                    # Check for models count
                    model_count=$(echo "$response_body" | jq '.metadata.totalModels // (.models | length) // 0' 2>/dev/null)
                    if [ "$model_count" -gt 0 ]; then
                        echo "   📊 Models: $model_count"
                    fi
                    
                    # Check for cache status
                    cached=$(echo "$response_body" | jq '.cached // false' 2>/dev/null)
                    if [ "$cached" = "true" ]; then
                        cache_age=$(echo "$response_body" | jq '.cacheAge // 0' 2>/dev/null)
                        echo "   🔄 Cached (age: ${cache_age}s)"
                    fi
                    
                    # Check for rate limit info
                    requests_used=$(echo "$response_body" | jq '.metadata.requestsUsed // .rateLimit.requestsUsed // null' 2>/dev/null)
                    if [ "$requests_used" != "null" ] && [ "$requests_used" != "" ]; then
                        requests_limit=$(echo "$response_body" | jq '.metadata.requestsLimit // .rateLimit.requestsLimit // null' 2>/dev/null)
                        echo "   🎯 Rate limit: ${requests_used}/${requests_limit}"
                    fi
                    
                    # Check for attribution
                    attribution=$(echo "$response_body" | jq -r '.attribution // null' 2>/dev/null)
                    if [ "$attribution" != "null" ] && [ "$attribution" != "" ]; then
                        echo "   🔗 Attribution: $attribution"
                    fi
                else
                    echo "   ⚠️  Non-JSON response"
                fi
                
                echo "   Preview: $(echo "$response_body" | head -c 200)..."
                ;;
            401)
                echo "   ❌ Unauthorized - Check API key configuration"
                ;;
            429)
                echo "   ⚠️  Rate limit exceeded"
                ;;
            404)
                echo "   ❌ Not found - Endpoint may not be configured"
                ;;
            500)
                echo "   ❌ Server error"
                if echo "$response_body" | jq . >/dev/null 2>&1; then
                    error_message=$(echo "$response_body" | jq -r '.message // .error // "Unknown error"' 2>/dev/null)
                    echo "   Error: $error_message"
                fi
                ;;
            *)
                echo "   ❌ Unexpected status ($http_code)"
                ;;
        esac
        
    else
        echo "   ❌ Connection failed"
    fi
    
    echo ""
    
    # Log to report file
    echo "[$name] $http_code - $url - $(date)" >> "$REPORT_FILE"
}

echo "📊 Testing ArtificialAnalysis Status Endpoint"
echo "--------------------------------------------"
test_endpoint "AA Status" "$BACKEND_URL/api/artificialanalysis/status" "Rate limits and cache status"

echo "🎯 Testing ArtificialAnalysis LLM Models Endpoint" 
echo "------------------------------------------------"
test_endpoint "AA Models" "$BACKEND_URL/api/artificialanalysis/models" "LLM model benchmarks and data"

echo "🎨 Testing ArtificialAnalysis Media Endpoints"
echo "--------------------------------------------"
test_endpoint "Text-to-Image" "$BACKEND_URL/api/artificialanalysis/media/text-to-image" "Text-to-image generation models"
test_endpoint "Image Editing" "$BACKEND_URL/api/artificialanalysis/media/image-editing" "Image editing models"
test_endpoint "Text-to-Speech" "$BACKEND_URL/api/artificialanalysis/media/text-to-speech" "Speech synthesis models"
test_endpoint "Text-to-Video" "$BACKEND_URL/api/artificialanalysis/media/text-to-video" "Video generation models"
test_endpoint "Image-to-Video" "$BACKEND_URL/api/artificialanalysis/media/image-to-video" "Video creation models"

echo "❌ Testing Invalid Media Type"
echo "-----------------------------"
test_endpoint "Invalid Media" "$BACKEND_URL/api/artificialanalysis/media/invalid-type" "Should return 400 error"

echo "🔧 Testing Backend Health"
echo "------------------------"
test_endpoint "Health Check" "$BACKEND_URL/health" "Overall backend health"

echo "📋 SUMMARY"
echo "=========="
echo "Test completed at: $(date)"
echo "Report file: $REPORT_FILE"
echo ""

# Count results from report
success_count=$(grep -c "200" "$REPORT_FILE" 2>/dev/null || echo "0")
error_count=$(grep -c -E "(404|500|401|429)" "$REPORT_FILE" 2>/dev/null || echo "0") 
total_tests=$(wc -l < "$REPORT_FILE" 2>/dev/null || echo "0")

echo "🔍 Test Results:"
echo "   ✅ Successful: $success_count"
echo "   ❌ Errors: $error_count"
echo "   📊 Total: $total_tests"
echo ""

if [ "$success_count" -gt 0 ]; then
    echo "✅ ArtificialAnalysis endpoints are working!"
else
    echo "❌ No endpoints are working. Check:"
    echo "   1. ARTIFICIALANALYSIS_API_KEY environment variable"
    echo "   2. Backend server is running"
    echo "   3. Network connectivity"
fi

echo ""
echo "💡 Next Steps:"
echo "   1. Verify API key is set in render.com environment"
echo "   2. Check server logs for detailed error messages"
echo "   3. Test with curl directly if issues persist"
echo "   4. Monitor rate limit usage"

echo ""
echo "📄 Full report saved to: $REPORT_FILE"