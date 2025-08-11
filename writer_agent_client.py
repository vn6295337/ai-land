# writer_agent_client.py - Updated to use API Gateway
import requests
import os
import json

class WriterAgentClient:
    def __init__(self):
        self.api_url = os.getenv('AI_MODELS_API_URL', 'https://your-render-service.onrender.com')
        self.api_key = os.getenv('AI_MODELS_DISCOVERY_API_SECRET_KEY')
        
        if not self.api_key:
            raise ValueError("AI_MODELS_DISCOVERY_API_SECRET_KEY environment variable required")
    
    def _get_headers(self):
        return {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
    
    def replace_all_models(self, models_data):
        """Replace all models using API Gateway (clear-and-rebuild)"""
        try:
            payload = {'models': models_data}
            response = requests.post(
                f'{self.api_url}/api/models/replace',
                json=payload,
                headers=self._get_headers(),
                timeout=300
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(f"API Error: {response.status_code} - {response.text}")
        
        except Exception as e:
            print(f"Error calling API: {str(e)}")
            raise
    
    def insert_staging_urls(self, urls_data):
        """Insert URLs into staging table via API"""
        response = requests.post(
            f'{self.api_url}/api/staging/insert',
            json={'urls': urls_data},
            headers=self._get_headers()
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Staging API Error: {response.status_code} - {response.text}")
    
    def process_staging_data(self, limit=10):
        """Process staging data via API"""
        response = requests.post(
            f'{self.api_url}/api/staging/process',
            json={'limit': limit},
            headers=self._get_headers()
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Process API Error: {response.status_code} - {response.text}")
    
    def health_check(self):
        """Check API Gateway health"""
        try:
            response = requests.get(f'{self.api_url}/health', timeout=30)
            return response.status_code == 200
        except:
            return False