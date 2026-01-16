const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'nairobi-traffic-analysis',
    version: require('../package.json').version
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
    }),
    
    // Daily rotating file for all logs
    new DailyRotateFile({
      filename: path.join(logsDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info'
    }),
    
    // Daily rotating file for errors
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error'
    }),
    
    // Daily rotating file for security events
    new DailyRotateFile({
      filename: path.join(logsDir, 'security-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d',
      level: 'warn',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ]
});

// Add request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  logger.info('API Request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    apiKey: req.headers['x-api-key'] ? 'present' : 'missing'
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel]('API Response', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length')
    });
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow API Request', {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        threshold: '1000ms'
      });
    }
  });
  
  next();
};

// Security event logger
const securityLogger = {
  logSuspiciousActivity: (event, details) => {
    logger.warn('Security Event', {
      event,
      ...details,
      timestamp: new Date().toISOString()
    });
  },
  
  logAuthenticationAttempt: (success, details) => {
    const level = success ? 'info' : 'warn';
    logger[level]('Authentication Attempt', {
      success,
      ...details,
      timestamp: new Date().toISOString()
    });
  },
  
  logRateLimitExceeded: (details) => {
    logger.warn('Rate Limit Exceeded', {
      ...details,
      timestamp: new Date().toISOString()
    });
  },
  
  logValidationError: (details) => {
    logger.warn('Validation Error', {
      ...details,
      timestamp: new Date().toISOString()
    });
  },
  
  logDataAccess: (resource, action, details) => {
    logger.info('Data Access', {
      resource,
      action,
      ...details,
      timestamp: new Date().toISOString()
    });
  }
};

// Performance logger
const performanceLogger = {
  logDatabaseQuery: (query, duration, success) => {
    const level = duration > 100 ? 'warn' : 'debug';
    logger[level]('Database Query', {
      query: query.substring(0, 100), // Truncate long queries
      duration: `${duration}ms`,
      success,
      timestamp: new Date().toISOString()
    });
  },
  
  logCacheOperation: (operation, key, hit, duration) => {
    logger.debug('Cache Operation', {
      operation,
      key,
      hit,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  },
  
  logExternalApiCall: (service, endpoint, duration, success) => {
    const level = !success ? 'error' : duration > 2000 ? 'warn' : 'info';
    logger[level]('External API Call', {
      service,
      endpoint,
      duration: `${duration}ms`,
      success,
      timestamp: new Date().toISOString()
    });
  }
};

// Business event logger
const businessLogger = {
  logTrafficIncident: (incident) => {
    logger.info('Traffic Incident Reported', {
      incidentId: incident.id,
      location: incident.location,
      severity: incident.severity,
      type: incident.type,
      timestamp: new Date().toISOString()
    });
  },
  
  logTrafficAlert: (alert) => {
    logger.warn('Traffic Alert Triggered', {
      alertId: alert.id,
      level: alert.level,
      location: alert.location,
      message: alert.message,
      timestamp: new Date().toISOString()
    });
  },
  
  logSystemEvent: (event, details) => {
    logger.info('System Event', {
      event,
      ...details,
      timestamp: new Date().toISOString()
    });
  }
};

// Error logger
const errorLogger = {
  logError: (error, context = {}) => {
    logger.error('Application Error', {
      message: error.message,
      stack: error.stack,
      ...context,
      timestamp: new Date().toISOString()
    });
  },
  
  logUnhandledError: (error, req) => {
    logger.error('Unhandled Error', {
      message: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
  }
};

// Health check logger
const healthLogger = {
  logHealthCheck: (status, checks) => {
    const level = status === 'healthy' ? 'info' : 'warn';
    logger[level]('Health Check', {
      status,
      checks,
      timestamp: new Date().toISOString()
    });
  }
};

// Export all loggers
module.exports = {
  logger,
  requestLogger,
  securityLogger,
  performanceLogger,
  businessLogger,
  errorLogger,
  healthLogger
};