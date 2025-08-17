import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import fetch from 'node-fetch';

const router = express.Router();

// Cloudflare R2 configuration
const R2_ENDPOINT = process.env.R2_ENDPOINT || `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Function to generate authorization headers for R2
const getR2Headers = (method, pathname, contentType = '') => {
  const date = new Date().toUTCString();
  const stringToSign = `${method}\n\n${contentType}\n${date}\n/${R2_BUCKET}${pathname}`;
  
  const signature = crypto
    .createHmac('sha1', R2_SECRET_KEY)
    .update(stringToSign)
    .digest('base64');

  return {
    'Date': date,
    'Authorization': `AWS ${R2_ACCESS_KEY}:${signature}`,
    'Host': new URL(R2_ENDPOINT).host,
    ...(contentType && { 'Content-Type': contentType })
  };
};

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // Use env or default to 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/gif,image/webp').split(',');
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
 * @route   POST /api/upload/image
 * @desc    Upload an image
 * @access  Private
 */
router.post('/image', authenticate, upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No image file provided'
    });
  }

  const { type = 'general', width, height, quality = process.env.DEFAULT_IMAGE_QUALITY || 80 } = req.body;

  // Process image with sharp
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

  const optimizedBuffer = await processedImage.toBuffer();

  // Generate unique filename
  const filename = generateFilename(req.file.originalname).replace(/\.[^/.]+$/, '.webp');

  // Define R2 path based on type
  let r2Path = 'uploads/';
  switch (type) {
    case 'avatar':
      r2Path += 'avatars/';
      break;
    case 'post':
      r2Path += 'posts/';
      break;
    case 'marketplace':
      r2Path += 'marketplace/';
      break;
    default:
      r2Path += 'general/';
  }

  // Upload to R2
  const filePath = `/${r2Path}${filename}`;
  const headers = getR2Headers('PUT', filePath, 'image/webp');
  
  const uploadResponse = await fetch(`${R2_ENDPOINT}/${R2_BUCKET}${filePath}`, {
    method: 'PUT',
    headers: headers,
    body: optimizedBuffer
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload to R2: ${uploadResponse.statusText}`);
  }

  // Construct the public URL
  const imageUrl = `${process.env.R2_PUBLIC_URL}${filePath}`;

  res.status(201).json({
    success: true,
    data: {
      url: imageUrl,
      key: filePath.slice(1) // Remove leading slash
    }
  });
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

    // Define S3 path based on type
    let s3Path = 'uploads/';
    switch (type) {
      case 'post':
        s3Path += 'posts/';
        break;
      case 'marketplace':
        s3Path += 'marketplace/';
        break;
      default:
        s3Path += 'general/';
    }

    // Upload to R2
    const filePath = `/${s3Path}${filename}`;
    const headers = getR2Headers('PUT', filePath, 'image/webp');
    
    const uploadResponse = await fetch(`${R2_ENDPOINT}/${R2_BUCKET}${filePath}`, {
      method: 'PUT',
      headers: headers,
      body: optimizedBuffer
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload to R2: ${uploadResponse.statusText}`);
    }

    // Construct the public URL
    const imageUrl = `${process.env.R2_PUBLIC_URL}${filePath}`;

    uploadResults.push({
      url: imageUrl,
      key: filePath.slice(1) // Remove leading slash
    });
  }

  res.status(201).json({
    success: true,
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

  // Delete from R2
  const filePath = `/${key}`;
  const headers = getR2Headers('DELETE', filePath);
  
  const deleteResponse = await fetch(`${R2_ENDPOINT}/${R2_BUCKET}${filePath}`, {
    method: 'DELETE',
    headers: headers
  });

  if (!deleteResponse.ok) {
    throw new Error(`Failed to delete from R2: ${deleteResponse.statusText}`);
  }

  res.json({
    success: true,
    message: 'File deleted successfully'
  });
}));

export default router;
