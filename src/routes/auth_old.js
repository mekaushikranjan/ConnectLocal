
import jwt from 'jsonwebtoken';
import express from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import Chat from '../models/Chat.js';
import { authenticate, checkActionRateLimit } from '../middleware/auth.js';
import {
  validateRegister,
  validateLogin,
  validateLogout,
  validateDeleteAccount,
  validateCreateChat,
  validateGetChat,
  validateUpdateChat,
  validateDeleteChat,
  validateForgotPassword,
  validateResetPassword,
  validateUpdateProfile,
  validateChangePassword,
  validateEmailVerification,
  validateResendVerification,
  validateRefreshToken
} from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import emailService from '../services/emailService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', 
  checkActionRateLimit('register', 5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  validateRegister,
  asyncHandler(async (req, res) => {
    const { email, password, displayName, username } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Check if username is taken (if provided)
    if (username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken'
        });
      }
    }

    // Create user
    const user = new User({
      email,
      password,
      displayName,
      username
    });

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    await user.save();

    // Send verification email
    try {
      await emailService.sendVerificationEmail(user.email, user.displayName, verificationToken);
    } catch (error) {
      logger.error('Failed to send verification email:', error);
      // Don't fail registration if email fails
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { userId: user._id, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for verification.',
      data: {
        user: user.getPublicProfile(),
        token,
        refreshToken,
        requiresVerification: !user.emailVerified
      }
    });
  })
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login',
  checkActionRateLimit('login', 10, 15 * 60 * 1000), // 10 attempts per 15 minutes
  validateLogin,
  asyncHandler(async (req, res) => {
    const { email, password, deviceInfo } = req.body;

    // Find user by email
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Check if account is banned
    if (user.isBanned) {
      const message = user.banExpiresAt && user.banExpiresAt > new Date() 
        ? `Account is temporarily banned until ${user.banExpiresAt.toLocaleDateString()}`
        : 'Account is permanently banned';
      
      return res.status(401).json({
        success: false,
        message,
        banReason: user.banReason
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login and device info
    user.lastLogin = new Date();
    
    if (deviceInfo) {
      // Update or add device info
      const existingDevice = user.devices.find(d => d.deviceId === deviceInfo.deviceId);
      if (existingDevice) {
        existingDevice.lastActive = new Date();
        existingDevice.fcmToken = deviceInfo.fcmToken;
      } else {
        user.devices.push({
          deviceId: deviceInfo.deviceId,
          deviceType: deviceInfo.deviceType,
          fcmToken: deviceInfo.fcmToken,
          lastActive: new Date()
        });
      }
    }

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { userId: user._id, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.getPublicProfile(),
        token,
        refreshToken,
        requiresVerification: !user.emailVerified
      }
    });
  })
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT token
 * @access  Public
 */
router.post('/refresh',
  validateRefreshToken,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      if (decoded.type !== 'refresh') {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive || user.isBanned) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      // Generate new tokens
      const newToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      const newRefreshToken = jwt.sign(
        { userId: user._id, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
      );

      res.json({
        success: true,
        data: {
          token: newToken,
          refreshToken: newRefreshToken
        }
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
  })
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout',
  authenticate,
  validateLogout,
  asyncHandler(async (req, res) => {
    const { deviceId } = req.body;

    if (deviceId) {
      // Remove specific device
      req.user.devices = req.user.devices.filter(d => d.deviceId !== deviceId);
    } else {
      // Remove all devices (logout from all devices)
      req.user.devices = [];
    }

    await req.user.save();

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  })
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post('/forgot-password',
  checkActionRateLimit('forgot-password', 3, 60 * 60 * 1000), // 3 attempts per hour
  validateForgotPassword,
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists or not
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour

    await user.save();

    // Send reset email
    try {
      await emailService.sendPasswordResetEmail(user.email, user.displayName, resetToken);
      
      res.json({
        success: true,
        message: 'Password reset link has been sent to your email.'
      });
    } catch (error) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      logger.error('Failed to send password reset email:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to send password reset email. Please try again.'
      });
    }
  })
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password',
  validateResetPassword,
  asyncHandler(async (req, res) => {
    const { token, password } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    // Generate new JWT token
    const jwtToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      success: true,
      message: 'Password reset successful',
      data: {
        user: user.getPublicProfile(),
        token: jwtToken
      }
    });
  })
);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email address
 * @access  Public
 */
router.post('/verify-email',
  validateEmailVerification,
  asyncHandler(async (req, res) => {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user: user.getPublicProfile()
      }
    });
  })
);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification
 * @access  Private
 */
router.post('/resend-verification',
  authenticate,
  checkActionRateLimit('resend-verification', 3, 60 * 60 * 1000), // 3 attempts per hour
  validateResendVerification,
  asyncHandler(async (req, res) => {
    if (req.user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    req.user.emailVerificationToken = verificationToken;
    req.user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    await req.user.save();

    // Send verification email
    try {
      await emailService.sendVerificationEmail(req.user.email, req.user.displayName, verificationToken);
      
      res.json({
        success: true,
        message: 'Verification email sent successfully'
      });
    } catch (error) {
      logger.error('Failed to send verification email:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again.'
      });
    }
  })
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: {
        user: req.user.getPublicProfile()
      }
    });
  })
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password
 * @access  Private
 */
router.post('/change-password',
  authenticate,
  validateChangePassword,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // Validate new password
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');
    
    // Check current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  })
);

/**
 * @route   DELETE /api/auth/account
 * @desc    Delete user account
 * @access  Private
 */
router.delete('/account',
  authenticate,
  validateDeleteAccount,
  asyncHandler(async (req, res) => {
    const { password, reason } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to delete account'
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');
    
    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect password'
      });
    }

    // Soft delete - deactivate account
    user.isActive = false;
    user.email = `deleted_${Date.now()}_${user.email}`;
    user.username = `deleted_${Date.now()}_${user.username}`;
    
    // Log deletion reason
    if (reason) {
      logger.info(`User ${user._id} deleted account. Reason: ${reason}`);
    }

    await user.save();

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  })
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile',
  authenticate,
  validateUpdateProfile,
  asyncHandler(async (req, res) => {
    const allowedUpdates = [
      'displayName',
      'bio',
      'location',
      'website',
      'socialLinks',
      'profileAvatar',
      'profileCover',
      'preferences'
    ];

    const updates = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.getPublicProfile()
      }
    });
  })
);

/**
 * @route   POST /api/auth/chats
 * @desc    Create a new chat
 * @access  Private
 */
router.post('/chats',
  authenticate,
  validateCreateChat,
  asyncHandler(async (req, res) => {
    const { type, participants, groupInfo } = req.body;
    
    // Make sure user is not creating a chat with themselves
    if (type === 'direct' && participants.length === 1 && participants[0] === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create a chat with yourself'
      });
    }

    // Add current user to participants if not already included
    const allParticipants = new Set([...participants, req.user._id.toString()]);

    const chat = await Chat.create({
      type,
      participants: Array.from(allParticipants),
      groupInfo: type === 'group' ? groupInfo : undefined,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Chat created successfully',
      data: { chat }
    });
  })
);

/**
 * @route   GET /api/auth/chats/:chatId
 * @desc    Get chat by ID
 * @access  Private
 */
router.get('/chats/:chatId',
  authenticate,
  validateGetChat,
  asyncHandler(async (req, res) => {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      participants: req.user._id
    }).populate('participants', 'displayName profileAvatar');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found or access denied'
      });
    }

    res.json({
      success: true,
      data: { chat }
    });
  })
);

/**
 * @route   PUT /api/auth/chats/:chatId
 * @desc    Update a chat (group info only)
 * @access  Private
 */
router.put('/chats/:chatId',
  authenticate,
  validateUpdateChat,
  asyncHandler(async (req, res) => {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      participants: req.user._id,
      type: 'group'
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Group chat not found or access denied'
      });
    }

    // Only allow updating group info
    if (req.body.groupInfo) {
      chat.groupInfo = {
        ...chat.groupInfo,
        ...req.body.groupInfo
      };
      await chat.save();
    }

    res.json({
      success: true,
      message: 'Chat updated successfully',
      data: { chat }
    });
  })
);

/**
 * @route   DELETE /api/auth/chats/:chatId
 * @desc    Delete/Leave a chat
 * @access  Private
 */
router.delete('/chats/:chatId',
  authenticate,
  validateDeleteChat,
  asyncHandler(async (req, res) => {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      participants: req.user._id
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found or access denied'
      });
    }

    if (chat.type === 'direct') {
      // For direct chats, remove it completely
      await chat.remove();
    } else {
      // For group chats, just remove the user from participants
      chat.participants = chat.participants.filter(
        p => p.toString() !== req.user._id.toString()
      );
      if (chat.participants.length === 0) {
        await chat.remove();
      } else {
        await chat.save();
      }
    }

    res.json({
      success: true,
      message: 'Successfully left/deleted the chat'
    });
  })
);

export default router;