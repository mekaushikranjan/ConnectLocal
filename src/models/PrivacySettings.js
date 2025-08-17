export default (sequelize, DataTypes) => {
  const PrivacySettings = sequelize.define('PrivacySettings', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false, 
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    
    // Profile Privacy
    profileVisibility: {
      type: DataTypes.ENUM('public', 'friends', 'private'),
      defaultValue: 'public',
      allowNull: false
    },
    postVisibility: {
      type: DataTypes.ENUM('public', 'friends', 'private'),
      defaultValue: 'public',
      allowNull: false
    },
    
    // Communication Settings
    allowMessages: {
      type: DataTypes.ENUM('everyone', 'friends', 'nobody'),
      defaultValue: 'everyone',
      allowNull: false
    },
    allowGroupInvites: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    allowEventInvites: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    
    // Activity Status
    showOnlineStatus: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    showLastSeen: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    activityStatus: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    
    // Content Controls
    allowTagging: {
      type: DataTypes.ENUM('everyone', 'friends', 'nobody'),
      defaultValue: 'friends'
    },
    allowComments: {
      type: DataTypes.ENUM('everyone', 'friends', 'nobody'),
      defaultValue: 'everyone'
    },
    moderateComments: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    
    // Search and Discovery
    hideFromSearch: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    
    // Security Settings
    twoFactorAuth: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    loginAlerts: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    
    // Data Settings
    dataDownload: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'privacy_settings',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id']
      }
    ]
  });

  PrivacySettings.associate = (models) => {
    PrivacySettings.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return PrivacySettings;
};
