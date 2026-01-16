const { DataTypes } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const TrafficIncident = sequelize.define('TrafficIncident', {
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
    type: {
      type: DataTypes.ENUM('accident', 'construction', 'weather', 'roadblock', 'breakdown', 'other'),
      allowNull: false,
      index: true
    },
    severity: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'severe'),
      allowNull: false,
      index: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 1000]
      }
    },
    estimated_duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Estimated duration in minutes',
      validate: {
        min: 0,
        max: 1440 // Max 24 hours
      }
    },
    lanes_affected: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 10
      }
    },
    delay_seconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Estimated delay in seconds',
      validate: {
        min: 0
      }
    },
    reported_by: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    contact_info: {
      type: DataTypes.STRING(200),
      allowNull: true,
      validate: {
        is: /^[^@\s]+@[^@\s]+\.[^@\s]+$/
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'resolved', 'monitoring'),
      allowNull: false,
      defaultValue: 'active',
      index: true
    },
    verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    traffic_data_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'traffic_data',
        key: 'id'
      }
    },
    source: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'user_report'
    },
    external_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'ID from external traffic service'
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      index: true
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true
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
    tableName: 'traffic_incidents',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_incidents_location_status',
        fields: ['location', 'status']
      },
      {
        name: 'idx_incidents_type_severity',
        fields: ['type', 'severity']
      },
      {
        name: 'idx_incidents_time',
        fields: ['started_at']
      },
      {
        name: 'idx_incidents_coordinates',
        fields: ['coordinates'],
        type: 'GIST'
      }
    ]
  });

  // Instance methods
  TrafficIncident.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    
    // Convert coordinates to readable format
    if (values.coordinates) {
      values.coordinates = {
        lat: this.coordinates.coordinates[1],
        lng: this.coordinates.coordinates[0]
      };
    }
    
    // Calculate duration if started_at is present
    if (values.started_at) {
      const now = new Date();
      const started = new Date(values.started_at);
      values.duration_minutes = Math.floor((now - started) / (1000 * 60));
    }
    
    return values;
  };

  TrafficIncident.prototype.resolve = function() {
    this.status = 'resolved';
    this.resolved_at = new Date();
    return this.save();
  };

  TrafficIncident.prototype.verify = function() {
    this.verified = true;
    return this.save();
  };

  // Class methods
  TrafficIncident.findActive = function(options = {}) {
    const defaultOptions = {
      where: { status: 'active' },
      order: [['severity', 'DESC'], ['started_at', 'DESC']]
    };
    
    return this.findAll({ ...defaultOptions, ...options });
  };

  TrafficIncident.findByType = function(type, options = {}) {
    const defaultOptions = {
      where: { type },
      order: [['started_at', 'DESC']]
    };
    
    return this.findAll({ ...defaultOptions, ...options });
  };

  TrafficIncident.findBySeverity = function(severity, options = {}) {
    const defaultOptions = {
      where: { severity },
      order: [['started_at', 'DESC']]
    };
    
    return this.findAll({ ...defaultOptions, ...options });
  };

  TrafficIncident.findInTimeRange = function(startDate, endDate, options = {}) {
    const defaultOptions = {
      where: {
        started_at: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      order: [['started_at', 'DESC']]
    };
    
    return this.findAll({ ...defaultOptions, ...options });
  };

  TrafficIncident.findNearCoordinates = function(lat, lng, radiusKm = 5, options = {}) {
    const point = sequelize.fn('ST_MakePoint', lng, lat);
    const bufferedPoint = sequelize.fn('ST_Buffer', point, radiusKm / 111.32); // Approximate km to degrees
    
    const defaultOptions = {
      where: {
        status: 'active',
        [sequelize.Sequelize.Op.and]: sequelize.where(
          sequelize.fn('ST_Contains', bufferedPoint, sequelize.col('coordinates')),
          true
        )
      },
      order: [['severity', 'DESC'], ['started_at', 'DESC']]
    };
    
    return this.findAll({ ...defaultOptions, ...options });
  };

  TrafficIncident.getIncidentStats = function(timeWindow = 86400) {
    const timeAgo = new Date(Date.now() - timeWindow * 1000);
    
    return this.findAll({
      where: {
        started_at: {
          [sequelize.Sequelize.Op.gte]: timeAgo
        }
      },
      attributes: [
        'type',
        'severity',
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['type', 'severity', 'status'],
      raw: true
    });
  };

  TrafficIncident.getUnverifiedIncidents = function(options = {}) {
    const defaultOptions = {
      where: { 
        verified: false,
        status: 'active'
      },
      order: [['started_at', 'DESC']]
    };
    
    return this.findAll({ ...defaultOptions, ...options });
  };

  // Hooks
  TrafficIncident.beforeCreate((incident) => {
    // Set default estimated duration based on severity
    if (!incident.estimated_duration) {
      const durationMap = {
        low: 30,      // 30 minutes
        medium: 60,   // 1 hour
        high: 120,    // 2 hours
        severe: 240   // 4 hours
      };
      
      incident.estimated_duration = durationMap[incident.severity] || 60;
    }
  });

  TrafficIncident.beforeUpdate((incident) => {
    // Auto-resolve if estimated duration has passed
    if (incident.changed('status') && incident.status === 'resolved') {
      incident.resolved_at = new Date();
    }
  });

  return TrafficIncident;
};