
export default (sequelize, DataTypes) => {
  const { Op } = sequelize.Sequelize;
  const Message = sequelize.define('Message', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    // Chat Reference
    chatId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'chats',
        key: 'id'
      }
    },
    
    // Sender Information
    senderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    senderName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    senderAvatar: {
      type: DataTypes.STRING,
      allowNull: true
    },
    
    // Message Content
    content: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    
    // Media Information (for images, videos, audio, files)
    media: {
      type: DataTypes.JSONB,
      defaultValue: null
    },
    
    // Location Information
    location: {
      type: DataTypes.JSONB,
      defaultValue: null
    },
    
    // Message Type
    type: {
      type: DataTypes.ENUM('text', 'image', 'video', 'audio', 'file', 'location', 'contact', 'system'),
      allowNull: false
    },
    
    // Reply Information
    replyTo: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    
    // Forward Information
    forwarded: {
      type: DataTypes.JSONB,
      defaultValue: {
        isForwarded: false,
        originalSender: null,
        forwardedFrom: null,
        forwardCount: 0
      }
    },
    
    // Message Status
    status: {
      type: DataTypes.ENUM('sent', 'delivered', 'read', 'failed'),
      defaultValue: 'sent'
    },
    
    // Read Receipts (for group chats)
    readBy: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    
    // Delivery Receipts
    deliveredTo: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    
    // Message Reactions
    reactions: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    
    // Editing
    isEdited: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    editedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    editHistory: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    
    // Deletion
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    deletedFor: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    
    // System Messages
    systemMessage: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    
    // Mentions
    mentions: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    
    // Disappearing Message
    disappearing: {
      type: DataTypes.JSONB,
      defaultValue: {
        isDisappearing: false,
        expiresAt: null,
        duration: null
      }
    },
    
    // Message Priority (for important messages)
    priority: {
      type: DataTypes.ENUM('normal', 'high', 'urgent'),
      defaultValue: 'normal'
    },
    
    // Scheduled Messages
    scheduled: {
      type: DataTypes.JSONB,
      defaultValue: {
        isScheduled: false,
        scheduledFor: null,
        sent: false
      }
    },
    
    // Message Encryption (for future implementation)
    encryption: {
      type: DataTypes.JSONB,
      defaultValue: {
        isEncrypted: false,
        keyId: null
      }
    },
    
    // Moderation
    moderation: {
      type: DataTypes.JSONB,
      defaultValue: {
        isReported: false,
        reportCount: 0,
        isHidden: false,
        hiddenBy: null,
        hiddenAt: null,
        flags: []
      }
    }
  }, {
    tableName: 'messages',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['chat_id', 'created_at'] },
      { fields: ['sender_id', 'created_at'] },
      { fields: ['status'] },
      { fields: ['type'] }
    ]
  });

  // Instance methods
  Message.prototype.getFormattedTime = function() {
    const now = new Date();
    const messageTime = this.created_at;
    const diffInHours = (now - messageTime) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return messageTime.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 168) { // 7 days
      return messageTime.toLocaleDateString('en-US', { 
        weekday: 'short',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return messageTime.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  Message.prototype.getContentPreview = function() {
    if (this.type === 'text') {
      const text = this.content?.text || this.content || '';
      return text.substring(0, 100) + (text.length > 100 ? '...' : '');
    } else if (this.type === 'image') {
      return '📷 Photo';
    } else if (this.type === 'video') {
      return '🎥 Video';
    } else if (this.type === 'audio') {
      return '🎵 Audio';
    } else if (this.type === 'file') {
      return '📎 File';
    } else if (this.type === 'location') {
      return '📍 Location';
    } else if (this.type === 'contact') {
      return '👤 Contact';
    }
    return 'Message';
  };

  Message.prototype.addReaction = async function(userId, emoji) {
    const reactions = [...this.reactions];
    
    // Remove existing reaction from same user
    const filteredReactions = reactions.filter(r => 
      r.user !== userId.toString()
    );
    
    // Add new reaction
    filteredReactions.push({
      user: userId.toString(),
      emoji,
      reactedAt: new Date()
    });
    
    this.reactions = filteredReactions;
    return this.save();
  };

  Message.prototype.removeReaction = async function(userId) {
    const reactions = [...this.reactions];
    this.reactions = reactions.filter(r => 
      r.user !== userId.toString()
    );
    
    return this.save();
  };

  Message.prototype.markAsRead = async function(userId) {
    const readBy = [...this.readBy];
    
    // Check if already read
    const alreadyRead = readBy.some(r => 
      r.user === userId.toString()
    );
    
    if (!alreadyRead) {
      readBy.push({
        user: userId.toString(),
        readAt: new Date()
      });
      
      this.readBy = readBy;
      
      // Update status if this is a direct message
      if (readBy.length === 1) {
        this.status = 'read';
      }
    }
    
    return this.save();
  };

  Message.prototype.markAsDelivered = async function(userId) {
    const deliveredTo = [...this.deliveredTo];
    
    // Check if already delivered
    const alreadyDelivered = deliveredTo.some(d => 
      d.user === userId.toString()
    );
    
    if (!alreadyDelivered) {
      deliveredTo.push({
        user: userId.toString(),
        deliveredAt: new Date()
      });
      
      this.deliveredTo = deliveredTo;
      
      // Update status if this is the first delivery
      if (deliveredTo.length === 1 && this.status === 'sent') {
        this.status = 'delivered';
      }
    }
    
    return this.save();
  };

// Method to edit message
Message.prototype.editMessage = async function(newContent) {
  // Add to edit history
  const currentContent = this.content?.text || this.content || '';
  this.editHistory.push({
    content: currentContent,
    editedAt: new Date()
  });
  
  // Update content - handle both string and object formats
  if (typeof newContent === 'string') {
    this.content = { text: newContent };
  } else {
    this.content = newContent;
  }
  
  this.isEdited = true;
  this.editedAt = new Date();
  
  return this.save();
};





  // Static methods
  Message.findMessagesForChat = async function(chatId, userId, options = {}) {
    const whereClause = {
      chatId: chatId,
      [Op.or]: [
        { isDeleted: false },
        { isDeleted: null }
      ]
    };
    
    const include = [
      {
        model: sequelize.models.User,
        as: 'sender',
        attributes: ['id', 'displayName', 'username']
      }
    ];
    
    const queryOptions = {
      where: whereClause,
      include: include,
      order: [['createdAt', 'DESC']]
    };
    
    if (options.limit) {
      queryOptions.limit = options.limit;
    }
    
    if (options.offset) {
      queryOptions.offset = options.offset;
    }
    
    return this.findAll(queryOptions);
  };

  Message.getUnreadCountForUserInChat = async function(chatId, userId, lastReadAt) {
    return this.count({
      where: {
        chatId: chatId,
        senderId: { [Op.ne]: userId },
        createdAt: { [Op.gt]: lastReadAt },
        isDeleted: { [Op.ne]: true }
      }
    });
  };

  // Define associations
  Message.associate = (models) => {
    Message.belongsTo(models.Chat, {
      foreignKey: 'chatId',
      as: 'chat'
    });
    
    Message.belongsTo(models.User, {
      foreignKey: 'senderId',
      as: 'sender'
    });
  };

  return Message;
};