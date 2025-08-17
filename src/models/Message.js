
export default (sequelize, DataTypes) => {
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
      return this.content.text?.substring(0, 100) + (this.content.text?.length > 100 ? '...' : '');
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
  this.editHistory.push({
    content: this.content.text,
    editedAt: new Date()
  });
  
  // Update content
  this.content.text = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  
  return this.save();
};

// Method to delete message for user
Message.prototype.deleteForUser = async function(userId) {
  this.deletedFor.push({
    user: userId,
    deletedAt: new Date()
  });
  
  return this.save();
};

// Method to delete message for everyone
Message.prototype.deleteForEveryone = async function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.content = { text: 'This message was deleted' };
  
  return this.save();
};

// Method to check if message is deleted for user
Message.prototype.isDeletedForUser = function(userId) {
  return this.isDeleted || this.deletedFor.some(d => 
    d.user.toString() === userId.toString()
  );
};

// Method to check if message is expired (disappearing message)
Message.prototype.isExpired = function() {
  return this.disappearing.isDisappearing && 
         this.disappearing.expiresAt && 
         new Date() > this.disappearing.expiresAt;
};

// Method to get message for user (with user-specific filtering)
Message.prototype.getForUser = function(userId) {
  if (this.isDeletedForUser(userId)) {
    return null;
  }
  
  if (this.isExpired()) {
    return null;
  }
  
  const message = this.toJSON();
  
  // Add user-specific reaction status
  message.userReaction = this.reactions.find(r => 
    r.user.toString() === userId.toString()
  )?.emoji || null;
  
  // Add read status for user
  message.isReadByUser = this.readBy.some(r => 
    r.user.toString() === userId.toString()
  );
  
  return message;
};

// Static method to get messages for chat
Message.findMessagesForChat = async function(chatId, userId, options = {}) {
  const query = {
    chat: chatId,
    $or: [
      { isDeleted: false },
      { isDeleted: { $exists: false } }
    ]
  };
  
  // Filter out messages deleted for this user
  query['deletedFor.user'] = { $ne: userId };
  
  // Filter out expired disappearing messages
  query.$and = [
    {
      $or: [
        { 'disappearing.isDisappearing': false },
        { 'disappearing.isDisappearing': { $exists: false } },
        { 'disappearing.expiresAt': { $gt: new Date() } }
      ]
    }
  ];
  
  let queryBuilder = this.find(query)
    .populate('sender.id', 'displayName username profile.avatar')
    .populate('replyTo.sender.id', 'displayName username')
    .sort({ createdAt: -1 });
  
  if (options.limit) {
    queryBuilder = queryBuilder.limit(options.limit);
  }
  
  if (options.skip) {
    queryBuilder = queryBuilder.skip(options.skip);
  }
  
  return queryBuilder;
};

// Static method to get unread messages count for user in chat
Message.getUnreadCountForUserInChat = async function(chatId, userId, lastReadAt) {
  return this.countDocuments({
    chat: chatId,
    'sender.id': { $ne: userId },
    createdAt: { $gt: lastReadAt },
    isDeleted: { $ne: true },
    'deletedFor.user': { $ne: userId }
  });
};

// Pre-save middleware to update chat's last message
Message.afterCreate(async (message, options) => {
  if (!message.isDeleted) {
    await sequelize.models.Chat.update({
      lastMessageContent: message.getContentPreview(),
      lastMessageSenderId: message.senderId,
      lastMessageTimestamp: message.createdAt,
      lastMessageType: message.type,
      messageCount: sequelize.literal('messageCount + 1')
    }, {
      where: { id: message.chatId }
    });
  }
});

  return Message;
};