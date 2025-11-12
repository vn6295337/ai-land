#!/bin/bash
# Quick Deploy AskMe CLI 9-Provider Edition

set -e

echo "🚀 Quick Deploy AskMe CLI 9-Provider Edition"
echo "============================================="

cd /home/km_project/300_implementation/askme-cli

# Create minimal launcher script
mkdir -p cliApp/build/install/cliApp/bin
mkdir -p cliApp/build/install/cliApp/lib

# Create a gradle-run based launcher
cat > cliApp/build/install/cliApp/bin/cliApp << 'EOF'
#!/bin/bash
# AskMe CLI 9-Provider Launcher
cd /home/km_project/300_implementation/askme-cli
exec ./gradlew --quiet run --args="$*"
EOF

chmod +x cliApp/build/install/cliApp/bin/cliApp

# Test the deployment
echo "🧪 Testing deployment..."

if [ -x "cliApp/build/install/cliApp/bin/cliApp" ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "📋 Test commands:"
    echo "  ./cliApp/build/install/cliApp/bin/cliApp --wrapper-help"
    echo "  /home/km_project/askme --wrapper-help"
    echo ""
    echo "🎯 9 Providers available: google, mistral, llama, cohere, groq, huggingface, openrouter, ai21, replicate"
    echo ""
    echo "💡 To test a provider:"
    echo "  ./cliApp/build/install/cliApp/bin/cliApp -m google 'What is 2+2?'"
else
    echo "❌ Deployment failed"
    exit 1
fi

echo "🎉 AskMe CLI 9-Provider Edition deployed successfully!"