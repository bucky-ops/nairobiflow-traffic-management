const fs = require('fs');
const path = require('path');

const boundaries = require('../data/boundaries.json');
const landmarks = require('../data/landmarks.json');
const roads = require('../data/roads.json');
const hotspots = require('../data/hotspots.json');
const suburbs = require('../data/suburbs.json');

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