import RedisService from '../services/redisService.js';

/**
 * Redis-based rate limiting middleware
 * @param {Object} options - Rate limiting options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {string} options.message - Error message
 * @param {Function} options.keyGenerator - Function to generate rate limit key
 * @param {Function} options.skip - Function to determine if request should be skipped
 * @returns {Function} Express middleware function
 */
export const createRedisRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    message = 'Too many requests, please try again later.',
    keyGenerator = (req) => {
      // Use IP address as default key
      return req.ip || req.connection.remoteAddress || 'unknown';
    },
    skip = () => false,
    onLimitReached = null
  } = options;

  return async (req, res, next) => {
    try {
      // Skip rate limiting if skip function returns true
      if (skip(req)) {
        return next();
      }

      // Generate rate limit key
      const key = keyGenerator(req);
      const identifier = `rate_limit:${key}`;

      // Increment rate limit counter
      const currentCount = await RedisService.incrementRateLimit(identifier, windowMs);

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': max,
        'X-RateLimit-Remaining': Math.max(0, max - currentCount),
        'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString()
      });

      // Check if rate limit exceeded
      if (currentCount > max) {
        // Call onLimitReached callback if provided
        if (onLimitReached) {
          onLimitReached(req, res, currentCount);
        }

        return res.status(429).json({
          success: false,
          message,
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // If Redis fails, allow the request to proceed
      next();
    }
  };
};

// Pre-configured rate limiters
export const rateLimiters = {
  // General API rate limiting
  general: createRedisRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    message: 'Too many API requests, please try again later.'
  }),

  // Authentication rate limiting
  auth: createRedisRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Too many authentication attempts, please try again later.',
    keyGenerator: (req) => `auth:${req.ip || req.connection.remoteAddress || 'unknown'}`
  }),

  // Login rate limiting
  login: createRedisRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many login attempts, please try again later.',
    keyGenerator: (req) => `login:${req.ip || req.connection.remoteAddress || 'unknown'}`
  }),

  // Registration rate limiting
  register: createRedisRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: 'Too many registration attempts, please try again later.',
    keyGenerator: (req) => `register:${req.ip || req.connection.remoteAddress || 'unknown'}`
  }),

  // Password reset rate limiting
  passwordReset: createRedisRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: 'Too many password reset attempts, please try again later.',
    keyGenerator: (req) => `password_reset:${req.ip || req.connection.remoteAddress || 'unknown'}`
  }),

  // File upload rate limiting
  upload: createRedisRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: 'Too many file uploads, please try again later.',
    keyGenerator: (req) => `upload:${req.user?.id || req.ip || 'unknown'}`
  }),

  // Post creation rate limiting
  postCreation: createRedisRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: 'Too many posts created, please try again later.',
    keyGenerator: (req) => `post_creation:${req.user?.id || 'unknown'}`
  }),

  // Comment rate limiting
  comments: createRedisRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    message: 'Too many comments, please try again later.',
    keyGenerator: (req) => `comments:${req.user?.id || 'unknown'}`
  }),

  // Message rate limiting
  messages: createRedisRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    message: 'Too many messages sent, please slow down.',
    keyGenerator: (req) => `messages:${req.user?.id || 'unknown'}`
  }),

  // Live chat rate limiting
  liveChat: createRedisRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: 'Too many live chat messages, please slow down.',
    keyGenerator: (req) => `live_chat:${req.user?.id || 'unknown'}`
  }),

  // Search rate limiting
  search: createRedisRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 50,
    message: 'Too many search requests, please try again later.',
    keyGenerator: (req) => `search:${req.user?.id || req.ip || 'unknown'}`
  }),

  // Notification rate limiting
  notifications: createRedisRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: 'Too many notification requests, please try again later.',
    keyGenerator: (req) => `notifications:${req.user?.id || 'unknown'}`
  })
};

// Dynamic rate limiter for specific actions
export const createActionRateLimit = (action, maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  return createRedisRateLimit({
    windowMs,
    max: maxAttempts,
    message: `Too many ${action} attempts, please try again later.`,
    keyGenerator: (req) => `${action}:${req.user?.id || req.ip || 'unknown'}`
  });
};

// User-specific rate limiter
export const createUserRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  return createRedisRateLimit({
    windowMs,
    max: maxRequests,
    message: 'Rate limit exceeded for your account.',
    keyGenerator: (req) => `user:${req.user?.id || 'anonymous'}`,
    skip: (req) => !req.user // Skip for non-authenticated users
  });
};

// IP-specific rate limiter
export const createIPRateLimit = (maxRequests = 50, windowMs = 15 * 60 * 1000) => {
  return createRedisRateLimit({
    windowMs,
    max: maxRequests,
    message: 'Rate limit exceeded for your IP address.',
    keyGenerator: (req) => `ip:${req.ip || req.connection.remoteAddress || 'unknown'}`
  });
};

export default {
  createRedisRateLimit,
  rateLimiters,
  createActionRateLimit,
  createUserRateLimit,
  createIPRateLimit
};
