import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { LiveChat, LiveChatMessage, User, Notification } from '../models/index.js';
import { Op } from 'sequelize';
import { getIO } from '../socket/socketHandler.js';

const router = express.Router();

/**
 * @route   POST /api/livechat/start
 * @desc    Start a live chat session (user initiates)
 * @access  Private
 */
router.post('/start', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Check if there's already an active chat session for this user
  const existingChat = await LiveChat.findOne({
    where: {
      user_id: userId,
      status: 'active'
    }
  });

  if (existingChat) {
    return res.status(400).json({
      success: false,
      message: 'You already have an active chat session'
    });
  }

  const chat = await LiveChat.create({
    user_id: userId,
    status: 'active',
    started_at: new Date()
  });

  // Include user details in response
  const chatWithUser = await LiveChat.findByPk(chat.id, {
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'displayName', 'username', 'email']
      }
    ]
  });

  // Send notifications to all admin users
  try {
    const adminUsers = await User.findAll({
      where: {
        role: 'admin',
        status: 'active'
      },
      attributes: ['id']
    });

    if (adminUsers.length > 0) {
      const notifications = adminUsers.map(adminUser => ({
        recipientId: adminUser.id,
        title: 'New Live Chat Session',
        message: `A user has started a new live chat session. Session ID: ${chat.id}`,
        type: 'live_chat',
        priority: 'high',
        actionUrl: `/admin/livechat/sessions/${chat.id}`,
        actionText: 'View Chat',
        customData: {
          sessionId: chat.id,
          userId: userId
        }
      }));

      await Notification.bulkCreate(notifications);
    }
  } catch (error) {
      // Don't fail the request if notifications fail
  }

  // Emit socket event to notify admins about new session
  try {
    const io = getIO();
    if (io) {
      io.emit('new_live_chat_session', chat.id);
    }
  } catch (error) {
    console.error('Failed to emit socket event for new live chat session:', error);
  }

  res.json({
    success: true,
    message: 'Live chat session started',
    data: { session: chatWithUser }
  });
}));

/**
 * @route   POST /api/livechat/sessions/:id/join
 * @desc    Admin joins a live chat session
 * @access  Private (Admin only)
 */
router.post('/sessions/:id/join', authenticate, asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }

  const chat = await LiveChat.findByPk(req.params.id, {
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'displayName', 'username', 'email']
      }
    ]
  });

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat session not found'
    });
  }

  if (chat.status !== 'active') {
    return res.status(400).json({
      success: false,
      message: 'Can only join active chat sessions'
    });
  }

  if (chat.admin_id) {
    return res.status(400).json({
      success: false,
      message: 'This chat session is already being handled by another admin'
    });
  }

  await chat.update({
    admin_id: req.user.id
  });

  // Refresh the chat data to include admin info
  const updatedChat = await LiveChat.findByPk(req.params.id, {
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'displayName', 'username', 'email']
      },
      {
        model: User,
        as: 'admin',
        attributes: ['id', 'displayName', 'username']
      }
    ]
  });

  // Emit socket event to notify user that admin has joined
  try {
    const io = getIO();
    if (io) {
      io.to(`live_chat_${req.params.id}`).emit('admin_joined_live_chat', {
        sessionId: req.params.id,
        admin: {
          id: req.user.id,
          displayName: req.user.displayName
        }
      });
    }
  } catch (error) {
    console.error('Failed to emit socket event for admin joined:', error);
  }

  res.json({
    success: true,
    message: 'Successfully joined chat session',
    data: { session: updatedChat }
  });
}));

/**
 * @route   GET /api/livechat/sessions
 * @desc    Get live chat sessions (admin only)
 * @access  Private (Admin only)
 */
router.get('/sessions', authenticate, asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }

  const { status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = {};
  if (status) {
    whereClause.status = status;
  }

  const sessions = await LiveChat.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'displayName', 'username', 'email']
      },
      {
        model: User,
        as: 'admin',
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
      sessions: sessions.rows,
      total: sessions.count,
      page: parseInt(page),
      totalPages: Math.ceil(sessions.count / limit)
    }
  });
}));

/**
 * @route   GET /api/livechat/sessions/:id
 * @desc    Get specific live chat session
 * @access  Private
 */
router.get('/sessions/:id', authenticate, asyncHandler(async (req, res) => {
  const chat = await LiveChat.findByPk(req.params.id, {
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'displayName', 'username', 'email']
      },
      {
        model: User,
        as: 'admin',
        attributes: ['id', 'displayName', 'username']
      },
      {
        model: LiveChatMessage,
        as: 'messages',
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'displayName', 'username']
          }
        ],
        order: [['timestamp', 'ASC']],
        limit: 50
      }
    ]
  });

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat session not found'
    });
  }

  // Check access permissions
  if (chat.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  res.json({
    success: true,
    data: { session: chat }
  });
}));

/**
 * @route   PUT /api/livechat/sessions/:id/end
 * @desc    End a live chat session (admin only)
 * @access  Private (Admin only)
 */
router.put('/sessions/:id/end', authenticate, asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }

  const { notes } = req.body;
  const chat = await LiveChat.findByPk(req.params.id);

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat session not found'
    });
  }

  const updateData = {
    status: 'ended',
    ended_at: new Date()
  };

  if (notes) {
    updateData.notes = notes;
  }

  await chat.update(updateData);

  res.json({
    success: true,
    message: 'Live chat session ended',
    data: { chat }
  });
}));

/**
 * @route   PUT /api/livechat/sessions/:id/cancel
 * @desc    Cancel a live chat session (admin only)
 * @access  Private (Admin only)
 */
router.put('/sessions/:id/cancel', authenticate, asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }

  const { notes } = req.body;
  const chat = await LiveChat.findByPk(req.params.id);

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat session not found'
    });
  }

  if (chat.status !== 'active') {
    return res.status(400).json({
      success: false,
      message: 'Can only cancel active chat sessions'
    });
  }

  const updateData = {
    status: 'cancelled',
    ended_at: new Date()
  };

  if (notes) {
    updateData.notes = notes;
  }

  await chat.update(updateData);

  res.json({
    success: true,
    message: 'Live chat session cancelled',
    data: { chat }
  });
}));

/**
 * @route   GET /api/livechat/user-sessions
 * @desc    Get user's live chat sessions
 * @access  Private
 */
router.get('/user-sessions', authenticate, asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = {
    user_id: req.user.id
  };

  if (status) {
    whereClause.status = status;
  }

  const sessions = await LiveChat.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'admin',
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
      sessions: sessions.rows,
      total: sessions.count,
      page: parseInt(page),
      totalPages: Math.ceil(sessions.count / limit)
    }
  });
}));

/**
 * @route   GET /api/livechat/sessions/:id/messages
 * @desc    Get messages for a live chat session
 * @access  Private
 */
router.get('/sessions/:id/messages', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  // Check if user has access to this session
  const session = await LiveChat.findByPk(req.params.id);
  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Chat session not found'
    });
  }

  // User can only access their own sessions, admin can access any session
  if (session.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const messages = await LiveChatMessage.findAndCountAll({
    where: {
      session_id: req.params.id
    },
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'displayName', 'username']
      }
    ],
    order: [['timestamp', 'ASC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  res.json({
    success: true,
    data: {
      messages: messages.rows,
      total: messages.count,
      page: parseInt(page),
      totalPages: Math.ceil(messages.count / limit)
    }
  });
}));

/**
 * @route   POST /api/livechat/sessions/:id/messages
 * @desc    Send a message in a live chat session
 * @access  Private
 */
router.post('/sessions/:id/messages', authenticate, asyncHandler(async (req, res) => {
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Message is required'
    });
  }

  // Check if session exists and user has access
  const session = await LiveChat.findByPk(req.params.id);
  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Chat session not found'
    });
  }

  // User can only send messages in their own sessions, admin can send in any session
  if (session.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Determine sender type
  const senderType = req.user.role === 'admin' ? 'admin' : 'user';

  const chatMessage = await LiveChatMessage.create({
    session_id: req.params.id,
    sender_id: req.user.id,
    sender_type: senderType,
    message: message.trim(),
    timestamp: new Date()
  });

  // Include sender details in response
  const messageWithSender = await LiveChatMessage.findByPk(chatMessage.id, {
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'displayName', 'username']
      }
    ]
  });

  res.json({
    success: true,
    message: 'Message sent successfully',
    data: { message: messageWithSender }
  });
}));

/**
 * @route   DELETE /api/livechat/sessions/:id
 * @desc    Delete live chat session (admin only)
 * @access  Private (Admin only)
 */
router.delete('/sessions/:id', authenticate, asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }

  const chat = await LiveChat.findByPk(req.params.id);

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat session not found'
    });
  }

  await chat.destroy();

  res.json({
    success: true,
    message: 'Live chat session deleted successfully'
  });
}));

export default router;
