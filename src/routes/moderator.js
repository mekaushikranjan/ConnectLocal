import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { isStaff } from '../middleware/roleAuth.js';
  import { User } from '../models/index.js';
import Post from '../models/Post.js';
import Job from '../models/Job.js';
import MarketplaceItem from '../models/MarketplaceItem.js';
import Report from '../models/Report.js';
import ModerationLog from '../models/ModerationLog.js';
import { Op } from 'sequelize';

const router = express.Router();

/**
 * @route   GET /api/moderator/dashboard
 * @desc    Get moderator dashboard with pending tasks
 * @access  Moderator
 */
router.get('/dashboard', authenticate, isStaff, asyncHandler(async (req, res) => {
  const pendingReports = await Report.count({ where: { status: 'pending' } });
  const recentReports = await Report.findAll({
    where: { status: 'pending' },
    limit: 5,
    order: [['createdAt', 'DESC']],
    include: [{
      model: User,
      as: 'reporter',
      attributes: ['id', 'username', 'displayName']
    }]
  });

  res.json({
    success: true,
    data: {
      pendingReports,
      recentReports
    }
  });
}));

/**
 * @route   GET /api/moderator/reports/queue
 * @desc    Get reports queue for review
 * @access  Moderator
 */
router.get('/reports/queue', authenticate, isStaff, asyncHandler(async (req, res) => {
  const { type, priority, limit = 10, page = 1 } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = { status: 'pending' };
  if (type) whereClause.type = type;
  if (priority) whereClause.priority = priority;

  const reports = await Report.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'reporter',
        attributes: ['id', 'username', 'displayName']
      },
      {
        model: User,
        as: 'reported',
        attributes: ['id', 'username', 'displayName']
      }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['priority', 'DESC'], ['createdAt', 'ASC']]
  });

  res.json({
    success: true,
    data: {
      reports: reports.rows,
      total: reports.count,
      page: parseInt(page),
      totalPages: Math.ceil(reports.count / limit)
    }
  });
}));

/**
 * @route   POST /api/moderator/content/:type/:id/moderate
 * @desc    Take moderation action on content
 * @access  Moderator
 */
router.post('/content/:type/:id/moderate', authenticate, isStaff, asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const { action, reason, duration } = req.body;

  let model;
  switch (type) {
    case 'post':
      model = Post;
      break;
    case 'job':
      model = Job;
      break;
    case 'marketplace':
      model = MarketplaceItem;
      break;
    default:
      return res.status(400).json({
        success: false,
        message: 'Invalid content type'
      });
  }

  const content = await model.findByPk(id);
  if (!content) {
    return res.status(404).json({
      success: false,
      message: 'Content not found'
    });
  }

  // Record moderation action
  const log = await ModerationLog.create({
    moderatorId: req.user.id,
    type,
    action,
    targetId: id,
    reason,
    details: { duration }
  });

  switch (action) {
    case 'hide':
      content.status = 'hidden';
      content.moderationReason = reason;
      await content.save();
      break;
    case 'restore':
      content.status = 'active';
      content.moderationReason = null;
      await content.save();
      break;
    case 'delete':
      if (req.user.role === 'admin') {
        await content.destroy();
      } else {
        return res.status(403).json({
          success: false,
          message: 'Only admins can delete content'
        });
      }
      break;
    default:
      return res.status(400).json({
        success: false,
        message: 'Invalid action'
      });
  }

  res.json({
    success: true,
    message: `Content ${action}d successfully`,
    data: { log }
  });
}));

/**
 * @route   POST /api/moderator/users/:id/warn
 * @desc    Issue warning to user
 * @access  Moderator
 */
router.post('/users/:id/warn', authenticate, isStaff, asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const { reason, details } = req.body;

  // Create warning log
  await ModerationLog.create({
    moderatorId: req.user.id,
    type: 'user',
    action: 'warn',
    targetId: user.id,
    reason,
    details
  });

  res.json({
    success: true,
    message: 'Warning issued successfully'
  });
}));

/**
 * @route   POST /api/moderator/users/:id/suspend
 * @desc    Temporarily suspend user (max 7 days for moderators)
 * @access  Moderator
 */
router.post('/users/:id/suspend', authenticate, isStaff, asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const { reason, duration } = req.body;

  // Moderators can only suspend up to 7 days
  if (req.user.role === 'moderator' && duration > 7) {
    return res.status(403).json({
      success: false,
      message: 'Moderators can only suspend users for up to 7 days'
    });
  }

  user.status = 'suspended';
  user.moderationReason = reason;
  user.lastModeratedBy = req.user.id;
  user.lastModeratedAt = new Date();
  await user.save();

  // Create suspension log
  await ModerationLog.create({
    moderatorId: req.user.id,
    type: 'user',
    action: 'suspend',
    targetId: user.id,
    reason,
    details: { duration }
  });

  res.json({
    success: true,
    message: 'User suspended successfully'
  });
}));

/**
 * @route   GET /api/moderator/activity
 * @desc    Get moderator's activity log
 * @access  Moderator
 */
router.get('/activity', authenticate, isStaff, asyncHandler(async (req, res) => {
  const { limit = 20, page = 1 } = req.query;
  const offset = (page - 1) * limit;

  const logs = await ModerationLog.findAndCountAll({
    where: { moderatorId: req.user.id },
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']],
    include: [{
      model: User,
      as: 'moderator',
      attributes: ['id', 'username', 'displayName']
    }]
  });

  res.json({
    success: true,
    data: {
      logs: logs.rows,
      total: logs.count,
      page: parseInt(page),
      totalPages: Math.ceil(logs.count / limit)
    }
  });
}));

export default router;
