import { body, param, query, validationResult } from 'express-validator';

// Middleware to handle validation results
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }
  
  next();
};

// Comment validation
export const validateComment = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Comment content is required')
    .isLength({ max: 1000 })
    .withMessage('Comment must not exceed 1000 characters'),
  
  body('parentId')
    .optional()
    .isUUID()
    .withMessage('Invalid parent comment ID'),
  handleValidationErrors
];

// Auth validation rules
export const validateRegister = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('displayName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Display name must be between 2 and 50 characters'),
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
  handleValidationErrors
];

export const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

export const validateForgotPassword = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  handleValidationErrors
];

export const validateResetPassword = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  handleValidationErrors
];

// Post validation rules
export const validateCreatePost = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Content must be between 1 and 5000 characters'),
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title must not exceed 200 characters'),
  body('type')
    .optional()
    .isIn(['urgent', 'event', 'news', 'general', 'help', 'sale', 'announcement'])
    .withMessage('Invalid post type'),
  body('category')
    .optional()
    .isIn(['community', 'events', 'marketplace', 'jobs', 'services', 'lost-found', 'recommendations', 'other'])
    .withMessage('Invalid category'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
  body('visibility')
    .optional()
    .isIn(['public', 'community', 'friends', 'private'])
    .withMessage('Invalid visibility setting'),
  handleValidationErrors
];

export const validateUpdatePost = [
  param('id')
    .isMongoId()
    .withMessage('Invalid post ID'),
  body('content')
    .optional()
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Content must be between 1 and 5000 characters'),
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title must not exceed 200 characters'),
  handleValidationErrors
];

// Comment validation rules
export const validateCreateComment = [
  param('postId')
    .isMongoId()
    .withMessage('Invalid post ID'),
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters'),
  body('parentComment')
    .optional()
    .isMongoId()
    .withMessage('Invalid parent comment ID'),
  handleValidationErrors
];

// Job validation rules
export const validateCreateJob = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Job title must be between 5 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 50, max: 5000 })
    .withMessage('Job description must be between 50 and 5000 characters'),
  body('company.name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Company name must be between 2 and 100 characters'),
  body('type')
    .isIn(['full-time', 'part-time', 'contract', 'freelance', 'internship', 'temporary', 'volunteer'])
    .withMessage('Invalid job type'),
  body('category')
    .isIn(['technology', 'healthcare', 'education', 'finance', 'marketing', 'sales', 'design', 'engineering', 'operations', 'hr', 'legal', 'consulting', 'retail', 'hospitality', 'construction', 'other'])
    .withMessage('Invalid job category'),
  body('locationType')
    .isIn(['on-site', 'remote', 'hybrid'])
    .withMessage('Invalid location type'),
  body('requirements.experience.level')
    .isIn(['entry', 'mid', 'senior', 'executive'])
    .withMessage('Invalid experience level'),
  body('salary.min')
    .optional()
    .isNumeric()
    .withMessage('Minimum salary must be a number'),
  body('salary.max')
    .optional()
    .isNumeric()
    .withMessage('Maximum salary must be a number'),
  handleValidationErrors
];

// Marketplace validation rules
export const validateCreateMarketplaceItem = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 20, max: 2000 })
    .withMessage('Description must be between 20 and 2000 characters'),
  body('category')
    .isIn(['electronics', 'furniture', 'clothing', 'books', 'sports', 'automotive', 'home-garden', 'toys-games', 'health-beauty', 'jewelry-accessories', 'art-collectibles', 'musical-instruments', 'tools-equipment', 'pet-supplies', 'food-beverages', 'other'])
    .withMessage('Invalid category'),
  body('price.amount')
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('condition')
    .isIn(['new', 'like-new', 'good', 'fair', 'poor'])
    .withMessage('Invalid condition'),
  handleValidationErrors
];

// Chat validation rules
export const validateCreateChat = [
  body('type')
    .isIn(['direct', 'group'])
    .withMessage('Invalid chat type'),
  body('participants')
    .isArray({ min: 1 })
    .withMessage('At least one participant is required'),
  body('participants.*')
    .isMongoId()
    .withMessage('Invalid participant ID'),
  body('groupInfo.name')
    .if(body('type').equals('group'))
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Group name must be between 1 and 100 characters'),
  handleValidationErrors
];

// Get chat validation
export const validateGetChat = [
  param('chatId')
    .isMongoId()
    .withMessage('Invalid chat ID'),
  handleValidationErrors
];

// Update chat validation
export const validateUpdateChat = [
  param('chatId')
    .isMongoId()
    .withMessage('Invalid chat ID'),
  body('groupInfo.name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Group name must be between 1 and 100 characters'),
  handleValidationErrors
];

// Delete chat validation
export const validateDeleteChat = [
  param('chatId')
    .isMongoId()
    .withMessage('Invalid chat ID'),
  handleValidationErrors
];

export const validateSendMessage = [
  param('chatId')
    .isMongoId()
    .withMessage('Invalid chat ID'),
  body('content.text')
    .optional()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message text must be between 1 and 2000 characters'),
  body('type')
    .isIn(['text', 'image', 'video', 'audio', 'file', 'location', 'contact'])
    .withMessage('Invalid message type'),
  handleValidationErrors
];

// Report validation rules
export const validateCreateReport = [
  body('contentType')
    .isIn(['post', 'comment', 'user', 'marketplace', 'job', 'message', 'chat'])
    .withMessage('Invalid content type'),
  body('contentId')
    .isMongoId()
    .withMessage('Invalid content ID'),
  body('reason')
    .isIn(['spam', 'harassment', 'hate_speech', 'inappropriate_content', 'misinformation', 'violence_threats', 'privacy_violation', 'scam_fraud', 'copyright_violation', 'fake_profile', 'impersonation', 'adult_content', 'self_harm', 'terrorism', 'illegal_activity', 'other'])
    .withMessage('Invalid report reason'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  handleValidationErrors
];

// User profile validation rules
export const validateUpdateProfile = [
  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Display name must be between 2 and 50 characters'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio must not exceed 500 characters'),
  body('location')
    .optional()
    .isObject()
    .withMessage('Location must be an object'),
  body('location.coordinates')
    .optional()
    .isArray({ min: 2, max: 2 })
    .withMessage('Location coordinates must be an array of [longitude, latitude]'),
  body('location.coordinates.*')
    .optional()
    .isFloat()
    .withMessage('Coordinates must be valid numbers'),
  body('location.address')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Address must not exceed 200 characters'),
  body('website')
    .optional()
    .trim()
    .isURL()
    .withMessage('Please provide a valid website URL'),
  body('socialLinks')
    .optional()
    .isObject()
    .withMessage('Social links must be an object'),
  body('socialLinks.twitter')
    .optional()
    .trim()
    .isURL()
    .withMessage('Please provide a valid Twitter URL'),
  body('socialLinks.facebook')
    .optional()
    .trim()
    .isURL()
    .withMessage('Please provide a valid Facebook URL'),
  body('socialLinks.instagram')
    .optional()
    .trim()
    .isURL()
    .withMessage('Please provide a valid Instagram URL'),
  body('socialLinks.linkedin')
    .optional()
    .trim()
    .isURL()
    .withMessage('Please provide a valid LinkedIn URL'),
  body('profileAvatar')
    .optional()
    .trim()
    .isURL()
    .withMessage('Profile avatar must be a valid URL'),
  body('profileCover')
    .optional()
    .trim()
    .isURL()
    .withMessage('Profile cover must be a valid URL'),
  body('preferences')
    .optional()
    .isObject()
    .withMessage('Preferences must be an object'),
  body('preferences.emailNotifications')
    .optional()
    .isBoolean()
    .withMessage('Email notifications preference must be a boolean'),
  body('preferences.pushNotifications')
    .optional()
    .isBoolean()
    .withMessage('Push notifications preference must be a boolean'),
  body('preferences.visibility')
    .optional()
    .isIn(['public', 'private', 'friends'])
    .withMessage('Invalid visibility preference'),
  handleValidationErrors
];

// Location validation rules
export const validateLocation = [
  body('location.coordinates')
    .isArray({ min: 2, max: 2 })
    .withMessage('Coordinates must be an array of [longitude, latitude]'),
  body('location.coordinates.0')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('location.coordinates.1')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  handleValidationErrors
];

// Pagination validation
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

// Search validation
export const validateSearch = [
  query('q')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  handleValidationErrors
];

// MongoDB ObjectId validation
export const validateObjectId = (paramName = 'id') => [
  param(paramName)
    .isMongoId()
    .withMessage(`Invalid ${paramName}`),
  handleValidationErrors
];

// Password change validation
export const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    }),
  handleValidationErrors
];

export const validateLogout = [
  body('deviceId')
    .optional()
    .isString()
    .withMessage('Device ID must be a string'),
  handleValidationErrors
];

export const validateDeleteAccount = [
  body('password')
    .notEmpty()
    .withMessage('Password is required to delete account'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must not exceed 500 characters'),
  handleValidationErrors
];

// Email verification validation
export const validateEmailVerification = [
  body('token')
    .notEmpty()
    .withMessage('Verification token is required'),
  handleValidationErrors
];

// Resend verification validation
export const validateResendVerification = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  handleValidationErrors
];

// Refresh token validation
export const validateRefreshToken = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required'),
  handleValidationErrors
];

