import bcrypt from 'bcryptjs';

export default (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    // Basic Information
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      },
      set(value) {
        this.setDataValue('email', value.toLowerCase().trim());
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [6, 255]
      }
    },
    displayName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 50]
      },
      set(value) {
        this.setDataValue('displayName', value.trim());
      }
    },
    username: {
      type: DataTypes.STRING(30),
      unique: true,
      validate: {
        len: [3, 30],
        isAlphanumeric: true
      },
      set(value) {
        if (value) {
          this.setDataValue('username', value.toLowerCase().trim());
        }
      }
    },
    
    // Role and Status
    role: {
      type: DataTypes.ENUM('user', 'moderator', 'admin'),
      defaultValue: 'user',
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('active', 'suspended', 'banned'),
      defaultValue: 'active',
      allowNull: false
    },
    moderation_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    last_moderated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    last_moderated_at: {
      type: DataTypes.DATE,
      allowNull: true
    },

    // Profile Information
    first_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    bio_text: {
      type: DataTypes.TEXT,
      validate: {
        len: [0, 500]
      }
    },
    avatar_url: {
      type: DataTypes.STRING,
      allowNull: true
    },
    avatar_public_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    cover_image_url: {
      type: DataTypes.STRING,
      allowNull: true
    },
    cover_image_public_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    gender_type: {
      type: DataTypes.ENUM('male', 'female', 'other', 'prefer-not-to-say'),
      allowNull: true
    },
    phone_number: {
      type: DataTypes.STRING,
      allowNull: true
    },
        phone_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    website_url: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    interests_array: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    skills_array: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    occupation: {
      type: DataTypes.STRING,
      allowNull: true
    },
    company: {
      type: DataTypes.STRING,
      allowNull: true
    },
    education: {
      type: DataTypes.STRING,
      allowNull: true
    },
    relationship_status: {
      type: DataTypes.ENUM('single', 'married', 'in_relationship', 'complicated', 'prefer_not_to_say'),
      allowNull: true
    },
    social_links: {
      type: DataTypes.JSONB,
      defaultValue: {
        website: '',
        twitter: '',
        instagram: '',
        linkedin: '',
        facebook: ''
      }
    },

    // Location Information
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      validate: {
        min: -90,
        max: 90
      }
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      validate: {
        min: -180,
        max: 180
      }
    },
    location_street: {
      type: DataTypes.STRING,
      allowNull: true
    },
    location_district: {
      type: DataTypes.STRING,
      allowNull: true
    },
    location_city: {
      type: DataTypes.STRING,
      allowNull: true
    },
    location_state: {
      type: DataTypes.STRING,
      allowNull: true
    },
    location_country: {
      type: DataTypes.STRING,
      allowNull: true
    },
    location_postal_code: {
      type: DataTypes.STRING,
      allowNull: true
    },
    location_formatted_address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    micro_community_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    city_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
      location_last_updated: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    share_location: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    location_radius: {
      type: DataTypes.INTEGER,
      defaultValue: 5
    },

    // Authentication & Security
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    email_verification_token: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email_verification_expires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    password_reset_token: {
      type: DataTypes.STRING,
      allowNull: true
    },
    password_reset_expires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    password_reset_otp: {
      type: DataTypes.STRING(6),
      allowNull: true
    },
    password_reset_otp_expires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Social Auth
    google_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    google_email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    facebook_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    facebook_email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    twitter_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    twitter_username: {
      type: DataTypes.STRING,
      allowNull: true
    },

    // Account Status & Permissions
    role_type: {
      type: DataTypes.ENUM('user', 'moderator', 'admin'),
      defaultValue: 'user'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    is_banned: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    ban_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    ban_expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Privacy Settings
        profile_visibility: {
      type: DataTypes.ENUM('public', 'friends', 'private'),
      defaultValue: 'public'
    },
    show_email: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    show_phone: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    allow_messages_from_strangers: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    
    // Notification Settings
    email_notifications: {
      type: DataTypes.JSONB,
      defaultValue: {
        newMessages: true,
        jobMatches: true,
        postInteractions: true,
        marketplaceUpdates: true,
        systemUpdates: true
      }
    },
    push_notifications: {
      type: DataTypes.JSONB,
      defaultValue: {
        newMessages: true,
        jobMatches: true,
        postInteractions: false,
        marketplaceUpdates: false,
        systemUpdates: true
      }
    },
    
    // Preferences
    language: {
      type: DataTypes.STRING(5),
      defaultValue: 'en'
    },
    timezone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'INR'
    },
    theme: {
      type: DataTypes.ENUM('light', 'dark', 'auto'),
      defaultValue: 'auto'
    },

    // Activity & Statistics
    posts_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    followers_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    following_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    jobs_posted_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    marketplace_items_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    rating_average: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0.00
    },
      rating_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },

    // Device & Session Information
    devices: {
      type: DataTypes.JSONB,
      defaultValue: []
    },

    // Timestamps
    last_login: {
      type: DataTypes.DATE,
      allowNull: true
    },
    last_active: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Moderation
    report_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    warning_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    suspension_history: {
      type: DataTypes.JSONB,
      defaultValue: []
    }
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['email'] },
      { fields: ['username'] },
      { fields: ['latitude'] },
      { fields: ['longitude'] },
      { fields: ['micro_community_id'] },
      { fields: ['city_id'] },
      { fields: ['role'] },
      { fields: ['is_active'] },
      { fields: ['created_at'] },
      { fields: ['last_active'] }
    ],
    hooks: {
      beforeSave: async (user) => {
        // Hash password if it's being set/changed
        if (user.changed('password') && user.password) {
          const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
          user.password = await bcrypt.hash(user.password, salt);
        }
        
        // Generate username if not provided
        if (!user.username && user.email) {
          const emailPrefix = user.email.split('@')[0];
          user.username = emailPrefix.toLowerCase().replace(/[^a-z0-9]/g, '');
        }
      }
    }
  });

  // Instance methods
  User.prototype.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
  };

  User.prototype.isAdmin = function() {
    return this.role === 'admin';
  };

  User.prototype.isModerator = function() {
    return this.role === 'moderator' || this.role === 'admin';
  };

  User.prototype.getPublicProfile = function() {
    const user = this.toJSON();
    delete user.password;
    delete user.emailVerificationToken;
    delete user.email_verification_expires;
    delete user.password_reset_token;
    delete user.password_reset_expires;
    delete user.devices;
    
    // Filter sensitive information based on privacy settings
    if (user.profile_visibility === 'private') {
      return {
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        avatar_url: user.avatar_url
      };
    }
    
    if (!user.show_email) {
      delete user.email;
    }
    
    if (!user.show_phone) {
      delete user.phone_number;
    }
    
    return user;
  };

  User.prototype.updateLastActive = function() {
    this.last_active = new Date();
    return this.save({ fields: ['last_active'] });
  };

  // Virtual for full name
  User.prototype.getFullName = function() {
    if (this.first_name && this.last_name) {
      return `${this.first_name} ${this.last_name}`;
    }
    return this.displayName;
  };

  // Virtual for age
  User.prototype.getAge = function() {
    if (this.date_of_birth) {
      const today = new Date();
      const birthDate = new Date(this.date_of_birth);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    }
    return null;
  };

  // Class methods
  User.findByLocation = function(longitude, latitude, radius_in_km = 10) {
    return this.findAll({
      where: {
        is_active: true
      }
    });
  };

  User.findByMicroCommunity = function(micro_community_id) {
    return this.findAll({
      where: {
        micro_community_id,
        is_active: true
      }
    });
  };

  return User;
};