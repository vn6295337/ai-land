# apollo_agent_integration.py - Integration for Apollo Agent with API Gateway
from writer_agent_client import WriterAgentClient
import logging

class ApolloAgentIntegration:
    def __init__(self):
        self.writer_client = WriterAgentClient()
        self.logger = logging.getLogger(__name__)
    
    def process_and_store_models(self, processed_models_data):
        """
        Process models from Apollo Agent and store via API Gateway
        
        Args:
            processed_models_data: List of processed model dictionaries
            
        Returns:
            dict: API response with insertion results
        """
        try:
            # Validate models data format
            if not isinstance(processed_models_data, list):
                raise ValueError("Models data must be a list")
            
            if not processed_models_data:
                self.logger.warning("No models data to process")
                return {'status': 'warning', 'message': 'No models to process'}
            
            # Log the operation
            self.logger.info(f"Processing {len(processed_models_data)} models via API Gateway")
            
            # Check API health first
            if not self.writer_client.health_check():
                raise Exception("API Gateway health check failed")
            
            # Send models to API Gateway for database insertion
            result = self.writer_client.replace_all_models(processed_models_data)
            
            self.logger.info(f"Successfully processed models: {result}")
            return result
            
        except Exception as e:
            self.logger.error(f"Error in process_and_store_models: {str(e)}")
            raise
    
    def get_api_status(self):
        """Check if API Gateway is accessible"""
        return self.writer_client.health_check()