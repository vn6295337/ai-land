#!/usr/bin/env python3
# test_api_integration.py - Test script for API Gateway integration
import os
from apollo_agent_integration import ApolloAgentIntegration
from scout_agent_integration import ScoutAgentIntegration

def test_api_integration():
    """Test API Gateway integration with sample data"""
    print("🧪 Testing API Gateway Integration")
    
    # Test environment variables
    required_vars = ['AI_MODELS_API_URL', 'AI_MODELS_DISCOVERY_API_SECRET_KEY']
    for var in required_vars:
        if not os.getenv(var):
            print(f"❌ Missing environment variable: {var}")
            return False
    
    try:
        # Test Apollo Agent integration
        print("\n📊 Testing Apollo Agent Integration...")
        apollo = ApolloAgentIntegration()
        
        # Test API health
        if apollo.get_api_status():
            print("✅ API Gateway health check passed")
        else:
            print("❌ API Gateway health check failed")
            return False
        
        # Test with sample model data
        sample_models = [
            {
                'model_name': 'test-model-1',
                'provider': 'test-provider',
                'task_type': 'text-generation',
                'api_url': 'https://example.com/model1',
                'description': 'Test model for API integration',
                'discovery_method': 'api_test',
                'discovery_timestamp': '2025-01-01T00:00:00Z'
            },
            {
                'model_name': 'test-model-2',
                'provider': 'test-provider',
                'task_type': 'chat',
                'api_url': 'https://example.com/model2',
                'description': 'Another test model',
                'discovery_method': 'api_test',
                'discovery_timestamp': '2025-01-01T00:00:00Z'
            }
        ]
        
        result = apollo.process_and_store_models(sample_models)
        if result.get('status') == 'success':
            print(f"✅ Apollo Agent integration successful: {result['models_inserted']} models inserted")
        else:
            print(f"❌ Apollo Agent integration failed: {result}")
            return False
        
        # Test Scout Agent integration
        print("\n🔍 Testing Scout Agent Integration...")
        scout = ScoutAgentIntegration()
        
        # Test with sample staging data
        sample_urls = [
            {
                'url': 'https://example.com/test-url-1',
                'source': 'api_test',
                'raw_metadata': {'test': 'data'},
                'discovery_timestamp': '2025-01-01T00:00:00Z',
                'processing_status': 'pending'
            },
            {
                'url': 'https://example.com/test-url-2', 
                'source': 'api_test',
                'raw_metadata': {'test': 'data2'},
                'discovery_timestamp': '2025-01-01T00:00:00Z',
                'processing_status': 'pending'
            }
        ]
        
        staging_result = scout.stage_discovered_urls(sample_urls)
        if staging_result.get('status') == 'success':
            print(f"✅ Scout Agent staging successful: {staging_result['records_inserted']} URLs staged")
        else:
            print(f"❌ Scout Agent staging failed: {staging_result}")
            return False
        
        print("\n🎉 All API Gateway integration tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_api_integration()
    exit(0 if success else 1)