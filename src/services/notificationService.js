import { Notification, User, Post, Comment, Job, JobApplication, MarketplaceItem, Chat, Message, LiveChat } from '../models/index.js';
import { Op } from 'sequelize';
import RedisService from './redisService.js';

class NotificationService {
  /**
   * Send notification for post like
   */
  static async notifyPostLike(postId, likerId, postAuthorId) {
    if (likerId === postAuthorId) return; // Don't notify self

    try {
      const post = await Post.findByPk(postId, {
        include: [{ model: User, as: 'author', attributes: ['id', 'displayName', 'username'] }]
      });

      if (!post) return;

      const liker = await User.findByPk(likerId, {
        attributes: ['id', 'displayName', 'username']
      });

      if (!liker) return;

      await Notification.createNotification({
        recipientId: postAuthorId,
        senderId: likerId,
        title: 'New Like',
        message: `${liker.displayName || liker.username} liked your post`,
        type: 'post_like',
        priority: 'normal',
        actionUrl: `/posts/${postId}`,
        actionText: 'View Post',
        customData: {
          postId,
          postTitle: post.title || 'Post',
          likerName: liker.displayName || liker.username
        },
        groupKey: `post_like_${postId}_${likerId}`
      });
    } catch (error) {
      console.error('Error sending post like notification:', error);
    }
  }

  /**
   * Send notification for post comment
   */
  static async notifyPostComment(commentId, commenterId, postId) {
    try {
      const comment = await Comment.findByPk(commentId, {
        include: [
          { model: User, as: 'author', attributes: ['id', 'displayName', 'username'] },
          { model: Post, as: 'post', include: [{ model: User, as: 'author', attributes: ['id', 'displayName', 'username'] }] }
        ]
      });

      if (!comment || !comment.post) return;

      const postAuthorId = comment.post.author_id;
      if (commenterId === postAuthorId) return; // Don't notify self

      await Notification.createNotification({
        recipientId: postAuthorId,
        senderId: commenterId,
        title: 'New Comment',
        message: `${comment.author.displayName || comment.author.username} commented on your post`,
        type: 'post_comment',
        priority: 'normal',
        actionUrl: `/posts/${postId}`,
        actionText: 'View Comment',
        customData: {
          postId,
          commentId,
          commentContent: comment.content.substring(0, 100),
          commenterName: comment.author.displayName || comment.author.username
        },
        groupKey: `post_comment_${postId}_${commenterId}`
      });
    } catch (error) {
      console.error('Error sending post comment notification:', error);
    }
  }

  /**
   * Send notification for comment reply
   */
  static async notifyCommentReply(replyId, replierId, parentCommentId) {
    try {
      const reply = await Comment.findByPk(replyId, {
        include: [{ model: User, as: 'author', attributes: ['id', 'displayName', 'username'] }]
      });

      const parentComment = await Comment.findByPk(parentCommentId, {
        include: [{ model: User, as: 'author', attributes: ['id', 'displayName', 'username'] }]
      });

      if (!reply || !parentComment) return;

      const parentCommenterId = parentComment.userId;
      if (replierId === parentCommenterId) return; // Don't notify self

      await Notification.createNotification({
        recipientId: parentCommenterId,
        senderId: replierId,
        title: 'New Reply',
        message: `${reply.author.displayName || reply.author.username} replied to your comment`,
        type: 'post_comment',
        priority: 'normal',
        actionUrl: `/posts/${parentComment.postId}`,
        actionText: 'View Reply',
        customData: {
          postId: parentComment.postId,
          commentId: parentCommentId,
          replyId,
          replyContent: reply.content.substring(0, 100),
          replierName: reply.author.displayName || reply.author.username
        },
        groupKey: `comment_reply_${parentCommentId}_${replierId}`
      });
    } catch (error) {
      console.error('Error sending comment reply notification:', error);
    }
  }

  /**
   * Send notification for comment like
   */
  static async notifyCommentLike(commentId, likerId, commentAuthorId) {
    if (likerId === commentAuthorId) return; // Don't notify self

    try {
      const comment = await Comment.findByPk(commentId, {
        include: [
          { model: User, as: 'author', attributes: ['id', 'displayName', 'username'] },
          { model: Post, as: 'post', attributes: ['id', 'title'] }
        ]
      });

      if (!comment || !comment.post) return;

      const liker = await User.findByPk(likerId, {
        attributes: ['id', 'displayName', 'username']
      });

      if (!liker) return;

      await Notification.createNotification({
        recipientId: commentAuthorId,
        senderId: likerId,
        title: 'Comment Liked',
        message: `${liker.displayName || liker.username} liked your comment`,
        type: 'comment_like',
        priority: 'normal',
        actionUrl: `/posts/${comment.post.id}#comment-${commentId}`,
        actionText: 'View Comment',
        customData: {
          postId: comment.post.id,
          commentId,
          commentContent: comment.content.substring(0, 100),
          likerName: liker.displayName || liker.username
        },
        groupKey: `comment_like_${commentId}_${likerId}`
      });
    } catch (error) {
      console.error('Error sending comment like notification:', error);
    }
  }

  /**
   * Send notification for post mention
   */
  static async notifyPostMention(postId, mentionerId, mentionedUserIds) {
    try {
      const post = await Post.findByPk(postId, {
        include: [{ model: User, as: 'author', attributes: ['id', 'displayName', 'username'] }]
      });

      if (!post) return;

      const mentioner = await User.findByPk(mentionerId, {
        attributes: ['id', 'displayName', 'username']
      });

      if (!mentioner) return;

      // Send notifications to all mentioned users
      for (const mentionedUserId of mentionedUserIds) {
        if (mentionedUserId === mentionerId) continue; // Don't notify self

        await Notification.createNotification({
          recipientId: mentionedUserId,
          senderId: mentionerId,
          title: 'You were mentioned',
          message: `${mentioner.displayName || mentioner.username} mentioned you in a post`,
          type: 'post_mention',
          priority: 'high',
          actionUrl: `/posts/${postId}`,
          actionText: 'View Post',
          customData: {
            postId,
            postContent: post.content.substring(0, 100),
            mentionerName: mentioner.displayName || mentioner.username
          },
          groupKey: `post_mention_${postId}_${mentionedUserId}`
        });
      }
    } catch (error) {
      console.error('Error sending post mention notification:', error);
    }
  }

  /**
   * Send notification for post share
   */
  static async notifyPostShare(postId, sharerId, postAuthorId) {
    if (sharerId === postAuthorId) return; // Don't notify self

    try {
      const post = await Post.findByPk(postId, {
        include: [{ model: User, as: 'author', attributes: ['id', 'displayName', 'username'] }]
      });

      if (!post) return;

      const sharer = await User.findByPk(sharerId, {
        attributes: ['id', 'displayName', 'username']
      });

      if (!sharer) return;

      await Notification.createNotification({
        recipientId: postAuthorId,
        senderId: sharerId,
        title: 'Post Shared',
        message: `${sharer.displayName || sharer.username} shared your post`,
        type: 'post_share',
        priority: 'normal',
        actionUrl: `/posts/${postId}`,
        actionText: 'View Post',
        customData: {
          postId,
          postTitle: post.title || 'Post',
          sharerName: sharer.displayName || sharer.username
        },
        groupKey: `post_share_${postId}_${sharerId}`
      });
    } catch (error) {
      console.error('Error sending post share notification:', error);
    }
  }

  /**
   * Send notification for new follower
   */
  static async notifyNewFollower(followerId, followedUserId) {
    if (followerId === followedUserId) return; // Don't notify self

    try {
      const follower = await User.findByPk(followerId, {
        attributes: ['id', 'displayName', 'username']
      });

      if (!follower) return;

      await Notification.createNotification({
        recipientId: followedUserId,
        senderId: followerId,
        title: 'New Follower',
        message: `${follower.displayName || follower.username} started following you`,
        type: 'new_follower',
        priority: 'normal',
        actionUrl: `/profile/${followerId}`,
        actionText: 'View Profile',
        customData: {
          followerId,
          followerName: follower.displayName || follower.username
        },
        groupKey: `new_follower_${followedUserId}_${followerId}`
      });
    } catch (error) {
      console.error('Error sending new follower notification:', error);
    }
  }

  /**
   * Send notification for follow request
   */
  static async notifyFollowRequest(requesterId, requestedUserId) {
    if (requesterId === requestedUserId) return; // Don't notify self

    try {
      const requester = await User.findByPk(requesterId, {
        attributes: ['id', 'displayName', 'username']
      });

      if (!requester) return;

      await Notification.createNotification({
        recipientId: requestedUserId,
        senderId: requesterId,
        title: 'Follow Request',
        message: `${requester.displayName || requester.username} wants to follow you`,
        type: 'follow_request',
        priority: 'normal',
        actionUrl: `/profile/${requesterId}`,
        actionText: 'View Profile',
        customData: {
          requesterId,
          requesterName: requester.displayName || requester.username
        },
        groupKey: `follow_request_${requestedUserId}_${requesterId}`
      });
    } catch (error) {
      console.error('Error sending follow request notification:', error);
    }
  }

  /**
   * Send notification for new message
   */
  static async notifyNewMessage(messageId, senderId, chatId) {
    try {
      const message = await Message.findByPk(messageId, {
        include: [
          { model: User, as: 'sender', attributes: ['id', 'displayName', 'username'] },
          { model: Chat, as: 'chat' }
        ]
      });

      if (!message || !message.chat) return;

      const chat = message.chat;
      const participants = chat.participants || [];

      // Send notification to all participants except sender
      for (const participantId of participants) {
        if (participantId === senderId) continue; // Don't notify self

        await Notification.createNotification({
          recipientId: participantId,
          senderId,
          title: 'New Message',
          message: `${message.sender.displayName || message.sender.username}: ${message.content.substring(0, 50)}`,
          type: 'new_message',
          priority: 'high',
          actionUrl: `/chat/${chatId}`,
          actionText: 'View Chat',
          customData: {
            chatId,
            messageId,
            messageContent: message.content.substring(0, 100),
            senderName: message.sender.displayName || message.sender.username
          },
          groupKey: `new_message_${chatId}_${participantId}`
        });
      }
    } catch (error) {
      console.error('Error sending new message notification:', error);
    }
  }

  /**
   * Send notification for group invite
   */
  static async notifyGroupInvite(inviterId, inviteeId, groupId, groupName) {
    if (inviterId === inviteeId) return; // Don't notify self

    try {
      const inviter = await User.findByPk(inviterId, {
        attributes: ['id', 'displayName', 'username']
      });

      if (!inviter) return;

      await Notification.createNotification({
        recipientId: inviteeId,
        senderId: inviterId,
        title: 'Group Invitation',
        message: `${inviter.displayName || inviter.username} invited you to join ${groupName}`,
        type: 'group_invite',
        priority: 'normal',
        actionUrl: `/groups/${groupId}`,
        actionText: 'View Group',
        customData: {
          groupId,
          groupName,
          inviterName: inviter.displayName || inviter.username
        },
        groupKey: `group_invite_${groupId}_${inviteeId}`
      });
    } catch (error) {
      console.error('Error sending group invite notification:', error);
    }
  }

  /**
   * Send notification for group mention
   */
  static async notifyGroupMention(postId, mentionerId, groupId, groupName) {
    try {
      const mentioner = await User.findByPk(mentionerId, {
        attributes: ['id', 'displayName', 'username']
      });

      if (!mentioner) return;

      // Get all group members
      // This would need to be implemented based on your group membership structure
      const groupMembers = await this.getGroupMembers(groupId);

      for (const memberId of groupMembers) {
        if (memberId === mentionerId) continue; // Don't notify self

        await Notification.createNotification({
          recipientId: memberId,
          senderId: mentionerId,
          title: 'Group Mention',
          message: `${mentioner.displayName || mentioner.username} mentioned ${groupName} in a post`,
          type: 'group_mention',
          priority: 'normal',
          actionUrl: `/posts/${postId}`,
          actionText: 'View Post',
          customData: {
            postId,
            groupId,
            groupName,
            mentionerName: mentioner.displayName || mentioner.username
          },
          groupKey: `group_mention_${groupId}_${postId}`
        });
      }
    } catch (error) {
      console.error('Error sending group mention notification:', error);
    }
  }

  /**
   * Send notification for job application
   */
  static async notifyJobApplication(applicationId, applicantId, jobId) {
    try {
      const application = await JobApplication.findByPk(applicationId, {
        include: [
          { model: User, as: 'applicant', attributes: ['id', 'displayName', 'username'] },
          { model: Job, as: 'job', include: [{ model: User, as: 'postedBy', attributes: ['id', 'displayName', 'username'] }] }
        ]
      });

      if (!application || !application.job) return;

      const jobPosterId = application.job.posted_by_id;
      if (applicantId === jobPosterId) return; // Don't notify self

      await Notification.createNotification({
        recipientId: jobPosterId,
        senderId: applicantId,
        title: 'New Job Application',
        message: `${application.applicant.displayName || application.applicant.username} applied for ${application.job.title}`,
        type: 'job_application',
        priority: 'high',
        actionUrl: `/jobs/${jobId}/applications/${applicationId}`,
        actionText: 'View Application',
        customData: {
          jobId,
          applicationId,
          jobTitle: application.job.title,
          applicantName: application.applicant.displayName || application.applicant.username
        },
        groupKey: `job_application_${jobId}_${applicantId}`
      });
    } catch (error) {
      console.error('Error sending job application notification:', error);
    }
  }

  /**
   * Send notification for job application status update
   */
  static async notifyJobApplicationStatus(applicationId, status, jobPosterId, applicantId) {
    try {
      const application = await JobApplication.findByPk(applicationId, {
        include: [
          { model: User, as: 'applicant', attributes: ['id', 'displayName', 'username'] },
          { model: Job, as: 'job', attributes: ['id', 'title'] }
        ]
      });

      if (!application || !application.job) return;

      const statusMessages = {
        'reviewed': 'Your application is being reviewed',
        'shortlisted': 'You have been shortlisted for this position',
        'interview_scheduled': 'An interview has been scheduled',
        'hired': 'Congratulations! You have been hired',
        'rejected': 'Your application was not selected for this position'
      };

      const message = statusMessages[status] || `Your application status has been updated to ${status}`;

      await Notification.createNotification({
        recipientId: applicantId,
        senderId: jobPosterId,
        title: 'Application Update',
        message: `${message} for ${application.job.title}`,
        type: 'job_application_status',
        priority: status === 'hired' ? 'urgent' : 'high',
        actionUrl: `/jobs/${application.job.id}/applications/${applicationId}`,
        actionText: 'View Details',
        customData: {
          jobId: application.job.id,
          applicationId,
          jobTitle: application.job.title,
          status
        },
        groupKey: `job_application_status_${applicationId}`
      });
    } catch (error) {
      console.error('Error sending job application status notification:', error);
    }
  }

  /**
   * Send notification for marketplace inquiry
   */
  static async notifyMarketplaceInquiry(inquiryId, inquirerId, itemId) {
    try {
      const item = await MarketplaceItem.findByPk(itemId, {
        include: [{ model: User, as: 'seller', attributes: ['id', 'displayName', 'username'] }]
      });

      if (!item) return;

      const sellerId = item.seller_id;
      if (inquirerId === sellerId) return; // Don't notify self

      const inquirer = await User.findByPk(inquirerId, {
        attributes: ['id', 'displayName', 'username']
      });

      if (!inquirer) return;

      await Notification.createNotification({
        recipientId: sellerId,
        senderId: inquirerId,
        title: 'Marketplace Inquiry',
        message: `${inquirer.displayName || inquirer.username} is interested in your item`,
        type: 'marketplace_inquiry',
        priority: 'normal',
        actionUrl: `/marketplace/${itemId}`,
        actionText: 'View Item',
        customData: {
          itemId,
          inquiryId,
          itemTitle: item.title,
          inquirerName: inquirer.displayName || inquirer.username
        },
        groupKey: `marketplace_inquiry_${itemId}_${inquirerId}`
      });
    } catch (error) {
      console.error('Error sending marketplace inquiry notification:', error);
    }
  }

  /**
   * Send notification for marketplace favorite
   */
  static async notifyMarketplaceFavorite(favoriterId, itemId) {
    try {
      const item = await MarketplaceItem.findByPk(itemId, {
        include: [{ model: User, as: 'seller', attributes: ['id', 'displayName', 'username'] }]
      });

      if (!item) return;

      const sellerId = item.seller_id;
      if (favoriterId === sellerId) return; // Don't notify self

      const favoriter = await User.findByPk(favoriterId, {
        attributes: ['id', 'displayName', 'username']
      });

      if (!favoriter) return;

      await Notification.createNotification({
        recipientId: sellerId,
        senderId: favoriterId,
        title: 'Item Favorited',
        message: `${favoriter.displayName || favoriter.username} added your item to favorites`,
        type: 'marketplace_favorite',
        priority: 'normal',
        actionUrl: `/marketplace/${itemId}`,
        actionText: 'View Item',
        customData: {
          itemId,
          itemTitle: item.title,
          favoriterName: favoriter.displayName || favoriter.username
        },
        groupKey: `marketplace_favorite_${itemId}_${favoriterId}`
      });
    } catch (error) {
      console.error('Error sending marketplace favorite notification:', error);
    }
  }

  /**
   * Send notification for content report
   */
  static async notifyContentReport(reportId, reporterId, reportedUserId, contentType, contentId) {
    try {
      const reporter = await User.findByPk(reporterId, {
        attributes: ['id', 'displayName', 'username']
      });

      if (!reporter) return;

      // Notify admins about the report
      const adminUsers = await User.findAll({
        where: { role: 'admin' },
        attributes: ['id']
      });

      for (const admin of adminUsers) {
        await Notification.createNotification({
          recipientId: admin.id,
          senderId: reporterId,
          title: 'Content Reported',
          message: `${reporter.displayName || reporter.username} reported ${contentType}`,
          type: 'content_reported',
          priority: 'high',
          actionUrl: `/admin/reports/${reportId}`,
          actionText: 'Review Report',
          customData: {
            reportId,
            contentType,
            contentId,
            reporterName: reporter.displayName || reporter.username,
            reportedUserId
          },
          groupKey: `content_reported_${contentType}_${contentId}`
        });
      }
    } catch (error) {
      console.error('Error sending content report notification:', error);
    }
  }

  /**
   * Send notification for system update
   */
  static async notifySystemUpdate(userIds, title, message, priority = 'normal') {
    try {
      for (const userId of userIds) {
        await Notification.createNotification({
          recipientId: userId,
          title,
          message,
          type: 'system_update',
          priority,
          actionUrl: '/settings',
          actionText: 'View Details',
          customData: {
            updateType: 'system'
          }
        });
      }
    } catch (error) {
      console.error('Error sending system update notification:', error);
    }
  }

  /**
   * Send notification for maintenance alert
   */
  static async notifyMaintenanceAlert(userIds, title, message, scheduledTime) {
    try {
      for (const userId of userIds) {
        await Notification.createNotification({
          recipientId: userId,
          title,
          message,
          type: 'maintenance',
          priority: 'high',
          actionUrl: '/service-status',
          actionText: 'View Status',
          customData: {
            scheduledTime,
            maintenanceType: 'scheduled'
          }
        });
      }
    } catch (error) {
      console.error('Error sending maintenance alert notification:', error);
    }
  }

  /**
   * Send notification for security alert
   */
  static async notifySecurityAlert(userId, title, message, alertType) {
    try {
      await Notification.createNotification({
        recipientId: userId,
        title,
        message,
        type: 'security_alert',
        priority: 'urgent',
        actionUrl: '/security-settings',
        actionText: 'Review Security',
        customData: {
          alertType,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error sending security alert notification:', error);
    }
  }

  /**
   * Send notification for achievement unlocked
   */
  static async notifyAchievement(userId, achievementName, achievementDescription) {
    try {
      await Notification.createNotification({
        recipientId: userId,
        title: 'Achievement Unlocked!',
        message: `You've earned the "${achievementName}" achievement!`,
        type: 'achievement',
        priority: 'normal',
        actionUrl: '/profile/achievements',
        actionText: 'View Achievements',
        customData: {
          achievementName,
          achievementDescription
        }
      });
    } catch (error) {
      console.error('Error sending achievement notification:', error);
    }
  }

  /**
   * Send notification for reminder
   */
  static async notifyReminder(userId, title, message, reminderType, scheduledTime) {
    try {
      await Notification.createNotification({
        recipientId: userId,
        title,
        message,
        type: 'reminder',
        priority: 'normal',
        actionUrl: '/reminders',
        actionText: 'View Reminders',
        customData: {
          reminderType,
          scheduledTime
        },
        scheduledFor: scheduledTime
      });
    } catch (error) {
      console.error('Error sending reminder notification:', error);
    }
  }

  /**
   * Helper method to get group members (placeholder)
   */
  static async getGroupMembers(groupId) {
    // This would need to be implemented based on your group membership structure
    // For now, return an empty array
    return [];
  }

  /**
   * Send bulk notifications to multiple users
   */
  static async sendBulkNotifications(userIds, notificationData) {
    try {
      const notifications = userIds.map(userId => ({
        recipientId: userId,
        ...notificationData
      }));

      await Notification.bulkCreate(notifications);
    } catch (error) {
      console.error('Error sending bulk notifications:', error);
    }
  }

  /**
   * Mark notifications as read
   */
  static async markNotificationsAsRead(userId, notificationIds = null) {
    try {
      const whereClause = {
        recipientId: userId,
        status: 'unread'
      };

      if (notificationIds) {
        whereClause.id = { [Op.in]: notificationIds };
      }

      await Notification.update(
        { 
          status: 'read',
          readAt: new Date()
        },
        { where: whereClause }
      );
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  }

  /**
   * Delete notifications
   */
  static async deleteNotifications(userId, notificationIds = null) {
    try {
      const whereClause = {
        recipientId: userId
      };

      if (notificationIds) {
        whereClause.id = { [Op.in]: notificationIds };
      }

      await Notification.destroy({ where: whereClause });
    } catch (error) {
      console.error('Error deleting notifications:', error);
    }
  }

  /**
   * Check for and remove duplicate notifications
   */
  static async removeDuplicateNotifications(userId, hours = 24) {
    try {
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      // Find notifications created within the specified hours
      const recentNotifications = await Notification.findAll({
        where: {
          recipientId: userId,
          created_at: { [Op.gte]: cutoffTime }
        },
        order: [['created_at', 'ASC']]
      });

      const duplicates = [];
      const seen = new Map();

      // Group notifications by type, sender, and content
      for (const notification of recentNotifications) {
        const key = `${notification.type}_${notification.senderId || 'system'}_${notification.title}`;
        
        if (seen.has(key)) {
          // This is a duplicate
          duplicates.push(notification.id);
        } else {
          seen.set(key, notification.id);
        }
      }

      // Remove duplicates
      if (duplicates.length > 0) {
        await Notification.destroy({
          where: {
            id: { [Op.in]: duplicates }
          }
        });
        

      }

      return duplicates.length;
    } catch (error) {
      console.error('Error removing duplicate notifications:', error);
      return 0;
    }
  }

  /**
   * Clean up old notifications for all users
   */
  static async cleanupOldNotifications(daysToKeep = 30) {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
      
      const deletedCount = await Notification.destroy({
        where: {
          created_at: { [Op.lt]: cutoffDate },
          status: { [Op.in]: ['read', 'archived'] }
        }
      });


      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
      return 0;
    }
  }

  /**
   * Get notification statistics for a user
   */
  static async getNotificationStats(userId) {
    try {
      const stats = await Notification.findAll({
        where: { recipientId: userId },
        attributes: [
          'type',
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['type', 'status'],
        raw: true
      });

      return stats;
    } catch (error) {
      console.error('Error getting notification stats:', error);
      return [];
    }
  }

  /**
   * Enhanced notification creation with duplicate prevention
   */
  static async createNotificationWithDuplicateCheck(notificationData) {
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

      // Check for recent similar notifications (within last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const existingNotification = await Notification.findOne({
        where: {
          recipientId,
          type,
          senderId: senderId || null,
          created_at: { [Op.gte]: fiveMinutesAgo },
          title
        }
      });

      if (existingNotification) {

        return existingNotification;
      }

      // Use the existing createNotification method which has groupKey logic
      return await Notification.createNotification(notificationData);
    } catch (error) {
      console.error('Error creating notification with duplicate check:', error);
      throw error;
    }
  }

  /**
   * Send notification for job application
   */
  static async notifyJobApplication(applicationId, applicantId, jobId, jobTitle) {
    try {
      const application = await JobApplication.findByPk(applicationId, {
        include: [
          { model: User, as: 'applicant', attributes: ['id', 'displayName', 'username'] },
          { model: Job, as: 'job', include: [{ model: User, as: 'postedBy', attributes: ['id', 'displayName', 'username'] }] }
        ]
      });

      if (!application || !application.job) return;

      const jobPosterId = application.job.postedById;
      if (applicantId === jobPosterId) return; // Don't notify self

      // Notify job poster
      await Notification.createNotification({
        recipientId: jobPosterId,
        senderId: applicantId,
        title: 'New Job Application',
        message: `${application.applicant.displayName || application.applicant.username} applied for your job: ${jobTitle}`,
        type: 'job_application',
        priority: 'normal',
        actionUrl: `/job-applications/${jobId}/applications`,
        actionText: 'View Applications',
        customData: {
          jobId,
          jobTitle,
          applicantName: application.applicant.displayName || application.applicant.username,
          applicationId
        },
        groupKey: `job_application_${jobId}_${applicantId}`
      });

      // Notify applicant
      await Notification.createNotification({
        recipientId: applicantId,
        senderId: jobPosterId,
        title: 'Application Submitted',
        message: `Your application for ${jobTitle} has been submitted successfully`,
        type: 'application_submitted',
        priority: 'normal',
        actionUrl: `/jobs/${jobId}`,
        actionText: 'View Job',
        customData: {
          jobId,
          jobTitle,
          applicationId
        },
        groupKey: `application_submitted_${jobId}_${applicantId}`
      });
    } catch (error) {
      console.error('Error sending job application notification:', error);
    }
  }

  /**
   * Send notification for application status update
   */
  static async notifyApplicationStatusUpdate(applicationId, jobId, jobTitle, oldStatus, newStatus) {
    try {
      const application = await JobApplication.findByPk(applicationId, {
        include: [
          { model: User, as: 'applicant', attributes: ['id', 'displayName', 'username'] },
          { model: Job, as: 'job', include: [{ model: User, as: 'postedBy', attributes: ['id', 'displayName', 'username'] }] }
        ]
      });

      if (!application || !application.job) return;

      const applicantId = application.applicantId;
      const jobPosterId = application.job.postedById;

      // Notify applicant about status change
      if (applicantId !== jobPosterId) {
        await Notification.createNotification({
          recipientId: applicantId,
          senderId: jobPosterId,
          title: 'Application Status Updated',
          message: `Your application for ${jobTitle} has been ${newStatus}`,
          type: 'application_status_update',
          priority: 'normal',
          actionUrl: `/jobs/${jobId}`,
          actionText: 'View Job',
          customData: {
            jobId,
            jobTitle,
            applicationId,
            oldStatus,
            newStatus
          },
          groupKey: `status_update_${applicationId}_${newStatus}`
        });
      }
    } catch (error) {
      console.error('Error sending application status update notification:', error);
    }
  }
}

export default NotificationService;
