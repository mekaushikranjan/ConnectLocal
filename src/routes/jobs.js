import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Job, JobApplication, User } from '../models/index.js';
import { Op } from 'sequelize';

const router = express.Router();

// Transform job data from backend structure to frontend-friendly format
const transformJobForFrontend = (job) => {
  if (!job) return null;
  
  return {
    id: job.id,
    title: job.title,
    description: job.description,
    company: job.companyData?.name || 'Company not specified',
    type: job.type,
    location: job.address?.city || job.address?.fullAddress || 'Remote',
    salary: job.salaryMin ? `₹${job.salaryMin.toLocaleString()}${job.salaryMax ? ` - ₹${job.salaryMax.toLocaleString()}` : ''}` : 'Not specified',
    requirements: job.requirements?.skills?.required || job.requirements?.other || [],
    skills: job.requirements?.skills?.required || [],
    locationType: job.locationType,
    experienceLevel: job.requirements?.experience?.level,
    contactEmail: job.applicationEmail,
    applicationDeadline: job.applicationDeadline,
    postedBy: job.postedById,
    postedAt: job.createdAt,
    isActive: job.status === 'active',
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    user: job.user
  };
};

/**
 * @swagger
 * /api/jobs:
 *   post:
 *     summary: Create a new job posting
 *     description: Create a new job posting in the job board
 *     tags: [Jobs]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - company
 *             properties:
 *               title:
 *                 type: string
 *                 description: Job title
 *                 example: "Senior Frontend Developer"
 *               description:
 *                 type: string
 *                 description: Detailed job description
 *                 example: "We are looking for an experienced frontend developer..."
 *               company:
 *                 type: string
 *                 description: Company name
 *                 example: "Tech Corp"
 *               location:
 *                 type: string
 *                 description: Job location
 *                 example: "Mumbai, Maharashtra"
 *               type:
 *                 type: string
 *                 enum: [full-time, part-time, contract, freelance, internship, temporary, volunteer]
 *                 default: "full-time"
 *                 description: Employment type
 *                 example: "full-time"
 *               salary:
 *                 type: string
 *                 description: Salary information
 *                 example: "₹80,000 - ₹100,000 per year"
 *               requirements:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Job requirements
 *                 example: ["3+ years experience", "React knowledge", "Team player"]
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Required skills
 *                 example: ["JavaScript", "React", "Node.js"]
 *               experienceLevel:
 *                 type: string
 *                 enum: [entry, mid, senior, executive]
 *                 default: "entry"
 *                 description: Experience level required
 *                 example: "senior"
 *               locationType:
 *                 type: string
 *                 enum: [on-site, remote, hybrid]
 *                 default: "on-site"
 *                 description: Work location type
 *                 example: "hybrid"
 *               contactEmail:
 *                 type: string
 *                 format: email
 *                 description: Contact email for applications
 *                 example: "hr@techcorp.com"
 *               applicationDeadline:
 *                 type: string
 *                 format: date-time
 *                 description: Application deadline
 *                 example: "2023-12-31T23:59:59.000Z"
 *     responses:
 *       201:
 *         description: Job posting created successfully
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
 *                   example: Job posting created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     job:
 *                       $ref: '#/components/schemas/JobPosting'
 *       400:
 *         description: Bad request - Invalid data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const {
    title,
    description,
    location,
    type,
    salary,
    requirements,
    company,
    contactEmail,
    applicationDeadline,
    locationType,
    experienceLevel,
    skills
  } = req.body;

  // Transform frontend data to backend structure
  const companyData = typeof company === 'string' ? { name: company } : company;
  
  // Parse salary if it's a string with currency
  let salaryMin = null;
  let salaryMax = null;
  if (salary) {
    const numericSalary = parseInt(salary.replace(/[^0-9]/g, ''));
    if (numericSalary) {
      salaryMin = numericSalary;
    }
  }
  
  // Transform requirements to the expected JSONB structure
  const requirementsData = {
    education: {
      level: null,
      field: null,
      required: false
    },
    experience: {
      min: 0,
      max: null,
      level: experienceLevel || 'entry'
    },
    skills: {
      required: Array.isArray(skills) ? skills : (Array.isArray(requirements) ? requirements : []),
      preferred: []
    },
    languages: [],
    certifications: [],
    other: Array.isArray(requirements) ? requirements : []
  };

  const job = await Job.create({
    postedById: req.user.id,
    title,
    description,
    companyData,
    type,
    category: 'other', // Default category, could be enhanced
    locationType: locationType || 'on-site',
    salaryMin,
    salaryMax,
    salaryCurrency: 'INR',
    salaryPeriod: 'monthly',
    requirements: requirementsData,
    applicationEmail: contactEmail,
    applicationDeadline,
    address: {
      city: location,
      fullAddress: location
    }
  });

  const populatedJob = await Job.findByPk(job.id, {
    include: [{
      model: User,
      as: 'postedBy',
      attributes: ['id', 'displayName', 'username', 'avatar_url']
    }]
  });

  // Transform job data for frontend compatibility
  const transformedJob = transformJobForFrontend(populatedJob);

  res.status(201).json({
    success: true,
    message: 'Job posted successfully',
    data: { job: transformedJob }
  });
}));

/**
 * @route   GET /api/jobs
 * @desc    Get job listings with filters
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const {
    search,
    location,
    type,
    salary,
    limit = 10,
    page = 1
  } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = {};

  if (search) {
    whereClause[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
      { 'companyData.name': { [Op.iLike]: `%${search}%` } }
    ];
  }

  if (location) {
    whereClause[Op.or] = whereClause[Op.or] || [];
    whereClause[Op.or].push({ 'address.city': { [Op.iLike]: `%${location}%` } });
    whereClause[Op.or].push({ 'address.fullAddress': { [Op.iLike]: `%${location}%` } });
  }
  if (type) whereClause.type = type;
  if (salary) {
    const numericSalary = parseInt(salary);
    if (numericSalary) {
      whereClause.salaryMin = { [Op.lte]: numericSalary };
    }
  }

  const jobs = await Job.findAndCountAll({
    where: whereClause,
    include: [{
      model: User,
      as: 'postedBy',
      attributes: ['id', 'displayName', 'username', 'avatar_url']
    }],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  // Transform jobs for frontend compatibility
  const transformedJobs = jobs.rows.map(transformJobForFrontend);

  res.json({
    success: true,
    data: {
      jobs: transformedJobs,
      total: jobs.count,
      page: parseInt(page),
      totalPages: Math.ceil(jobs.count / limit)
    }
  });
}));

/**
 * @route   GET /api/jobs/:id
 * @desc    Get job details by ID
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const job = await Job.findByPk(req.params.id, {
    include: [{
      model: User,
      as: 'postedBy',
      attributes: ['id', 'displayName', 'username', 'avatar_url']
    }]
  });

  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  // Transform job for frontend compatibility
  const transformedJob = transformJobForFrontend(job);

  res.json({
    success: true,
    data: { job: transformedJob }
  });
}));

/**
 * @route   PUT /api/jobs/:id
 * @desc    Update job posting
 * @access  Private
 */
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const job = await Job.findByPk(req.params.id);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  if (job.postedById !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this job posting'
    });
  }

  const allowedUpdates = [
    'title',
    'description',
    'location',
    'type',
    'salary',
    'requirements',
    'company',
    'contactEmail',
    'applicationDeadline',
    'status'
  ];

  const updates = Object.keys(req.body)
    .filter(key => allowedUpdates.includes(key))
    .reduce((obj, key) => {
      obj[key] = req.body[key];
      return obj;
    }, {});

  Object.assign(job, updates);
  await job.save();

  // Transform job for frontend compatibility
  const transformedJob = transformJobForFrontend(job);

  res.json({
    success: true,
    message: 'Job posting updated successfully',
    data: { job: transformedJob }
  });
}));

/**
 * @route   DELETE /api/jobs/:id
 * @desc    Delete job posting
 * @access  Private
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const job = await Job.findByPk(req.params.id);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  if (job.postedById !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this job posting'
    });
  }

  await job.destroy();

  res.json({
    success: true,
    message: 'Job posting deleted successfully'
  });
}));

/**
 * @route   POST /api/jobs/:id/apply
 * @desc    Apply for a job
 * @access  Private
 */
router.post('/:id/apply', authenticate, asyncHandler(async (req, res) => {
  const job = await Job.findByPk(req.params.id);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  const existingApplication = await JobApplication.findOne({
    where: {
      jobId: job.id,
      userId: req.user.id
    }
  });

  if (existingApplication) {
    return res.status(400).json({
      success: false,
      message: 'You have already applied for this job'
    });
  }

  const { resume, coverLetter } = req.body;

  const application = await JobApplication.create({
    jobId: job.id,
    userId: req.user.id,
    resume,
    coverLetter,
    status: 'pending'
  });

  const populatedApplication = await JobApplication.findByPk(application.id, {
    include: [{
      model: User,
      as: 'postedBy',
      attributes: ['id', 'displayName', 'username', 'avatar_url']
    }]
  });

  res.status(201).json({
    success: true,
    message: 'Application submitted successfully',
    data: { application: populatedApplication }
  });
}));

/**
 * @route   GET /api/jobs/:id/applications
 * @desc    Get applications for a job (job poster only)
 * @access  Private
 */
router.get('/:id/applications', authenticate, asyncHandler(async (req, res) => {
  const job = await Job.findByPk(req.params.id);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  if (job.postedById !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view applications'
    });
  }

  const { limit = 10, page = 1 } = req.query;
  const offset = (page - 1) * limit;

  const applications = await JobApplication.findAndCountAll({
    where: { jobId: job.id },
    include: [{
      model: User,
        as: 'postedBy',
      attributes: ['id', 'displayName', 'username', 'avatar_url']
    }],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  res.json({
    success: true,
    data: {
      applications: applications.rows,
      total: applications.count,
      page: parseInt(page),
      totalPages: Math.ceil(applications.count / limit)
    }
  });
}));

/**
 * @route   PUT /api/jobs/:jobId/applications/:applicationId
 * @desc    Update application status (job poster only)
 * @access  Private
 */
router.put('/:jobId/applications/:applicationId', authenticate, asyncHandler(async (req, res) => {
  const job = await Job.findByPk(req.params.jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }

  if (job.postedById !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update applications'
    });
  }

  const application = await JobApplication.findByPk(req.params.applicationId);

  if (!application || application.jobId !== job.id) {
    return res.status(404).json({
      success: false,
      message: 'Application not found'
    });
  }

  const { status } = req.body;
  if (!['pending', 'reviewed', 'shortlisted', 'rejected', 'accepted'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status'
    });
  }

  application.status = status;
  await application.save();

  res.json({
    success: true,
    message: 'Application status updated successfully',
    data: { application }
  });
}));

export default router;
