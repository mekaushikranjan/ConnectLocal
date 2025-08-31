import express from 'express';
import { sequelize } from './config/database.js';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { createServer } from 'http';
import 'express-async-errors';
import 'dotenv/config';

// Import Redis services
import { connectRedis, testRedisConnection } from './config/redis.js';
import RedisService from './services/redisService.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';
import jobRoutes from './routes/jobs.js';
import jobApplicationRoutes from './routes/job-applications.js';
import marketplaceRoutes from './routes/marketplace.js';
import chatRoutes from './routes/chats.js';
import messageRoutes from './routes/messages.js';
import notificationRoutes from './routes/notifications.js';
import locationRoutes from './routes/location.js';
import adminRoutes from './routes/admin.js';
import moderatorRoutes from './routes/moderator.js';
import reportRoutes from './routes/reports.js';
import uploadRoutes from './routes/upload.js';
import connectionRoutes from './routes/connections.js';
import groupRoutes from './routes/groups.js';
import livechatRoutes from './routes/livechat.js';
import supportticketRoutes from './routes/supportticket.js';
import supportRoutes from './routes/support.js';
import privacyRoutes from './routes/privacy.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { logNetworkInfo, getLocalIP, getClientIP, getNetworkInterfaces } from './utils/networkUtils.js';
import { rateLimiters } from './middleware/redisRateLimit.js';

// Import enhanced socket handler
import RedisSocketHandler from './socket/redisSocketHandler.js';

// Import cron service
import cronService from './services/cronService.js';

// Import all models to ensure correct sync order
import './models/index.js';



const app = express();
const server = createServer(app);

// Initialize Redis connection
let redisConnected = false;
try {
  await connectRedis();
  redisConnected = await testRedisConnection();
  if (redisConnected) {
    console.log('✅ Redis connected successfully');
  }
} catch (error) {
 
}

// Initialize enhanced Socket.IO with Redis adapter
let socketHandler = null;
let io = null;
try {
  socketHandler = new RedisSocketHandler();
  io = await socketHandler.initialize(server);
  
  // Make io accessible to routes
  app.set('io', io);
  app.set('socketHandler', socketHandler);
} catch (error) {
  // Continue without Socket.IO
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Essential middleware first
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// CORS configuration for React Native - Universal Network Support
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps)
    if (!origin) return callback(null, true);
    
    // In production, only allow configured origins
    if (process.env.NODE_ENV === 'production') {
      const configuredOrigins = [process.env.FRONTEND_URL, process.env.CORS_ORIGIN].filter(Boolean);
      if (process.env.CORS_ORIGIN === '*' || configuredOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    }
    
    // In development, allow all origins for mobile app testing
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'User-Agent', 'X-API-Key'],
  exposedHeaders: ['Content-Length', 'X-Total-Count', 'X-Auth-Token']
}));

// Redis-based rate limiting
if (process.env.NODE_ENV === 'production') {
  app.use('/api/', rateLimiters.general);
  app.use('/api/auth/', rateLimiters.auth);
  app.use('/api/auth/login', rateLimiters.login);
  app.use('/api/auth/register', rateLimiters.register);
  app.use('/api/auth/forgot-password', rateLimiters.passwordReset);
  app.use('/api/upload/', rateLimiters.upload);
  app.use('/api/posts/', rateLimiters.postCreation);
  app.use('/api/comments/', rateLimiters.comments);
  app.use('/api/messages/', rateLimiters.messages);
  app.use('/api/livechat/', rateLimiters.liveChat);
  app.use('/api/search/', rateLimiters.search);
  app.use('/api/notifications/', rateLimiters.notifications);
}

// Request logging for debugging
app.use((req, res, next) => {
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));



// Client connection logging for mobile device debugging
app.use((req, res, next) => {
  next();
});

// Root endpoint for basic connectivity test
app.get('/', (req, res) => {
  const localIP = getLocalIP();
  const port = process.env.PORT || 5000;
  
  res.json({
    message: 'LocalConnect API is running!',
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    network: {
      serverIP: localIP,
      serverPort: port,
      clientIP: getClientIP(req),
      accessibleFrom: 'Any network (0.0.0.0)',
      mobileReady: true
    },
    endpoints: {
      api: `http://${localIP}:${port}/api`,
      health: `http://${localIP}:${port}/health`,
      networkInfo: `http://${localIP}:${port}/network-info`,
      docs: `http://${localIP}:${port}/api-docs`
    }
  });
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Check the health status of the API and its dependencies
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "OK"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: "development"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 redis:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                     status:
 *                       type: string
 *                 database:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                     status:
 *                       type: string
 */
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    let dbStatus = 'disconnected';
    try {
      await sequelize.authenticate();
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'error';
    }

    // Test Redis connection
    let redisStatus = 'disconnected';
    if (redisConnected) {
      try {
        await RedisService.healthCheck();
        redisStatus = 'connected';
      } catch (error) {
        redisStatus = 'error';
      }
    }

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      redis: {
        connected: redisConnected,
        status: redisStatus
      },
      database: {
        connected: dbStatus === 'connected',
        status: dbStatus
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});


/**
 * @swagger
 * /network-info:
 *   get:
 *     summary: Get network information
 *     description: Get network configuration information for mobile device setup
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Network information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     serverIP:
 *                       type: string
 *                       description: Local server IP address
 *                       example: "192.168.1.100"
 *                     serverPort:
 *                       type: number
 *                       description: Server port number
 *                       example: 5000
 *                     clientIP:
 *                       type: string
 *                       description: Client IP address
 *                       example: "192.168.1.101"
 *                     networkInterfaces:
 *                       type: object
 *                       description: Available network interfaces
 *                     apiBaseUrl:
 *                       type: string
 *                       description: Base URL for API endpoints
 *                       example: "http://192.168.1.100:5000/api"
 *                     healthCheck:
 *                       type: string
 *                       description: Health check endpoint URL
 *                       example: "http://192.168.1.100:5000/health"
 *                     environment:
 *                       type: string
 *                       description: Current environment
 *                       example: "development"
 *                     corsEnabled:
 *                       type: boolean
 *                       description: Whether CORS is enabled
 *                       example: true
 *                     supportedNetworks:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Supported network types
 *                       example: ["192.168.x.x (Home networks)", "10.x.x.x (Corporate networks)"]
 */
// Network information endpoint for mobile device setup
app.get('/network-info', (req, res) => {
  const localIP = getLocalIP();
  const networkInterfaces = getNetworkInterfaces();
  const clientIP = getClientIP(req);
  const port = process.env.PORT || 5000;
  
  res.json({
    success: true,
    data: {
      serverIP: localIP,
      serverPort: port,
      clientIP: clientIP,
      networkInterfaces: networkInterfaces,
      apiBaseUrl: `http://${localIP}:${port}/api`,
      socketUrl: `http://${localIP}:${port}`,
      healthCheck: `http://${localIP}:${port}/health`,
      environment: process.env.NODE_ENV || 'development',
      corsEnabled: true,
      timestamp: new Date().toISOString(),
      supportedNetworks: [
        '192.168.x.x (Home networks)',
        '10.x.x.x (Corporate networks)', 
        '172.16-31.x.x (Enterprise networks)',
        'localhost (Local development)'
      ],
      mobileConfig: {
        reactNative: {
          apiUrl: `http://${localIP}:${port}/api`,
          socketUrl: `http://${localIP}:${port}`,
          timeout: 10000
        },
        expo: {
          apiUrl: `http://${localIP}:${port}/api`,
          socketUrl: `http://${localIP}:${port}`,
          timeout: 10000
        }
      }
    }
  });
});

// API documentation setup
const setupSwaggerRoutes = async () => {
  try {
    // Enable Swagger in all environments for better API documentation access
    const { default: swaggerUi } = await import('swagger-ui-express');
    const { default: swaggerSpec } = await import('./config/swagger.js');

    // Serve Swagger UI with enhanced frontend-like styling
    app.use(['/api-docs', '/docs'], swaggerUi.serve);
    app.get(['/api-docs', '/docs'], swaggerUi.setup(swaggerSpec, {
      customCss: swaggerSpec.customCss,
      customSiteTitle: 'LocalConnect API - Modern Documentation',
      customfavIcon: '/favicon.ico',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        filter: true,
        showRequestHeaders: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
        displayRequestDuration: true,
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
        displayOperationId: false,
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
        validatorUrl: null,
        deepLinking: true,
        layout: 'BaseLayout',
        showExtensions: true,
        showCommonExtensions: true,
      }
    }));

    // Serve Swagger JSON
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    // Serve enhanced API documentation HTML
    app.get('/api-docs-enhanced', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'public', 'api-docs.html'));
    });

  } catch (error) {
    throw error;
  }
};

// Initialize Swagger docs
await setupSwaggerRoutes().catch(err => {
});

// Auto-add /api prefix for frontend requests
app.use((req, res, next) => {
  // Skip if request already has /api prefix or is for static files/docs
  if (req.path.startsWith('/api/') || 
      req.path.startsWith('/api-docs') || 
      req.path.startsWith('/docs') || 
      req.path === '/' || 
      req.path === '/health' ||
      req.path === '/network-info' ||
      req.path.startsWith('/static/') ||
      req.path.includes('.')) {
    return next();
  }
  
  // Redirect requests without /api prefix to include it
  const newPath = `/api${req.path}`;
  
  // For GET requests, redirect
  if (req.method === 'GET') {
    return res.redirect(newPath);
  }
  
  // For other methods (POST, PUT, DELETE, etc.), rewrite the URL
  req.url = newPath;
  next();
});

// Mount API routes after all middleware

// Core routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/job-applications', jobApplicationRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/moderator', moderatorRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/livechat', livechatRoutes);
app.use('/api/supportticket', supportticketRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/privacy', privacyRoutes);


// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use(errorHandler);

// Database connection with better error handling
const initializeDatabase = async () => {
  try {
    
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');

    
    // Database sync configuration - PRESERVE DATA BY DEFAULT
    const forceSync = process.env.FORCE_SYNC === 'true';
    const alterSync = process.env.ALTER_SYNC === 'true';
    
    // Prevent force sync in production
    if (process.env.NODE_ENV === 'production' && forceSync) {
      process.exit(1);
    }
    
    // Use conservative sync options to preserve data - ALWAYS SAFE BY DEFAULT
    const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    let syncOptions = {};
    
    if (forceSync) {
      console.warn('⚠️  WARNING: Using FORCE_SYNC - this will DROP ALL TABLES and recreate them!');
      syncOptions = { force: true };
    } else {
      // Always use safe sync by default - no automatic alter sync
      syncOptions = {}; // Safe sync - only creates missing tables
    }
  
    // Database sync mode
    await sequelize.sync(syncOptions);
    
    // Initialize cron service after database is ready
    if (process.env.ENABLE_SCHEDULED_POSTS === 'true' || process.env.NODE_ENV === 'development') {
      cronService.init();
    }
    
    return true;
  } catch (error) {
   
    return false;
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  // SIGTERM received. Shutting down gracefully...
  cronService.stop();
  server.close(async () => {
    await sequelize.close();
    // SQL database connection closed.
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  // SIGINT received. Shutting down gracefully...
  cronService.stop();
  server.close(async () => {
    await sequelize.close();
    // SQL database connection closed.
    process.exit(0);
  });
});

const PORT = process.env.PORT || 5000;

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize database first
    const dbInitialized = await initializeDatabase();
    
    if (!dbInitialized) {
     
      process.exit(1);
    }
    
    // Start the server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server started on port ${PORT}`);
      console.log(`🌐 Server is accessible from any network interface`);
      
      const localIP = getLocalIP();
      const networkInterfaces = getNetworkInterfaces();
      
      console.log(`📱 Mobile App Connection URLs:`);
      console.log(`   Local: http://localhost:${PORT}/api`);
      console.log(`   Network: http://${localIP}:${PORT}/api`);
      console.log(`   Health Check: http://${localIP}:${PORT}/health`);
      console.log(`   Network Info: http://${localIP}:${PORT}/network-info`);
      
      console.log(`🔧 Available Network Interfaces:`);
      Object.keys(networkInterfaces).forEach(interfaceName => {
        networkInterfaces[interfaceName].forEach(netIf => {
        });
      });
      if (process.env.NODE_ENV === 'development') {
        
      }
    });
    
  } catch (error) {
    process.exit(1);
  }
};

// Start the server
startServer();



export { app, server, io };