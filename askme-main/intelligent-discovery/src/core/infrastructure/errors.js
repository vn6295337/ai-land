import { logSecurityEvent } from './logger.js';

class BaseError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.timestamp = new Date().toISOString();
    this.isSecurityEvent = false;
    
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

class ConfigurationError extends BaseError {
  constructor(message, field = null) {
    super(message, 'CONFIGURATION_ERROR', 500);
    this.field = field;
  }
}

class ValidationError extends BaseError {
  constructor(message, details = null) {
    super(message, 'VALIDATION_ERROR', 400);
    this.details = details;
  }
}

class NetworkError extends BaseError {
  constructor(message, url = null, method = 'GET') {
    super(message, 'NETWORK_ERROR', 503);
    this.url = url;
    this.method = method;
  }
}

class ApiError extends BaseError {
  constructor(message, provider = null, statusCode = 500) {
    super(message, 'API_ERROR', statusCode);
    this.provider = provider;
  }
}

class RateLimitError extends BaseError {
  constructor(message, provider = null, retryAfter = null) {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.provider = provider;
    this.retryAfter = retryAfter;
  }
}

class AuthenticationError extends BaseError {
  constructor(message, provider = null) {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.provider = provider;
    this.isSecurityEvent = true;
  }
}

class SecurityError extends BaseError {
  constructor(message, eventType = 'SECURITY_VIOLATION', details = {}) {
    super(message, 'SECURITY_ERROR', 403);
    this.eventType = eventType;
    this.details = details;
    this.isSecurityEvent = true;
  }
}

class InputValidationError extends BaseError {
  constructor(message, input = null, pattern = null) {
    super(message, 'INPUT_VALIDATION_ERROR', 400);
    this.input = input ? input.substring(0, 100) + '...' : null;
    this.pattern = pattern;
    this.isSecurityEvent = true;
  }
}

class DatabaseError extends BaseError {
  constructor(message, operation = null) {
    super(message, 'DATABASE_ERROR', 500);
    this.operation = operation;
  }
}

class FileSystemError extends BaseError {
  constructor(message, path = null, operation = 'read') {
    super(message, 'FILESYSTEM_ERROR', 500);
    this.path = path;
    this.operation = operation;
  }
}

class DiscoveryError extends BaseError {
  constructor(message, provider = null, modelId = null) {
    super(message, 'DISCOVERY_ERROR', 500);
    this.provider = provider;
    this.modelId = modelId;
  }
}

class ValidationTestError extends BaseError {
  constructor(message, modelId = null, testType = null) {
    super(message, 'VALIDATION_TEST_ERROR', 500);
    this.modelId = modelId;
    this.testType = testType;
  }
}

class EmbeddingError extends BaseError {
  constructor(message, text = null) {
    super(message, 'EMBEDDING_ERROR', 500);
    this.text = text ? text.substring(0, 100) + '...' : null;
  }
}

class RetryableError extends BaseError {
  constructor(message, maxRetries = 3, retryAfter = 1000) {
    super(message, 'RETRYABLE_ERROR', 503);
    this.maxRetries = maxRetries;
    this.retryAfter = retryAfter;
    this.currentRetry = 0;
  }

  shouldRetry() {
    return this.currentRetry < this.maxRetries;
  }

  incrementRetry() {
    this.currentRetry++;
  }
}

class ErrorHandler {
  constructor(logger) {
    this.logger = logger;
  }

  handle(error, context = {}) {
    const errorInfo = {
      ...error.toJSON ? error.toJSON() : { message: error.message, stack: error.stack },
      context
    };

    // Log security events using the security-aware logger
    if (error.isSecurityEvent) {
      this.logger.securityEvent(error.code || 'SECURITY_ERROR', {
        message: error.message,
        eventType: error.eventType,
        provider: error.provider,
        details: error.details,
        context
      });
    }

    if (error instanceof BaseError) {
      switch (error.constructor.name) {
        case 'ConfigurationError':
          this.logger.error('Configuration error', errorInfo);
          break;
        case 'NetworkError':
        case 'ApiError':
          this.logger.warn('External service error', errorInfo);
          break;
        case 'RateLimitError':
          this.logger.warn('Rate limit exceeded', errorInfo);
          break;
        case 'AuthenticationError':
          this.logger.error('Authentication failed', errorInfo);
          break;
        case 'SecurityError':
          this.logger.error('Security violation detected', errorInfo);
          break;
        case 'InputValidationError':
          this.logger.warn('Input validation failed', errorInfo);
          break;
        case 'DatabaseError':
          this.logger.error('Database operation failed', errorInfo);
          break;
        default:
          this.logger.error('Application error', errorInfo);
      }
    } else {
      this.logger.error('Unexpected error', errorInfo);
    }

    return errorInfo;
  }

  wrapAsync(fn) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handle(error, { function: fn.name, args: args.map(String) });
        throw error;
      }
    };
  }

  createRetryWrapper(maxRetries = 3, baseDelay = 1000) {
    return async (fn, ...args) => {
      let lastError;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await fn(...args);
        } catch (error) {
          lastError = error;
          
          if (attempt === maxRetries) {
            break;
          }

          if (error instanceof RetryableError || 
              error instanceof NetworkError || 
              error instanceof RateLimitError) {
            
            const delay = error.retryAfter || baseDelay * Math.pow(2, attempt);
            this.logger.warn(`Retrying operation after ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`, {
              error: error.message,
              function: fn.name
            });
            
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            break; // Don't retry non-retryable errors
          }
        }
      }

      this.handle(lastError, { maxRetries, attempts: maxRetries + 1 });
      throw lastError;
    };
  }
}

export {
  BaseError,
  ConfigurationError,
  ValidationError,
  NetworkError,
  ApiError,
  RateLimitError,
  AuthenticationError,
  SecurityError,
  InputValidationError,
  DatabaseError,
  FileSystemError,
  DiscoveryError,
  ValidationTestError,
  EmbeddingError,
  RetryableError,
  ErrorHandler
};