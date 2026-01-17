const fs = require('fs');
const path = require('path');

const boundaries = require('../data/nairobi-boundaries.json');
const landmarks = require('../data/nairobi-landmarks.json');
const roads = require('../data/nairobi-roads.json');
const hotspots = require('../data/nairobi-hotspots.json');
const suburbs = require('../data/nairobi-suburbs.json');

class NairobiMapService {
  constructor() {
    this.center = { lat: -1.2921, lng: 36.8219 };
    this.zoom = 11;
  }

  getMetropolitanBoundaries() {
    return boundaries;
  }

  getMajorLandmarks() {
    return landmarks;
  }

  getMajorRoads() {
    return roads;
  }

  getTrafficHotspots() {
    return hotspots;
  }

  getSuburbs() {
    return suburbs;
  }

  isHealthy() {
    return true;
  }
}

module.exports = NairobiMapService;