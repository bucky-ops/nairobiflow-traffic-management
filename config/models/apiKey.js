const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const ApiKey = sequelize.define('ApiKey', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    key_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      index: true
    },
    key_prefix: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: 'First few characters for identification'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    application_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    contact_email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    usage_type: {
      type: DataTypes.ENUM('commercial', 'non-commercial', 'research', 'internal'),
      allowNull: false,
      defaultValue: 'non-commercial'
    },
    expected_requests: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1000,
      validate: {
        min: 100,
        max: 1000000
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'suspended', 'revoked', 'expired'),
      allowNull: false,
      defaultValue: 'active',
      index: true
    },
    permissions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: ['read'],
      validate: {
        isValidPermissions(value) {
          const validPermissions = ['read', 'write', 'admin', 'analytics', 'export'];
          if (!Array.isArray(value) || !value.every(perm => validPermissions.includes(perm))) {
            throw new Error('Invalid permissions');
          }
        }
      }
    },
    rate_limit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1000,
      comment: 'Requests per hour',
      validate: {
        min: 10,
        max: 10000
      }
    },
    daily_limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 100,
        max: 100000
      }
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      index: true
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    usage_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    today_usage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    today_reset_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    created_by: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
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
    tableName: 'api_keys',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_api_keys_hash',
        fields: ['key_hash'],
        unique: true
      },
      {
        name: 'idx_api_keys_status',
        fields: ['status']
      },
      {
        name: 'idx_api_keys_expires',
        fields: ['expires_at']
      }
    ]
  });

  // Instance methods
  ApiKey.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    
    // Never return the key hash
    delete values.key_hash;
    
    // Return only the prefix for identification
    values.key_id = this.key_prefix;
    
    return values;
  };

  ApiKey.prototype.verifyKey = function(key) {
    return bcrypt.compare(key, this.key_hash);
  };

  ApiKey.prototype.hasPermission = function(permission) {
    return this.permissions.includes(permission) || this.permissions.includes('admin');
  };

  ApiKey.prototype.canMakeRequest = function() {
    // Check if key is active
    if (this.status !== 'active') return false;
    
    // Check if key has expired
    if (this.expires_at && new Date() > new Date(this.expires_at)) return false;
    
    // Check daily limit
    if (this.daily_limit && this.today_usage >= this.daily_limit) return false;
    
    return true;
  };

  ApiKey.prototype.recordUsage = function() {
    this.usage_count += 1;
    this.today_usage += 1;
    this.last_used_at = new Date();
    
    // Reset daily usage if needed
    const now = new Date();
    const lastReset = new Date(this.today_reset_at);
    
    if (now.toDateString() !== lastReset.toDateString()) {
      this.today_usage = 1;
      this.today_reset_at = now;
    }
    
    return this.save();
  };

  ApiKey.prototype.suspend = function(reason) {
    this.status = 'suspended';
    this.notes = reason ? (this.notes ? `${this.notes}\n${reason}` : reason) : this.notes;
    return this.save();
  };

  ApiKey.prototype.revoke = function(reason) {
    this.status = 'revoked';
    this.notes = reason ? (this.notes ? `${this.notes}\n${reason}` : reason) : this.notes;
    return this.save();
  };

  ApiKey.prototype.reactivate = function() {
    this.status = 'active';
    return this.save();
  };

  // Class methods
  ApiKey.findByKey = function(key, options = {}) {
    return this.findOne({
      where: { status: 'active' },
      include: [{
        model: sequelize.models.ApiKey,
        as: 'apiKey',
        where: { key_hash: key },
        required: true
      }],
      ...options
    });
  };

  ApiKey.verifyKey = function(key) {
    return this.findOne({
      where: { 
        status: 'active',
        key_hash: key
      }
    });
  };

  ApiKey.generateKey = async function() {
    const crypto = require('crypto');
    const key = crypto.randomBytes(32).toString('hex');
    const prefix = key.substring(0, 8);
    const hash = await bcrypt.hash(key, 12);
    
    return { key, prefix, hash };
  };

  ApiKey.findByEmail = function(email, options = {}) {
    const defaultOptions = {
      where: { contact_email: email },
      order: [['created_at', 'DESC']]
    };
    
    return this.findAll({ ...defaultOptions, ...options });
  };

  ApiKey.findExpiring = function(days = 30, options = {}) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    
    const defaultOptions = {
      where: {
        status: 'active',
        expires_at: {
          [sequelize.Sequelize.Op.lte]: expiryDate
        }
      },
      order: [['expires_at', 'ASC']]
    };
    
    return this.findAll({ ...defaultOptions, ...options });
  };

  ApiKey.getUsageStats = function(timeWindow = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeWindow);
    
    return this.findAll({
      where: {
        created_at: {
          [sequelize.Sequelize.Op.gte]: startDate
        }
      },
      attributes: [
        'usage_type',
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('usage_count')), 'total_usage'],
        [sequelize.fn('AVG', sequelize.col('usage_count')), 'avg_usage']
      ],
      group: ['usage_type', 'status'],
      raw: true
    });
  };

  ApiKey.resetDailyUsage = function() {
    return this.update(
      { 
        today_usage: 0,
        today_reset_at: new Date()
      },
      {
        where: {
          today_reset_at: {
            [sequelize.Sequelize.Op.lt]: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }
    );
  };

  ApiKey.cleanupExpired = function() {
    return this.update(
      { status: 'expired' },
      {
        where: {
          status: 'active',
          expires_at: {
            [sequelize.Sequelize.Op.lt]: new Date()
          }
        }
      }
    );
  };

  // Hooks
  ApiKey.beforeCreate(async (apiKey) => {
    // Generate key hash if not provided
    if (!apiKey.key_hash) {
      const { hash, prefix } = await ApiKey.generateKey();
      apiKey.key_hash = hash;
      apiKey.key_prefix = prefix;
    }
    
    // Set expiry if not provided (1 year from now)
    if (!apiKey.expires_at) {
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      apiKey.expires_at = expiryDate;
    }
  });

  ApiKey.beforeUpdate((apiKey) => {
    // Update last used timestamp when usage changes
    if (apiKey.changed('usage_count') || apiKey.changed('today_usage')) {
      apiKey.last_used_at = new Date();
    }
  });

  return ApiKey;
};