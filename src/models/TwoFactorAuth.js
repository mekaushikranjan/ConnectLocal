export default (sequelize, DataTypes) => {
  const TwoFactorAuth = sequelize.define('TwoFactorAuth', {
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
    
    // 2FA Settings
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    method: {
      type: DataTypes.ENUM('sms', 'authenticator', 'email'),
      allowNull: true
    },
    secret: {
      type: DataTypes.STRING,
      allowNull: true
    },
    
    // Contact Information
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    
    // Backup Codes (stored as JSON array)
    backupCodes: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    
    // Verification
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Verification Code for SMS/Email
    verificationCode: {
      type: DataTypes.STRING,
      allowNull: true
    },
    verificationCodeExpiry: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
      tableName: 'two_factor_auth',
  timestamps: true,
  underscored: true,
  indexes: [
      {
        unique: true,
        fields: ['user_id']
      }
    ]
  });

  TwoFactorAuth.associate = (models) => {
    TwoFactorAuth.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return TwoFactorAuth;
};
