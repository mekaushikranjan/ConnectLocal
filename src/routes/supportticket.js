import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { SupportTicket, User, sequelize } from '../models/index.js';
import { Op } from 'sequelize';

const router = express.Router();

/**
 * @route   POST /api/supportticket/create
 * @desc    Create a new support ticket
 * @access  Private
 */
router.post('/create', authenticate, asyncHandler(async (req, res) => {
  const { subject, message, email, type, priority } = req.body;

  if (!subject || !message || !email) {
    return res.status(400).json({
      success: false,
      message: 'Subject, message, and email are required'
    });
  }

  const ticket = await SupportTicket.create({
    user_id: req.user.id,
    subject: subject.trim(),
    message: message.trim(),
    email: email.trim(),
    status: 'open',
    priority: priority || 'medium',
    type: type || 'general'
  });

  res.json({
    success: true,
    message: 'Support ticket created successfully',
    data: { ticket }
  });
}));

/**
 * @route   GET /api/supportticket/tickets
 * @desc    Get support tickets (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.get('/tickets', authenticate, asyncHandler(async (req, res) => {
  // Check if user is admin or moderator
  if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or moderator privileges required.'
    });
  }

  const { status, priority, type, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = {};
  if (status) {
    whereClause.status = status;
  }
  if (priority) {
    whereClause.priority = priority;
  }
  if (type) {
    whereClause.type = type;
  }

  const tickets = await SupportTicket.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'displayName', 'username', 'email']
      },
      {
        model: User,
        as: 'responder',
        attributes: ['id', 'displayName', 'username']
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  res.json({
    success: true,
    data: {
      tickets: tickets.rows,
      total: tickets.count,
      page: parseInt(page),
      totalPages: Math.ceil(tickets.count / limit)
    }
  });
}));

/**
 * @route   GET /api/supportticket/tickets/:id
 * @desc    Get specific support ticket (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.get('/tickets/:id', authenticate, asyncHandler(async (req, res) => {
  // Check if user is admin or moderator
  if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or moderator privileges required.'
    });
  }

  const ticket = await SupportTicket.findByPk(req.params.id, {
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'displayName', 'username', 'email']
      },
      {
        model: User,
        as: 'responder',
        attributes: ['id', 'displayName', 'username']
      }
    ]
  });

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Ticket not found'
    });
  }

  res.json({
    success: true,
    data: { ticket }
  });
}));

/**
 * @route   PUT /api/supportticket/tickets/:id
 * @desc    Update ticket status and response (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.put('/tickets/:id', authenticate, asyncHandler(async (req, res) => {
  // Check if user is admin or moderator
  if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or moderator privileges required.'
    });
  }

  const { status, response, priority } = req.body;
  const ticket = await SupportTicket.findByPk(req.params.id);

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Ticket not found'
    });
  }

  const updateData = {};
  if (status) updateData.status = status;
  if (response) updateData.response = response;
  if (priority) updateData.priority = priority;
  
  if (status || response) {
    updateData.responded_by = req.user.id;
    updateData.responded_at = new Date();
  }

  await ticket.update(updateData);

  res.json({
    success: true,
    message: 'Ticket updated successfully',
    data: { ticket }
  });
}));

/**
 * @route   GET /api/supportticket/my-tickets
 * @desc    Get user's own support tickets
 * @access  Private
 */
router.get('/my-tickets', authenticate, asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = {
    user_id: req.user.id
  };

  if (status) {
    whereClause.status = status;
  }

  const tickets = await SupportTicket.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'responder',
        attributes: ['id', 'displayName', 'username']
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  res.json({
    success: true,
    data: {
      tickets: tickets.rows,
      total: tickets.count,
      page: parseInt(page),
      totalPages: Math.ceil(tickets.count / limit)
    }
  });
}));

/**
 * @route   GET /api/supportticket/my-tickets/:id
 * @desc    Get user's specific support ticket
 * @access  Private
 */
router.get('/my-tickets/:id', authenticate, asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findOne({
    where: {
      id: req.params.id,
      user_id: req.user.id
    },
    include: [
      {
        model: User,
        as: 'responder',
        attributes: ['id', 'displayName', 'username']
      }
    ]
  });

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Ticket not found'
    });
  }

  res.json({
    success: true,
    data: { ticket }
  });
}));

/**
 * @route   DELETE /api/supportticket/tickets/:id
 * @desc    Delete ticket (admin only)
 * @access  Private (Admin only)
 */
router.delete('/tickets/:id', authenticate, asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }

  const ticket = await SupportTicket.findByPk(req.params.id);

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Ticket not found'
    });
  }

  await ticket.destroy();

  res.json({
    success: true,
    message: 'Ticket deleted successfully'
  });
}));

/**
 * @route   GET /api/supportticket/stats
 * @desc    Get support ticket statistics (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.get('/stats', authenticate, asyncHandler(async (req, res) => {
  // Check if user is admin or moderator
  if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or moderator privileges required.'
    });
  }

  const totalTickets = await SupportTicket.count();
  const openTickets = await SupportTicket.count({ where: { status: 'open' } });
  const inProgressTickets = await SupportTicket.count({ where: { status: 'in_progress' } });
  const resolvedTickets = await SupportTicket.count({ where: { status: 'resolved' } });
  const closedTickets = await SupportTicket.count({ where: { status: 'closed' } });

  const priorityStats = await SupportTicket.findAll({
    attributes: [
      'priority',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['priority']
  });

  const typeStats = await SupportTicket.findAll({
    attributes: [
      'type',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['type']
  });

  res.json({
    success: true,
    data: {
      total: totalTickets,
      byStatus: {
        open: openTickets,
        inProgress: inProgressTickets,
        resolved: resolvedTickets,
        closed: closedTickets
      },
      byPriority: priorityStats,
      byType: typeStats
    }
  });
}));

export default router;
