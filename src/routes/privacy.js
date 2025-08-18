import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { 
  User, 
  PrivacySettings, 
  TwoFactorAuth, 
  BlockedUser, 
  EmergencyContact, 
  RecoverySettings, 
  LoginHistory 
} from '../models/index.js';
import { authenticate } from '../middleware/auth.js';


const router = express.Router();

// Middleware to check if user exists
const checkUserExists = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    req.currentUser = user;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== PRIVACY SETTINGS ====================

// Get privacy settings
router.get('/privacy-settings', authenticate, checkUserExists, async (req, res) => {
  try {
    let privacySettings = await PrivacySettings.findOne({
      where: { user_id: req.user.id }
    });

    if (!privacySettings) {
      // Create default privacy settings
      privacySettings = await PrivacySettings.create({
        user_id: req.user.id
      });
    }

    res.json({
      success: true,
      data: privacySettings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update privacy settings
router.put('/privacy-settings', [
  authenticate,
  checkUserExists,
  body('profileVisibility').optional().isIn(['public', 'friends', 'private']),
  body('postVisibility').optional().isIn(['public', 'friends', 'private']),
  body('allowMessages').optional().isIn(['everyone', 'friends', 'nobody']),
  body('allowGroupInvites').optional().isBoolean(),
  body('allowEventInvites').optional().isBoolean(),
  body('showOnlineStatus').optional().isBoolean(),
  body('showLastSeen').optional().isBoolean(),
  body('activityStatus').optional().isBoolean(),
  body('allowTagging').optional().isIn(['everyone', 'friends', 'nobody']),
  body('allowComments').optional().isIn(['everyone', 'friends', 'nobody']),
  body('moderateComments').optional().isBoolean(),
  body('hideFromSearch').optional().isBoolean(),
  body('twoFactorAuth').optional().isBoolean(),
  body('loginAlerts').optional().isBoolean(),
  body('dataDownload').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    }

    let privacySettings = await PrivacySettings.findOne({
      where: { user_id: req.user.id }
    });

    if (!privacySettings) {
      privacySettings = await PrivacySettings.create({
        user_id: req.user.id,
        ...req.body
      });
    } else {
      await privacySettings.update(req.body);
    }

    res.json({
      success: true,
      data: privacySettings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ==================== TWO-FACTOR AUTHENTICATION ====================

// Get 2FA settings
router.get('/2fa/settings', authenticate, checkUserExists, async (req, res) => {
  try {
    let twoFactorAuth = await TwoFactorAuth.findOne({
      where: { user_id: req.user.id }
    });

    if (!twoFactorAuth) {
      twoFactorAuth = await TwoFactorAuth.create({
        user_id: req.user.id
      });
    }

    // Don't send the secret in the response
    const response = {
      enabled: twoFactorAuth.enabled,
      method: twoFactorAuth.method,
      phoneNumber: twoFactorAuth.phoneNumber,
      email: twoFactorAuth.email,
      backupCodes: twoFactorAuth.backupCodes,
      verified: twoFactorAuth.verified
    };

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Setup 2FA
router.post('/2fa/setup', [
  authenticate,
  checkUserExists,
  body('method').isIn(['sms', 'authenticator', 'email']),
  body('contact').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    }

    const { method, contact } = req.body;

    let twoFactorAuth = await TwoFactorAuth.findOne({
      where: { user_id: req.user.id }
    });

    if (!twoFactorAuth) {
      twoFactorAuth = await TwoFactorAuth.create({
        user_id: req.user.id
      });
    }

    // Generate secret for authenticator
    const secret = speakeasy.generateSecret({
      name: `LocalConnect (${req.currentUser.email})`,
      issuer: 'LocalConnect'
    });

    let response = {};

    if (method === 'authenticator') {
      // Generate QR code for authenticator app
      const qrCode = await QRCode.toDataURL(secret.otpauth_url);
      response.qrCode = qrCode;
      
      await twoFactorAuth.update({
        method,
        secret: secret.base32,
        verified: false
      });
    } else {
      // For SMS/Email, store contact info
      const contactField = method === 'sms' ? 'phoneNumber' : 'email';
      await twoFactorAuth.update({
        method,
        [contactField]: contact,
        verified: false
      });
    }

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    // Error setting up 2FA
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Verify 2FA code
router.post('/2fa/verify', [
  authenticate,
  checkUserExists,
  body('code').isLength({ min: 6, max: 6 }).isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    }

    const { code } = req.body;

    const twoFactorAuth = await TwoFactorAuth.findOne({
      where: { user_id: req.user.id }
    });

    if (!twoFactorAuth || !twoFactorAuth.method) {
      return res.status(400).json({ success: false, message: '2FA not set up' });
    }

    let isValid = false;

    if (twoFactorAuth.method === 'authenticator') {
      isValid = speakeasy.totp.verify({
        secret: twoFactorAuth.secret,
        encoding: 'base32',
        token: code
      });
    } else {
      // For SMS/Email, you would verify against the code sent
      // This is a simplified version - in production, you'd check against stored codes
      isValid = code === '123456'; // Placeholder
    }

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid verification code' });
    }

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => 
      Math.random().toString(36).substring(2, 8).toUpperCase()
    );

    await twoFactorAuth.update({
      enabled: true,
      verified: true,
      verifiedAt: new Date(),
      backupCodes
    });

    // Update privacy settings
    await PrivacySettings.update(
      { twoFactorAuth: true },
      { where: { user_id: req.user.id } }
    );

    res.json({
      success: true,
      data: { backupCodes }
    });
  } catch (error) {
    // Error verifying 2FA
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Disable 2FA
router.post('/2fa/disable', [
  authenticate,
  checkUserExists,
  body('password').isString().isLength({ min: 6 }),
  body('backupCode').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    }

    const { password, backupCode } = req.body;

    // Verify password
    const isValidPassword = await bcrypt.compare(password, req.currentUser.password);
    if (!isValidPassword) {
      return res.status(400).json({ success: false, message: 'Invalid password' });
    }

    const twoFactorAuth = await TwoFactorAuth.findOne({
      where: { user_id: req.user.id }
    });

    if (!twoFactorAuth || !twoFactorAuth.enabled) {
      return res.status(400).json({ success: false, message: '2FA not enabled' });
    }

    // If backup code provided, verify it
    if (backupCode) {
      if (!twoFactorAuth.backupCodes.includes(backupCode)) {
        return res.status(400).json({ success: false, message: 'Invalid backup code' });
      }
      
      // Remove used backup code
      const updatedBackupCodes = twoFactorAuth.backupCodes.filter(code => code !== backupCode);
      await twoFactorAuth.update({ backupCodes: updatedBackupCodes });
    }

    await twoFactorAuth.update({
      enabled: false,
      verified: false,
      secret: null,
      phoneNumber: null,
      email: null,
      backupCodes: []
    });

    // Update privacy settings
    await PrivacySettings.update(
      { twoFactorAuth: false },
      { where: { user_id: req.user.id } }
    );

    res.json({
      success: true,
      message: '2FA disabled successfully'
    });
  } catch (error) {
    // Error disabling 2FA
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ==================== PASSWORD MANAGEMENT ====================

// Change password
router.put('/password', [
  authenticate,
  checkUserExists,
  body('currentPassword').isString().isLength({ min: 6 }),
  body('newPassword').isString().isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, req.currentUser.password);
    if (!isValidPassword) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await req.currentUser.update({ password: hashedPassword });

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    // Error changing password
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ==================== RECOVERY SETTINGS ====================

// Get recovery settings
router.get('/recovery-settings', authenticate, checkUserExists, async (req, res) => {
  try {
    let recoverySettings = await RecoverySettings.findOne({
      where: { user_id: req.user.id }
    });

    if (!recoverySettings) {
      recoverySettings = await RecoverySettings.create({
        user_id: req.user.id
      });
    }

    res.json({
      success: true,
      data: recoverySettings
    });
  } catch (error) {
    // Error getting recovery settings
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Setup recovery method
router.post('/recovery-settings', [
  authenticate,
  checkUserExists,
  body('method').isIn(['email', 'phone', 'security_questions']),
  body('data').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    }

    const { method, data } = req.body;

    let recoverySettings = await RecoverySettings.findOne({
      where: { userId: req.user.id }
    });

    if (!recoverySettings) {
      recoverySettings = await RecoverySettings.create({
        userId: req.user.id
      });
    }

    const updateData = {};

    if (method === 'email') {
      updateData.recoveryEmail = data.email;
      updateData.emailVerified = true;
      updateData.methods = [...new Set([...recoverySettings.methods, 'email'])];
    } else if (method === 'phone') {
      updateData.recoveryPhone = data.phone;
      updateData.phoneVerified = true;
      updateData.methods = [...new Set([...recoverySettings.methods, 'phone'])];
    } else if (method === 'security_questions') {
      updateData.securityQuestions = data.questions;
      updateData.questionsVerified = true;
      updateData.methods = [...new Set([...recoverySettings.methods, 'security_questions'])];
    }

    await recoverySettings.update(updateData);

    res.json({
      success: true,
      data: recoverySettings
    });
  } catch (error) {
      // Error setting up recovery method
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ==================== BLOCKED USERS ====================

// Get blocked users
router.get('/blocked', authenticate, checkUserExists, async (req, res) => {
  try {
    const blockedUsers = await BlockedUser.findAll({
      where: { blocker_id: req.user.id },
      include: [{
        model: User,
        as: 'blocked',
        attributes: ['id', 'displayName', 'username', 'avatar_url']
      }],
      order: [['createdAt', 'DESC']]
    });

    const formattedBlockedUsers = blockedUsers.map(block => ({
      id: block.blocked.id,
      name: block.blocked.displayName,
      avatar: block.blocked.avatar_url,
      blockedAt: block.createdAt
    }));

    res.json({
      success: true,
      data: formattedBlockedUsers
    });
  } catch (error) {
    // Error getting blocked users
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Block user
router.post('/block', [
  authenticate,
  checkUserExists,
  body('userId').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    }

    const { userId } = req.body;

    // Check if user exists
    const userToBlock = await User.findByPk(userId);
    if (!userToBlock) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if already blocked
    const existingBlock = await BlockedUser.findOne({
      where: { blocker_id: req.user.id, blocked_id: userId }
    });

    if (existingBlock) {
      return res.status(400).json({ success: false, message: 'User is already blocked' });
    }

    await BlockedUser.create({
      blocker_id: req.user.id,
      blocked_id: userId
    });

    res.json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    // Error blocking user
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Unblock user
router.delete('/block/:userId', [
  authenticate,
  checkUserExists,
  param('userId').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    }

    const { userId } = req.params;

    const deleted = await BlockedUser.destroy({
      where: { blocker_id: req.user.id, blocked_id: userId }
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Block not found' });
    }

    res.json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    // Error unblocking user
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ==================== EMERGENCY CONTACTS ====================

// Get emergency contacts
router.get('/emergency-contacts', authenticate, checkUserExists, async (req, res) => {
  try {
    const emergencyContacts = await EmergencyContact.findAll({
      where: { user_id: req.user.id },
      order: [['priority', 'ASC'], ['created_at', 'ASC']]
    });

    res.json({
      success: true,
      data: emergencyContacts
    });
  } catch (error) {
    // Error getting emergency contacts
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Add emergency contact
router.post('/emergency-contacts', [
  authenticate,
  checkUserExists,
  body('name').isString().isLength({ min: 1, max: 100 }),
  body('phone').isString().isLength({ min: 1 }),
  body('email').optional().isEmail(),
  body('relationship').isString().isLength({ min: 1 }),
  body('address').optional().isString(),
  body('notes').optional().isString(),
  body('priority').optional().isInt({ min: 1, max: 10 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    }

    const emergencyContact = await EmergencyContact.create({
      user_id: req.user.id,
      ...req.body
    });

    res.json({
      success: true,
      data: emergencyContact
    });
  } catch (error) {
    // Error adding emergency contact
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Remove emergency contact
router.delete('/emergency-contacts/:contactId', [
  authenticate,
  checkUserExists,
  param('contactId').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    }

    const { contactId } = req.params;

    const deleted = await EmergencyContact.destroy({
      where: { id: contactId, user_id: req.user.id }
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Emergency contact not found' });
    }

    res.json({
      success: true,
      message: 'Emergency contact removed successfully'
    });
  } catch (error) {
    // Error removing emergency contact
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ==================== USER REPORTING ====================

// Report user
router.post('/report', [
  authenticate,
  checkUserExists,
  body('userId').isUUID(),
  body('reason').isString().isLength({ min: 1 }),
  body('description').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    }

    const { userId, reason, description } = req.body;

    // Check if user exists
    const reportedUser = await User.findByPk(userId);
    if (!reportedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Create report (using existing Report model)
    await Report.create({
      reporter_id: req.user.id,
      reported_item_type: 'user',
      reported_item_id: userId,
      reason,
      description,
      status: 'pending'
    });

    res.json({
      success: true,
      message: 'User reported successfully'
    });
  } catch (error) {
    // Error reporting user
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get user reports
router.get('/reports', authenticate, checkUserExists, async (req, res) => {
  try {
    const reports = await Report.findAll({
      where: { 
        reporter_id: req.user.id,
        reported_item_type: 'user'
      },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    // Error getting user reports
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ==================== DATA MANAGEMENT ====================

// Request data download
router.post('/data-download', authenticate, checkUserExists, async (req, res) => {
  try {
    // Generate a unique request ID
    const requestId = `data_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    // In a real implementation, you would:
    // 1. Create a background job to collect user data
    // 2. Store the request in a database
    // 3. Send email when ready
    // 4. Provide download link

    res.json({
      success: true,
      data: {
        requestId,
        estimatedTime: '24 hours'
      }
    });
  } catch (error) {
      // Error requesting data download
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Delete account
router.delete('/account', [
  authenticate,
  checkUserExists,
  body('password').isString().isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    }

    const { password } = req.body;

    // Verify password
    const isValidPassword = await bcrypt.compare(password, req.currentUser.password);
    if (!isValidPassword) {
      return res.status(400).json({ success: false, message: 'Invalid password' });
    }

    // In a real implementation, you would:
    // 1. Anonymize user data instead of deleting
    // 2. Keep records for legal compliance
    // 3. Send confirmation email
    // 4. Log the deletion

    // For now, we'll just mark the user as deleted
    await req.currentUser.update({ status: 'banned' });

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    // Error deleting account
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ==================== LOGIN HISTORY ====================

// Get login history
router.get('/login-history', authenticate, checkUserExists, async (req, res) => {
  try {
    const loginHistory = await LoginHistory.findAll({
        where: { user_id: req.user.id },
      order: [['login_at', 'DESC']],
      limit: 50
    });

    const formattedHistory = loginHistory.map(session => {
      // Construct location string
      let location = 'Unknown Location';
      if (session.location && session.location !== 'Unknown Location') {
        location = session.location;
      } else if (session.city && session.country && session.city !== 'Unknown' && session.country !== 'Unknown') {
        location = `${session.city}, ${session.country}`;
      } else if (session.city && session.city !== 'Unknown') {
        location = session.city;
      } else if (session.country && session.country !== 'Unknown') {
        location = session.country;
      }

      return {
        id: session.id,
        sessionId: session.session_id,
        device: session.device_name || session.device_type || 'Unknown Device',
        location: location,
        timestamp: session.login_at,
        ipAddress: session.ip_address || 'Unknown IP',
        isActive: session.is_active,
        browser: session.browser || 'Unknown Browser',
        os: session.os || 'Unknown OS',
        lastActivity: session.last_activity_at
      };
    });

    res.json({
      success: true,
      data: formattedHistory
    });
  } catch (error) {
    // Error getting login history
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Revoke session
router.delete('/sessions/:sessionId', [
  authenticate,
  checkUserExists,
  param('sessionId').isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    }

    const { sessionId } = req.params;

    // Try to find session by database ID first, then by session_id (JWT token)
    let session = await LoginHistory.findOne({
      where: { 
        id: sessionId,
        user_id: req.user.id,
        is_active: true
      }
    });

    // If not found by ID, try by session_id (JWT token)
    if (!session) {
      session = await LoginHistory.findOne({
        where: { 
          session_id: sessionId,
          user_id: req.user.id,
          is_active: true
        }
      });
    }

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    await session.update({
      is_active: false,
      logout_at: new Date(),
      last_activity_at: new Date()
    });

    res.json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
