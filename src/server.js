import express from 'express';
import { sequelize } from './config/database.js';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import 'express-async-errors';
import 'dotenv/config';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';
import jobRoutes from './routes/jobs.js';
import marketplaceRoutes from './routes/marketplace.js';
import chatRoutes from './routes/chats.js';
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

// Import socket handler
import { initializeSocket, socketHandler } from './socket/socketHandler.js';

// Import cron service
import cronService from './services/cronService.js';

// Import all models to ensure correct sync order
import './models/index.js';

const app = express();
const server = createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);

// Apply socket handler to initialized io instance
socketHandler(io);

// Make io accessible to routes
app.set('io', io);

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

// CORS configuration for React Native - Universal Private Network Support
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.CORS_ORIGIN === '*' ? true : [process.env.FRONTEND_URL, process.env.CORS_ORIGIN].filter(Boolean))
    : [
        // Localhost variations
        "http://localhost:3000", 
        "http://localhost:8081",
        "exp://localhost:8081",
        
        // Common private network ranges
        // 192.168.x.x (most common home networks)
        /^https?:\/\/192\.168\.\d+\.\d+:\d+$/,
        /^exp:\/\/192\.168\.\d+\.\d+:\d+$/,
        
        // 10.x.x.x (corporate/enterprise networks)
        /^https?:\/\/10\.\d+\.\d+\.\d+:\d+$/,
        /^exp:\/\/10\.\d+\.\d+\.\d+:\d+$/,
        
        // 172.16-31.x.x (corporate networks)
        /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+$/,
        /^exp:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+$/,
        
        // Specific IPs for development
        "http://10.249.208.235:8081", 
        "exp://10.249.208.235:8081", 
        "http://10.39.204.235:8081",
        "exp://10.39.204.235:8081",
        "http://192.168.1.100:8081",
        "exp://192.168.1.100:8081",
        "http://192.168.0.100:8081", 
        "exp://192.168.0.100:8081",
        
        // Allow any port for development flexibility
        /^https?:\/\/192\.168\.\d+\.\d+:\d+$/,
        /^exp:\/\/192\.168\.\d+\.\d+:\d+$/,
        /^https?:\/\/10\.\d+\.\d+\.\d+:\d+$/,
        /^exp:\/\/10\.\d+\.\d+\.\d+:\d+$/,
        /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+$/,
        /^exp:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+$/
      ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'User-Agent', 'X-Real-IP', 'X-Forwarded-For'],
  exposedHeaders: ['Content-Length', 'X-Requested-With', 'X-Total-Count']
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health', // Skip rate limiting for health checks
});

// Apply rate limiting to API routes
app.use('/api/', limiter);

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/', authLimiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
  app.use(morgan(morganFormat, { 
    skip: (req) => req.path === '/health' // Skip logging health checks in production
  }));
}

// Client connection logging for mobile device debugging
app.use((req, res, next) => {
  next();
});

// Root endpoint for basic connectivity test
app.get('/', (req, res) => {
  res.json({
    message: 'LocalConnect API is running!',
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const startTime = Date.now();
  let dbStatus = 'ERROR';
  let statusCode = 500;
  let errorMessage = null;

  try {
    // Test database connection
    await sequelize.authenticate();
    dbStatus = 'OK';
    statusCode = 200;
  } catch (error) {
    // Database health check failed
    errorMessage = error.message;
  }

  const responseTime = Date.now() - startTime;
  const response = {
    status: dbStatus === 'OK' ? 'OK' : 'ERROR',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    responseTime: `${responseTime}ms`,
    database: {
      status: dbStatus,
      dialect: sequelize.getDialect(),
      host: process.env.DB_HOST
    }
  };

  // Console logging for health checks
  const logMessage = `[HEALTH CHECK] ${new Date().toISOString()} - Status: ${response.status} | DB: ${dbStatus} | Response Time: ${responseTime}ms | Client IP: ${req.ip || req.connection.remoteAddress}`;
  
  if (dbStatus === 'OK') {
    console.log(`✅ ${logMessage}`);
  } else {
    console.error(`❌ ${logMessage} | Error: ${errorMessage}`);
  }

  res.status(statusCode).json(response);
});

// Network information endpoint for mobile device setup
app.get('/network-info', (req, res) => {
  const localIP = getLocalIP();
  const networkInterfaces = getNetworkInterfaces();
  const clientIP = getClientIP(req);
  
  res.json({
    success: true,
    data: {
      serverIP: localIP,
      serverPort: process.env.PORT || 5000,
      clientIP: clientIP,
      networkInterfaces: networkInterfaces,
      apiBaseUrl: `http://${localIP}:${process.env.PORT || 5000}/api`,
      healthCheck: `http://${localIP}:${process.env.PORT || 5000}/health`,
      environment: process.env.NODE_ENV || 'development',
      corsEnabled: true,
      supportedNetworks: [
        '192.168.x.x (Home networks)',
        '10.x.x.x (Corporate networks)', 
        '172.16-31.x.x (Enterprise networks)',
        'localhost (Local development)'
      ]
    }
  });
});

// API documentation setup
const setupSwaggerRoutes = async () => {
  // Only enable Swagger in development or if explicitly enabled in production
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_SWAGGER !== 'true') {
    return;
  }

  const { default: swaggerUi } = await import('swagger-ui-express');
  const { default: swaggerSpec } = await import('./config/swagger.js');

  // Serve Swagger UI
  app.use(['/api-docs', '/docs'], swaggerUi.serve);
  app.get(['/api-docs', '/docs'], swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: process.env.SWAGGER_TITLE || 'LocalConnect API Documentation',
    swaggerOptions: {
      persistAuthorization: true
    }
  }));

  // Serve Swagger JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

};

// Initialize Swagger docs
await setupSwaggerRoutes().catch(err => {
  // Failed to initialize Swagger documentation
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/chats', chatRoutes);
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
    console.log('Database connection established successfully.');
    
    // Database sync configuration
    const forceSync = process.env.NODE_ENV === 'development' && process.env.FORCE_SYNC === 'true';
    const alterSync = process.env.NODE_ENV === 'development' || process.env.ALTER_SYNC === 'true';
    
    if (process.env.NODE_ENV === 'production' && forceSync) {
      console.error('Force sync is not allowed in production!');
      process.exit(1);
    }
    
    // For development, force sync to fix schema issues
    // If NODE_ENV is not set, treat as development
    const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    const syncOptions = isDevelopment 
      ? { force: true } // Force sync in development to fix schema issues
      : { alter: alterSync && !forceSync }; // Use alter in production
    
    console.log(`Database sync mode: ${isDevelopment ? 'force' : 'alter'} (NODE_ENV: ${process.env.NODE_ENV || 'not set'})`);
    
    // Database sync mode
    await sequelize.sync(syncOptions);
    
    console.log('Database synchronized successfully.');
    
    // Initialize cron service after database is ready
    if (process.env.ENABLE_SCHEDULED_POSTS === 'true' || process.env.NODE_ENV === 'development') {
      cronService.init();
      console.log('Cron service initialized.');
    } else {
      console.log('Cron service disabled.');
    }
    
    return true;
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    console.error('Please check your database configuration and ensure the database is running.');
    console.error('Environment variables needed:');
    console.error('- DATABASE_URL (production)');
    console.error('- DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (development)');
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
      console.error('Failed to initialize database. Server will not start.');
      process.exit(1);
    }
    
         // Start the server
     server.listen(PORT, '0.0.0.0', () => {
       const baseUrl = process.env.NODE_ENV === 'production' 
         ? `https://${process.env.FRONTEND_URL?.replace('https://', '').replace('http://', '') || 'localhost'}:${PORT}`
         : `http://localhost:${PORT}`;
         
       console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
       console.log(`🌐 Server bound to 0.0.0.0:${PORT}`);
       console.log(`🔗 Health check available at: http://0.0.0.0:${PORT}/health`);
       
       if (process.env.NODE_ENV === 'development') {
         // Log comprehensive network information for mobile device connectivity
         logNetworkInfo(PORT);
         
         const localIP = getLocalIP();
         const networkUrl = `http://${localIP}:${PORT}`;
         
        
       } else {
         console.log(`📊 Production server ready for connections`);
       }
     });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

// Auto health check after server starts
const runAutoHealthCheck = async () => {
  try {
    const startTime = Date.now();
    let dbStatus = 'ERROR';
    let errorMessage = null;

    try {
      // Test database connection
      await sequelize.authenticate();
      dbStatus = 'OK';
    } catch (error) {
      errorMessage = error.message;
    }

    const responseTime = Date.now() - startTime;
    const logMessage = `[AUTO HEALTH CHECK] ${new Date().toISOString()} - Status: ${dbStatus === 'OK' ? 'OK' : 'ERROR'} | DB: ${dbStatus} | Response Time: ${responseTime}ms | Server Startup`;
    
    if (dbStatus === 'OK') {
      console.log(`✅ ${logMessage}`);
    } else {
      console.error(`❌ ${logMessage} | Error: ${errorMessage}`);
    }
  } catch (error) {
    console.error(`❌ [AUTO HEALTH CHECK] Failed to run health check: ${error.message}`);
  }
};

// Run health check 5 seconds after server starts
setTimeout(runAutoHealthCheck, 5000);

export { app, server, io };