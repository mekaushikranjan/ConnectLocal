import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Post, Comment, User, Notification } from '../models/index.js';
import { Op } from 'sequelize';
import { validateComment } from '../middleware/validation.js';
import ScheduledPostsService from '../services/scheduledPostsService.js';

const router = express.Router();

/**
 * @route   GET /api/posts
 * @desc    Get feed posts
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { type, location, limit = 10, page = 1 } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = {
    [Op.or]: [
      { visibility: 'public' },
      { author_id: req.user.id }
    ]
  };

  if (type) whereClause.type = type;
  if (location) whereClause.location = location;

  const posts = await Post.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  res.json({
    success: true,
    data: {
      items: posts.rows,
      total: posts.count,
      page: parseInt(page),
      totalPages: Math.ceil(posts.count / limit)
    }
  });
}));

/**
 * @route   POST /api/posts
 * @desc    Create a new post
 * @access  Private
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { 
    title, 
    content, 
    type, 
    media, 
    location, 
    visibility, 
    tags, 
    isAnonymous, 
    commentsEnabled,
    scheduledFor,
    urgencyLevel,
    category
  } = req.body;

  // Validate required fields
  if (!content || !content.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Post content is required'
    });
  }

  // Prepare post data
  const postData = {
    author_id: req.user.id,
    title: title?.trim() || null,
    content: content.trim(),
    type: type || 'general',
    media: media || [],
    tags: tags || [],
    isAnonymous: isAnonymous || false,
    commentsEnabled: commentsEnabled !== false, // Default to true
    visibility: visibility || 'public',
    category: category || 'community',
    urgencyLevel: urgencyLevel || 'medium'
  };

  // Handle location data
  if (location) {
    if (typeof location === 'string') {
      // Simple string location
      postData.locationFormattedAddress = location;
    } else if (typeof location === 'object') {
      // Structured location object
      postData.locationCity = location.city;
      postData.locationState = location.state;
      postData.locationCountry = location.country;
      postData.locationFormattedAddress = location.formattedAddress;
      
      if (location.coordinates) {
        postData.latitude = location.coordinates.latitude;
        postData.longitude = location.coordinates.longitude;
      }
    }
  }

  // Handle scheduling
  if (scheduledFor && scheduledFor !== 'now') {
    const scheduledDate = new Date(scheduledFor);
    if (scheduledDate > new Date()) {
      postData.scheduled_for = scheduledDate;
      postData.is_scheduled = true;
    }
  }

  // Handle urgency expiration
  if (urgencyLevel === 'urgent' || urgencyLevel === 'critical') {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours for urgent posts
    postData.urgency_expires_at = expiresAt;
  }

  const post = await Post.create(postData);

  const populatedPost = await Post.findByPk(post.id, {
    include: [{
      model: User,
      as: 'author',
      attributes: ['id', 'displayName', 'username', 'avatar_url']
    }]
  });

  res.status(201).json({
    success: true,
    message: 'Post created successfully',
    data: { post: populatedPost }
  });
}));

/**
 * @route   POST /api/posts/:postId/comments
 * @desc    Add a comment to a post
 * @access  Private
 */
router.post('/:postId/comments', authenticate, validateComment, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { content, parentId } = req.body;

  // Check if post exists
  const post = await Post.findByPk(postId);
  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }

  // If this is a reply, check if parent comment exists
  if (parentId) {
    const parentComment = await Comment.findOne({
      where: { id: parentId, postId }
    });
    if (!parentComment) {
      return res.status(404).json({
        success: false,
        message: 'Parent comment not found'
      });
    }
  }

  const comment = await Comment.create({
    content,
    postId,
    author_id: req.user.id,
    parentId: parentId || null
  });

  const populatedComment = await Comment.findByPk(comment.id, {
    include: [{
      model: User,
      as: 'author',
      attributes: ['id', 'username', 'displayName', 'avatar']
    }]
  });

  // If this is a reply, notify the parent comment author
  if (parentId) {
    const parentComment = await Comment.findByPk(parentId, {
      include: [{
        model: User,
        as: 'author'
      }]
    });
    
    if (parentComment && parentComment.author.id !== req.user.id) {
      // Create notification for reply
      await Notification.createNotification({
        recipientId: parentComment.author.id,
        senderId: req.user.id,
        title: 'New Reply',
        message: `${req.user.displayName} replied to your comment`,
        type: 'post_comment',
        customData: {
          postId,
          commentId: comment.id,
          parentCommentId: parentId
        },
        actionUrl: `/posts/${postId}#comment-${comment.id}`,
        actionText: 'View Reply'
      });
    }
  } else {
    // Notify post author of new comment
    if (post.author_id !== req.user.id) {
      await Notification.createNotification({
        recipientId: post.author_id,
        senderId: req.user.id,
        title: 'New Comment',
        message: `${req.user.displayName} commented on your post`,
        type: 'post_comment',
        customData: {
          postId,
          commentId: comment.id
        },
        actionUrl: `/posts/${postId}#comment-${comment.id}`,
        actionText: 'View Comment'
      });
    }
  }

  res.status(201).json({
    success: true,
    message: 'Comment added successfully',
    data: { comment: populatedComment }
  });
}));

/**
 * @route   GET /api/posts
 * @desc    Get feed posts
 * @access  Private
 */
/**
 * @route   GET /api/posts/:postId/comments
 * @desc    Get comments for a post
 * @access  Private
 */
router.get('/:postId/comments', authenticate, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { limit = 10, page = 1, parentId } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = {
    postId,
    parentId: parentId || null // If parentId is not provided, get top-level comments
  };

  const comments = await Comment.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'displayName', 'avatar']
      },
      {
        model: Comment,
        as: 'replies',
        include: [{
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'displayName', 'avatar']
        }],
        limit: 3 // Only get first 3 replies by default
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  res.json({
    success: true,
    data: {
      comments: comments.rows,
      total: comments.count,
      page: parseInt(page),
      totalPages: Math.ceil(comments.count / limit)
    }
  });
}));

/**
 * @route   PUT /api/posts/:postId/comments/:commentId
 * @desc    Update a comment
 * @access  Private
 */
router.put('/:postId/comments/:commentId', authenticate, validateComment, asyncHandler(async (req, res) => {
  const { postId, commentId } = req.params;
  const { content } = req.body;

  const comment = await Comment.findOne({
    where: {
      id: commentId,
      postId
    }
  });

  if (!comment) {
    return res.status(404).json({
      success: false,
      message: 'Comment not found'
    });
  }

  // Check if user is the author of the comment
  if (comment.author_id !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to edit this comment'
    });
  }

  await comment.edit(content);

  const updatedComment = await Comment.findByPk(commentId, {
    include: [{
      model: User,
      as: 'author',
      attributes: ['id', 'username', 'displayName', 'avatar']
    }]
  });

  res.json({
    success: true,
    message: 'Comment updated successfully',
    data: { comment: updatedComment }
  });
}));

/**
 * @route   DELETE /api/posts/:postId/comments/:commentId
 * @desc    Delete a comment
 * @access  Private
 */
router.delete('/:postId/comments/:commentId', authenticate, asyncHandler(async (req, res) => {
  const { postId, commentId } = req.params;

  const comment = await Comment.findOne({
    where: {
      id: commentId,
      postId
    }
  });

  if (!comment) {
    return res.status(404).json({
      success: false,
      message: 'Comment not found'
    });
  }

  // Check if user is the author of the comment or the post
  const post = await Post.findByPk(postId);
  if (comment.author_id !== req.user.id && post.author_id !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this comment'
    });
  }

  await comment.softDelete();

  res.json({
    success: true,
    message: 'Comment deleted successfully'
  });
}));

/**
 * @route   POST /api/posts/:postId/comments/:commentId/like
 * @desc    Like/unlike a comment
 * @access  Private
 */
router.post('/:postId/comments/:commentId/like', authenticate, asyncHandler(async (req, res) => {
  const { postId, commentId } = req.params;

  const comment = await Comment.findOne({
    where: {
      id: commentId,
      postId
    }
  });

  if (!comment) {
    return res.status(404).json({
      success: false,
      message: 'Comment not found'
    });
  }

  await comment.addLike();

  // Notify comment author of like
  if (comment.author_id !== req.user.id) {
    await Notification.createNotification({
      recipientId: comment.author_id,
      senderId: req.user.id,
      title: 'Comment Liked',
      message: `${req.user.displayName} liked your comment`,
      type: 'post_like',
      customData: {
        postId,
        commentId
      },
      actionUrl: `/posts/${postId}#comment-${commentId}`,
      actionText: 'View Comment'
    });
  }

  res.json({
    success: true,
    message: 'Comment liked successfully',
    data: { likes: comment.likes }
  });
}));

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { type, location, limit = 10, page = 1 } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = {
    [Op.or]: [
      { visibility: 'public' },
      { author_id: req.user.id }
    ]
  };

  if (type) whereClause.type = type;
  if (location) whereClause.location = location;

  const posts = await Post.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  res.json({
    success: true,
    data: {
      posts: posts.rows,
      total: posts.count,
      page: parseInt(page),
      totalPages: Math.ceil(posts.count / limit)
    }
  });
}));

router.get('/bookmarks', authenticate, asyncHandler(async (req, res) => {
  const { limit = 10, page = 1 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const user = await User.findByPk(req.user.id);
    const posts = user.bookmarkedPosts || [];
    const total = posts.length;
    const paginatedPosts = posts.slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      data: {
        items: paginatedPosts,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching bookmarks',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/posts/user/:userId
 * @desc    Get posts by user ID
 * @access  Public
 */
router.get('/user/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const { count, rows: posts } = await Post.findAndCountAll({
      where: { 
        author_id: userId,
        status: 'active' // Only return active posts
      },
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'displayName', 'username', 'avatar_url']
        },
        {
          model: Comment,
          as: 'comments',
          include: [{
            model: User,
            as: 'author',
            attributes: ['id', 'displayName', 'username', 'avatar_url']
          }],
          limit: 2,
          order: [['createdAt', 'DESC']]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        items: posts,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user posts',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/posts/:id
 * @desc    Get post by ID
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const post = await Post.findByPk(req.params.id, {
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      },
      {
        model: Comment,
        include: [{
          model: User,
          as: 'author',
          attributes: ['id', 'displayName', 'username', 'avatar_url']
        }]
      }
    ]
  });

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }

  res.json({
    success: true,
    data: { post }
  });
}));

/**
 * @route   PUT /api/posts/:id
 * @desc    Update a post
 * @access  Private
 */
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const post = await Post.findByPk(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }

  if (post.author_id !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this post'
    });
  }

  const allowedUpdates = ['content', 'media', 'visibility'];
  const updates = Object.keys(req.body)
    .filter(key => allowedUpdates.includes(key))
    .reduce((obj, key) => {
      obj[key] = req.body[key];
      return obj;
    }, {});

  Object.assign(post, updates);
  await post.save();

  res.json({
    success: true,
    message: 'Post updated successfully',
    data: { post }
  });
}));

/**
 * @route   DELETE /api/posts/:id
 * @desc    Delete a post
 * @access  Private
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const post = await Post.findByPk(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }

  if (post.author_id !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this post'
    });
  }

  await post.destroy();

  res.json({
    success: true,
    message: 'Post deleted successfully'
  });
}));

/**
 * @route   POST /api/posts/:id/like
 * @desc    Like/Unlike a post
 * @access  Private
 */
router.post('/:id/like', authenticate, asyncHandler(async (req, res) => {
  const post = await Post.findByPk(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }

  const hasLiked = await post.hasLikedBy(req.user);
  if (hasLiked) {
    await post.removeLikedBy(req.user);
    res.json({
      success: true,
      message: 'Post unliked successfully'
    });
  } else {
    await post.addLikedBy(req.user);
    res.json({
      success: true,
      message: 'Post liked successfully'
    });
  }
}));

/**
 * @route   POST /api/posts/:id/comments
 * @desc    Add a comment to a post
 * @access  Private
 */
router.post('/:id/comments', authenticate, asyncHandler(async (req, res) => {
  const post = await Post.findByPk(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }

  const comment = await Comment.create({
    postId: post.id,
    author_id: req.user.id,
    content: req.body.content
  });

  const populatedComment = await Comment.findByPk(comment.id, {
    include: [{
      model: User,
      as: 'author',
      attributes: ['id', 'displayName', 'username', 'avatar_url']
    }]
  });

  res.status(201).json({
    success: true,
    message: 'Comment added successfully',
    data: { comment: populatedComment }
  });
}));

/**
 * @route   GET /api/posts/:id/comments
 * @desc    Get comments of a post
 * @access  Private
 */
router.get('/:id/comments', authenticate, asyncHandler(async (req, res) => {
  const { limit = 10, page = 1 } = req.query;
  const offset = (page - 1) * limit;

  const comments = await Comment.findAndCountAll({
    where: { postId: req.params.id },
    include: [{
      model: User,
      as: 'author',
      attributes: ['id', 'displayName', 'username', 'avatar_url']
    }],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  res.json({
    success: true,
    data: {
      comments: comments.rows,
      total: comments.count,
      page: parseInt(page),
      totalPages: Math.ceil(comments.count / limit)
    }
  });
}));

/**
 * @route   GET /api/posts/bookmarks
 * @desc    Get user's bookmarked posts
 * @access  Private
 */
router.get('/bookmarks', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: Post,
          as: 'bookmarkedPosts',
          include: [
            {
              model: User,
              as: 'author',
              attributes: ['id', 'displayName', 'username', 'avatar_url']
            },
            {
              model: Comment,
              as: 'comments',
              include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'displayName', 'username', 'avatar_url']
              }],
              limit: 2,
              order: [['createdAt', 'DESC']]
            }
          ],
          through: { attributes: [] },
          required: false
        }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const posts = user.bookmarkedPosts || [];
    const total = posts.length;
    const paginatedPosts = posts.slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      data: {
        items: paginatedPosts,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching bookmarks',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/posts/user/:userId
 * @desc    Get posts by user ID
 * @access  Public
 */
router.get('/user/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const { count, rows: posts } = await Post.findAndCountAll({
      where: { 
        author_id: userId,
        status: 'active'
      },
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'displayName', 'username', 'avatar_url']
        },
        {
          model: Comment,
          as: 'comments',
          include: [{
            model: User,
            as: 'author',
            attributes: ['id', 'displayName', 'username', 'avatar_url']
          }],
          limit: 2,
          order: [['createdAt', 'DESC']]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        items: posts,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user posts',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/posts/scheduled
 * @desc    Get user's scheduled posts
 * @access  Private
 */
router.get('/scheduled', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const result = await ScheduledPostsService.getUserScheduledPosts(
      req.user.id,
      limit,
      offset
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching scheduled posts',
      error: error.message
    });
  }
}));

/**
 * @route   PUT /api/posts/scheduled/:postId
 * @desc    Update a scheduled post
 * @access  Private
 */
router.put('/scheduled/:postId', authenticate, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const updateData = req.body;

  try {
    const result = await ScheduledPostsService.updateScheduledPost(
      postId,
      req.user.id,
      updateData
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating scheduled post',
      error: error.message
    });
  }
}));

/**
 * @route   DELETE /api/posts/scheduled/:postId
 * @desc    Cancel/delete a scheduled post
 * @access  Private
 */
router.delete('/scheduled/:postId', authenticate, asyncHandler(async (req, res) => {
  const { postId } = req.params;

  try {
    const result = await ScheduledPostsService.cancelScheduledPost(
      postId,
      req.user.id
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error cancelling scheduled post',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/posts/scheduled/stats
 * @desc    Get scheduled posts statistics
 * @access  Private
 */
router.get('/scheduled/stats', authenticate, asyncHandler(async (req, res) => {
  try {
    const result = await ScheduledPostsService.getScheduledPostsStats(req.user.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching scheduled posts stats',
      error: error.message
    });
  }
}));

/**
 * @route   POST /api/posts/scheduled/publish
 * @desc    Manually trigger scheduled posts publishing (admin/development)
 * @access  Private
 */
router.post('/scheduled/publish', authenticate, asyncHandler(async (req, res) => {
  try {
    // Check if user has admin privileges (you might want to add proper admin middleware)
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const result = await ScheduledPostsService.publishScheduledPosts();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error publishing scheduled posts',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/posts/scheduled/notifications
 * @desc    Get scheduled post notifications for a user
 * @access  Private
 */
router.get('/scheduled/notifications', authenticate, asyncHandler(async (req, res) => {
  try {
    const result = await ScheduledPostsService.getNotificationStats(req.user.id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting notifications',
      error: error.message
    });
  }
}));

/**
 * @route   PUT /api/posts/scheduled/notifications/read
 * @desc    Mark scheduled post notifications as read
 * @access  Private
 */
router.put('/scheduled/notifications/read', authenticate, asyncHandler(async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const result = await ScheduledPostsService.markNotificationsAsRead(req.user.id, notificationIds);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking notifications as read',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/posts/scheduled/notifications/preferences
 * @desc    Get notification preferences for scheduled posts
 * @access  Private
 */
router.get('/scheduled/notifications/preferences', authenticate, asyncHandler(async (req, res) => {
  try {
    const result = await ScheduledPostsService.getNotificationPreferences(req.user.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting notification preferences',
      error: error.message
    });
  }
}));

/**
 * @route   PUT /api/posts/scheduled/notifications/preferences
 * @desc    Update notification preferences for scheduled posts
 * @access  Private
 */
router.put('/scheduled/notifications/preferences', authenticate, asyncHandler(async (req, res) => {
  try {
    const preferences = req.body;
    const result = await ScheduledPostsService.updateNotificationPreferences(req.user.id, preferences);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating notification preferences',
      error: error.message
    });
  }
}));

export default router;
