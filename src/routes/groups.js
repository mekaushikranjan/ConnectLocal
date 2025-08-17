import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Group, GroupMember, User } from '../models/index.js';
import { Op } from 'sequelize';

const router = express.Router();

// Helper function to transform group data for frontend
const transformGroupData = (groupData, membership) => {
  return {
    ...groupData,
    imageUrl: groupData.image_url,
    coverImageUrl: groupData.cover_image_url,
    memberCount: groupData.member_count,
    postCount: groupData.post_count,
    location: groupData.location_json,
    settings: groupData.settings_json,
    createdBy: groupData.creator,
    isJoined: !!membership,
    userRole: membership?.role || null
  };
};

/**
 * @route   GET /api/groups
 * @desc    Get all groups (public and user's groups)
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, category, privacy } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = {
    status: 'active',
    [Op.or]: [
      { privacy: 'public' },
      { created_by: req.user.id }
    ]
  };

  if (category) whereClause.category = category;
  if (privacy) whereClause.privacy = privacy;

  const groups = await Group.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  // Check if current user is a member of each group
  const groupsWithMembership = await Promise.all(
    groups.rows.map(async (group) => {
      const membership = await GroupMember.findOne({
        where: {
          group_id: group.id,
          user_id: req.user.id,
          status: 'active'
        }
      });

      return transformGroupData(group.toJSON(), membership);
    })
  );

  res.json({
    success: true,
    data: {
      items: groupsWithMembership,
      total: groups.count,
      page: parseInt(page),
      totalPages: Math.ceil(groups.count / limit)
    }
  });
}));

/**
 * @route   GET /api/groups/nearby
 * @desc    Get nearby groups based on location
 * @access  Private
 */
router.get('/nearby', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, latitude, longitude, radius = 10 } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = {
    status: 'active',
    privacy: 'public'
  };

  // If location is provided, filter by location
  if (latitude && longitude) {
    // For now, we'll return all public groups
    // In the future, implement location-based filtering
  }

  const groups = await Group.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['member_count', 'DESC'], ['createdAt', 'DESC']]
  });

  // Check if current user is a member of each group
  const groupsWithMembership = await Promise.all(
    groups.rows.map(async (group) => {
      const membership = await GroupMember.findOne({
        where: {
          group_id: group.id,
          user_id: req.user.id,
          status: 'active'
        }
      });

      return transformGroupData(group.toJSON(), membership);
    })
  );

  res.json({
    success: true,
    data: {
      items: groupsWithMembership,
      total: groups.count,
      page: parseInt(page),
      totalPages: Math.ceil(groups.count / limit)
    }
  });
}));

/**
 * @route   GET /api/groups/search
 * @desc    Search groups
 * @access  Private
 */
router.get('/search', authenticate, asyncHandler(async (req, res) => {
  const { query, category, privacy, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = {
    status: 'active',
    [Op.or]: [
      { privacy: 'public' },
      { created_by: req.user.id }
    ]
  };

  if (query) {
    whereClause[Op.or] = [
      { name: { [Op.iLike]: `%${query}%` } },
      { description: { [Op.iLike]: `%${query}%` } },
      { category: { [Op.iLike]: `%${query}%` } }
    ];
  }

  if (category) whereClause.category = category;
  if (privacy) whereClause.privacy = privacy;

  const groups = await Group.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['member_count', 'DESC'], ['createdAt', 'DESC']]
  });

  // Check if current user is a member of each group
  const groupsWithMembership = await Promise.all(
    groups.rows.map(async (group) => {
      const membership = await GroupMember.findOne({
        where: {
          group_id: group.id,
          user_id: req.user.id,
          status: 'active'
        }
      });

      return transformGroupData(group.toJSON(), membership);
    })
  );

  res.json({
    success: true,
    data: {
      items: groupsWithMembership,
      total: groups.count,
      page: parseInt(page),
      totalPages: Math.ceil(groups.count / limit)
    }
  });
}));

/**
 * @route   POST /api/groups
 * @desc    Create a new group
 * @access  Private
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const {
    name,
    description,
    category,
    privacy = 'public',
    imageUrl,
    coverImageUrl,
    rules,
    tags,
    location
  } = req.body;

  if (!name || !category) {
    return res.status(400).json({
      success: false,
      message: 'Name and category are required'
    });
  }

  const group = await Group.create({
    name,
    description,
    category,
    privacy,
    imageUrl,
    coverImageUrl,
    rules: rules || [],
    tags: tags || [],
    location: location || {},
    created_by: req.user.id
  });

  // Add creator as admin member
  await GroupMember.create({
    group_id: group.id,
    user_id: req.user.id,
    role: 'admin',
    status: 'active'
  });

  // Update member count
  await group.update({ member_count: 1 });

  const createdGroup = await Group.findByPk(group.id, {
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }
    ]
  });

  res.status(201).json({
    success: true,
    message: 'Group created successfully',
    data: transformGroupData(createdGroup.toJSON(), { role: 'admin' })
  });
}));

/**
 * @route   GET /api/groups/:id
 * @desc    Get group details
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const group = await Group.findOne({
    where: {
      id: req.params.id,
      status: 'active',
      [Op.or]: [
        { privacy: 'public' },
        { created_by: req.user.id }
      ]
    },
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }
    ]
  });

  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found'
    });
  }

  // Check if user is a member
  const membership = await GroupMember.findOne({
    where: {
      group_id: group.id,
      user_id: req.user.id,
      status: 'active'
    }
  });

  res.json({
    success: true,
    data: transformGroupData(group.toJSON(), membership)
  });
}));

/**
 * @route   POST /api/groups/:id/join
 * @desc    Join a group
 * @access  Private
 */
router.post('/:id/join', authenticate, asyncHandler(async (req, res) => {
  const group = await Group.findOne({
    where: {
      id: req.params.id,
      status: 'active'
    }
  });

  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found'
    });
  }

  // Check if user is already a member
  const existingMembership = await GroupMember.findOne({
    where: {
      group_id: group.id,
      user_id: req.user.id
    }
  });

  if (existingMembership) {
    if (existingMembership.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this group'
      });
    } else if (existingMembership.status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Your membership request is pending approval'
      });
    }
  }

  // Create membership
  const membership = await GroupMember.create({
    group_id: group.id,
    user_id: req.user.id,
    role: 'member',
    status: group.settings?.requireApproval ? 'pending' : 'active'
  });

  // Update member count if approved
  if (membership.status === 'active') {
    await group.increment('member_count');
  }

  res.json({
    success: true,
    message: group.settings?.requireApproval 
      ? 'Join request sent. Waiting for approval.' 
      : 'Successfully joined the group',
    data: {
      membership: membership.toJSON(),
      requiresApproval: group.settings?.requireApproval || false
    }
  });
}));

/**
 * @route   POST /api/groups/:id/leave
 * @desc    Leave a group
 * @access  Private
 */
router.post('/:id/leave', authenticate, asyncHandler(async (req, res) => {
  const group = await Group.findOne({
    where: {
      id: req.params.id,
      status: 'active'
    }
  });

  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found'
    });
  }

  const membership = await GroupMember.findOne({
    where: {
      group_id: group.id,
      user_id: req.user.id,
      status: 'active'
    }
  });

  if (!membership) {
    return res.status(400).json({
      success: false,
      message: 'You are not a member of this group'
    });
  }

  // Don't allow group creator to leave
  if (group.created_by === req.user.id) {
    return res.status(400).json({
      success: false,
      message: 'Group creator cannot leave the group. Transfer ownership or delete the group instead.'
    });
  }

  await membership.destroy();
  await group.decrement('member_count');

  res.json({
    success: true,
    message: 'Successfully left the group'
  });
}));

/**
 * @route   GET /api/groups/:id/members
 * @desc    Get group members
 * @access  Private
 */
router.get('/:id/members', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role } = req.query;
  const offset = (page - 1) * limit;

  const group = await Group.findOne({
    where: {
      id: req.params.id,
      status: 'active',
      [Op.or]: [
        { privacy: 'public' },
          { created_by: req.user.id }
      ]
    }
  });

  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found'
    });
  }

  const whereClause = {
    group_id: group.id,
    status: 'active'
  };

  if (role) whereClause.role = role;

  const members = await GroupMember.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'displayName', 'username', 'avatar_url', 'bio']
      }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['role', 'ASC'], ['joinedAt', 'ASC']]
  });

  res.json({
    success: true,
    data: {
      items: members.rows,
      total: members.count,
      page: parseInt(page),
      totalPages: Math.ceil(members.count / limit)
    }
  });
}));

export default router;
