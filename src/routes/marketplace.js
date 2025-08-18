import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { MarketplaceItem, User, Notification } from '../models/index.js';
import { Op } from 'sequelize';

const router = express.Router();

// Transform marketplace item data from backend to frontend format
const transformItemForFrontend = (item) => {
  if (!item) return null;

  return {
    id: item.id,
    title: item.title,
    description: item.description,
    price: item.price?.amount || 0,
    currency: item.price?.currency || 'INR',
    negotiable: item.price?.negotiable || true,
    category: item.category,
    condition: item.condition,
    images: item.images || [],
    specifications: item.specifications || {},
    location: {
      city: item.locationAddress?.city,
      state: item.locationAddress?.state,
      country: item.locationAddress?.country,
      formattedAddress: item.locationAddress?.formattedAddress
    },
    seller: {
      id: item.sellerId,
      displayName: item.User?.displayName || item.seller?.displayName,
      username: item.User?.username || item.seller?.username,
      avatarUrl: item.User?.avatar_url || item.seller?.avatar_url,
      rating: item.User?.rating_average || item.seller?.rating_average
    },
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    views: item.views || 0,
    saved: item.saved || false,
    status: item.status
  };
};

/**
 * @swagger
 * /api/marketplace:
 *   post:
 *     summary: Create a new marketplace listing
 *     description: Create a new item listing in the marketplace
 *     tags: [Marketplace]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - price
 *               - category
 *             properties:
 *               title:
 *                 type: string
 *                 description: Item title
 *                 example: "iPhone 13 Pro Max"
 *               description:
 *                 type: string
 *                 description: Detailed item description
 *                 example: "Excellent condition, barely used iPhone 13 Pro Max"
 *               price:
 *                 type: number
 *                 description: Item price
 *                 example: 45000
 *               currency:
 *                 type: string
 *                 default: "INR"
 *                 description: Price currency
 *                 example: "INR"
 *               negotiable:
 *                 type: boolean
 *                 default: true
 *                 description: Whether price is negotiable
 *               category:
 *                 type: string
 *                 description: Item category
 *                 example: "electronics"
 *               condition:
 *                 type: string
 *                 enum: [new, like-new, good, fair, poor]
 *                 default: "good"
 *                 description: Item condition
 *                 example: "good"
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
 *                 description: Item location
 *                 example:
 *                   city: "Mumbai"
 *                   state: "Maharashtra"
 *                   formattedAddress: "Mumbai, Maharashtra"
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       format: uri
 *                     alt:
 *                       type: string
 *                 description: Item images
 *                 example: []
 *               specifications:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Item specifications
 *                 example:
 *                   Storage: "256GB"
 *                   Color: "Sierra Blue"
 *                   Battery Health: "95%"
 *               shipping:
 *                 type: object
 *                 properties:
 *                   available:
 *                     type: boolean
 *                   cost:
 *                     type: number
 *                 description: Shipping information
 *     responses:
 *       201:
 *         description: Item created successfully
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
 *                   example: Item listed successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     item:
 *                       $ref: '#/components/schemas/MarketplaceItem'
 *       400:
 *         description: Bad request - Invalid data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const {
    title,
    description,
    price,
    category,
    condition,
    location,
    images,
    currency = 'INR',
    negotiable = true,
    specifications,
    shipping
  } = req.body;

  // Transform price to JSONB format
  const priceData = typeof price === 'number' ? {
    amount: price,
    currency: currency,
    negotiable: negotiable
  } : price;

  // Transform location to expected format
  const locationAddress = typeof location === 'object' ? location : {
    city: location,
    formattedAddress: location
  };

  // Fix condition format (replace underscores with hyphens)
  const normalizedCondition = condition?.replace(/_/g, '-') || 'good';

  const item = await MarketplaceItem.create({
    sellerId: req.user.id,
    title,
    description,
    price: priceData,
    category: category?.toLowerCase(),
    condition: normalizedCondition,
    locationAddress,
    images: images || [],
    specifications: specifications || {}
  });

  const populatedItem = await MarketplaceItem.findByPk(item.id, {
    include: [{
      model: User,
      as: 'seller',
      attributes: ['id', 'displayName', 'username', 'avatar_url', 'rating_average']
    }]
  });

  const transformedItem = transformItemForFrontend(populatedItem);

  res.status(201).json({
    success: true,
    message: 'Item listed successfully',
    data: { item: transformedItem }
  });
}));

/**
 * @route   GET /api/marketplace
 * @desc    Get marketplace listings with filters
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const {
    search,
    category,
    condition,
    minPrice,
    maxPrice,
    location,
    limit = 10,
    page = 1
  } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = { status: 'available' };

  if (search) {
    whereClause[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
      { tags: { [Op.contains]: [search] } }
    ];
  }

  if (category) whereClause.category = category;
  if (condition) whereClause.condition = condition;
  if (location) whereClause.location = location;

  if (minPrice || maxPrice) {
    if (minPrice) {
      whereClause['price.amount'] = { [Op.gte]: parseInt(minPrice) };
    }
    if (maxPrice) {
      whereClause['price.amount'] = { 
        ...whereClause['price.amount'], 
        [Op.lte]: parseInt(maxPrice) 
      };
    }
  }

  const items = await MarketplaceItem.findAndCountAll({
    where: whereClause,
    include: [{
      model: User,
      as: 'seller',
      attributes: ['id', 'displayName', 'username', 'avatar_url', 'rating_average']
    }],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  // Transform items for frontend compatibility
  const transformedItems = items.rows.map(transformItemForFrontend);

  res.json({
    success: true,
    data: {
      items: transformedItems,
      total: items.count,
      page: parseInt(page),
      totalPages: Math.ceil(items.count / limit)
    }
  });
}));

/**
 * @route   GET /api/marketplace/:id
 * @desc    Get marketplace item details
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const item = await MarketplaceItem.findByPk(req.params.id, {
    include: [{
      model: User,
      as: 'seller',
      attributes: ['id', 'displayName', 'username', 'avatar_url', 'rating_average']
    }]
  });

  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Item not found'
    });
  }

  const transformedItem = transformItemForFrontend(item);

  res.json({
    success: true,
    data: { item: transformedItem }
  });
}));

/**
 * @route   PUT /api/marketplace/:id
 * @desc    Update marketplace listing
 * @access  Private
 */
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const item = await MarketplaceItem.findByPk(req.params.id);

  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Item not found'
    });
  }

  if (item.userId !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this listing'
    });
  }

  const allowedUpdates = [
    'title',
    'description',
    'price',
    'category',
    'condition',
    'location',
    'images',
    'tags',
    'status'
  ];

  const updates = Object.keys(req.body)
    .filter(key => allowedUpdates.includes(key))
    .reduce((obj, key) => {
      obj[key] = req.body[key];
      return obj;
    }, {});

  Object.assign(item, updates);
  await item.save();

  res.json({
    success: true,
    message: 'Listing updated successfully',
    data: { item }
  });
}));

/**
 * @route   DELETE /api/marketplace/:id
 * @desc    Delete marketplace listing
 * @access  Private
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const item = await MarketplaceItem.findByPk(req.params.id);

  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Item not found'
    });
  }

  if (item.userId !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this listing'
    });
  }

  await item.destroy();

  res.json({
    success: true,
    message: 'Listing deleted successfully'
  });
}));

/**
 * @route   POST /api/marketplace/:id/favorite
 * @desc    Add/Remove item from favorites
 * @access  Private
 */
router.post('/:id/favorite', authenticate, asyncHandler(async (req, res) => {
  const item = await MarketplaceItem.findByPk(req.params.id);

  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Item not found'
    });
  }

  const hasFavorited = await item.hasFavoritedBy(req.user);
  if (hasFavorited) {
    await item.removeFavoritedBy(req.user);
    res.json({
      success: true,
      message: 'Item removed from favorites'
    });
  } else {
    await item.addFavoritedBy(req.user);
    res.json({
      success: true,
      message: 'Item added to favorites'
    });
  }
}));

/**
 * @route   POST /api/marketplace/:id/report
 * @desc    Report a marketplace listing
 * @access  Private
 */
router.post('/:id/report', authenticate, asyncHandler(async (req, res) => {
  const item = await MarketplaceItem.findByPk(req.params.id);

  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Item not found'
    });
  }

  const { reason, description } = req.body;

  await Report.create({
    userId: req.user.id,
    itemId: item.id,
    itemType: 'marketplace',
    reason,
    description
  });

  res.status(201).json({
    success: true,
    message: 'Item reported successfully'
  });
}));

/**
 * @route   PUT /api/marketplace/:id/status
 * @desc    Update item status (sold, available, reserved)
 * @access  Private
 */
router.put('/:id/status', authenticate, asyncHandler(async (req, res) => {
  const item = await MarketplaceItem.findByPk(req.params.id);

  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Item not found'
    });
  }

  if (item.userId !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this listing'
    });
  }

  const { status } = req.body;
  if (!['available', 'sold', 'reserved'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status'
    });
  }

  item.status = status;
  await item.save();

  res.json({
    success: true,
    message: 'Item status updated successfully',
    data: { item }
  });
}));

export default router;
