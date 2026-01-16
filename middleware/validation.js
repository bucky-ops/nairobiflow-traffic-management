const Joi = require('joi');

const commonValidations = {
  coordinates: Joi.array().items(Joi.number().min(-180).max(180)).length(2).required(),
  timestamp: Joi.date().iso().optional(),
  location: Joi.string().min(1).max(200).required(),
  boundingBox: Joi.string().pattern(/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/).required()
};

const schemas = {
  // Traffic Data Validation
  trafficData: Joi.object({
    location: commonValidations.location,
    vehicleCount: Joi.number().integer().min(0).max(10000).required(),
    timestamp: Joi.date().iso().required(),
    weatherCondition: Joi.string().valid('clear', 'rain', 'snow', 'fog', 'wind').optional(),
    speed: Joi.number().min(0).max(200).optional(),
    congestionLevel: Joi.string().valid('low', 'medium', 'high', 'severe').optional()
  }),

  // Analytics Query Validation
  analyticsQuery: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional().min(Joi.ref('startDate')),
    location: Joi.string().max(100).optional(),
    granularity: Joi.string().valid('hour', 'day', 'week').optional().default('hour'),
    limit: Joi.number().integer().min(1).max(1000).optional().default(100),
    offset: Joi.number().integer().min(0).optional().default(0)
  }),

  // Route Planning Validation
  routeQuery: Joi.object({
    start: Joi.string().pattern(/^-?\d+\.?\d*,-?\d+\.?\d*$/).required().messages({
      'string.pattern.base': 'Start coordinate must be in format "lat,lng"'
    }),
    end: Joi.string().pattern(/^-?\d+\.?\d*,-?\d+\.?\d*$/).required().messages({
      'string.pattern.base': 'End coordinate must be in format "lat,lng"'
    }),
    alternatives: Joi.boolean().optional().default(false),
    avoidTolls: Joi.boolean().optional().default(false),
    avoidHighways: Joi.boolean().optional().default(false),
    vehicleType: Joi.string().valid('car', 'truck', 'motorcycle', 'bicycle').optional().default('car')
  }),

  // Traffic Query Validation
  trafficQuery: Joi.object({
    bounds: Joi.string().pattern(/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/).optional(),
    level: Joi.string().valid('low', 'medium', 'high', 'severe').optional(),
    updateTime: Joi.date().iso().optional()
  }),

  // Incident Report Validation
  incidentReport: Joi.object({
    location: commonValidations.location,
    coordinates: commonValidations.coordinates,
    type: Joi.string().valid('accident', 'construction', 'weather', 'roadblock', 'other').required(),
    severity: Joi.string().valid('low', 'medium', 'high', 'severe').required(),
    description: Joi.string().min(5).max(500).required(),
    estimatedDuration: Joi.number().integer().min(0).max(1440).optional(), // minutes
    lanesAffected: Joi.number().integer().min(1).max(10).optional(),
    reportedBy: Joi.string().min(1).max(100).optional(),
    contactInfo: Joi.string().min(5).max(200).optional()
  }),

  // Warning System Validation
  warningSubscription: Joi.object({
    location: commonValidations.location,
    radius: Joi.number().min(100).max(50000).optional().default(5000), // meters
    alertTypes: Joi.array().items(
      Joi.string().valid('congestion', 'incident', 'weather', 'construction', 'severe')
    ).optional().default(['congestion', 'incident', 'severe']),
    threshold: Joi.object({
      speed: Joi.number().min(0).max(200).optional(),
      congestionLevel: Joi.string().valid('medium', 'high', 'severe').optional(),
      incidentSeverity: Joi.string().valid('high', 'severe').optional()
    }).optional()
  }),

  // API Key Validation
  apiKeyRequest: Joi.object({
    applicationName: Joi.string().min(3).max(100).required(),
    contactEmail: Joi.string().email().required(),
    usageType: Joi.string().valid('commercial', 'non-commercial', 'research').required(),
    expectedRequests: Joi.number().integer().min(100).max(1000000).required(),
    description: Joi.string().min(10).max(500).optional()
  }),

  // Data Export Validation
  exportRequest: Joi.object({
    format: Joi.string().valid('json', 'csv', 'xml').default('json'),
    dateRange: Joi.object({
      start: Joi.date().iso().required(),
      end: Joi.date().iso().required().min(Joi.ref('start'))
    }).required(),
    dataTypes: Joi.array().items(
      Joi.string().valid('traffic', 'incidents', 'predictions', 'warnings')
    ).default(['traffic']),
    compression: Joi.boolean().default(false),
    filters: Joi.object({
      location: Joi.string().max(100).optional(),
      congestionLevel: Joi.string().valid('low', 'medium', 'high', 'severe').optional(),
      incidentType: Joi.string().optional()
    }).optional()
  })
};

// Validation middleware factory
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = source === 'query' ? req.query : 
                 source === 'params' ? req.params : 
                 req.body;

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
        timestamp: new Date().toISOString()
      });
    }

    // Sanitize and attach validated data
    if (source === 'body') req.body = value;
    else if (source === 'query') req.query = value;
    else if (source === 'params') req.params = value;

    next();
  };
};

// Specific validation middleware
const validateTrafficData = validate(schemas.trafficData, 'body');
const validateAnalyticsQuery = validate(schemas.analyticsQuery, 'query');
const validateRouteQuery = validate(schemas.routeQuery, 'query');
const validateTrafficQuery = validate(schemas.trafficQuery, 'query');
const validateIncidentReport = validate(schemas.incidentReport, 'body');
const validateWarningSubscription = validate(schemas.warningSubscription, 'body');
const validateApiKeyRequest = validate(schemas.apiKeyRequest, 'body');
const validateExportRequest = validate(schemas.exportRequest, 'body');

// Security validation helpers
const sanitizeInput = (req, res, next) => {
  // Remove potentially dangerous characters from string inputs
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }
    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);

  next();
};

const validateCoordinates = (req, res, next) => {
  const { lat, lng, bounds } = req.query;
  
  if (lat && (lat < -90 || lat > 90)) {
    return res.status(400).json({
      success: false,
      error: 'Latitude must be between -90 and 90',
      timestamp: new Date().toISOString()
    });
  }

  if (lng && (lng < -180 || lng > 180)) {
    return res.status(400).json({
      success: false,
      error: 'Longitude must be between -180 and 180',
      timestamp: new Date().toISOString()
    });
  }

  if (bounds) {
    const coords = bounds.split(',').map(Number);
    if (coords.length !== 4 || coords.some(isNaN)) {
      return res.status(400).json({
        success: false,
        error: 'Bounds must be in format "minLat,minLon,maxLat,maxLon"',
        timestamp: new Date().toISOString()
      });
    }

    const [minLat, minLon, maxLat, maxLon] = coords;
    if (minLat >= maxLat || minLon >= maxLon) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bounds: min values must be less than max values',
        timestamp: new Date().toISOString()
      });
    }
  }

  next();
};

module.exports = {
  schemas,
  validate,
  validateTrafficData,
  validateAnalyticsQuery,
  validateRouteQuery,
  validateTrafficQuery,
  validateIncidentReport,
  validateWarningSubscription,
  validateApiKeyRequest,
  validateExportRequest,
  sanitizeInput,
  validateCoordinates
};