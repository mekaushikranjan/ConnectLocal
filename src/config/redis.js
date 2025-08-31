import { createClient } from 'redis';
import 'dotenv/config';

// Redis configuration
const redisConfig = {
  url: process.env.REDIS_URL || 'redis://default:R3i8JWExclJVM8m6QSceneWSrWNlY03e@redis-14143.c240.us-east-1-3.ec2.redns.redis-cloud.com:14143',
  socket: {
    connectTimeout: 10000,
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('Redis connection failed after 10 retries');
        return new Error('Redis connection failed');
      }
      return Math.min(retries * 100, 3000);
    }
  },
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3
};

// Create Redis client
const redisClient = createClient(redisConfig);

// Redis connection event handlers
redisClient.on('connect', () => {
  // Redis client connected
});

redisClient.on('ready', () => {
  // Redis client ready
});

redisClient.on('error', (err) => {
  console.error('❌ Redis client error:', err);
});

redisClient.on('end', () => {
  // Redis client disconnected
});

redisClient.on('reconnecting', () => {
  // Redis client reconnecting
});

// Connect to Redis
const connectRedis = async () => {
  try {
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    throw error;
  }
};

// Graceful shutdown
const disconnectRedis = async () => {
  try {
    await redisClient.quit();
    console.log('✅ Redis client disconnected gracefully');
  } catch (error) {
    console.error('❌ Error disconnecting Redis:', error);
  }
};

// Test Redis connection
const testRedisConnection = async () => {
  try {
    await redisClient.ping();
    return true;
  } catch (error) {
    console.error('❌ Redis connection test failed:', error);
    return false;
  }
};

export { redisClient, connectRedis, disconnectRedis, testRedisConnection };
export default redisClient;
