export default (sequelize, DataTypes) => {
  const JobApplication = sequelize.define('JobApplication', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    // Job and Applicant References
    jobId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'job_id',
      references: {
        model: 'jobs',
        key: 'id'
      }
    },
    applicantId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'applicant_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    
    // Application Details
    coverLetter: {
      type: DataTypes.TEXT,
      validate: {
        len: [0, 2000]
      }
    },
  
    // Resume/CV
    resume: {
      type: DataTypes.JSONB,
      defaultValue: {
        url: null,
        publicId: null,
        filename: null,
        uploadedAt: null
      }
    },
    
    // Additional Documents
    documents: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    
    // Application Status
    status: {
      type: DataTypes.ENUM('pending', 'reviewing', 'shortlisted', 'interviewed', 'offered', 'accepted', 'rejected', 'withdrawn'),
      defaultValue: 'pending'
    },
  
    // Status History
    statusHistory: {
      type: DataTypes.JSONB,
      defaultValue: [],
      field: 'status_history'
    },
    
    // Employer Notes
    employerNotes: {
      type: DataTypes.JSONB,
      defaultValue: [],
      field: 'employer_notes'
    },
    
    // Interview Information
    interviews: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
  
    // Offer Details
    offer: {
      type: DataTypes.JSONB,
      defaultValue: null
    },
    
    // Matching Score
    matchingScore: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'matching_score',
      validate: {
        min: 0,
        max: 100
      }
    },
    
    // Application Source
    source: {
      type: DataTypes.ENUM('direct', 'search', 'recommendation', 'referral', 'social'),
      defaultValue: 'direct'
    },
    
    // Referral Information
    referral: {
      type: DataTypes.JSONB,
      defaultValue: null
    },
    
    // Communication
    messages: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    
    // Questionnaire Responses
    questionnaire: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    
    // Analytics
    analytics_jsonb: {
      type: DataTypes.JSONB,
      defaultValue: {
        viewedAt: null,
        timeSpentOnApplication: null,
        deviceType: null,
        browserInfo: null,
        ipAddress: null
      }
    },
    
    // Withdrawal
    withdrawal_jsonb  : {
      type: DataTypes.JSONB,
      defaultValue: null
    }
  }, {
  tableName: 'job_applications',
  timestamps: true,
  underscored: true,
  indexes: [
      { unique: true, fields: ['job_id', 'applicant_id'] },
      { fields: ['job_id', 'status', 'created_at'] },
      { fields: ['applicant_id', 'status', 'created_at'] },
      { fields: ['status', 'created_at'] },
      { fields: ['matching_score'] },
      { fields: ['offer'] }
    ]
  });

  // Virtual getters
  Object.defineProperty(JobApplication.prototype, 'currentInterview', {
    get() {
      if (!this.interviews) return null;
      return this.interviews
        .filter(interview => interview.status === 'scheduled')
        .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0];
    }
  });

  Object.defineProperty(JobApplication.prototype, 'applicationAge', {
    get() {
      const now = new Date();
      const diff = now - this.createdAt;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (days === 0) return 'Today';
      if (days === 1) return '1 day ago';
      if (days < 7) return `${days} days ago`;
      if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
      return `${Math.floor(days / 30)} months ago`;
    }
  });

  Object.defineProperty(JobApplication.prototype, 'offerStatus', {
    get() {
      if (!this.offer || this.status !== 'offered') return null;
      
      if (this.offer.acceptedAt) return 'accepted';
      if (this.offer.rejectedAt) return 'rejected';
      if (this.offer.offerExpiresAt && new Date() > this.offer.offerExpiresAt) return 'expired';
      return 'pending';
    }
  });

  // Instance Methods
  JobApplication.prototype.updateStatus = async function(newStatus, changedBy, notes) {
    this.status = newStatus;
    
    const statusHistory = this.status_history || [];
    statusHistory.push({
      status: newStatus,
      changedAt: new Date(),
      changedBy,
      notes
    });
    this.status_history = statusHistory;
    
    return this.save();
  };

  JobApplication.prototype.addEmployerNote = async function(note, addedBy, isPrivate = true) {
    const employerNotes = this.employer_notes || [];
    employerNotes.push({
      note,
      addedBy,
      addedAt: new Date(),
      isPrivate
    });
    this.employer_notes = employerNotes;
    
    return this.save();
  };

  JobApplication.prototype.scheduleInterview = async function(interviewData) {
    const interviews = this.interviews || [];
    interviews.push({
      ...interviewData,
      createdAt: new Date()
    });
    this.interviews = interviews;
    
    if (this.status === 'pending' || this.status === 'reviewing') {
      this.status = 'shortlisted';
    }
    
    return this.save();
  };

  JobApplication.prototype.addInterviewFeedback = async function(interviewId, feedback) {
    const interviews = this.interviews || [];
    const interviewIndex = interviews.findIndex(i => i.id === interviewId);
    
    if (interviewIndex !== -1) {
      interviews[interviewIndex].feedback = feedback;
      interviews[interviewIndex].status = 'completed';
      this.interviews = interviews;
    }
    
    return this.save();
  };

  JobApplication.prototype.makeOffer = async function(offerData) {
    this.offer = {
      ...offerData,
      offerExpiresAt: offerData.offerExpiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
    
    this.status = 'offered';
    
    const statusHistory = this.status_history || [];
    statusHistory.push({
      status: 'offered',
      changedAt: new Date(),
      notes: 'Offer made'
    });
    this.status_history = statusHistory;
    
    return this.save();
  };

  JobApplication.prototype.acceptOffer = async function() {
    if (this.status !== 'offered' || !this.offer) {
      throw new Error('No valid offer to accept');
    }
    
    this.offer = {
      ...this.offer,
      acceptedAt: new Date()
    };
    this.status = 'accepted';
    
    const statusHistory = this.status_history || [];
    statusHistory.push({
      status: 'accepted',
      changedAt: new Date(),
      notes: 'Offer accepted by candidate'
    });
    this.status_history = statusHistory;
    
    return this.save();
  };

  JobApplication.prototype.rejectOffer = async function(reason) {
    if (this.status !== 'offered' || !this.offer) {
      throw new Error('No valid offer to reject');
    }
    
    this.offer = {
      ...this.offer,
      rejectedAt: new Date(),
      rejectionReason: reason
    };
    this.status = 'rejected';
    
    const statusHistory = this.status_history || [];
    statusHistory.push({
      status: 'rejected',
      changedAt: new Date(),
      notes: `Offer rejected: ${reason}`
    });
    this.status_history = statusHistory;
    
    return this.save();
  };

  JobApplication.prototype.withdraw = async function(reason, feedback) {
    this.status = 'withdrawn';
    this.withdrawal_jsonb = {
      withdrawnAt: new Date(),
      reason,
      feedback
    };
    
    const statusHistory = this.status_history || [];
    statusHistory.push({
      status: 'withdrawn',
      changedAt: new Date(),
      notes: `Application withdrawn: ${reason}`
    });
    this.status_history = statusHistory;
    
    return this.save();
  };

  JobApplication.prototype.sendMessage = async function(from, to, subject, message, attachments = []) {
    const messages = this.messages || [];
    messages.push({
      from,
      to,
      subject,
      message,
      attachments,
      sentAt: new Date()
    });
    this.messages = messages;
    
    return this.save();
  };

  JobApplication.prototype.markMessageAsRead = async function(messageId) {
    const messages = this.messages || [];
    const messageIndex = messages.findIndex(m => m.id === messageId);
    
    if (messageIndex !== -1 && !messages[messageIndex].readAt) {
      messages[messageIndex].readAt = new Date();
      this.messages = messages;
      return this.save();
    }
    
    return this;
  };

  // Class Methods
  JobApplication.findByJob = async function(jobId, filters = {}) {
    const where = { jobId };
    
    if (filters.status) where.status = filters.status;
    if (filters.minScore) where.matchingScore = { [Op.gte]: filters.minScore };
    
    return this.findAll({
      where,
      include: [{
        model: sequelize.models.User,
        as: 'applicant',
        attributes: ['displayName', 'username', 'email', 'profile']
      }],
      order: [
        ['matchingScore', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });
  };

  JobApplication.findByApplicant = async function(applicantId, filters = {}) {
    const where = { applicantId };
    
    if (filters.status) where.status = filters.status;
    
    return this.findAll({
      where,
      include: [{
        model: sequelize.models.Job,
        as: 'job',
        attributes: ['title', 'company', 'location', 'salary', 'type', 'status']
      }],
      order: [['createdAt', 'DESC']]
    });
  };

  // Hooks
  JobApplication.beforeCreate(async (application) => {
    if (!application.matchingScore) {
      try {
        const job = await sequelize.models.Job.findByPk(application.jobId);
        const applicant = await sequelize.models.User.findByPk(application.applicantId);
        
        if (job && applicant) {
          application.matchingScore = await job.calculateMatchingScore(applicant.profile);
        }
      } catch (error) {
        // Error calculating matching score
      }
    }
  });

  JobApplication.afterCreate(async (application) => {
    try {
      await sequelize.models.Job.increment('applicationsCount', {
        where: { id: application.jobId }
      });
    } catch (error) {
      // Error updating job applications count  
    }
  });

  // Associations
  JobApplication.associate = (models) => {
    JobApplication.belongsTo(models.Job, {
      foreignKey: 'job_id',
      as: 'job'
    });
    
    JobApplication.belongsTo(models.User, {
      foreignKey: 'applicant_id',
      as: 'applicant'
    });
  };

  return JobApplication;
};