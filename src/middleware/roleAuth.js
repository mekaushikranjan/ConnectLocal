import { asyncHandler } from './errorHandler.js';

// Role hierarchy
const roleHierarchy = {
  admin: ['admin', 'moderator', 'user'],
  moderator: ['moderator', 'user'],
  user: ['user']
};

// Check if user has required role
export const hasRole = (requiredRole) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userRole = req.user.role || 'user';
    const allowedRoles = roleHierarchy[userRole] || ['user'];

    if (!allowedRoles.includes(requiredRole)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  });
};

// Combined middleware for both admin and moderator access
export const isStaff = asyncHandler(async (req, res, next) => {
  if (!req.user || !['admin', 'moderator'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Staff privileges required.'
    });
  }
  next();
});

// Admin only middleware
export const isAdmin = asyncHandler(async (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
  next();
});

// Moderator only middleware
export const isModerator = asyncHandler(async (req, res, next) => {
  if (!req.user || req.user.role !== 'moderator') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Moderator privileges required.'
    });
  }
  next();
});
