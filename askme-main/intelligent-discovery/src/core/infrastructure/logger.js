import winston from 'winston';
import path from 'path';

// Security-aware logging function to prevent API key exposure
const sanitizeLogData = (data) => {
  if (typeof data === 'string') return data;
  if (data === null || data === undefined) return data;
  
  const sensitiveKeys = ['key', 'token', 'secret', 'password', 'auth', 'api_key', 'apikey'];
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item));
  }
  
  if (typeof data === 'object') {
    const sanitized = {};
    Object.keys(data).forEach(key => {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitive => 
        lowerKey.includes(sensitive)
      );
      
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeLogData(data[key]);
      }
    });
    return sanitized;
  }
  
  return data;
};

// Security event logging function
const logSecurityEvent = (logger, event, details = {}) => {
  const securityData = {
    event,
    timestamp: new Date().toISOString(),
    details: sanitizeLogData(details)
  };
  
  logger.warn(`🚨 SECURITY EVENT: ${event}`, securityData);
};

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue'
};

winston.addColors(LOG_COLORS);

const createLogger = (options = {}) => {
  const logDir = options.logDir || 'logs';
  const level = options.level || 'info';
  
  const logger = winston.createLogger({
    levels: LOG_LEVELS,
    level,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        // Sanitize all log data for security
        const sanitizedMeta = sanitizeLogData(meta);
        return JSON.stringify({
          timestamp,
          level,
          message,
          ...sanitizedMeta
        });
      })
    ),
    transports: [
      new winston.transports.File({
        filename: path.join(logDir, 'discovery.log'),
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      new winston.transports.File({
        filename: path.join(logDir, 'security.log'),
        level: 'warn',
        maxsize: 5242880,
        maxFiles: 10
      }),
      new winston.transports.File({
        filename: path.join(logDir, 'errors.log'),
        level: 'error',
        maxsize: 5242880,
        maxFiles: 5
      })
    ]
  });

  if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const sanitizedMeta = sanitizeLogData(meta);
          const metaStr = Object.keys(sanitizedMeta).length > 0 ? 
            ` ${JSON.stringify(sanitizedMeta)}` : '';
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      )
    }));
  }

  // Add security event logging method to logger instance
  logger.securityEvent = (event, details = {}) => {
    logSecurityEvent(logger, event, details);
  };

  // Add secure info method that sanitizes data
  logger.secureInfo = (message, data = {}) => {
    logger.info(message, sanitizeLogData(data));
  };

  // Add secure debug method that sanitizes data
  logger.secureDebug = (message, data = {}) => {
    logger.debug(message, sanitizeLogData(data));
  };

  return logger;
};

export { createLogger, LOG_LEVELS, sanitizeLogData, logSecurityEvent };