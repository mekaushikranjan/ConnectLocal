import { Model, DataTypes, Op } from 'sequelize';

export default (sequelize) => {
  class Notification extends Model {
    static associate(models) {
      Notification.belongsTo(models.User, { as: 'recipient', foreignKey: 'recipientId' });
      Notification.belongsTo(models.User, { as: 'sender', foreignKey: 'senderId' });
      Notification.belongsTo(models.Post, { foreignKey: 'postId' });
      Notification.belongsTo(models.Comment, { foreignKey: 'commentId' });
      Notification.belongsTo(models.Job, { foreignKey: 'jobId' });
      Notification.belongsTo(models.JobApplication, { foreignKey: 'applicationId' });
      Notification.belongsTo(models.MarketplaceItem, { foreignKey: 'marketplaceItemId' });
      Notification.belongsTo(models.Chat, { foreignKey: 'chatId' });
      Notification.belongsTo(models.Message, { foreignKey: 'messageId' });
    }
  }

  Notification.init({
    // Recipient
    recipientId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    
    // Sender (optional, for user-generated notifications)
    senderId: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id'
      }
    },
  
    // Notification Content
    title: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    message: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    
    // Notification Type
    type: {
      type: DataTypes.ENUM(
        // Post-related
        'post_like', 'post_comment', 'post_share', 'post_mention', 'comment_like',
        
        // Job-related
        'job_match', 'job_application', 'job_application_status',
        'job_interview_scheduled', 'job_offer', 'application_submitted', 'application_status_update',
        
        // Marketplace-related
        'marketplace_inquiry', 'marketplace_favorite', 'marketplace_sold',
        'marketplace_price_drop',
        
        // Chat-related
        'new_message', 'group_invite', 'group_mention', 'live_chat',
        
        // Social-related
        'follow_request', 'new_follower', 'friend_request',
        
        // System-related
        'system_update', 'maintenance', 'security_alert',
        'account_verification', 'password_reset', 'account_update',
        
        // Community-related
        'community_invite', 'community_event', 'community_announcement',
        
        // Moderation-related
        'content_reported', 'content_removed', 'account_warning',
        'account_suspended',
        
        // Other
        'reminder', 'promotion', 'achievement'
      ),
      allowNull: false
    },
  
    // Related Data (using separate columns for foreign keys)
    postId: {
      type: DataTypes.UUID,
      references: {
        model: 'posts',
        key: 'id'
      }
    },
    commentId: {
      type: DataTypes.UUID,
      references: {
        model: 'comments',
        key: 'id'
      }
    },
    jobId: {
      type: DataTypes.UUID,
      references: {
        model: 'jobs',
        key: 'id'
      }
    },
    applicationId: {
      type: DataTypes.UUID,
      references: {
        model: 'job_applications',
        key: 'id'
      }
    },
    marketplaceItemId: {
      type: DataTypes.UUID,
      references: {
        model: 'marketplace_items',
        key: 'id'
      }
    },
    chatId: {
      type: DataTypes.UUID,
      references: {
        model: 'chats',
        key: 'id'
      }
    },
    messageId: {
      type: DataTypes.UUID,
      references: {
        model: 'messages',
        key: 'id'
      }
    },
    customData: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
  
    // Status
    status: {
      type: DataTypes.ENUM('unread', 'read', 'archived'),
      defaultValue: 'unread'
    },
    
    // Read Information
    readAt: DataTypes.DATE,
    
    // Action Information
    actionUrl: DataTypes.STRING, // Deep link or URL to navigate to
    actionText: DataTypes.STRING, // Text for action button
    
    // Priority
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
      defaultValue: 'normal'
    },
    
    // Delivery Information
    delivery: {
      type: DataTypes.JSONB,
      defaultValue: {
        push: {
          sent: false,
          sentAt: null,
          delivered: false,
          deliveredAt: null,
          clicked: false,
          clickedAt: null,
          error: null
        },
        email: {
          sent: false,
          sentAt: null,
          delivered: false,
          deliveredAt: null,
          opened: false,
          openedAt: null,
          clicked: false,
          clickedAt: null,
          error: null
        },
        sms: {
          sent: false,
          sentAt: null,
          delivered: false,
          deliveredAt: null,
          error: null
        }
      }
    },
    
    // Grouping (for similar notifications)
    groupKey: DataTypes.STRING,
    groupCount: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    
    // Scheduling
    scheduledFor: DataTypes.DATE,
    isScheduled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    
    // Expiry
    expiresAt: DataTypes.DATE,
    
    // Metadata
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {
        source: null,
        campaign: null,
        version: null,
        deviceInfo: {
          platform: null,
          version: null,
          deviceId: null
        }
      }
    }
  }, {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['recipient_id', 'created_at'] },
      { fields: ['recipient_id', 'status', 'created_at'] },
      { fields: ['type', 'created_at'] },
      { fields: ['priority', 'status'] },
      { fields: ['scheduled_for', 'is_scheduled'] },
      { fields: ['expires_at'] },
      { fields: ['group_key', 'recipient_id'] }
    ]
  });

  // Instance methods
  Notification.prototype.getTimeAgo = function() {
    const now = new Date();
    const diff = now - this.created_at;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  Notification.prototype.getFormattedTime = function() {
    const now = new Date();
    const notificationTime = this.created_at;
    const diffInHours = (now - notificationTime) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return notificationTime.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 168) { // 7 days
      return notificationTime.toLocaleDateString('en-US', { 
        weekday: 'short',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return notificationTime.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  };

  Notification.prototype.isExpired = function() {
    return this.expires_at && new Date() > this.expires_at;
  };

  Notification.prototype.markAsRead = async function() {
    if (this.status === 'unread') {
      this.status = 'read';
      this.readAt = new Date();
      await this.save();
    }
    return this;
  };

  Notification.prototype.archive = async function() {
    this.status = 'archived';
    return this.save();
  };

  Notification.prototype.markPushAsDelivered = async function() {
    const delivery = { ...this.delivery };
    delivery.push.delivered = true;
    delivery.push.deliveredAt = new Date();
    this.delivery = delivery;
    return this.save();
  };

  Notification.prototype.markPushAsClicked = async function() {
    const delivery = { ...this.delivery };
    delivery.push.clicked = true;
    delivery.push.clickedAt = new Date();
    this.delivery = delivery;
    return this.save();
  };

  Notification.prototype.markEmailAsOpened = async function() {
    const delivery = { ...this.delivery };
    delivery.email.opened = true;
    delivery.email.openedAt = new Date();
    this.delivery = delivery;
    return this.save();
  };

  Notification.prototype.markEmailAsClicked = async function() {
    const delivery = { ...this.delivery };
    delivery.email.clicked = true;
    delivery.email.clickedAt = new Date();
    this.delivery = delivery;
    return this.save();
  };

  // Static methods
  Notification.createNotification = async function(notificationData) {
    try {
      const {
        recipientId,
        senderId,
        title,
        message,
        type,
        customData = {},
        priority = 'normal',
        actionUrl,
        actionText,
        groupKey,
        scheduledFor,
        expiresAt
      } = notificationData;
      
      // Check if we should group this notification
      if (groupKey) {
        const existingNotification = await this.findOne({
          where: {
            recipientId,
            groupKey,
            status: 'unread',
            created_at: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Within last 24 hours
          }
        });
        
        if (existingNotification) {
          existingNotification.groupCount += 1;
          existingNotification.message = message; // Update with latest message
          existingNotification.changed('updatedAt', true); // Force timestamp update
          const updatedNotification = await existingNotification.save();
          
          // Invalidate cache after update
          const RedisService = (await import('../services/redisService.js')).default;
          await RedisService.invalidateUserData(recipientId);
          
          return updatedNotification;
        }
      }
      
      // Create new notification
      const notification = await this.create({
        recipientId,
        senderId,
        title,
        message,
        type,
        customData,
        priority,
        actionUrl,
        actionText,
        groupKey,
        scheduledFor,
        expiresAt,
        isScheduled: !!scheduledFor
      });

      // Invalidate cache after creation
      const RedisService = (await import('../services/redisService.js')).default;
      await RedisService.invalidateUserData(recipientId);
      
      // Update unread count
      const newCount = await this.getUnreadCount(recipientId, false);
      await RedisService.setUnreadCount(recipientId, newCount);

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  };

  Notification.getUserNotifications = async function(userId, options = {}) {
    const { useCache = true } = options;
    
    try {
      // Try to get from cache first
      if (useCache) {
        const RedisService = (await import('../services/redisService.js')).default;
        const cachedNotifications = await RedisService.getCachedNotifications(userId);
        if (cachedNotifications) {

          return cachedNotifications;
        }
      }

      const where = {
        recipientId: userId
      };
      
      if (options.status) {
        where.status = options.status;
      }
      
      if (options.type) {
        where.type = options.type;
      }
      
      if (options.priority) {
        where.priority = options.priority;
      }
      
      // Exclude expired notifications
      where[Op.or] = [
        { expiresAt: null },
        { expiresAt: { [Op.gt]: new Date() } }
      ];
      
      const notifications = await this.findAll({
        where,
        include: [{
          model: sequelize.models.User,
          as: 'sender',
          attributes: ['displayName', 'username', 'avatar_url']
        }],
        order: [['created_at', 'DESC']],
        limit: options.limit,
        offset: options.skip
      });

      // Cache the results
      if (useCache) {
        const RedisService = (await import('../services/redisService.js')).default;
        await RedisService.cacheNotifications(userId, notifications);
      }
      
      return notifications;
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  };

  Notification.getUnreadCount = async function(userId, useCache = true) {
    try {
      // Try to get from cache first
      if (useCache) {
        const RedisService = (await import('../services/redisService.js')).default;
        const cachedCount = await RedisService.getUnreadCount(userId);
        if (cachedCount !== null) {
          return cachedCount;
        }
      }

      const count = await this.count({
        where: {
          recipientId: userId,
          status: 'unread',
          [Op.or]: [
            { expiresAt: null },
            { expiresAt: { [Op.gt]: new Date() } }
          ]
        }
      });

      // Cache the count
      if (useCache) {
        const RedisService = (await import('../services/redisService.js')).default;
        await RedisService.setUnreadCount(userId, count);
      }

      return count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  };

  Notification.markAllAsRead = async function(userId) {
    try {
      const now = new Date();
      const result = await this.update(
        {
          status: 'read',
          readAt: now
        },
        {
          where: {
            recipientId: userId,
            status: 'unread'
          }
        }
      );

      // Invalidate cache
      const RedisService = (await import('../services/redisService.js')).default;
      await RedisService.invalidateUserData(userId);
      
      // Update unread count
      const newCount = await this.getUnreadCount(userId, false);
      await RedisService.setUnreadCount(userId, newCount);

      return result;
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      throw error;
    }
  };

  Notification.getScheduledNotifications = async function() {
    return await this.findAll({
      where: {
        isScheduled: true,
        scheduled_for: { [Op.lte]: new Date() },
        delivery: {
          [Op.and]: [
            { 'push.sent': false }
          ]
        }
      },
      include: [{
        model: sequelize.models.User,
        as: 'recipient',
        attributes: ['devices', 'notificationSettings']
      }]
    });
  };

  Notification.cleanupExpired = async function() {
    return await this.destroy({
      where: {
        expires_at: { [Op.lt]: new Date() }
      }
    });
  };

  // Hooks
  Notification.beforeCreate(async (notification) => {
    if (!notification.expiresAt) {
      const expiryDays = {
        'system_update': 7,
        'maintenance': 1,
        'promotion': 30,
        'reminder': 1
      };
      
      const days = expiryDays[notification.type];
      if (days) {
        notification.expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      }
    }
  });

  return Notification;
};