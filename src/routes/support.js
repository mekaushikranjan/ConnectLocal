import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { SupportTicket, User } from '../models/index.js';

const router = express.Router();

/**
 * @route   POST /api/support/contact
 * @desc    Submit a contact form
 * @access  Private
 */
router.post('/contact', authenticate, asyncHandler(async (req, res) => {
  const { subject, message, email } = req.body;

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
    priority: 'medium',
    type: 'contact'
  });

  res.json({
    success: true,
    message: 'Contact form submitted successfully',
    data: { ticket }
  });
}));

/**
 * @route   GET /api/support/contact-requests
 * @desc    Get contact form submissions (admin/moderator only)
 * @access  Private (Admin/Moderator)
 */
router.get('/contact-requests', authenticate, asyncHandler(async (req, res) => {
  // Check if user is admin or moderator
  if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or moderator privileges required.'
    });
  }

  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const tickets = await SupportTicket.findAndCountAll({
    where: { type: 'contact' },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'displayName', 'username', 'email']
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

export default router;
