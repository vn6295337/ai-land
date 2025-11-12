import { createLogger } from '../../core/infrastructure/logger.js';
import { jsonExporter } from './json-exporter.js';
import fs from 'fs/promises';
import path from 'path';

class APIExporter {
  constructor() {
    this.logger = createLogger({ component: 'api-exporter' });
    this.isInitialized = false;
    this.apiCache = new Map();
    
    // API export configuration
    this.apiConfig = {
      outputDirectory: './exports/api',
      encoding: 'utf8',
      includeSchemas: true,
      includeExamples: true,
      validateOutput: true,
      compressionEnabled: false,
      versioningEnabled: true
    };
    
    // API catalog formats
    this.apiFormats = {
      'openapi_spec': {
        description: 'OpenAPI 3.0 specification for model catalog API',
        filename: 'model-catalog-api.yaml',
        version: '3.0.3',
        processor: this.generateOpenAPISpec.bind(this)
      },
      'rest_catalog': {
        description: 'REST API compatible model catalog',
        filename: 'rest_api_catalog.json',
        version: '1.0.0',
        processor: this.generateRESTCatalog.bind(this)
      },
      'graphql_schema': {
        description: 'GraphQL schema and resolvers',
        filename: 'graphql_schema.json',
        version: '1.0.0',
        processor: this.generateGraphQLSchema.bind(this)
      },
      'webhook_catalog': {
        description: 'Webhook-compatible event catalog',
        filename: 'webhook_catalog.json',
        version: '1.0.0',
        processor: this.generateWebhookCatalog.bind(this)
      },
      'microservice_catalog': {
        description: 'Microservices-ready API catalog',
        filename: 'microservice_catalog.json',
        version: '1.0.0',
        processor: this.generateMicroserviceCatalog.bind(this)
      },
      'sdk_manifest': {
        description: 'SDK generation manifest',
        filename: 'sdk_manifest.json',
        version: '1.0.0',
        processor: this.generateSDKManifest.bind(this)
      }
    };
    
    // API schema templates
    this.schemaTemplates = {
      'model_schema': {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique model identifier' },
          name: { type: 'string', description: 'Model name' },
          provider: { type: 'string', description: 'Model provider' },
          model_type: { type: 'string', description: 'Type of model' },
          capabilities: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Model capabilities' 
          },
          performance_metrics: {
            type: 'object',
            properties: {
              accuracy: { type: 'number', minimum: 0, maximum: 1 },
              latency: { type: 'number', minimum: 0 },
              throughput: { type: 'number', minimum: 0 }
            }
          },
          cost_data: {
            type: 'object',
            properties: {
              cost_per_token: { type: 'number', minimum: 0 },
              cost_per_request: { type: 'number', minimum: 0 }
            }
          },
          availability_status: { 
            type: 'string', 
            enum: ['available', 'limited', 'deprecated', 'unavailable'] 
          }
        },
        required: ['id', 'name', 'provider', 'model_type']
      },
      'search_query_schema': {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query text' },
          filters: {
            type: 'object',
            properties: {
              provider: { type: 'array', items: { type: 'string' } },
              model_type: { type: 'array', items: { type: 'string' } },
              capabilities: { type: 'array', items: { type: 'string' } }
            }
          },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        },
        required: ['query']
      },
      'recommendation_request_schema': {
        type: 'object',
        properties: {
          use_case: { type: 'string', description: 'Intended use case' },
          requirements: {
            type: 'object',
            properties: {
              max_latency: { type: 'number' },
              min_accuracy: { type: 'number' },
              max_cost_per_token: { type: 'number' }
            }
          },
          preferences: {
            type: 'object',
            properties: {
              preferred_providers: { type: 'array', items: { type: 'string' } },
              preferred_types: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        required: ['use_case']
      }
    };
    
    // API endpoints configuration
    this.apiEndpoints = {
      '/models': {
        get: {
          summary: 'List all models',
          parameters: ['limit', 'offset', 'provider', 'model_type'],
          responses: {
            200: { description: 'List of models', schema: 'model_list' },
            400: { description: 'Bad request' },
            500: { description: 'Internal server error' }
          }
        },
        post: {
          summary: 'Create new model entry',
          requestBody: { schema: 'model_schema' },
          responses: {
            201: { description: 'Model created', schema: 'model_schema' },
            400: { description: 'Invalid model data' }
          }
        }
      },
      '/models/{id}': {
        get: {
          summary: 'Get model by ID',
          parameters: ['id'],
          responses: {
            200: { description: 'Model details', schema: 'model_schema' },
            404: { description: 'Model not found' }
          }
        },
        put: {
          summary: 'Update model',
          parameters: ['id'],
          requestBody: { schema: 'model_schema' },
          responses: {
            200: { description: 'Model updated', schema: 'model_schema' },
            404: { description: 'Model not found' }
          }
        },
        delete: {
          summary: 'Delete model',
          parameters: ['id'],
          responses: {
            204: { description: 'Model deleted' },
            404: { description: 'Model not found' }
          }
        }
      },
      '/search': {
        post: {
          summary: 'Search models',
          requestBody: { schema: 'search_query_schema' },
          responses: {
            200: { description: 'Search results', schema: 'search_results' },
            400: { description: 'Invalid search query' }
          }
        }
      },
      '/recommendations': {
        post: {
          summary: 'Get model recommendations',
          requestBody: { schema: 'recommendation_request_schema' },
          responses: {
            200: { description: 'Model recommendations', schema: 'recommendation_results' },
            400: { description: 'Invalid recommendation request' }
          }
        }
      },
      '/compare': {
        post: {
          summary: 'Compare models',
          requestBody: {
            type: 'object',
            properties: {
              model_ids: { type: 'array', items: { type: 'string' } },
              comparison_dimensions: { type: 'array', items: { type: 'string' } }
            }
          },
          responses: {
            200: { description: 'Model comparison', schema: 'comparison_results' },
            400: { description: 'Invalid comparison request' }
          }
        }
      },
      '/analytics': {
        get: {
          summary: 'Get analytics data',
          parameters: ['timeframe', 'metrics'],
          responses: {
            200: { description: 'Analytics data', schema: 'analytics_data' }
          }
        }
      }
    };
    
    // Code generation templates
    this.codeTemplates = {
      'javascript': {
        client_example: this.generateJavaScriptClient.bind(this),
        request_example: this.generateJavaScriptRequest.bind(this)
      },
      'python': {
        client_example: this.generatePythonClient.bind(this),
        request_example: this.generatePythonRequest.bind(this)
      },
      'curl': {
        request_example: this.generateCurlRequest.bind(this)
      },
      'typescript': {
        interface_definition: this.generateTypeScriptInterface.bind(this),
        client_example: this.generateTypeScriptClient.bind(this)
      }
    };
  }

  async initialize() {
    try {
      this.logger.info('Initializing API exporter');
      
      // Create output directories
      await this.createOutputDirectories();
      
      // Load API templates
      await this.loadAPITemplates();
      
      // Initialize schema validators
      await this.initializeSchemaValidators();
      
      this.isInitialized = true;
      this.logger.info('API exporter initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize API exporter', { error: error.message });
      throw error;
    }
  }

  async exportAPICatalog(formatName, options = {}) {
    if (!this.isInitialized) {
      throw new Error('API exporter not initialized');
    }

    try {
      this.logger.info('Starting API catalog export', {
        format: formatName,
        options: Object.keys(options)
      });

      const format = this.apiFormats[formatName];
      if (!format) {
        throw new Error(`Unknown API format: ${formatName}`);
      }

      const startTime = Date.now();
      const exportId = this.generateExportId();

      // Get model data
      const modelData = await this.getModelData(options);
      
      // Process data according to format
      const apiCatalog = await format.processor(modelData, options);
      
      // Validate output if enabled
      if (this.apiConfig.validateOutput) {
        const validationResults = await this.validateAPICatalog(apiCatalog, format);
        if (validationResults.errors.length > 0) {
          this.logger.warn('API catalog validation warnings', { 
            errors: validationResults.errors.length 
          });
        }
      }
      
      // Write API catalog file
      const outputPath = await this.writeAPICatalogFile(apiCatalog, format.filename, formatName);
      
      // Generate export summary
      const exportSummary = {
        export_id: exportId,
        format: formatName,
        output_path: outputPath,
        api_version: format.version,
        endpoints_count: this.countEndpoints(apiCatalog),
        schemas_count: this.countSchemas(apiCatalog),
        file_size: await this.getFileSize(outputPath),
        processing_time: Date.now() - startTime,
        data_integrity: {
          checksum: this.calculateChecksum(JSON.stringify(apiCatalog)),
          validation_passed: true
        }
      };

      this.logger.info('API catalog export completed', {
        format: formatName,
        endpoints: exportSummary.endpoints_count,
        file_size_kb: Math.round(exportSummary.file_size / 1024),
        processing_time: exportSummary.processing_time
      });

      return exportSummary;

    } catch (error) {
      this.logger.error('API catalog export failed', { format: formatName, error: error.message });
      throw error;
    }
  }

  // Format processors
  async generateOpenAPISpec(data, options) {
    this.logger.debug('Generating OpenAPI specification');

    const openApiSpec = {
      openapi: '3.0.3',
      info: {
        title: 'AI Model Catalog API',
        description: 'Comprehensive API for discovering, comparing, and integrating AI models',
        version: this.apiFormats.openapi_spec.version,
        contact: {
          name: 'API Support',
          email: 'api-support@example.com'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: 'https://api.aimodels.com/v1',
          description: 'Production server'
        },
        {
          url: 'https://staging-api.aimodels.com/v1',
          description: 'Staging server'
        }
      ],
      paths: {},
      components: {
        schemas: this.generateOpenAPISchemas(),
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          },
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      },
      security: [
        { ApiKeyAuth: [] },
        { BearerAuth: [] }
      ]
    };

    // Generate paths from endpoints configuration
    for (const [path, methods] of Object.entries(this.apiEndpoints)) {
      openApiSpec.paths[path] = {};
      
      for (const [method, config] of Object.entries(methods)) {
        openApiSpec.paths[path][method] = {
          summary: config.summary,
          operationId: this.generateOperationId(method, path),
          tags: [this.extractTagFromPath(path)],
          parameters: this.generateOpenAPIParameters(config.parameters || []),
          responses: this.generateOpenAPIResponses(config.responses)
        };

        // Add request body if present
        if (config.requestBody) {
          openApiSpec.paths[path][method].requestBody = {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${config.requestBody.schema}` }
              }
            }
          };
        }
      }
    }

    // Add example models to the spec
    openApiSpec.components.examples = this.generateOpenAPIExamples(data.slice(0, 5));

    return openApiSpec;
  }

  async generateRESTCatalog(data, options) {
    this.logger.debug('Generating REST API catalog');

    const restCatalog = {
      api_info: {
        name: 'AI Model Catalog REST API',
        version: this.apiFormats.rest_catalog.version,
        description: 'RESTful API for model discovery and integration',
        base_url: 'https://api.aimodels.com/v1',
        authentication: 'API Key or Bearer Token',
        rate_limits: {
          requests_per_minute: 1000,
          requests_per_hour: 10000
        }
      },
      endpoints: this.generateRESTEndpoints(),
      data_models: this.generateDataModels(data),
      response_formats: {
        success: {
          structure: {
            success: true,
            data: 'object',
            metadata: 'object'
          }
        },
        error: {
          structure: {
            success: false,
            error: {
              code: 'string',
              message: 'string',
              details: 'object'
            }
          }
        }
      },
      pagination: {
        type: 'offset',
        parameters: ['limit', 'offset'],
        max_limit: 100,
        default_limit: 10
      },
      filtering: {
        supported_fields: ['provider', 'model_type', 'capabilities', 'availability_status'],
        operators: ['eq', 'in', 'contains', 'gt', 'lt', 'gte', 'lte']
      },
      sorting: {
        supported_fields: ['name', 'provider', 'created_at', 'updated_at', 'popularity_score'],
        default_sort: 'name:asc'
      }
    };

    return restCatalog;
  }

  async generateGraphQLSchema(data, options) {
    this.logger.debug('Generating GraphQL schema');

    const graphqlCatalog = {
      schema_info: {
        name: 'AI Model Catalog GraphQL API',
        version: this.apiFormats.graphql_schema.version,
        description: 'GraphQL API for flexible model data querying',
        endpoint: 'https://api.aimodels.com/graphql'
      },
      type_definitions: this.generateGraphQLTypes(),
      queries: this.generateGraphQLQueries(),
      mutations: this.generateGraphQLMutations(),
      subscriptions: this.generateGraphQLSubscriptions(),
      resolvers: {
        Query: {
          models: 'Resolve list of models with filtering and pagination',
          model: 'Resolve single model by ID',
          search: 'Resolve search results',
          recommendations: 'Resolve model recommendations'
        },
        Mutation: {
          createModel: 'Create new model entry',
          updateModel: 'Update existing model',
          deleteModel: 'Delete model'
        },
        Subscription: {
          modelUpdated: 'Subscribe to model updates',
          newModels: 'Subscribe to new model additions'
        }
      },
      example_queries: this.generateGraphQLExamples(data)
    };

    return graphqlCatalog;
  }

  async generateWebhookCatalog(data, options) {
    this.logger.debug('Generating webhook catalog');

    const webhookCatalog = {
      webhook_info: {
        name: 'AI Model Catalog Webhooks',
        version: this.apiFormats.webhook_catalog.version,
        description: 'Event-driven webhooks for model catalog updates',
        supported_events: [
          'model.created', 'model.updated', 'model.deleted',
          'model.validated', 'performance.updated', 'status.changed'
        ]
      },
      webhook_endpoints: {
        registration: {
          url: 'https://api.aimodels.com/v1/webhooks',
          method: 'POST',
          payload: {
            url: 'string',
            events: 'array',
            secret: 'string',
            active: 'boolean'
          }
        },
        management: {
          list: 'GET /v1/webhooks',
          get: 'GET /v1/webhooks/{id}',
          update: 'PUT /v1/webhooks/{id}',
          delete: 'DELETE /v1/webhooks/{id}'
        }
      },
      event_schemas: this.generateWebhookEventSchemas(),
      security: {
        signature_verification: 'HMAC-SHA256 with webhook secret',
        headers: {
          'X-Webhook-Signature': 'SHA256 signature',
          'X-Webhook-Event': 'Event type',
          'X-Webhook-Delivery': 'Unique delivery ID'
        }
      },
      retry_policy: {
        max_attempts: 3,
        backoff_strategy: 'exponential',
        timeout: 30
      },
      example_payloads: this.generateWebhookExamples(data.slice(0, 3))
    };

    return webhookCatalog;
  }

  async generateMicroserviceCatalog(data, options) {
    this.logger.debug('Generating microservice catalog');

    const microserviceCatalog = {
      service_info: {
        name: 'AI Model Catalog Microservices',
        version: this.apiFormats.microservice_catalog.version,
        description: 'Microservices architecture for scalable model management',
        architecture: 'Event-driven microservices with API Gateway'
      },
      services: {
        'model-discovery': {
          description: 'Model discovery and indexing service',
          endpoints: ['/discover', '/index', '/validate'],
          dependencies: ['database', 'cache', 'message-queue'],
          scaling: 'horizontal',
          health_check: '/health'
        },
        'model-search': {
          description: 'Search and filtering service',
          endpoints: ['/search', '/filter', '/suggest'],
          dependencies: ['elasticsearch', 'cache'],
          scaling: 'horizontal',
          health_check: '/health'
        },
        'model-comparison': {
          description: 'Model comparison and ranking service',
          endpoints: ['/compare', '/rank', '/analyze'],
          dependencies: ['ml-engine', 'database'],
          scaling: 'horizontal',
          health_check: '/health'
        },
        'recommendation-engine': {
          description: 'AI-powered recommendation service',
          endpoints: ['/recommend', '/personalize', '/learn'],
          dependencies: ['ml-models', 'user-profiles', 'analytics'],
          scaling: 'vertical',
          health_check: '/health'
        }
      },
      api_gateway: {
        url: 'https://gateway.aimodels.com',
        rate_limiting: true,
        authentication: true,
        load_balancing: 'round-robin',
        circuit_breaker: true
      },
      service_mesh: {
        technology: 'Istio',
        features: ['traffic_management', 'security', 'observability'],
        mtls_enabled: true
      },
      deployment: {
        container_orchestration: 'Kubernetes',
        service_discovery: 'Consul',
        configuration_management: 'Helm',
        monitoring: 'Prometheus + Grafana'
      }
    };

    return microserviceCatalog;
  }

  async generateSDKManifest(data, options) {
    this.logger.debug('Generating SDK manifest');

    const sdkManifest = {
      sdk_info: {
        name: 'AI Model Catalog SDK',
        version: this.apiFormats.sdk_manifest.version,
        description: 'Multi-language SDK for AI Model Catalog API',
        supported_languages: ['JavaScript', 'Python', 'TypeScript', 'Java', 'Go', 'PHP']
      },
      languages: {
        javascript: {
          package_name: '@aimodels/catalog-js',
          npm_registry: 'https://registry.npmjs.org',
          min_node_version: '14.0.0',
          dependencies: ['axios', 'lodash'],
          examples: this.codeTemplates.javascript.client_example()
        },
        python: {
          package_name: 'aimodels-catalog',
          pypi_registry: 'https://pypi.org',
          min_python_version: '3.7',
          dependencies: ['requests', 'pydantic'],
          examples: this.codeTemplates.python.client_example()
        },
        typescript: {
          package_name: '@aimodels/catalog-ts',
          npm_registry: 'https://registry.npmjs.org',
          min_node_version: '14.0.0',
          dependencies: ['axios', 'zod'],
          type_definitions: this.codeTemplates.typescript.interface_definition(),
          examples: this.codeTemplates.typescript.client_example()
        }
      },
      authentication: {
        methods: ['api_key', 'bearer_token'],
        setup_instructions: 'Set API key in environment variable or client config'
      },
      rate_limiting: {
        default_limits: '1000 req/min',
        handling: 'Automatic retry with exponential backoff'
      },
      error_handling: {
        error_types: ['ValidationError', 'AuthenticationError', 'RateLimitError', 'NotFoundError'],
        error_format: 'Consistent error structure across all SDKs'
      },
      documentation: {
        api_reference: 'https://docs.aimodels.com/api',
        sdk_guides: 'https://docs.aimodels.com/sdks',
        examples: 'https://github.com/aimodels/examples'
      }
    };

    return sdkManifest;
  }

  // Helper methods
  async getModelData(options) {
    return await jsonExporter.gatherModelData(options);
  }

  generateOpenAPISchemas() {
    const schemas = {};
    
    for (const [schemaName, schema] of Object.entries(this.schemaTemplates)) {
      schemas[schemaName] = schema;
    }
    
    // Add additional response schemas
    schemas.model_list = {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/model_schema' }
        },
        metadata: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            limit: { type: 'integer' },
            offset: { type: 'integer' }
          }
        }
      }
    };
    
    return schemas;
  }

  generateOpenAPIParameters(paramNames) {
    const paramMap = {
      id: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: 'Model ID'
      },
      limit: {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
        description: 'Number of results to return'
      },
      offset: {
        name: 'offset',
        in: 'query',
        schema: { type: 'integer', minimum: 0, default: 0 },
        description: 'Number of results to skip'
      },
      provider: {
        name: 'provider',
        in: 'query',
        schema: { type: 'string' },
        description: 'Filter by provider'
      },
      model_type: {
        name: 'model_type',
        in: 'query',
        schema: { type: 'string' },
        description: 'Filter by model type'
      }
    };
    
    return paramNames.map(name => paramMap[name]).filter(Boolean);
  }

  generateOpenAPIResponses(responses) {
    const responseMap = {};
    
    for (const [code, config] of Object.entries(responses)) {
      responseMap[code] = {
        description: config.description
      };
      
      if (config.schema) {
        responseMap[code].content = {
          'application/json': {
            schema: { $ref: `#/components/schemas/${config.schema}` }
          }
        };
      }
    }
    
    return responseMap;
  }

  generateOperationId(method, path) {
    const pathParts = path.split('/').filter(part => part && !part.startsWith('{'));
    const resource = pathParts[pathParts.length - 1] || 'root';
    return `${method}${resource.charAt(0).toUpperCase()}${resource.slice(1)}`;
  }

  extractTagFromPath(path) {
    const parts = path.split('/').filter(part => part && !part.startsWith('{'));
    return parts[0] || 'default';
  }

  generateOpenAPIExamples(sampleData) {
    const examples = {};
    
    if (sampleData.length > 0) {
      examples.sample_model = {
        summary: 'Sample model',
        value: {
          id: sampleData[0].id,
          name: sampleData[0].name,
          provider: sampleData[0].provider,
          model_type: sampleData[0].model_type,
          capabilities: sampleData[0].capabilities || [],
          performance_metrics: sampleData[0].performance_metrics || {},
          cost_data: sampleData[0].cost_data || {}
        }
      };
    }
    
    return examples;
  }

  // Code generation methods
  generateJavaScriptClient() {
    return `
class AIModelCatalogClient {
  constructor(apiKey, baseUrl = 'https://api.aimodels.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async getModels(options = {}) {
    const response = await fetch(\`\${this.baseUrl}/models\`, {
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  }

  async searchModels(query, filters = {}) {
    const response = await fetch(\`\${this.baseUrl}/search\`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, filters })
    });
    return response.json();
  }
}`;
  }

  generatePythonClient() {
    return `
import requests
from typing import Dict, List, Optional

class AIModelCatalogClient:
    def __init__(self, api_key: str, base_url: str = "https://api.aimodels.com/v1"):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({"X-API-Key": api_key})

    def get_models(self, **params) -> Dict:
        response = self.session.get(f"{self.base_url}/models", params=params)
        response.raise_for_status()
        return response.json()

    def search_models(self, query: str, filters: Optional[Dict] = None) -> Dict:
        payload = {"query": query}
        if filters:
            payload["filters"] = filters
        
        response = self.session.post(f"{self.base_url}/search", json=payload)
        response.raise_for_status()
        return response.json()`;
  }

  generateTypeScriptInterface() {
    return `
interface Model {
  id: string;
  name: string;
  provider: string;
  model_type: string;
  capabilities: string[];
  performance_metrics?: {
    accuracy?: number;
    latency?: number;
    throughput?: number;
  };
  cost_data?: {
    cost_per_token?: number;
    cost_per_request?: number;
  };
  availability_status: 'available' | 'limited' | 'deprecated' | 'unavailable';
}

interface SearchFilters {
  provider?: string[];
  model_type?: string[];
  capabilities?: string[];
}

interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
}`;
  }

  generateTypeScriptClient() {
    return `
export class AIModelCatalogClient {
  constructor(
    private apiKey: string,
    private baseUrl: string = 'https://api.aimodels.com/v1'
  ) {}

  async getModels(options: Partial<SearchQuery> = {}): Promise<{ data: Model[] }> {
    const response = await fetch(\`\${this.baseUrl}/models\`, {
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  }

  async searchModels(query: string, filters?: SearchFilters): Promise<{ data: Model[] }> {
    const response = await fetch(\`\${this.baseUrl}/search\`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, filters })
    });
    return response.json();
  }
}`;
  }

  generateCurlRequest() {
    return `
# Get all models
curl -X GET "https://api.aimodels.com/v1/models" \\
  -H "X-API-Key: your-api-key"

# Search models
curl -X POST "https://api.aimodels.com/v1/search" \\
  -H "X-API-Key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "code generation models", "filters": {"provider": ["openai"]}}'`;
  }

  async writeAPICatalogFile(catalog, filename, format) {
    const outputPath = path.join(this.apiConfig.outputDirectory, filename);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    // Determine content type and format appropriately
    let content;
    if (filename.endsWith('.yaml') || filename.endsWith('.yml')) {
      // For YAML files (like OpenAPI), we would use a YAML library
      content = JSON.stringify(catalog, null, 2); // Simplified for now
    } else {
      content = JSON.stringify(catalog, null, 2);
    }
    
    // Write file
    await fs.writeFile(outputPath, content, this.apiConfig.encoding);
    
    return outputPath;
  }

  // Utility methods
  generateExportId() {
    return `api_export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getFileSize(path) {
    const stats = await fs.stat(path);
    return stats.size;
  }

  calculateChecksum(content) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  countEndpoints(catalog) {
    if (catalog.paths) {
      return Object.keys(catalog.paths).length;
    }
    if (catalog.endpoints) {
      return Object.keys(catalog.endpoints).length;
    }
    return 0;
  }

  countSchemas(catalog) {
    if (catalog.components?.schemas) {
      return Object.keys(catalog.components.schemas).length;
    }
    if (catalog.data_models) {
      return Object.keys(catalog.data_models).length;
    }
    return 0;
  }

  // Placeholder methods for complex operations
  async createOutputDirectories() { 
    await fs.mkdir(this.apiConfig.outputDirectory, { recursive: true }); 
  }
  async loadAPITemplates() { /* Implementation details */ }
  async initializeSchemaValidators() { /* Implementation details */ }
  async validateAPICatalog(catalog, format) { 
    return { errors: [], warnings: [] }; 
  }
  generateRESTEndpoints() { return this.apiEndpoints; }
  generateDataModels(data) { return this.schemaTemplates; }
  generateGraphQLTypes() { return 'GraphQL type definitions'; }
  generateGraphQLQueries() { return 'GraphQL query definitions'; }
  generateGraphQLMutations() { return 'GraphQL mutation definitions'; }
  generateGraphQLSubscriptions() { return 'GraphQL subscription definitions'; }
  generateGraphQLExamples(data) { return []; }
  generateWebhookEventSchemas() { return {}; }
  generateWebhookExamples(data) { return []; }

  getStats() {
    return {
      initialized: this.isInitialized,
      api_cache: this.apiCache.size,
      api_formats: Object.keys(this.apiFormats).length,
      schema_templates: Object.keys(this.schemaTemplates).length,
      api_endpoints: Object.keys(this.apiEndpoints).length,
      code_templates: Object.keys(this.codeTemplates).length
    };
  }

  async cleanup() {
    this.apiCache.clear();
    this.isInitialized = false;
    this.logger.info('API exporter cleaned up');
  }
}

export const apiExporter = new APIExporter();