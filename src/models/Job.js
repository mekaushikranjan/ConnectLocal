import { DataTypes, Op } from 'sequelize';

export default (sequelize) => {
  const Job = sequelize.define('Job', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [0, 5000]
    }
  },
  
  // Company Information
  companyData: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
    validate: {
      hasRequiredFields(value) {
        if (!value.name) {
          throw new Error('Company name is required');
        }
      }
    }
  },
  // Virtual field for backward compatibility
  company: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.companyData?.name || 'Unknown Company';
    }
  },
  
  // Job Details
  type: {
    type: DataTypes.ENUM('full-time', 'part-time', 'contract', 'freelance', 'internship', 'temporary', 'volunteer'),
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM(
      'technology', 'healthcare', 'education', 'finance', 'marketing',
      'sales', 'design', 'engineering', 'operations', 'hr', 'legal',
      'consulting', 'retail', 'hospitality', 'construction', 'other'
    ),
    allowNull: false
  },
  
  // Location Information
  // Use JSONB to avoid PostGIS dependency. Store GeoJSON Point: { type: 'Point', coordinates: [lng, lat] }
  coordinates: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  address: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  // Virtual field for backward compatibility
  location: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.address?.city || this.address?.state || 'Location not specified';
    }
  },
  microCommunityId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cityId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  locationType: {
    type: DataTypes.ENUM('on-site', 'remote', 'hybrid'),
    allowNull: false
  },
  
  // Compensation
  salaryMin: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  salaryMax: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  salaryCurrency: {
    type: DataTypes.STRING(3),
    defaultValue: 'INR'
  },
  salaryPeriod: {
    type: DataTypes.ENUM('hourly', 'daily', 'weekly', 'monthly', 'yearly'),
    defaultValue: 'monthly'
  },
  salaryNegotiable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  
  // Requirements
  requirements: {
    type: DataTypes.JSONB,
    defaultValue: {
      education: {
        level: null,
        field: null,
        required: false
      },
      experience: {
        min: 0,
        max: null,
        level: null
      },
      skills: {
        required: [],
        preferred: []
      },
      languages: [],
      certifications: [],
      other: []
    },
    validate: {
      hasRequiredFields(value) {
        if (!value.experience || !value.experience.level) {
          throw new Error('Experience level is required');
        }
      }
    }
  },
  
  // Benefits & Perks
  benefits: {
    type: DataTypes.JSONB,
    defaultValue: {
      health: false,
      dental: false,
      vision: false,
      retirement: false,
      paidTimeOff: false,
      flexibleSchedule: false,
      remoteWork: false,
      professionalDevelopment: false,
      stockOptions: false,
      bonuses: false,
      other: []
    }
  },
  
  // Application Information
  applicationMethod: {
    type: DataTypes.ENUM('internal', 'external', 'email'),
    defaultValue: 'internal'
  },
  applicationExternalUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  applicationEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  applicationInstructions: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Posting Information
  postedById: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'posted_by_id', // Ensures correct DB mapping
    references: {
      model: 'users',
      key: 'id'
    }
  },
  contactPerson: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  
  // Status & Visibility
  status: {
    type: DataTypes.ENUM('active', 'paused', 'closed', 'draft', 'expired'),
    defaultValue: 'active'
  },
  visibility: {
    type: DataTypes.ENUM('public', 'community', 'private'),
    defaultValue: 'public'
  },
  
  // Timing
  applicationDeadline: {
    type: DataTypes.DATE,
    allowNull: true
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  durationValue: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  durationUnit: {
    type: DataTypes.ENUM('days', 'weeks', 'months', 'years'),
    allowNull: true
  },
  
  // Applications
  applicationsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  maxApplications: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  
  // Engagement
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  
  // Matching & Recommendations
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  matchingScore: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  
  // Promotion
  isFeatured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  featuredUntil: {
    type: DataTypes.DATE,
    allowNull: true
  },
  featuredById: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  
  // Moderation
  moderation_jsonb: {
    type: DataTypes.JSONB,
    defaultValue: {
      isReported: false,
      reportCount: 0,
      isReviewed: false,
      reviewedBy: null,
      reviewedAt: null,
      flags: []
    }
  },
  
  // Analytics
  analytics_jsonb: {
    type: DataTypes.JSONB,
    defaultValue: {
      impressions: 0,
      clicks: 0,
      applications: 0,
      conversionRate: 0,
      sources: []
    }
  }
}, {
  sequelize,
  modelName: 'Job',
  tableName: 'jobs',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: [{ attribute: 'posted_by_id' }, { attribute: 'created_at' }] },
    { fields: [{ attribute: 'micro_community_id' }, { attribute: 'created_at' }] },
    { fields: [{ attribute: 'city_id' }, { attribute: 'created_at' }] },
    { fields: [{ attribute: 'type' }, { attribute: 'status' }] },
    { fields: [{ attribute: 'category' }, { attribute: 'status' }] },
    { fields: [{ attribute: 'status' }, { attribute: 'created_at' }] },
    { fields: [{ attribute: 'application_deadline' }] },
    { fields: [{ attribute: 'is_featured' }, { attribute: 'featured_until' }] },
    { fields: [{ attribute: 'tags' }] }
  ]
});

// Instance methods
Job.prototype.getFormattedSalary = function() {
  if (!this.salaryMin && !this.salaryMax) return 'Not specified';
  
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: this.salaryCurrency,
    maximumFractionDigits: 0
  });
  
  if (this.salaryMin && this.salaryMax) {
    return `${formatter.format(this.salaryMin)} - ${formatter.format(this.salaryMax)} per ${this.salaryPeriod}`;
  } else if (this.salaryMin) {
    return `From ${formatter.format(this.salaryMin)} per ${this.salaryPeriod}`;
  } else if (this.salaryMax) {
    return `Up to ${formatter.format(this.salaryMax)} per ${this.salaryPeriod}`;
  }
  
  return 'Not specified';
};

Job.prototype.getTimeAgo = function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
};

Job.prototype.getDeadlineStatus = function() {
  if (!this.applicationDeadline) return 'open';
  
  const now = new Date();
  const deadline = new Date(this.applicationDeadline);
  const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  
  if (daysLeft < 0) return 'expired';
  if (daysLeft === 0) return 'today';
  if (daysLeft <= 3) return 'urgent';
  if (daysLeft <= 7) return 'soon';
  return 'open';
};

Job.prototype.isSavedByUser = async function(userId) {
  const JobSave = this.sequelize.models.JobSave;
  const save = await JobSave.findOne({
    where: {
      jobId: this.id,
      userId: userId
    }
  });
  return !!save;
};

Job.prototype.toggleSave = async function(userId) {
  const JobSave = this.sequelize.models.JobSave;
  const [save, created] = await JobSave.findOrCreate({
    where: {
      jobId: this.id,
      userId: userId
    },
    defaults: {
      savedAt: new Date()
    }
  });
  
  if (!created) {
    await save.destroy();
  }
  
  return this;
};

Job.prototype.incrementView = async function() {
  this.views += 1;
  const analytics = this.analytics_jsonb || {};
  analytics.impressions += 1;
  this.analytics_jsonb = analytics;
  return this.save({ validate: false });
};

Job.prototype.isExpired = function() {
  if (this.applicationDeadline) {
    return new Date() > this.applicationDeadline;
  }
  return false;
};

Job.prototype.calculateMatchingScore = function(userProfile) {
  let score = 0;
  let maxScore = 0;
  
  // Location match (30 points)
  maxScore += 30;
  if (this.locationType === 'remote') {
    score += 30;
  } else if (userProfile.location && this.coordinates) {
    const distance = calculateDistance(
      userProfile.location.coordinates[1],
      userProfile.location.coordinates[0],
      this.coordinates.coordinates[1],
      this.coordinates.coordinates[0]
    );
    
    if (distance <= 5) score += 30;
    else if (distance <= 15) score += 20;
    else if (distance <= 30) score += 10;
  }
  
  // Skills match (40 points)
  maxScore += 40;
  const requirements = this.requirements;
  if (userProfile.skills && requirements.skills.required.length > 0) {
    const matchingSkills = userProfile.skills.filter(skill =>
      requirements.skills.required.some(reqSkill =>
        reqSkill.toLowerCase().includes(skill.toLowerCase()) ||
        skill.toLowerCase().includes(reqSkill.toLowerCase())
      )
    );
    
    const skillMatchPercentage = matchingSkills.length / requirements.skills.required.length;
    score += Math.round(skillMatchPercentage * 40);
  }
  
  // Experience match (20 points)
  maxScore += 20;
  if (userProfile.experience) {
    const userExp = userProfile.experience.years || 0;
    const minExp = requirements.experience.min || 0;
    const maxExp = requirements.experience.max || 100;
    
    if (userExp >= minExp && userExp <= maxExp) {
      score += 20;
    } else if (userExp >= minExp) {
      score += 15;
    } else if (userExp >= minExp - 1) {
      score += 10;
    }
  }
  
  // Education match (10 points)
  maxScore += 10;
  if (userProfile.education && requirements.education.level) {
    const educationLevels = ['high-school', 'diploma', 'bachelors', 'masters', 'phd'];
    const userLevel = educationLevels.indexOf(userProfile.education.level);
    const reqLevel = educationLevels.indexOf(requirements.education.level);
    
    if (userLevel >= reqLevel) {
      score += 10;
    } else if (userLevel >= reqLevel - 1) {
      score += 5;
    }
  }
  
  return Math.round((score / maxScore) * 100);
};

// Static methods
Job.findByLocation = async function(longitude, latitude, radiusInKm = 50, options = {}) {
  const where = {
    status: 'active'
  };
  
  if (options.type) where.type = options.type;
  if (options.category) where.category = options.category;
  if (options.locationType) where.locationType = options.locationType;
  if (options.experienceLevel) where.requirements = sequelize.literal(`requirements->>'experience.level' = '${options.experienceLevel}'`);
  
  return this.findAll({
    where: {
      ...where,
      coordinates: sequelize.literal(`ST_DWithin(coordinates, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326), ${radiusInKm * 1000})`)
    },
    include: [{
      model: this.sequelize.models.User,
      as: 'postedBy',
      attributes: ['displayName', 'username', 'profile', 'company']
    }],
    order: [['isFeatured', 'DESC'], ['createdAt', 'DESC']]
  });
};

Job.searchJobs = async function(searchTerm, filters = {}) {
  const where = {
    status: 'active'
  };
  
  if (filters.type) where.type = filters.type;
  if (filters.category) where.category = filters.category;
  if (filters.locationType) where.locationType = filters.locationType;
  if (filters.experienceLevel) where.requirements = sequelize.literal(`requirements->>'experience.level' = '${filters.experienceLevel}'`);
  if (filters.salaryMin) where.salaryMin = { [Op.gte]: filters.salaryMin };
  if (filters.salaryMax) where.salaryMax = { [Op.lte]: filters.salaryMax };
  
  return this.findAll({
    where: {
      ...where,
      [Op.or]: [
        { title: { [Op.iLike]: `%${searchTerm}%` } },
        { description: { [Op.iLike]: `%${searchTerm}%` } },
        sequelize.literal(`requirements->'skills'->'required' ? '${searchTerm}'`),
        sequelize.literal(`requirements->'skills'->'preferred' ? '${searchTerm}'`)
      ]
    },
    include: [{
      model: this.sequelize.models.User,
      as: 'postedBy',
      attributes: ['displayName', 'username', 'profile', 'company']
    }],
    order: [['isFeatured', 'DESC'], ['createdAt', 'DESC']]
  });
};

// Helper function to calculate distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

Job.associate = (models) => {
    Job.belongsTo(models.User, { 
      foreignKey: 'posted_by_id',
      as: 'postedBy'
    });
    Job.belongsToMany(models.User, {
      through: 'JobSaves',
      foreignKey: 'jobId',
      as: 'savedByUsers'
    });
  };

  return Job;
}