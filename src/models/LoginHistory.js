export default (sequelize, DataTypes) => {
  const LoginHistory = sequelize.define('LoginHistory', {
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
    
    // Session Information
    session_id: {
      type: DataTypes.STRING,
      allowNull: false
    },
    device_type: {
      type: DataTypes.ENUM('mobile', 'desktop', 'tablet', 'unknown'),
      defaultValue: 'unknown'
    },
    device_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    browser: {
      type: DataTypes.STRING,
      allowNull: true
    },
    os: {
      type: DataTypes.STRING,
      allowNull: true
    },
    
    // Location Information
    ip_address: {
      type: DataTypes.STRING,
      allowNull: true
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true
    },
    country: {
      type: DataTypes.STRING,
      allowNull: true
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true
    },
    
    // Session Details
    login_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    logout_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    last_activity_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Security Information
    is_active: {    
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    is_suspicious: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    suspicious_reason: {
      type: DataTypes.STRING,
      allowNull: true
    },
    
    // User Agent
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
  tableName: 'login_history',
  timestamps: true,
  underscored: true,
  indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['session_id']
      },
      {
        fields: ['user_id', 'is_active']
      },
      {
        fields: ['login_at']
      }
    ]
  });

  LoginHistory.associate = (models) => {
    LoginHistory.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return LoginHistory;
};
