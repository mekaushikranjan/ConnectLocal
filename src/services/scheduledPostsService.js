import { Post, User, Notification } from '../models/index.js';
import { Op } from 'sequelize';
import logger from '../utils/logger.js';

class ScheduledPostsService {
  /**
   * Publish scheduled posts that are due
   */
  static async publishScheduledPosts() {
    try {
      const now = new Date();
      
      // Find all scheduled posts that are due to be published
      const scheduledPosts = await Post.findAll({
        where: {
          is_scheduled: true,
          scheduled_for: {
            [Op.lte]: now
          },
          status: 'active'
        },
        include: [{
          model: User,
          as: 'author',
          attributes: ['id', 'displayName', 'username', 'avatar_url']
        }]
      });

      logger.info(`Found ${scheduledPosts.length} scheduled posts to publish`);

      for (const post of scheduledPosts) {
        try {
          // Update the post to mark it as published
          await post.update({
            is_scheduled: false,
            scheduled_for: null,
            published_at: now
          });

          logger.info(`Published scheduled post: ${post.id} by user: ${post.authorId}`);

          // Optionally send notifications to followers or community members
          await this.sendScheduledPostNotifications(post);

        } catch (error) {
          logger.error(`Error publishing scheduled post ${post.id}:`, error);
        }
      }

      return {
        success: true,
        publishedCount: scheduledPosts.length,
        message: `Successfully published ${scheduledPosts.length} scheduled posts`
      };

    } catch (error) {
      logger.error('Error in publishScheduledPosts:', error);
      throw error;
    }
  }

  /**
   * Send notifications for newly published scheduled posts
   */
  static async sendScheduledPostNotifications(post) {
    try {
      logger.info(`Sending notifications for scheduled post: ${post.id}`);
      
      // Get the author's followers
      const followers = await User.findAll({
        include: [{
          model: User,
          as: 'followers',
          through: { attributes: [] },
          where: { id: post.authorId },
          attributes: []
        }],
        attributes: ['id', 'displayName', 'username', 'notificationSettings']
      });

      // Get community members if post has location
      let communityMembers = [];
      if (post.locationCity || post.locationState) {
        communityMembers = await User.findAll({
          where: {
            id: { [Op.ne]: post.authorId }, // Exclude the author
            locationCity: post.locationCity,
            locationState: post.locationState,
            notificationSettings: {
              communityPosts: true
            }
          },
          attributes: ['id', 'displayName', 'username', 'notificationSettings']
        });
      }

      // Combine followers and community members, removing duplicates
      const allRecipients = new Map();
      
      followers.forEach(follower => {
        if (follower.notificationSettings?.scheduledPosts !== false) {
          allRecipients.set(follower.id, follower);
        }
      });

      communityMembers.forEach(member => {
        if (member.notificationSettings?.communityPosts !== false) {
          allRecipients.set(member.id, member);
        }
      });

      const recipients = Array.from(allRecipients.values());
      logger.info(`Found ${recipients.length} recipients for scheduled post notifications`);

      // Create notifications for each recipient
      const notificationPromises = recipients.map(async (recipient) => {
        try {
          const notification = await Notification.create({
            userId: recipient.id,
            type: 'scheduled_post_published',
            title: 'Scheduled Post Published',
            message: `${post.author.displayName || post.author.username} just published a scheduled post`,
            data: {
              postId: post.id,
              authorId: post.authorId,
              postTitle: post.title,
              postType: post.type,
              location: post.locationFormattedAddress
            },
            isRead: false,
            priority: post.type === 'urgent' ? 'high' : 'normal'
          });

          // Send push notification if user has push notifications enabled
          if (recipient.notificationSettings?.pushNotifications !== false) {
            await this.sendPushNotification(recipient, notification);
          }

          return notification;
        } catch (error) {
          logger.error(`Error creating notification for user ${recipient.id}:`, error);
          return null;
        }
      });

      const createdNotifications = await Promise.allSettled(notificationPromises);
      const successfulNotifications = createdNotifications.filter(result => 
        result.status === 'fulfilled' && result.value !== null
      );

      logger.info(`Successfully sent ${successfulNotifications.length} notifications for scheduled post ${post.id}`);

      // Send email notifications for high-priority posts
      if (post.type === 'urgent' || post.type === 'event') {
        await this.sendEmailNotifications(recipients, post);
      }

    } catch (error) {
      logger.error(`Error sending scheduled post notifications for post ${post.id}:`, error);
    }
  }

  /**
   * Send push notification to user
   */
  static async sendPushNotification(user, notification) {
    try {
      // Check if user has FCM token
      if (!user.fcmToken) {
        return;
      }

      // Import firebase admin dynamically to avoid circular dependencies
      const { default: admin } = await import('firebase-admin');
      
      const message = {
        token: user.fcmToken,
        notification: {
          title: notification.title,
          body: notification.message
        },
        data: {
          type: notification.type,
          postId: notification.data.postId,
          authorId: notification.data.authorId,
          notificationId: notification.id.toString()
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'scheduled_posts',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      const response = await admin.messaging().send(message);
      logger.info(`Push notification sent to user ${user.id}: ${response}`);
      
    } catch (error) {
      logger.error(`Error sending push notification to user ${user.id}:`, error);
    }
  }

  /**
   * Send email notifications for high-priority posts
   */
  static async sendEmailNotifications(recipients, post) {
    try {
      const emailRecipients = recipients.filter(user => 
        user.notificationSettings?.emailNotifications !== false
      );

      if (emailRecipients.length === 0) {
        return;
      }

      // Import email service dynamically
      const { default: emailService } = await import('./emailService.js');

      const emailPromises = emailRecipients.map(async (recipient) => {
        try {
          const emailData = {
            to: recipient.email,
            subject: `New ${post.type} post from ${post.author.displayName || post.author.username}`,
            template: 'scheduled_post_notification',
            context: {
              recipientName: recipient.displayName || recipient.username,
              authorName: post.author.displayName || post.author.username,
              postTitle: post.title,
              postContent: post.content.substring(0, 200) + (post.content.length > 200 ? '...' : ''),
              postType: post.type,
              location: post.locationFormattedAddress,
              postUrl: `${process.env.FRONTEND_URL}/post/${post.id}`,
              unsubscribeUrl: `${process.env.FRONTEND_URL}/settings/notifications`
            }
          };

          await emailService.sendEmail(emailData);
          logger.info(`Email notification sent to ${recipient.email}`);
          
        } catch (error) {
          logger.error(`Error sending email to ${recipient.email}:`, error);
        }
      });

      await Promise.allSettled(emailPromises);
      
    } catch (error) {
      logger.error('Error sending email notifications:', error);
    }
  }

  /**
   * Get scheduled posts for a user
   */
  static async getUserScheduledPosts(userId, limit = 10, offset = 0) {
    try {
      const posts = await Post.findAndCountAll({
        where: {
          authorId: userId,
          is_scheduled: true,
          status: 'active'
        },
        include: [{
          model: User,
          as: 'author',
          attributes: ['id', 'displayName', 'username', 'avatar_url']
        }],
        order: [['scheduled_for', 'ASC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return {
        success: true,
        data: {
          items: posts.rows,
          total: posts.count,
          totalPages: Math.ceil(posts.count / limit)
        }
      };

    } catch (error) {
      logger.error('Error getting user scheduled posts:', error);
      throw error;
    }
  }

  /**
   * Update a scheduled post
   */
  static async updateScheduledPost(postId, userId, updateData) {
    try {
      const post = await Post.findOne({
        where: {
          id: postId,
          authorId: userId,
          is_scheduled: true
        }
      });

      if (!post) {
        throw new Error('Scheduled post not found or not authorized');
      }

      // Validate scheduled time
      if (updateData.scheduledFor) {
        const newScheduledTime = new Date(updateData.scheduledFor);
        if (newScheduledTime <= new Date()) {
          throw new Error('Scheduled time must be in the future');
        }
        updateData.scheduled_for = newScheduledTime;
      }

      // Update the post
      await post.update(updateData);

      const updatedPost = await Post.findByPk(postId, {
        include: [{
          model: User,
          as: 'author',
          attributes: ['id', 'displayName', 'username', 'avatar_url']
        }]
      });

      return {
        success: true,
        message: 'Scheduled post updated successfully',
        data: { post: updatedPost }
      };

    } catch (error) {
      logger.error('Error updating scheduled post:', error);
      throw error;
    }
  }

  /**
   * Cancel/delete a scheduled post
   */
  static async cancelScheduledPost(postId, userId) {
    try {
      const post = await Post.findOne({
        where: {
          id: postId,
          authorId: userId,
          is_scheduled: true
        }
      });

      if (!post) {
        throw new Error('Scheduled post not found or not authorized');
      }

      await post.destroy();

      return {
        success: true,
        message: 'Scheduled post cancelled successfully'
      };

    } catch (error) {
      logger.error('Error cancelling scheduled post:', error);
      throw error;
    }
  }

  /**
   * Get scheduled posts statistics
   */
  static async getScheduledPostsStats(userId) {
    try {
      const totalScheduled = await Post.count({
        where: {
          authorId: userId,
          is_scheduled: true,
          status: 'active'
        }
      });

      const nextScheduled = await Post.findOne({
        where: {
          authorId: userId,
          is_scheduled: true,
          status: 'active',
          scheduled_for: {
            [Op.gt]: new Date()
          }
        },
        order: [['scheduled_for', 'ASC']]
      });

      // Get notification statistics
      const notificationStats = await this.getNotificationStats(userId);

      return {
        success: true,
        data: {
          totalScheduled,
          nextScheduled: nextScheduled ? {
            id: nextScheduled.id,
            title: nextScheduled.title,
            scheduledFor: nextScheduled.scheduled_for
          } : null,
          notificationStats
        }
      };

    } catch (error) {
      logger.error('Error getting scheduled posts stats:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics for a user
   */
  static async getNotificationStats(userId) {
    try {
      const totalNotifications = await Notification.count({
        where: {
          userId: userId,
          type: 'scheduled_post_published'
        }
      });

      const unreadNotifications = await Notification.count({
        where: {
          userId: userId,
          type: 'scheduled_post_published',
          isRead: false
        }
      });

      const recentNotifications = await Notification.findAll({
        where: {
          userId: userId,
          type: 'scheduled_post_published'
        },
        order: [['createdAt', 'DESC']],
        limit: 5,
        include: [{
          model: Post,
          as: 'post',
          attributes: ['id', 'title', 'type']
        }]
      });

      return {
        totalNotifications,
        unreadNotifications,
        recentNotifications
      };

    } catch (error) {
      logger.error('Error getting notification stats:', error);
      return {
        totalNotifications: 0,
        unreadNotifications: 0,
        recentNotifications: []
      };
    }
  }

  /**
   * Mark scheduled post notifications as read
   */
  static async markNotificationsAsRead(userId, notificationIds = null) {
    try {
      const whereClause = {
        userId: userId,
        type: 'scheduled_post_published',
        isRead: false
      };

      if (notificationIds) {
        whereClause.id = { [Op.in]: notificationIds };
      }

      const updatedCount = await Notification.update(
        { isRead: true, readAt: new Date() },
        { where: whereClause }
      );

      logger.info(`Marked ${updatedCount[0]} notifications as read for user ${userId}`);

      return {
        success: true,
        message: `Marked ${updatedCount[0]} notifications as read`,
        updatedCount: updatedCount[0]
      };

    } catch (error) {
      logger.error('Error marking notifications as read:', error);
      throw error;
    }
  }

  /**
   * Get notification preferences for a user
   */
  static async getNotificationPreferences(userId) {
    try {
      const user = await User.findByPk(userId, {
        attributes: ['id', 'notificationSettings', 'email']
      });

      if (!user) {
        throw new Error('User not found');
      }

      const defaultPreferences = {
        scheduledPosts: true,
        communityPosts: true,
        pushNotifications: true,
        emailNotifications: true,
        urgentPosts: true,
        eventPosts: true
      };

      return {
        success: true,
        data: {
          ...defaultPreferences,
          ...user.notificationSettings
        }
      };

    } catch (error) {
      logger.error('Error getting notification preferences:', error);
      throw error;
    }
  }

  /**
   * Update notification preferences for a user
   */
  static async updateNotificationPreferences(userId, preferences) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const currentSettings = user.notificationSettings || {};
      const updatedSettings = { ...currentSettings, ...preferences };

      await user.update({
        notificationSettings: updatedSettings
      });

      logger.info(`Updated notification preferences for user ${userId}`);

      return {
        success: true,
        message: 'Notification preferences updated successfully',
        data: updatedSettings
      };

    } catch (error) {
      logger.error('Error updating notification preferences:', error);
      throw error;
    }
  }
}

export default ScheduledPostsService;
