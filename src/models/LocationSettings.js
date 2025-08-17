export default (sequelize, DataTypes) => {
  const LocationSettings = sequelize.define('LocationSettings', {
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
  
  // Basic Location Settings
  shareLocation: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  preciseLocation: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  autoDetect: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  
  // Visibility Settings
  showInPosts: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  showInProfile: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  shareWithGroups: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  
  // Radius and Privacy
  shareRadius: {
    type: DataTypes.DECIMAL(5, 2), // in kilometers
    defaultValue: 1.0,
    allowNull: false,
    validate: {
      min: 0.1,
      max: 50.0
    }
  },
  
  // Current Location
  currentLocation: {
    type: DataTypes.STRING,
    allowNull: true
  },
  customLocation: {
    type: DataTypes.STRING,
    allowNull: true
  },
  
  // History and Tracking
  locationHistory: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  historyRetentionDays: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
    allowNull: false,
    validate: {
      min: 1,
      max: 365
    }
  },
  
  // Notifications
  nearbyNotifications: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  emergencySharing: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  
  // Advanced Settings
  locationAccuracy: {
    type: DataTypes.ENUM('low', 'medium', 'high'),
    defaultValue: 'medium',
    allowNull: false
  },
  backgroundTracking: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  
  // Metadata
  lastUpdated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  settingsVersion: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false
  }
}, {
  tableName: 'location_settings',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['user_id']
    }
  ]
});

// Instance methods
LocationSettings.prototype.updateSettings = function(newSettings) {
  const allowedFields = [
    'shareLocation', 'preciseLocation', 'autoDetect', 'showInPosts',
    'showInProfile', 'shareWithGroups', 'shareRadius', 'currentLocation',
    'customLocation', 'locationHistory', 'historyRetentionDays',
    'nearbyNotifications', 'emergencySharing', 'locationAccuracy',
    'backgroundTracking'
  ];
  
  allowedFields.forEach(field => {
    if (newSettings.hasOwnProperty(field)) {
      this[field] = newSettings[field];
    }
  });
  
  this.lastUpdated = new Date();
  this.settingsVersion += 1;
  
  return this.save();
};

// Static methods
LocationSettings.getOrCreate = async function(userId) {
  const [settings, created] = await this.findOrCreate({
    where: { user_id: userId },
    defaults: {
      user_id: userId,
      shareLocation: true,
      preciseLocation: false,
      autoDetect: true,
      showInPosts: true,
      showInProfile: true,
      shareWithGroups: true,
      shareRadius: 1.0,
      locationHistory: true,
      historyRetentionDays: 30,
      nearbyNotifications: true,
      emergencySharing: true,
      locationAccuracy: 'medium',
      backgroundTracking: false
    }
  });
  
  return settings;
};

LocationSettings.getUserSettings = async function(userId) {
  const settings = await this.findOne({
    where: { user_id: userId }
  });
  
  if (!settings) {
    return await this.getOrCreate(userId);
  }
  
  return settings;
};

  return LocationSettings;
};
