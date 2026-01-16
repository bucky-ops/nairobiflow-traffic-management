const { DataTypes } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const TrafficData = sequelize.define('TrafficData', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    location: {
      type: DataTypes.STRING(200),
      allowNull: false,
      index: true
    },
    coordinates: {
      type: DataTypes.GEOMETRY('POINT', 4326),
      allowNull: false
    },
    vehicle_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
        max: 10000
      }
    },
    current_speed: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 200
      }
    },
    free_flow_speed: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 200
      }
    },
    travel_time: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Current travel time in seconds'
    },
    free_flow_travel_time: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Free flow travel time in seconds'
    },
    congestion_level: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'severe'),
      allowNull: false,
      index: true
    },
    weather_condition: {
      type: DataTypes.ENUM('clear', 'rain', 'snow', 'fog', 'wind'),
      allowNull: true,
      defaultValue: 'clear'
    },
    road_type: {
      type: DataTypes.ENUM('highway', 'arterial', 'local', 'bypass'),
      allowNull: true
    },
    lanes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 10
      }
    },
    confidence: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 1
      }
    },
    data_source: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'manual'
    },
    recorded_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      index: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'traffic_data',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_traffic_location_time',
        fields: ['location', 'recorded_at']
      },
      {
        name: 'idx_traffic_congestion_time',
        fields: ['congestion_level', 'recorded_at']
      },
      {
        name: 'idx_traffic_coordinates',
        fields: ['coordinates'],
        type: 'GIST'
      }
    ]
  });

  // Instance methods
  TrafficData.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    
    // Convert coordinates to readable format
    if (values.coordinates) {
      values.coordinates = {
        lat: this.coordinates.coordinates[1],
        lng: this.coordinates.coordinates[0]
      };
    }
    
    return values;
  };

  // Class methods
  TrafficData.findByLocation = function(location, options = {}) {
    const defaultOptions = {
      where: { location },
      order: [['recorded_at', 'DESC']],
      limit: 100
    };
    
    return this.findAll({ ...defaultOptions, ...options });
  };

  TrafficData.findByCongestionLevel = function(level, options = {}) {
    const defaultOptions = {
      where: { congestion_level: level },
      order: [['recorded_at', 'DESC']],
      limit: 50
    };
    
    return this.findAll({ ...defaultOptions, ...options });
  };

  TrafficData.findInTimeRange = function(startDate, endDate, options = {}) {
    const defaultOptions = {
      where: {
        recorded_at: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      order: [['recorded_at', 'DESC']]
    };
    
    return this.findAll({ ...defaultOptions, ...options });
  };

  TrafficData.findNearCoordinates = function(lat, lng, radiusKm = 1, options = {}) {
    const point = sequelize.fn('ST_MakePoint', lng, lat);
    const bufferedPoint = sequelize.fn('ST_Buffer', point, radiusKm / 111.32); // Approximate km to degrees
    
    const defaultOptions = {
      where: sequelize.where(
        sequelize.fn('ST_Contains', bufferedPoint, sequelize.col('coordinates')),
        true
      ),
      order: [['recorded_at', 'DESC']],
      limit: 50
    };
    
    return this.findAll({ ...defaultOptions, ...options });
  };

  TrafficData.getAverageSpeed = function(location, timeWindow = 3600) {
    const timeAgo = new Date(Date.now() - timeWindow * 1000);
    
    return this.findOne({
      where: {
        location,
        recorded_at: {
          [sequelize.Sequelize.Op.gte]: timeAgo
        }
      },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('current_speed')), 'average_speed'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'sample_count']
      ],
      raw: true
    });
  };

  TrafficData.getCongestionStats = function(location, timeWindow = 3600) {
    const timeAgo = new Date(Date.now() - timeWindow * 1000);
    
    return this.findAll({
      where: {
        location,
        recorded_at: {
          [sequelize.Sequelize.Op.gte]: timeAgo
        }
      },
      attributes: [
        'congestion_level',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['congestion_level'],
      raw: true
    });
  };

  // Hooks
  TrafficData.beforeCreate((trafficData) => {
    // Auto-calculate congestion level based on speed if not provided
    if (!trafficData.congestion_level && trafficData.current_speed && trafficData.free_flow_speed) {
      const ratio = trafficData.current_speed / trafficData.free_flow_speed;
      
      if (ratio > 0.8) trafficData.congestion_level = 'low';
      else if (ratio > 0.5) trafficData.congestion_level = 'medium';
      else if (ratio > 0.3) trafficData.congestion_level = 'high';
      else trafficData.congestion_level = 'severe';
    }
  });

  TrafficData.beforeUpdate((trafficData) => {
    // Auto-update congestion level if speed changed
    if (trafficData.changed('current_speed') || trafficData.changed('free_flow_speed')) {
      if (trafficData.current_speed && trafficData.free_flow_speed) {
        const ratio = trafficData.current_speed / trafficData.free_flow_speed;
        
        if (ratio > 0.8) trafficData.congestion_level = 'low';
        else if (ratio > 0.5) trafficData.congestion_level = 'medium';
        else if (ratio > 0.3) trafficData.congestion_level = 'high';
        else trafficData.congestion_level = 'severe';
      }
    }
  });

  return TrafficData;
};