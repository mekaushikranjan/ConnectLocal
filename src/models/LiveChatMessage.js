export default (sequelize, DataTypes) => {
  const LiveChatMessage = sequelize.define('LiveChatMessage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    session_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'live_chats',
        key: 'id'
      }
    },
    sender_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    sender_type: {
      type: DataTypes.ENUM('user', 'admin'),
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'live_chat_messages',
    timestamps: true,
    underscored: true
  });

  LiveChatMessage.associate = (models) => {
    LiveChatMessage.belongsTo(models.LiveChat, {
      foreignKey: 'session_id',
      as: 'session'
    });
    
    LiveChatMessage.belongsTo(models.User, {
      foreignKey: 'sender_id',
      as: 'sender'
    });
  };

  return LiveChatMessage;
};
