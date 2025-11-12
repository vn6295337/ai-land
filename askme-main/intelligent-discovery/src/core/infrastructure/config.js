import Joi from 'joi';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { keyManager } from '../../../600_security/render_secure_keys.js';

dotenv.config();

const configSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_DIR: Joi.string().default('logs'),
  
  // API Keys
  OPENAI_API_KEY: Joi.string().optional(),
  ANTHROPIC_API_KEY: Joi.string().optional(),
  GEMINI_API_KEY: Joi.string().optional(),
  MISTRAL_API_KEY: Joi.string().optional(),
  COHERE_API_KEY: Joi.string().optional(),
  HUGGINGFACE_API_KEY: Joi.string().optional(),
  GROQ_API_KEY: Joi.string().optional(),
  
  // Database Configuration
  QDRANT_URL: Joi.string().uri().default('https://455665ee-cc5c-4f81-9e27-2be34d741793.eu-central-1-0.aws.cloud.qdrant.io'),
  QDRANT_API_KEY: Joi.string().optional(),
  QDRANT_COLLECTION: Joi.string().default('model_embeddings'),
  
  // Cache Configuration
  CACHE_DIR: Joi.string().default('data/cache'),
  CACHE_TTL: Joi.number().integer().min(0).default(3600),
  
  // Rate Limiting
  RATE_LIMIT_RPM: Joi.number().integer().min(1).default(60),
  RATE_LIMIT_CONCURRENT: Joi.number().integer().min(1).default(5),
  
  // Discovery Configuration
  MAX_MODELS_PER_PROVIDER: Joi.number().integer().min(1).default(1000),
  DISCOVERY_TIMEOUT: Joi.number().integer().min(1000).default(30000),
  
  // Export Configuration
  EXPORT_DIR: Joi.string().default('data/exports'),
  EXPORT_FORMATS: Joi.array().items(Joi.string().valid('json', 'csv', 'yaml')).default(['json']),
  
  // Integration
  ASKME_BACKEND_URL: Joi.string().uri().optional(),
  GITHUB_TOKEN: Joi.string().optional(),
  WEBHOOK_SECRET: Joi.string().optional()
});

class Config {
  constructor() {
    this.validate();
    this.ensureDirectories();
  }

  validate() {
    const { error, value } = configSchema.validate(process.env, {
      allowUnknown: true,
      stripUnknown: true
    });

    if (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }

    this.config = value;
  }

  ensureDirectories() {
    const dirs = [
      this.config.LOG_DIR,
      this.config.CACHE_DIR,
      this.config.EXPORT_DIR,
      'data/models',
      'data/backups'
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  get(key) {
    return this.config[key];
  }

  getAll() {
    return { ...this.config };
  }

  isDevelopment() {
    return this.config.NODE_ENV === 'development';
  }

  isProduction() {
    return this.config.NODE_ENV === 'production';
  }

  isTest() {
    return this.config.NODE_ENV === 'test';
  }

  getApiKeys() {
    // Use existing SecureKeyManager instead of direct config access
    const providers = ['openai', 'anthropic', 'google', 'mistral', 'cohere', 'huggingface', 'groq'];
    const keys = {};
    
    providers.forEach(provider => {
      try {
        keys[provider] = keyManager.getKey(provider);
      } catch (error) {
        // Key not available for this provider - this is normal
        console.warn(`⚠️  API key not available for provider: ${provider}`);
      }
    });

    return keys;
  }

  getSecureKey(provider) {
    try {
      return keyManager.getKey(provider);
    } catch (error) {
      throw new Error(`API key not found for provider: ${provider}`);
    }
  }

  getKeyStats() {
    return keyManager.getStats();
  }

  getDatabaseConfig() {
    const qdrantUrl = new URL(this.config.QDRANT_URL);
    let qdrantApiKey = null;
    
    try {
      qdrantApiKey = keyManager.getKey('qdrant');
    } catch (error) {
      // API key not configured, continue without it
      console.warn('⚠️ QDRANT_API_KEY not configured in secure key manager');
    }
    
    return {
      url: this.config.QDRANT_URL,
      qdrant: {
        host: qdrantUrl.hostname,
        port: qdrantUrl.port || (qdrantUrl.protocol === 'https:' ? 443 : 80),
        apiKey: qdrantApiKey,
        protocol: qdrantUrl.protocol.replace(':', '')
      },
      maxRetries: 3,
      retryDelay: 2000,
      collection: this.config.QDRANT_COLLECTION
    };
  }

  getCacheConfig() {
    return {
      dir: this.config.CACHE_DIR,
      ttl: this.config.CACHE_TTL
    };
  }

  getRateLimitConfig() {
    return {
      rpm: this.config.RATE_LIMIT_RPM,
      concurrent: this.config.RATE_LIMIT_CONCURRENT
    };
  }

  getDiscoveryConfig() {
    return {
      maxModelsPerProvider: this.config.MAX_MODELS_PER_PROVIDER,
      timeout: this.config.DISCOVERY_TIMEOUT
    };
  }
}

const config = new Config();
export default config;