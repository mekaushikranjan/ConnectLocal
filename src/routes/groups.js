import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Group, GroupMember, User } from '../models/index.js';
import { Op } from 'sequelize';
import cityGroupService from '../services/cityGroupService.js';

const router = express.Router();

// Helper function to transform group data for frontend
const transformGroupData = (groupData, membership) => {
  return {
    ...groupData,
    imageUrl: groupData.image_url,
    coverImageUrl: groupData.cover_image_url,
    memberCount: groupData.member_count,
    postCount: groupData.post_count,
    location: groupData.location_json || {},
    settings: groupData.settings_json || {
      allowInvites: true,
      requireApproval: false,
      allowPosts: true,
      allowComments: true
    },
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
  const { page = 1, limit = 20, category, privacy, userGroups } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = {
    status: 'active'
  };

  // If userGroups is true, get groups where user is a member
  if (userGroups === 'true') {
    // Get groups where user is a member
    const userMemberships = await GroupMember.findAll({
      where: {
        user_id: req.user.id,
        status: 'active'
      },
      attributes: ['group_id']
    });

    const groupIds = userMemberships.map(membership => membership.group_id);
    
    if (groupIds.length === 0) {
      return res.json({
        success: true,
        data: {
          items: [],
          total: 0,
          page: parseInt(page),
          totalPages: 0
        }
      });
    }

    whereClause.id = { [Op.in]: groupIds };
  } else {
    // Default behavior: public groups or groups created by user
    whereClause[Op.or] = [
      { privacy: 'public' },
      { created_by: req.user.id }
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
        attributes: ['id', 'displayName', 'username', 'avatar_url', 'bio_text']
      }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['role', 'ASC'], ['joinedAt', 'ASC']]
  });

  // Transform member data to match frontend expectations
  const transformedMembers = members.rows.map(member => ({
    ...member.toJSON(),
    user: {
      ...member.user.toJSON(),
      bio: member.user.bio_text, // Map bio_text to bio for frontend
      avatarUrl: member.user.avatar_url // Map avatar_url to avatarUrl
    }
  }));

  res.json({
    success: true,
    data: {
      items: transformedMembers,
      total: members.count,
      page: parseInt(page),
      totalPages: Math.ceil(members.count / limit)
    }
  });
}));

/**
 * @route   GET /api/groups/city
 * @desc    Get all city groups
 * @access  Private
 */
router.get('/city', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, country, state } = req.query;
  
  const result = await cityGroupService.getCityGroups({
    page: parseInt(page),
    limit: parseInt(limit),
    country,
    state
  });

  res.json({
    success: true,
    data: result
  });
}));

/**
 * @route   GET /api/groups/city/nearby
 * @desc    Get nearby city groups
 * @access  Private
 */
router.get('/city/nearby', authenticate, asyncHandler(async (req, res) => {
  const { latitude, longitude, radius = 50 } = req.query;
  
  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      message: 'Latitude and longitude are required'
    });
  }

  const cityGroups = await cityGroupService.getNearbyCityGroups(
    parseFloat(latitude),
    parseFloat(longitude),
    parseFloat(radius)
  );

  res.json({
    success: true,
    data: {
      items: cityGroups,
      total: cityGroups.length
    }
  });
}));

/**
 * @route   POST /api/groups/city/auto-join
 * @desc    Manually trigger auto-join to city group
 * @access  Private
 */
router.post('/city/auto-join', authenticate, asyncHandler(async (req, res) => {
  const { city, state, country } = req.body;
  
  if (!city) {
    return res.status(400).json({
      success: false,
      message: 'City name is required'
    });
  }

  const result = await cityGroupService.autoJoinCityGroup(
    req.user.id,
    city,
    state,
    country
  );

  res.json({
    success: result.success,
    message: result.message,
    data: result
  });
}));

/**
 * @route   POST /api/groups/city/remove-from-others
 * @desc    Manually remove user from other city groups
 * @access  Private
 */
router.post('/city/remove-from-others', authenticate, asyncHandler(async (req, res) => {
  const { city, state, country } = req.body;
  
  if (!city) {
    return res.status(400).json({
      success: false,
      message: 'City name is required'
    });
  }

  const result = await cityGroupService.removeFromOtherCityGroups(
    req.user.id,
    city,
    state,
    country
  );

  res.json({
    success: result.success,
    message: result.message,
    data: result
  });
}));

/**
 * @route   GET /api/groups/city/my-memberships
 * @desc    Get user's current city group memberships
 * @access  Private
 */
router.get('/city/my-memberships', authenticate, asyncHandler(async (req, res) => {
  const memberships = await cityGroupService.getUserCityGroupMemberships(req.user.id);

  res.json({
    success: true,
    data: {
      items: memberships,
      total: memberships.length,
      page: 1,
      totalPages: 1
    }
  });
}));

/**
 * @route   POST /api/groups/city/create
 * @desc    Create new city group (admin only)
 * @access  Private
 */
router.post('/city/create', authenticate, asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Only administrators can create city groups'
    });
  }

  const { cityName, state, country } = req.body;
  
  if (!cityName) {
    return res.status(400).json({
      success: false,
      message: 'City name is required'
    });
  }

  const result = await cityGroupService.createCityGroup(
    cityName,
    state,
    country,
    {},
    req.user.id
  );

  res.json({
    success: true,
    message: `City group "${cityName} Community" created successfully`,
    data: result
  });
}));

/**
 * @route   GET /api/groups/street
 * @desc    Get all street groups
 * @access  Private
 */
router.get('/street', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, city, state, country } = req.query;
  
  const result = await cityGroupService.getStreetGroups({
    page: parseInt(page),
    limit: parseInt(limit),
    city,
    state,
    country
  });

  res.json({
    success: true,
    data: result
  });
}));

/**
 * @route   POST /api/groups/street/create
 * @desc    Create new street group (admin only)
 * @access  Private
 */
router.post('/street/create', authenticate, asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Only administrators can create street groups'
    });
  }

  const { streetName, city, state, country, formattedAddress, latitude, longitude } = req.body;
  
  if (!streetName || !city) {
    return res.status(400).json({
      success: false,
      message: 'Street name and city are required'
    });
  }

  const result = await cityGroupService.createStreetGroup(
    streetName,
    city,
    state,
    country,
    formattedAddress,
    latitude,
    longitude,
    req.user.id
  );

  res.json({
    success: result.success,
    message: result.message,
    data: result.group
  });
}));

/**
 * @route   GET /api/groups/street/nearby
 * @desc    Get nearby street groups
 * @access  Private
 */
router.get('/street/nearby', authenticate, asyncHandler(async (req, res) => {
  const { latitude, longitude, radius = 5 } = req.query;
  
  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      message: 'Latitude and longitude are required'
    });
  }

  const streetGroups = await cityGroupService.getNearbyStreetGroups(
    parseFloat(latitude),
    parseFloat(longitude),
    parseFloat(radius)
  );

  res.json({
    success: true,
    data: {
      items: streetGroups,
      total: streetGroups.length
    }
  });
}));

/**
 * @route   POST /api/groups/street/auto-join
 * @desc    Auto-join user to street group based on location
 * @access  Private
 */
router.post('/street/auto-join', authenticate, asyncHandler(async (req, res) => {
  const { streetName, city, state, country, formattedAddress } = req.body;
  
  if (!streetName || !city) {
    return res.status(400).json({
      success: false,
      message: 'Street name and city are required'
    });
  }

  const result = await cityGroupService.autoJoinStreetGroup(
    req.user.id,
    streetName,
    city,
    state,
    country,
    formattedAddress
  );

  res.json({
    success: result.success,
    message: result.message,
    data: result
  });
}));

/**
 * @route   POST /api/groups/street/remove-from-others
 * @desc    Remove user from other street groups when location changes
 * @access  Private
 */
router.post('/street/remove-from-others', authenticate, asyncHandler(async (req, res) => {
  const { streetName, city, state, country, formattedAddress } = req.body;
  
  if (!streetName || !city) {
    return res.status(400).json({
      success: false,
      message: 'Street name and city are required'
    });
  }

  const result = await cityGroupService.removeFromOtherStreetGroups(
    req.user.id,
    streetName,
    city,
    state,
    country,
    formattedAddress
  );

  res.json({
    success: result.success,
    message: result.message,
    data: result
  });
}));

/**
 * @route   GET /api/groups/street/my-memberships
 * @desc    Get user's street group memberships
 * @access  Private
 */
router.get('/street/my-memberships', authenticate, asyncHandler(async (req, res) => {
  const memberships = await cityGroupService.getUserStreetGroupMemberships(req.user.id);

  res.json({
    success: true,
    data: {
      items: memberships,
      total: memberships.length,
      page: 1,
      totalPages: 1
    }
  });
}));

/**
 * @route   POST /api/groups/cleanup-duplicates
 * @desc    Clean up duplicate groups (admin only)
 * @access  Private
 */
router.post('/cleanup-duplicates', authenticate, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Only administrators can clean up duplicate groups'
    });
  }

  const { category = 'city' } = req.body;
  
  if (!['city', 'street'].includes(category)) {
    return res.status(400).json({
      success: false,
      message: 'Category must be either "city" or "street"'
    });
  }

  const result = await cityGroupService.cleanupDuplicateGroups(category);

  res.json({
    success: result.success,
    message: result.message,
    data: result
  });
}));

/**
 * @route   POST /api/groups/cleanup-all-duplicates
 * @desc    Clean up all duplicate groups (admin only)
 * @access  Private
 */
router.post('/cleanup-all-duplicates', authenticate, asyncHandler(async (req, res) => { 
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Only administrators can clean up duplicate groups'
    });
  }

  const cityResult = await cityGroupService.cleanupDuplicateGroups('city');
  const streetResult = await cityGroupService.cleanupDuplicateStreetGroups();

  res.json({
    success: cityResult.success && streetResult.success,
    message: 'Cleanup completed',
    data: {
      city: cityResult,
      street: streetResult
    }
  });
}));

/**
 * @route   POST /api/groups/cleanup-street-duplicates
 * @desc    Clean up duplicate street groups (admin only)
 * @access  Private
 */
router.post('/cleanup-street-duplicates', authenticate, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Only administrators can clean up duplicate street groups'
    });
  }

  const result = await cityGroupService.cleanupDuplicateStreetGroups();

  res.json({
    success: result.success,
    message: result.message,
    data: result
  });
}));

/**
 * @route   POST /api/groups/cleanup-user-memberships
 * @desc    Clean up user's group memberships based on current location
 * @access  Private
 */
router.post('/cleanup-user-memberships', authenticate, asyncHandler(async (req, res) => {
  try {
    const result = await cityGroupService.auditAndFixUserMemberships(req.user.id);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to clean up user memberships',
      error: error.message
    });
  }
}));

/**
 * @route   POST /api/groups/remove-mismatched-memberships
 * @desc    Remove and delete user from groups where location doesn't match
 * @access  Private
 */
router.post('/remove-mismatched-memberships', authenticate, asyncHandler(async (req, res) => {
  try {
    const { city, state, country, street } = req.body;
    
    if (!city) {
      return res.status(400).json({
        success: false,
        message: 'City is required'
      });
    }

    const userLocation = { city, state, country, street };
    const result = await cityGroupService.removeAndDeleteFromMismatchedGroups(req.user.id, userLocation);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to remove mismatched memberships',
      error: error.message
    });
  }
}));

export default router;
