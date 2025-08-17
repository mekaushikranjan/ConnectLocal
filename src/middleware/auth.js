import jwt from 'jsonwebtoken';
import { User, LoginHistory } from '../models/index.js';
import { updateSessionActivity } from '../utils/loginHistory.js';

// Middleware to authenticate JWT token
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password'] }
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    if (user.is_banned) {
      return res.status(401).json({
        success: false,
        message: 'Account is banned.',
        banReason: user.ban_reason,
        banExpiresAt: user.ban_expires_at
      });
    }

    // Update last active
    await user.update({ last_active: new Date() });

    // Update login history last activity
    try {
      await LoginHistory.update(
        { last_activity_at: new Date() },
        {
          where: {
            user_id: user.id,
            is_active: true
          }
        }
      );
    } catch (error) {
      // Don't fail authentication if login history update fails
      console.error('Failed to update login history last activity:', error);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }

    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during authentication.'
    });
  }
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required.'
    });
  }

  next();
};

// Middleware to check if user is moderator or admin
const requireModerator = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!['moderator', 'admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Moderator access required.'
    });
  }

  next();
};

// Middleware to check if user owns the resource or is admin
const requireOwnershipOrAdmin = (resourceUserField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

      // Admin can access any resource
  if (req.user.role === 'admin') {
    return next();
  }

  // Check if user owns the resource
  const resourceUserId = req.params[resourceUserField] || req.body[resourceUserField];
  
  if (resourceUserId && resourceUserId.toString() === req.user.id.toString()) {
    return next();
  }

    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only access your own resources.'
    });
  };
};

// Middleware to check if user can access resource (owner, admin, or moderator)
const requireResourceAccess = (resourceUserField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Admin or moderator can access any resource
    if (['moderator', 'admin'].includes(req.user.role)) {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.params[resourceUserField] || req.body[resourceUserField];
    
    if (resourceUserId && resourceUserId.toString() === req.user.id.toString()) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied.'
    });
  };
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password'] }
    });
    
    if (user && user.is_active && !user.is_banned) {
      await user.update({ last_active: new Date() });
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

// Middleware to validate API key (for external integrations)
const validateApiKey = (req, res, next) => {
  const apiKey = req.header('X-API-Key');
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key required.'
    });
  }

  // In a real application, you would validate the API key against a database
  // For now, we'll use a simple environment variable
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      success: false,
      message: 'Invalid API key.'
    });
  }

  next();
};

// Middleware to check rate limiting for specific actions
const checkActionRateLimit = (action, maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();

  return (req, res, next) => {
    const key = `${req.ip}-${action}`;
    const now = Date.now();
    
    if (!attempts.has(key)) {
      attempts.set(key, []);
    }
    
    const userAttempts = attempts.get(key);
    
    // Remove old attempts outside the window
    const validAttempts = userAttempts.filter(timestamp => now - timestamp < windowMs);
    attempts.set(key, validAttempts);
    
    if (validAttempts.length >= maxAttempts) {
      return res.status(429).json({
        success: false,
        message: `Too many ${action} attempts. Please try again later.`,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    // Add current attempt
    validAttempts.push(now);
    attempts.set(key, validAttempts);
    
    next();
  };
};

// Middleware to validate user permissions for specific features
const requireFeatureAccess = (feature) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Check if user has access to the feature
    // This could be based on subscription, user role, etc.
    const featurePermissions = {
      'premium_features': ['admin', 'premium'],
      'advanced_analytics': ['admin', 'moderator'],
      'bulk_operations': ['admin'],
      'api_access': ['admin', 'developer']
    };

    const allowedRoles = featurePermissions[feature];
    
    if (!allowedRoles) {
      return next(); // Feature doesn't have restrictions
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. ${feature} requires ${allowedRoles.join(' or ')} access.`
      });
    }

    next();
  };
};

// Middleware to check if user is verified
const requireVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!req.user.email_verified) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required.',
      requiresVerification: true
    });
  }

  next();
};

// Middleware to log user actions
const logUserAction = (action) => {
  return (req, res, next) => {
    if (req.user) {
      // Log user action (you could save this to database or external service)
      console.log(`User ${req.user.id} performed action: ${action} at ${new Date().toISOString()}`);
      
      // You could also add this to user's activity log
      // await UserActivity.create({
      //   user: req.user._id,
      //   action,
      //   ip: req.ip,
      //   userAgent: req.get('User-Agent'),
      //   timestamp: new Date()
      // });
    }
    next();
  };
};

export {
  authenticate,
  requireAdmin,
  requireModerator,
  requireOwnershipOrAdmin,
  requireResourceAccess,
  optionalAuth,
  validateApiKey,
  checkActionRateLimit,
  requireFeatureAccess,
  requireVerification,
  logUserAction
};