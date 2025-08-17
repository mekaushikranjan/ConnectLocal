import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Chat, Message, User, Notification } from '../models/index.js';
import { Op } from 'sequelize';

const router = express.Router();

/**
 * @route   POST /api/chats
 * @desc    Create a new chat
 * @access  Private
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { participants, type = 'private', name } = req.body;

  // Ensure unique participants
  const uniqueParticipants = [...new Set([req.user.id, ...participants])];

  // For private chats, ensure exactly 2 participants
  if (type === 'private' && uniqueParticipants.length !== 2) {
    return res.status(400).json({
      success: false,
      message: 'Private chats must have exactly 2 participants'
    });
  }

  // Check if private chat already exists
  if (type === 'private') {
    const existingChat = await Chat.findOne({
      where: {
        type: 'private',
        [Op.and]: [
          { participants: { [Op.contains]: [uniqueParticipants[0]] } },
          { participants: { [Op.contains]: [uniqueParticipants[1]] } }
        ]
      }
    });

    if (existingChat) {
      return res.status(400).json({
        success: false,
        message: 'Chat already exists',
        data: { chatId: existingChat.id }
      });
    }
  }

  const chat = await Chat.create({
    type,
    name: type === 'group' ? name : null,
    participants: uniqueParticipants,
    createdBy: req.user.id
  });

  const populatedChat = await Chat.findByPk(chat.id);

  res.status(201).json({
    success: true,
    message: 'Chat created successfully',
    data: { chat: populatedChat }
  });
}));

/**
 * @route   GET /api/chats
 * @desc    Get user's chats
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const chats = await Chat.findAll({
    where: {
      participants: { [Op.contains]: [req.user.id] }
    },
    include: [
      {
        model: Message,
        as: 'messages',
        limit: 1,
        order: [['createdAt', 'DESC']],
        include: [{
          model: User,
          as: 'sender',
          attributes: ['id', 'displayName', 'username', 'avatar_url']
        }]
      }
    ],
    order: [['createdAt', 'DESC']]
  });

  res.json({
    success: true,
    data: { chats }
  });
}));

/**
 * @route   GET /api/chats/:id
 * @desc    Get chat details
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({
    where: {
      id: req.params.id,
      participants: { [Op.contains]: [req.user.id] }
    },
    include: [{
      model: User,
      as: 'participantUsers',
              attributes: ['id', 'displayName', 'username', 'avatar_url']
    }]
  });

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found'
    });
  }

  res.json({
    success: true,
    data: { chat }
  });
}));

/**
 * @route   PUT /api/chats/:id
 * @desc    Update chat (group name, add/remove participants)
 * @access  Private
 */
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({
    where: {
      id: req.params.id,
      participants: { [Op.contains]: [req.user.id] }
    }
  });

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found'
    });
  }

  if (chat.type === 'private') {
    return res.status(400).json({
      success: false,
      message: 'Cannot modify private chats'
    });
  }

  if (chat.createdBy !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Only group creator can modify the chat'
    });
  }

  const { name, addParticipants, removeParticipants } = req.body;

  if (name) {
    chat.name = name;
  }

  if (addParticipants) {
    chat.participants = [...new Set([...chat.participants, ...addParticipants])];
  }

  if (removeParticipants) {
    chat.participants = chat.participants.filter(p => !removeParticipants.includes(p));
  }

  await chat.save();

  const updatedChat = await Chat.findByPk(chat.id);

  res.json({
    success: true,
    message: 'Chat updated successfully',
    data: { chat: updatedChat }
  });
}));

/**
 * @route   POST /api/chats/:id/messages
 * @desc    Send a message in a chat
 * @access  Private
 */
router.post('/:id/messages', authenticate, asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({
    where: {
      id: req.params.id,
      participants: { [Op.contains]: [req.user.id] }
    }
  });

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found'
    });
  }

  const { content, type = 'text', attachments } = req.body;

  const message = await Message.create({
    chatId: chat.id,
    userId: req.user.id,
    content,
    type,
    attachments
  });

  const populatedMessage = await Message.findByPk(message.id, {
    include: [{
      model: User,
      as: 'sender',
      attributes: ['id', 'displayName', 'username', 'avatar_url']
    }]
  });

  res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: { message: populatedMessage }
  });
}));

/**
 * @route   GET /api/chats/:id/messages
 * @desc    Get chat messages
 * @access  Private
 */
router.get('/:id/messages', authenticate, asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({
    where: {
      id: req.params.id,
      participants: { [Op.contains]: [req.user.id] }
    }
  });

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found'
    });
  }

  const { limit = 50, before } = req.query;

  const whereClause = { chatId: chat.id };
  if (before) {
    whereClause.createdAt = { [Op.lt]: before };
  }

  const messages = await Message.findAll({
    where: whereClause,
    include: [{
      model: User,
      as: 'sender',
      attributes: ['id', 'displayName', 'username', 'avatar_url']
    }],
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit)
  });

  res.json({
    success: true,
    data: { messages: messages.reverse() }
  });
}));

/**
 * @route   DELETE /api/chats/:id
 * @desc    Delete/Leave chat
 * @access  Private
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({
    where: {
      id: req.params.id,
      participants: { [Op.contains]: [req.user.id] }
    }
  });

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found'
    });
  }

  if (chat.type === 'private') {
    // For private chats, only delete if both participants want to delete
    await chat.destroy();
  } else {
    // For group chats, remove participant
    chat.participants = chat.participants.filter(p => p !== req.user.id);
    if (chat.participants.length === 0) {
      await chat.destroy();
    } else {
      await chat.save();
    }
  }

  res.json({
    success: true,
    message: chat.type === 'private' ? 'Chat deleted successfully' : 'Left chat successfully'
  });
}));

export default router;
