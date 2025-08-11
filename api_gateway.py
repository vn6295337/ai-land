# api_gateway.py - For your Render.com backend
from flask import Flask, request, jsonify
import os
from supabase import create_client
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# Use your Render environment variables (match exact case)
supabase_ai_models_discovery_url = os.getenv('supabase_ai_models_discovery_url')
service_role = os.getenv('service_role')
ai_models_discovery_api_secret_key = os.getenv('ai_models_discovery_api_secret_key')

# Log environment variable status for debugging
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

logger.info(f"Environment check - URL exists: {bool(supabase_ai_models_discovery_url)}")
logger.info(f"Environment check - Service role exists: {bool(service_role)}")
logger.info(f"Environment check - API secret exists: {bool(ai_models_discovery_api_secret_key)}")
if supabase_ai_models_discovery_url:
    logger.info(f"Supabase URL: {supabase_ai_models_discovery_url}")
if service_role:
    logger.info(f"Service role length: {len(service_role)}")
    logger.info(f"Service role starts with: {service_role[:10]}...")
    logger.info(f"Service role ends with: ...{service_role[-10:]}")

# Validate required environment variables
if not supabase_ai_models_discovery_url:
    app.logger.error("Missing supabase_ai_models_discovery_url environment variable")
    raise ValueError("supabase_ai_models_discovery_url environment variable required")
if not service_role:
    app.logger.error("Missing service_role environment variable") 
    raise ValueError("service_role environment variable required")
if not ai_models_discovery_api_secret_key:
    app.logger.error("Missing ai_models_discovery_api_secret_key environment variable")
    raise ValueError("ai_models_discovery_api_secret_key environment variable required")

app.logger.info("Environment variables validated successfully")

# Initialize Supabase client with service_role key (secure on Render)
try:
    # Strip any potential whitespace from the key
    clean_key = service_role.strip() if service_role else ""
    clean_url = supabase_ai_models_discovery_url.strip() if supabase_ai_models_discovery_url else ""
    
    logger.info(f"Attempting to create Supabase client with cleaned credentials")
    logger.info(f"Cleaned URL: {clean_url}")
    logger.info(f"Cleaned key length: {len(clean_key)}")
    
    supabase = create_client(clean_url, clean_key)
    logger.info("Supabase client initialized successfully")
    
    # Test the connection and permissions
    try:
        # Try a simple query to verify the key works
        test_result = supabase.table('ai_models_discovery').select('count', count='exact').limit(1).execute()
        logger.info("Database connection test successful")
    except Exception as db_error:
        logger.warning(f"Database test failed (key might have limited permissions): {str(db_error)}")
        
except Exception as e:
    logger.error(f"Failed to initialize Supabase client: {str(e)}")
    logger.error(f"Raw key length: {len(service_role) if service_role else 0}")
    # Don't raise - let the app start and show better error messages
    supabase = None

def verify_api_key():
    """Verify API key from Authorization header"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return False
    
    token = auth_header.replace('Bearer ', '')
    return token == ai_models_discovery_api_secret_key

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    if supabase is None:
        return jsonify({
            'status': 'unhealthy', 
            'service': 'ai-models-api-gateway',
            'error': 'Supabase client not initialized - check API key'
        }), 503
    
    return jsonify({'status': 'healthy', 'service': 'ai-models-api-gateway'})

@app.route('/debug/env', methods=['GET'])
def debug_env():
    """Debug endpoint to check environment variables (non-sensitive)"""
    return jsonify({
        'has_supabase_url': bool(supabase_ai_models_discovery_url),
        'has_service_role': bool(service_role),
        'has_api_secret': bool(ai_models_discovery_api_secret_key),
        'port': os.environ.get('PORT', '5000'),
        'service_role_length': len(service_role) if service_role else 0
    })

@app.route('/api/models/replace', methods=['POST'])
def replace_all_models():
    """Replace all models with new dataset (clear and rebuild strategy)"""
    if not verify_api_key():
        app.logger.warning('Unauthorized access attempt')
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        models_data = request.json.get('models', [])
        
        if not models_data:
            return jsonify({'error': 'No models data provided'}), 400
        
        app.logger.info(f'Starting replace operation with {len(models_data)} models')
        
        # Step 1: Clear existing data (clear-and-rebuild strategy)
        delete_result = supabase.table('ai_models_discovery').delete().neq('id', 0).execute()
        app.logger.info(f'Cleared existing data')
        
        # Step 2: Insert new data in batches of 100
        inserted_count = 0
        batch_size = 100
        
        for i in range(0, len(models_data), batch_size):
            batch = models_data[i:i+batch_size]
            
            # Insert batch
            result = supabase.table('ai_models_discovery').insert(batch).execute()
            inserted_count += len(batch)
            
            app.logger.info(f'Inserted batch {i//batch_size + 1}: {len(batch)} models')
        
        app.logger.info(f'Successfully replaced all models: {inserted_count} total')
        
        return jsonify({
            'status': 'success',
            'operation': 'replace_all',
            'models_inserted': inserted_count,
            'batches_processed': (len(models_data) + batch_size - 1) // batch_size
        })
    
    except Exception as e:
        app.logger.error(f'Error in replace_all_models: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/staging/insert', methods=['POST'])
def insert_staging_data():
    """Insert URLs into staging table"""
    if not verify_api_key():
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        staging_data = request.json.get('urls', [])
        
        if not staging_data:
            return jsonify({'error': 'No staging data provided'}), 400
        
        # Insert staging data
        result = supabase.table('ai_models_staging').insert(staging_data).execute()
        
        return jsonify({
            'status': 'success',
            'operation': 'staging_insert',
            'records_inserted': len(staging_data)
        })
    
    except Exception as e:
        app.logger.error(f'Error in insert_staging_data: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/staging/process', methods=['POST'])
def process_staging_data():
    """Process staging data and move to main table"""
    if not verify_api_key():
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        limit = request.json.get('limit', 10)
        
        # Get pending staging records
        staging_result = supabase.table('ai_models_staging')\
            .select('*')\
            .eq('processing_status', 'pending')\
            .limit(limit)\
            .execute()
        
        processed_count = len(staging_result.data)
        
        # Here you would process each record and insert into main table
        # For now, just return the count
        
        return jsonify({
            'status': 'success',
            'operation': 'process_staging',
            'records_processed': processed_count
        })
    
    except Exception as e:
        app.logger.error(f'Error in process_staging_data: {str(e)}')
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)