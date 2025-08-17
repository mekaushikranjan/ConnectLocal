export default (sequelize, DataTypes) => {
  const MarketplaceItem = sequelize.define('MarketplaceItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    // Basic Information
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 200]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 2000]
      }
    },

    // Category & Classification
    category: {
      type: DataTypes.ENUM(
        'electronics', 'furniture', 'clothing', 'books', 'sports',
        'automotive', 'home-garden', 'toys-games', 'health-beauty',
        'jewelry-accessories', 'art-collectibles', 'musical-instruments',
        'tools-equipment', 'pet-supplies', 'food-beverages', 'other'
      ),
      allowNull: false
    },
    subcategory_jsonb: {
      type: DataTypes.STRING,
      allowNull: true
    },
    brand_jsonb: {
      type: DataTypes.STRING,
      allowNull: true
    },
    model_jsonb: {
      type: DataTypes.STRING,
      allowNull: true
    },
    
    // Pricing
    price_jsonb: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        amount: 0,
        currency: 'INR',
        negotiable: true,
        originalPrice: null
      },
      validate: {
        hasValidAmount(value) {
          if (!value.amount || value.amount < 0) {
            throw new Error('Price amount must be greater than or equal to 0');
          }
        }
      }
    },
    // Condition & Quality
    condition_jsonb: {
      type: DataTypes.ENUM('new', 'like-new', 'good', 'fair', 'poor'),
      allowNull: false
    },
    condition_description: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    // Media
    images_jsonb: {
      type: DataTypes.JSONB,
      defaultValue: [],
      validate: {
        isValidImageArray(value) {
          if (!Array.isArray(value)) {
            throw new Error('Images must be an array');
          }
          value.forEach(img => {
            if (!img.url) {
              throw new Error('Each image must have a URL');
            }
          });
        }
      }
    },
  videos_jsonb  : {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  url_jsonb: {
    type: DataTypes.STRING,
    allowNull: true
  },
  public_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  thumbnail_url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  duration_jsonb: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  
    // Seller Information
    seller_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    seller_type: {
      type: DataTypes.ENUM('individual', 'business'),
      defaultValue: 'individual'
    },

    // Location
    location_coordinates: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    location_address: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        street: null,
        city: null,
        state: null,
        country: null,
        postalCode: null,
        formattedAddress: null
      }
    },
    micro_community_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    city_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    pickup_available: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    delivery_available: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    delivery_radius: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    delivery_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
  
    // Specifications & Details
    specifications: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    dimensions_jsonb: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    weight_jsonb: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('available', 'sold', 'reserved', 'expired', 'removed'),
      defaultValue: 'available'
    },
    quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      validate: {
        min: 0
      }
    },
  
  // Engagement
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  favorites_jsonb   : {
    type: DataTypes.JSONB,
    defaultValue: []
  },
    inquiries_jsonb: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },

    // Sale Information
    sale_jsonb: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    reservation_jsonb: {
      type: DataTypes.JSONB,
      allowNull: true
    },
  
  // Promotion & Boosting
  promotion_jsonb: {
    type: DataTypes.JSONB,
    defaultValue: {
      isBoosted: false,
      boostStartDate: null,
      boostEndDate: null,
      boostType: null
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
      moderationFlags: [],
      moderationNotes: null
    }
  },

    // Analytics
    analytics_jsonb: {
      type: DataTypes.JSONB,
      defaultValue: {
        impressions: 0,
        clicks: 0,
        inquiriesCount: 0,
        favoritesCount: 0,
        conversionRate: 0,
        averageTimeOnPage: null,
        sources: []
      }
    },

    expires_at: {  
      type: DataTypes.DATE,
      allowNull: true
    },
    auto_renew: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
  
    // Warranty and Returns
    warranty_jsonb: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    return_policy_jsonb: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    // Related Items
    related_item_ids_array: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      defaultValue: []
    }
  }, {
    tableName: 'marketplace_items',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['seller_id', 'created_at'] },
      { fields: ['micro_community_id', 'created_at'] },
      { fields: ['city_id', 'created_at'] },
      { fields: ['category', 'created_at'] },
      { fields: ['status', 'created_at'] },
      { fields: ['tags'], using: 'gin' },
      { fields: ['price_jsonb'] },
      { fields: ['expires_at'] }
    ],
    scopes: {
      available: {
        where: { status: 'available' }
      },
      withSeller: {
        include: ['seller']
      }
    }
    });

    // Class Methods
    MarketplaceItem.findByLocation = async function(longitude, latitude, radiusInKm = 25, options = {}) {
    const query = {
      status: 'available',
      location_coordinates: Sequelize.fn(
      'ST_DWithin',
      Sequelize.col('location_coordinates'),
      Sequelize.fn('ST_MakePoint', longitude, latitude),
      radiusInKm * 1000
      )
    };

    if (options.category) query.category = options.category;
    if (options.condition) query.condition = options.condition;
    if (options.minPrice) query['price.amount'] = { [Op.gte]: options.minPrice };
    if (options.maxPrice) {
      if (!query['price.amount']) query['price.amount'] = {};
      query['price.amount'][Op.lte] = options.maxPrice;
    }

    return this.findAll({
      where: query,
      include: ['seller'],
      order: [
      ['promotion_jsonb.isBoosted', 'DESC'],
      ['created_at', 'DESC']
      ]
    });
    };


  // Instance methods
  MarketplaceItem.prototype.incrementView = async function(userId, source = 'browse') {
    this.views += 1;
    
    // Update analytics
    const analytics = this.analytics_jsonb || {};
    analytics.impressions = (analytics.impressions || 0) + 1;
    
    if (source) {
      const sources = analytics.sources || [];
      const existingSource = sources.find(s => s.source === source);
      if (existingSource) {
        existingSource.count += 1;
      } else {
        sources.push({ source, count: 1 });
      }
      analytics.sources = sources;
    }
    
    this.analytics_jsonb = analytics;
    return this.save();
  };

  MarketplaceItem.prototype.addToFavorites = async function(userId) {
    const favorites = this.favorites_jsonb   || [];
    if (!favorites.some(f => f.user === userId.toString())) {
      favorites.push({
        user: userId,
        favoritedAt: new Date()
      });
      this.favorites_jsonb = favorites;
      
      // Update analytics
      const analytics = this.analytics_jsonb || {};
      analytics.favoritesCount = (analytics.favoritesCount || 0) + 1;
      this.analytics_jsonb = analytics;
      
      await this.save();
    }
    return this;
  };

  MarketplaceItem.prototype.addInquiry = async function(userId, message) {
    const inquiries = this.inquiries_jsonb || [];
    inquiries.push({
      user: userId,
      message,
      inquiredAt: new Date()
    });
    this.inquiries_jsonb = inquiries;
    
    // Update analytics
    const analytics = this.analytics_jsonb || {};
    analytics.inquiriesCount = (analytics.inquiriesCount || 0) + 1;
    this.analytics_jsonb = analytics;
    
    return this.save();
  };

  MarketplaceItem.prototype.markAsSold = async function(buyerId, transactionDetails) {
    this.status = 'sold';
    this.sale_jsonb = {
      soldTo: buyerId,
      soldAt: new Date(),
      finalPrice: transactionDetails.finalPrice,
      paymentMethod: transactionDetails.paymentMethod,
      transactionId: transactionDetails.transactionId
    };
    
    // Update analytics
    const analytics = this.analytics_jsonb || {};
    analytics.conversionRate = this.views ? (100 / this.views) : 0;
    this.analytics_jsonb = analytics;
    
    return this.save();
  };

  MarketplaceItem.prototype.reserve = async function(userId, reservationDetails) {
    if (this.status !== 'available') {
      throw new Error('Item is not available for reservation');
    }
    
    this.status = 'reserved';
    this.reservation_jsonb = {
      reservedBy: userId,
      reservedAt: new Date(),
      expires_at: reservationDetails.expires_at,
      deposit: reservationDetails.deposit
    };
    
    return this.save();
  };

  MarketplaceItem.prototype.cancelReservation = async function() {
    if (this.status === 'reserved') {
      this.status = 'available';
      this.reservation_jsonb = null;
      await this.save();
    }
    return this;
  };

  MarketplaceItem.prototype.isExpired = function() {
    return this.expires_at && new Date() > this.expires_at;
  };

  MarketplaceItem.prototype.renew = async function(duration) {
    if (this.status === 'expired') {
      this.status = 'available';
    }
    
    const now = new Date();
    this.expires_at = new Date(now.getTime() + duration);
    return this.save();
  };

  MarketplaceItem.prototype.report = async function(reportType) {
    this.moderation_jsonb.isReported = true;
    this.moderation_jsonb.reportCount = (this.moderation_jsonb.reportCount || 0) + 1;
    
    const flags = this.moderation_jsonb.moderationFlags || [];
    if (!flags.includes(reportType)) {
      flags.push(reportType);
      this.moderation_jsonb.moderationFlags = flags;
    }
    
    return this.save();
  };

  return MarketplaceItem;
};