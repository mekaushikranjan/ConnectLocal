import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const router = express.Router();



// Cloudflare R2 Configuration - Using environment variables
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '448be2f47f1d28726807c826a16ff120';
const CLOUDFLARE_R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'connectlocal';
const CLOUDFLARE_R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://pub-d2e3f27d6f38479da7edf652022364b1.r2.dev';



// Check if R2 is properly configured - using API token instead of S3 credentials
const isR2Configured = process.env.CLOUDFLARE_API_TOKEN && CLOUDFLARE_ACCOUNT_ID;



// Function to upload to R2 using Cloudflare API
const uploadToR2 = async (buffer, key, contentType) => {
  const uploadResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${CLOUDFLARE_R2_BUCKET_NAME}/objects/${key}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString()
      },
      body: buffer
    }
  );

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Failed to upload to R2: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
  }

  return true;
};



// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // Use env or default to 10MB
  },
  fileFilter: (req, file, cb) => {
    // Explicitly define allowed types to ensure audio files are supported
    const allowedTypes = [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp',
      'audio/m4a',
      'audio/mp3',
      'audio/wav',
      'audio/aac'
    ];
    
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error(`Invalid file type. Only ${allowedTypes.join(', ')} are allowed.`));
    } else {
      cb(null, true);
    }
  }
});

// Generate unique filename
const generateFilename = (originalname) => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const extension = path.extname(originalname);
  return `${timestamp}-${random}${extension}`;    
};

/**
 * @swagger
 * /api/upload/image:
 *   post:
 *     summary: Upload an image
 *     description: Upload and process an image file with optional resizing and optimization
 *     tags: [Upload]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file to upload
 *               type:
 *                 type: string
 *                 enum: [general, avatar, post, marketplace]
 *                 default: general
 *                 description: Type of image upload
 *                 example: avatar
 *               width:
 *                 type: integer
 *                 description: Target width for resizing (optional)
 *                 example: 800
 *               height:
 *                 type: integer
 *                 description: Target height for resizing (optional)
 *                 example: 600
 *               quality:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 80
 *                 description: Image quality (1-100)
 *                 example: 85
 *     responses:
 *       200:
 *         description: Image uploaded successfully
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
 *                   example: Image uploaded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       format: uri
 *                       description: Public URL of uploaded image
 *                       example: "https://pub-2e0b327bc8804069a7ca1cb5329d6296.r2.dev/uploads/avatars/1234567890-abc123.webp"
 *                     filename:
 *                       type: string
 *                       description: Generated filename
 *                       example: "1234567890-abc123.webp"
 *                     size:
 *                       type: number
 *                       description: File size in bytes
 *                       example: 245760
 *                     type:
 *                       type: string
 *                       description: Upload type
 *                       example: "avatar"
 *       400:
 *         description: Bad request - Invalid file or parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: No image file provided
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       413:
 *         description: File too large
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: File too large. Maximum size is 10MB
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/image', authenticate, upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file provided'
    });
  }

  const { type = 'general', width, height, quality = process.env.DEFAULT_IMAGE_QUALITY || 80 } = req.body;

  try {
    let processedBuffer;
    let filename;
    let contentType;
    let uploadPath = 'uploads/';

    // Check if it's an audio file
    if (req.file.mimetype.startsWith('audio/')) {
      // Handle audio files
      processedBuffer = req.file.buffer; // No processing for audio files
      filename = generateFilename(req.file.originalname);
      contentType = req.file.mimetype;
      
      // Define upload path for audio files
      switch (type) {
        case 'message':
          uploadPath += 'messages/';
          break;
        default:
          uploadPath += 'audio/';
      }
    } else {
      // Handle image files
      let processedImage = sharp(req.file.buffer);

      // Resize if dimensions provided
      if (width || height) {
        processedImage = processedImage.resize(
          width ? parseInt(width) : null,
          height ? parseInt(height) : null,
          { fit: 'inside', withoutEnlargement: true }
        );
      }

      // Convert to WebP for better compression
      processedImage = processedImage.webp({ quality: parseInt(quality) });

      processedBuffer = await processedImage.toBuffer();
      filename = generateFilename(req.file.originalname).replace(/\.[^/.]+$/, '.webp');
      contentType = 'image/webp';

      // Define upload path for images
      switch (type) {
        case 'avatar':
          uploadPath += 'avatars/';
          break;
        case 'post':
          uploadPath += 'posts/';
          break;
        case 'marketplace':
          uploadPath += 'marketplace/';
          break;
        default:
          uploadPath += 'general/';
      }
    }

    const key = `${uploadPath}${filename}`;

    // Upload to R2
    if (!isR2Configured) {
      throw new Error('R2 is not properly configured');
    }

    await uploadToR2(processedBuffer, key, contentType);
    const fileUrl = `${CLOUDFLARE_R2_PUBLIC_URL}/${key}`;

    const message = req.file.mimetype.startsWith('audio/') ? 'Audio uploaded successfully' : 'Image uploaded successfully';

    res.status(201).json({
      success: true,
      message: message,
      data: {
        url: fileUrl,
        key: key,
        filename: filename,
        size: processedBuffer.length,
        type: type
      }
    });
  } catch (error) {
    throw new Error(`File processing failed: ${error.message}`);
  }
}));

/**
 * @route   POST /api/upload/images
 * @desc    Upload multiple images
 * @access  Private
 */
router.post('/images', authenticate, upload.array('images', 10), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No image files provided'
    });
  }

  const { type = 'general', width, height, quality = process.env.DEFAULT_IMAGE_QUALITY || 80 } = req.body;
  const uploadResults = [];

  for (const file of req.files) {
    try {
      // Process image with sharp
      let processedImage = sharp(file.buffer);

      // Resize if dimensions provided
      if (width || height) {
        processedImage = processedImage.resize(
          width ? parseInt(width) : null,
          height ? parseInt(height) : null,
          { fit: 'inside', withoutEnlargement: true }
        );
      }

      // Convert to WebP
      processedImage = processedImage.webp({ quality: parseInt(quality) });

      const optimizedBuffer = await processedImage.toBuffer();

      // Generate unique filename
      const filename = generateFilename(file.originalname).replace(/\.[^/.]+$/, '.webp');

      // Define upload path based on type
      let uploadPath = 'uploads/';
      switch (type) {
        case 'post':
          uploadPath += 'posts/';
          break;
        case 'marketplace':
          uploadPath += 'marketplace/';
          break;
        default:
          uploadPath += 'general/';
      }

      const key = `${uploadPath}${filename}`;
      const contentType = 'image/webp';

      // Upload to R2
      if (!isR2Configured) {
        throw new Error('R2 is not properly configured');
      }

      await uploadToR2(optimizedBuffer, key, contentType);
      const imageUrl = `${CLOUDFLARE_R2_PUBLIC_URL}/${key}`;

      uploadResults.push({
        url: imageUrl,
        key: key,
        filename: filename,
        size: optimizedBuffer.length,
        type: type
      });
    } catch (error) {
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }

  res.status(201).json({
    success: true,
    message: 'Images uploaded successfully',
    data: { images: uploadResults }
  });
}));

/**
 * @route   DELETE /api/upload/:key
 * @desc    Delete an uploaded file
 * @access  Private
 */
router.delete('/:key(*)', authenticate, asyncHandler(async (req, res) => {
  const key = req.params.key;

  try {
    if (!isR2Configured) {
      throw new Error('R2 is not properly configured');
    }

    const deleteResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${CLOUDFLARE_R2_BUCKET_NAME}/objects/${key}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`
        }
      }
    );

    if (deleteResponse.ok) {
      return res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
  } catch (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}));

/**
 * @route   GET /api/upload/test
 * @desc    Test upload service
 * @access  Private
 */
router.get('/test', authenticate, asyncHandler(async (req, res) => {
  let r2Status = 'Not Configured';
  
  if (isR2Configured) {
    try {
      const testResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      r2Status = testResponse.ok ? 'Connected' : 'Connection Failed';
    } catch (error) {
      r2Status = 'Connection Error';
    }
  }

  res.json({
    success: true,
    message: 'Upload service is working',
    data: {
      r2Status: r2Status,
      r2Bucket: CLOUDFLARE_R2_BUCKET_NAME,
      r2PublicUrl: CLOUDFLARE_R2_PUBLIC_URL,
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
      allowedTypes: (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/gif,image/webp').split(',')
    }
  });
}));

export default router;
