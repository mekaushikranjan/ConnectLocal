import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Post = sequelize.define('Post', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    // Basic Information
    title: {
      type: DataTypes.STRING(200),
      allowNull: true,
      validate: {
        len: [0, 200]
      }
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 5000]
      }
    },
    type: {
      type: DataTypes.ENUM('urgent', 'event', 'news', 'general', 'help', 'sale', 'announcement'),
      defaultValue: 'general'
    },
    
    // Author Information
    authorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'author_id', // map to existing DB column
      references: {
        model: 'users',
        key: 'id'
      }
    },
    isAnonymous: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_anonymous'
    },
    
    // Media Content
    media: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    
    // Location Information
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    locationStreet: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'location_street'
    },
    locationCity: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'location_city'
    },
    locationState: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'location_state'
    },
    locationCountry: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'location_country'
    },
    locationPostalCode: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'location_postal_code'
    },
    locationFormattedAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'location_formatted_address'
    },
    microCommunityId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'micro_community_id'
    },
    cityId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'city_id'
    },
    locationRadius: {
      type: DataTypes.INTEGER,
      defaultValue: 5,
      field: 'location_radius'
    },
    
    // Categorization
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    category: {
      type: DataTypes.ENUM('community', 'events', 'marketplace', 'jobs', 'services', 'lost-found', 'recommendations', 'other'),
      defaultValue: 'community'
    },
    
    // Engagement
    reactions: {
      type: DataTypes.JSONB,
      defaultValue: {
        likes: [],
        dislikes: [],
        hearts: [],
        laughs: []
      }
    },
    
    // Comments
    commentsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'comments_count'
    },
    commentsEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'comments_enabled'
    },
    
    // Sharing & Saves
    sharesCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'shares_count'
    },
    savesCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'saves_count'
    },
    
    // Visibility & Status
    visibility: {
      type: DataTypes.ENUM('public', 'community', 'friends', 'private'),
      defaultValue: 'public'
    },
    status: {
      type: DataTypes.ENUM('active', 'archived', 'deleted', 'reported', 'hidden'),
      defaultValue: 'active'
    },
    
    // Event-specific fields
    eventData: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'event_data'
    },
    
    // Sale-specific fields
    saleData: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'sale_data'
    },
    
    // Urgency
    urgencyLevel: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      defaultValue: 'medium',
      field: 'urgency_level'
    },
    urgencyExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'urgency_expires_at'
    },
    
    // Moderation
    isReported: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_reported'
    },
    reportCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'report_count'
    },
    isReviewed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_reviewed'
    },
    reviewedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'reviewed_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reviewed_at'
    },
    moderationNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'moderation_notes'
    },
    autoModerated: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'auto_moderated'
    },
    moderation_flags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      field: 'moderation_flags'
    },
    
    // Analytics
    views: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    uniqueViews: {
      type: DataTypes.JSONB,
      defaultValue: [],
      field: 'unique_views'
    },
    clickThroughRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'click_through_rate'
    },
    engagementRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'engagement_rate'
    },
    
    // Scheduling
    scheduled_for: {
      type: DataTypes.DATE,
      allowNull: true
    },
    is_scheduled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    
    // Editing
    edit_history: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    is_edited: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    last_edited_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Boost/Promotion
    boosted_data: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    tableName: 'posts',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['author_id', 'created_at'] },
      { fields: ['micro_community_id', 'created_at'] },
      { fields: ['city_id', 'created_at'] },
      { fields: ['type', 'created_at'] },
      { fields: ['category', 'created_at'] },
      { fields: ['tags'], using: 'gin' },
      { fields: ['status', 'created_at'] },
      { fields: ['visibility', 'created_at'] },
      { fields: ['urgency_expires_at'] },
      { fields: ['created_at'] }
    ]
  });

  // Instance methods
  Post.prototype.getTotalReactions = function() {
    const reactions = this.reactions || {};
    return (reactions.likes?.length || 0) +
           (reactions.dislikes?.length || 0) +
           (reactions.hearts?.length || 0) +
           (reactions.laughs?.length || 0);
  };

  Post.prototype.getEngagementScore = function() {
    const reactions = this.getTotalReactions();
    const comments = this.commentsCount;
    const shares = this.sharesCount;
    const saves = this.savesCount;
    const views = this.views;
    
    if (views === 0) return 0;
    
    // Weighted engagement score
    return ((reactions * 1) + (comments * 2) + (shares * 3) + (saves * 1.5)) / views * 100;
  };

  Post.prototype.getTimeAgo = function() {
    const now = new Date();
    const diff = now - this.created_at;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  Post.prototype.hasUserReacted = function(userId, reactionType = 'likes') {
    const reactions = this.reactions || {};
    if (!reactions[reactionType]) return false;
    return reactions[reactionType].some(reaction => 
      reaction.user === userId.toString()
    );
  };

  Post.prototype.addReaction = async function(userId, reactionType = 'likes') {
    const reactions = this.reactions || { likes: [], dislikes: [], hearts: [], laughs: [] };
    
    // Remove existing reaction of same type
    reactions[reactionType] = reactions[reactionType].filter(
      reaction => reaction.user !== userId.toString()
    );
    
    // Remove reactions of other types from same user
    Object.keys(reactions).forEach(type => {
      if (type !== reactionType) {
        reactions[type] = reactions[type].filter(
          reaction => reaction.user !== userId.toString()
        );
      }
    });
    
    // Add new reaction
    reactions[reactionType].push({
      user: userId.toString(),
      createdAt: new Date()
    });
    
    this.reactions = reactions;
    return this.save();
  };

  Post.prototype.removeReaction = async function(userId, reactionType = 'likes') {
    const reactions = this.reactions || {};
    if (!reactions[reactionType]) return this.save();
    
    reactions[reactionType] = reactions[reactionType].filter(
      reaction => reaction.user !== userId.toString()
    );
    
    this.reactions = reactions;
    return this.save();
  };

  Post.prototype.incrementView = async function(userId, source = 'feed') {
    this.views += 1;
    
    // Add to unique views if not already viewed by this user
    const uniqueViews = this.uniqueViews || [];
    if (userId && !uniqueViews.some(view => view.user === userId.toString())) {
      uniqueViews.push({
        user: userId.toString(),
        viewedAt: new Date(),
        source
      });
      this.uniqueViews = uniqueViews;
    }
    
    return this.save({ fields: ['views', 'uniqueViews'] });
  };

  Post.prototype.isExpired = function() {
    if (this.urgency_expires_at) {
      return new Date() > this.urgency_expires_at;
    }
    return false;
  };

  Post.prototype.getForFeed = function(currentUserId) {
    const post = this.toJSON();
    
    // Add user reaction status
    if (currentUserId) {
      post.userReaction = null;
      const reactions = this.reactions || {};
      Object.keys(reactions).forEach(reactionType => {
        if (this.hasUserReacted(currentUserId, reactionType)) {
          post.userReaction = reactionType;
        }
      });
    }
    
    return post;
  };

  Post.associate = (models) => {
    Post.belongsTo(models.User, {
      foreignKey: 'author_id',
      as: 'author'
    });

    Post.hasMany(models.Comment, {
      foreignKey: 'post_id',
      as: 'comments'
    });
  };

  return Post;
};