export default (sequelize, DataTypes) => {
  const SupportTicket = sequelize.define('SupportTicket', {
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
      }
    },
    subject: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 200]
      }
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    status: {
      type: DataTypes.ENUM('open', 'in_progress', 'resolved', 'closed'),
      defaultValue: 'open',
      allowNull: false
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      defaultValue: 'medium',
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('contact', 'bug_report', 'feature_request', 'general'),
      defaultValue: 'general',
      allowNull: false
    },
    response: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    responded_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    responded_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'support_tickets',
    timestamps: true,
    underscored: true
  });

  SupportTicket.associate = (models) => {
    SupportTicket.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
    
    SupportTicket.belongsTo(models.User, {
      foreignKey: 'responded_by',
      as: 'responder'
    });
  };

  return SupportTicket;
};
