import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { validateUpdateProfile } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { User, Notification, Connection, Post } from '../models/index.js';
import { Op } from 'sequelize';

const router = express.Router();

/**
 * @route   GET /api/users/profile/:username
 * @desc    Get user profile by username
 * @access  Public
 */
router.get('/profile/:username', asyncHandler(async (req, res) => {
  const user = await User.findOne({ where: { username: req.params.username } });
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    data: { 
      user: {
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        bio: user.bio_text,
        avatarUrl: user.avatarUrl,
        coverImageUrl: user.coverImageUrl,
        locationCity: user.locationCity,
        locationState: user.locationState,
        locationCountry: user.locationCountry,
        locationStreet: user.locationStreet,
        profileVisibility: user.profileVisibility,
        postsCount: user.postsCount,
        followersCount: user.followersCount,
        followingCount: user.followingCount,
        createdAt: user.createdAt
      }
    }
  });
}));

/**
 * @route   GET /api/users/search
 * @desc    Search users
 * @access  Private
 */
router.get('/search', authenticate, asyncHandler(async (req, res) => {
  const { q: query, location, limit = 20, page = 1 } = req.query;
  const offset = (page - 1) * limit;
  const currentUserId = req.user.id;

  const whereClause = {
    // Exclude current user
    id: { [Op.ne]: currentUserId },
    // Only show active users
    status: 'active'
  };

  if (query) {
    whereClause[Op.or] = [
      { username: { [Op.iLike]: `%${query}%` } },
      { displayName: { [Op.iLike]: `%${query}%` } },
      { first_name: { [Op.iLike]: `%${query}%` } },
      { last_name: { [Op.iLike]: `%${query}%` } }
    ];
  }

  if (location) {
    whereClause[Op.or] = [
      { location_city: { [Op.iLike]: `%${location}%` } },
      { location_state: { [Op.iLike]: `%${location}%` } },
      { location_country: { [Op.iLike]: `%${location}%` } },
      { location_street: { [Op.iLike]: `%${location}%` } }
    ];
  }

  const users = await User.findAndCountAll({
    where: whereClause,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']],
    attributes: [
      'id', 'email', 'displayName', 'first_name', 'last_name', 
      'bio_text', 'avatar_url', 'cover_image_url', 'phone_number', 
      'phone_verified', 'email_verified', 'role', 'status',
      'location_city', 'location_state', 'location_country', 'location_street',
      'share_location', 'profile_visibility', 'occupation', 'company', 
      'education', 'gender_type', 'date_of_birth', 'relationship_status',
      'interests_array', 'skills_array', 'social_links', 'createdAt', 
      'last_login', 'last_active'
    ]
  });

  res.json({
    success: true,
    data: {
      users: await Promise.all(users.rows.map(async (user) => {
        // Check connection status for each user
        const connection = await Connection.findConnection(currentUserId, user.id);
        let connectionStatus = 'none';
        let friendRequestSent = false;
        let friendRequestReceived = false;
        let isFriend = false;

        if (connection) {
          if (connection.status === 'accepted') {
            connectionStatus = 'connected';
            isFriend = true;
          } else if (connection.status === 'pending') {
            if (connection.user_id1 === currentUserId) {
              connectionStatus = 'sent';
              friendRequestSent = true;
            } else {
              connectionStatus = 'received';
              friendRequestReceived = true;
            }
          }
        }

        return {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          firstName: user.first_name,
          lastName: user.last_name,
          username: user.username,
          bio: user.bio_text,
          avatarUrl: user.avatar_url,
          coverImageUrl: user.cover_image_url,
          phoneNumber: user.phone_number,
          phoneVerified: user.phone_verified,
          emailVerified: user.email_verified,
          role: user.role,
          status: user.status,
          locationCity: user.location_city,
          locationState: user.location_state,
          locationCountry: user.location_country,
          locationStreet: user.location_street,

          shareLocation: user.share_location,
          profileVisibility: user.profile_visibility,
          occupation: user.occupation,
          company: user.company,
          education: user.education,
          gender: user.gender_type,
          dateOfBirth: user.date_of_birth,
          relationshipStatus: user.relationship_status,
          interests: user.interests_array,
          skills: user.skills_array,
          socialLinks: user.social_links,
          createdAt: user.createdAt,
          lastLogin: user.last_login,
          lastActive: user.last_active,
          
          // Connection status fields
          friendRequestSent,
          friendRequestReceived,
          isFriend,
          connectionStatus
        };
      })),
      total: users.count,
      page: parseInt(page),
      totalPages: Math.ceil(users.count / limit)
    }
  });
}));

/**
 * @route   GET /api/users/:userId
 * @desc    Get user by ID
 * @access  Private
 */
router.get('/:userId', authenticate, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user.id;

  const user = await User.findByPk(userId, {
    attributes: [
      'id', 'email', 'displayName', 'first_name', 'last_name', 
      'bio_text', 'avatar_url', 'cover_image_url', 'phone_number', 
      'phone_verified', 'email_verified', 'role', 'status',
      'location_city', 'location_state', 'location_country', 'location_street',
      'share_location', 'profile_visibility', 'occupation', 'company', 
      'education', 'gender_type', 'date_of_birth', 'relationship_status',
      'interests_array', 'skills_array', 'social_links', 'createdAt', 
      'last_login', 'last_active'
    ]
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Check if current user is blocked by this user or vice versa
  const blockCheck = await Connection.findOne({
    where: {
      [Op.or]: [
        { user_id1: currentUserId, user_id2: userId, status: 'blocked' },
        { user_id1: userId, user_id2: currentUserId, status: 'blocked' }
      ]
    }
  });

  if (blockCheck) {
    return res.status(403).json({
      success: false,
      message: 'Cannot view this profile'
    });
  }

  // Check connection status
  const connection = await Connection.findConnection(currentUserId, userId);
  let connectionStatus = 'none';
  let friendRequestSent = false;
  let friendRequestReceived = false;
  let isFriend = false;

  if (connection) {
    if (connection.status === 'accepted') {
      connectionStatus = 'connected';
      isFriend = true;
    } else if (connection.status === 'pending') {
      if (connection.user_id1 === currentUserId) {
        connectionStatus = 'sent';
        friendRequestSent = true;
      } else {
        connectionStatus = 'received';
        friendRequestReceived = true;
      }
    }
  }

  // Get counts
  const postsCount = await Post.count({ where: { author_id: userId, status: 'active' } });
  
  // Get friends count (accepted connections)
  const friendsCount = await Connection.count({
    where: {
      [Op.or]: [
        { user_id1: userId, status: 'accepted' },
        { user_id2: userId, status: 'accepted' }
      ]
    }
  });
  
  // For now, set followers and following to 0 (can be implemented later with a separate followers system)
  const followersCount = 0;
  const followingCount = 0;

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        bio: user.bio_text,
        avatarUrl: user.avatar_url,
        coverImageUrl: user.cover_image_url,
        phoneNumber: user.phone_number,
        phoneVerified: user.phone_verified,
        emailVerified: user.email_verified,
        role: user.role,
        status: user.status,
        locationCity: user.location_city,
        locationState: user.location_state,
        locationCountry: user.location_country,
        locationStreet: user.location_street,

        shareLocation: user.share_location,
        profileVisibility: user.profile_visibility,
        occupation: user.occupation,
        company: user.company,
        education: user.education,
        gender: user.gender_type,
        dateOfBirth: user.date_of_birth,
        relationshipStatus: user.relationship_status,
        interests: user.interests_array || [],
        skills: user.skills_array || [],
        socialLinks: user.social_links || {},
        postsCount,
        followersCount,
        followingCount,
        friendsCount,
        isFriend,
        friendRequestSent,
        friendRequestReceived,
        isBlocked: false,
        createdAt: user.createdAt,
        lastLogin: user.last_login,
        lastActive: user.last_active
      }
    }
  });
}));



/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticate, asyncHandler(async (req, res) => {
  const {
    displayName,
    firstName,
    lastName,
    bio,
    phoneNumber,
    locationCity,
    locationState,
    locationCountry,
    locationStreet,

    occupation,
    company,
    education,
    gender,
    dateOfBirth,
    relationshipStatus,
    interests,
    skills,
    socialLinks
  } = req.body;

 

  const user = await User.findByPk(req.user.id);
  
  // Update user fields
  const updateData = {};
  
  if (displayName !== undefined && displayName !== '') updateData.displayName = displayName;
  if (firstName !== undefined && firstName !== '') updateData.first_name = firstName;
  if (lastName !== undefined && lastName !== '') updateData.last_name = lastName;
  if (bio !== undefined && bio !== '') updateData.bio_text = bio;
  if (phoneNumber !== undefined && phoneNumber !== '') updateData.phone_number = phoneNumber;
  
  // Only update location fields if they are provided and different from current values
  if (locationCity !== undefined && locationCity !== '' && locationCity !== user.location_city) {
    updateData.location_city = locationCity;
    // Location city updated
  }
  if (locationState !== undefined && locationState !== '' && locationState !== user.location_state) {
    updateData.location_state = locationState;
    // Location state updated
  }
  if (locationCountry !== undefined && locationCountry !== '' && locationCountry !== user.location_country) {
    updateData.location_country = locationCountry;
  }
  if (locationStreet !== undefined && locationStreet !== '' && locationStreet !== user.location_street) {
    updateData.location_street = locationStreet;
  }

  
  if (occupation !== undefined && occupation !== '') updateData.occupation = occupation;
  if (company !== undefined && company !== '') updateData.company = company;
  if (education !== undefined && education !== '') updateData.education = education;
  if (gender !== undefined && gender !== '') {
    // Validate and normalize gender values
    const validGenders = ['male', 'female', 'other', 'prefer-not-to-say'];
    const normalizedGender = gender.toLowerCase();
    
    if (validGenders.includes(normalizedGender)) {
      updateData.gender_type = normalizedGender;
    } else {
      // Invalid gender value
    }
  }
  if (dateOfBirth !== undefined && dateOfBirth !== '') updateData.date_of_birth = dateOfBirth;
  if (relationshipStatus !== undefined && relationshipStatus !== '') updateData.relationship_status = relationshipStatus;
  if (interests !== undefined) updateData.interests_array = interests;
  if (skills !== undefined) updateData.skills_array = skills;
  if (socialLinks !== undefined) updateData.social_links = socialLinks;



  await user.update(updateData);

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        firstName: user.first_name,
        lastName: user.last_name,
        bio: user.bio_text,
        avatarUrl: user.avatar_url,
        coverImageUrl: user.cover_image_url,
        phoneNumber: user.phone_number,
        phoneVerified: user.phone_verified,
        emailVerified: user.email_verified,
        role: user.role,
        status: user.status,
        locationCity: user.location_city,
        locationState: user.location_state,
        locationCountry: user.location_country,
        locationStreet: user.location_street,

        shareLocation: user.share_location,
        profileVisibility: user.profile_visibility,
        occupation: user.occupation,
        company: user.company,
        education: user.education,
        gender: user.gender_type,
        dateOfBirth: user.date_of_birth,
        relationshipStatus: user.relationship_status,
        interests: user.interests_array,
        skills: user.skills_array,
        socialLinks: user.social_links,
        createdAt: user.createdAt,
        lastLogin: user.last_login,
        lastActive: user.last_active
      }
    }
  });
}));

/**
 * @route   PUT /api/users/settings
 * @desc    Update user settings
 * @access  Private
 */
router.put('/settings', authenticate, asyncHandler(async (req, res) => {
  const allowedSettings = [
    'emailNotifications',
    'pushNotifications',
    'privacy',
    'language',
    'theme'
  ];

  const updates = Object.keys(req.body)
    .filter(key => allowedSettings.includes(key))
    .reduce((obj, key) => {
      obj[key] = req.body[key];
      return obj;
    }, {});

  const user = await User.findByPk(req.user.id);
  user.settings = { ...user.settings, ...updates };
  await user.save();

  res.json({
    success: true,
    message: 'Settings updated successfully',
    data: { settings: user.settings }
  });
}));

/**
 * @route   POST /api/users/follow/:userId
 * @desc    Follow a user
 * @access  Private
 */
router.post('/follow/:userId', authenticate, asyncHandler(async (req, res) => {
  const userToFollow = await User.findByPk(req.params.userId);
  if (!userToFollow) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  await req.user.addFollowing(userToFollow);

  res.json({
    success: true,
    message: `You are now following ${userToFollow.displayName}`
  });
}));

/**
 * @route   POST /api/users/unfollow/:userId
 * @desc    Unfollow a user
 * @access  Private
 */
router.post('/unfollow/:userId', authenticate, asyncHandler(async (req, res) => {
  const userToUnfollow = await User.findByPk(req.params.userId);
  if (!userToUnfollow) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  await req.user.removeFollowing(userToUnfollow);

  res.json({
    success: true,
    message: `You have unfollowed ${userToUnfollow.displayName}`
  });
}));

/**
 * @route   GET /api/users/:userId/followers
 * @desc    Get user followers
 * @access  Private
 */
router.get('/:userId/followers', authenticate, asyncHandler(async (req, res) => {
  const { limit = 10, page = 1 } = req.query;
  const offset = (page - 1) * limit;

  const user = await User.findByPk(req.params.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const followers = await user.getFollowers({
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  res.json({
    success: true,
    data: {
      followers: followers.rows.map(follower => follower.getPublicProfile()),
      total: followers.count,
      page: parseInt(page),
      totalPages: Math.ceil(followers.count / limit)
    }
  });
}));

/**
 * @route   GET /api/users/:userId/following
 * @desc    Get users that a user is following
 * @access  Private
 */
router.get('/:userId/following', authenticate, asyncHandler(async (req, res) => {
  const { limit = 10, page = 1 } = req.query;
  const offset = (page - 1) * limit;

  const user = await User.findByPk(req.params.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const following = await user.getFollowing({
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  res.json({
    success: true,
    data: {
      following: following.rows.map(follow => follow.getPublicProfile()),
      total: following.count,
      page: parseInt(page),
      totalPages: Math.ceil(following.count / limit)
    }
  });
}));

export default router;
