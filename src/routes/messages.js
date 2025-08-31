import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Message } from '../models/index.js';

const router = express.Router();

/**
 * @route   POST /api/messages/:id/edit
 * @desc    Edit a message
 * @access  Private
 */
router.post('/:id/edit', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  const message = await Message.findOne({
    where: {
      id,
      senderId: req.user.id // Only allow editing own messages
    }
  });

  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found or unauthorized'
    });
  }

  // Store current content in edit history
  const editHistory = message.editHistory || [];
  editHistory.push({
    content: message.content,
    editedAt: message.editedAt || message.createdAt,
    editedBy: req.user.id
  });

  // Update message
  message.content = content;
  message.isEdited = true;
  message.editedAt = new Date();
  message.editHistory = editHistory;
  await message.save();

  // Emit socket event
  const io = req.app.get('io');
  io.to(`chat_${message.chatId}`).emit('message_edited', {
    messageId: id,
    content,
    editedAt: message.editedAt
  });

  res.json({
    success: true,
    message: 'Message updated successfully',
    data: message
  });
}));

/**
 * @route   POST /api/messages/:id/reaction
 * @desc    Add/Remove reaction to a message
 * @access  Private
 */
router.post('/:id/reaction', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reaction } = req.body;

  const message = await Message.findByPk(id);
  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found'
    });
  }

  // Get current reactions
  let reactions = message.reactions || [];

  // Remove existing reaction from this user if any
  reactions = reactions.filter(r => r.userId !== req.user.id);

  // Add new reaction if provided
  if (reaction) {
    reactions.push({
      userId: req.user.id,
      reaction,
      timestamp: new Date()
    });
  }

  // Update message
  message.reactions = reactions;
  await message.save();

  // Emit socket event
  const io = req.app.get('io');
  io.to(`chat_${message.chatId}`).emit('message_reaction', {
    messageId: id,
    reactions
  });

  res.json({
    success: true,
    message: reaction ? 'Reaction added' : 'Reaction removed',
    data: { reactions }
  });
}));

/**
 * @route   DELETE /api/messages/:id
 * @desc    Delete a message
 * @access  Private
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const message = await Message.findOne({
    where: {
      id,
      senderId: req.user.id // Only allow deleting own messages
    }
  });

  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found or unauthorized'
    });
  }

  const chatId = message.chatId;
  await message.destroy();

  // Emit socket event
  const io = req.app.get('io');
  io.to(`chat_${chatId}`).emit('message_deleted', {
    messageId: id
  });

  res.json({
    success: true,
    message: 'Message deleted successfully'
  });
}));

/**
 * @route   GET /api/messages/:id/edit-history
 * @desc    Get message edit history
 * @access  Private
 */
router.get('/:id/edit-history', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const message = await Message.findByPk(id);
  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found'
    });
  }

  res.json({
    success: true,
    data: {
      editHistory: message.editHistory || []
    }
  });
}));

export default router;
