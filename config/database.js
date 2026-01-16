const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const { logger } = require('../utils/logger');

// Database configuration
const config = {
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'nairobi_traffic_dev',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: (msg) => logger.debug('Database', { message: msg }),
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  test: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'nairobi_traffic_test',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 20000,
      idle: 10000
    }
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: (msg) => logger.info('Database', { message: msg }),
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000
    },
    ssl: process.env.DB_SSL === 'true' ? {
      require: true,
      rejectUnauthorized: false
    } : false,
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    }
  }
};

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Create Sequelize instance
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    pool: dbConfig.pool,
    ssl: dbConfig.ssl,
    dialectOptions: dbConfig.dialectOptions,
    
    // Global options
    define: {
      underscored: true,
      freezeTableName: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
);

// Import models
const TrafficData = require('./models/trafficData')(sequelize, DataTypes);
const TrafficIncident = require('./models/trafficIncident')(sequelize, DataTypes);
const WarningSubscription = require('./models/warningSubscription')(sequelize, DataTypes);
const ApiKey = require('./models/apiKey')(sequelize, DataTypes);
const SystemMetrics = require('./models/systemMetrics')(sequelize, DataTypes);

// Define associations
const defineAssociations = () => {
  // TrafficIncident belongs to TrafficData (optional)
  TrafficIncident.belongsTo(TrafficData, {
    foreignKey: 'traffic_data_id',
    as: 'trafficData'
  });

  // WarningSubscription associations
  WarningSubscription.belongsTo(ApiKey, {
    foreignKey: 'api_key_id',
    as: 'apiKey'
  });

  // SystemMetrics has no associations
};

// Database connection class
class Database {
  constructor() {
    this.sequelize = sequelize;
    this.models = {
      TrafficData,
      TrafficIncident,
      WarningSubscription,
      ApiKey,
      SystemMetrics
    };
    this.isConnected = false;
  }

  async connect() {
    try {
      await this.sequelize.authenticate();
      this.isConnected = true;
      
      logger.info('Database connection established successfully', {
        host: dbConfig.host,
        database: dbConfig.database,
        dialect: dbConfig.dialect
      });
      
      return true;
    } catch (error) {
      this.isConnected = false;
      logger.error('Database connection failed', {
        error: error.message,
        host: dbConfig.host,
        database: dbConfig.database
      });
      
      throw error;
    }
  }

  async disconnect() {
    try {
      await this.sequelize.close();
      this.isConnected = false;
      
      logger.info('Database connection closed');
      
      return true;
    } catch (error) {
      logger.error('Error closing database connection', {
        error: error.message
      });
      
      throw error;
    }
  }

  async sync(options = {}) {
    try {
      const defaultOptions = {
        force: false,
        alter: env === 'development'
      };
      
      const syncOptions = { ...defaultOptions, ...options };
      
      await this.sequelize.sync(syncOptions);
      
      logger.info('Database synchronized successfully', {
        force: syncOptions.force,
        alter: syncOptions.alter
      });
      
      return true;
    } catch (error) {
      logger.error('Database synchronization failed', {
        error: error.message
      });
      
      throw error;
    }
  }

  async migrate() {
    try {
      // Run migrations if needed
      await this.sync({ alter: true });
      
      logger.info('Database migration completed');
      
      return true;
    } catch (error) {
      logger.error('Database migration failed', {
        error: error.message
      });
      
      throw error;
    }
  }

  async healthCheck() {
    try {
      const start = Date.now();
      await this.sequelize.authenticate();
      const duration = Date.now() - start;
      
      return {
        status: 'healthy',
        connected: this.isConnected,
        responseTime: `${duration}ms`,
        database: dbConfig.database,
        host: dbConfig.host,
        dialect: dbConfig.dialect
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: this.isConnected,
        error: error.message,
        database: dbConfig.database,
        host: dbConfig.host
      };
    }
  }

  async transaction(callback) {
    const t = await this.sequelize.transaction();
    
    try {
      const result = await callback(t);
      await t.commit();
      return result;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  // Query helper with logging
  async query(sql, options = {}) {
    const start = Date.now();
    
    try {
      const result = await this.sequelize.query(sql, options);
      const duration = Date.now() - start;
      
      logger.debug('Database query executed', {
        sql: sql.substring(0, 100),
        duration: `${duration}ms`,
        rowCount: result[1]?.rowCount || 0
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      logger.error('Database query failed', {
        sql: sql.substring(0, 100),
        duration: `${duration}ms`,
        error: error.message
      });
      
      throw error;
    }
  }

  // Get model by name
  getModel(modelName) {
    return this.models[modelName];
  }

  // Get all models
  getModels() {
    return this.models;
  }

  // Get Sequelize instance
  getSequelize() {
    return this.sequelize;
  }
}

// Create and export database instance
const database = new Database();

// Initialize associations
defineAssociations();

// Handle process termination
process.on('SIGINT', async () => {
  try {
    await database.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  try {
    await database.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
});

module.exports = database;