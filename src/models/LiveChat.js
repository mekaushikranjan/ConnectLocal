export default (sequelize, DataTypes) => {
  const LiveChat = sequelize.define('LiveChat', {
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
    admin_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'ended', 'cancelled'),
      defaultValue: 'active',
      allowNull: false
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    ended_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'live_chats',
    timestamps: true,
    underscored: true
  });

  LiveChat.associate = (models) => {
    LiveChat.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
    
    LiveChat.belongsTo(models.User, {
      foreignKey: 'admin_id',
      as: 'admin'
    });

    LiveChat.hasMany(models.LiveChatMessage, {
      foreignKey: 'session_id',
      as: 'messages'
    });
  };

  return LiveChat;
};
