#!/bin/bash
# Quick Security Test for Render Deployment

BASE_URL="https://askme-backend-proxy.onrender.com"

echo "🛡️  Quick Security Test for AskMe Backend"
echo "========================================="
echo "Testing: $BASE_URL"
echo ""

# Test 1: Health Check
echo "1. 🏥 Health Check..."
curl -s "$BASE_URL/health" | jq '.' 2>/dev/null || echo "❌ Health check failed or no jq installed"
echo ""

# Test 2: Security Status
echo "2. 🔍 Security Status..."
curl -s "$BASE_URL/api/security-status" | jq '.security' 2>/dev/null || echo "❌ Security status failed or no jq installed"
echo ""

# Test 3: XSS Protection
echo "3. 🚫 XSS Protection Test..."
RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" -X POST "$BASE_URL/api/query" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"<script>alert(\"xss\")</script>","provider":"google"}')

HTTP_STATUS=$(echo $RESPONSE | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo $RESPONSE | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$HTTP_STATUS" = "400" ]; then
    echo "✅ XSS blocked successfully"
    echo "   Response: $BODY"
else
    echo "❌ XSS not blocked (Status: $HTTP_STATUS)"
fi
echo ""

# Test 4: SQL Injection Protection
echo "4. 🚫 SQL Injection Protection Test..."
RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" -X POST "$BASE_URL/api/query" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"'\'\" OR '\'1\''='\''1","provider":"google"}')

HTTP_STATUS=$(echo $RESPONSE | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo $RESPONSE | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$HTTP_STATUS" = "400" ]; then
    echo "✅ SQL injection blocked successfully"
    echo "   Response: $BODY"
else
    echo "❌ SQL injection not blocked (Status: $HTTP_STATUS)"
fi
echo ""

# Test 5: Valid Request
echo "5. ✅ Valid Request Test..."
RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" -X POST "$BASE_URL/api/query" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What is artificial intelligence?","provider":"google"}')

HTTP_STATUS=$(echo $RESPONSE | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Valid request processed successfully"
elif [ "$HTTP_STATUS" = "500" ]; then
    echo "⚠️  Valid request failed - likely missing API key (expected in test)"
else
    echo "❌ Valid request incorrectly blocked (Status: $HTTP_STATUS)"
fi
echo ""

# Test 6: Security Headers
echo "6. 🔒 Security Headers Test..."
HEADERS=$(curl -s -I "$BASE_URL/health")

if echo "$HEADERS" | grep -q "X-Frame-Options"; then
    echo "✅ X-Frame-Options header present"
else
    echo "❌ X-Frame-Options header missing"
fi

if echo "$HEADERS" | grep -q "X-Content-Type-Options"; then
    echo "✅ X-Content-Type-Options header present"
else
    echo "❌ X-Content-Type-Options header missing"
fi

if echo "$HEADERS" | grep -q "X-XSS-Protection"; then
    echo "✅ X-XSS-Protection header present"
else
    echo "❌ X-XSS-Protection header missing"
fi

if ! echo "$HEADERS" | grep -q "X-Powered-By"; then
    echo "✅ X-Powered-By header properly removed"
else
    echo "⚠️  X-Powered-By header still present"
fi

echo ""
echo "🏁 Security Test Complete!"
echo "Check Render logs for security event messages."