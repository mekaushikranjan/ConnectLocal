import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Connection, User } from '../models/index.js';
import { Op } from 'sequelize';

const router = express.Router();

/**
 * @route   GET /api/connections
 * @desc    Get user's connections (friends)
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const userId = req.user.id;

  const connections = await Connection.findAndCountAll({
    where: {
      [Op.or]: [
        { user_id1: userId },
        { user_id2: userId }
      ],
      status: 'accepted'
    },
    include: [
      {
        model: User,
        as: 'user1',
        attributes: ['id', 'displayName', 'username', 'avatar_url'],
        where: { id: { [Op.ne]: userId } }
      },
      {
        model: User,
        as: 'user2',
        attributes: ['id', 'displayName', 'username', 'avatar_url'],
        where: { id: { [Op.ne]: userId } }
      }
    ],
    limit: parseInt(limit),
    offset: offset,
    order: [['createdAt', 'DESC']]
  });

  // Transform the data to return the other user (not the current user)
  const transformedConnections = connections.rows.map(connection => {
      const otherUser = connection.user_id1 === userId ? connection.user1 : connection.user2;
    return {
      id: connection.id,
      status: connection.status,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
      user: {
        id: otherUser.id,
        displayName: otherUser.displayName,
        username: otherUser.username,
        avatarUrl: otherUser.avatar_url
      }
    };
  });

  res.json({
    success: true,
    data: {
      connections: transformedConnections,
      total: connections.count,
      page: parseInt(page),
      totalPages: Math.ceil(connections.count / parseInt(limit))
    }
  });
}));

/**
 * @route   POST /api/connections/request
 * @desc    Send a connection request
 * @access  Private
 */
router.post('/request', authenticate, asyncHandler(async (req, res) => {
  const { receiverId } = req.body;
  const senderId = req.user.id;

  if (senderId === receiverId) {
    return res.status(400).json({
      success: false,
      message: 'Cannot send connection request to yourself'
    });
  }

  // Check if receiver exists
  const receiver = await User.findByPk(receiverId);
  if (!receiver) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Check if connection already exists
  const existingConnection = await Connection.findConnection(senderId, receiverId);
  if (existingConnection) {
    if (existingConnection.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Users are already connected'
      });
    } else if (existingConnection.status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Connection request already sent'
      });
    } else if (existingConnection.status === 'blocked') {
      return res.status(400).json({
        success: false,
        message: 'Cannot send request to blocked user'
      });
    }
  }

  // Create new connection request
  const connection = await Connection.create({
    user_id1: senderId,
    user_id2: receiverId,
    status: 'pending'
  });

  res.status(201).json({
    success: true,
    message: 'Connection request sent successfully',
    data: {
      id: connection.id,
      status: connection.status,
      createdAt: connection.createdAt
    }
  });
}));

/**
 * @route   GET /api/connections/requests
 * @desc    Get all connection requests for the user
 * @access  Private
 */
router.get('/requests', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const requests = await Connection.findAll({
    where: {
      user_id2: userId,
      status: 'pending'
    },
    include: [
      {
        model: User,
        as: 'user1',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }
    ],
    order: [['createdAt', 'DESC']]
  });

  const transformedRequests = requests.map(request => ({
    id: request.id,
    status: request.status,
    createdAt: request.createdAt,
    sender: {
      id: request.user1.id,
      displayName: request.user1.displayName,
      username: request.user1.username,
      avatarUrl: request.user1.avatar_url
    }
  }));

  res.json({
    success: true,
    data: {
      requests: transformedRequests
    }
  });
}));

/**
 * @route   GET /api/connections/requests/incoming
 * @desc    Get incoming connection requests
 * @access  Private
 */
router.get('/requests/incoming', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const requests = await Connection.findAll({
    where: {
      user_id2: userId,
      status: 'pending'
    },
    include: [
      {
        model: User,
        as: 'user1',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }
    ],
    order: [['createdAt', 'DESC']]
  });

  const transformedRequests = requests.map(request => ({
    id: request.id,
    status: request.status,
    createdAt: request.createdAt,
    sender: {
      id: request.user1.id,
      displayName: request.user1.displayName,
      username: request.user1.username,
      avatarUrl: request.user1.avatar_url
    }
  }));

  res.json({
    success: true,
    data: {
      requests: transformedRequests
    }
  });
}));

/**
 * @route   GET /api/connections/requests/outgoing
 * @desc    Get outgoing connection requests
 * @access  Private
 */
router.get('/requests/outgoing', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const requests = await Connection.findAll({
    where: {
      user_id1: userId,
      status: 'pending'
    },
    include: [
      {
        model: User,
        as: 'user2',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }
    ],
    order: [['createdAt', 'DESC']]
  });

  const transformedRequests = requests.map(request => ({
    id: request.id,
    status: request.status,
    createdAt: request.createdAt,
    receiver: {
      id: request.user2.id,
      displayName: request.user2.displayName,
      username: request.user2.username,
      avatarUrl: request.user2.avatar_url
    }
  }));

  res.json({
    success: true,
    data: {
      requests: transformedRequests
    }
  });
}));

/**
 * @route   POST /api/connections/requests/:requestId/accept
 * @desc    Accept a connection request
 * @access  Private
 */
router.post('/requests/:requestId/accept', authenticate, asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const userId = req.user.id;

  const request = await Connection.findOne({
    where: {
      id: requestId,
      user_id2: userId,
      status: 'pending'
    }
  });

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Connection request not found'
    });
  }

  request.status = 'accepted';
  await request.save();

  res.json({
    success: true,
    message: 'Connection request accepted',
    data: {
      id: request.id,
      status: request.status,
      updatedAt: request.updatedAt
    }
  });
}));

/**
 * @route   POST /api/connections/requests/:requestId/reject
 * @desc    Reject a connection request
 * @access  Private
 */
router.post('/requests/:requestId/reject', authenticate, asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const userId = req.user.id;

  const request = await Connection.findOne({
    where: {
      id: requestId,
      user_id2: userId,
      status: 'pending'
    }
  });

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Connection request not found'
    });
  }

  request.status = 'rejected';
  await request.save();

  res.json({
    success: true,
    message: 'Connection request rejected',
    data: {
      id: request.id,
      status: request.status,
      updatedAt: request.updatedAt
    }
  });
}));

/**
 * @route   DELETE /api/connections/requests/:requestId
 * @desc    Cancel/delete a connection request
 * @access  Private
 */
router.delete('/requests/:requestId', authenticate, asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const userId = req.user.id;

  const request = await Connection.findOne({
    where: {
      id: requestId,
      [Op.or]: [
        { user_id1: userId },
        { user_id2: userId }
      ]
    }
  });

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Connection request not found'
    });
  }

  await request.destroy();

  res.json({
    success: true,
    message: 'Connection request deleted'
  });
}));

/**
 * @route   DELETE /api/connections/:connectionId
 * @desc    Remove a connection (unfriend)
 * @access  Private
 */
router.delete('/:connectionId', authenticate, asyncHandler(async (req, res) => {
  const { connectionId } = req.params;
  const userId = req.user.id;

  const connection = await Connection.findOne({
    where: {
      id: connectionId,
      [Op.or]: [
        { user_id1: userId },
        { user_id2: userId }
      ],
      status: 'accepted'
    }
  });

  if (!connection) {
    return res.status(404).json({
      success: false,
      message: 'Connection not found'
    });
  }

  await connection.destroy();

  res.json({
    success: true,
    message: 'Connection removed'
  });
}));

/**
 * @route   POST /api/connections/block
 * @desc    Block a user
 * @access  Private
 */
router.post('/block', authenticate, asyncHandler(async (req, res) => {
  const { userId: targetUserId } = req.body;
  const currentUserId = req.user.id;

  if (currentUserId === targetUserId) {
    return res.status(400).json({
      success: false,
      message: 'Cannot block yourself'
    });
  }

  // Check if target user exists
  const targetUser = await User.findByPk(targetUserId);
  if (!targetUser) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Find or create connection and set to blocked
  let connection = await Connection.findConnection(currentUserId, targetUserId);
  
  if (connection) {
    connection.status = 'blocked';
    await connection.save();
  } else {
    connection = await Connection.create({
        user_id1: currentUserId,
        user_id2: targetUserId,
      status: 'blocked'
    });
  }

  res.json({
    success: true,
    message: 'User blocked successfully',
    data: {
      id: connection.id,
      status: connection.status,
      updatedAt: connection.updatedAt
    }
  });
}));

/**
 * @route   POST /api/connections/unblock
 * @desc    Unblock a user
 * @access  Private
 */
router.post('/unblock', authenticate, asyncHandler(async (req, res) => {
  const { userId: targetUserId } = req.body;
  const currentUserId = req.user.id;

  const connection = await Connection.findConnection(currentUserId, targetUserId);
  
  if (!connection || connection.status !== 'blocked') {
    return res.status(404).json({
      success: false,
      message: 'Blocked connection not found'
    });
  }

  await connection.destroy();

  res.json({
    success: true,
    message: 'User unblocked successfully'
  });
}));

/**
 * @route   GET /api/connections/blocked
 * @desc    Get blocked users
 * @access  Private
 */
router.get('/blocked', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const blockedConnections = await Connection.findAll({
    where: {
      [Op.or]: [
        { user_id1: userId },
        { user_id2: userId }
      ],
      status: 'blocked'
    },
    include: [
      {
        model: User,
        as: 'user1',
        attributes: ['id', 'displayName', 'username', 'avatar_url'],
        where: { id: { [Op.ne]: userId } }
      },
      {
        model: User,
        as: 'user2',
        attributes: ['id', 'displayName', 'username', 'avatar_url'],
        where: { id: { [Op.ne]: userId } }
      }
    ],
    order: [['updatedAt', 'DESC']]
  });

  const blockedUsers = blockedConnections.map(connection => {
    const blockedUser = connection.user_id1 === userId ? connection.user1 : connection.user2;
    return {
      id: blockedUser.id,
      displayName: blockedUser.displayName,
      username: blockedUser.username,
      avatarUrl: blockedUser.avatar_url,
      blockedAt: connection.updatedAt
    };
  });

  res.json({
    success: true,
    data: {
      blockedUsers
    }
  });
}));

/**
 * @route   GET /api/connections/status/:userId
 * @desc    Get connection status with a specific user
 * @access  Private
 */
router.get('/status/:userId', authenticate, asyncHandler(async (req, res) => {
  const { userId: targetUserId } = req.params;
  const currentUserId = req.user.id;

  if (currentUserId === targetUserId) {
    return res.json({
      success: true,
      data: {
        status: 'self',
        message: 'This is your own profile'
      }
    });
  }

  const connection = await Connection.findConnection(currentUserId, targetUserId);
  
  if (!connection) {
    return res.json({
      success: true,
      data: {
        status: 'none',
        message: 'No connection exists'
      }
    });
  }

  res.json({
    success: true,
    data: {
      status: connection.status,
      connectionId: connection.id,
      createdAt: connection.createdAt
    }
  });
}));

/**
 * @route   GET /api/connections/mutual/:userId
 * @desc    Get mutual connections with a user
 * @access  Private
 */
router.get('/mutual/:userId', authenticate, asyncHandler(async (req, res) => {
  const { userId: targetUserId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const currentUserId = req.user.id;

  if (currentUserId === targetUserId) {
    return res.status(400).json({
      success: false,
      message: 'Cannot get mutual connections with yourself'
    });
  }

  // Get current user's accepted connections
  const currentUserConnections = await Connection.findAll({
    where: {
      [Op.or]: [
        { user_id1: currentUserId },
        { user_id2: currentUserId }
      ],
      status: 'accepted'
    },
    attributes: ['user_id1', 'user_id2']
  });

  const currentUserFriends = currentUserConnections.map(conn => 
    conn.user_id1 === currentUserId ? conn.user_id2 : conn.user_id1
  );

  // Get target user's accepted connections
  const targetUserConnections = await Connection.findAll({
    where: {
      [Op.or]: [
        { user_id1: targetUserId },
        { user_id2: targetUserId }
      ],
      status: 'accepted'
    },
    attributes: ['user_id1', 'user_id2']
  });

  const targetUserFriends = targetUserConnections.map(conn => 
    conn.user_id1 === targetUserId ? conn.user_id2 : conn.user_id1
  );

  // Find mutual friends
  const mutualFriendIds = currentUserFriends.filter(id => 
    targetUserFriends.includes(id)
  );

  // Get mutual friends details with pagination
  const mutualFriends = await User.findAndCountAll({
    where: {
      id: { [Op.in]: mutualFriendIds }
    },
    attributes: ['id', 'displayName', 'username', 'avatar_url'],
    limit: parseInt(limit),
    offset: offset,
    order: [['displayName', 'ASC']]
  });

  res.json({
    success: true,
    data: {
      mutualFriends: mutualFriends.rows.map(user => ({
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        avatarUrl: user.avatar_url
      })),
      total: mutualFriends.count,
      page: parseInt(page),
      totalPages: Math.ceil(mutualFriends.count / parseInt(limit))
    }
  });
}));

export default router;
