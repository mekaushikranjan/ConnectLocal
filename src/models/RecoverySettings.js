export default (sequelize, DataTypes) => {
  const RecoverySettings = sequelize.define('RecoverySettings', {
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
    
    // Recovery Methods
    methods: {
      type: DataTypes.JSONB,
      defaultValue: [],
      validate: {
        isValidMethods(value) {
          const validMethods = ['email', 'phone', 'security_questions'];
          if (!Array.isArray(value)) {
            throw new Error('Methods must be an array');
          }
          value.forEach(method => {
            if (!validMethods.includes(method)) {
              throw new Error(`Invalid recovery method: ${method}`);
            }
          });
        }
      }
    },
    
    // Contact Information
    recoveryEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    recoveryPhone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    
    // Security Questions (stored as JSON array)
    securityQuestions: {
      type: DataTypes.JSONB,
      defaultValue: [],
      validate: {
        isValidQuestions(value) {
          if (!Array.isArray(value)) {
            throw new Error('Security questions must be an array');
          }
          value.forEach(q => {
            if (!q.question || !q.answer) {
              throw new Error('Each security question must have question and answer');
            }
          });
        }
      }
    },
    
    // Verification Status
    emailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    phoneVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    questionsVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'recovery_settings',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
          fields: ['user_id']
      }
    ]
  });

  RecoverySettings.associate = (models) => {
    RecoverySettings.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return RecoverySettings;
};
