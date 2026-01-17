const NairobiMapService = require('../../services/nairobiMapService');

describe('NairobiMapService', () => {
    let service;

    beforeEach(() => {
        service = new NairobiMapService();
    });

    it('should return metropolitan boundaries', () => {
        const boundaries = service.getMetropolitanBoundaries();
        expect(boundaries).toBeDefined();
        expect(boundaries.type).toBe('FeatureCollection');
        expect(boundaries.features).toHaveLength(1);
        expect(boundaries.features[0].properties.name).toBe('Nairobi Metropolitan Area');
    });

    it('should return major landmarks', () => {
        const landmarks = service.getMajorLandmarks();
        expect(landmarks).toBeDefined();
        expect(landmarks.type).toBe('FeatureCollection');
        expect(landmarks.features.length).toBeGreaterThan(0);
    });

    it('should return major roads', () => {
        const roads = service.getMajorRoads();
        expect(roads).toBeDefined();
        expect(roads.type).toBe('FeatureCollection');
        expect(roads.features.length).toBeGreaterThan(0);
        expect(roads.features[0].geometry.type).toBe('LineString');
    });

    it('should return traffic hotspots', () => {
        const hotspots = service.getTrafficHotspots();
        expect(hotspots).toBeDefined();
        expect(hotspots.type).toBe('FeatureCollection');
        expect(hotspots.features.length).toBeGreaterThan(0);
    });

    it('should return suburbs', () => {
        const suburbs = service.getSuburbs();
        expect(suburbs).toBeDefined();
        expect(suburbs.type).toBe('FeatureCollection');
    });

    it('should be healthy', () => {
        expect(service.isHealthy()).toBe(true);
    });
});
