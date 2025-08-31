import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import models from '../models/index.js';
const { User, Chat, Message, LiveChat, LiveChatMessage } = models;
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';
import RedisService from '../services/redisService.js';

const connectedUsers = new Map();
const connectedAdmins = new Map();
const liveChatSessions = new Map();
let ioInstance = null;

export const getIO = () => {
  return ioInstance;
};

export const socketHandler = (io) => {
  // Attach socket handling logic to existing io instance
  io.use(async (socket, next) => {
    try {
      // Authentication middleware already set up in initializeSocket
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });
  
  return io;
};

export const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || [
        "http://localhost:8081", 
        "http://localhost:3000",
        "exp://localhost:8081",
        "https://connectlocal-rjwq.onrender.com",
        "*"
      ],
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId || decoded.id; // Support both userId and id
      
      if (!userId) {
        return next(new Error('Invalid token: No user ID'));
      }
      
      const user = await User.findByPk(userId);
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user.id;
    const userName = socket.user.displayName;
    
    
    // Store user connection in Redis and local map
    connectedUsers.set(userId, socket.id);
    await RedisService.setUserOnline(userId, socket.id);

    // Update user's online status in database
    try {
      await User.update({ isOnline: true }, { where: { id: userId } });
    } catch (error) {
      console.error(`❌ Failed to update online status for user ${userName}:`, error.message);
    }

    // Join personal room for private messages
    socket.join(`user_${userId}`);

    // Handle user disconnection
    socket.on('disconnect', async (reason) => {
      
      // Remove from local map and Redis
      connectedUsers.delete(userId);
      await RedisService.setUserOffline(userId);
      
      try {
        await User.update(
          { 
            isOnline: false,
            lastActive: new Date()
          }, 
          { where: { id: userId } }
        );
      } catch (error) {
        console.error(`❌ Failed to update offline status for user ${userName}:`, error.message);
      }
    });

    // Join chat room
    socket.on('join_chat', async (chatId) => {
      socket.join(`chat_${chatId}`);
    });

    // Leave chat room
    socket.on('leave_chat', (chatId) => {
      socket.leave(`chat_${chatId}`);
    });

    // Send message
    socket.on('send_message', async (data) => {
      try {
        const { chatId, content, type = 'text', media, location, replyToId } = data;
        
        // Debug: Check if Message model is available
        if (!Message || typeof Message.create !== 'function') {
          throw new Error('Message model not available');
        }
        
        // Validate that the chat exists and user has access to it
        const chat = await Chat.findByPk(chatId);
        
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }
        
        // Check if user is a participant in this chat
        const isParticipant = chat.participants && chat.participants.some(p => 
          p.user === userId && p.is_active !== false
        );
        
        if (!isParticipant) {
          socket.emit('error', { message: 'Access denied to this chat' });
          return;
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
        
        // Create message with proper error handling
        const messageData = {
          chatId,
          senderId: userId,
          content: messageContent,
          type,
          media: media || null,
          location: location || null,
          replyTo: replyToId ? { messageId: replyToId } : null
        };

        const message = await Message.create(messageData);

        // Update chat's last message
        await Chat.update(
          { lastMessageAt: new Date() },
          { where: { id: chatId } }
        );

        // Emit message to all users in the chat
        const messageResponse = {
          message: {
            ...message.toJSON(),
            sender: {
              id: socket.user.id,
              username: socket.user.username,
              displayName: socket.user.displayName
            }
          }
        };
        
        io.to(`chat_${chatId}`).emit('new_message', messageResponse);

        // Check if recipients are online and send notifications if needed
        if (chat.participants) {
          for (const participant of chat.participants) {
            if (participant.user !== userId && participant.is_active !== false) {
              const isOnline = connectedUsers.has(participant.user.toString()) || 
                              await RedisService.isUserOnline(participant.user.toString());
              
              if (!isOnline) {
                // Send push notification for offline users
              }
            }
          }
        }
      } catch (error) {
        console.error(`❌ Failed to send message: ${error.message}`);
        console.error('Error stack:', error.stack);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing status
    socket.on('typing_start', (chatId) => {
      socket.to(`chat_${chatId}`).emit('user_typing', {
        userId: socket.user.id,
        username: socket.user.username
      });
    });

    socket.on('typing_stop', (chatId) => {
      socket.to(`chat_${chatId}`).emit('user_stop_typing', {
        userId: socket.user.id
      });
    });

    // Read receipts
    socket.on('mark_read', async (data) => {
      const { chatId, messageIds } = data;
      
      try {
        // Get messages and mark them as read using the model method
        const messages = await Message.findAll({
          where: { 
            id: messageIds,
            readBy: { [Op.not]: { [Op.contains]: [{ user: userId }] } }
          }
        });

        // Mark each message as read
        for (const message of messages) {
          await message.markAsRead(userId);
        }

        io.to(`chat_${chatId}`).emit('messages_read', {
          userId,
          messageIds
        });
      } catch (error) {
        console.error(`❌ Failed to update read receipts: ${error.message}`);
      }
    });

    // Online status
    socket.on('get_online_status', async (userIds) => {
      const onlineStatus = {};
      for (const id of userIds) {
        // Check both local map and Redis for online status
        const isOnline = connectedUsers.has(id.toString()) || await RedisService.isUserOnline(id.toString());
        onlineStatus[id] = isOnline;
      }
      socket.emit('online_status_response', onlineStatus);
    });

    // ===== LIVE CHAT EVENTS =====
    
    // Join live chat session
    socket.on('join_live_chat', async (sessionId) => {
      
      try {
        const session = await LiveChat.findByPk(sessionId, {
          include: [
            { model: User, as: 'user', attributes: ['id', 'displayName', 'username'] },
            { model: User, as: 'admin', attributes: ['id', 'displayName', 'username'] }
          ]
        });

        if (!session) {
          socket.emit('live_chat_error', { message: 'Session not found' });
          return;
        }

        // Check if user has access to this session
        if (session.user_id !== userId && session.admin_id !== userId && socket.user.role !== 'admin') {
          socket.emit('live_chat_error', { message: 'Access denied' });
          return;
        }

        socket.join(`live_chat_${sessionId}`);
        liveChatSessions.set(sessionId, {
          sessionId,
          participants: new Set([userId]),
          lastActivity: new Date()
        });

        
        // Notify other participants
        socket.to(`live_chat_${sessionId}`).emit('live_chat_user_joined', {
          sessionId,
          user: {
            id: userId,
            displayName: userName,
            role: socket.user.role
          }
        });

        // Send session info to the joining user
        socket.emit('live_chat_session_info', {
          sessionId,
          session: session.toJSON()
        });

      } catch (error) {
        console.error(`❌ Error joining live chat session: ${error.message}`);
        socket.emit('live_chat_error', { message: 'Failed to join session' });
      }
    });

    // Leave live chat session
    socket.on('leave_live_chat', (sessionId) => {
      
      socket.leave(`live_chat_${sessionId}`);
      
      const sessionData = liveChatSessions.get(sessionId);
      if (sessionData) {
        sessionData.participants.delete(userId);
        if (sessionData.participants.size === 0) {
          liveChatSessions.delete(sessionId);
        }
      }

      // Notify other participants
      socket.to(`live_chat_${sessionId}`).emit('live_chat_user_left', {
        sessionId,
        user: {
          id: userId,
          displayName: userName
        }
      });

    });

    // Send live chat message
    socket.on('send_live_chat_message', async (data) => {
      try {
        const { sessionId, message } = data;

        // Verify session exists and user has access
        const session = await LiveChat.findByPk(sessionId);
        if (!session) {
          socket.emit('live_chat_error', { message: 'Session not found' });
          return;
        }

        if (session.user_id !== userId && session.admin_id !== userId && socket.user.role !== 'admin') {
          socket.emit('live_chat_error', { message: 'Access denied' });
          return;
        }

        // Determine sender type
        const senderType = socket.user.role === 'admin' ? 'admin' : 'user';

        // Create message in database
        const chatMessage = await LiveChatMessage.create({
          session_id: sessionId,
          sender_id: userId,
          sender_type: senderType,
          message: message.trim(),
          timestamp: new Date()
        });

        // Include sender details
        const messageWithSender = await LiveChatMessage.findByPk(chatMessage.id, {
          include: [
            {
              model: User,
              as: 'sender',
              attributes: ['id', 'displayName', 'username']
            }
          ]
        });

        // Emit message to all participants in the session
        const messageData = {
          sessionId,
          message: messageWithSender.toJSON()
        };

        io.to(`live_chat_${sessionId}`).emit('new_live_chat_message', messageData);

        // Send notification to admin if message is from user and session is active
        if (senderType === 'user' && session.status === 'active' && session.admin_id) {
          // Notify the admin about new message
          const adminSocketId = connectedAdmins.get(session.admin_id);
          if (adminSocketId) {
            io.to(adminSocketId).emit('live_chat_notification', {
              type: 'new_message',
              sessionId,
              message: messageWithSender.toJSON(),
              user: {
                id: userId,
                displayName: userName
              }
            });
          }
        }

      } catch (error) {
        console.error(`❌ Failed to send live chat message: ${error.message}`);
        socket.emit('live_chat_error', { message: 'Failed to send message' });
      }
    });

    // New live chat session created (notify all admins)
    socket.on('new_live_chat_session', async (sessionId) => {
      if (socket.user.role !== 'admin') {
        return;
      }

      try {
        const session = await LiveChat.findByPk(sessionId, {
          include: [
            { model: User, as: 'user', attributes: ['id', 'displayName', 'username'] }
          ]
        });

        if (!session) {
          return;
        }

        // Notify all connected admins about new session
        connectedAdmins.forEach((adminSocketId, adminId) => {
          if (adminId !== userId) { // Don't notify the admin who created the session
            io.to(adminSocketId).emit('live_chat_notification', {
              type: 'new_session',
              sessionId,
              session: session.toJSON()
            });
          }
        });
      } catch (error) {
        console.error(`❌ Error notifying admins about new live chat session: ${error.message}`);
      }
    });

    // Admin joins live chat session
    socket.on('admin_join_live_chat', async (sessionId) => {
      if (socket.user.role !== 'admin') {
        socket.emit('live_chat_error', { message: 'Admin access required' });
        return;
      }

      try {
        const session = await LiveChat.findByPk(sessionId);
        if (!session) {
          socket.emit('live_chat_error', { message: 'Session not found' });
          return;
        }

        // Update session with admin
        await LiveChat.update(
          { admin_id: userId },
          { where: { id: sessionId } }
        );

        // Join the session room
        socket.join(`live_chat_${sessionId}`);
        
        // Add admin to connected admins
        connectedAdmins.set(userId, socket.id);

        // Notify user that admin has joined
        io.to(`live_chat_${sessionId}`).emit('admin_joined_live_chat', {
          sessionId,
          admin: {
            id: userId,
            displayName: userName
          }
        });

      } catch (error) {
        console.error(`❌ Error admin joining live chat session: ${error.message}`);
        socket.emit('live_chat_error', { message: 'Failed to join session' });
      }
    });

    // Admin leaves live chat session
    socket.on('admin_leave_live_chat', async (sessionId) => {
      if (socket.user.role !== 'admin') {
        socket.emit('live_chat_error', { message: 'Admin access required' });
        return;
      }

      try {
        // Remove admin from session
        await LiveChat.update(
          { admin_id: null },
          { where: { id: sessionId } }
        );

        socket.leave(`live_chat_${sessionId}`);
        connectedAdmins.delete(userId);

        // Notify user that admin has left
        io.to(`live_chat_${sessionId}`).emit('admin_left_live_chat', {
          sessionId,
          admin: {
            id: userId,
            displayName: userName
          }
        });

      } catch (error) {
        console.error(`❌ Error admin leaving live chat session: ${error.message}`);
        socket.emit('live_chat_error', { message: 'Failed to leave session' });
      }
    });

    // Live chat typing indicators
    socket.on('live_chat_typing_start', (sessionId) => {
      socket.to(`live_chat_${sessionId}`).emit('live_chat_user_typing', {
        sessionId,
        user: {
          id: userId,
          displayName: userName,
          role: socket.user.role
        }
      });
    });

    socket.on('live_chat_typing_stop', (sessionId) => {
      socket.to(`live_chat_${sessionId}`).emit('live_chat_user_stop_typing', {
        sessionId,
        user: {
          id: userId,
          displayName: userName
        }
      });
    });

    // Get available live chat sessions (for admins)
    socket.on('get_available_live_chats', async () => {
      if (socket.user.role !== 'admin') {
        socket.emit('live_chat_error', { message: 'Admin access required' });
        return;
      }

      try {
        const sessions = await LiveChat.findAll({
          where: {
            status: 'active',
            admin_id: null
          },
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'displayName', 'username']
            }
          ],
          order: [['started_at', 'ASC']]
        });

        socket.emit('available_live_chats', {
          sessions: sessions.map(session => session.toJSON())
        });

      } catch (error) {
        console.error(`❌ Error getting available live chats: ${error.message}`);
        socket.emit('live_chat_error', { message: 'Failed to get available sessions' });
      }
    });

    // End live chat session
    socket.on('end_live_chat_session', async (data) => {
      const { sessionId, reason } = data;

      try {
        const session = await LiveChat.findByPk(sessionId);
        if (!session) {
          socket.emit('live_chat_error', { message: 'Session not found' });
          return;
        }

        // Check if user has permission to end the session
        if (session.user_id !== userId && session.admin_id !== userId && socket.user.role !== 'admin') {
          socket.emit('live_chat_error', { message: 'Access denied' });
          return;
        }

        // Update session status
        await LiveChat.update(
          { 
            status: 'ended',
            ended_at: new Date(),
            notes: reason || 'Session ended by user'
          },
          { where: { id: sessionId } }
        );

        // Notify all participants
        io.to(`live_chat_${sessionId}`).emit('live_chat_session_ended', {
          sessionId,
          reason: reason || 'Session ended',
          endedBy: {
            id: userId,
            displayName: userName,
            role: socket.user.role
          }
        });

        // Clean up session data
        liveChatSessions.delete(sessionId);

      } catch (error) {
        socket.emit('live_chat_error', { message: 'Failed to end session' });
      }
    });
  });

  ioInstance = io;
  return io;
};
