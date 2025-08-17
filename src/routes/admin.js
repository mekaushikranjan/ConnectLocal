import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { isAdmin, isStaff } from '../middleware/roleAuth.js';
import { User } from '../models/index.js';
import Post from '../models/Post.js';
import Job from '../models/Job.js';
import MarketplaceItem from '../models/MarketplaceItem.js';
import Report from '../models/Report.js';
import ModerationLog from '../models/ModerationLog.js';
import { Op } from 'sequelize';

const router = express.Router();

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get admin dashboard statistics
 * @access  Admin
 */
router.get('/dashboard', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const [
    userCount,
    postCount,
    jobCount,
    marketplaceCount,
    reportCount,
    activeUsers
  ] = await Promise.all([
    User.count(),
    Post.count(),
    Job.count(),
    MarketplaceItem.count(),
    Report.count({ where: { status: 'pending' } }),
    User.count({
      where: {
        lastActive: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    })
  ]);

  res.json({
    success: true,
    data: {
      userCount,
      postCount,
      jobCount,
      marketplaceCount,
      pendingReports: reportCount,
      activeUsers24h: activeUsers
    }
  });
}));

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with filters
 * @access  Admin
 */
router.get('/users', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const { 
    search,
    status,
    role,
    limit = 10,
    page = 1
  } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = {};
  if (search) {
    whereClause[Op.or] = [
      { username: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { displayName: { [Op.iLike]: `%${search}%` } }
    ];
  }
  if (status) whereClause.status = status;
  if (role) whereClause.role = role;

  const users = await User.findAndCountAll({
    where: whereClause,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  res.json({
    success: true,
    data: {
      users: users.rows,
      total: users.count,
      page: parseInt(page),
      totalPages: Math.ceil(users.count / limit)
    }
  });
}));

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update user status or role
 * @access  Admin
 */
router.put('/users/:id', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const { status, role } = req.body;

  if (status) user.status = status;
  if (role) user.role = role;

  await user.save();

  res.json({
    success: true,
    message: 'User updated successfully',
    data: { user }
  });
}));

/**
 * @route   GET /api/admin/reports
 * @desc    Get all reports with filters
 * @access  Admin
 */
router.get('/reports', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const { 
    status,
    type,
    limit = 10,
    page = 1
  } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = {};
  if (status) whereClause.status = status;
  if (type) whereClause.type = type;

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
    order: [['createdAt', 'DESC']]
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
 * @route   PUT /api/admin/reports/:id
 * @desc    Update report status
 * @access  Admin
 */
router.put('/reports/:id', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const report = await Report.findByPk(req.params.id);

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Report not found'
    });
  }

  const { status, resolution } = req.body;

  report.status = status;
  report.resolution = resolution;
  report.resolvedBy = req.user.id;
  report.resolvedAt = new Date();

  await report.save();

  res.json({
    success: true,
    message: 'Report updated successfully',
    data: { report }
  });
}));

/**
 * @route   GET /api/admin/content
 * @desc    Get reported content
 * @access  Admin
 */
router.get('/content', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const { type, status, limit = 10, page = 1 } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = {};
  if (type) whereClause.type = type;
  if (status) whereClause.status = status;

  let content;
  switch (type) {
    case 'post':
      content = await Post.findAndCountAll({
        where: whereClause,
        include: [{
          model: User,
          attributes: ['id', 'username', 'displayName']
        }],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      break;
    case 'job':
      content = await Job.findAndCountAll({
        where: whereClause,
        include: [{
          model: User,
          attributes: ['id', 'username', 'displayName']
        }],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      break;
    case 'marketplace':
      content = await MarketplaceItem.findAndCountAll({
        where: whereClause,
        include: [{
          model: User,
          attributes: ['id', 'username', 'displayName']
        }],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      break;
    default:
      return res.status(400).json({
        success: false,
        message: 'Invalid content type'
      });
  }

  res.json({
    success: true,
    data: {
      content: content.rows,
      total: content.count,
      page: parseInt(page),
      totalPages: Math.ceil(content.count / limit)
    }
  });
}));

/**
 * @route   GET /api/admin/moderation-logs
 * @desc    Get moderation logs with filters
 * @access  Admin
 */
router.get('/moderation-logs', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const { 
    type,
    action,
    moderatorId,
    startDate,
    endDate,
    limit = 10,
    page = 1
  } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = {};
  if (type) whereClause.type = type;
  if (action) whereClause.action = action;
  if (moderatorId) whereClause.moderatorId = moderatorId;
  
  // Date range filter
  if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate);
    if (endDate) whereClause.createdAt[Op.lte] = new Date(endDate);
  }

  const logs = await ModerationLog.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'moderator',
        attributes: ['id', 'username', 'displayName', 'role']
      }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
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

/**
 * @route   GET /api/admin/moderation-logs/stats
 * @desc    Get moderation statistics
 * @access  Admin
 */
router.get('/moderation-logs/stats', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const dateRange = {};
  if (startDate) dateRange[Op.gte] = new Date(startDate);
  if (endDate) dateRange[Op.lte] = new Date(endDate);

  const [
    totalActions,
    actionsByType,
    actionsByModerator,
    resolutionTimes,
    recentActions
  ] = await Promise.all([
    // Total actions count
    ModerationLog.count({
      where: startDate || endDate ? { createdAt: dateRange } : {}
    }),

    // Actions grouped by type
    ModerationLog.findAll({
      where: startDate || endDate ? { createdAt: dateRange } : {},
      attributes: [
        'type',
        'action',
        [sequelize.fn('COUNT', '*'), 'count']
      ],
      group: ['type', 'action']
    }),

    // Actions by moderator
    ModerationLog.findAll({
      where: startDate || endDate ? { createdAt: dateRange } : {},
      attributes: [
        'moderatorId',
        [sequelize.fn('COUNT', '*'), 'count']
      ],
      include: [{
        model: User,
        as: 'moderator',
        attributes: ['username', 'displayName', 'role']
      }],
      group: ['moderatorId', 'moderator.id', 'moderator.username', 'moderator.displayName', 'moderator.role']
    }),

    // Average resolution times for reports
    ModerationLog.findAll({
      where: {
        type: 'report',
        action: 'resolve_report',
        ...(startDate || endDate ? { createdAt: dateRange } : {})
      },
      attributes: [
        [sequelize.fn('AVG', 
          sequelize.fn('EXTRACT', 'EPOCH', 
            sequelize.col('createdAt') - sequelize.col('details.reportCreatedAt')
          )
        ), 'avgResolutionTime']
      ]
    }),

    // Recent actions
    ModerationLog.findAll({
      where: startDate || endDate ? { createdAt: dateRange } : {},
      limit: 10,
      order: [['createdAt', 'DESC']],
      include: [{
        model: User,
        as: 'moderator',
        attributes: ['username', 'displayName', 'role']
      }]
    })
  ]);

  res.json({
    success: true,
    data: {
      totalActions,
      actionsByType,
      actionsByModerator,
      averageResolutionTime: resolutionTimes[0]?.getDataValue('avgResolutionTime'),
      recentActions
    }
  });
}));

/**
 * @route   GET /api/admin/moderation-logs/:id
 * @desc    Get detailed moderation log entry
 * @access  Admin
 */
router.get('/moderation-logs/:id', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const log = await ModerationLog.findByPk(req.params.id, {
    include: [
      {
        model: User,
        as: 'moderator',
        attributes: ['id', 'username', 'displayName', 'role']
      }
    ]
  });

  if (!log) {
    return res.status(404).json({
      success: false,
      message: 'Moderation log not found'
    });
  }

  // Fetch related content based on type
  let targetContent = null;
  switch (log.type) {
    case 'post':
      targetContent = await Post.findByPk(log.targetId, {
        include: [{ model: User, attributes: ['id', 'username', 'displayName'] }]
      });
      break;
    case 'user':
      targetContent = await User.findByPk(log.targetId, {
        attributes: ['id', 'username', 'displayName', 'status']
      });
      break;
    case 'job':
      targetContent = await Job.findByPk(log.targetId, {
        include: [{ model: User, attributes: ['id', 'username', 'displayName'] }]
      });
      break;
    case 'marketplace':
      targetContent = await MarketplaceItem.findByPk(log.targetId, {
        include: [{ model: User, attributes: ['id', 'username', 'displayName'] }]
      });
      break;
  }

  res.json({
    success: true,
    data: {
      log,
      targetContent
    }
  });
}));

/**
 * @route   GET /api/admin/moderation-logs/moderator/:id
 * @desc    Get moderation logs for specific moderator
 * @access  Admin
 */
router.get('/moderation-logs/moderator/:id', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const { limit = 10, page = 1 } = req.query;
  const offset = (page - 1) * limit;

  const logs = await ModerationLog.findAndCountAll({
    where: { moderatorId: req.params.id },
    include: [
      {
        model: User,
        as: 'moderator',
        attributes: ['id', 'username', 'displayName', 'role']
      }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  // Get moderator stats
  const stats = await ModerationLog.findAll({
    where: { moderatorId: req.params.id },
    attributes: [
      'type',
      'action',
      [sequelize.fn('COUNT', '*'), 'count']
    ],
    group: ['type', 'action']
  });

  res.json({
    success: true,
    data: {
      logs: logs.rows,
      total: logs.count,
      page: parseInt(page),
      totalPages: Math.ceil(logs.count / limit),
      stats
    }
  });
}));

export default router;
