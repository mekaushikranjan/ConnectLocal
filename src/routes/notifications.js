import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Notification, User } from '../models/index.js';
import { Op } from 'sequelize';

const router = express.Router();

/**
 * @route   GET /api/notifications
 * @desc    Get user's notifications
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { limit = 20, page = 1, status } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = { recipientId: req.user.id };
  if (status) {
    whereClause.status = status;
  }

  const notifications = await Notification.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  res.json({
    success: true,
    data: {
      items: notifications.rows,
      total: notifications.count,
      page: parseInt(page),
      totalPages: Math.ceil(notifications.count / limit)
    }
  });
}));

/**
 * @route   GET /api/notifications/unread
 * @desc    Get count of unread notifications
 * @access  Private
 */
router.get('/unread', authenticate, asyncHandler(async (req, res) => {
  const count = await Notification.count({
    where: {
      recipientId: req.user.id,
      status: 'unread'
    }
  });   

  res.json({
    success: true,
    data: { count }
  });
}));

/**
 * @route   PUT /api/notifications/mark-read
 * @desc    Mark notifications as read
 * @access  Private
 */
router.put('/mark-read', authenticate, asyncHandler(async (req, res) => {
  const { notificationIds } = req.body;

  const whereClause = {
    recipientId: req.user.id,
    status: 'unread'
  };

  if (notificationIds) {
    whereClause.id = { [Op.in]: notificationIds };
  }

  await Notification.update(
    { status: 'read' },
    { where: whereClause }
  );

  res.json({
    success: true,
    message: 'Notifications marked as read successfully'
  });
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

export default router;
