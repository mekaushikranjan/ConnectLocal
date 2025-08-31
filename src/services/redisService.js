import { redisClient } from '../config/redis.js';

class RedisService {
  // Cache TTL constants (in seconds)
  static TTL = {
    USER_PROFILE: 3600, // 1 hour
    POSTS: 1800, // 30 minutes
    MARKETPLACE_ITEMS: 3600, // 1 hour
    JOBS: 3600, // 1 hour
    LOCATION_DATA: 300, // 5 minutes
    NOTIFICATIONS: 1800, // 30 minutes
    SESSION: 86400, // 24 hours
    RATE_LIMIT: 900, // 15 minutes
    LIVE_CHAT: 7200, // 2 hours
    GROUP_DATA: 1800, // 30 minutes
  };

  // Cache keys
  static KEYS = {
    USER_PROFILE: (userId) => `user:profile:${userId}`,
    USER_SESSIONS: (userId) => `user:sessions:${userId}`,
    USER_ONLINE_STATUS: (userId) => `user:online:${userId}`,
    USER_CONNECTIONS: (userId) => `user:connections:${userId}`,
    POSTS_FEED: (userId) => `posts:feed:${userId}`,
    POST_DETAILS: (postId) => `post:details:${postId}`,
    MARKETPLACE_ITEMS: (location) => `marketplace:items:${location}`,
    JOB_LISTINGS: (location) => `jobs:listings:${location}`,
    NOTIFICATIONS: (userId) => `notifications:${userId}`,
    UNREAD_COUNT: (userId) => `notifications:unread:${userId}`,
    LIVE_CHAT_SESSION: (sessionId) => `livechat:session:${sessionId}`,
    LIVE_CHAT_MESSAGES: (sessionId) => `livechat:messages:${sessionId}`,
    GROUP_MEMBERS: (groupId) => `group:members:${groupId}`,
    RATE_LIMIT: (identifier) => `ratelimit:${identifier}`,
    LOCATION_USERS: (location) => `location:users:${location}`,
    TRENDING_POSTS: (location) => `trending:posts:${location}`,
  };

  // Session Management
  static async setUserSession(userId, sessionData, ttl = this.TTL.SESSION) {
    try {
      const key = this.KEYS.USER_SESSIONS(userId);
      await redisClient.setEx(key, ttl, JSON.stringify(sessionData));
      return true;
    } catch (error) {
      console.error('Error setting user session:', error);
      return false;
    }
  }

  static async getUserSession(userId) {
    try {
      const key = this.KEYS.USER_SESSIONS(userId);
      const session = await redisClient.get(key);
      return session ? JSON.parse(session) : null;
    } catch (error) {
      console.error('Error getting user session:', error);
      return null;
    }
  }

  static async deleteUserSession(userId) {
    try {
      const key = this.KEYS.USER_SESSIONS(userId);
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error('Error deleting user session:', error);
      return false;
    }
  }

  // User Online Status
  static async setUserOnline(userId, socketId) {
    try {
      const key = this.KEYS.USER_ONLINE_STATUS(userId);
      await redisClient.setEx(key, this.TTL.SESSION, socketId);
      return true;
    } catch (error) {
      console.error('Error setting user online:', error);
      return false;
    }
  }

  static async setUserOffline(userId) {
    try {
      const key = this.KEYS.USER_ONLINE_STATUS(userId);
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error('Error setting user offline:', error);
      return false;
    }
  }

  static async isUserOnline(userId) {
    try {
      const key = this.KEYS.USER_ONLINE_STATUS(userId);
      const socketId = await redisClient.get(key);
      return !!socketId;
    } catch (error) {
      console.error('Error checking user online status:', error);
      return false;
    }
  }

  // User Profile Caching
  static async cacheUserProfile(userId, profileData) {
    try {
      const key = this.KEYS.USER_PROFILE(userId);
      await redisClient.setEx(key, this.TTL.USER_PROFILE, JSON.stringify(profileData));
      return true;
    } catch (error) {
      console.error('Error caching user profile:', error);
      return false;
    }
  }

  static async getCachedUserProfile(userId) {
    try {
      const key = this.KEYS.USER_PROFILE(userId);
      const profile = await redisClient.get(key);
      return profile ? JSON.parse(profile) : null;
    } catch (error) {
      console.error('Error getting cached user profile:', error);
      return null;
    }
  }

  static async invalidateUserProfile(userId) {
    try {
      const key = this.KEYS.USER_PROFILE(userId);
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error('Error invalidating user profile:', error);
      return false;
    }
  }

  // Posts Caching
  static async cachePostsFeed(userId, posts, ttl = this.TTL.POSTS) {
    try {
      const key = this.KEYS.POSTS_FEED(userId);
      await redisClient.setEx(key, ttl, JSON.stringify(posts));
      return true;
    } catch (error) {
      console.error('Error caching posts feed:', error);
      return false;
    }
  }

  static async getCachedPostsFeed(userId) {
    try {
      const key = this.KEYS.POSTS_FEED(userId);
      const posts = await redisClient.get(key);
      return posts ? JSON.parse(posts) : null;
    } catch (error) {
      console.error('Error getting cached posts feed:', error);
      return null;
    }
  }

  static async cachePostDetails(postId, postData) {
    try {
      const key = this.KEYS.POST_DETAILS(postId);
      await redisClient.setEx(key, this.TTL.POSTS, JSON.stringify(postData));
      return true;
    } catch (error) {
      console.error('Error caching post details:', error);
      return false;
    }
  }

  static async getCachedPostDetails(postId) {
    try {
      const key = this.KEYS.POST_DETAILS(postId);
      const post = await redisClient.get(key);
      return post ? JSON.parse(post) : null;
    } catch (error) {
      console.error('Error getting cached post details:', error);
      return null;
    }
  }

  // Notifications
  static async cacheNotifications(userId, notifications) {
    try {
      const key = this.KEYS.NOTIFICATIONS(userId);
      await redisClient.setEx(key, this.TTL.NOTIFICATIONS, JSON.stringify(notifications));
      return true;
    } catch (error) {
      console.error('Error caching notifications:', error);
      return false;
    }
  }

  static async getCachedNotifications(userId) {
    try {
      const key = this.KEYS.NOTIFICATIONS(userId);
      const notifications = await redisClient.get(key);
      return notifications ? JSON.parse(notifications) : null;
    } catch (error) {
      console.error('Error getting cached notifications:', error);
      return null;
    }
  }

  static async setUnreadCount(userId, count) {
    try {
      const key = this.KEYS.UNREAD_COUNT(userId);
      await redisClient.setEx(key, this.TTL.NOTIFICATIONS, count.toString());
      return true;
    } catch (error) {
      console.error('Error setting unread count:', error);
      return false;
    }
  }

  static async getUnreadCount(userId) {
    try {
      const key = this.KEYS.UNREAD_COUNT(userId);
      const count = await redisClient.get(key);
      return count ? parseInt(count) : 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Live Chat
  static async cacheLiveChatSession(sessionId, sessionData) {
    try {
      const key = this.KEYS.LIVE_CHAT_SESSION(sessionId);
      await redisClient.setEx(key, this.TTL.LIVE_CHAT, JSON.stringify(sessionData));
      return true;
    } catch (error) {
      console.error('Error caching live chat session:', error);
      return false;
    }
  }

  static async getCachedLiveChatSession(sessionId) {
    try {
      const key = this.KEYS.LIVE_CHAT_SESSION(sessionId);
      const session = await redisClient.get(key);
      return session ? JSON.parse(session) : null;
    } catch (error) {
      console.error('Error getting cached live chat session:', error);
      return null;
    }
  }

  static async cacheLiveChatMessages(sessionId, messages) {
    try {
      const key = this.KEYS.LIVE_CHAT_MESSAGES(sessionId);
      await redisClient.setEx(key, this.TTL.LIVE_CHAT, JSON.stringify(messages));
      return true;
    } catch (error) {
      console.error('Error caching live chat messages:', error);
      return false;
    }
  }

  // Rate Limiting
  static async incrementRateLimit(identifier, windowMs = 900000) { // 15 minutes default
    try {
      const key = this.KEYS.RATE_LIMIT(identifier);
      const current = await redisClient.incr(key);
      
      if (current === 1) {
        await redisClient.expire(key, Math.floor(windowMs / 1000));
      }
      
      return current;
    } catch (error) {
      console.error('Error incrementing rate limit:', error);
      return 1;
    }
  }

  static async getRateLimitCount(identifier) {
    try {
      const key = this.KEYS.RATE_LIMIT(identifier);
      const count = await redisClient.get(key);
      return count ? parseInt(count) : 0;
    } catch (error) {
      console.error('Error getting rate limit count:', error);
      return 0;
    }
  }

  // Location-based Caching
  static async cacheLocationUsers(location, users) {
    try {
      const key = this.KEYS.LOCATION_USERS(location);
      await redisClient.setEx(key, this.TTL.LOCATION_DATA, JSON.stringify(users));
      return true;
    } catch (error) {
      console.error('Error caching location users:', error);
      return false;
    }
  }

  static async getCachedLocationUsers(location) {
    try {
      const key = this.KEYS.LOCATION_USERS(location);
      const users = await redisClient.get(key);
      return users ? JSON.parse(users) : null;
    } catch (error) {
      console.error('Error getting cached location users:', error);
      return null;
    }
  }

  // Trending Posts
  static async cacheTrendingPosts(location, posts) {
    try {
      const key = this.KEYS.TRENDING_POSTS(location);
      await redisClient.setEx(key, this.TTL.POSTS, JSON.stringify(posts));
      return true;
    } catch (error) {
      console.error('Error caching trending posts:', error);
      return false;
    }
  }

  static async getCachedTrendingPosts(location) {
    try {
      const key = this.KEYS.TRENDING_POSTS(location);
      const posts = await redisClient.get(key);
      return posts ? JSON.parse(posts) : null;
    } catch (error) {
      console.error('Error getting cached trending posts:', error);
      return null;
    }
  }

  // Marketplace Caching
  static async cacheMarketplaceItems(location, items) {
    try {
      const key = this.KEYS.MARKETPLACE_ITEMS(location);
      await redisClient.setEx(key, this.TTL.MARKETPLACE_ITEMS, JSON.stringify(items));
      return true;
    } catch (error) {
      console.error('Error caching marketplace items:', error);
      return false;
    }
  }

  static async getCachedMarketplaceItems(location) {
    try {
      const key = this.KEYS.MARKETPLACE_ITEMS(location);
      const items = await redisClient.get(key);
      return items ? JSON.parse(items) : null;
    } catch (error) {
      console.error('Error getting cached marketplace items:', error);
      return null;
    }
  }

  // Job Listings Caching
  static async cacheJobListings(location, jobs) {
    try {
      const key = this.KEYS.JOB_LISTINGS(location);
      await redisClient.setEx(key, this.TTL.JOBS, JSON.stringify(jobs));
      return true;
    } catch (error) {
      console.error('Error caching job listings:', error);
      return false;
    }
  }

  static async getCachedJobListings(location) {
    try {
      const key = this.KEYS.JOB_LISTINGS(location);
      const jobs = await redisClient.get(key);
      return jobs ? JSON.parse(jobs) : null;
    } catch (error) {
      console.error('Error getting cached job listings:', error);
      return null;
    }
  }

  // Group Data Caching
  static async cacheGroupMembers(groupId, members) {
    try {
      const key = this.KEYS.GROUP_MEMBERS(groupId);
      await redisClient.setEx(key, this.TTL.GROUP_DATA, JSON.stringify(members));
      return true;
    } catch (error) {
      console.error('Error caching group members:', error);
      return false;
    }
  }

  static async getCachedGroupMembers(groupId) {
    try {
      const key = this.KEYS.GROUP_MEMBERS(groupId);
      const members = await redisClient.get(key);
      return members ? JSON.parse(members) : null;
    } catch (error) {
      console.error('Error getting cached group members:', error);
      return null;
    }
  }

  // Utility Methods
  static async invalidateUserData(userId) {
    try {
      const keys = [
        this.KEYS.USER_PROFILE(userId),
        this.KEYS.USER_SESSIONS(userId),
        this.KEYS.USER_ONLINE_STATUS(userId),
        this.KEYS.POSTS_FEED(userId),
        this.KEYS.NOTIFICATIONS(userId),
        this.KEYS.UNREAD_COUNT(userId)
      ];
      
      await redisClient.del(keys);
      return true;
    } catch (error) {
      console.error('Error invalidating user data:', error);
      return false;
    }
  }

  static async invalidatePostData(postId) {
    try {
      const keys = [
        this.KEYS.POST_DETAILS(postId)
      ];
      
      await redisClient.del(keys);
      return true;
    } catch (error) {
      console.error('Error invalidating post data:', error);
      return false;
    }
  }

  static async clearAllCache() {
    try {
      await redisClient.flushDb();

      return true;
    } catch (error) {
      return false;
    }
  }

  // Health check
  static async healthCheck() {
    try {
      await redisClient.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }
}

export default RedisService;
