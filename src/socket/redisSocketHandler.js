import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import models from '../models/index.js';
import RedisService from '../services/redisService.js';
import { Op } from 'sequelize';

const { User, Chat, Message, LiveChat, LiveChatMessage, Notification } = models;

class RedisSocketHandler {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map();
    this.connectedAdmins = new Map();
    this.liveChatSessions = new Map();
  }

  async initialize(server) {
    try {
      // Create Redis clients for Socket.IO adapter
      const pubClient = createClient({
        url: process.env.REDIS_URL || 'redis://default:R3i8JWExclJVM8m6QSceneWSrWNlY03e@redis-14143.c240.us-east-1-3.ec2.redns.redis-cloud.com:14143',
        socket: {
          connectTimeout: 10000,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('Redis pub client connection failed after 10 retries');
              return new Error('Redis pub client connection failed');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      const subClient = pubClient.duplicate();

      // Connect Redis clients
      await Promise.all([pubClient.connect(), subClient.connect()]);

      // Create Socket.io server with Redis adapter
      this.io = new Server(server, {
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
        pingInterval: 25000,
        adapter: createAdapter(pubClient, subClient)
      });

      console.log('✅ Socket.IO server initialized with Redis adapter');

      // Set up authentication middleware
      this.setupAuthentication();
      
      // Set up event handlers
      this.setupEventHandlers();

      return this.io;
    } catch (error) {
      console.error('❌ Failed to initialize Redis Socket.io server:', error);
      throw error;
    }
  }

  setupAuthentication() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId || decoded.id;
        
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
  }

  setupEventHandlers() {
    this.io.on('connection', async (socket) => {
      const userId = socket.user.id;
      const userName = socket.user.displayName;
      


      // Store user connection in Redis
      await RedisService.setUserOnline(userId, socket.id);
      this.connectedUsers.set(userId, socket.id);

      // Update user's online status in database
      try {
        await User.update({ isOnline: true }, { where: { id: userId } });
      } catch (error) {
        console.error(`❌ Failed to update online status for user ${userName}:`, error.message);
      }

      // Join personal room for private messages
      socket.join(`user_${userId}`);

      // Join location-based room
      if (socket.user.currentLocation) {
        const locationKey = `${socket.user.currentLocation.city}_${socket.user.currentLocation.state}`;
        socket.join(`location_${locationKey}`);
      }

      // Handle user disconnection
      socket.on('disconnect', async (reason) => {

        
        this.connectedUsers.delete(userId);
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

      // Handle private messaging
      this.setupPrivateMessaging(socket);
      
      // Handle live chat
      this.setupLiveChat(socket);
      
      // Handle notifications
      this.setupNotifications(socket);
      
      // Handle location updates
      this.setupLocationUpdates(socket);
      
      // Handle group messaging
      this.setupGroupMessaging(socket);
      
      // Handle chat room joining/leaving
      this.setupChatRoomHandling(socket);
    });
  }

  setupChatRoomHandling(socket) {
    const userId = socket.user.id;

    // Join chat room
    socket.on('join_chat', async (chatId) => {
      try {

        socket.join(`chat_${chatId}`);
        
        // Notify other users in the chat that this user joined
        socket.to(`chat_${chatId}`).emit('user_joined_chat', {
          chatId,
          userId,
          userName: socket.user.displayName
        });
      } catch (error) {
        console.error('Error joining chat room:', error);
      }
    });

    // Leave chat room
    socket.on('leave_chat', async (chatId) => {
      try {

        socket.leave(`chat_${chatId}`);
        
        // Notify other users in the chat that this user left
        socket.to(`chat_${chatId}`).emit('user_left_chat', {
          chatId,
          userId,
          userName: socket.user.displayName
        });
      } catch (error) {
        console.error('Error leaving chat room:', error);
      }
    });

    // Send message to chat
    socket.on('send_message', async (data) => {
      try {
        const { chatId, content, type = 'text', media, location, replyToId } = data;
        
        // Create message in database
        const message = await Message.create({
          chatId,
          senderId: userId,
          content: typeof content === 'string' ? { text: content } : content,
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

        const messageData = {
          ...messageWithSender.toJSON(),
          sender: {
            id: messageWithSender.sender.id,
            displayName: messageWithSender.sender.displayName,
            username: messageWithSender.sender.username,
            avatarUrl: messageWithSender.sender.avatar_url
          }
        };

        // Emit message to all users in the chat
        this.io.to(`chat_${chatId}`).emit('new_message', {
          message: messageData
        });

        // Send confirmation to sender
        socket.emit('message_sent', { success: true, messageId: message.id });

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('message_error', { error: 'Failed to send message' });
      }
    });

    // Start typing indicator
    socket.on('start_typing', async (chatId) => {
      try {
        socket.to(`chat_${chatId}`).emit('user_typing', {
          userId,
          username: socket.user.displayName
        });
      } catch (error) {
        console.error('Error starting typing indicator:', error);
      }
    });

    // Stop typing indicator
    socket.on('stop_typing', async (chatId) => {
      try {
        socket.to(`chat_${chatId}`).emit('user_stop_typing', {
          userId
        });
      } catch (error) {
        console.error('Error stopping typing indicator:', error);
      }
    });
  }

  setupPrivateMessaging(socket) {
    const userId = socket.user.id;

    // Send private message
    socket.on('send_private_message', async (data) => {
      try {
        const { recipientId, content, messageType = 'text' } = data;
        
        // Check if recipient is online
        const isRecipientOnline = await RedisService.isUserOnline(recipientId);
        
        // Create message in database
        const message = await Message.create({
          senderId: userId,
          recipientId,
          content,
          messageType,
          isRead: false
        });

        const messageData = {
          id: message.id,
          senderId: userId,
          recipientId,
          content,
          messageType,
          isRead: false,
          createdAt: message.createdAt,
          sender: {
            id: socket.user.id,
            displayName: socket.user.displayName,
            username: socket.user.username,
            profileAvatar: socket.user.avatar_url
          }
        };

        // Send to recipient if online
        if (isRecipientOnline) {
          socket.to(`user_${recipientId}`).emit('new_private_message', messageData);
        }

        // Send confirmation to sender
        socket.emit('message_sent', { success: true, messageId: message.id });

        // Create notification for recipient
        await this.createNotification({
          recipientId,
          senderId: userId,
          type: 'new_message',
          title: 'New Message',
          message: `You have a new message from ${socket.user.displayName}`,
          actionUrl: `/chat/${userId}`,
          customData: { messageId: message.id }
        });

      } catch (error) {
        console.error('Error sending private message:', error);
        socket.emit('message_error', { error: 'Failed to send message' });
      }
    });

    // Mark messages as read
    socket.on('mark_messages_read', async (data) => {
      try {
        const { senderId } = data;
        
        await Message.update(
          { isRead: true },
          { 
            where: { 
              senderId,
              recipientId: userId,
              isRead: false
            }
          }
        );

        // Notify sender that messages were read
        const senderSocketId = this.connectedUsers.get(senderId);
        if (senderSocketId) {
          socket.to(senderSocketId).emit('messages_read', { readerId: userId });
        }

      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });
  }

  setupLiveChat(socket) {
    const userId = socket.user.id;

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
        
        // Cache session data
        await RedisService.cacheLiveChatSession(sessionId, session.toJSON());

        // Notify other participants
        socket.to(`live_chat_${sessionId}`).emit('live_chat_user_joined', {
          sessionId,
          userId,
          userName: socket.user.displayName,
          userRole: socket.user.role
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

    // Send live chat message
    socket.on('send_live_chat_message', async (data) => {
      try {
        const { sessionId, message, messageType = 'text' } = data;
        
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

        const senderType = session.user_id === userId ? 'user' : 'admin';

        // Create message in database
        const chatMessage = await LiveChatMessage.create({
          session_id: sessionId,
          sender_id: userId,
          sender_type: senderType,
          message,
          message_type: messageType
        });

        const messageData = {
          id: chatMessage.id,
          sessionId,
          senderId: userId,
          senderType,
          message,
          messageType,
          createdAt: chatMessage.createdAt,
          sender: {
            id: socket.user.id,
            displayName: socket.user.displayName,
            username: socket.user.username,
            profileAvatar: socket.user.avatar_url
          }
        };

        // Emit message to all participants in the session
        this.io.to(`live_chat_${sessionId}`).emit('new_live_chat_message', messageData);

        // Send notification to admin if message is from user and session is active
        if (senderType === 'user' && session.status === 'active' && session.admin_id) {
          const adminSocketId = this.connectedUsers.get(session.admin_id);
          if (adminSocketId) {
            socket.to(adminSocketId).emit('live_chat_notification', {
              sessionId,
              message: `New message from ${socket.user.displayName}`,
              senderName: socket.user.displayName
            });
          }
        }

      } catch (error) {
        console.error('Error sending live chat message:', error);
        socket.emit('live_chat_error', { message: 'Failed to send message' });
      }
    });
  }

  setupNotifications(socket) {
    const userId = socket.user.id;

    // Send notification
    socket.on('send_notification', async (data) => {
      try {
        const { recipientId, type, title, message, actionUrl, customData } = data;
        
        const notification = await Notification.create({
          recipientId,
          senderId: userId,
          type,
          title,
          message,
          actionUrl,
          customData,
          status: 'unread',
          priority: 'normal'
        });

        const notificationData = {
          id: notification.id,
          recipientId,
          senderId: userId,
          type,
          title,
          message,
          actionUrl,
          customData,
          status: 'unread',
          priority: 'normal',
          createdAt: notification.createdAt,
          sender: {
            id: socket.user.id,
            displayName: socket.user.displayName,
            username: socket.user.username,
            profileAvatar: socket.user.avatar_url
          }
        };

        // Send to recipient if online
        const recipientSocketId = this.connectedUsers.get(recipientId);
        if (recipientSocketId) {
          socket.to(recipientSocketId).emit('new_notification', notificationData);
        }

        // Cache notification
        await RedisService.cacheNotifications(recipientId, notificationData);

        // Update unread count
        const currentCount = await Notification.count({
          where: { recipientId, status: 'unread' }
        });
        await RedisService.setUnreadCount(recipientId, currentCount);

      } catch (error) {
        console.error('Error sending notification:', error);
        socket.emit('notification_error', { error: 'Failed to send notification' });
      }
    });
  }

  setupLocationUpdates(socket) {
    const userId = socket.user.id;

    // Update user location
    socket.on('update_location', async (data) => {
      try {
        const { latitude, longitude, city, state, country } = data;
        
        // Update user location in database
        await User.update(
          {
            currentLocation: {
              latitude,
              longitude,
              city,
              state,
              country
            }
          },
          { where: { id: userId } }
        );

        // Leave old location room and join new one
        if (socket.user.currentLocation) {
          const oldLocationKey = `${socket.user.currentLocation.city}_${socket.user.currentLocation.state}`;
          socket.leave(`location_${oldLocationKey}`);
        }

        const newLocationKey = `${city}_${state}`;
        socket.join(`location_${newLocationKey}`);

        // Notify users in the new location
        socket.to(`location_${newLocationKey}`).emit('user_location_update', {
          userId,
          userName: socket.user.displayName,
          location: { city, state, country }
        });

        // Cache location data
        await RedisService.cacheLocationUsers(newLocationKey, {
          userId,
          userName: socket.user.displayName,
          location: { city, state, country }
        });

      } catch (error) {
        console.error('Error updating location:', error);
        socket.emit('location_update_error', { error: 'Failed to update location' });
      }
    });
  }

  setupGroupMessaging(socket) {
    const userId = socket.user.id;

    // Join group
    socket.on('join_group', async (groupId) => {
      try {
        // Verify user is member of the group
        const groupMember = await models.GroupMember.findOne({
          where: { group_id: groupId, user_id: userId }
        });

        if (!groupMember) {
          socket.emit('group_error', { message: 'You are not a member of this group' });
          return;
        }

        socket.join(`group_${groupId}`);
        
        // Notify other group members
        socket.to(`group_${groupId}`).emit('user_joined_group', {
          groupId,
          userId,
          userName: socket.user.displayName
        });

      } catch (error) {
        console.error('Error joining group:', error);
        socket.emit('group_error', { message: 'Failed to join group' });
      }
    });

    // Send group message
    socket.on('send_group_message', async (data) => {
      try {
        const { groupId, content, messageType = 'text' } = data;
        
        // Verify user is member of the group
        const groupMember = await models.GroupMember.findOne({
          where: { group_id: groupId, user_id: userId }
        });

        if (!groupMember) {
          socket.emit('group_error', { message: 'You are not a member of this group' });
          return;
        }

        // Create message in database
        const message = await Message.create({
          senderId: userId,
          groupId,
          content,
          messageType,
          isRead: false
        });

        const messageData = {
          id: message.id,
          groupId,
          senderId: userId,
          content,
          messageType,
          isRead: false,
          createdAt: message.createdAt,
          sender: {
            id: socket.user.id,
            displayName: socket.user.displayName,
            username: socket.user.username,
            profileAvatar: socket.user.avatar_url
          }
        };

        // Send to all group members
        this.io.to(`group_${groupId}`).emit('new_group_message', messageData);

      } catch (error) {
        console.error('Error sending group message:', error);
        socket.emit('group_error', { message: 'Failed to send message' });
      }
    });
  }

  // Utility methods for external use
  async createNotification(notificationData) {
    try {
      const notification = await Notification.create(notificationData);
      
      // Send to user if online
      const recipientSocketId = this.connectedUsers.get(notificationData.recipientId);
      if (recipientSocketId) {
        this.io.to(recipientSocketId).emit('new_notification', notification.toJSON());
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  async sendToUser(userId, event, data) {
    try {
      const socketId = this.connectedUsers.get(userId);
      if (socketId) {
        this.io.to(socketId).emit(event, data);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error sending to user:', error);
      return false;
    }
  }

  async sendToLocation(location, event, data) {
    try {
      this.io.to(`location_${location}`).emit(event, data);
      return true;
    } catch (error) {
      console.error('Error sending to location:', error);
      return false;
    }
  }

  async sendToGroup(groupId, event, data) {
    try {
      this.io.to(`group_${groupId}`).emit(event, data);
      return true;
    } catch (error) {
      console.error('Error sending to group:', error);
      return false;
    }
  }

  getIO() {
    return this.io;
  }

  getConnectedUsers() {
    return this.connectedUsers;
  }

  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }
}

export default RedisSocketHandler;
