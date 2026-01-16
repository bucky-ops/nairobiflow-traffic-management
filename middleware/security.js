const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

class SecurityMiddleware {
    constructor() {
        this.allowedOrigins = this.getAllowedOrigins();
        this.setupRateLimiters();
        this.setupSecurityHeaders();
    }

    getAllowedOrigins() {
        const productionOrigins = [
            'https://nairobi-traffic.example.com',
            'https://www.nairobi-traffic.example.com',
            'https://traffic.nairobi.go.ke'
        ];

        const developmentOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001'
        ];

        const isProduction = process.env.NODE_ENV === 'production';
        const allowedOrigins = isProduction ? productionOrigins : developmentOrigins;

        // Add additional origins from environment variable if provided
        const envOrigins = process.env.ALLOWED_ORIGINS;
        if (envOrigins) {
            allowedOrigins.push(...envOrigins.split(',').map(origin => origin.trim()));
        }

        return allowedOrigins;
    }

    setupRateLimiters() {
        // Strict rate limiter for authentication endpoints
        this.authLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // 5 attempts per 15 minutes
            message: {
                success: false,
                error: 'Too many authentication attempts, please try again later',
                retryAfter: '15 minutes'
            },
            standardHeaders: true,
            legacyHeaders: false,
            skipSuccessfulRequests: false,
            skipFailedRequests: false
        });

        // Medium rate limiter for API endpoints
        this.apiLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 1000, // 1000 requests per 15 minutes
            message: {
                success: false,
                error: 'Too many requests, please try again later',
                retryAfter: '15 minutes',
                limit: '1000 requests per 15 minutes'
            },
            standardHeaders: true,
            legacyHeaders: false
        });

        // Strict rate limiter for expensive endpoints
        this.expensiveLimiter = rateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 60, // 60 requests per minute
            message: {
                success: false,
                error: 'Rate limit exceeded for this endpoint',
                retryAfter: '1 minute',
                limit: '60 requests per minute'
            },
            standardHeaders: true,
            legacyHeaders: false
        });

        // Very strict limiter for traffic data (real-time endpoints)
        this.trafficLimiter = rateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 30, // 30 requests per minute
            message: {
                success: false,
                error: 'Traffic data rate limit exceeded',
                retryAfter: '1 minute',
                limit: '30 requests per minute'
            },
            standardHeaders: true,
            legacyHeaders: false
        });

        // Report rate limiter for incident reporting
        this.reportLimiter = rateLimit({
            windowMs: 5 * 60 * 1000, // 5 minutes
            max: 10, // 10 reports per 5 minutes
            message: {
                success: false,
                error: 'Too many reports submitted, please wait before reporting again',
                retryAfter: '5 minutes',
                limit: '10 reports per 5 minutes'
            },
            standardHeaders: true,
            legacyHeaders: false
        });
    }

    setupSecurityHeaders() {
        // Enhanced helmet configuration
        this.helmetConfig = {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        "https://unpkg.com",
                        "https://fonts.googleapis.com"
                    ],
                    scriptSrc: [
                        "'self'",
                        "'unsafe-eval'",
                        "https://unpkg.com",
                        "https://cdn.socket.io"
                    ],
                    imgSrc: [
                        "'self'",
                        "data:",
                        "https:",
                        "https://*.tile.openstreetmap.org",
                        "https://api.tomtom.com"
                    ],
                    connectSrc: [
                        "'self'",
                        "ws:",
                        "wss:",
                        "https://api.tomtom.com",
                        "https://router.project-osrm.org"
                    ],
                    fontSrc: [
                        "'self'",
                        "https://fonts.gstatic.com"
                    ],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"],
                    childSrc: ["'none'"],
                    workerSrc: ["'self'", "blob:"],
                    manifestSrc: ["'self'"],
                    upgradeInsecureRequests: process.env.NODE_ENV === 'production'
                }
            },
            crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
            crossOriginOpenerPolicy: process.env.NODE_ENV === 'production',
            crossOriginResourcePolicy: { policy: 'cross-origin' },
            dnsPrefetchControl: { allow: false },
            frameguard: { action: 'deny' },
            hidePoweredBy: true,
            hsts: process.env.NODE_ENV === 'production' ? {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            } : false,
            ieNoOpen: true,
            noSniff: true,
            originAgentCluster: true,
            permittedCrossDomainPolicies: false,
            referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
            xssFilter: true
        };
    }

    // CORS configuration with strict origins
    corsOptions = {
        origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, curl, etc.)
            if (!origin) {
                return callback(null, true);
            }

            if (this.allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            // Log blocked origin for security monitoring
            console.warn(`CORS blocked origin: ${origin}`);
            
            return callback(new Error('Not allowed by CORS'), false);
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Origin',
            'X-Requested-With',
            'Content-Type',
            'Accept',
            'Authorization',
            'X-API-Key',
            'Cache-Control',
            'Pragma'
        ],
        exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Limit', 'X-Rate-Limit-Remaining'],
        credentials: true,
        maxAge: 86400, // 24 hours
        optionsSuccessStatus: 204
    };

    // API Key validation middleware
    validateApiKey = (req, res, next) => {
        // Skip API key validation for public endpoints
        const publicEndpoints = [
            '/api/health',
            '/api/nairobi/boundaries',
            '/api/nairobi/landmarks',
            '/api/nairobi/roads',
            '/api/nairobi/hotspots',
            '/'
        ];

        const isPublic = publicEndpoints.some(endpoint => 
            req.path.startsWith(endpoint)
        );

        if (isPublic) {
            return next();
        }

        const apiKey = req.headers['x-api-key'] || req.query.apiKey;
        const validApiKeys = process.env.VALID_API_KEYS 
            ? process.env.VALID_API_KEYS.split(',').map(key => key.trim())
            : [];

        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'API key required for this endpoint',
                timestamp: new Date().toISOString()
            });
        }

        if (!validApiKeys.includes(apiKey)) {
            return res.status(403).json({
                success: false,
                error: 'Invalid API key',
                timestamp: new Date().toISOString()
            });
        }

        // Add API key to request for logging
        req.apiKey = apiKey;
        next();
    };

    // Request logging middleware
    requestLogger = (req, res, next) => {
        const startTime = Date.now();
        
        // Remove sensitive information from logs
        const sanitizedHeaders = { ...req.headers };
        delete sanitizedHeaders.authorization;
        delete sanitizedHeaders['x-api-key'];
        delete sanitizedHeaders.cookie;

        const logData = {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString(),
            headers: sanitizedHeaders
        };

        // Log request
        console.log('API Request:', JSON.stringify(logData, null, 2));

        // Log response
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            const responseLog = {
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                duration: `${duration}ms`,
                timestamp: new Date().toISOString()
            };
            
            console.log('API Response:', JSON.stringify(responseLog, null, 2));

            // Log slow requests
            if (duration > 1000) {
                console.warn('Slow API Request:', responseLog);
            }
        });

        next();
    };

    // Input sanitization middleware
    inputSanitization = (req, res, next) => {
        const sanitizeString = (str) => {
            if (typeof str !== 'string') return str;
            
            return str
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '')
                .replace(/eval\(/gi, '')
                .replace(/expression\(/gi, '')
                .trim();
        };

        const sanitizeObject = (obj) => {
            if (typeof obj === 'string') {
                return sanitizeString(obj);
            }
            
            if (Array.isArray(obj)) {
                return obj.map(sanitizeObject);
            }
            
            if (obj && typeof obj === 'object') {
                const sanitized = {};
                for (const [key, value] of Object.entries(obj)) {
                    sanitized[sanitizeString(key)] = sanitizeObject(value);
                }
                return sanitized;
            }
            
            return obj;
        };

        req.body = sanitizeObject(req.body);
        req.query = sanitizeObject(req.query);
        req.params = sanitizeObject(req.params);

        next();
    };

    // Security monitoring middleware
    securityMonitoring = (req, res, next) => {
        const suspiciousPatterns = [
            /\.\./,  // Directory traversal
            /<script/i,  // Script injection
            /javascript:/i,  // JavaScript protocol
            /on\w+\s*=/i,  // Event handlers
            /union\s+select/i,  // SQL injection
            /select\s+.*\s+from/i,  // SQL injection
            /drop\s+table/i,  // SQL injection
            /insert\s+into/i,  // SQL injection
            /delete\s+from/i,  // SQL injection
            /update\s+.*\s+set/i  // SQL injection
        ];

        const checkSuspiciousInput = (input) => {
            if (typeof input === 'string') {
                return suspiciousPatterns.some(pattern => pattern.test(input));
            }
            if (typeof input === 'object' && input !== null) {
                return Object.values(input).some(value => checkSuspiciousInput(value));
            }
            return false;
        };

        const requestData = { ...req.body, ...req.query, ...req.params };
        
        if (checkSuspiciousInput(requestData)) {
            console.warn('Suspicious input detected:', {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                url: req.originalUrl,
                method: req.method,
                timestamp: new Date().toISOString(),
                data: requestData
            });

            return res.status(400).json({
                success: false,
                error: 'Invalid input detected',
                timestamp: new Date().toISOString()
            });
        }

        next();
    };
}

module.exports = new SecurityMiddleware();