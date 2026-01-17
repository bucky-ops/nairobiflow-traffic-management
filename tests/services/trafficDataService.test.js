const TrafficDataService = require('../../services/trafficDataService');
const NodeCache = require('node-cache');
const axios = require('axios');
const database = require('../../config/database');
const { performanceLogger } = require('../../utils/logger');

// Mock dependencies
jest.mock('node-cache');
jest.mock('axios');
jest.mock('../../config/database', () => ({
    getModel: jest.fn(),
    isConnected: true,
    healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
}));
jest.mock('../../utils/logger', () => ({
    logger: {
        error: jest.fn(),
        debug: jest.fn(),
        info: jest.fn()
    },
    performanceLogger: {
        logCacheOperation: jest.fn(),
        logExternalApiCall: jest.fn()
    },
    businessLogger: {
        logTrafficData: jest.fn()
    }
}));

describe('TrafficDataService', () => {
    let service;
    let mockCache;
    let mockTrafficDataModel;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup Cache Mock
        mockCache = {
            get: jest.fn(),
            set: jest.fn(),
            getStats: jest.fn().mockReturnValue({ keys: 10, hits: 20, misses: 5 })
        };
        NodeCache.mockImplementation(() => mockCache);

        // Setup DB Model Mock
        mockTrafficDataModel = {
            bulkCreate: jest.fn(),
            findAll: jest.fn(),
            create: jest.fn()
        };
        database.getModel.mockReturnValue(mockTrafficDataModel);

        // Initialize service
        service = new TrafficDataService();
    });

    describe('getRouteInfo', () => {
        const start = '-1.2,36.8';
        const end = '-1.3,36.9';
        const cacheKey = `route-${start}-${end}-false`;
        const mockRouteData = { routes: [{ summary: { lengthInMeters: 1000 } }] };

        it('should return cached data if available', async () => {
            mockCache.get.mockReturnValue(mockRouteData);

            const result = await service.getRouteInfo(start, end);

            expect(result).toEqual(mockRouteData);
            expect(mockCache.get).toHaveBeenCalledWith(cacheKey);
            expect(performanceLogger.logCacheOperation).toHaveBeenCalledWith('get', cacheKey, true, expect.any(Number));
            expect(axios.get).not.toHaveBeenCalled();
        });

        it('should fetch from API if not in cache', async () => {
            mockCache.get.mockReturnValue(null);
            axios.get.mockResolvedValue({ data: mockRouteData });

            const result = await service.getRouteInfo(start, end);

            expect(result).toEqual(mockRouteData);
            expect(axios.get).toHaveBeenCalled();
            expect(mockCache.set).toHaveBeenCalledWith(cacheKey, mockRouteData);
            expect(performanceLogger.logExternalApiCall).toHaveBeenCalledWith('tomtom', 'route', expect.any(Number), true);
        });

        it('should handle API errors', async () => {
            mockCache.get.mockReturnValue(null);
            const error = new Error('API Error');
            axios.get.mockRejectedValue(error);

            await expect(service.getRouteInfo(start, end)).rejects.toThrow('API Error');
            expect(performanceLogger.logExternalApiCall).toHaveBeenCalledWith('tomtom', 'route', expect.any(Number), false);
        });
    });

    describe('getLiveTrafficData', () => {
        const defaultBounds = '-1.4449,36.6786,-1.1629,37.0990'; // From NairobiMapService
        const cacheKey = `live-traffic-${defaultBounds}`;

        it('should return cached traffic data', async () => {
            const cachedData = { segments: [] };
            mockCache.get.mockReturnValue(cachedData);

            const result = await service.getLiveTrafficData(defaultBounds);

            expect(result).toEqual(cachedData);
            expect(mockCache.get).toHaveBeenCalledWith(cacheKey);
            expect(performanceLogger.logCacheOperation).toHaveBeenCalled();
            expect(axios.get).not.toHaveBeenCalled();
        });
    });
});
