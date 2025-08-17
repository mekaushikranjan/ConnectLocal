export default (sequelize, DataTypes) => {
  const LocationHistory = sequelize.define('LocationHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  
  // Location Data
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false,
    validate: {
      min: -90,
      max: 90
    }
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false,
    validate: {
      min: -180,
      max: 180
    }
  },
  
  // Address Information
  locationName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  formattedAddress: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Additional Data
  accuracy: {
    type: DataTypes.DECIMAL(8, 2), // in meters
    allowNull: true
  },
  altitude: {
    type: DataTypes.DECIMAL(10, 2), // in meters
    allowNull: true
  },
  speed: {
    type: DataTypes.DECIMAL(8, 2), // in m/s
    allowNull: true
  },
  heading: {
    type: DataTypes.DECIMAL(5, 2), // in degrees
    allowNull: true
  },
  
  // Source Information
  source: {
    type: DataTypes.ENUM('manual', 'auto', 'gps', 'network'),
    defaultValue: 'auto',
    allowNull: false
  },
  
  // Metadata
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  
  // Privacy and Retention
  isPrivate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  retentionDays: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
    allowNull: false
  }
}, {
  tableName: 'location_history',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['user_id', 'timestamp']
    },
    {
      fields: ['timestamp']
    },
    {
      fields: ['user_id', 'source']
    }
  ]
});

// Instance methods
LocationHistory.prototype.getDistanceFrom = function(lat, lon) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = this.deg2rad(lat - this.latitude);
  const dLon = this.deg2rad(lon - this.longitude);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(this.deg2rad(this.latitude)) *
      Math.cos(this.deg2rad(lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
      
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

LocationHistory.prototype.deg2rad = function(deg) {
  return deg * (Math.PI / 180);
};

// Static methods
LocationHistory.addEntry = async function(userId, locationData) {
  const {
    latitude,
    longitude,
    locationName,
    formattedAddress,
    accuracy,
    altitude,
    speed,
    heading,
    source = 'auto'
  } = locationData;
  
  return await this.create({
    user_id: userId,
    latitude,
    longitude,
    locationName,
    formattedAddress,
    accuracy,   
    altitude,
    speed,
    heading,
    source,
    timestamp: new Date()
  });
};

LocationHistory.getUserHistory = async function(userId, options = {}) {
  const {
    limit = 50,
    offset = 0,
    startDate,
    endDate,
    source,
    includePrivate = false
  } = options;
  
  const whereClause = { user_id: userId };
  
  if (startDate) {
    whereClause.timestamp = { [sequelize.Op.gte]: startDate };
  }
  
  if (endDate) {
    whereClause.timestamp = {
      ...whereClause.timestamp,
      [sequelize.Op.lte]: endDate
    };
  }
  
  if (source) {
    whereClause.source = source;
  }
  
  if (!includePrivate) {
    whereClause.isPrivate = false;
  }
  
  return await this.findAndCountAll({
    where: whereClause,
    order: [['timestamp', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
};

LocationHistory.cleanupOldEntries = async function(retentionDays = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  return await this.destroy({
    where: {
      timestamp: {
        [sequelize.Op.lt]: cutoffDate
      }
    }
  });
};

LocationHistory.getRecentLocation = async function(userId, hours = 24) {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - hours);
  
  return await this.findOne({
    where: {
      user_id: userId,
      timestamp: {
        [sequelize.Op.gte]: cutoffDate
      }
    },
    order: [['timestamp', 'DESC']]
  });
};

  return LocationHistory;
};
