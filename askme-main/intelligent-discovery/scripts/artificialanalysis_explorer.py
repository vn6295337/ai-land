#!/usr/bin/env python3
"""
ArtificialAnalysis API Explorer
Access ArtificialAnalysis API programmatically via render.com backend proxy
"""

import requests
import json
import os
import time
from typing import Dict, List, Optional, Any
from datetime import datetime

class ArtificialAnalysisExplorer:
    def __init__(self, proxy_base_url: str = "https://askme-backend-proxy.onrender.com"):
        self.proxy_base_url = proxy_base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'ArtificialAnalysis-Explorer/1.0'
        })
        
    def test_proxy_connection(self) -> Dict[str, Any]:
        """Test connection to the backend proxy"""
        try:
            response = self.session.get(f"{self.proxy_base_url}/health", timeout=10)
            response.raise_for_status()
            return {
                "status": "success",
                "data": response.json(),
                "proxy_accessible": True
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "proxy_accessible": False
            }
    
    def get_available_endpoints(self) -> Dict[str, Any]:
        """Get list of available endpoints from proxy"""
        try:
            # Try a non-existent endpoint to get the list of available ones
            response = self.session.get(f"{self.proxy_base_url}/api/nonexistent", timeout=10)
            if response.status_code == 404:
                data = response.json()
                if "availableEndpoints" in data:
                    return {
                        "status": "success",
                        "endpoints": data["availableEndpoints"]
                    }
            return {"status": "error", "message": "Could not retrieve endpoints"}
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def test_artificialanalysis_direct(self) -> Dict[str, Any]:
        """Test direct access to ArtificialAnalysis API endpoints"""
        # Common API base URLs to test
        potential_bases = [
            "https://api.artificialanalysis.ai",
            "https://artificialanalysis.ai/api",
            "https://api.artificalanalysis.com",
            "https://artificialanalysis.ai/api/v1"
        ]
        
        results = {}
        for base_url in potential_bases:
            try:
                # Test basic endpoints
                endpoints_to_test = [
                    "/models",
                    "/benchmarks", 
                    "/leaderboard",
                    "/performance",
                    "/api-info",
                    "/status"
                ]
                
                base_results = {"base_url": base_url, "endpoints": {}}
                
                for endpoint in endpoints_to_test:
                    try:
                        response = self.session.get(f"{base_url}{endpoint}", timeout=5)
                        base_results["endpoints"][endpoint] = {
                            "status_code": response.status_code,
                            "accessible": response.status_code < 500,
                            "content_type": response.headers.get('content-type', 'unknown')
                        }
                        
                        if response.status_code == 200:
                            try:
                                data = response.json()
                                base_results["endpoints"][endpoint]["sample_data"] = str(data)[:200] + "..." if len(str(data)) > 200 else str(data)
                            except:
                                base_results["endpoints"][endpoint]["sample_data"] = response.text[:200] + "..." if len(response.text) > 200 else response.text
                                
                    except Exception as e:
                        base_results["endpoints"][endpoint] = {
                            "error": str(e),
                            "accessible": False
                        }
                        
                results[base_url] = base_results
                time.sleep(0.5)  # Rate limiting
                
            except Exception as e:
                results[base_url] = {"error": str(e)}
                
        return results
    
    def test_proxy_artificialanalysis_integration(self) -> Dict[str, Any]:
        """Test if proxy has ArtificialAnalysis integration"""
        potential_endpoints = [
            "/api/artificialanalysis",
            "/api/artificial-analysis", 
            "/api/aa",
            "/api/benchmarks",
            "/api/model-benchmarks",
            "/api/performance",
            "/api/evaluation",
            "/api/external/artificialanalysis"
        ]
        
        results = {}
        for endpoint in potential_endpoints:
            try:
                response = self.session.get(f"{self.proxy_base_url}{endpoint}", timeout=10)
                results[endpoint] = {
                    "status_code": response.status_code,
                    "accessible": response.status_code < 500,
                    "response": response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text[:500]
                }
            except Exception as e:
                results[endpoint] = {
                    "error": str(e),
                    "accessible": False
                }
                
        return results
    
    def query_via_proxy(self, query: str) -> Dict[str, Any]:
        """Use proxy's query endpoint to ask about ArtificialAnalysis"""
        try:
            payload = {"prompt": query}
            response = self.session.post(f"{self.proxy_base_url}/api/query", json=payload, timeout=30)
            response.raise_for_status()
            return {
                "status": "success",
                "data": response.json()
            }
        except Exception as e:
            return {
                "status": "error", 
                "error": str(e)
            }
    
    def test_artificialanalysis_with_key(self) -> Dict[str, Any]:
        """Test ArtificialAnalysis API with potential authentication"""
        # Since we don't have direct access to the API key, we'll test common patterns
        test_results = {}
        
        # Test if there's a way to access the key via proxy
        try:
            # Query for API key info (should be filtered for security)
            key_info_query = "What ArtificialAnalysis API key is configured in this system?"
            key_result = self.query_via_proxy(key_info_query)
            test_results["key_info_query"] = key_result
        except Exception as e:
            test_results["key_info_query"] = {"error": str(e)}
        
        # Test if proxy can make authenticated requests on our behalf
        try:
            auth_query = "Can you access ArtificialAnalysis API data for model benchmarks?"
            auth_result = self.query_via_proxy(auth_query)
            test_results["auth_query"] = auth_result
        except Exception as e:
            test_results["auth_query"] = {"error": str(e)}
            
        return test_results
    
    def explore_llm_endpoints(self) -> Dict[str, Any]:
        """Explore existing LLM-related endpoints in the proxy"""
        llm_endpoints = ["/api/llms", "/api/llms/health", "/api/github/llm-data", "/api/github/llm-health"]
        results = {}
        
        for endpoint in llm_endpoints:
            try:
                response = self.session.get(f"{self.proxy_base_url}{endpoint}", timeout=15)
                results[endpoint] = {
                    "status_code": response.status_code,
                    "data": response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                }
            except Exception as e:
                results[endpoint] = {"error": str(e)}
                
        return results
    
    def generate_report(self) -> Dict[str, Any]:
        """Generate comprehensive report of ArtificialAnalysis API access"""
        report = {
            "timestamp": datetime.now().isoformat(),
            "exploration_results": {}
        }
        
        print("🔍 Testing proxy connection...")
        report["exploration_results"]["proxy_connection"] = self.test_proxy_connection()
        
        print("📡 Getting available endpoints...")
        report["exploration_results"]["available_endpoints"] = self.get_available_endpoints()
        
        print("🎯 Testing direct ArtificialAnalysis API access...")
        report["exploration_results"]["direct_api_access"] = self.test_artificialanalysis_direct()
        
        print("🔗 Testing proxy ArtificialAnalysis integration...")
        report["exploration_results"]["proxy_integration"] = self.test_proxy_artificialanalysis_integration()
        
        print("🔑 Testing ArtificialAnalysis with authentication...")
        report["exploration_results"]["authenticated_access"] = self.test_artificialanalysis_with_key()
        
        print("📊 Exploring existing LLM endpoints...")
        report["exploration_results"]["llm_endpoints"] = self.explore_llm_endpoints()
        
        return report
    
    def save_report(self, report: Dict[str, Any], filename: str = None) -> str:
        """Save exploration report to file"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"artificialanalysis_exploration_{timestamp}.json"
        
        filepath = os.path.join(os.path.dirname(__file__), filename)
        with open(filepath, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        return filepath

def main():
    """Main execution function"""
    print("🚀 ArtificialAnalysis API Explorer")
    print("=" * 50)
    
    explorer = ArtificialAnalysisExplorer()
    
    # Generate comprehensive report
    report = explorer.generate_report()
    
    # Save report
    filepath = explorer.save_report(report)
    print(f"\n💾 Report saved to: {filepath}")
    
    # Print summary
    print("\n📋 SUMMARY")
    print("=" * 30)
    
    proxy_status = report["exploration_results"]["proxy_connection"]
    print(f"Proxy Connection: {'✅ Success' if proxy_status.get('proxy_accessible') else '❌ Failed'}")
    
    endpoints = report["exploration_results"]["available_endpoints"]
    if endpoints.get("status") == "success":
        print(f"Available Endpoints: {len(endpoints.get('endpoints', []))}")
        for endpoint in endpoints.get('endpoints', []):
            print(f"  • {endpoint}")
    
    # Check for any successful ArtificialAnalysis access
    direct_access = report["exploration_results"]["direct_api_access"]
    proxy_integration = report["exploration_results"]["proxy_integration"] 
    auth_access = report["exploration_results"]["authenticated_access"]
    
    print(f"\nDirect API Access: {'⚠️  Limited' if any(result.get('endpoints', {}) for result in direct_access.values()) else '❌ No access'}")
    print(f"Proxy Integration: {'⚠️  Partial' if any(result.get('accessible') for result in proxy_integration.values()) else '❌ Not implemented'}")
    print(f"Authenticated Access: {'⚠️  Via proxy only' if any('success' in str(result) for result in auth_access.values()) else '❌ Not available'}")
    
    print(f"\n📄 Full report available in: {filepath}")

if __name__ == "__main__":
    main()