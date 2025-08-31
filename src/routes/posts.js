import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Post, Comment, User, Notification } from '../models/index.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { validateComment } from '../middleware/validation.js';
import ScheduledPostsService from '../services/scheduledPostsService.js';
import { parseFormattedAddress } from '../utils/locationUtils.js';
import NotificationService from '../services/notificationService.js';
import { getIO } from '../socket/socketHandler.js';
import RedisService from '../services/redisService.js';

const router = express.Router();

/**
 * @swagger
 * /api/posts:
 *   get:
 *     summary: Get feed posts
 *     description: Retrieve paginated posts for the user's feed with optional filtering
 *     tags: [Posts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [general, urgent, event, announcement, lost_found, help]
 *         description: Filter posts by type
 *         example: event
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter posts by location
 *         example: Mumbai
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *             example:
 *               success: true
 *               data:
 *                 items:
 *                   - $ref: '#/components/schemas/Post'
 *                 total: 25
 *                 page: 1
 *                 totalPages: 3
 *                 hasNext: true
 *                 hasPrev: false
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  try {
    const { type, location, feedType, limit = 10, page = 1, useCache = 'true' } = req.query;
    const offset = (page - 1) * limit;
    
    // Try to get from cache first (temporarily disabled for debugging)
    if (useCache === 'true' && false) { // Disabled cache temporarily
      const cacheKey = `posts_feed_${req.user.id}_${type || 'all'}_${feedType || 'all'}_${page}_${limit}`;
      const cachedPosts = await RedisService.getCachedPostsFeed(cacheKey);
      if (cachedPosts) {
        return res.json({
          success: true,
          data: cachedPosts
        });
      }
    }

  const whereClause = {
    [Op.or]: [
      { visibility: 'public' },
      { author_id: req.user.id }
    ]
  };

  if (type) whereClause.type = type;
  
  // Enhanced location filtering based on feed type
  if (feedType === 'micro') {
    // For micro feed, show posts from the same street AND city
    const microFeedConditions = [];
    
    // Must have both street and city for micro feed
    if (req.user.location_street && req.user.location_city) {
      microFeedConditions.push({
        [Op.and]: [
          { location_street: req.user.location_street },
          { location_city: req.user.location_city }
        ]
      });
    }
    
    // If we have both street and city conditions, add them to the where clause
    if (microFeedConditions.length > 0) {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        { [Op.or]: microFeedConditions }
      ];
    }
  } else if (feedType === 'city' && req.user.location_city) {
    // For city feed, show posts from the same city
    whereClause[Op.and] = [
      ...(whereClause[Op.and] || []),
      { [Op.or]: [{ location_city: req.user.location_city }] }
    ];
  } else if (location) {
    // Fallback to simple location filtering
    whereClause.location = location;
  }

  const posts = await Post.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }
    ],
    // Don't specify attributes to include all fields by default
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  // Debug: Log the first post to see what location data we have
  if (posts.rows.length > 0) {
    const firstPost = posts.rows[0].toJSON();
    
    // Also log the raw Sequelize instance
  }

          // Debug: Check what's being sent to frontend and ensure location fields are included
    // Use the stored commentsCount field from the Post model
    const postsWithCommentCounts = posts.rows.map((post) => {
      return {
        ...post.toJSON(),
        commentsCount: post.commentsCount || 0
      };
    });

    const serializedPosts = await Promise.all(postsWithCommentCounts.map(async (postData, index) => {
      const originalPost = posts.rows[index]; // Get the original Sequelize model instance
      
      // Calculate reactions count from the JSONB reactions field
      let reactions = postData.reactions || {};
      
      // If reactions is a string, try to parse it as JSON
      if (typeof reactions === 'string') {
        try {
          reactions = JSON.parse(reactions);
        } catch (e) {
          reactions = {};
        }
      }
      
      // Calculate likes count only (not total reactions)
      const likesCount = (reactions.likes || []).length;
      const heartsCount = (reactions.hearts || []).length;
      const laughsCount = (reactions.laughs || []).length;
      const dislikesCount = (reactions.dislikes || []).length;
      const totalReactionsCount = likesCount + heartsCount + laughsCount + dislikesCount;
    
    // Check if current user has liked this post
    let userReaction = null;
    let isLiked = false;
    if (req.user && req.user.id) {
      // Check if user has liked the post
      isLiked = reactions.likes && reactions.likes.some(r => r.user === req.user.id.toString());
      
      // Check for other reactions
      Object.keys(reactions).forEach(reactionType => {
        const hasReacted = originalPost.hasUserReacted(req.user.id, reactionType);
        if (hasReacted) {
          userReaction = reactionType;
        }
      });
    }
    
    // Ensure location fields are explicitly included
    const enhancedPost = {
      ...postData,
      locationStreet: originalPost.locationStreet || postData.locationStreet,
      locationCity: originalPost.locationCity || postData.locationCity,
      locationState: originalPost.locationState || postData.locationState,
      locationCountry: originalPost.locationCountry || postData.locationCountry,
      // Return likes count only (not total reactions)
      reactions: likesCount,
      // Add user like status
      isLiked,
      // Add user reaction status for other reactions
      userReaction,
      // Ensure comment count is included
      commentsCount: postData.commentsCount || 0
    };
    


    
    return enhancedPost;
  }));

  const responseData = {
    items: serializedPosts,
    total: posts.count,
    page: parseInt(page),
    totalPages: Math.ceil(posts.count / limit)
  };

  // Cache the results
  if (useCache === 'true') {
    const cacheKey = `posts_feed_${req.user.id}_${type || 'all'}_${feedType || 'all'}_${page}_${limit}`;
    await RedisService.cachePostsFeed(cacheKey, responseData);
  }
  
  // Clear old cache entries to ensure fresh data
  try {
    const oldCacheKey = `posts_feed_${req.user.id}_${type || 'all'}_${feedType || 'all'}_${page}_${limit}`;
    await RedisService.clearCache(oldCacheKey);
  } catch (cacheError) {
    // Ignore cache clearing errors
  }

  res.json({
    success: true,
    data: responseData
  });
  } catch (error) {
    console.error('🔍 Error in main posts route:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching posts',
      error: error.message
    });
  }
}));

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: Create a new post
 *     description: Create a new community post with optional media and location
 *     tags: [Posts]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 description: Post title (optional)
 *                 example: "Community Event This Weekend"
 *               content:
 *                 type: string
 *                 description: Post content
 *                 example: "Join us for a community gathering this Saturday at the park!"
 *               type:
 *                 type: string
 *                 enum: [general, urgent, event, announcement, lost_found, help]
 *                 default: general
 *                 description: Type of post
 *                 example: event
 *               category:
 *                 type: string
 *                 enum: [community, business, safety, entertainment, education]
 *                 default: community
 *                 description: Post category
 *                 example: community
 *               visibility:
 *                 type: string
 *                 enum: [public, friends, private]
 *                 default: public
 *                 description: Post visibility
 *                 example: public
 *               media:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       format: uri
 *                     type:
 *                       type: string
 *                       enum: [image, video, document]
 *                     filename:
 *                       type: string
 *                 description: Media attachments
 *                 example: []
 *               location:
 *                 type: object
 *                 properties:
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   country:
 *                     type: string
 *                   formattedAddress:
 *                     type: string
 *                   coordinates:
 *                     type: object
 *                     properties:
 *                       latitude:
 *                         type: number
 *                       longitude:
 *                         type: number
 *                 description: Location information
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Post tags
 *                 example: ["event", "community", "weekend"]
 *               isAnonymous:
 *                 type: boolean
 *                 default: false
 *                 description: Whether to post anonymously
 *               commentsEnabled:
 *                 type: boolean
 *                 default: true
 *                 description: Whether comments are enabled
 *               urgencyLevel:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *                 default: medium
 *                 description: Urgency level for urgent posts
 *               scheduledFor:
 *                 type: string
 *                 format: date-time
 *                 description: Schedule post for future publication
 *     responses:
 *       201:
 *         description: Post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Post created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     post:
 *                       $ref: '#/components/schemas/Post'
 *       400:
 *         description: Bad request - Invalid data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: Post content is required
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
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

  try {
    // Prepare post data with correct field mappings
    const postData = {
      author_id: req.user.id,
      title: title?.trim() || null,
      content: content.trim(),
      type: type || 'general',
      media: media || [],
      tags: tags || [],
      isAnonymous: isAnonymous || false,
      commentsEnabled: commentsEnabled !== false,
      visibility: visibility || 'public',
      category: category || 'community',
      urgencyLevel: urgencyLevel || 'medium',
      // Add default values for required fields
      status: 'active',
      views: 0,
      commentsCount: 0,
      sharesCount: 0,
      savesCount: 0,
      reactions: {
        likes: [],
        dislikes: [],
        hearts: [],
        laughs: []
      }
    };



    // Handle location data with correct field mappings
    
    if (location) {
      if (typeof location === 'string') {
        // Simple string location - parse it into components
        const addressComponents = parseFormattedAddress(location);
        postData.locationStreet = addressComponents.street;
        postData.locationCity = addressComponents.city;
        postData.locationState = addressComponents.state;
        postData.locationCountry = addressComponents.country;
        postData.locationPostalCode = addressComponents.postalCode;
      } else if (typeof location === 'object') {
        // Structured location object - only store street, city, state, country
        postData.locationCity = location.city;
        postData.locationState = location.state;
        postData.locationCountry = location.country;
        postData.locationStreet = location.street;
        postData.locationPostalCode = location.postalCode;
        
        if (location.coordinates) {
          postData.latitude = location.coordinates.latitude;
          postData.longitude = location.coordinates.longitude;
        }
        
        // If we have formattedAddress but missing individual components, parse it
        if (location.formattedAddress && (!location.city || !location.state)) {
          const addressComponents = parseFormattedAddress(location.formattedAddress);
          postData.locationStreet = location.street || addressComponents.street;
          postData.locationCity = location.city || addressComponents.city;
          postData.locationState = location.state || addressComponents.state;
          postData.locationCountry = location.country || addressComponents.country;
          postData.locationPostalCode = location.postalCode || addressComponents.postalCode;
        }
      }
    } else {
      // If no location provided, use user's location data as fallback
      if (req.user.location_street || req.user.location_city) {
        postData.locationStreet = req.user.location_street;
        postData.locationCity = req.user.location_city;
        postData.locationState = req.user.location_state;
        postData.locationCountry = req.user.location_country;
        postData.latitude = req.user.location_latitude;
        postData.longitude = req.user.location_longitude;
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
    if (urgencyLevel === 'high' || urgencyLevel === 'critical') {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours for urgent posts
      postData.urgencyExpiresAt = expiresAt;
    }

    const post = await Post.create(postData);

    const populatedPost = await Post.findByPk(post.id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }]
    });

    // Handle mentions in post content and tags
    const mentionRegex = /@(\w+)/g;
    const contentMentions = content.match(mentionRegex) || [];
    const tagMentions = tags ? tags.filter(tag => tag.startsWith('@')) : [];
    const allMentions = [...contentMentions, ...tagMentions];
    
    if (allMentions.length > 0) {
      try {
        const mentionedUsernames = [...new Set(allMentions.map(m => m.substring(1)))];
        const mentionedUsers = await User.findAll({
          where: { username: { [Op.in]: mentionedUsernames } },
          attributes: ['id']
        });

        if (mentionedUsers.length > 0) {
          const mentionedUserIds = mentionedUsers.map(u => u.id);
          
          // Send notifications to mentioned users
          await NotificationService.notifyPostMention(post.id, req.user.id, mentionedUserIds);

          // Emit socket notifications for mentions
          const io = getIO();
          if (io) {
            mentionedUserIds.forEach(mentionedUserId => {
              if (mentionedUserId !== req.user.id) {
                io.to(mentionedUserId).emit('notification', {
                  type: 'post_mention',
                  title: 'You were mentioned',
                  message: `${req.user.displayName || req.user.username} mentioned you in a post`,
                  customData: {
                    postId: post.id,
                    postContent: content.substring(0, 100),
                    mentionerName: req.user.displayName || req.user.username
                  }
                });
              }
            });
          }
        }
      } catch (error) {
        console.error('Error sending mention notifications:', error);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: { post: populatedPost }
    });
  } catch (error) {
    console.error('❌ Error creating post:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create post',
      error: error.message
    });
  }
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
    userId: req.user.id,
    parentId: parentId || null
  });

  // Update post's comment count
  await post.increment('commentsCount');

  const populatedComment = await Comment.findByPk(comment.id, {
    include: [{
      model: User,
      as: 'author',
      attributes: ['id', 'username', 'displayName', 'avatar_url']
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
    
    if (parentComment && parentComment.author && parentComment.author.id && parentComment.author.id !== req.user.id) {
      // Use NotificationService instead of direct notification creation
      await NotificationService.notifyCommentReply(comment.id, req.user.id, parentId);
    }
  } else {
    // Notify post author of new comment
    if (post.author_id && post.author_id !== req.user.id) {
      // Use NotificationService instead of direct notification creation
      await NotificationService.notifyPostComment(comment.id, req.user.id, post.id);
    }
  }

  res.status(201).json({
    success: true,
    message: 'Comment added successfully',
    data: { 
      comment: {
        id: populatedComment.id,
        content: populatedComment.content || '',
        postId: populatedComment.postId,
        parentId: populatedComment.parentId,
        likesCount: populatedComment.getLikesCount ? populatedComment.getLikesCount() : 0,
        repliesCount: 0,
        createdAt: populatedComment.createdAt,
        updatedAt: populatedComment.updatedAt,
        author: {
          id: populatedComment.author.id,
          displayName: populatedComment.author.displayName || '',
          username: populatedComment.author.username || '',
          avatar_url: populatedComment.author.avatar_url || ''
        },
        replies: [],
        isLiked: populatedComment.hasUserLiked ? populatedComment.hasUserLiked(req.user.id) : false
      }
    }
  });
}));





/**
 * @route   GET /api/posts
 * @desc    Get feed posts
 * @access  Private
 */
/**
 * @route   GET /api/posts/user/:userId
 * @desc    Get posts by user ID
 * @access  Private
 */
router.get('/user/:userId', authenticate, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    // Optimized query with specific attributes and efficient joins
    const { count, rows: posts } = await Post.findAndCountAll({
      where: { 
        author_id: userId,
        status: 'active'
      },
      attributes: [
        'id', 'title', 'content', 'type', 'author_id', 'is_anonymous', 'media',
        'latitude', 'longitude', 'location_street', 'location_city', 'location_state',
        'location_country', 'location_postal_code', 'location_formatted_address',
        'micro_community_id', 'city_id', 'location_radius', 'tags', 'category',
        'reactions', 'comments_count', 'comments_enabled', 'shares_count',
        'saves_count', 'visibility', 'status', 'event_data', 'sale_data',
        'urgency_level', 'urgency_expires_at', 'is_reported', 'report_count',
        'is_reviewed', 'reviewed_by', 'reviewed_at', 'moderation_notes',
        'auto_moderated', 'moderation_flags', 'views', 'unique_views',
        'click_through_rate', 'engagement_rate', 'scheduled_for', 'is_scheduled',
        'edit_history', 'is_edited', 'last_edited_at', 'boosted_data',
        'created_at', 'updated_at'
      ],
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'displayName', 'username', 'avatar_url']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Get comment counts in a single query to avoid N+1 problem
    const postIds = posts.map(post => post.id);
    let commentCounts = {};
    
    if (postIds.length > 0) {
      const commentCountResults = await Comment.findAll({
        attributes: [
          'postId',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: {
          postId: postIds,
          status: 'active'
        },
        group: ['postId'],
        raw: true
      });
      
      commentCountResults.forEach(result => {
        commentCounts[result.postId] = parseInt(result.count);
      });
    }

    // Process posts with optimized reaction handling
    const processedPosts = posts.map(post => {
      const postData = post.toJSON();
      
      // Parse reactions if needed
      let reactions = postData.reactions || {};
      if (typeof reactions === 'string') {
        try {
          reactions = JSON.parse(reactions);
        } catch (e) {
          reactions = {};
        }
      }
      
      // Calculate likes count only (not total reactions)
      const likesCount = (reactions.likes || []).length;
      const heartsCount = (reactions.hearts || []).length;
      const laughsCount = (reactions.laughs || []).length;
      const dislikesCount = (reactions.dislikes || []).length;
      const totalReactionsCount = likesCount + heartsCount + laughsCount + dislikesCount;
      
      // Check user reaction efficiently
      let userReaction = null;
      let isLiked = false;
      if (req.user && req.user.id) {
        // Check if user has liked the post
        isLiked = reactions.likes && reactions.likes.some(r => r.user === req.user.id.toString());
        
        // Check for other reactions
        Object.keys(reactions).forEach(reactionType => {
          if (reactions[reactionType] && reactions[reactionType].some(r => r.user === req.user.id.toString())) {
            userReaction = reactionType;
          }
        });
      }
      
      return {
        ...postData,
        reactions: likesCount,
        isLiked,
        userReaction,
        commentsCount: commentCounts[post.id] || 0
      };
    });



    res.json({
      success: true,
      data: {
        items: processedPosts,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      }
    });
      } catch (error) {
      console.error('🔍 Error in user posts route:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching user posts',
        error: error.message
      });
    }
}));

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
    parentId: parentId || null, // If parentId is not provided, get top-level comments
    status: 'active' // Only get active comments
  };

  const comments = await Comment.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'displayName', 'avatar_url']
      },
      {
        model: Comment,
        as: 'replies',
        where: { status: 'active' }, // Only get active replies
        include: [{
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'displayName', 'avatar_url']
        }],
        limit: 3 // Only get first 3 replies by default
      }
    ],
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  // Add like status for each comment
  const commentsWithLikeStatus = comments.rows.map(comment => {
    const commentData = comment.toJSON();
    
    // Handle legacy likes data
    let isLiked = false;
    let likesCount = 0;
    
    try {
      isLiked = comment.hasUserLiked(req.user.id);
      likesCount = comment.getLikesCount();
    } catch (error) {
      // Fallback to safe defaults
      isLiked = false;
      likesCount = 0;
    }
    
    // Ensure content is always present and author field is properly structured
    const safeCommentData = {
      ...commentData,
      content: commentData.content || '',
      isLiked,
      likesCount,
      repliesCount: commentData.replies ? commentData.replies.length : 0,
      author: commentData.author || {
        id: '',
        displayName: '',
        username: '',
        avatar_url: ''
      }
    };
    
    return safeCommentData;
  });

  res.json({
    success: true,
    data: {
      items: commentsWithLikeStatus,
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
  if (comment.userId !== req.user.id) {
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
      attributes: ['id', 'username', 'displayName', 'avatar_url']
    }]
  });

  res.json({
    success: true,
    message: 'Comment updated successfully',
    data: { 
      comment: {
        id: updatedComment.id,
        content: updatedComment.content || '',
        postId: updatedComment.postId,
        parentId: updatedComment.parentId,
        likesCount: updatedComment.getLikesCount ? updatedComment.getLikesCount() : 0,
        repliesCount: 0,
        createdAt: updatedComment.createdAt,
        updatedAt: updatedComment.updatedAt,
        author: {
          id: updatedComment.author.id,
          displayName: updatedComment.author.displayName || '',
          username: updatedComment.author.username || '',
          avatar_url: updatedComment.author.avatar_url || ''
        },
        replies: [],
        isLiked: updatedComment.hasUserLiked ? updatedComment.hasUserLiked(req.user.id) : false
      }
    }
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
  if (comment.userId !== req.user.id && post.author_id !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this comment'
    });
  }

  await comment.softDelete();

  // Decrement post's comment count
  await post.decrement('commentsCount');

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

  // Check if user already liked the comment
  const hasLiked = comment.hasUserLiked(req.user.id);
  
  if (hasLiked) {
    // Unlike the comment
    await comment.removeLike(req.user.id);
    
    res.json({
      success: true,
      message: 'Comment unliked successfully',
      data: { 
        likes: comment.getLikesCount(),
        isLiked: false
      }
    });
  } else {
    // Like the comment
    await comment.addLike(req.user.id);

    // Notify comment author of like
    if (comment.userId !== req.user.id) {
      // Use NotificationService for comment likes
      await NotificationService.notifyCommentLike(commentId, req.user.id, comment.userId);
    }

    res.json({
      success: true,
      message: 'Comment liked successfully',
      data: { 
        likes: comment.getLikesCount(),
        isLiked: true
      }
    });
  }
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

  // Calculate reactions count for the post
  const postData = post.toJSON();
        let reactions = postData.reactions || {};
      
      // If reactions is a string, try to parse it as JSON
      if (typeof reactions === 'string') {
        try {
          reactions = JSON.parse(reactions);
        } catch (e) {
          reactions = {};
        }
      }
      
      // Calculate total reactions count (likes + hearts + laughs + dislikes)
      const likesCount = (reactions.likes || []).length;
      const heartsCount = (reactions.hearts || []).length;
      const laughsCount = (reactions.laughs || []).length;
      const dislikesCount = (reactions.dislikes || []).length;
      const totalReactionsCount = likesCount + heartsCount + laughsCount + dislikesCount;
  
  const postWithReactions = {
    ...postData,
    reactions: totalReactionsCount
  };

  res.json({
    success: true,
    data: { 
      post: {
        ...post.toJSON(),
        reactions: ((post.reactions || {}).likes || []).length
      }
    }
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
 * @route   POST /api/posts/:postId/like
 * @desc    Like/Unlike a post
 * @access  Private
 */
router.post('/:postId/like', authenticate, asyncHandler(async (req, res) => {
  const post = await Post.findByPk(req.params.postId);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }



  const hasLiked = post.hasUserReacted(req.user.id, 'likes');
  if (hasLiked) {
    await post.removeReaction(req.user.id, 'likes');
    
    // Fetch the post again to get the latest data
    const updatedPost = await Post.findByPk(req.params.postId);
    

    res.json({
      success: true,
      message: 'Post unliked successfully'
    });
  } else {
    await post.addReaction(req.user.id, 'likes');
    
      // Fetch the post again to get the latest data
    const updatedPost = await Post.findByPk(req.params.postId);
    

    
    res.json({
      success: true,
      message: 'Post liked successfully'
    });
  }
}));

/**
 * @route   POST /api/posts/:id/react
 * @desc    React to a post (like, heart, laugh, dislike)
 * @access  Private
 */
router.post('/:id/react', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reactionType } = req.body; // 'like', 'heart', 'laugh', 'dislike'

  const validReactions = ['like', 'heart', 'laugh', 'dislike'];
  if (!validReactions.includes(reactionType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid reaction type'
    });
  }

  const post = await Post.findByPk(id, {
    include: [{ model: User, as: 'author', attributes: ['id', 'displayName', 'username'] }]
  });

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }

  const userId = req.user.id;
  const reactions = post.reactions || {};

  // Check if user already reacted
  const hasReacted = reactions[reactionType]?.includes(userId);
  
  if (hasReacted) {
    // Remove reaction
    reactions[reactionType] = reactions[reactionType].filter(id => id !== userId);
  } else {
    // Add reaction
    if (!reactions[reactionType]) {
      reactions[reactionType] = [];
    }
    reactions[reactionType].push(userId);
  }

  await post.update({ reactions });

  // Send notification for new reactions (only for likes and hearts)
  if (!hasReacted && (reactionType === 'like' || reactionType === 'heart')) {
    try {
      await NotificationService.notifyPostLike(post.id, userId, post.author_id);
      
      // Emit socket notification
      const io = getIO();
      if (io) {
        io.to(post.author_id).emit('notification', {
          type: 'post_like',
          title: 'New Like',
          message: `${req.user.displayName || req.user.username} ${reactionType === 'like' ? 'liked' : 'hearted'} your post`,
          customData: {
            postId: post.id,
            postTitle: post.title || 'Post',
            likerName: req.user.displayName || req.user.username
          }
        });
      }
    } catch (error) {
      console.error('Error sending post like notification:', error);
    }
  }

  res.json({
    success: true,
    message: hasReacted ? 'Reaction removed' : 'Reaction added',
    data: { reactions: post.reactions }
  });
}));

/**
 * @route   POST /api/posts/:id/comment
 * @desc    Add a comment to a post
 * @access  Private
 */
router.post('/:id/comment', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, parentCommentId } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Comment content is required'
    });
  }

  const post = await Post.findByPk(id);
  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }

  if (!post.commentsEnabled) {
    return res.status(400).json({
      success: false,
      message: 'Comments are disabled for this post'
    });
  }

  const comment = await Comment.create({
    content: content.trim(),
    userId: req.user.id,
    postId: id,
    parentId: parentCommentId || null
  });

  const commentWithAuthor = await Comment.findByPk(comment.id, {
    include: [{ model: User, as: 'author', attributes: ['id', 'displayName', 'username'] }]
  });

  // Send notification for new comment
  try {
    if (parentCommentId) {
      // This is a reply to a comment
      await NotificationService.notifyCommentReply(comment.id, req.user.id, parentCommentId);
    } else {
      // This is a comment on the post
      await NotificationService.notifyPostComment(comment.id, req.user.id, post.id);
    }

    // Emit socket notification
    const io = getIO();
    if (io) {
      const notificationData = {
        type: 'post_comment',
        title: 'New Comment',
        message: `${req.user.displayName || req.user.username} commented on your post`,
        customData: {
          postId: post.id,
          commentId: comment.id,
          commentContent: content.substring(0, 100),
          commenterName: req.user.displayName || req.user.username
        }
      };

      if (parentCommentId) {
        // Get parent comment author
        const parentComment = await Comment.findByPk(parentCommentId, {
          include: [{ model: User, as: 'author', attributes: ['id'] }]
        });
        if (parentComment && parentComment.author.id !== req.user.id) {
          io.to(parentComment.author.id).emit('notification', {
            ...notificationData,
            title: 'New Reply',
            message: `${req.user.displayName || req.user.username} replied to your comment`
          });
        }
      } else if (post.author_id !== req.user.id) {
        // Notify post author
        io.to(post.author_id).emit('notification', notificationData);
      }
    }
  } catch (error) {
    console.error('Error sending comment notification:', error);
  }

  // Check for mentions in comment
  const mentionRegex = /@(\w+)/g;
  const mentions = content.match(mentionRegex);
  if (mentions) {
    try {
      const mentionedUsernames = mentions.map(m => m.substring(1));
      const mentionedUsers = await User.findAll({
        where: { username: { [Op.in]: mentionedUsernames } },
        attributes: ['id']
      });

      if (mentionedUsers.length > 0) {
        const mentionedUserIds = mentionedUsers.map(u => u.id);
        await NotificationService.notifyPostMention(post.id, req.user.id, mentionedUserIds);

        // Emit socket notifications for mentions
        const io = getIO();
        if (io) {
          mentionedUserIds.forEach(mentionedUserId => {
            if (mentionedUserId !== req.user.id) {
              io.to(mentionedUserId).emit('notification', {
                type: 'post_mention',
                title: 'You were mentioned',
                message: `${req.user.displayName || req.user.username} mentioned you in a comment`,
                customData: {
                  postId: post.id,
                  commentId: comment.id,
                  commentContent: content.substring(0, 100),
                  mentionerName: req.user.displayName || req.user.username
                }
              });
            }
          });
        }
      }
    } catch (error) {
      console.error('Error sending mention notifications:', error);
    }
  }

  res.status(201).json({
    success: true,
    message: 'Comment added successfully',
    data: { comment: commentWithAuthor }
  });
}));

/**
 * @route   POST /api/posts/:id/share
 * @desc    Share a post
 * @access  Private
 */
router.post('/:id/share', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const post = await Post.findByPk(id, {
    include: [{ model: User, as: 'author', attributes: ['id', 'displayName', 'username'] }]
  });

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }

  // Increment share count
  await post.update({
    sharesCount: (post.sharesCount || 0) + 1
  });

  // Send notification for post share
  try {
    await NotificationService.notifyPostShare(post.id, req.user.id, post.author_id);

    // Emit socket notification
    const io = getIO();
    if (io && post.author_id !== req.user.id) {
      io.to(post.author_id).emit('notification', {
        type: 'post_share',
        title: 'Post Shared',
        message: `${req.user.displayName || req.user.username} shared your post`,
        customData: {
          postId: post.id,
          postTitle: post.title || 'Post',
          sharerName: req.user.displayName || req.user.username
        }
      });
    }
  } catch (error) {
    console.error('Error sending post share notification:', error);
  }

  res.json({
    success: true,
    message: 'Post shared successfully',
    data: { sharesCount: post.sharesCount }
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

/**
 * @route   GET /api/posts/:postId/likes
 * @desc    Get users who liked a specific post
 * @access  Private
 */
router.get('/:postId/likes', authenticate, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Find the post
  const post = await Post.findByPk(postId);
  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found'
    });
  }

  // Get reactions from the post
  let reactions = post.reactions || {};
  
  // If reactions is a string, try to parse it as JSON
  if (typeof reactions === 'string') {
    try {
      reactions = JSON.parse(reactions);
    } catch (error) {
      reactions = {};
    }
  }

  // Get user IDs who liked the post
  const likedUserIds = reactions.likes || [];
  
  if (likedUserIds.length === 0) {
    return res.json({
      success: true,
      data: {
        users: [],
        total: 0,
        page: parseInt(page),
        totalPages: 0
      }
    });
  }

  // Get user details for the liked users with pagination
  const users = await User.findAndCountAll({
    where: {
      id: { [Op.in]: likedUserIds }
    },
    attributes: ['id', 'displayName', 'username', 'avatar_url', 'location_city', 'location_state'],
    limit: parseInt(limit),
    offset: offset,
    order: [['displayName', 'ASC']]
  });

  const transformedUsers = users.rows.map(user => ({
    id: user.id,
    displayName: user.displayName,
    username: user.username,
    avatarUrl: user.avatar_url,
    locationCity: user.location_city,
    locationState: user.location_state
  }));

  res.json({
    success: true,
    data: {
      users: transformedUsers,
      total: users.count,
      page: parseInt(page),
      totalPages: Math.ceil(users.count / parseInt(limit))
    }
  });
}));

export default router;
