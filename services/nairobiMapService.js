const fs = require('fs');
const path = require('path');

const boundaries = require('../data/nairobi-boundaries.json');
const landmarks = require('../data/nairobi-landmarks.json');
const roads = require('../data/nairobi-roads.json');
const hotspots = require('../data/nairobi-hotspots.json');
const suburbs = require('../data/nairobi-suburbs.json');

/**
 * Service for providing static map data specific to the Nairobi Metropolitan Area.
 * Loads boundaries, landmarks, roads, hotspots, and suburbs from local JSON files.
 */
class NairobiMapService {
  constructor() {
    this.center = { lat: -1.2921, lng: 36.8219 };
    this.zoom = 11;
  }

  /**
   * Retrieves the polygon boundaries of the Nairobi Metropolitan Area.
   * @returns {Object} GeoJSON FeatureCollection of the boundaries.
   */
  getMetropolitanBoundaries() {
    return boundaries;
  }

  /**
   * Retrieves major landmarks and points of interest.
   * @returns {Object} GeoJSON FeatureCollection of landmarks.
   */
  getMajorLandmarks() {
    return landmarks;
  }

  /**
   * Retrieves the major road network data.
   * @returns {Object} GeoJSON FeatureCollection of roads.
   */
  getMajorRoads() {
    return roads;
  }

  /**
   * Retrieves known traffic congestion hotspots.
   * @returns {Object} GeoJSON FeatureCollection of hotspots.
   */
  getTrafficHotspots() {
    return hotspots;
  }

  /**
   * Retrieves data for Nairobi suburbs.
   * @returns {Object} GeoJSON FeatureCollection of suburbs.
   */
  getSuburbs() {
    return suburbs;
  }

  isHealthy() {
    return true;
  }
}

module.exports = NairobiMapService;