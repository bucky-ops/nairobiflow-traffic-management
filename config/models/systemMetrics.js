const { DataTypes } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const SystemMetrics = sequelize.define('SystemMetrics', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    metric_type: {
      type: DataTypes.ENUM('performance', 'traffic', 'api', 'database', 'cache', 'system'),
      allowNull: false,
      index: true
    },
    metric_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      index: true
    },
    metric_value: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false
    },
    metric_unit: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    tags: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional tags for categorization'
    },
    timestamp: {
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
    tableName: 'system_metrics',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_metrics_type_name',
        fields: ['metric_type', 'metric_name']
      },
      {
        name: 'idx_metrics_timestamp',
        fields: ['timestamp']
      },
      {
        name: 'idx_metrics_type_timestamp',
        fields: ['metric_type', 'timestamp']
      }
    ]
  });

  // Instance methods
  SystemMetrics.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    return values;
  };

  // Class methods
  SystemMetrics.recordMetric = function(metricType, metricName, value, unit = null, tags = {}) {
    return this.create({
      metric_type: metricType,
      metric_name: metricName,
      metric_value: value,
      metric_unit: unit,
      tags: tags
    });
  };

  SystemMetrics.getMetricsByType = function(metricType, timeWindow = 3600, options = {}) {
    const timeAgo = new Date(Date.now() - timeWindow * 1000);
    
    const defaultOptions = {
      where: {
        metric_type: metricType,
        timestamp: {
          [sequelize.Sequelize.Op.gte]: timeAgo
        }
      },
      order: [['timestamp', 'DESC']]
    };
    
    return this.findAll({ ...defaultOptions, ...options });
  };

  SystemMetrics.getMetricsByName = function(metricName, timeWindow = 3600, options = {}) {
    const timeAgo = new Date(Date.now() - timeWindow * 1000);
    
    const defaultOptions = {
      where: {
        metric_name: metricName,
        timestamp: {
          [sequelize.Sequelize.Op.gte]: timeAgo
        }
      },
      order: [['timestamp', 'DESC']]
    };
    
    return this.findAll({ ...defaultOptions, ...options });
  };

  SystemMetrics.getLatestMetrics = function(metricType, metricName = null, options = {}) {
    const whereClause = {
      metric_type: metricType
    };
    
    if (metricName) {
      whereClause.metric_name = metricName;
    }
    
    const defaultOptions = {
      where: whereClause,
      order: [['timestamp', 'DESC']],
      limit: 1
    };
    
    return this.findOne({ ...defaultOptions, ...options });
  };

  SystemMetrics.getAggregatedMetrics = function(metricType, metricName, timeWindow = 3600, aggregation = 'AVG') {
    const timeAgo = new Date(Date.now() - timeWindow * 1000);
    
    return this.findOne({
      where: {
        metric_type: metricType,
        metric_name: metricName,
        timestamp: {
          [sequelize.Sequelize.Op.gte]: timeAgo
        }
      },
      attributes: [
        [sequelize.fn(aggregation, sequelize.col('metric_value')), 'value'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('MIN', sequelize.col('metric_value')), 'min_value'],
        [sequelize.fn('MAX', sequelize.col('metric_value')), 'max_value']
      ],
      raw: true
    });
  };

  SystemMetrics.getMetricsInTimeRange = function(startDate, endDate, metricType = null, metricName = null, options = {}) {
    const whereClause = {
      timestamp: {
        [sequelize.Sequelize.Op.between]: [startDate, endDate]
      }
    };
    
    if (metricType) whereClause.metric_type = metricType;
    if (metricName) whereClause.metric_name = metricName;
    
    const defaultOptions = {
      where: whereClause,
      order: [['timestamp', 'DESC']]
    };
    
    return this.findAll({ ...defaultOptions, ...options });
  };

  SystemMetrics.cleanupOldMetrics = function(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    return this.destroy({
      where: {
        timestamp: {
          [sequelize.Sequelize.Op.lt]: cutoffDate
        }
      }
    });
  };

  // Static methods for recording specific metric types
  SystemMetrics.recordPerformanceMetric = function(name, value, unit = 'ms', tags = {}) {
    return this.recordMetric('performance', name, value, unit, tags);
  };

  SystemMetrics.recordTrafficMetric = function(name, value, unit = null, tags = {}) {
    return this.recordMetric('traffic', name, value, unit, tags);
  };

  SystemMetrics.recordApiMetric = function(name, value, unit = null, tags = {}) {
    return this.recordMetric('api', name, value, unit, tags);
  };

  SystemMetrics.recordDatabaseMetric = function(name, value, unit = 'ms', tags = {}) {
    return this.recordMetric('database', name, value, unit, tags);
  };

  SystemMetrics.recordCacheMetric = function(name, value, unit = null, tags = {}) {
    return this.recordMetric('cache', name, value, unit, tags);
  };

  SystemMetrics.recordSystemMetric = function(name, value, unit = null, tags = {}) {
    return this.recordMetric('system', name, value, unit, tags);
  };

  // Helper method to get system health metrics
  SystemMetrics.getSystemHealth = async function() {
    const metrics = {};
    
    // Get latest performance metrics
    const performanceMetrics = await this.getLatestMetrics('performance');
    if (performanceMetrics) {
      metrics.performance = {
        response_time: performanceMetrics.metric_value,
        unit: performanceMetrics.metric_unit,
        timestamp: performanceMetrics.timestamp
      };
    }
    
    // Get latest database metrics
    const databaseMetrics = await this.getLatestMetrics('database');
    if (databaseMetrics) {
      metrics.database = {
        query_time: databaseMetrics.metric_value,
        unit: databaseMetrics.metric_unit,
        timestamp: databaseMetrics.timestamp
      };
    }
    
    // Get latest API metrics
    const apiMetrics = await this.getLatestMetrics('api');
    if (apiMetrics) {
      metrics.api = {
        requests_per_minute: apiMetrics.metric_value,
        unit: apiMetrics.metric_unit,
        timestamp: apiMetrics.timestamp
      };
    }
    
    return metrics;
  };

  return SystemMetrics;
};