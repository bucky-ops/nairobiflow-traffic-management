const { DataTypes } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const WarningSubscription = sequelize.define('WarningSubscription', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    api_key_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'api_keys',
        key: 'id'
      }
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
    radius: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5000,
      comment: 'Radius in meters',
      validate: {
        min: 100,
        max: 50000
      }
    },
    alert_types: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: ['congestion', 'incident', 'severe'],
      validate: {
        isValidAlertTypes(value) {
          const validTypes = ['congestion', 'incident', 'weather', 'construction', 'severe'];
          if (!Array.isArray(value) || !value.every(type => validTypes.includes(type))) {
            throw new Error('Invalid alert types');
          }
        }
      }
    },
    threshold: {
      type: DataTypes.JSON,
      allowNull: true,
      validate: {
        isValidThreshold(value) {
          if (value && typeof value === 'object') {
            if (value.speed !== undefined && (value.speed < 0 || value.speed > 200)) {
              throw new Error('Speed threshold must be between 0 and 200');
            }
            if (value.congestionLevel && !['medium', 'high', 'severe'].includes(value.congestionLevel)) {
              throw new Error('Congestion level must be medium, high, or severe');
            }
            if (value.incidentSeverity && !['high', 'severe'].includes(value.incidentSeverity)) {
              throw new Error('Incident severity must be high or severe');
            }
          }
        }
      }
    },
    webhook_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    email_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    sms_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    notification_frequency: {
      type: DataTypes.ENUM('immediate', 'hourly', 'daily'),
      allowNull: false,
      defaultValue: 'immediate'
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      index: true
    },
    last_notification_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notification_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
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
    tableName: 'warning_subscriptions',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_subscriptions_api_key',
        fields: ['api_key_id']
      },
      {
        name: 'idx_subscriptions_location',
        fields: ['location']
      },
      {
        name: 'idx_subscriptions_active',
        fields: ['active']
      },
      {
        name: 'idx_subscriptions_coordinates',
        fields: ['coordinates'],
        type: 'GIST'
      }
    ]
  });

  // Instance methods
  WarningSubscription.prototype.toJSON = function() {
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

  WarningSubscription.prototype.shouldNotify = function(alertType, alertData) {
    // Check if subscription is active
    if (!this.active) return false;
    
    // Check if alert type is subscribed
    if (!this.alert_types.includes(alertType)) return false;
    
    // Check frequency limits
    if (this.notification_frequency !== 'immediate') {
      const now = new Date();
      const lastNotification = this.last_notification_at;
      
      if (lastNotification) {
        const timeDiff = now - new Date(lastNotification);
        const minInterval = this.notification_frequency === 'hourly' ? 3600000 : 86400000; // 1 hour or 1 day
        
        if (timeDiff < minInterval) return false;
      }
    }
    
    // Check thresholds
    if (this.threshold) {
      if (alertType === 'congestion' && this.threshold.congestionLevel) {
        return alertData.level === this.threshold.congestionLevel || 
               (alertData.level === 'severe' && this.threshold.congestionLevel === 'high');
      }
      
      if (alertType === 'incident' && this.threshold.incidentSeverity) {
        return alertData.severity === this.threshold.incidentSeverity ||
               (alertData.severity === 'severe' && this.threshold.incidentSeverity === 'high');
      }
      
      if (this.threshold.speed && alertData.currentSpeed) {
        return alertData.currentSpeed <= this.threshold.speed;
      }
    }
    
    return true;
  };

  WarningSubscription.prototype.updateNotificationCount = function() {
    this.notification_count += 1;
    this.last_notification_at = new Date();
    return this.save();
  };

  WarningSubscription.prototype.deactivate = function() {
    this.active = false;
    return this.save();
  };

  WarningSubscription.prototype.activate = function() {
    this.active = true;
    return this.save();
  };

  // Class methods
  WarningSubscription.findByApiKey = function(apiKeyId, options = {}) {
    const defaultOptions = {
      where: { 
        api_key_id: apiKeyId,
        active: true
      },
      order: [['created_at', 'DESC']]
    };
    
    return this.findAll({ ...defaultOptions, ...options });
  };

  WarningSubscription.findByLocation = function(location, options = {}) {
    const defaultOptions = {
      where: { 
        location,
        active: true
      },
      order: [['created_at', 'DESC']]
    };
    
    return this.findAll({ ...defaultOptions, ...options });
  };

  WarningSubscription.findNearCoordinates = function(lat, lng, radiusKm = 10, options = {}) {
    const point = sequelize.fn('ST_MakePoint', lng, lat);
    const bufferedPoint = sequelize.fn('ST_Buffer', point, radiusKm / 111.32); // Approximate km to degrees
    
    const defaultOptions = {
      where: {
        active: true,
        [sequelize.Sequelize.Op.and]: sequelize.where(
          sequelize.fn('ST_Contains', bufferedPoint, sequelize.col('coordinates')),
          true
        )
      },
      order: [['created_at', 'DESC']]
    };
    
    return this.findAll({ ...defaultOptions, ...options });
  };

  WarningSubscription.findSubscriptionsForAlert = function(alertType, alertData, options = {}) {
    const lat = alertData.coordinates?.lat || alertData.lat;
    const lng = alertData.coordinates?.lng || alertData.lng;
    
    if (!lat || !lng) {
      return this.findAll({
        where: {
          active: true,
          alert_types: { [sequelize.Sequelize.Op.contains]: [alertType] }
        },
        ...options
      });
    }
    
    // Find subscriptions within a reasonable radius
    const searchRadius = Math.max(alertData.radius || 10, 10); // At least 10km
    return this.findNearCoordinates(lat, lng, searchRadius, {
      where: {
        active: true,
        alert_types: { [sequelize.Sequelize.Op.contains]: [alertType] }
      },
      ...options
    });
  };

  WarningSubscription.getSubscriptionStats = function(apiKeyId) {
    const whereClause = apiKeyId ? { api_key_id: apiKeyId } : {};
    
    return this.findAll({
      where: whereClause,
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_subscriptions'],
        [sequelize.fn('COUNT', sequelize.fn('CASE', sequelize.literal('WHEN active = true THEN 1 END')), 'active_subscriptions'],
        [sequelize.fn('SUM', sequelize.col('notification_count')), 'total_notifications']
      ],
      raw: true
    });
  };

  WarningSubscription.cleanupInactive = function(daysInactive = 30) {
    const cutoffDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000);
    
    return this.update(
      { active: false },
      {
        where: {
          last_notification_at: {
            [sequelize.Sequelize.Op.lt]: cutoffDate
          },
          notification_count: {
            [sequelize.Sequelize.Op.gt]: 0
          }
        }
      }
    );
  };

  // Hooks
  WarningSubscription.beforeCreate((subscription) => {
    // Validate alert types
    if (!Array.isArray(subscription.alert_types)) {
      subscription.alert_types = ['congestion', 'incident', 'severe'];
    }
  });

  WarningSubscription.beforeUpdate((subscription) => {
    // Reset notification count if reactivated
    if (subscription.changed('active') && subscription.active) {
      subscription.notification_count = 0;
      subscription.last_notification_at = null;
    }
  });

  return WarningSubscription;
};