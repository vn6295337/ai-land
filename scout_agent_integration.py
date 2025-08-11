# scout_agent_integration.py - Integration for Scout Agent with API Gateway
from writer_agent_client import WriterAgentClient
import logging

class ScoutAgentIntegration:
    def __init__(self):
        self.writer_client = WriterAgentClient()
        self.logger = logging.getLogger(__name__)
    
    def stage_discovered_urls(self, urls_data):
        """
        Stage URLs discovered by Scout Agent via API Gateway
        
        Args:
            urls_data: List of URL dictionaries for staging
            
        Returns:
            dict: API response with staging results
        """
        try:
            if not isinstance(urls_data, list):
                raise ValueError("URLs data must be a list")
            
            if not urls_data:
                self.logger.warning("No URLs to stage")
                return {'status': 'warning', 'message': 'No URLs to stage'}
            
            self.logger.info(f"Staging {len(urls_data)} URLs via API Gateway")
            
            # Check API health first
            if not self.writer_client.health_check():
                raise Exception("API Gateway health check failed")
            
            # Send URLs to API Gateway for staging
            result = self.writer_client.insert_staging_urls(urls_data)
            
            self.logger.info(f"Successfully staged URLs: {result}")
            return result
            
        except Exception as e:
            self.logger.error(f"Error in stage_discovered_urls: {str(e)}")
            raise
    
    def process_staged_data(self, limit=10):
        """Process staged data via API Gateway"""
        try:
            self.logger.info(f"Processing up to {limit} staged records via API Gateway")
            
            result = self.writer_client.process_staging_data(limit)
            
            self.logger.info(f"Successfully processed staging data: {result}")
            return result
            
        except Exception as e:
            self.logger.error(f"Error in process_staged_data: {str(e)}")
            raise