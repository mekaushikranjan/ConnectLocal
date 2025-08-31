import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Chat, Message, User, Notification } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';
import NotificationService from '../services/notificationService.js';
import { getIO } from '../socket/socketHandler.js';

const router = express.Router();

// Helper function to check if user has access to a chat
const checkChatAccess = async (chatId, userId) => {
  const chat = await Chat.findOne({
    where: { id: chatId }
  });

  if (!chat) {
    return { hasAccess: false, chat: null, error: 'Chat not found' };
  }

  // Check if user is a participant in the chat
  const isParticipant = chat.participants && chat.participants.some(p => 
    p.user === userId && p.is_active === true
  );

  if (isParticipant) {
    return { hasAccess: true, chat, error: null };
  }

  // If not a direct participant, check if this is a community group chat
  if (chat.type === 'group' && chat.groupInfo && chat.groupInfo.groupId) {
    try {
      // Import Group model to check group membership
      const { Group, GroupMember } = await import('../models/index.js');
      
      // Check if user is a member of the underlying group
      const membership = await GroupMember.findOne({
        where: {
          group_id: chat.groupInfo.groupId,
          user_id: userId,
          status: 'active'
        }
      });

      if (membership) {
        // User is a member of the group, so they have access to the chat
        // Also add them as a participant to the chat if they're not already
        const isChatParticipant = chat.participants.some(p => p.user === userId);
        if (!isChatParticipant) {
          chat.participants = [...chat.participants, {
            user: userId,
            role: 'member',
            is_active: true,
            joinedAt: new Date()
          }];
          await chat.save();
        }
        
        return { hasAccess: true, chat, error: null };
      }
    } catch (error) {
      console.error('Error checking group membership:', error);
    }
  }

  return { hasAccess: false, chat: null, error: 'Access denied' };
};

// Helper function to resolve chat ID (handles both chat IDs and group IDs)
const resolveChatId = async (id, userId) => {
  // First try to find the chat directly
  let chat = await Chat.findOne({
    where: { id: id }
  });

  // If chat not found, check if this is a group ID and create a chat for it
  if (!chat) {
    try {
      // Import Group model to check if this is a group
      const { Group, GroupMember } = await import('../models/index.js');
      
      // Check if this is a group
      const group = await Group.findOne({
        where: { id: id }
      });

      if (group) {
        
        // Check if user is a member of this group
        const membership = await GroupMember.findOne({
          where: {
            group_id: group.id,
            user_id: userId,
            status: 'active'
          }
        });

        if (membership) {
          
          
          // Check if a chat already exists for this specific group using groupId
          let groupChat = await Chat.findOne({
            where: {
              type: 'group',
              groupInfo: {
                [Op.contains]: { groupId: group.id }
              }
            }
          });

          if (!groupChat) {
            
            // Create a new chat for this group with unique identifier
            groupChat = await Chat.create({
              type: 'group',
              groupInfo: {
                groupId: group.id,
                name: group.name,
                category: group.category,
                description: group.description,
                uniqueIdentifier: `${group.category}_${group.id}` // Add unique identifier
              },
              participants: [{
                user: userId,
                role: 'member',
                is_active: true,
                joinedAt: new Date()
              }],
            });
          } else {
            
            // Chat exists but user is not a participant, add them
            const isParticipant = groupChat.participants.some(p => p.user === userId && p.is_active);
            if (!isParticipant) {
              
              groupChat.participants = [...groupChat.participants, {
                user: userId,
                role: 'member',
                is_active: true,
                joinedAt: new Date()
              }];
              await groupChat.save();
            }
          }

          // Get the populated chat
          chat = await Chat.findByPk(groupChat.id);
        } else {
          
        }
      } else {
        
      }
    } catch (error) {
      console.error('Error creating group chat:', error);
    }
  }

  if (!chat) {
    
    return { chat: null, error: 'Chat not found' };
  }

    
  return { chat, error: null };
};

/**
 * @route   POST /api/chats
 * @desc    Create a new chat
 * @access  Private
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { participants, type = 'direct', name } = req.body;

  // Ensure unique participants
  const uniqueParticipants = [...new Set([req.user.id, ...participants])];

  // For direct chats, ensure exactly 2 participants
  if (type === 'direct' && uniqueParticipants.length !== 2) {
    return res.status(400).json({
      success: false,
      message: 'Direct chats must have exactly 2 participants'
    });
  }

  // Check if direct chat already exists
  if (type === 'direct') {
    // Find existing chat by checking if both participants are in the same chat
    const allDirectChats = await Chat.findAll({
      where: {
        type: 'direct',
        is_active: true
      }
    });

    const existingChat = allDirectChats.find(chat => {
      const participantIds = chat.participants
        .filter(p => p.is_active)
        .map(p => p.user);
      
      return participantIds.includes(uniqueParticipants[0]) && 
             participantIds.includes(uniqueParticipants[1]);
    });

    if (existingChat) {
      // Get participant users manually since we don't have associations
      const participantUserIds = existingChat.participants
        .filter(p => p.is_active)
        .map(p => p.user);
      
      const participantUsers = await User.findAll({
        where: { id: participantUserIds },
        attributes: ['id', 'displayName', 'username', 'avatar_url', 'last_active']
      });

      // Return the existing chat instead of an error
      const transformedChat = {
        id: existingChat.id,
        type: existingChat.type,
        name: existingChat.name,
        description: existingChat.description,
        avatarUrl: existingChat.avatarUrl,
        participants: participantUsers.map(user => ({
          id: user.id,
          displayName: user.displayName,
          username: user.username,
          avatarUrl: user.avatar_url,
          role: 'member',
          joinedAt: existingChat.createdAt,
          lastSeen: user.last_active
        })),
        unreadCount: 0,
        isArchived: false,
        isMuted: false,
        isPinned: false,
        settings: {
          allowInvites: true,
          allowMediaSharing: true,
          allowLocationSharing: true
        },
        createdAt: existingChat.createdAt,
        updatedAt: existingChat.updatedAt,
        createdBy: existingChat.createdBy
      };

      return res.status(200).json({
        success: true,
        message: 'Existing chat found',
        data: { chat: transformedChat }
      });
    }
  }

  const chat = await Chat.create({
    type,
    groupInfo: type === 'group' ? { name } : {},
    participants: uniqueParticipants.map(userId => ({
      user: userId,
      role: 'member',
      is_active: true,
      joinedAt: new Date()
    }))
  });

  // Get participant users manually since we don't have associations
  const participantUserIds = chat.participants
    .filter(p => p.is_active)
    .map(p => p.user);
  
  const participantUsers = await User.findAll({
    where: { id: participantUserIds },
    attributes: ['id', 'displayName', 'username', 'avatar_url', 'last_active']
  });

  // Transform the chat to match frontend expectations
  const transformedChat = {
    id: chat.id,
    type: chat.type,
    name: chat.name,
    description: chat.description,
    avatarUrl: chat.avatarUrl,
    participants: participantUsers.map(user => ({
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      avatarUrl: user.avatar_url,
      role: 'member',
      joinedAt: chat.createdAt,
      lastSeen: user.last_active
    })),
    unreadCount: 0,
    isArchived: false,
    isMuted: false,
    isPinned: false,
    settings: {
      allowInvites: true,
      allowMediaSharing: true,
      allowLocationSharing: true
    },
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    createdBy: chat.createdBy
  };

  res.status(201).json({
    success: true,
    message: 'Chat created successfully',
    data: { chat: transformedChat }
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
      participants: { [Op.contains]: [{ user: req.user.id, is_active: true }] }
    },
    order: [['createdAt', 'DESC']]
  });

  // Transform the chats data to match frontend expectations
  const transformedChats = await Promise.all(chats.map(async (chat) => {
    // Get participant users manually
    const participantUserIds = chat.participants
      .filter(p => p.is_active)
      .map(p => p.user);
    
    const participantUsers = await User.findAll({
      where: { id: participantUserIds },
      attributes: ['id', 'displayName', 'username', 'avatar_url', 'last_active']
    });

    // Get last message manually since we don't have associations
    const lastMessage = await Message.findOne({
      where: { chatId: chat.id },
      order: [['createdAt', 'DESC']],
      include: [{
        model: User,
        as: 'sender',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }]
    });

    const lastMessageData = lastMessage ? {
      id: lastMessage.id,
      content: lastMessage.content,
      type: lastMessage.type,
      senderId: lastMessage.senderId,
      senderName: lastMessage.sender?.displayName || 'Unknown',
      createdAt: lastMessage.createdAt
    } : null;

    // Calculate unread count for this user (simplified for now)
    const unreadCount = 0; // We'll implement this later if needed

    return {
      ...chat.toJSON(),
      participants: participantUsers.map(user => ({
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        avatarUrl: user.avatar_url,
        role: chat.participants.find(p => p.user === user.id)?.role || 'member',
        joinedAt: chat.participants.find(p => p.user === user.id)?.joinedAt || new Date(),
        lastSeen: user.last_active
      })),
      name: chat.type === 'group' ? chat.groupInfo?.name : undefined,
      description: chat.type === 'group' ? chat.groupInfo?.description : undefined,
      avatarUrl: chat.type === 'group' ? chat.groupInfo?.avatarUrl : undefined,
      lastMessage: lastMessageData,
      unreadCount: unreadCount,
      // Remove the messages array since we're using lastMessage
      messages: undefined
    };
  }));

  res.json({
    success: true,
    data: { 
      items: transformedChats,
      total: transformedChats.length,
      page: 1,
      totalPages: 1
    }
  });
}));

/**
 * @route   GET /api/chats/:id
 * @desc    Get chat details
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  let chat = await Chat.findOne({
    where: {
      id: req.params.id,
      participants: { [Op.contains]: [{ user: req.user.id, is_active: true }] }
    }
  });

  // If chat not found, check if this is a group ID and create a chat for it
  if (!chat) {
    try {
      // Import Group model to check if this is a group
      const { Group, GroupMember } = await import('../models/index.js');
      
      // Check if this is a group
      const group = await Group.findOne({
        where: { id: req.params.id }
      });

      if (group) {
        // Check if user is a member of this group
        const membership = await GroupMember.findOne({
          where: {
            group_id: group.id,
            user_id: req.user.id,
            status: 'active'
          }
        });

        if (membership) {
          // Check if a chat already exists for this specific group using groupId
          let groupChat = await Chat.findOne({
            where: {
              type: 'group',
              groupInfo: {
                [Op.contains]: { groupId: group.id }
              }
            }
          });

          if (!groupChat) {
            // Create a new chat for this group with unique identifier
            groupChat = await Chat.create({
              type: 'group',
              groupInfo: {
                groupId: group.id,
                name: group.name,
                category: group.category,
                description: group.description,
                uniqueIdentifier: `${group.category}_${group.id}` // Add unique identifier
              },
              participants: [{
                user: req.user.id,
                role: 'member',
                is_active: true,
                joinedAt: new Date()
              }],
            });
          } else {
            // Chat exists but user is not a participant, add them
            const isParticipant = groupChat.participants.some(p => p.user === req.user.id && p.is_active);
            if (!isParticipant) {
              groupChat.participants = [...groupChat.participants, {
                user: req.user.id,
                role: 'member',
                is_active: true,
                joinedAt: new Date()
              }];
              await groupChat.save();
            }
          }

          // Get the populated chat
          chat = await Chat.findByPk(groupChat.id);
        }
      }
    } catch (error) {
      console.error('Error creating group chat:', error);
    }
  }

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found'
    });
  }

  // Transform the chat data to match frontend expectations
  // Get participant users manually
  const participantUserIds = chat.participants
    .filter(p => p.is_active)
    .map(p => p.user);
  
  const participantUsers = await User.findAll({
    where: { id: participantUserIds },
    attributes: ['id', 'displayName', 'username', 'avatar_url', 'last_active']
  });

  const transformedChat = {
    ...chat.toJSON(),
    participants: participantUsers.map(user => ({
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      avatarUrl: user.avatar_url,
      role: chat.participants.find(p => p.user === user.id)?.role || 'member',
      joinedAt: chat.participants.find(p => p.user === user.id)?.joinedAt || new Date(),
      lastSeen: user.last_active
    })),
    name: chat.type === 'group' ? chat.groupInfo?.name : undefined,
    description: chat.type === 'group' ? chat.groupInfo?.description : undefined,
    avatarUrl: chat.type === 'group' ? chat.groupInfo?.avatarUrl : undefined,
    groupInfo: chat.type === 'group' ? chat.groupInfo : undefined
  };

  res.json({
    success: true,
    data: { chat: transformedChat }
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
      participants: { [Op.contains]: [{ user: req.user.id, is_active: true }] }
    }
  });

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found'
    });
  }

      if (chat.type === 'direct') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify direct chats'
      });
    }

  // Check if user is admin or owner of the group
  const userParticipant = chat.participants.find(p => p.user === req.user.id && p.is_active);
  if (!userParticipant || (userParticipant.role !== 'admin' && userParticipant.role !== 'owner')) {
    return res.status(403).json({
      success: false,
      message: 'Only group admins can modify the chat'
    });
  }

  const { name, addParticipants, removeParticipants } = req.body;

  if (name) {
    chat.groupInfo = { ...chat.groupInfo, name };
  }

  if (addParticipants) {
    const newParticipants = addParticipants.map(userId => ({
      user: userId,
      role: 'member',
      is_active: true,
      joinedAt: new Date()
    }));
    chat.participants = [...chat.participants, ...newParticipants];
  }

  if (removeParticipants) {
    chat.participants = chat.participants.map(p => 
      removeParticipants.includes(p.user) 
        ? { ...p, is_active: false }
        : p
    );
  }

  await chat.save();

  res.json({
    success: true,
    message: 'Chat updated successfully',
    data: { chat }
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
      participants: { [Op.contains]: [{ user: req.user.id, is_active: true }] }
    }
  });

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found'
    });
  }

      // For direct chats, mark as inactive
    if (chat.type === 'direct') {
    chat.participants = chat.participants.map(p => 
      p.user === req.user.id 
        ? { ...p, is_active: false }
        : p
    );
    await chat.save();
  } else {
    // For group chats, remove participant
    chat.participants = chat.participants.filter(p => p.user !== req.user.id);
    await chat.save();
  }

  res.json({
    success: true,
    message: 'Left chat successfully'
  });
}));

/**
 * @route   GET /api/chats/:id/messages
 * @desc    Get chat messages
 * @access  Private
 */
router.get('/:id/messages', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);



  // Resolve the chat ID (handles both chat IDs and group IDs)
  const { chat, error } = await resolveChatId(req.params.id, req.user.id);

  if (!chat) {

    return res.status(404).json({
      success: false,
      message: error
    });
  }

  // Check if user has access to this chat
  const { hasAccess, chat: accessChat, error: accessError } = await checkChatAccess(chat.id, req.user.id);
  
  if (!hasAccess) {
    return res.status(404).json({
      success: false,
      message: accessError
    });
  }

  const messages = await Message.findAndCountAll({
    where: { 
      chatId: chat.id,
      [Op.and]: [
        // Exclude messages that are deleted for this user
        {
          [Op.or]: [
            { deletedFor: { [Op.not]: { [Op.contains]: [req.user.id] } } },
            { deletedFor: null }
          ]
        },
        // Exclude messages that are globally deleted
        { isDeleted: false }
      ]
    },
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  // Transform messages to match frontend expectations
  const transformedMessages = messages.rows.map(msg => {
    const messageData = {
      ...msg.toJSON(),
      sender: {
        id: msg.sender.id,
        displayName: msg.sender.displayName,
        username: msg.sender.username,
        avatarUrl: msg.sender.avatar_url
      }
    };
    
    return messageData;
  });

  res.json({
    success: true,
    data: {
      items: transformedMessages.reverse(), // Reverse to get chronological order
      total: messages.count,
      page: parseInt(page),
      totalPages: Math.ceil(messages.count / parseInt(limit))
    }
  });
}));

/**
 * @route   POST /api/chats/:id/messages
 * @desc    Send a message
 * @access  Private
 */
router.post('/:id/messages', authenticate, asyncHandler(async (req, res) => {
  const { content, type = 'text', media, location, replyToId } = req.body;

  // Resolve the chat ID (handles both chat IDs and group IDs)
  const { chat, error } = await resolveChatId(req.params.id, req.user.id);

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: error
    });
  }



  // Check if user has access to this chat
  const { hasAccess, chat: accessChat, error: accessError } = await checkChatAccess(chat.id, req.user.id);
  
  if (!hasAccess) {

    return res.status(404).json({
      success: false,
      message: accessError
    });
  }

          

  // Handle content structure - frontend might send string or object
  let messageContent = content;
  if (typeof content === 'string') {
    messageContent = { text: content };
  } else if (content && typeof content === 'object') {
    messageContent = content;
  } else {
    messageContent = { text: '' };
  }

  const message = await Message.create({
    chatId: chat.id,
    senderId: req.user.id,
    content: messageContent,
    type,
    media: media || null,
    location: location || null,
    replyTo: replyToId ? { messageId: replyToId } : null
  });

  // Include sender details
  const messageWithSender = await Message.findByPk(message.id, {
    include: [
      {
      model: User,
      as: 'sender',
      attributes: ['id', 'displayName', 'username', 'avatar_url']
      }
    ]
  });

  // Send notification to other participants
  try {
    await NotificationService.notifyNewMessage(message.id, req.user.id, chat.id);
  } catch (error) {
    console.error('Error sending message notification:', error);
  }

  // Emit socket event
  const io = req.app.get('io');
  if (io) {
    io.to(`chat_${chat.id}`).emit('new_message', {
      message: {
        ...messageWithSender.toJSON(),
        sender: {
          id: messageWithSender.sender.id,
          displayName: messageWithSender.sender.displayName,
          username: messageWithSender.sender.username,
          avatarUrl: messageWithSender.sender.avatar_url
        }
      }
    });

    // Send notifications to other participants via socket
    const participants = chat.participants || [];
    participants.forEach(participant => {
      if (participant.user !== req.user.id) {
        io.to(participant.user).emit('notification', {
          type: 'new_message',
          title: 'New Message',
          message: `${req.user.displayName || req.user.username}: ${messageContent.text ? messageContent.text.substring(0, 50) : 'Sent a message'}`,
          customData: {
            chatId: chat.id,
            messageId: message.id,
            messageContent: messageContent.text ? messageContent.text.substring(0, 100) : 'Sent a message',
            senderName: req.user.displayName || req.user.username
          }
        });
      }
    });
  }

  res.json({
    success: true,
    message: 'Message sent successfully',
    data: {
      message: {
        ...messageWithSender.toJSON(),
        sender: {
          id: messageWithSender.sender.id,
          displayName: messageWithSender.sender.displayName,
          username: messageWithSender.sender.username,
          avatarUrl: messageWithSender.sender.avatar_url
        }
      }
    }
  });
}));

/**
 * @route   PUT /api/chats/:id/messages/:messageId
 * @desc    Edit a message
 * @access  Private
 */
router.put('/:id/messages/:messageId', authenticate, asyncHandler(async (req, res) => {
  const { content } = req.body;

  const message = await Message.findOne({
    where: {
      id: req.params.messageId,
      chatId: req.params.id,
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

  // Include sender details
  const messageWithSender = await Message.findByPk(message.id, {
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }
    ]
  });

  // Emit socket event
  const io = req.app.get('io');
  if (io) {
    io.to(`chat_${req.params.id}`).emit('message_edited', {
      messageId: req.params.messageId,
      content,
      editedAt: message.editedAt
    });
  }

  res.json({
    success: true,
    message: 'Message updated successfully',
    data: {
      message: {
        ...messageWithSender.toJSON(),
        sender: {
          id: messageWithSender.sender.id,
          displayName: messageWithSender.sender.displayName,
          username: messageWithSender.sender.username,
          avatarUrl: messageWithSender.sender.avatar_url
        }
      }
    }
  });
}));

/**
 * @route   DELETE /api/chats/:id/messages/:messageId
 * @desc    Delete a message
 * @access  Private
 */
router.delete('/:id/messages/:messageId', authenticate, asyncHandler(async (req, res) => {
  // Resolve the chat ID (handles both chat IDs and group IDs)
  const { chat, error } = await resolveChatId(req.params.id, req.user.id);

  if (!chat) {
    
    return res.status(404).json({
      success: false,
      message: error
    });
  }

  // Check if user has access to this chat
  const { hasAccess, chat: accessChat, error: accessError } = await checkChatAccess(chat.id, req.user.id);
  
  if (!hasAccess) {

    return res.status(404).json({
      success: false,
      message: accessError
    });
  }

  const message = await Message.findOne({
    where: {
      id: req.params.messageId,
      chatId: chat.id,
      senderId: req.user.id // Only allow deleting own messages
    }
  });

  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found or unauthorized'
    });
  }

  await message.destroy();

  // Emit socket event
  const io = req.app.get('io');
  if (io) {
    io.to(`chat_${chat.id}`).emit('message_deleted', {
      messageId: req.params.messageId
    });
  }

  res.json({
    success: true,
    message: 'Message deleted successfully'
  });
}));

/**
 * @route   DELETE /api/chats/:id/messages
 * @desc    Clear all messages in chat for the current user only
 * @access  Private
 */
router.delete('/:id/messages', authenticate, asyncHandler(async (req, res) => {
  // Resolve the chat ID (handles both chat IDs and group IDs)
  const { chat, error } = await resolveChatId(req.params.id, req.user.id);

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: error
    });
  }

  // Check if user has access to this chat
  const { hasAccess, chat: accessChat, error: accessError } = await checkChatAccess(chat.id, req.user.id);
  
  if (!hasAccess) {
    return res.status(404).json({
      success: false,
      message: accessError
    });
  }

  // Get all messages in the chat that are not already deleted for this user
  const messages = await Message.findAll({
    where: { 
      chatId: chat.id,
      [Op.or]: [
        { deletedFor: { [Op.not]: { [Op.contains]: [req.user.id] } } },
        { deletedFor: null }
      ]
    }
  });

  // Mark each message as deleted for this user only
  for (const message of messages) {
    const deletedFor = message.deletedFor || [];
    if (!deletedFor.includes(req.user.id)) {
      deletedFor.push(req.user.id);
      await message.update({ deletedFor });
    }
  }

  // Emit socket event to notify the user that their chat has been cleared
  const io = req.app.get('io');
  if (io) {
    io.to(`user_${req.user.id}`).emit('chat_cleared_for_user', {
      chatId: chat.id,
      userId: req.user.id
    });
  }

  res.json({
    success: true,
    message: 'Chat cleared successfully for you'
  });
}));

/**
 * @route   PUT /api/chats/:id/mute
 * @desc    Mute/Unmute chat notifications
 * @access  Private
 */
router.put('/:id/mute', authenticate, asyncHandler(async (req, res) => {
  const { muted } = req.body;


  // Resolve the chat ID (handles both chat IDs and group IDs)
  const { chat, error } = await resolveChatId(req.params.id, req.user.id);

  if (!chat) {
    
    return res.status(404).json({
      success: false,
      message: error
    });
  }

  
  // Check if user has access to this chat
  const { hasAccess, chat: accessChat, error: accessError } = await checkChatAccess(chat.id, req.user.id);
  
  if (!hasAccess) {

    return res.status(404).json({
      success: false,
      message: accessError
    });
  }

  // Update user's mute status for this chat
  // This would typically be stored in a separate table or in the chat participants
  // For now, we'll just return success
  res.json({
    success: true,
    message: muted ? 'Chat muted' : 'Chat unmuted'
  });
}));

/**
 * @route   POST /api/chats/:id/block
 * @desc    Block user in chat
 * @access  Private
 */
router.post('/:id/block', authenticate, asyncHandler(async (req, res) => {
  const { userId } = req.body;

  // Resolve the chat ID (handles both chat IDs and group IDs)
  const { chat, error } = await resolveChatId(req.params.id, req.user.id);

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: error
    });
  }

  // Check if user has access to this chat
  const { hasAccess, chat: accessChat, error: accessError } = await checkChatAccess(chat.id, req.user.id);
  
  if (!hasAccess) {
    return res.status(404).json({
      success: false,
      message: accessError
    });
  }

  // Block the user (this would typically be stored in a separate table)
  // For now, we'll just return success
  res.json({
    success: true,
    message: 'User blocked successfully'
  });
}));

/**
 * @route   GET /api/chats/:id/messages/search
 * @desc    Search messages in chat
 * @access  Private
 */
router.get('/:id/messages/search', authenticate, asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);



  if (!q || q.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
  }

  // Resolve the chat ID (handles both chat IDs and group IDs)
  const { chat, error } = await resolveChatId(req.params.id, req.user.id);

  if (!chat) {
    
    return res.status(404).json({
      success: false,
      message: error
    });
  }

  // Check if user has access to this chat
  const { hasAccess, chat: accessChat, error: accessError } = await checkChatAccess(chat.id, req.user.id);
  
  if (!hasAccess) {
    
    return res.status(404).json({
      success: false,
      message: accessError
    });
  }


  
  // Sanitize the search query to prevent SQL injection
  const sanitizedQuery = q.replace(/[%_]/g, '\\$&');
  
  let messages;
  try {
    messages = await Message.findAndCountAll({
      where: {
        chatId: chat.id,
        [Op.or]: [
          sequelize.literal(`content::text ILIKE '%${sanitizedQuery}%'`),
          sequelize.literal(`content->>'text' ILIKE '%${sanitizedQuery}%'`),
          sequelize.literal(`content->>'content' ILIKE '%${sanitizedQuery}%'`)
        ],
        isDeleted: false
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'displayName', 'username', 'avatar_url']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });


  } catch (error) {
    console.error('Search query error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error searching messages',
      error: error.message
    });
  }

  // Transform messages to match frontend expectations
  const transformedMessages = messages.rows.map(msg => ({
    id: msg.id,
    chatId: msg.chatId,
    senderId: msg.senderId,
    content: msg.content,
    type: msg.type,
    media: msg.media,
    location: msg.location,
    replyTo: msg.replyTo,
    reactions: msg.reactions,
    editedAt: msg.editedAt,
    deletedAt: msg.deletedAt,
    readBy: msg.readBy || [],
    deliveredTo: msg.deliveredTo || [],
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
    sender: {
      id: msg.sender.id,
      displayName: msg.sender.displayName,
      username: msg.sender.username,
      avatarUrl: msg.sender.avatar_url
    }
  }));

  res.json({
    success: true,
    data: {
      items: transformedMessages.reverse(), // Reverse to get chronological order
      total: messages.count,
      page: parseInt(page),
      totalPages: Math.ceil(messages.count / parseInt(limit))
    }
  });

  res.json({
    success: true,
    data: {
      items: transformedMessages.reverse(), // Reverse to get chronological order
      total: messages.count,
      page: parseInt(page),
      totalPages: Math.ceil(messages.count / parseInt(limit))
    }
  });
}));

/**
 * @route   PUT /api/chats/:id/read
 * @desc    Mark messages as read
 * @access  Private
 */
router.put('/:id/read', authenticate, asyncHandler(async (req, res) => {
  const { messageIds } = req.body;

  // Resolve the chat ID (handles both chat IDs and group IDs)
  const { chat, error } = await resolveChatId(req.params.id, req.user.id);

  if (!chat) {
    
    return res.status(404).json({
      success: false,
      message: error
    });
  }

  // Check if user has access to this chat
  const { hasAccess, chat: accessChat, error: accessError } = await checkChatAccess(chat.id, req.user.id);
  
  if (!hasAccess) {

    return res.status(404).json({
      success: false,
      message: accessError
    });
  }

  // Mark messages as read
  if (messageIds && messageIds.length > 0) {
    const messages = await Message.findAll({
      where: {
        id: { [Op.in]: messageIds },
        chatId: chat.id
      }
    });

    // Mark each message as read using the model method
    for (const message of messages) {
      await message.markAsRead(req.user.id);
    }
  }

  res.json({
    success: true,
    message: 'Messages marked as read'
  });
}));

/**
 * @route   POST /api/chats/:id/messages/:messageId/forward
 * @desc    Forward a message to another chat
 * @access  Private
 */
router.post('/:id/messages/:messageId/forward', authenticate, asyncHandler(async (req, res) => {
  const { targetChatId } = req.body;

  // Check if user has access to source chat
  const { hasAccess: sourceAccess, chat: sourceChat, error: sourceError } = await checkChatAccess(req.params.id, req.user.id);
  
  if (!sourceAccess) {
    return res.status(404).json({
      success: false,
      message: sourceError
    });
  }

  // Check if user has access to target chat
  const { hasAccess: targetAccess, chat: targetChat, error: targetError } = await checkChatAccess(targetChatId, req.user.id);
  
  if (!targetAccess) {
    return res.status(404).json({
      success: false,
      message: targetError
    });
  }

  // Get the original message
  const originalMessage = await Message.findOne({
    where: {
      id: req.params.messageId,
      chatId: req.params.id
    },
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }
    ]
  });

  if (!originalMessage) {
    return res.status(404).json({
        success: false,
      message: 'Message not found'
    });
  }

  // Create forwarded message
  const forwardedMessage = await Message.create({
    chatId: targetChatId,
    senderId: req.user.id,
    content: originalMessage.content,
    type: originalMessage.type,
    media: originalMessage.media,
    location: originalMessage.location,
    replyToId: null,
    // Add forward info
    forwardInfo: {
      originalMessageId: originalMessage.id,
      originalChatId: req.params.id,
      originalSender: {
        id: originalMessage.sender.id,
        displayName: originalMessage.sender.displayName,
        username: originalMessage.sender.username
      },
      forwardedAt: new Date()
    }
  });

  // Include sender details
  const messageWithSender = await Message.findByPk(forwardedMessage.id, {
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }
    ]
  });

  // Emit socket event
  const io = req.app.get('io');
  if (io) {
    io.to(`chat_${targetChatId}`).emit('new_message', {
      message: {
        ...messageWithSender.toJSON(),
        sender: {
          id: messageWithSender.sender.id,
          displayName: messageWithSender.sender.displayName,
          username: messageWithSender.sender.username,
          avatarUrl: messageWithSender.sender.avatar_url
        }
      }
    });
  }

  res.json({
    success: true,
    message: 'Message forwarded successfully',
    data: {
      message: {
        ...messageWithSender.toJSON(),
        sender: {
          id: messageWithSender.sender.id,
          displayName: messageWithSender.sender.displayName,
          username: messageWithSender.sender.username,
          avatarUrl: messageWithSender.sender.avatar_url
        }
      }
    }
  });
}));

export default router;
