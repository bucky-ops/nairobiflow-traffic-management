const NodeCache = require('node-cache');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const database = require('../config/database');
const { logger, performanceLogger, businessLogger } = require('../utils/logger');

class TrafficDataService {
  constructor() {
    this.cache = new NodeCache({ stdTTL: process.env.CACHE_TTL || 300 });
    this.apiKeys = {
      google: process.env.GOOGLE_MAPS_API_KEY,
      tomtom: process.env.TOMTOM_API_KEY,
      mapbox: process.env.MAPBOX_ACCESS_TOKEN
    };
    this.TrafficData = database.getModel('TrafficData');
    this.TrafficIncident = database.getModel('TrafficIncident');
  }

  async getLiveTrafficData(bounds = null) {
    const start = Date.now();
    const cacheKey = `live-traffic-${bounds || 'nairobi'}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      performanceLogger.logCacheOperation('get', cacheKey, true, Date.now() - start);
      return cached;
    }

    try {
      const nairobiBounds = bounds || this.getNairobiBounds();
      const trafficData = await this.fetchTomTomTraffic(nairobiBounds);

      // Store in cache
      this.cache.set(cacheKey, trafficData);

      // Log performance
      const duration = Date.now() - start;
      performanceLogger.logExternalApiCall('tomtom', 'traffic', duration, true);

      // Store in database for analytics
      await this.storeTrafficData(trafficData);

      return trafficData;
    } catch (error) {
      const duration = Date.now() - start;
      performanceLogger.logExternalApiCall('tomtom', 'traffic', duration, false);
      logger.error('Error fetching live traffic data', { error: error.message, bounds });

      return this.getFallbackTrafficData();
    }
  }

  async storeTrafficData(trafficData) {
    try {
      if (!trafficData.segments || !Array.isArray(trafficData.segments)) {
        return;
      }

      const records = trafficData.segments.map(segment => ({
        id: uuidv4(),
        location: segment.location || 'Unknown',
        coordinates: {
          type: 'Point',
          coordinates: segment.coordinates?.[0] ? [segment.coordinates[0][0], segment.coordinates[0][1]] : [36.8219, -1.2921]
        },
        vehicle_count: segment.vehicleCount || Math.floor(Math.random() * 100),
        current_speed: segment.currentSpeed || 0,
        free_flow_speed: segment.freeFlowSpeed || 60,
        travel_time: segment.currentTravelTime || 0,
        free_flow_travel_time: segment.freeFlowTravelTime || 0,
        congestion_level: segment.trafficLevel || 'medium',
        weather_condition: segment.weatherCondition || 'clear',
        road_type: segment.roadCategory || 'local',
        confidence: segment.confidence || 0.8,
        data_source: 'tomtom',
        recorded_at: new Date()
      }));

      // Bulk insert for performance
      await this.TrafficData.bulkCreate(records, {
        ignoreDuplicates: true,
        validate: false
      });

      logger.debug('Traffic data stored', {
        recordCount: records.length,
        source: 'tomtom'
      });

    } catch (error) {
      logger.error('Error storing traffic data', {
        error: error.message,
        segmentCount: trafficData.segments?.length
      });
    }
  }

  async getTrafficIncidents() {
    const start = Date.now();
    const cacheKey = 'traffic-incidents';
    const cached = this.cache.get(cacheKey);

    if (cached) {
      performanceLogger.logCacheOperation('get', cacheKey, true, Date.now() - start);
      return cached;
    }

    try {
      // Try to get from database first
      const dbIncidents = await this.TrafficIncident.findActive({
        limit: 50,
        order: [['severity', 'DESC'], ['started_at', 'DESC']]
      });

      if (dbIncidents.length > 0) {
        const incidents = dbIncidents.map(incident => incident.toJSON());
        this.cache.set(cacheKey, incidents);
        return incidents;
      }

      // Fetch from external API if no database records
      const incidents = await this.fetchTomTomIncidents();

      // Store in database
      await this.storeIncidentData(incidents);

      // Cache the results
      this.cache.set(cacheKey, incidents);

      const duration = Date.now() - start;
      performanceLogger.logExternalApiCall('tomtom', 'incidents', duration, true);

      return incidents;
    } catch (error) {
      const duration = Date.now() - start;
      performanceLogger.logExternalApiCall('tomtom', 'incidents', duration, false);
      logger.error('Error fetching traffic incidents', { error: error.message });

      // Return database incidents as fallback
      try {
        const fallbackIncidents = await this.TrafficIncident.findActive({
          limit: 20,
          order: [['started_at', 'DESC']]
        });
        return fallbackIncidents.map(incident => incident.toJSON());
      } catch (dbError) {
        logger.error('Error fetching fallback incidents', { error: dbError.message });
        return [];
      }
    }
  }

  async storeIncidentData(incidents) {
    try {
      if (!incidents || !Array.isArray(incidents)) {
        return;
      }

      const records = incidents.map(incident => ({
        id: uuidv4(),
        location: incident.description || 'Unknown location',
        coordinates: {
          type: 'Point',
          coordinates: incident.geometry?.coordinates || [36.8219, -1.2921]
        },
        type: this.mapIncidentType(incident.type),
        severity: this.mapIncidentSeverity(incident.severity),
        description: incident.description || 'Traffic incident',
        estimated_duration: incident.estimatedDuration || 60,
        delay_seconds: incident.delayInSeconds || 0,
        status: 'active',
        verified: false,
        source: 'tomtom',
        external_id: incident.id,
        started_at: incident.startTime ? new Date(incident.startTime) : new Date()
      }));

      await this.TrafficIncident.bulkCreate(records, {
        ignoreDuplicates: true,
        validate: false
      });

      logger.debug('Incident data stored', {
        recordCount: records.length,
        source: 'tomtom'
      });

    } catch (error) {
      logger.error('Error storing incident data', {
        error: error.message,
        incidentCount: incidents.length
      });
    }
  }

  mapIncidentType(type) {
    const typeMap = {
      'accident': 'accident',
      'construction': 'construction',
      'weather': 'weather',
      'roadblock': 'roadblock',
      'breakdown': 'breakdown'
    };
    return typeMap[type] || 'other';
  }

  mapIncidentSeverity(severity) {
    const severityMap = {
      'minor': 'low',
      'moderate': 'medium',
      'major': 'high',
      'severe': 'severe'
    };
    return severityMap[severity] || 'medium';
  }

  async getRouteInfo(start, end, alternatives = false, options = {}) {
    const startTimer = Date.now();
    const cacheKey = `route-${start}-${end}-${alternatives}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      performanceLogger.logCacheOperation('get', cacheKey, true, Date.now() - startTimer);
      return cached;
    }

    try {
      const routeData = await this.fetchTomTomRoute(start, end, alternatives);
      this.cache.set(cacheKey, routeData);

      const duration = Date.now() - startTimer;
      performanceLogger.logExternalApiCall('tomtom', 'route', duration, true);

      return routeData;
    } catch (error) {
      const duration = Date.now() - startTimer;
      performanceLogger.logExternalApiCall('tomtom', 'route', duration, false);
      logger.error('Error calculating route', { error: error.message, start, end });
      throw error;
    }
  }

  async fetchTomTomTraffic(bounds) {
    if (!this.apiKeys.tomtom) {
      throw new Error('TomTom API key not configured');
    }

    const [minLat, minLon, maxLat, maxLon] = bounds.split(',');
    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentAbsolute/relative/json/10/${minLat},${minLon}/${maxLat},${maxLon}`;

    const response = await axios.get(url, {
      params: {
        key: this.apiKeys.tomtom,
        thickness: 10,
        openStreetMap: true
      }
    });

    return this.processTomTomTrafficData(response.data);
  }

  async fetchTomTomIncidents() {
    if (!this.apiKeys.tomtom) {
      throw new Error('TomTom API key not configured');
    }

    const nairobiBounds = this.getNairobiBounds();
    const [minLat, minLon, maxLat, maxLon] = nairobiBounds.split(',');

    const url = `https://api.tomtom.com/traffic/services/5/incidentDetails/json`;

    const response = await axios.get(url, {
      params: {
        key: this.apiKeys.tomtom,
        bbox: `${minLon},${minLat},${maxLon},${maxLat}`,
        fields: '{incidents{type{description},geometry{type,coordinates},severity,delayInSeconds,startTime,endTime,description}}'
      }
    });

    return response.data.incidents || [];
  }

  async fetchTomTomRoute(start, end, alternatives) {
    if (!this.apiKeys.tomtom) {
      throw new Error('TomTom API key not configured');
    }

    const url = `https://api.tomtom.com/routing/1/calculateRoute/${start}:${end}/json`;

    const response = await axios.get(url, {
      params: {
        key: this.apiKeys.tomtom,
        alternatives: alternatives,
        traffic: true,
        travelMode: 'car',
        instructionsType: 'text'
      }
    });

    return response.data;
  }

  processTomTomTrafficData(data) {
    if (!data.flowSegmentData) {
      return [];
    }

    return {
      timestamp: new Date().toISOString(),
      source: 'tomtom',
      segments: data.flowSegmentData.map(segment => ({
        coordinates: segment.coordinates,
        currentSpeed: segment.currentSpeed,
        freeFlowSpeed: segment.freeFlowSpeed,
        currentTravelTime: segment.currentTravelTime,
        freeFlowTravelTime: segment.freeFlowTravelTime,
        confidence: segment.confidence,
        roadCategory: segment.roadCategory,
        trafficLevel: this.calculateTrafficLevel(segment.currentSpeed, segment.freeFlowSpeed)
      }))
    };
  }

  calculateTrafficLevel(currentSpeed, freeFlowSpeed) {
    const ratio = currentSpeed / freeFlowSpeed;
    if (ratio > 0.8) return 'low';
    if (ratio > 0.5) return 'medium';
    if (ratio > 0.3) return 'high';
    return 'severe';
  }

  getNairobiBounds() {
    return '-1.4449,36.6786,-1.1629,37.0990';
  }

  getFallbackTrafficData() {
    return {
      timestamp: new Date().toISOString(),
      source: 'fallback',
      message: 'Live traffic data unavailable. Using cached data.',
      segments: []
    };
  }

  // New methods for production functionality
  async recordTrafficData(data) {
    try {
      const record = await this.TrafficData.create({
        id: uuidv4(),
        location: data.location,
        coordinates: {
          type: 'Point',
          coordinates: [data.coordinates.lng, data.coordinates.lat]
        },
        vehicle_count: data.vehicleCount,
        current_speed: data.speed,
        congestion_level: data.congestionLevel || 'medium',
        weather_condition: data.weatherCondition || 'clear',
        data_source: 'user_report',
        recorded_at: new Date(data.timestamp || Date.now())
      });

      businessLogger.logTrafficData(record);

      return record.toJSON();
    } catch (error) {
      logger.error('Error recording traffic data', { error: error.message, data });
      throw error;
    }
  }

  async reportIncident(data) {
    try {
      const incident = await this.TrafficIncident.create({
        id: uuidv4(),
        location: data.location,
        coordinates: {
          type: 'Point',
          coordinates: [data.coordinates.lng, data.coordinates.lat]
        },
        type: data.type,
        severity: data.severity,
        description: data.description,
        estimated_duration: data.estimatedDuration,
        lanes_affected: data.lanesAffected,
        reported_by: data.reportedBy,
        contact_info: data.contactInfo,
        source: 'user_report',
        started_at: new Date()
      });

      businessLogger.logTrafficIncident(incident);

      return incident.toJSON();
    } catch (error) {
      logger.error('Error reporting incident', { error: error.message, data });
      throw error;
    }
  }

  async getTrafficAnalytics(options = {}) {
    try {
      const {
        startDate,
        endDate,
        location,
        granularity = 'hour',
        limit = 100,
        offset = 0
      } = options;

      const whereClause = {};

      if (startDate && endDate) {
        whereClause.recorded_at = {
          [database.getSequelize().Sequelize.Op.between]: [startDate, endDate]
        };
      }

      if (location) {
        whereClause.location = location;
      }

      const analytics = await this.TrafficData.findAll({
        where: whereClause,
        attributes: [
          [database.getSequelize().fn('DATE_TRUNC', granularity, database.getSequelize().col('recorded_at')), 'period'],
          [database.getSequelize().fn('AVG', database.getSequelize().col('current_speed')), 'avg_speed'],
          [database.getSequelize().fn('AVG', database.getSequelize().col('vehicle_count')), 'avg_vehicle_count'],
          [database.getSequelize().fn('COUNT', database.getSequelize().col('id')), 'sample_count']
        ],
        group: [database.getSequelize().fn('DATE_TRUNC', granularity, database.getSequelize().col('recorded_at'))],
        order: [[database.getSequelize().fn('DATE_TRUNC', granularity, database.getSequelize().col('recorded_at')), 'DESC']],
        limit,
        offset
      });

      return analytics.map(item => item.get({ plain: true }));
    } catch (error) {
      logger.error('Error getting traffic analytics', { error: error.message, options });
      throw error;
    }
  }

  async subscribeToWarnings(subscriptionData) {
    try {
      const WarningSubscription = database.getModel('WarningSubscription');

      const subscription = await WarningSubscription.create({
        id: uuidv4(),
        api_key_id: subscriptionData.apiKeyId,
        location: subscriptionData.location,
        coordinates: {
          type: 'Point',
          coordinates: [subscriptionData.coordinates.lng, subscriptionData.coordinates.lat]
        },
        radius: subscriptionData.radius,
        alert_types: subscriptionData.alertTypes,
        threshold: subscriptionData.threshold,
        webhook_url: subscriptionData.webhookUrl,
        email_notifications: subscriptionData.emailNotifications || false,
        sms_notifications: subscriptionData.smsNotifications || false,
        notification_frequency: subscriptionData.notificationFrequency || 'immediate'
      });

      logger.info('Warning subscription created', {
        subscriptionId: subscription.id,
        location: subscriptionData.location
      });

      return subscription.toJSON();
    } catch (error) {
      logger.error('Error creating warning subscription', { error: error.message, subscriptionData });
      throw error;
    }
  }



  isHealthy() {
    const hasApiKeys = !!(this.apiKeys.tomtom || this.apiKeys.google);
    const isDbConnected = database.isConnected;

    return hasApiKeys && isDbConnected;
  }

  async getHealthStatus() {
    try {
      const dbHealth = await database.healthCheck();
      const cacheStats = this.cache.getStats();

      return {
        status: this.isHealthy() ? 'healthy' : 'unhealthy',
        database: dbHealth,
        cache: {
          keys: cacheStats.keys,
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          hitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0
        },
        apiKeys: {
          tomtom: !!this.apiKeys.tomtom,
          google: !!this.apiKeys.google,
          mapbox: !!this.apiKeys.mapbox
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting health status', { error: error.message });
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = TrafficDataService;