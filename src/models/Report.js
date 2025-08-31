import { DataTypes, Op } from 'sequelize';

export default (sequelize) => {
  const Report = sequelize.define('Report', {
    // Reporter Information
    reported_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    reported_by_name: {
      type: DataTypes.STRING
    },
  
  // Content Being Reported
    content_type: {
      type: DataTypes.ENUM('post', 'comment', 'user', 'marketplace', 'job', 'message', 'chat'),
      allowNull: false
    },
    content_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    content_model: {
      type: DataTypes.ENUM('Post', 'Comment', 'User', 'MarketplaceItem', 'Job', 'Message', 'Chat'),
      allowNull: false
    },
  
  // Report Details
    reason: {
      type: DataTypes.ENUM(
        'spam',
        'harassment',
        'hate_speech',
        'inappropriate_content',
        'misinformation',
        'violence_threats',
        'privacy_violation',
        'scam_fraud',
        'copyright_violation',
        'fake_profile',
        'impersonation',
        'adult_content',
        'self_harm',
        'terrorism',
        'illegal_activity',
        'other'
      ),
      allowNull: false
    },
    description: {
      type: DataTypes.STRING(1000)
    },
  
  // Evidence
    evidence: {
      type: DataTypes.JSONB,
      defaultValue: [],
      get() {
        const rawValue = this.getDataValue('evidence');
        return rawValue || [];
      }
    },
  
  // Report Status
    status: {
      type: DataTypes.ENUM('pending', 'under_review', 'escalated', 'resolved', 'dismissed', 'duplicate'),
      defaultValue: 'pending'
    },
    
    // Priority
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      defaultValue: 'medium'
    },
  
  // Moderation Information
    assigned_to: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    reviewed_by: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    reviewed_at: {
      type: DataTypes.DATE
    },
  
  // Resolution
    resolution_action: {
      type: DataTypes.ENUM(
        'no_action',
        'content_removed',
        'content_hidden',
        'user_warned',
        'user_suspended',
        'user_banned',
        'content_edited',
        'age_restricted',
        'other'
      )
    },
    resolution_reason: DataTypes.STRING,
    resolution_details: DataTypes.TEXT,
    action_taken_at: DataTypes.DATE,
    action_taken_by: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id'
      }
    },
  
  // Appeal Information
    is_appealed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    appealed_at: DataTypes.DATE,
    appealed_by: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    appeal_reason: DataTypes.TEXT,
    appeal_status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected')
    },
    appeal_reviewed_by: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    appeal_reviewed_at: DataTypes.DATE,
    appeal_resolution: DataTypes.TEXT,
  
  // Communication
    communications: {
      field: 'communications',
      type: DataTypes.JSONB,
      defaultValue: [],
      get() {
        const rawValue = this.getDataValue('communications');
        return rawValue || [];
      }
    },
  
  // Related Reports
    duplicate_of: {
      type: DataTypes.INTEGER,
      references: {
        model: 'reports',
        key: 'id'
      }
    },
    
    // Automated Detection
    is_auto_detected: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    detection_method: DataTypes.STRING,
    confidence: DataTypes.FLOAT,
    detected_at: DataTypes.DATE,
    
    // Content Snapshot
    content_snapshot: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    
    // Location Information
    location: {
      type: DataTypes.JSONB,
      defaultValue: null
    },
    
    // Tags
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    
    // Internal Notes
    internalNotes: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    
    // Metrics
    response_time_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    resolution_time_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    escalation_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    view_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    
    // Notification Settings
    reporter_notified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    content_owner_notified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    last_notification_sent: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'Report',
    tableName: 'reports',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['reported_by', 'created_at'] },
      { fields: ['content_type', 'content_id'] },
      { fields: ['status', 'priority', 'created_at'] },
      { fields: ['assigned_to', 'status'] },
      { fields: ['reviewed_by', 'reviewed_at'] },
      { fields: ['reason', 'status'] },
      { fields: ['is_auto_detected'] },
      { fields: ['duplicate_of'] }
    ]
  });

  // Instance methods
  Report.prototype.get_age_in_hours = function() {
    return Math.floor((new Date() - this.created_at) / (1000 * 60 * 60));
  };

  Report.prototype.isOverdue = function() {
    const slaHours = {
      'critical': 2,
      'high': 8,
      'medium': 24,
      'low': 72
    };
    
    const maxHours = slaHours[this.priority] || 24;
    return this.status === 'pending' && this.get_age_in_hours() > maxHours;
  };

  Report.prototype.getFormattedPriority = function() {
    return this.priority.charAt(0).toUpperCase() + this.priority.slice(1);
  };
  Report.prototype.assignTo = async function(moderatorId) {
    this.assigned_to = moderatorId;
    this.status = 'under_review';
    
    // Add internal note
    const notes = [...(this.internal_notes || [])];
    notes.push({
      note: `Report assigned to moderator`,
      addedBy: moderatorId,
      addedAt: new Date()
    });
    this.internal_notes = notes;
    
    return this.save();
  };

  Report.prototype.escalate = async function(escalatedBy, reason) {
    this.status = 'escalated';
    this.priority = this.priority === 'critical' ? 'critical' : 
                    this.priority === 'high' ? 'critical' : 'high';
    this.escalationCount += 1;
    
    // Add internal note
      const notes = [...(this.internal_notes || [])];
    notes.push({
      note: `Report escalated: ${reason}`,
      addedBy: escalatedBy,
      addedAt: new Date()
    });
    this.internal_notes = notes;
    
    return this.save();
  };

  Report.prototype.resolve = async function(resolvedBy, action, reason, details) {
    this.status = 'resolved';
    this.reviewed_by = resolvedBy;
    this.reviewed_at = new Date();
    
    this.resolution_action = action;
    this.resolution_reason = reason;
    this.resolution_details = details;
    this.action_taken_at = new Date();
    this.action_taken_by = resolvedBy;
    
    // Calculate resolution time
    this.resolution_time_minutes = Math.floor((new Date() - this.created_at) / (1000 * 60));
    
    return this.save();
  };

  Report.prototype.dismiss = async function(dismissedBy, reason) {
    this.status = 'dismissed';
    this.reviewed_by = dismissedBy;
    this.reviewed_at = new Date();
    
    this.resolution_action = 'no_action';
    this.resolution_reason = reason;
    this.action_taken_at = new Date();
    this.action_taken_by = dismissedBy;
    
    // Calculate resolution time
    this.resolution_time_minutes = Math.floor((new Date() - this.created_at) / (1000 * 60));
    
    return this.save();
  };

  Report.prototype.markAsDuplicate = async function(originalReportId, markedBy) {
    this.status = 'duplicate';
    this.duplicate_of = originalReportId;
    this.reviewed_by = markedBy;
    this.reviewed_at = new Date();
    
    return this.save();
  };

  Report.prototype.addCommunication = async function(from, to, message, isInternal = false) {
    const communications = [...(this.communications || [])];
    communications.push({
      from,
      to,
      message,
      isInternal,
      sent_at: new Date()
    });
    this.communications = communications;
    
    return this.save();
  };

  Report.prototype.addInternalNote = async function(note, addedBy) {
    const notes = [...(this.internal_notes || [])];
    notes.push({
      note,
      addedBy,
      addedAt: new Date()
    });
    this.internal_notes = notes;
    
    return this.save();
  };

  Report.prototype.fileAppeal = async function(appealedBy, appealReason) {
    this.isAppealed = true;
    this.appealed_at = new Date();
    this.appealed_by = appealedBy;
    this.appeal_reason = appealReason;
    this.appealStatus = 'pending';
    
    return this.save();
  };

  Report.prototype.reviewAppeal = async function(reviewedBy, status, resolution) {
    this.appealStatus = status;
    this.appeal_reviewed_by = reviewedBy;
    this.appeal_reviewed_at = new Date();
    this.appeal_resolution = resolution;
    
    // If appeal is approved, revert the original action
    if (status === 'approved') {
      this.status = 'resolved';
      this.resolution_action = 'no_action';
      this.resolution_reason = 'Appeal approved - original action reverted';
    }
    
    return this.save();
  };

  Report.prototype.incrementView = async function() {
    this.view_count += 1;
    return this.save();
  };

  // Static methods
  Report.findSimilarReports = async function(contentType, contentId, reason, timeWindow = 24) {
    const startTime = new Date(Date.now() - timeWindow * 60 * 60 * 1000);
    
    return await this.findAll({
      where: {
        contentType,
        contentId,
        reason,
        created_at: { [Op.gte]: startTime },
        status: { [Op.ne]: 'duplicate' }
      },
      order: [['created_at', 'DESC']]
    });
  };

  Report.getReportsByStatus = async function(status, options = {}) {
    const where = { status };
    
    if (options.priority) where.priority = options.priority;
    if (options.assignedTo) where.assignedTo = options.assignedTo;
    if (options.contentType) where.contentType = options.contentType;
    
    return await this.findAll({
      where,
      include: [
        {
          model: sequelize.models.User,
          as: 'reporter',
          attributes: ['displayName', 'username', 'avatar_url']
        },
        {
          model: sequelize.models.User,
          as: 'assignedModerator',
          attributes: ['displayName', 'username']
        },
        {
          model: sequelize.models.User,
          as: 'reviewer',
          attributes: ['displayName', 'username']
        }
      ],
      order: [
        ['priority', 'DESC'],
        ['created_at', 'DESC']
      ],
      limit: options.limit,
      offset: options.skip
    });
  };

  Report.getOverdueReports = async function() {
    const now = new Date();
    const criticalThreshold = new Date(now - 2 * 60 * 60 * 1000);  // 2 hours
    const highThreshold = new Date(now - 8 * 60 * 60 * 1000);      // 8 hours
    const mediumThreshold = new Date(now - 24 * 60 * 60 * 1000);   // 24 hours
    const lowThreshold = new Date(now - 72 * 60 * 60 * 1000);      // 72 hours
    
    return await this.findAll({
      where: {
        status: 'pending',
        [Op.or]: [
          { priority: 'critical', created_at: { [Op.lt]: criticalThreshold } },
          { priority: 'high', created_at: { [Op.lt]: highThreshold } },
          { priority: 'medium', created_at: { [Op.lt]: mediumThreshold } },
          { priority: 'low', created_at: { [Op.lt]: lowThreshold } }
        ]
      },
      include: [{
        model: sequelize.models.User,
        as: 'reporter',
        attributes: ['displayName', 'username']
      }]
    });
  };

  Report.getReportStats = async function(days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const [results] = await sequelize.query(`
      SELECT
        COUNT(*) as "totalReports",
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as "pendingReports",
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as "resolvedReports",
        COUNT(CASE WHEN status = 'dismissed' THEN 1 END) as "dismissedReports",
        AVG("resolution_time_minutes") as "avgResolutionTime",
        ARRAY_AGG(DISTINCT reason) as "reportsByReason",
        ARRAY_AGG(DISTINCT "contentType") as "reportsByType"
      FROM reports
      WHERE "created_at" >= :startDate
    `, {
      replacements: { startDate },
      type: sequelize.QueryTypes.SELECT
    });
    
    return results;
  };

  // Hooks
  Report.beforeCreate(async (report, options) => {
    if (!report.content_snapshot.content) {
      try {
        const content = await sequelize.models[report.contentModel].findByPk(report.content_id);
        
        if (content) {
          report.content_snapshot = {
            title: content.title,
            content: content.content || content.description || content.message,
            author: content.author?.id || content.seller?.id || content.postedBy?.id || content.sender?.id,
            authorName: content.authorName,
            created_at: content.created_at,
            metadata: {
              type: content.type,
              category: content.category,
              status: content.status
            }
          };
        }
      } catch (error) {
        // Error capturing content snapshot
      }
    }
  },
  {
    hooks: {
      beforeCreate: async (report, options) => {
        if (!report.content_snapshot.content) {
          try {
            const content = await sequelize.models[report.contentModel].findByPk(report.content_id);
            
            if (content) {
              report.content_snapshot = {
                title: content.title,
                content: content.content || content.description || content.message,
                author: content.author?.id || content.seller?.id || content.postedBy?.id || content.sender?.id,
                authorName: content.authorName,
                createdAt: content.createdAt,
                metadata: {
                  type: content.type,
                  category: content.category,
                  status: content.status
                }
              };
            }
          } catch (error) {
            // Error capturing content snapshot
          }
        }
      }
    }
  });

  Report.associate = (models) => {
    Report.belongsTo(models.User, { as: 'reporter', foreignKey: 'reported_by' });
    Report.belongsTo(models.User, { as: 'assignedModerator', foreignKey: 'assigned_to' });
    Report.belongsTo(models.User, { as: 'reviewer', foreignKey: 'reviewed_by' });
    Report.hasMany(Report, { as: 'relatedReports', foreignKey: 'duplicate_of' });
  };

  return Report;
};
