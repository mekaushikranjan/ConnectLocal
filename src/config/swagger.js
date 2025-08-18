import swaggerJSDoc from 'swagger-jsdoc';

// Environment-based configuration
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';
const isStaging = process.env.NODE_ENV === 'staging';

// Base URL configuration for different environments
const getBaseUrl = () => {
  if (isProduction) {
    return process.env.BACKEND_URL || 'https://connectlocal-rjwq.onrender.com';
  } else if (isStaging) {
    return process.env.BACKEND_URL || 'https://connectlocal-rjwq.onrender.com';
  } else {
    return `http://localhost:${process.env.PORT || 5000}`;
  }
};

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'LocalConnect API',
    version: '1.0.0',
    description: `
# LocalConnect API Documentation

## Overview
LocalConnect is a comprehensive local community platform that connects people, businesses, and services in their neighborhood. This API provides all the functionality needed to build a complete community application.

## 🚀 Features
- **User Management**: Registration, authentication, profile management, privacy controls
- **Posts & Content**: Create, share, and interact with community posts with rich media support
- **Marketplace**: Buy, sell, and trade items locally with advanced filtering
- **Job Board**: Post and find local job opportunities with matching algorithms
- **Live Chat**: Real-time communication between users with group chat support
- **Notifications**: Push notifications and in-app alerts with customization
- **Privacy & Security**: Advanced privacy controls, data protection, and moderation tools
- **Location Services**: Location-based features and proximity matching
- **Admin Panel**: Comprehensive administrative and moderation tools

## 🔐 Authentication
Most endpoints require authentication using JWT Bearer tokens. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## 📊 Rate Limiting
API requests are rate-limited to ensure fair usage:
- **General endpoints**: 100 requests per minute
- **Authentication endpoints**: 5 requests per minute
- **File uploads**: 10 requests per minute
- **Search endpoints**: 50 requests per minute

## ⚠️ Error Handling
The API uses standard HTTP status codes and returns detailed error messages:
- \`400\`: Bad Request - Invalid input data
- \`401\`: Unauthorized - Authentication required
- \`403\`: Forbidden - Insufficient permissions
- \`404\`: Not Found - Resource not found
- \`429\`: Too Many Requests - Rate limit exceeded
- \`500\`: Internal Server Error - Server error

## 🔗 API Endpoints
- **Authentication**: \`/api/auth\` - User registration, login, verification
- **Users**: \`/api/users\` - Profile management and user operations
- **Posts**: \`/api/posts\` - Community posts and interactions
- **Marketplace**: \`/api/marketplace\` - Buy/sell items locally
- **Jobs**: \`/api/jobs\` - Job postings and applications
- **Chats**: \`/api/chats\` - Messaging and conversations
- **Notifications**: \`/api/notifications\` - Push notifications
- **Location**: \`/api/location\` - Location-based services
- **Admin**: \`/api/admin\` - Administrative functions
- **Moderator**: \`/api/moderator\` - Content moderation
- **Reports**: \`/api/reports\` - User and content reporting
- **Upload**: \`/api/upload\` - File upload services
- **Connections**: \`/api/connections\` - User connections/friends
- **Groups**: \`/api/groups\` - Community groups
- **Live Chat**: \`/api/livechat\` - Real-time support chat
- **Support**: \`/api/support\` - Customer support
- **Privacy**: \`/api/privacy\` - Privacy settings and data management

## 📱 Mobile Support
This API is optimized for React Native applications with:
- Universal private network support (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
- CORS configuration for mobile development
- File upload support for images and documents
- Real-time notifications via WebSocket

## 🛠️ Development
- **Health Check**: \`GET /\` - API status and health information
- **Network Info**: \`GET /network-info\` - Network configuration for mobile setup
- **API Docs**: \`GET /api-docs\` - Interactive API documentation

## 📞 Support
For API support, contact: api-support@localconnect.com
    `,
    contact: {
      name: 'LocalConnect API Support',
      email: 'api-support@localconnect.com',
      url: 'https://localconnect.com/support',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
    termsOfService: 'https://localconnect.com/terms',
  },
  servers: [
    {
      url: getBaseUrl(),
      description: isProduction ? 'Production server' : isStaging ? 'Staging server' : 'Development server',
    },
    ...(isDevelopment ? [{
      url: 'http://localhost:3000',
      description: 'Local development server',
    }] : []),
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'User registration, login, verification, and authentication endpoints',
    },
    {
      name: 'Users',
      description: 'User profile management, settings, and user-related operations',
    },
    {
      name: 'Posts',
      description: 'Community posts, comments, interactions, and content management',
    },
    {
      name: 'Marketplace',
      description: 'Buy, sell, and trade items in the local marketplace with advanced features',
    },
    {
      name: 'Jobs',
      description: 'Job postings, applications, and employment-related features',
    },
    {
      name: 'Chats',
      description: 'Real-time messaging, conversations, and chat functionality',
    },
    {
      name: 'Notifications',
      description: 'Push notifications, in-app alerts, and notification management',
    },
    {
      name: 'Location',
      description: 'Location-based services, proximity features, and geographic data',
    },
    {
      name: 'Admin',
      description: 'Administrative functions, user management, and system controls',
    },
    {
      name: 'Moderator',
      description: 'Content moderation, user management, and community safety',
    },
    {
      name: 'Reports',
      description: 'User and content reporting, safety features, and abuse prevention',
    },
    {
      name: 'Upload',
      description: 'File upload services for images, documents, and media',
    },
    {
      name: 'Connections',
      description: 'User connections, friends, and social networking features',
    },
    {
      name: 'Groups',
      description: 'Community groups, group management, and collaborative features',
    },
    {
      name: 'Live Chat',
      description: 'Real-time support chat and customer service features',
    },
    {
      name: 'Support',
      description: 'Customer support, help desk, and assistance features',
    },
    {
      name: 'Privacy',
      description: 'Privacy settings, data management, and security controls',
    },
    {
      name: 'System',
      description: 'System health, network information, and API status endpoints',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from login endpoint. Include in Authorization header as "Bearer <token>"',
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for external integrations and third-party services',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          message: {
            type: 'string',
            example: 'Error message description',
          },
          code: {
            type: 'string',
            example: 'VALIDATION_ERROR',
          },
          details: {
            type: 'object',
            description: 'Additional error details',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
        },
        required: ['success', 'message'],
      },
      Success: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          message: {
            type: 'string',
            example: 'Operation completed successfully',
          },
          data: {
            type: 'object',
            description: 'Response data',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
        },
        required: ['success'],
      },
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          username: {
            type: 'string',
            example: 'john_doe',
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'john@example.com',
          },
          displayName: {
            type: 'string',
            example: 'John Doe',
          },
          firstName: {
            type: 'string',
            example: 'John',
          },
          lastName: {
            type: 'string',
            example: 'Doe',
          },
          avatarUrl: {
            type: 'string',
            format: 'uri',
            example: 'https://example.com/avatar.jpg',
          },
          phoneNumber: {
            type: 'string',
            example: '+1234567890',
          },
          emailVerified: {
            type: 'boolean',
            example: true,
          },
          phoneVerified: {
            type: 'boolean',
            example: false,
          },
          location: {
            type: 'object',
            properties: {
              city: { type: 'string', example: 'Mumbai' },
              state: { type: 'string', example: 'Maharashtra' },
              country: { type: 'string', example: 'India' },
              coordinates: {
                type: 'object',
                properties: {
                  latitude: { type: 'number', example: 19.076 },
                  longitude: { type: 'number', example: 72.8777 },
                },
              },
            },
          },
          privacySettings: {
            type: 'object',
            properties: {
              profileVisibility: { type: 'string', enum: ['public', 'friends', 'private'], example: 'public' },
              showLocation: { type: 'boolean', example: true },
              allowMessages: { type: 'boolean', example: true },
            },
          },
          notificationSettings: {
            type: 'object',
            properties: {
              pushNotifications: { type: 'boolean', example: true },
              emailNotifications: { type: 'boolean', example: true },
              smsNotifications: { type: 'boolean', example: false },
            },
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
        },
        required: ['id', 'username', 'email'],
      },
      Post: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          title: {
            type: 'string',
            example: 'Community Event This Weekend',
          },
          content: {
            type: 'string',
            example: 'Join us for a community gathering...',
          },
          authorId: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          author: {
            $ref: '#/components/schemas/User',
          },
          type: {
            type: 'string',
            enum: ['general', 'urgent', 'event', 'announcement', 'lost_found', 'help'],
            example: 'event',
          },
          category: {
            type: 'string',
            enum: ['community', 'business', 'safety', 'entertainment', 'education'],
            example: 'community',
          },
          visibility: {
            type: 'string',
            enum: ['public', 'friends', 'private'],
            example: 'public',
          },
          media: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: { type: 'string', format: 'uri' },
                type: { type: 'string', enum: ['image', 'video', 'document'] },
                filename: { type: 'string' },
              },
            },
          },
          location: {
            type: 'object',
            properties: {
              city: { type: 'string', example: 'Mumbai' },
              state: { type: 'string', example: 'Maharashtra' },
              coordinates: {
                type: 'object',
                properties: {
                  latitude: { type: 'number', example: 19.076 },
                  longitude: { type: 'number', example: 72.8777 },
                },
              },
            },
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            example: ['event', 'community', 'weekend'],
          },
          likesCount: {
            type: 'integer',
            example: 15,
          },
          commentsCount: {
            type: 'integer',
            example: 8,
          },
          isAnonymous: {
            type: 'boolean',
            example: false,
          },
          commentsEnabled: {
            type: 'boolean',
            example: true,
          },
          urgencyLevel: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            example: 'medium',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
        },
        required: ['id', 'content', 'authorId'],
      },
      Comment: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          content: {
            type: 'string',
            example: 'Great event! I will be there.',
          },
          postId: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          authorId: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          author: {
            $ref: '#/components/schemas/User',
          },
          parentId: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
            description: 'For nested comments',
          },
          likesCount: {
            type: 'integer',
            example: 5,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
        },
        required: ['id', 'content', 'postId', 'authorId'],
      },
      MarketplaceItem: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          title: {
            type: 'string',
            example: 'iPhone 13 Pro Max',
          },
          description: {
            type: 'string',
            example: 'Excellent condition, barely used...',
          },
          price: {
            type: 'number',
            example: 45000,
          },
          currency: {
            type: 'string',
            example: 'INR',
          },
          category: {
            type: 'string',
            example: 'electronics',
          },
          condition: {
            type: 'string',
            enum: ['new', 'like-new', 'good', 'fair', 'poor'],
            example: 'good',
          },
          sellerId: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          seller: {
            $ref: '#/components/schemas/User',
          },
          images: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: { type: 'string', format: 'uri' },
                alt: { type: 'string' },
              },
            },
          },
          location: {
            type: 'object',
            properties: {
              city: { type: 'string', example: 'Mumbai' },
              state: { type: 'string', example: 'Maharashtra' },
              coordinates: {
                type: 'object',
                properties: {
                  latitude: { type: 'number', example: 19.076 },
                  longitude: { type: 'number', example: 72.8777 },
                },
              },
            },
          },
          specifications: {
            type: 'object',
            additionalProperties: true,
            example: {
              'Storage': '256GB',
              'Color': 'Sierra Blue',
              'Battery Health': '95%',
            },
          },
          negotiable: {
            type: 'boolean',
            example: true,
          },
          shipping: {
            type: 'object',
            properties: {
              available: { type: 'boolean', example: true },
              cost: { type: 'number', example: 500 },
            },
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            example: ['iphone', 'smartphone', 'electronics'],
          },
          status: {
            type: 'string',
            enum: ['active', 'sold', 'expired', 'removed'],
            example: 'active',
          },
          viewsCount: {
            type: 'integer',
            example: 25,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
        },
        required: ['id', 'title', 'price', 'sellerId'],
      },
      JobPosting: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          title: {
            type: 'string',
            example: 'Senior Frontend Developer',
          },
          company: {
            type: 'string',
            example: 'Tech Corp',
          },
          description: {
            type: 'string',
            example: 'We are looking for an experienced developer...',
          },
          type: {
            type: 'string',
            enum: ['full-time', 'part-time', 'contract', 'freelance', 'internship', 'temporary', 'volunteer'],
            example: 'full-time',
          },
          location: {
            type: 'string',
            example: 'Mumbai, Maharashtra',
          },
          salary: {
            type: 'string',
            example: '₹80,000 - ₹100,000 per year',
          },
          requirements: {
            type: 'array',
            items: { type: 'string' },
            example: ['3+ years experience', 'React knowledge', 'Team player'],
          },
          skills: {
            type: 'array',
            items: { type: 'string' },
            example: ['JavaScript', 'React', 'Node.js'],
          },
          experienceLevel: {
            type: 'string',
            enum: ['entry', 'mid', 'senior', 'executive'],
            example: 'senior',
          },
          locationType: {
            type: 'string',
            enum: ['on-site', 'remote', 'hybrid'],
            example: 'hybrid',
          },
          postedBy: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          poster: {
            $ref: '#/components/schemas/User',
          },
          isActive: {
            type: 'boolean',
            example: true,
          },
          applicationsCount: {
            type: 'integer',
            example: 12,
          },
          viewsCount: {
            type: 'integer',
            example: 45,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
        },
        required: ['id', 'title', 'company', 'description', 'postedBy'],
      },
      Chat: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          type: {
            type: 'string',
            enum: ['direct', 'group'],
            example: 'direct',
          },
          participants: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/User',
            },
          },
          lastMessage: {
            type: 'object',
            properties: {
              content: { type: 'string', example: 'Hello there!' },
              senderId: { type: 'string', example: '507f1f77bcf86cd799439011' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
          unreadCount: {
            type: 'integer',
            example: 3,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
        },
        required: ['id', 'type', 'participants'],
      },
      Message: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          content: {
            type: 'string',
            example: 'Hello! How are you?',
          },
          chatId: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          senderId: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          sender: {
            $ref: '#/components/schemas/User',
          },
          messageType: {
            type: 'string',
            enum: ['text', 'image', 'video', 'file', 'location'],
            example: 'text',
          },
          media: {
            type: 'object',
            properties: {
              url: { type: 'string', format: 'uri' },
              type: { type: 'string' },
              filename: { type: 'string' },
              size: { type: 'number' },
            },
          },
          isRead: {
            type: 'boolean',
            example: false,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
        },
        required: ['id', 'content', 'chatId', 'senderId'],
      },
      Notification: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          title: {
            type: 'string',
            example: 'New Message',
          },
          message: {
            type: 'string',
            example: 'You have a new message from John',
          },
          type: {
            type: 'string',
            enum: ['message', 'like', 'comment', 'follow', 'system', 'marketplace', 'job'],
            example: 'message',
          },
          recipientId: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          data: {
            type: 'object',
            additionalProperties: true,
            example: {
              postId: '507f1f77bcf86cd799439011',
              senderId: '507f1f77bcf86cd799439011',
            },
          },
          isRead: {
            type: 'boolean',
            example: false,
          },
          priority: {
            type: 'string',
            enum: ['low', 'normal', 'high', 'urgent'],
            example: 'normal',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
        },
        required: ['id', 'title', 'message', 'recipientId'],
      },
      Group: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          name: {
            type: 'string',
            example: 'Mumbai Tech Community',
          },
          description: {
            type: 'string',
            example: 'A community for tech enthusiasts in Mumbai',
          },
          creatorId: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          creator: {
            $ref: '#/components/schemas/User',
          },
          avatarUrl: {
            type: 'string',
            format: 'uri',
            example: 'https://example.com/group-avatar.jpg',
          },
          coverUrl: {
            type: 'string',
            format: 'uri',
            example: 'https://example.com/group-cover.jpg',
          },
          privacy: {
            type: 'string',
            enum: ['public', 'private', 'secret'],
            example: 'public',
          },
          memberCount: {
            type: 'integer',
            example: 150,
          },
          rules: {
            type: 'array',
            items: { type: 'string' },
            example: ['Be respectful', 'No spam', 'Stay on topic'],
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            example: ['tech', 'mumbai', 'community'],
          },
          location: {
            type: 'object',
            properties: {
              city: { type: 'string', example: 'Mumbai' },
              state: { type: 'string', example: 'Maharashtra' },
            },
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
        },
        required: ['id', 'name', 'creatorId'],
      },
      Report: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          reporterId: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          reporter: {
            $ref: '#/components/schemas/User',
          },
          reportedItemType: {
            type: 'string',
            enum: ['user', 'post', 'comment', 'marketplace_item', 'job_posting'],
            example: 'post',
          },
          reportedItemId: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
          reason: {
            type: 'string',
            enum: ['spam', 'inappropriate', 'harassment', 'fake', 'other'],
            example: 'inappropriate',
          },
          description: {
            type: 'string',
            example: 'This post contains inappropriate content',
          },
          status: {
            type: 'string',
            enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
            example: 'pending',
          },
          moderatorNotes: {
            type: 'string',
            example: 'Content reviewed and removed',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
        },
        required: ['id', 'reporterId', 'reportedItemType', 'reportedItemId', 'reason'],
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          data: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                },
              },
              total: {
                type: 'integer',
                example: 100,
              },
              page: {
                type: 'integer',
                example: 1,
              },
              totalPages: {
                type: 'integer',
                example: 10,
              },
              hasNext: {
                type: 'boolean',
                example: true,
              },
              hasPrev: {
                type: 'boolean',
                example: false,
              },
            },
          },
        },
        required: ['success', 'data'],
      },
    },
    parameters: {
      pageParam: {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1,
        },
      },
      limitParam: {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 10,
        },
      },
      searchParam: {
        name: 'search',
        in: 'query',
        description: 'Search query string',
        required: false,
        schema: {
          type: 'string',
          minLength: 1,
        },
      },
      userIdParam: {
        name: 'userId',
        in: 'path',
        description: 'User ID',
        required: true,
        schema: {
          type: 'string',
        },
      },
      postIdParam: {
        name: 'postId',
        in: 'path',
        description: 'Post ID',
        required: true,
        schema: {
          type: 'string',
        },
      },
      itemIdParam: {
        name: 'itemId',
        in: 'path',
        description: 'Item ID',
        required: true,
        schema: {
          type: 'string',
        },
      },
      jobIdParam: {
        name: 'jobId',
        in: 'path',
        description: 'Job ID',
        required: true,
        schema: {
          type: 'string',
        },
      },
      chatIdParam: {
        name: 'chatId',
        in: 'path',
        description: 'Chat ID',
        required: true,
        schema: {
          type: 'string',
        },
      },
      groupIdParam: {
        name: 'groupId',
        in: 'path',
        description: 'Group ID',
        required: true,
        schema: {
          type: 'string',
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication information is missing or invalid',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              message: 'Authentication required',
              code: 'UNAUTHORIZED',
              timestamp: '2023-01-01T00:00:00.000Z',
            },
          },
        },
      },
      ValidationError: {
        description: 'Request validation failed',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              message: 'Validation failed',
              code: 'VALIDATION_ERROR',
              details: {
                field: 'email',
                message: 'Invalid email format',
              },
              timestamp: '2023-01-01T00:00:00.000Z',
            },
          },
        },
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              message: 'Resource not found',
              code: 'NOT_FOUND',
              timestamp: '2023-01-01T00:00:00.000Z',
            },
          },
        },
      },
      RateLimitError: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              message: 'Rate limit exceeded. Please try again later.',
              code: 'RATE_LIMIT_EXCEEDED',
              timestamp: '2023-01-01T00:00:00.000Z',
            },
          },
        },
      },
      ForbiddenError: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              message: 'Insufficient permissions to perform this action',
              code: 'FORBIDDEN',
              timestamp: '2023-01-01T00:00:00.000Z',
            },
          },
        },
      },
      ServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              message: 'Internal server error',
              code: 'INTERNAL_ERROR',
              timestamp: '2023-01-01T00:00:00.000Z',
            },
          },
        },
      },
    },
  },
  security: [
    {
      BearerAuth: [],
    },
  ],
  externalDocs: {
    description: 'Find more info about LocalConnect',
    url: 'https://localconnect.com/docs',
  },
};

const options = {
  swaggerDefinition,
  apis: [
    './src/routes/*.js',
    './src/routes/**/*.js',
    './src/models/*.js',
    './src/middleware/*.js',
  ],
  explorer: true,
  customCss: `
    /* Hide default topbar since we have custom header */
    .swagger-ui .topbar { display: none !important; }
    
    /* Import custom CSS file */
    @import url('./swagger-custom.css');
    
    /* Additional custom styles */
    .swagger-ui .info .title { 
      color: #3B82F6; 
      font-size: 2.5em; 
      font-weight: 700; 
      text-align: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      margin: 0;
      border-radius: 12px 12px 0 0;
    }
    
    .swagger-ui .info .description { 
      font-size: 1.1em; 
      line-height: 1.6; 
      padding: 30px;
      background: #f8f9fa;
      border-radius: 0 0 12px 12px;
    }
    
    .swagger-ui .scheme-container { 
      background: #f8fafc; 
      border-radius: 8px; 
      padding: 16px; 
      margin: 20px 0;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }
    
    .swagger-ui .auth-wrapper { 
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); 
      border-radius: 12px; 
      padding: 25px; 
      margin: 20px 0;
      border: 1px solid #dee2e6;
    }
    
    .swagger-ui .opblock-tag { 
      font-size: 1.2em; 
      font-weight: 600; 
      color: #1e293b; 
      margin: 30px 0 20px 0;
      padding: 15px 20px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    
    .swagger-ui .opblock-summary-description { 
      color: #64748b; 
      font-size: 16px;
      font-weight: 500;
    }
    
    .swagger-ui .opblock.opblock-get .opblock-summary-method { 
      background: #10b981; 
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    }
    
    .swagger-ui .opblock.opblock-post .opblock-summary-method { 
      background: #3b82f6; 
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    }
    
    .swagger-ui .opblock.opblock-put .opblock-summary-method { 
      background: #f59e0b; 
      box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
    }
    
    .swagger-ui .opblock.opblock-delete .opblock-summary-method { 
      background: #ef4444; 
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
    }
    
    .swagger-ui .btn.execute { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
      border: none;
      border-radius: 8px;
      padding: 12px 24px;
      font-weight: 600;
      color: white;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    }
    
    .swagger-ui .btn.execute:hover { 
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
    }
    
    .swagger-ui .response-col_status { 
      font-weight: 600; 
      background: #f8f9fa;
      padding: 12px;
    }
    
    .swagger-ui .response-col_description { 
      color: #64748b; 
      padding: 12px;
    }
    
    /* Search functionality styles */
    .search-container {
      position: relative;
      margin-left: 20px;
    }
    
    .search-input {
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 20px;
      padding: 8px 16px;
      color: white;
      font-size: 14px;
      width: 250px;
      backdrop-filter: blur(10px);
    }
    
    .search-input::placeholder {
      color: rgba(255,255,255,0.7);
    }
    
    .search-results {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      max-height: 300px;
      overflow-y: auto;
      z-index: 1000;
      display: none;
    }
    
    .search-result {
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      cursor: pointer;
      transition: background 0.2s ease;
    }
    
    .search-result:hover {
      background: #f8f9fa;
    }
    
    .no-results {
      padding: 16px;
      text-align: center;
      color: #64748b;
    }
    
    /* Copy button styles */
    .copy-button {
      position: absolute;
      top: 8px;
      right: 8px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 12px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    
    pre:hover .copy-button {
      opacity: 1;
    }
    
    /* Progress bar styles */
    .progress-bar {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 3px;
      background: #f1f5f9;
      z-index: 9999;
    }
    
    .progress-fill {
      height: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      width: 0%;
      transition: width 0.3s ease;
    }
    
    /* Theme toggle styles */
    .theme-toggle {
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 18px;
      transition: all 0.3s ease;
      backdrop-filter: blur(10px);
    }
    
    .theme-toggle:hover {
      background: rgba(255,255,255,0.3);
      transform: scale(1.1);
    }
    
    /* Notification styles */
    .notification {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      animation: slideIn 0.3s ease;
    }
    
    .notification-success {
      background: #10b981;
    }
    
    .notification-info {
      background: #3b82f6;
    }
    
    .notification-error {
      background: #ef4444;
    }
    
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    /* Dark theme styles */
    .dark-theme {
      background: #1a1a1a;
      color: #ffffff;
    }
    
    .dark-theme .swagger-ui .info {
      background: #2d2d2d;
      color: #ffffff;
    }
    
    .dark-theme .swagger-ui .opblock {
      background: #2d2d2d;
      border-color: #404040;
    }
    
    .dark-theme .swagger-ui .opblock-summary {
      background: #404040;
    }
    
    /* Mobile menu styles */
    .menu-toggle {
      display: none;
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 8px;
      padding: 8px;
      color: white;
      font-size: 18px;
      cursor: pointer;
      backdrop-filter: blur(10px);
    }
    
    @media (max-width: 768px) {
      .menu-toggle {
        display: block;
      }
      
      .header-nav {
        display: none;
      }
      
      .header-nav.mobile-open {
        display: flex;
        flex-direction: column;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: rgba(102, 126, 234, 0.95);
        backdrop-filter: blur(10px);
        padding: 20px;
        border-radius: 0 0 12px 12px;
      }
      
      .search-container {
        margin-left: 0;
        margin-top: 15px;
        width: 100%;
      }
      
      .search-input {
        width: 100%;
      }
    }
  `,
  customSiteTitle: 'LocalConnect API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
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
  },
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
