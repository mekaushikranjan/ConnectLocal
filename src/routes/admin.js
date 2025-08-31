import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { isAdmin, isStaff } from '../middleware/roleAuth.js';
import { User, Report, Post, Job, MarketplaceItem, ModerationLog, SupportTicket, sequelize } from '../models/index.js';
import { Op } from 'sequelize';
import os from 'os';

const router = express.Router();

/**
 * @route   GET /api/admin/dashboard/stats
 * @desc    Get admin dashboard statistics
 * @access  Admin
 */
router.get('/dashboard/stats', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
    const [
      totalUsers,
      newUsers24h,
      activeUsers24h,
      totalPosts,
      totalReports,
      pendingReports,
      pendingSupportTickets,
      totalSupportTickets
    ] = await Promise.all([
      User.count(),
      User.count({
        where: {
          created_at: {
            [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      }),
      User.count({
        where: {
          last_active: {
            [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      }),
      Post.count(),
      Report.count(),
      Report.count({ where: { status: 'pending' } }),
      SupportTicket.count({ where: { status: { [Op.in]: ['open', 'in_progress'] } } }),
      SupportTicket.count()
    ]);

    // Mock system health data
    const systemHealth = {
      status: 'healthy',
      details: {
        cpu: 45,
        memory: 60,
        storage: 30
      }
    };

    res.json({
      success: true,
      data: {
        totalUsers,
        newUsers24h,
        activeUsers24h,
        totalPosts,
        totalReports,
        pendingReports,
        pendingSupportTickets,
        totalSupportTickets,
        systemHealth
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/admin/dashboard/activity
 * @desc    Get recent admin activity
 * @access  Admin
 */
router.get('/dashboard/activity', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Get recent moderation logs as activity
    const activities = await ModerationLog.findAll({
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'moderator',
          attributes: ['id', 'username', 'displayName']
        }
      ]
    });

    res.json({
      success: true,
      data: {
        activities: activities.map(log => ({
          id: log.id,
          type: log.action,
          userId: log.moderatorId,
          details: {
            action: log.action,
            targetType: log.type,
            targetId: log.targetId,
            reason: log.reason
          },
          timestamp: log.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Activity fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recent activity',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with filters
 * @access  Admin
 */
router.get('/users', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
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
        users: users.rows.map(user => ({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
          lastActive: user.last_active,
          warningCount: 0, // Placeholder - you may need to add this field to User model
          suspensionHistory: [] // Placeholder - you may need to add this to User model
        })),
        total: users.count,
        page: parseInt(page),
        totalPages: Math.ceil(users.count / limit)
      }
    });
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
}));

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update user status or role
 * @access  Admin
 */
router.put('/users/:id', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
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
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
}));

/**
 * @route   PUT /api/admin/users/:id/role
 * @desc    Update user role
 * @access  Admin
 */
router.put('/users/:id/role', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const { role } = req.body;

    if (!['user', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('User role update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user role',
      error: error.message
    });
  }
}));

/**
 * @route   POST /api/admin/users/:id/manage
 * @desc    Manage user (suspend, ban, etc.)
 * @access  Admin
 */
router.post('/users/:id/manage', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const { action, reason } = req.body;

    switch (action) {
      case 'suspend':
        user.status = 'suspended';
        break;
      case 'ban':
        user.status = 'banned';
        break;
      case 'activate':
        user.status = 'active';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action'
        });
    }

    await user.save();

         // Log the moderation action
     await ModerationLog.create({
       moderatorId: req.user.id,
       type: 'user',
       targetId: user.id,
       action: action,
       reason: reason
     });

    res.json({
      success: true,
      message: `User ${action}ed successfully`,
      data: { user }
    });
  } catch (error) {
    console.error('User management error:', error);
    res.status(500).json({
      success: false,
      message: 'Error managing user',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/admin/reports
 * @desc    Get all reports with filters
 * @access  Admin
 */
router.get('/reports', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
    const { 
      status,
      type,
      limit = 10,
      page = 1
    } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (status) whereClause.status = status;
    if (type) whereClause.content_type = type;

    const reports = await Report.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'reporter',
          foreignKey: 'reported_by',
          attributes: ['id', 'username', 'display_name']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        reports: reports.rows.map(report => ({
          id: report.id,
          type: report.content_type,
          status: report.status,
          createdAt: report.createdAt,
          userId: report.reported_user_id,
          content: report.content_data,
          reporter: {
            id: report.reporter?.id,
            displayName: report.reporter?.displayName,
            username: report.reporter?.username
          },
          reason: report.reason,
          description: report.description,
          reviewedBy: report.resolved_by,
          reviewedAt: report.resolved_at
        })),
        total: reports.count,
        page: parseInt(page),
        totalPages: Math.ceil(reports.count / limit)
      }
    });
  } catch (error) {
    console.error('Reports fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reports',
      error: error.message
    });
  }
}));

/**
 * @route   PUT /api/admin/reports/:id
 * @desc    Update report status
 * @access  Admin
 */
router.put('/reports/:id', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Report update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating report',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/admin/content
 * @desc    Get reported content
 * @access  Admin
 */
router.get('/content', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
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
            as: 'author',
            attributes: ['id', 'username', 'display_name']
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
            as: 'postedBy',
            attributes: ['id', 'username', 'display_name']
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
            as: 'User',
            attributes: ['id', 'username', 'display_name']
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
  } catch (error) {
    console.error('Content fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching content',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/admin/moderation-logs
 * @desc    Get moderation logs with filters
 * @access  Admin
 */
router.get('/moderation-logs', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
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
      whereClause.created_at = {};
      if (startDate) whereClause.created_at[Op.gte] = new Date(startDate);
      if (endDate) whereClause.created_at[Op.lte] = new Date(endDate);
    }

    const logs = await ModerationLog.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'moderator',
          attributes: ['id', 'username', 'display_name', 'role']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
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
  } catch (error) {
    console.error('Moderation logs fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching moderation logs',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/admin/moderation-logs/stats
 * @desc    Get moderation statistics
 * @access  Admin
 */
router.get('/moderation-logs/stats', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
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
        where: startDate || endDate ? { created_at: dateRange } : {}
      }),

      // Actions grouped by type
      ModerationLog.findAll({
        where: startDate || endDate ? { created_at: dateRange } : {},
        attributes: [
          'type',
          'action',
          [sequelize.fn('COUNT', '*'), 'count']
        ],
        group: ['type', 'action']
      }),

      // Actions by moderator
      ModerationLog.findAll({
        where: startDate || endDate ? { created_at: dateRange } : {},
        attributes: [
          'moderatorId',
          [sequelize.fn('COUNT', '*'), 'count']
        ],
        include: [{
          model: User,
          as: 'moderator',
          attributes: ['username', 'display_name', 'role']
        }],
        group: ['moderatorId', 'moderator.id', 'moderator.username', 'moderator.display_name', 'moderator.role']
      }),

      // Average resolution times for reports
      ModerationLog.findAll({
        where: {
          type: 'report',
          action: 'resolve_report',
          ...(startDate || endDate ? { created_at: dateRange } : {})
        },
        attributes: [
          [sequelize.fn('AVG', 
            sequelize.fn('EXTRACT', 'EPOCH', 
              sequelize.col('created_at') - sequelize.col('details.reportCreatedAt')
            )
          ), 'avgResolutionTime']
        ]
      }),

      // Recent actions
      ModerationLog.findAll({
        where: startDate || endDate ? { created_at: dateRange } : {},
        limit: 10,
        order: [['created_at', 'DESC']],
        include: [{
          model: User,
          as: 'moderator',
          attributes: ['username', 'display_name', 'role']
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
  } catch (error) {
    console.error('Moderation stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching moderation statistics',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/admin/moderation-logs/:id
 * @desc    Get detailed moderation log entry
 * @access  Admin
 */
router.get('/moderation-logs/:id', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
    const log = await ModerationLog.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'moderator',
          attributes: ['id', 'username', 'display_name', 'role']
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
          include: [{ model: User, as: 'author', attributes: ['id', 'username', 'display_name'] }]
        });
        break;
      case 'user':
        targetContent = await User.findByPk(log.targetId, {
          attributes: ['id', 'username', 'display_name', 'status']
        });
        break;
      case 'job':
        targetContent = await Job.findByPk(log.targetId, {
          include: [{ model: User, as: 'postedBy', attributes: ['id', 'username', 'display_name'] }]
        });
        break;
      case 'marketplace':
        targetContent = await MarketplaceItem.findByPk(log.targetId, {
          include: [{ model: User, foreignKey: 'seller_id', attributes: ['id', 'username', 'display_name'] }]
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
  } catch (error) {
    console.error('Moderation log detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching moderation log details',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/admin/moderation-logs/moderator/:id
 * @desc    Get moderation logs for specific moderator
 * @access  Admin
 */
router.get('/moderation-logs/moderator/:id', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const logs = await ModerationLog.findAndCountAll({
      where: { moderatorId: req.params.id },
      include: [
        {
          model: User,
          as: 'moderator',
          attributes: ['id', 'username', 'display_name', 'role']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
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
  } catch (error) {
    console.error('Moderator logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching moderator logs',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/admin/activity
 * @desc    Get recent activity
 * @access  Admin
 */
router.get('/activity', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Get recent activity from various sources
    const [recentPosts, recentUsers, recentReports] = await Promise.all([
      Post.findAll({
        limit: parseInt(limit),
        order: [['created_at', 'DESC']],
        include: [{ model: User, as: 'author', attributes: ['id', 'username', 'display_name'] }]
      }),
      User.findAll({
        limit: parseInt(limit),
        order: [['created_at', 'DESC']],
        attributes: ['id', 'username', 'display_name', 'created_at']
      }),
      Report.findAll({
        limit: parseInt(limit),
        order: [['created_at', 'DESC']],
        include: [{ model: User, as: 'reporter', foreignKey: 'reported_by', attributes: ['id', 'username', 'display_name'] }]
      })
    ]);

    // Combine and format activity
    const activity = [
      ...recentPosts.map(post => ({
        id: post.id,
        type: 'post_created',
        userId: post.author_id,
        details: { postId: post.id, title: post.title },
        timestamp: post.created_at
      })),
      ...recentUsers.map(user => ({
        id: user.id,
        type: 'user_registered',
        userId: user.id,
        details: { username: user.username },
        timestamp: user.created_at
      })),
      ...recentReports.map(report => ({
        id: report.id,
        type: 'report_submitted',
        userId: report.reported_by,
        details: { reportId: report.id, reason: report.reason },
        timestamp: report.created_at
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
     .slice(0, parseInt(limit));

    res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    console.error('Activity fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recent activity',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/admin/logs
 * @desc    Get system logs
 * @access  Admin
 */
router.get('/logs', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate, level, limit = 50 } = req.query;

    // For now, return moderation logs as system logs
    // In a real implementation, you'd have a separate system logs table
    const whereClause = {};
    if (startDate) whereClause.created_at = { [Op.gte]: new Date(startDate) };
    if (endDate) whereClause.created_at = { ...whereClause.created_at, [Op.lte]: new Date(endDate) };
    if (level) whereClause.action = level;

    const logs = await ModerationLog.findAll({
      where: whereClause,
      limit: parseInt(limit),
      order: [['created_at', 'DESC']],
      include: [
        {
          model: User,
          as: 'moderator',
          attributes: ['id', 'username', 'display_name']
        }
      ]
    });

    res.json({
      success: true,
      data: logs.map(log => ({
        id: log.id,
        level: log.action,
        message: `${log.action} on ${log.type} ${log.targetId}`,
        timestamp: log.created_at,
        userId: log.moderatorId,
        details: log
      }))
    });
  } catch (error) {
    console.error('System logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching system logs',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/admin/settings
 * @desc    Get system settings
 * @access  Admin
 */
router.get('/settings', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
    // Return default system settings
    // In a real implementation, these would come from a settings table
    res.json({
      success: true,
      data: {
        userRegistration: true,
        maxLoginAttempts: 5,
        postModeration: 'manual',
        contentFilters: ['spam', 'inappropriate', 'violence'],
        maintenanceMode: false,
        emailNotifications: true,
        reportThreshold: 3,
        autoSuspendThreshold: 5
      }
    });
  } catch (error) {
    console.error('Settings fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching system settings',
      error: error.message
    });
  }
}));

/**
 * @route   PUT /api/admin/settings
 * @desc    Update system settings
 * @access  Admin
 */
router.put('/settings', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
    // In a real implementation, you'd update a settings table
    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating system settings',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/admin/analytics/users
 * @desc    Get user analytics
 * @access  Admin
 */
router.get('/analytics/users', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Generate daily data for the date range
    const analytics = [];
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);
      
      // Count new users for this date
      const newUsers = await User.count({
        where: {
          created_at: {
            [Op.gte]: currentDate,
            [Op.lt]: nextDate
          }
        }
      });
      
      // Count active users (users who were active in the last 24 hours from this date)
      const activeUsers = await User.count({
        where: {
          last_active: {
            [Op.gte]: new Date(currentDate.getTime() - 24 * 60 * 60 * 1000),
            [Op.lt]: nextDate
          }
        }
      });

      // Count reports for this date
      const totalReports = await Report.count({
        where: {
          created_at: {
            [Op.gte]: currentDate,
            [Op.lt]: nextDate
          }
        }
      });

      // Calculate user growth (percentage change from previous day)
      let userGrowth = 0;
      const dayIndex = analytics.length;
      if (dayIndex > 0) {
        const prevDate = new Date(currentDate);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevActiveUsers = await User.count({
          where: {
            last_active: {
              [Op.gte]: new Date(prevDate.getTime() - 24 * 60 * 60 * 1000),
              [Op.lt]: currentDate
            }
          }
        });
        if (prevActiveUsers > 0) {
          userGrowth = ((activeUsers - prevActiveUsers) / prevActiveUsers) * 100;
        }
      }
      
      analytics.push({
        _id: dateStr,
        newUsers: newUsers,
        activeUsers: activeUsers,
        totalReports: totalReports,
        userGrowth: Math.round(userGrowth * 100) / 100
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json({
      success: true,
      analytics: analytics
    });
  } catch (error) {
    console.error('User analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user analytics',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/admin/analytics/content
 * @desc    Get content analytics
 * @access  Admin
 */
router.get('/analytics/content', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Generate daily data for the date range
    const analytics = [];
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);
      
      // Count posts for this date
      const totalPosts = await Post.count({
        where: {
          created_at: {
            [Op.gte]: currentDate,
            [Op.lt]: nextDate
          }
        }
      });
      
      // Get posts for this date to count likes and comments
      const postsForDate = await Post.findAll({
        where: {
          created_at: {
            [Op.gte]: currentDate,
            [Op.lt]: nextDate
          }
        },
        attributes: ['reactions', 'comments_count']
      });
      
      // Count total likes from reactions
      let totalLikes = 0;
      let totalComments = 0;
      
      postsForDate.forEach(post => {
        const reactions = post.reactions || {};
        totalLikes += (reactions.likes?.length || 0);
        totalComments += (post.comments_count || 0);
      });
      
      analytics.push({
        _id: dateStr,
        totalPosts: totalPosts,
        totalLikes: totalLikes,
        totalComments: totalComments
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json({
      success: true,
      analytics: analytics
    });
  } catch (error) {
    console.error('Content analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching content analytics',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/admin/moderator-applications
 * @desc    Get moderator applications
 * @access  Admin
 */
router.get('/moderator-applications', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
    const { status } = req.query;

    // For now, return empty array since we don't have a moderator applications table
    // In a real implementation, you'd query a moderator_applications table
    res.json({
      success: true,
      data: []
    });
  } catch (error) {
    console.error('Moderator applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching moderator applications',
      error: error.message
    });
  }
}));

/**
 * @route   POST /api/admin/moderator-applications/:id/handle
 * @desc    Handle moderator application
 * @access  Admin
 */
router.post('/moderator-applications/:id/handle', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
    const { action, notes } = req.body;

    // In a real implementation, you'd update the application status
    res.json({
      success: true,
      message: `Application ${action}ed successfully`
    });
  } catch (error) {
    console.error('Moderator application handling error:', error);
    res.status(500).json({
      success: false,
      message: 'Error handling moderator application',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/admin/analytics/realtime
 * @desc    Get real-time analytics data
 * @access  Admin
 */
router.get('/analytics/realtime', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
    // Get current active users (users active in last 5 minutes)
    const currentUsers = await User.count({
      where: {
        last_active: {
          [Op.gte]: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      }
    });

    // Get active sessions (mock data for now - in real app, track sessions)
    const activeSessions = Math.floor(currentUsers * 1.2); // Estimate sessions

    // Get system load (mock data)
    const systemLoad = Math.random() * 0.8 + 0.1; // 10-90% load

    // Get recent activity (last 10 activities)
    const recentActivity = await ModerationLog.findAll({
      limit: 10,
      order: [['created_at', 'DESC']],
      include: [{
        model: User,
        as: 'moderator',
        attributes: ['username', 'display_name']
      }]
    });

    res.json({
      success: true,
      data: {
        currentUsers,
        activeSessions,
        systemLoad,
        recentActivity: recentActivity.map(activity => ({
          id: activity.id,
          type: activity.type,
          action: activity.action,
          moderator: activity.moderator?.username || 'System',
          timestamp: activity.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Real-time analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching real-time analytics',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/admin/health
 * @desc    Get system health status
 * @access  Admin
 */
router.get('/health', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
    // Check database connection
    const dbStart = Date.now();
    await sequelize.authenticate();
    const dbResponseTime = Date.now() - dbStart;

    // Get system metrics (mock data for now)
    const health = {
      status: 'healthy',
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        total: process.memoryUsage().heapTotal / 1024 / 1024, // MB
        percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
      },
      cpu: {
        usage: Math.random() * 60 + 10, // Mock CPU usage 10-70%
        cores: os.cpus().length
      },
      storage: {
        used: Math.random() * 500 + 100, // Mock storage usage 100-600 GB
        total: 1000, // Mock 1 TB total
        percentage: Math.random() * 70 + 20 // Mock 20-90%
      },
      database: {
        status: 'connected',
        responseTime: dbResponseTime
      },
      services: {
        api: {
          status: 'up',
          responseTime: Math.random() * 100 + 10
        },
        database: {
          status: 'connected',
          responseTime: dbResponseTime
        },
        cache: {
          status: 'up',
          responseTime: Math.random() * 20 + 2
        }
      }
    };

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking system health',
      error: error.message
    });
  }
}));

/**
 * @route   POST /api/admin/moderation/actions
 * @desc    Take content moderation action
 * @access  Admin
 */
router.post('/moderation/actions', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
    const { reportId, contentType, contentId, action, moderatedBy, moderatedAt } = req.body;

    // Find the report
    const report = await Report.findByPk(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Update report status
    report.status = 'resolved';
    report.resolvedBy = moderatedBy;
    report.resolvedAt = moderatedAt;
    await report.save();

    // Take action on the content based on type
    let content;
    switch (contentType) {
      case 'post':
        content = await Post.findByPk(contentId);
        break;
      case 'job':
        content = await Job.findByPk(contentId);
        break;
      case 'marketplace':
        content = await MarketplaceItem.findByPk(contentId);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid content type'
        });
    }

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    // Apply moderation action
    switch (action) {
      case 'remove':
        content.status = 'removed';
        break;
      case 'hide':
        content.status = 'hidden';
        break;
      case 'approve':
        content.status = 'active';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action'
        });
    }

    await content.save();

         // Log the moderation action
     await ModerationLog.create({
       moderatorId: req.user.id,
       type: contentType,
       targetId: contentId,
       action: action,
       reason: report.reason
     });

    res.json({
      success: true,
      message: 'Content moderation action applied successfully',
      data: { report, content }
    });
  } catch (error) {
    console.error('Moderation action error:', error);
    res.status(500).json({
      success: false,
      message: 'Error applying moderation action',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/admin/health
 * @desc    Get system health status
 * @access  Admin
 */
router.get('/health', authenticate, isAdmin, asyncHandler(async (req, res) => {
  try {
    // Mock system health data
    // In a real implementation, you'd check actual system metrics
    const systemHealth = {
      status: 'healthy',
      details: {
        cpu: Math.floor(Math.random() * 100),
        memory: Math.floor(Math.random() * 100),
        storage: Math.floor(Math.random() * 100)
      }
    };

    res.json({
      success: true,
      data: systemHealth
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking system health',
      error: error.message
    });
  }
}));

export default router;
