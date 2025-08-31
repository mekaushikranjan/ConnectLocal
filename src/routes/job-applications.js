import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Job, JobApplication, User } from '../models/index.js';
import { Op } from 'sequelize';
import NotificationService from '../services/notificationService.js';
import { getIO } from '../socket/socketHandler.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Cloudflare R2 Configuration
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '448be2f47f1d28726807c826a16ff120';
const CLOUDFLARE_R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'connectlocal';
const CLOUDFLARE_R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://pub-d2e3f27d6f38479da7edf652022364b1.r2.dev';

// Function to upload PDF to R2
const uploadPDFToR2 = async (buffer, filename) => {
  const key = `resumes/${filename}`;
  
  const uploadResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${CLOUDFLARE_R2_BUCKET_NAME}/objects/${key}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/pdf',
        'Content-Length': buffer.length.toString()
      },
      body: buffer
    }
  );

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Failed to upload PDF to R2: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
  }

  return `${CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
};

// Generate unique filename for PDF
const generatePDFFilename = (originalname) => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const extension = path.extname(originalname);
  return `resume-${timestamp}-${random}${extension}`;
};

const router = express.Router();

// Configure multer for memory storage (for R2 upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

/**
 * @route   POST /api/job-applications/apply
 * @desc    Submit a job application
 * @access  Private
 */
router.post('/apply', authenticate, upload.single('resume'), asyncHandler(async (req, res) => {
  const { jobId, name, email, mobile, coverLetter } = req.body;





  // Check if job exists
  const job = await Job.findByPk(jobId, {
    include: [{ model: User, as: 'postedBy', attributes: ['id', 'displayName', 'username'] }]
  });

  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  // Check if user has already applied
  const existingApplication = await JobApplication.findOne({
    where: {
      jobId: job.id,
      applicantId: req.user.id
    }
  });

  if (existingApplication) {
    return res.status(400).json({
      success: false,
      message: 'You have already applied for this job'
    });
  }

  // Prepare resume data
  let resumeData = null;
  if (req.file) {
    try {
      const filename = generatePDFFilename(req.file.originalname);
      const pdfUrl = await uploadPDFToR2(req.file.buffer, filename);
      
      resumeData = {
        url: pdfUrl,
        filename: req.file.originalname,
        uploadedAt: new Date(),
        size: req.file.size
      };
    } catch (error) {
      console.error('Error uploading PDF to R2:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload resume. Please try again.'
      });
    }
  }

  // Create application
  const application = await JobApplication.create({
    jobId: job.id,
    applicantId: req.user.id,
    name,
    email,
    mobile,
    coverLetter: coverLetter || '',
    resume: resumeData,
    status: 'pending'
  });

  // Send notifications
  await NotificationService.notifyJobApplication(application.id, req.user.id, job.id, job.title);

  res.status(201).json({
    success: true,
    message: 'Application submitted successfully',
    data: {
      application: {
        id: application.id,
        jobId: application.jobId,
        status: application.status,
        appliedAt: application.createdAt
      }
    }
  });
}));

/**
 * @route   GET /api/job-applications/:jobId/applications
 * @desc    Get all applications for a specific job (job poster only)
 * @access  Private
 */
router.get('/:jobId/applications', authenticate, asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  // Check if job exists and user is the poster
  const job = await Job.findByPk(jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  if (job.postedById !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view applications for this job'
    });
  }

  const offset = (page - 1) * limit;

  const applications = await JobApplication.findAndCountAll({
    where: { jobId },
    include: [
      {
        model: User,
        as: 'applicant',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  res.json({
    success: true,
    data: {
      applications: applications.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(applications.count / limit),
        totalItems: applications.count,
        itemsPerPage: parseInt(limit)
      }
    }
  });
}));

/**
 * @route   PUT /api/job-applications/:jobId/applications/:applicationId
 * @desc    Update application status (job poster only)
 * @access  Private
 */
router.put('/:jobId/applications/:applicationId', authenticate, asyncHandler(async (req, res) => {
  const { jobId, applicationId } = req.params;
  const { status } = req.body;

  // Validate status
  const validStatuses = ['pending', 'reviewing', 'shortlisted', 'interviewed', 'offered', 'accepted', 'rejected', 'withdrawn'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status'
    });
  }

  // Check if job exists and user is the poster
  const job = await Job.findByPk(jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  if (job.postedById !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update applications for this job'
    });
  }

  // Find and update application
  const application = await JobApplication.findOne({
    where: { id: applicationId, jobId },
    include: [
      {
        model: User,
        as: 'applicant',
        attributes: ['id', 'displayName', 'username']
      }
    ]
  });

  if (!application) {
    return res.status(404).json({
      success: false,
      message: 'Application not found'
    });
  }

  const oldStatus = application.status;
  application.status = status;
  await application.save();

  // Send notification to applicant about status change
  await NotificationService.notifyApplicationStatusUpdate(application.id, job.id, job.title, oldStatus, status);

  res.json({
    success: true,
    message: 'Application status updated successfully',
    data: {
      application: {
        id: application.id,
        status: application.status,
        updatedAt: application.updatedAt
      }
    }
  });
}));

/**
 * @route   GET /api/job-applications/my-applications
 * @desc    Get user's own applications
 * @access  Private
 */
router.get('/my-applications', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const applications = await JobApplication.findAndCountAll({
    where: { applicantId: req.user.id },
    include: [
      {
        model: Job,
        as: 'job',
        attributes: ['id', 'title', 'companyData', 'address', 'type', 'company', 'location']
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  res.json({
    success: true,
    data: {
      applications: applications.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(applications.count / limit),
        totalItems: applications.count,
        itemsPerPage: parseInt(limit)
      }
    }
  });
}));

/**
 * @route   GET /api/job-applications/:jobId/applications/:applicationId/resume
 * @desc    Download resume for a specific application (job poster only)
 * @access  Private
 */
router.get('/:jobId/applications/:applicationId/resume', authenticate, asyncHandler(async (req, res) => {
  const { jobId, applicationId } = req.params;

  // Check if job exists and user is the poster
  const job = await Job.findByPk(jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  if (job.postedById !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to download resumes for this job'
    });
  }

  // Find the application
  const application = await JobApplication.findOne({
    where: { id: applicationId, jobId },
    include: [
      {
        model: User,
        as: 'applicant',
        attributes: ['id', 'displayName', 'username']
      }
    ]
  });

  if (!application) {
    return res.status(404).json({
      success: false,
      message: 'Application not found'
    });
  }

  if (!application.resume || !application.resume.url) {
    return res.status(404).json({
      success: false,
      message: 'Resume not found for this application'
    });
  }

  // Return the resume URL for download
  res.json({
    success: true,
    data: {
      resumeUrl: application.resume.url,
      filename: application.resume.filename,
      applicantName: application.applicant.displayName || application.applicant.username,
      uploadedAt: application.resume.uploadedAt
    }
  });
}));

export default router;
