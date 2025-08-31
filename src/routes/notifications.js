import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Notification, User } from '../models/index.js';
import { Op } from 'sequelize';
import NotificationService from '../services/notificationService.js';

const router = express.Router();

/**
 * @route   GET /api/notifications
 * @desc    Get user's notifications
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { limit = 20, page = 1, status, useCache = 'true' } = req.query;

  try {
    const notifications = await Notification.getUserNotifications(req.user.id, {
      limit: parseInt(limit),
      skip: (page - 1) * parseInt(limit),
      status,
      useCache: useCache === 'true'
    });

    res.json({
      success: true,
      data: {
        items: notifications,
        total: notifications.length,
        page: parseInt(page),
        totalPages: Math.ceil(notifications.length / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications'
    });
  }
}));

/**
 * @route   GET /api/notifications/unread
 * @desc    Get count of unread notifications
 * @access  Private
 */
router.get('/unread', authenticate, asyncHandler(async (req, res) => {
  const { useCache = 'true' } = req.query;
  
  try {
    const count = await Notification.getUnreadCount(req.user.id, useCache === 'true');
    
    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting unread count'
    });
  }
}));

/**
 * @route   PUT /api/notifications/mark-read
 * @desc    Mark notifications as read
 * @access  Private
 */
router.put('/mark-read', authenticate, asyncHandler(async (req, res) => {
  const { notificationIds } = req.body;

  try {
    if (notificationIds && notificationIds.length > 0) {
      // Mark specific notifications as read
      await Notification.update(
        { status: 'read' },
        { where: { id: { [Op.in]: notificationIds }, recipientId: req.user.id } }
      );
    } else {
      // Mark all notifications as read
      await Notification.markAllAsRead(req.user.id);
    }

    res.json({
      success: true,
      message: 'Notifications marked as read successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking notifications as read'
    });
  }
}));

/**
 * @route   DELETE /api/notifications
 * @desc    Delete notifications
 * @access  Private
 */
router.delete('/', authenticate, asyncHandler(async (req, res) => {
  const { notificationIds } = req.body;

  const whereClause = {
    recipientId: req.user.id
  };

  if (notificationIds) {
    whereClause.id = { [Op.in]: notificationIds };
  }

  await Notification.destroy({
    where: whereClause
  });

  res.json({
    success: true,
    message: 'Notifications deleted successfully'
  });
}));

/**
 * @route   GET /api/notifications/settings
 * @desc    Get notification settings
 * @access  Private
 */
router.get('/settings', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: ['emailNotifications', 'pushNotifications']
  });

  res.json({
    success: true,
    data: { 
      settings: {
        emailNotifications: user.emailNotifications,
        pushNotifications: user.pushNotifications
      }
    }
  });
}));

/**
 * @route   PUT /api/notifications/settings
 * @desc    Update notification settings
 * @access  Private
 */
router.put('/settings', authenticate, asyncHandler(async (req, res) => {
  const { settings } = req.body;

  const user = await User.findByPk(req.user.id);
  
  if (settings.emailNotifications) {
    user.emailNotifications = {
      ...user.emailNotifications,
      ...settings.emailNotifications
    };
  }
  
  if (settings.pushNotifications) {
    user.pushNotifications = {
      ...user.pushNotifications,
      ...settings.pushNotifications
    };
  }
  
  await user.save();

  res.json({
    success: true,
    message: 'Notification settings updated successfully',
    data: { 
      settings: {
        emailNotifications: user.emailNotifications,
        pushNotifications: user.pushNotifications
      }
    }
  });
}));

/**
 * @route   POST /api/notifications
 * @desc    Create a new notification (admin/system use)
 * @access  Private
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const {
    recipientId,
    title,
    message,
    type,
    priority = 'normal',
    actionUrl,
    actionText,
    customData,
    scheduledFor,
    expiresAt
  } = req.body;

  const notification = await Notification.createNotification({
    recipientId,
    senderId: req.user.id,
    title,
    message,
    type,
    priority,
    actionUrl,
    actionText,
    customData,
    scheduledFor,
    expiresAt
  });

  res.status(201).json({
    success: true,
    message: 'Notification created successfully',
    data: { notification }
  });
}));

/**
 * @route   GET /api/notifications/:id
 * @desc    Get notification by ID
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    where: {
      id: req.params.id,
      recipientId: req.user.id
    },
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }
    ]
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  // Mark as read if it's unread
  if (notification.status === 'unread') {
    await notification.markAsRead();
  }

  res.json({
    success: true,
    data: { notification }
  });
}));

/**
 * @route   PUT /api/notifications/:id/archive
 * @desc    Archive a notification
 * @access  Private
 */
router.put('/:id/archive', authenticate, asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    where: {
      id: req.params.id,
      recipientId: req.user.id
    }
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  await notification.archive();

  res.json({
    success: true,
    message: 'Notification archived successfully'
  });
}));

/**
 * @route   POST /api/notifications/bulk
 * @desc    Create bulk notifications (admin/system use)
 * @access  Private
 */
router.post('/bulk', authenticate, asyncHandler(async (req, res) => {
  const {
    recipientIds,
    title,
    message,
    type,
    priority = 'normal',
    actionUrl,
    actionText,
    customData,
    scheduledFor,
    expiresAt
  } = req.body;

  if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'recipientIds must be a non-empty array'
    });
  }

  const notifications = await Promise.all(
    recipientIds.map(recipientId =>
      Notification.createNotification({
        recipientId,
        senderId: req.user.id,
        title,
        message,
        type,
        priority,
        actionUrl,
        actionText,
        customData,
        scheduledFor,
        expiresAt
      })
    )
  );

  res.status(201).json({
    success: true,
    message: `${notifications.length} notifications created successfully`,
    data: { count: notifications.length }
  });
}));

/**
 * @route   POST /api/notifications/cleanup-duplicates
 * @desc    Remove duplicate notifications for the current user
 * @access  Private
 */
router.post('/cleanup-duplicates', authenticate, asyncHandler(async (req, res) => {
  const { hours = 24 } = req.body;
  
  const removedCount = await NotificationService.removeDuplicateNotifications(req.user.id, hours);
  
  res.json({
    success: true,
    message: `Removed ${removedCount} duplicate notifications`,
    data: { removedCount }
  });
}));

/**
 * @route   GET /api/notifications/stats
 * @desc    Get notification statistics for the current user
 * @access  Private
 */
router.get('/stats', authenticate, asyncHandler(async (req, res) => {
  const stats = await NotificationService.getNotificationStats(req.user.id);
  
  res.json({
    success: true,
    data: { stats }
  });
}));

/**
 * @route   POST /api/notifications/cleanup-old
 * @desc    Clean up old notifications (admin only)
 * @access  Private
 */
router.post('/cleanup-old', authenticate, asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }

  const { daysToKeep = 30 } = req.body;
  
  const removedCount = await NotificationService.cleanupOldNotifications(daysToKeep);
  
  res.json({
    success: true,
    message: `Cleaned up ${removedCount} old notifications`,
    data: { removedCount }
  });
}));

export default router;
