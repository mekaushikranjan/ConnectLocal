export default (sequelize, DataTypes) => {
  const EmergencyContact = sequelize.define('EmergencyContact', {
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
    
    // Contact Information
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100]
      }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    relationship: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    
    // Additional Information
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Priority (for multiple contacts)
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      validate: {
        min: 1,
        max: 10
      }
    }
  }, {
  tableName: 'emergency_contacts',
  timestamps: true,
  underscored: true,
  indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['user_id', 'priority']
      }
    ]
  });

  EmergencyContact.associate = (models) => {
    EmergencyContact.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return EmergencyContact;
};
