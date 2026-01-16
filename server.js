const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

// Import security middleware
const security = require('./middleware/security');
const { validateTrafficData, validateAnalyticsQuery, validateRouteQuery, validateTrafficQuery, validateIncidentReport, validateWarningSubscription } = require('./middleware/validation');

// Import logging and database
const { requestLogger, errorLogger, healthLogger } = require('./utils/logger');
const database = require('./config/database');

const app = express();
const server = http.createServer(app);

// Apply security middleware
app.use(helmet()); // Replaced security.helmetConfig with direct helmet()
app.use(cors({ // Replaced security.corsOptions with direct cors()
    origin: process.env.CLIENT_URL || "http://localhost:3000"
}));
app.use(security.requestLogger);
app.use(security.inputSanitization);
app.use(security.securityMonitoring);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(security.apiLimiter);

// Static files with security headers
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
    etag: true,
    lastModified: true
}));

// Socket.IO with CORS
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000", // Updated CORS origin
        methods: ["GET", "POST"],
        credentials: true
    }
});

const PORT = process.env.PORT || 3000;

const TrafficDataService = require('./services/trafficDataService');
const NairobiMapService = require('./services/nairobiMapService');
// Removed duplicate import: const { validateAnalyticsQuery } = require('./middleware/validation');

const trafficService = new TrafficDataService();
const nairobiService = new NairobiMapService();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Apply API key validation to protected endpoints
app.use('/api/traffic', security.validateApiKey);
app.use('/api/analytics', security.validateApiKey);
app.use('/api/warnings', security.validateApiKey);
app.use('/api/export', security.validateApiKey);

// Nairobi data endpoints (public)
app.get('/api/nairobi/boundaries', (req, res) => {
    res.json(nairobiService.getMetropolitanBoundaries());
});

app.get('/api/nairobi/landmarks', (req, res) => {
    res.json(nairobiService.getMajorLandmarks());
});

app.get('/api/nairobi/roads', (req, res) => {
    res.json(nairobiService.getMajorRoads());
});

app.get('/api/nairobi/hotspots', (req, res) => {
    res.json(nairobiService.getTrafficHotspots());
});

app.get('/api/nairobi/suburbs', (req, res) => {
    res.json(nairobiService.getSuburbs());
});

app.get('/api/nairobi/metadata', (req, res) => {
    res.json(nairobiService.getDataMetadata());
});

// Traffic endpoints (protected)
app.get('/api/traffic/live', validateTrafficQuery, security.trafficLimiter, async (req, res) => {
    try {
        const { bounds } = req.query;
        const trafficData = await trafficService.getLiveTrafficData(bounds);
        res.json({
            success: true,
            data: trafficData,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch live traffic data',
            timestamp: new Date().toISOString()
        });
    }
});

app.get('/api/traffic/incidents', security.trafficLimiter, async (req, res) => {
    try {
        const incidents = await trafficService.getTrafficIncidents();
        res.json({
            success: true,
            data: incidents,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch traffic incidents',
            timestamp: new Date().toISOString()
        });
    }
});

app.get('/api/traffic/route', validateRouteQuery, security.expensiveLimiter, async (req, res) => {
    try {
        const { start, end, alternatives, avoidTolls, avoidHighways, vehicleType } = req.query;
        const routeData = await trafficService.getRouteInfo(start, end, alternatives, { avoidTolls, avoidHighways, vehicleType });
        res.json({
            success: true,
            data: routeData,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to calculate route',
            timestamp: new Date().toISOString()
        });
    }
});

// New endpoints with full validation
app.post('/api/traffic/data', validateTrafficData, security.reportLimiter, async (req, res) => {
    try {
        const trafficRecord = await trafficService.recordTrafficData(req.body);
        res.status(201).json({
            success: true,
            data: trafficRecord,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to record traffic data',
            timestamp: new Date().toISOString()
        });
    }
});

app.post('/api/traffic/incidents', validateIncidentReport, security.reportLimiter, async (req, res) => {
    try {
        const incident = await trafficService.reportIncident(req.body);
        res.status(201).json({
            success: true,
            data: incident,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to report incident',
            timestamp: new Date().toISOString()
        });
    }
});

app.get('/api/analytics/traffic', validateAnalyticsQuery, security.expensiveLimiter, async (req, res) => {
    try {
        const { startDate, endDate, location, granularity, limit, offset } = req.query;
        const analytics = await trafficService.getTrafficAnalytics({
            startDate,
            endDate,
            location,
            granularity,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        res.json({
            success: true,
            data: analytics,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch analytics',
            timestamp: new Date().toISOString()
        });
    }
});

app.post('/api/warnings/subscribe', validateWarningSubscription, security.apiLimiter, async (req, res) => {
    try {
        const subscription = await trafficService.subscribeToWarnings(req.body);
        res.status(201).json({
            success: true,
            data: subscription,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to create warning subscription',
            timestamp: new Date().toISOString()
        });
    }
});

io.on('connection', (socket) => {
    console.log('Client connected for live updates');

    socket.on('subscribe-traffic', (bounds) => {
        socket.join(`traffic-${bounds}`);
        console.log(`Client subscribed to traffic updates for bounds: ${bounds}`);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

const broadcastTrafficUpdates = async () => {
    try {
        const trafficData = await trafficService.getLiveTrafficData();
        io.emit('traffic-update', trafficData);
    } catch (error) {
        console.error('Error broadcasting traffic updates:', error);
    }
};

setInterval(broadcastTrafficUpdates, 30000);

app.get('/api/health', (req, res) => {
    const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: require('./package.json').version,
        environment: process.env.NODE_ENV || 'development',
        services: {
            traffic: trafficService.isHealthy(),
            nairobi: nairobiService.isHealthy(),
            dataIntegrity: nairobiService.validateDataIntegrity()
        },
        security: {
            corsEnabled: true,
            rateLimiting: true,
            validationEnabled: true
        },
        system: {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            nodeVersion: process.version
        }
    };

    const statusCode = healthStatus.services.traffic && healthStatus.services.nairobi ? 200 : 503;
    res.status(statusCode).json(healthStatus);
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
    console.error('Application Error:', {
        error: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
    });

    // Don't leak error details in production
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;

    res.status(err.status || 500).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        availableEndpoints: [
            'GET /api/health',
            'GET /api/nairobi/boundaries',
            'GET /api/nairobi/landmarks',
            'GET /api/nairobi/roads',
            'GET /api/nairobi/hotspots',
            'GET /api/nairobi/suburbs',
            'GET /api/traffic/live',
            'GET /api/traffic/incidents',
            'GET /api/traffic/route',
            'POST /api/traffic/data',
            'POST /api/traffic/incidents',
            'GET /api/analytics/traffic',
            'POST /api/warnings/subscribe'
        ],
        timestamp: new Date().toISOString()
    });
});

server.listen(PORT, () => {
    console.log(`Nairobi Traffic Analysis System running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Map interface: http://localhost:${PORT}`);
    console.log(`Live updates enabled via WebSocket`);
    console.log(`Security: CORS, Rate Limiting, Validation enabled`);
});

module.exports = { app, server, io };