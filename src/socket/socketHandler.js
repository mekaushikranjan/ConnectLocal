import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';

const connectedUsers = new Map();

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
      origin: process.env.FRONTEND_URL || ["http://localhost:8081", "http://10.249.208.235:8081", "exp://10.249.208.235:8081"],
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      
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
    connectedUsers.set(userId, socket.id);

    // Update user's online status
    await User.update({ isOnline: true }, { where: { id: userId } });

    // Join personal room for private messages
    socket.join(`user_${userId}`);

    // Handle user disconnection
    socket.on('disconnect', async () => {
      connectedUsers.delete(userId);
      await User.update(
        { 
          isOnline: false,
          lastActive: new Date()
        }, 
        { where: { id: userId } }
      );
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
        const { chatId, content, type = 'text' } = data;

        const message = await Message.create({
          chatId,
          senderId: userId,
          content,
          type
        });

        // Update chat's last message
        await Chat.update(
          { lastMessageAt: new Date() },
          { where: { id: chatId } }
        );

        // Emit message to all users in the chat
        io.to(`chat_${chatId}`).emit('new_message', {
          message: {
            ...message.toJSON(),
            sender: {
              id: socket.user.id,
              username: socket.user.username,
              displayName: socket.user.displayName
            }
          }
        });
      } catch (error) {
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
      
      await Message.update(
        { readBy: sequelize.fn('array_append', sequelize.col('readBy'), userId) },
        { 
          where: { 
            id: messageIds,
            readBy: { [Op.not]: { [Op.contains]: [userId] } }
          }
        }
      );

      io.to(`chat_${chatId}`).emit('messages_read', {
        userId,
        messageIds
      });
    });

    // Online status
    socket.on('get_online_status', async (userIds) => {
      const onlineStatus = {};
      for (const id of userIds) {
        onlineStatus[id] = connectedUsers.has(id.toString());
      }
      socket.emit('online_status_response', onlineStatus);
    });
  });

  return io;
};
