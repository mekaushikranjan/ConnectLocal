import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { User } from '../models/index.js';
import Report from '../models/Report.js';
import { Op } from 'sequelize';

const router = express.Router();

/**
 * @route   POST /api/reports
 * @desc    Create a new report
 * @access  Private
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const {
    type,
    targetId,
    reason,
    description,
    evidence
  } = req.body;

  // Validate report type
  const validTypes = ['user', 'post', 'job', 'marketplace', 'chat', 'comment'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid report type'
    });
  }

  // Check for existing report
  const existingReport = await Report.findOne({
    where: {
      reporterId: req.user.id,
      targetId,
      type,
      status: { [Op.notIn]: ['resolved', 'dismissed'] }
    }
  });

  if (existingReport) {
    return res.status(400).json({
      success: false,
      message: 'You have already reported this content'
    });
  }

  const report = await Report.create({
    type,
    targetId,
    reporterId: req.user.id,
    reason,
    description,
    evidence,
    status: 'pending'
  });

  const populatedReport = await Report.findByPk(report.id, {
    include: [{
      model: User,
      as: 'reporter',
      attributes: ['id', 'username', 'displayName']
    }]
  });

  res.status(201).json({
    success: true,
    message: 'Report submitted successfully',
    data: { report: populatedReport }
  });
}));

/**
 * @route   GET /api/reports/me
 * @desc    Get user's submitted reports
 * @access  Private
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const { status, limit = 10, page = 1 } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = { reporterId: req.user.id };
  if (status) whereClause.status = status;

  const reports = await Report.findAndCountAll({
    where: whereClause,
    include: [{
      model: User,
      as: 'reporter',
      attributes: ['id', 'username', 'displayName']
    }],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']]
  });

  res.json({
    success: true,
    data: {
      reports: reports.rows,
      total: reports.count,
      page: parseInt(page),
      totalPages: Math.ceil(reports.count / limit)
    }
  });
}));

/**
 * @route   GET /api/reports/:id
 * @desc    Get report details
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const report = await Report.findOne({
    where: {
      id: req.params.id,
      reporterId: req.user.id
    },
    include: [{
      model: User,
      as: 'reporter',
      attributes: ['id', 'username', 'displayName']
    }]
  });

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Report not found'
    });
  }

  res.json({
    success: true,
    data: { report }
  });
}));

/**
 * @route   PUT /api/reports/:id
 * @desc    Update report (add additional information)
 * @access  Private
 */
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const report = await Report.findOne({
    where: {
      id: req.params.id,
      reporterId: req.user.id,
      status: 'pending'
    }
  });

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Report not found or cannot be updated'
    });
  }

  const { description, evidence } = req.body;

  if (description) report.description = description;
  if (evidence) report.evidence = evidence;

  await report.save();

  res.json({
    success: true,
    message: 'Report updated successfully',
    data: { report }
  });
}));

/**
 * @route   DELETE /api/reports/:id
 * @desc    Delete/Cancel report
 * @access  Private
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const report = await Report.findOne({
    where: {
      id: req.params.id,
      reporterId: req.user.id,
      status: 'pending'
    }
  });

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Report not found or cannot be deleted'
    });
  }

  await report.destroy();

  res.json({
    success: true,
    message: 'Report cancelled successfully'
  });
}));

/**
 * @route   GET /api/reports/types
 * @desc    Get report types and reasons
 * @access  Private
 */
router.get('/types', authenticate, asyncHandler(async (req, res) => {
  const reportTypes = {
    user: [
      'harassment',
      'inappropriate_content',
      'spam',
      'fake_account',
      'other'
    ],
    post: [
      'inappropriate_content',
      'hate_speech',
      'misinformation',
      'spam',
      'violence',
      'other'
    ],
    job: [
      'spam',
      'scam',
      'inappropriate',
      'misleading',
      'other'
    ],
    marketplace: [
      'counterfeit',
      'prohibited_item',
      'misleading',
      'scam',
      'spam',
      'other'
    ],
    chat: [
      'harassment',
      'spam',
      'inappropriate_content',
      'scam',
      'other'
    ],
    comment: [
      'harassment',
      'hate_speech',
      'inappropriate_content',
      'spam',
      'other'
    ]
  };

  res.json({
    success: true,
    data: { reportTypes }
  });
}));

export default router;
