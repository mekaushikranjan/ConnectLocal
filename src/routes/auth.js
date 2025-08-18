import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { authenticate, checkActionRateLimit } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { User, Notification, LoginHistory } from '../models/index.js';
import emailService from '../services/emailService.js';
import smsService from '../services/smsService.js';
import logger from '../utils/logger.js';
import { createLoginHistory, getClientIP } from '../utils/loginHistory.js';
import { Op } from 'sequelize';

import admin from 'firebase-admin';
import fetch from 'node-fetch';
import OAuth from 'oauth-1.0a';

const router = express.Router();

/**
 * @route   GET /api/auth/test
 * @desc    Test endpoint to verify API is working
 * @access  Public
 */
router.get('/test', (req, res) => {
  console.log('🔍 /auth/test endpoint called');
  console.log('  - Request headers:', Object.keys(req.headers));
  console.log('  - Authorization header:', req.header('Authorization') ? 'Present' : 'Missing');
  
  res.json({
    success: true,
    message: 'Auth API is working!',
    timestamp: new Date().toISOString(),
    headers: Object.keys(req.headers)
  });
});

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, displayName, firstName, lastName, phoneNumber } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ 
    where: { email: email.toLowerCase() }
  });

  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User already exists with this email'
    });
  }

  // Generate email verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Create user
  // Derive name parts if needed
  let derivedFirst = firstName;
  let derivedLast = lastName;
  let finalDisplayName = (displayName || '').trim();
  if ((!derivedFirst || !derivedLast) && finalDisplayName) {
    const parts = finalDisplayName.split(/\s+/);
    if (!derivedFirst) derivedFirst = parts.shift() || '';
    if (!derivedLast) derivedLast = parts.length ? parts.join(' ') : '';
  }
  if (!finalDisplayName) {
    finalDisplayName = [derivedFirst, derivedLast].filter(Boolean).join(' ').trim();
  }

  // Auto-verify email in development mode
  const shouldAutoVerify = process.env.NODE_ENV === 'development' || process.env.AUTO_VERIFY_EMAIL === 'true';

  const user = await User.create({
    email: email.toLowerCase(),
    password,
    displayName: finalDisplayName, // Full name from frontend or composed from parts
    first_name: derivedFirst,
    last_name: derivedLast,
    phone_number: phoneNumber,
    email_verification_token: verificationToken,
    email_verification_expires: verificationExpires,
    email_verified: shouldAutoVerify // Auto-verify in development
  });

  // Send verification email
  try {
    await emailService.sendVerificationEmail(user.email, user.displayName, verificationToken);
  } catch (error) {
    logger.error('Failed to send verification email:', error);
    // Don't fail registration if email fails
  }

 
  // Create welcome notification
  await Notification.createNotification({
    recipientId: user.id,
    title: 'Welcome to LocalConnect!',
    message: 'Welcome to our community! Start by completing your profile and connecting with neighbors.',
    type: 'system_update',
    priority: 'normal'
  });

  res.status(201).json({
    success: true,
    message: shouldAutoVerify 
      ? 'User registered successfully and email auto-verified (development mode).'
      : 'User registered successfully. Please check your email for verification.',
    data: {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        firstName: user.first_name || '', 
        lastName: user.last_name || '',
        emailVerified: user.email_verified,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt
      },
      requiresVerification: !shouldAutoVerify,
      message: shouldAutoVerify 
        ? 'Email auto-verified in development mode.'
        : 'Please check your email and click the verification link to complete your registration.'
    }
  });
}));

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password, deviceInfo } = req.body;

  console.log('🔍 Login attempt:', {
    email: email ? email.toLowerCase() : 'undefined',
    hasPassword: !!password,
    passwordLength: password ? password.length : 0,
    hasDeviceInfo: !!deviceInfo
  });

  // Find user by email
  const user = await User.findOne({ 
    where: { email: email.toLowerCase() }
  });

  console.log('🔍 User lookup result:', {
    userFound: !!user,
    userId: user?.id,
    userEmail: user?.email,
    emailVerified: user?.email_verified,
    userStatus: user?.status,
    hasPassword: !!user?.password
  });

  if (!user) {
    console.log('❌ Login failed: User not found');
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Check password
  console.log('🔍 Checking password...');
  const isPasswordValid = await bcrypt.compare(password, user.password);
  console.log('🔍 Password validation result:', {
    isValid: isPasswordValid,
    providedPassword: password ? `${password.length} chars` : 'undefined',
    storedPasswordHash: user.password ? `${user.password.length} chars` : 'undefined'
  });

  if (!isPasswordValid) {
    console.log('❌ Login failed: Invalid password');
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Check if email is verified - BLOCK LOGIN IF NOT VERIFIED
  console.log('🔍 Checking email verification:', {
    emailVerified: user.email_verified,
    email: user.email
  });

  // In development mode, auto-verify email for testing
  if (!user.email_verified) {
    if (process.env.NODE_ENV === 'development' || process.env.AUTO_VERIFY_EMAIL === 'true') {
      console.log('🔧 Development mode: Auto-verifying email');
      await user.update({ email_verified: true });
    } else {
      console.log('❌ Login failed: Email not verified');
      return res.status(401).json({
        success: false,
        message: 'Please verify your email address before logging in. Check your inbox for the verification link.',
        requiresVerification: true
      });
    }
  }

  // Check if account is active
  console.log('🔍 Checking account status:', {
    status: user.status,
    isActive: user.status === 'active'
  });

  if (user.status !== 'active') {
    let message = 'Account is not active';
    if (user.status === 'suspended') {
      message = 'Account is suspended. Please contact support.';
    } else if (user.status === 'banned') {
      message = 'Account is banned. Please contact support.';
    }
    
    console.log('❌ Login failed: Account not active -', user.status);
    return res.status(401).json({
      success: false,
      message,
      moderationReason: user.moderationReason
    });
  }

  console.log('✅ All login checks passed, generating tokens...');

  // Update last login and device info
  const updateData = {
    last_login: new Date(),
    last_active: new Date()
  };

  if (deviceInfo) {
    // Update or add device info
    const devices = user.devices || [];
    const existingDeviceIndex = devices.findIndex(d => d.deviceId === deviceInfo.deviceId);
    
    if (existingDeviceIndex >= 0) {
      devices[existingDeviceIndex] = {
        ...devices[existingDeviceIndex],
        last_active: new Date(),
        fcmToken: deviceInfo.fcmToken
      };
    } else {
      devices.push({
        deviceId: deviceInfo.deviceId,
        deviceType: deviceInfo.deviceType,
        fcmToken: deviceInfo.fcmToken,
        last_active: new Date()
      });
    }
    
    updateData.devices = devices;
  }

  await user.update(updateData);

  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  console.log('✅ JWT token generated:', {
    tokenLength: token.length,
    tokenStart: token.substring(0, 20) + '...',
    userId: user.id
  });

  // Handle existing sessions from same IP before creating new login history
  try {
    const clientIP = getClientIP(req);
    
    // Check for existing active sessions from the same IP
    const existingSessions = await LoginHistory.findAll({
      where: {
        user_id: user.id,
        ip_address: clientIP,
        is_active: true
      },
      order: [['login_at', 'DESC']]
    });

    if (existingSessions.length > 0) {
      logger.info(`Found ${existingSessions.length} existing active session(s) from same IP ${clientIP} for user ${user.id}`);
      
      // Mark older sessions as inactive (keep the most recent one active if it's recent)
      const now = new Date();
      const recentThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds
      
      for (const session of existingSessions) {
        const sessionAge = now - new Date(session.login_at);
        
        if (sessionAge > recentThreshold) {
          // Mark older sessions as inactive
          await session.update({
            is_active: false,
            logout_at: new Date(),
            last_activity_at: new Date()
          });
          logger.info(`Marked older session ${session.id} as inactive for user ${user.id}`);
        } else {
          // Keep recent sessions active but update last activity
          await session.update({
            last_activity_at: new Date()
          });
          logger.info(`Updated last activity for recent session ${session.id} for user ${user.id}`);
        }
      }
    }
  } catch (error) {
    logger.error('Failed to handle existing sessions from same IP:', error);
    // Don't fail login if session handling fails
  }

  // Create new login history record
  try {
    const locationInfo = deviceInfo?.locationInfo;
    await createLoginHistory({
      userId: user.id,
      sessionId: token, // Use JWT token as session ID
      deviceInfo,
      locationInfo,
      request: req
    });
    logger.info(`New login history created for user ${user.id} with session ${token.substring(0, 10)}...`);
  } catch (error) {
    logger.error('Failed to create login history:', error);
    // Don't fail login if history creation fails
  }

  // Generate refresh token
  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );

  console.log('✅ Login successful for user:', user.email);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        coverImageUrl: user.coverImageUrl,
        phoneNumber: user.phoneNumber,
        phoneVerified: user.phoneVerified,
        emailVerified: user.email_verified,
        role: user.role,
        status: user.status,
        locationCity: user.locationCity,
        locationState: user.locationState,
        locationCountry: user.locationCountry,
        shareLocation: user.shareLocation,
        profileVisibility: user.profileVisibility,
        createdAt: user.createdAt,
        last_login: user.last_login,
        last_active: user.last_active
      },
      token,
      refreshToken,
      requiresVerification: !user.email_verified
    }
  });
}));

/**
 * @route   POST /api/auth/social
 * @desc    Exchange social provider token (Google id_token or Twitter access token) for local JWT
 * @access  Public
 */
router.post('/social', asyncHandler(async (req, res) => {
  const { provider } = req.body;

  if (!provider) {
    return res.status(400).json({ success: false, message: 'Provider is required' });
  }

  // Ensure firebase-admin is initialized
  if (!admin.apps.length && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
      })
    });
  }

  // Helper: call Firebase Identity Toolkit signInWithIdp
  async function signInWithIdp(postBody) {
    const apiKey = process.env.FIREBASE_API_KEY;
    if (!apiKey) throw new Error('FIREBASE_API_KEY not configured');

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${apiKey}`;
    const body = {
      postBody,
      requestUri: 'http://localhost',
      returnSecureToken: true,
      returnIdpCredential: true
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Firebase signInWithIdp failed: ${r.status} ${text}`);
    }

    return r.json();
  }

  let firebaseResponse;

  try {
    if (provider === 'google') {
      const { idToken } = req.body; // Google's id_token (JWT) obtained client-side
      if (!idToken) return res.status(400).json({ success: false, message: 'idToken is required for google' });

      // Exchange Google id_token for Firebase credential
      const postBody = `id_token=${encodeURIComponent(idToken)}&providerId=google.com`;
      firebaseResponse = await signInWithIdp(postBody);
    } else if (provider === 'twitter') {
      // Expect oauth_token and oauth_token_secret obtained from OAuth1 flow
      const { oauthToken, oauthTokenSecret } = req.body;
      if (!oauthToken || !oauthTokenSecret) return res.status(400).json({ success: false, message: 'oauthToken and oauthTokenSecret are required for twitter' });

      const postBody = `oauth_token=${encodeURIComponent(oauthToken)}&oauth_token_secret=${encodeURIComponent(oauthTokenSecret)}&providerId=twitter.com`;
      firebaseResponse = await signInWithIdp(postBody);
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported provider' });
    }
  } catch (err) {
    logger.error('Social sign-in failed:', err);
    return res.status(401).json({ success: false, message: 'Social sign-in failed', detail: err.message });
  }

  // firebaseResponse contains idToken (Firebase ID token), refreshToken, localId (firebase uid), email, displayName, photoUrl, federatedId etc.
  const firebaseIdToken = firebaseResponse.idToken || firebaseResponse.id_token;
  if (!firebaseIdToken) {
    return res.status(500).json({ success: false, message: 'Failed to obtain Firebase ID token' });
  }

  // Verify Firebase ID token via admin
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(firebaseIdToken);
  } catch (err) {
    logger.error('Failed to verify Firebase ID token:', err);
    return res.status(401).json({ success: false, message: 'Invalid Firebase ID token' });
  }

  // Extract profile info returned by Firebase
  const providerData = firebaseResponse && firebaseResponse.providerId ? firebaseResponse : firebaseResponse;
  const firebaseUid = firebaseResponse.localId || decoded.uid;
  const email = firebaseResponse.email || decoded.email || null;
  const displayName = firebaseResponse.displayName || decoded.name || decoded.email || 'New User';
  const photoUrl = firebaseResponse.photoUrl || decoded.picture || null;
  const emailVerified = firebaseResponse.emailVerified || decoded.email_verified || !!decoded.email;

  // Find existing user by firebase uid or provider id or email
  let user = await User.findOne({ where: { [Op.or]: [ { googleId: decoded.firebase?.sign_in_provider === 'google.com' ? decoded.sub : null }, { twitterId: decoded.firebase?.sign_in_provider === 'twitter.com' ? decoded.sub : null }, { googleId: firebaseResponse?.rawUserInfo && JSON.parse(firebaseResponse.rawUserInfo).sub ? JSON.parse(firebaseResponse.rawUserInfo).sub : null }, { twitterId: firebaseResponse?.screenName || null }, { email: email || null }, { id: null } ] } });

  // Better matching: try by firebase uid stored in a firebaseUid column (if present) or provider-specific fields
  if (!user) {
    // Try matching by googleId/twitterId/email
    const whereClause = { [Op.or]: [] };
    if (decoded && decoded.firebase && decoded.firebase.sign_in_provider === 'google.com' && decoded.sub) whereClause[Op.or].push({ googleId: decoded.sub });
    if (decoded && decoded.firebase && decoded.firebase.sign_in_provider === 'twitter.com' && decoded.sub) whereClause[Op.or].push({ twitterId: decoded.sub });
    if (email) whereClause[Op.or].push({ email });

    if (whereClause[Op.or].length) {
      user = await User.findOne({ where: whereClause });
    }
  }

  if (!user) {
    // Create a new user with rich profile from Firebase
    user = await User.create({
      email: email || `social_${provider}_${firebaseUid}@localconnect.internal`,
      displayName,
      password: null,
      emailVerified: !!emailVerified,
      avatarUrl: photoUrl || null,
      googleId: provider === 'google' ? decoded.sub || firebaseResponse.rawUserInfo && JSON.parse(firebaseResponse.rawUserInfo).sub : null,
      googleEmail: provider === 'google' ? email : null,
      twitterId: provider === 'twitter' ? decoded.sub || null : null,
      twitterUsername: provider === 'twitter' ? firebaseResponse.screenName || null : null,
      // store firebase uid in googleId/twitterId or consider adding a firebaseUid column in future
    });
  } else {
    // Update existing user with any missing profile fields
    const updates = {};
    if (!user.displayName && displayName) updates.displayName = displayName;
    if (!user.avatarUrl && photoUrl) updates.avatarUrl = photoUrl;
    if (provider === 'google' && !user.googleId) updates.googleId = decoded.sub || null;
    if (provider === 'google' && !user.googleEmail && email) updates.googleEmail = email;
    if (provider === 'twitter' && !user.twitterId) updates.twitterId = decoded.sub || null;
    if (provider === 'twitter' && !user.twitterUsername && firebaseResponse.screenName) updates.twitterUsername = firebaseResponse.screenName;
    if (Object.keys(updates).length) await user.update(updates);
  }

  // Issue local JWT tokens for the app
  const tokenJwt = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' });

  res.json({ success: true, data: { user: {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt
  }, token: tokenJwt, refreshToken } });
}));

/**
 * Twitter OAuth1 flow - request token
 * Frontend should call this to get an oauth_token and redirect URL to Twitter's auth page.
 */
router.get('/twitter/request_token', asyncHandler(async (req, res) => {
  const consumerKey = process.env.TWITTER_API_KEY;
  const consumerSecret = process.env.TWITTER_API_SECRET_KEY;
  if (!consumerKey || !consumerSecret) return res.status(500).json({ success: false, message: 'Twitter API keys not configured' });

  const oauth = new OAuth({
    consumer: { key: consumerKey, secret: consumerSecret },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
      return crypto.createHmac('sha1', key).update(base_string).digest('base64');
    }
  });

  const requestData = {
    url: 'https://api.twitter.com/oauth/request_token',
    method: 'POST',
    data: { oauth_callback: 'oob' }
  };

  const headers = oauth.toHeader(oauth.authorize(requestData));

  const r = await fetch(requestData.url, { method: 'POST', headers });
  const text = await r.text();
  // Twitter returns querystring-like response
  const params = new URLSearchParams(text);
  const oauth_token = params.get('oauth_token');
  const oauth_token_secret = params.get('oauth_token_secret');
  const oauth_callback_confirmed = params.get('oauth_callback_confirmed');

  if (!oauth_token) return res.status(500).json({ success: false, message: 'Failed to obtain request token from Twitter' });

  // Return the token and an auth URL the client can open
  const authUrl = `https://api.twitter.com/oauth/authenticate?oauth_token=${oauth_token}`;
  res.json({ success: true, data: { oauth_token, oauth_token_secret, authUrl, oauth_callback_confirmed } });
}));

/**
 * Exchange oauth_token + oauth_verifier for access token, then perform Firebase signInWithIdp using tokens
 */
router.post('/twitter/callback', asyncHandler(async (req, res) => {
  const { oauth_token, oauth_verifier } = req.body;
  const consumerKey = process.env.TWITTER_API_KEY;
  const consumerSecret = process.env.TWITTER_API_SECRET_KEY;
  if (!oauth_token || !oauth_verifier) return res.status(400).json({ success: false, message: 'oauth_token and oauth_verifier required' });
  if (!consumerKey || !consumerSecret) return res.status(500).json({ success: false, message: 'Twitter keys not configured' });

  const oauth = new OAuth({
    consumer: { key: consumerKey, secret: consumerSecret },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
      return crypto.createHmac('sha1', key).update(base_string).digest('base64');
    }
  });

  const requestData = {
    url: 'https://api.twitter.com/oauth/access_token',
    method: 'POST',
    data: { oauth_token, oauth_verifier }
  };

  const headers = oauth.toHeader(oauth.authorize(requestData));

  const r = await fetch(requestData.url, { method: 'POST', headers, body: new URLSearchParams({ oauth_token, oauth_verifier }) });
  const text = await r.text();
  const params = new URLSearchParams(text);
  const access_token = params.get('oauth_token');
  const access_token_secret = params.get('oauth_token_secret');
  const user_id = params.get('user_id');
  const screen_name = params.get('screen_name');

  if (!access_token || !access_token_secret) return res.status(500).json({ success: false, message: 'Failed to exchange Twitter tokens' });

  // Now call our /auth/social with twitter provider tokens so existing flow handles Firebase exchange + user creation
  // But we can call signInWithIdp directly here to reduce round trips
  try {
    // Exchange via Identity Toolkit
    const apiKey = process.env.FIREBASE_API_KEY;
    if (!apiKey) return res.status(500).json({ success: false, message: 'FIREBASE_API_KEY not configured' });

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${apiKey}`;
    const postBody = `oauth_token=${encodeURIComponent(access_token)}&oauth_token_secret=${encodeURIComponent(access_token_secret)}&providerId=twitter.com`;

    const fr = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postBody, requestUri: 'http://localhost', returnSecureToken: true }) });
    const json = await fr.json();
    if (!fr.ok) {
      logger.error('Twitter Firebase signInWithIdp failed', json);
      return res.status(500).json({ success: false, message: 'Twitter Firebase sign-in failed' });
    }

    // Reuse logic from /social: verify id token, create/update user, issue app tokens
    const firebaseIdToken = json.idToken || json.id_token;
    const decoded = await admin.auth().verifyIdToken(firebaseIdToken);

    // Compose providerUser
    const firebaseUid = json.localId || decoded.uid;
    const email = json.email || decoded.email || null;
    const displayName = json.displayName || decoded.name || screen_name || 'Twitter User';
    const photoUrl = json.photoUrl || decoded.picture || null;
    const emailVerified = json.emailVerified || decoded.email_verified || !!decoded.email;

    // Find or create user in Postgres
    let user = await User.findOne({ where: { [Op.or]: [ { twitterId: firebaseUid }, { email: email || null } ] } });
    if (!user) {
      user = await User.create({
        email: email || `social_twitter_${firebaseUid}@localconnect.internal`,
        displayName,
        password: null,
        emailVerified: !!emailVerified,
        twitterId: firebaseUid,
        twitterUsername: screen_name || null,
        avatarUrl: photoUrl || null
      });
    } else {
      const updates = {};
      if (!user.twitterId) updates.twitterId = firebaseUid;
      if (!user.twitterUsername && screen_name) updates.twitterUsername = screen_name;
      if (!user.avatarUrl && photoUrl) updates.avatarUrl = photoUrl;
      if (Object.keys(updates).length) await user.update(updates);
    }

      const tokenJwt = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' });

    return res.json({ success: true, data: { user: { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, role: user.role, status: user.status, createdAt: user.createdAt }, token: tokenJwt, refreshToken } });
  } catch (err) {
    logger.error('Twitter callback error:', err);
    return res.status(500).json({ success: false, message: 'Twitter sign-in failed' });
  }
}));

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT token
 * @access  Public
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token is required'
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    const user = await User.findByPk(decoded.userId);
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const newToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    const newRefreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
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
}));

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  const { deviceId } = req.body;

  // Update login history records
  try {
    const updateData = {
      is_active: false,
      logout_at: new Date(),
      last_activity_at: new Date()
    };

    if (deviceId) {
      // Mark specific device session as inactive
      await LoginHistory.update(updateData, {
        where: {
          user_id: req.user.id,
          device_name: deviceId,
          is_active: true
        }
      });
      
      // Remove specific device from user's devices array
      const devices = req.user.devices || [];
      const updatedDevices = devices.filter(d => d.deviceId !== deviceId);
      await req.user.update({ devices: updatedDevices });
    } else {
      // Mark all active sessions as inactive
      await LoginHistory.update(updateData, {
        where: {
          user_id: req.user.id,
          is_active: true
        }
      });
      
      // Remove all devices (logout from all devices)
      await req.user.update({ devices: [] });
    }
    
    logger.info(`Logout completed for user ${req.user.id}, deviceId: ${deviceId || 'all devices'}`);
  } catch (error) {
    logger.error('Failed to update login history during logout:', error);
    // Don't fail logout if login history update fails
  }

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  console.log('🔍 /auth/me endpoint called');
  console.log('  - User ID:', req.user.id);
  console.log('  - User email:', req.user.email);
  
  res.json({
    success: true,
    data: {
      user: {
        id: req.user.id,
        email: req.user.email,
        displayName: req.user.displayName,
        firstName: req.user.first_name,
        lastName: req.user.last_name,
        bio: req.user.bio_text,
        avatarUrl: req.user.avatar_url,
        coverImageUrl: req.user.cover_image_url,
        phoneNumber: req.user.phone_number,
        phoneVerified: req.user.phone_verified,
        emailVerified: req.user.email_verified,
        role: req.user.role,
        status: req.user.status,
        locationCity: req.user.location_city,
        locationState: req.user.location_state,
        locationCountry: req.user.location_country,
        locationDistrict: req.user.location_district,
        shareLocation: req.user.share_location,
        profileVisibility: req.user.profile_visibility,
        gender: req.user.gender_type,
        occupation: req.user.occupation,
        company: req.user.company,
        education: req.user.education,
        dateOfBirth: req.user.date_of_birth,
        relationshipStatus: req.user.relationship_status,
        interests: req.user.interests_array,
        skills: req.user.skills_array,
        socialLinks: req.user.social_links,
        createdAt: req.user.createdAt,
        last_login: req.user.last_login,
        last_active: req.user.last_active
      }
    }
  });
}));

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset OTP to email
 * @access  Public
 */
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ 
    where: { email: email.toLowerCase() }
  });

  if (!user) {
    // Don't reveal if email exists or not
    return res.json({
      success: true,
      message: 'If an account with that email exists, a password reset OTP has been sent.'
    });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await user.update({
    password_reset_otp: otp,
    password_reset_otp_expires: otpExpires
  });

  // Send OTP email
  try {
    await emailService.sendOTPEmail(user.email, user.displayName, otp, 10);
    
    res.json({
      success: true,
      message: 'Password reset OTP has been sent to your email.'
    });
  } catch (error) {
    await user.update({
      password_reset_otp: null,
      password_reset_otp_expires: null
    });

    logger.error('Failed to send password reset OTP email:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to send password reset OTP. Please try again.'
    });
  }
}));

/**
 * @route   POST /api/auth/verify-reset-otp
 * @desc    Verify password reset OTP
 * @access  Public
 */
router.post('/verify-reset-otp', asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const user = await User.findOne({
    where: {
      email: email.toLowerCase(),
      password_reset_otp: otp,
      password_reset_otp_expires: { [Op.gt]: new Date() }
    }
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired OTP'
    });
  }

  // Generate temporary token for password reset
  const resetToken = jwt.sign(
    { userId: user.id, type: 'password_reset' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' } // 15 minutes to complete password reset
  );

  res.json({
    success: true,
    message: 'OTP verified successfully',
    data: {
      resetToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName
      }
    }
  });
}));

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with verified OTP token
 * @access  Public
 */
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { resetToken, password } = req.body;

  try {
    // Verify the reset token
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset token'
      });
    }

    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update password and clear OTP
    await user.update({
      password,
      password_reset_otp: null,
      password_reset_otp_expires: null
    });

    // Generate new JWT token for auto login
    const jwtToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );

    res.json({
      success: true,
      message: 'Password reset successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          username: user.username,
          email_verified: user.email_verified,
          role: user.role,
          status: user.status
        },
        token: jwtToken,
        refreshToken
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }
    
    logger.error('Password reset error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
}));

/**
 * @route   GET /api/auth/reset-password
 * @desc    Reset password page (GET endpoint for email links)
 * @access  Public
 */
router.get('/reset-password', asyncHandler(async (req, res) => {
  const { token: resetToken } = req.query;

  if (!resetToken) {
    return res.status(400).json({
      success: false,
      message: 'Reset token is required'
    });
  }

  try {
    // Verify the reset token
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset token'
      });
    }

    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }

    // For mobile apps, redirect to the app using a deep link
    const appScheme = process.env.APP_SCHEME || 'localconnect';
    const redirectUrl = `${appScheme}://auth/reset-password?token=${resetToken}`;
    
    // Create a simple HTML page that redirects to the mobile app
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reset Password - LocalConnect</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .title { color: #333; font-size: 24px; margin-bottom: 20px; }
          .message { color: #666; margin-bottom: 30px; }
          .button { background: #4A90E2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="title">🔐 Reset Your Password</div>
        <div class="message">You will be redirected to the LocalConnect app to reset your password.</div>
        <p>If you're not redirected automatically, <a href="${redirectUrl}" class="button">Open LocalConnect App</a></p>
        <script>
          // Try to open the mobile app
          window.location.href = '${redirectUrl}';
          
          // Fallback: if app doesn't open within 3 seconds, show manual link
          setTimeout(function() {
            document.body.innerHTML = '<div class="title">🔐 Reset Your Password</div><div class="message">Please open the LocalConnect app to reset your password.</div><a href="${redirectUrl}" class="button">Open LocalConnect App</a>';
          }, 3000);
        </script>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }
    
    logger.error('Password reset token verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify reset token'
    });
  }
}));

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email with token
 * @access  Public
 */
router.post('/verify-email', asyncHandler(async (req, res) => {
  const { token: verificationToken } = req.body;

  const user = await User.findOne({
    where: {
      email_verification_token: verificationToken,
      email_verification_expires: { [Op.gt]: new Date() }
    }
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired verification token'
    });
  }

  await user.update({
    email_verified: true,
    email_verification_token: null,
    email_verification_expires: null
  });

  // Generate JWT token after email verification
  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  // Generate refresh token
  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );

  // Create verification success notification
  await Notification.createNotification({
    recipientId: user.id,
    title: 'Email Verified!',
    message: 'Your email has been successfully verified. You now have full access to all features.',
    type: 'account_verification',
    priority: 'normal'
  });

  res.json({
    success: true,
    message: 'Email verified successfully. You are now logged in!',
    data: {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        firstName: user.first_name || '', 
        lastName: user.last_name || '',
        emailVerified: user.email_verified,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt
      },
      token,
      refreshToken,
      requiresVerification: false
    }
  });
}));

/**
 * @route   GET /api/auth/verify-email
 * @desc    Verify email with token (GET endpoint for email links)
 * @access  Public
 */
router.get('/verify-email', asyncHandler(async (req, res) => {
  const { token: verificationToken } = req.query;

  if (!verificationToken) {
    return res.status(400).json({
      success: false,
      message: 'Verification token is required'
    });
  }

  const user = await User.findOne({
    where: {
      email_verification_token: verificationToken,
      email_verification_expires: { [Op.gt]: new Date() }
    }
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired verification token'
    });
  }

  await user.update({
    email_verified: true,
    email_verification_token: null,
    email_verification_expires: null
  });

  // Generate JWT token after email verification
  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  // Generate refresh token
  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );

  // Create verification success notification
  await Notification.createNotification({
    recipientId: user.id,
    title: 'Email Verified!',
    message: 'Your email has been successfully verified. You now have full access to all features.',
    type: 'account_verification',
    priority: 'normal'
  });

  // For mobile apps, redirect to the app using a deep link
  // The app will handle the verification success
  const appScheme = process.env.APP_SCHEME || 'localconnect';
  const redirectUrl = `${appScheme}://auth/email-verification?status=success&token=${token}&refreshToken=${refreshToken}`;
  
  // Create a simple HTML page that redirects to the mobile app
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Email Verified - LocalConnect</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .success { color: #4CAF50; font-size: 24px; margin-bottom: 20px; }
        .message { color: #666; margin-bottom: 30px; }
        .button { background: #4A90E2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="success">✅ Email Verified Successfully!</div>
      <div class="message">Your email has been verified. You will be redirected to the LocalConnect app.</div>
      <p>If you're not redirected automatically, <a href="${redirectUrl}" class="button">Open LocalConnect App</a></p>
      <script>
        // Try to open the mobile app
        window.location.href = '${redirectUrl}';
        
        // Fallback: if app doesn't open within 3 seconds, show manual link
        setTimeout(function() {
          document.body.innerHTML = '<div class="success">✅ Email Verified Successfully!</div><div class="message">Please open the LocalConnect app to continue.</div><a href="${redirectUrl}" class="button">Open LocalConnect App</a>';
        }, 3000);
      </script>
    </body>
    </html>
  `;
  
  res.send(html);
}));

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend verification email (authenticated version)
 * @access  Private
 */
router.post('/resend-verification', authenticate, asyncHandler(async (req, res) => {
  if (req.user.email_verified) {
    return res.status(400).json({
      success: false,
      message: 'Email is already verified'
    });
  }

  // Generate new verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await req.user.update({
    email_verification_token: verificationToken,
    email_verification_expires: verificationExpires
  });

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
}));

/**
 * @route   POST /api/auth/resend-verification-public
 * @desc    Resend verification email (public version - no auth required)
 * @access  Public
 */
router.post('/resend-verification-public', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required'
    });
  }

  // Find user by email
  const user = await User.findOne({ 
    where: { email: email.toLowerCase() }
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found with this email address'
    });
  }

  if (user.email_verified) {
    return res.status(400).json({
      success: false,
      message: 'Email is already verified'
    });
  }

  // Generate new verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await user.update({
    email_verification_token: verificationToken,
    email_verification_expires: verificationExpires
  });

  // Send verification email
  try {
    await emailService.sendVerificationEmail(user.email, user.displayName, verificationToken);
    
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
}));

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change password
 * @access  Private
 */
router.put('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, req.user.password);
  if (!isCurrentPasswordValid) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  // Update password
  await req.user.update({ password: newPassword });

  // Create password change notification
  await Notification.createNotification({
    recipientId: req.user.id,
    title: 'Password Changed',
    message: 'Your password has been successfully changed. If this wasn\'t you, please contact support immediately.',
    type: 'security_alert',
    priority: 'high'
  });

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

/**
 * @route   DELETE /api/auth/delete-account
 * @desc    Delete user account
 * @access  Private
 */
router.delete('/delete-account', authenticate, asyncHandler(async (req, res) => {
  const { password } = req.body;

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, req.user.password);
  if (!isPasswordValid) {
    return res.status(400).json({
      success: false,
      message: 'Password is incorrect'
    });
  }

  // Soft delete the user (you might want to implement this differently)
  await req.user.update({
    status: 'banned',
    moderationReason: 'Account deleted by user',
    email: `deleted_${Date.now()}_${req.user.email}`,
    isActive: false
  });

  res.json({
    success: true,
    message: 'Account deleted successfully'
  });
}));

/**
 * @route   POST /api/auth/send-phone-verification
 * @desc    Send phone verification OTP
 * @access  Private
 */
router.post('/send-phone-verification', authenticate, asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({
      success: false,
      message: 'Phone number is required'
    });
  }

  // Validate phone number format
  const formattedPhone = smsService.formatPhoneNumber(phoneNumber);
  if (!smsService.validatePhoneNumber(formattedPhone)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid phone number format. Please use international format (e.g., +1234567890)'
    });
  }

  // Check if phone number is already verified by another user
  const existingUser = await User.findOne({
    where: {
      phone_number: formattedPhone,
      phone_verified: true,
      id: { [Op.ne]: req.user.id }
    }
  });

  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'This phone number is already verified by another account'
    });
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store OTP in user record
  await req.user.update({
    phone_verification_otp: otp,
    phone_verification_expires: otpExpires,
    phone_number: formattedPhone
  });

  // Send SMS OTP
  try {
    await smsService.sendPhoneVerification(formattedPhone, otp, 10);
    
    res.json({
      success: true,
      message: 'Phone verification code sent successfully'
    });
  } catch (error) {
    logger.error('Failed to send phone verification SMS:', error);
    
    // Clear OTP on failure
    await req.user.update({
      phone_verification_otp: null,
      phone_verification_expires: null
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to send verification code. Please try again.'
    });
  }
}));

/**
 * @route   POST /api/auth/verify-phone
 * @desc    Verify phone number with OTP
 * @access  Private
 */
router.post('/verify-phone', authenticate, asyncHandler(async (req, res) => {
  const { otp } = req.body;

  if (!otp || otp.length !== 6) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid 6-digit verification code'
    });
  }

  // Check if OTP exists and is not expired
  if (!req.user.phone_verification_otp || !req.user.phone_verification_expires) {
    return res.status(400).json({
      success: false,
      message: 'No verification code found. Please request a new one.'
    });
  }

  if (new Date() > req.user.phone_verification_expires) {
    return res.status(400).json({
      success: false,
      message: 'Verification code has expired. Please request a new one.'
    });
  }

  // Verify OTP
  if (req.user.phone_verification_otp !== otp) {
    return res.status(400).json({
      success: false,
      message: 'Invalid verification code. Please try again.'
    });
  }

  // Mark phone as verified
  await req.user.update({
    phone_verified: true,
    phone_verification_otp: null,
    phone_verification_expires: null
  });

  // Create verification notification
  await Notification.createNotification({
    recipientId: req.user.id,
    title: 'Phone Number Verified',
    message: `Your phone number ${req.user.phone_number} has been successfully verified.`,
    type: 'account_update',
    priority: 'normal'
  });

  res.json({
    success: true,
    message: 'Phone number verified successfully',
    data: {
      phoneNumber: req.user.phone_number,
      phoneVerified: true
    }
  });
}));

/**
 * @route   POST /api/auth/forgot-password-sms
 * @desc    Send password reset OTP via SMS
 * @access  Public
 */
router.post('/forgot-password-sms', asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({
      success: false,
      message: 'Phone number is required'
    });
  }

  // Format and validate phone number
  const formattedPhone = smsService.formatPhoneNumber(phoneNumber);
  if (!smsService.validatePhoneNumber(formattedPhone)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid phone number format. Please use international format (e.g., +1234567890)'
    });
  }

  // Find user by phone number
  const user = await User.findOne({
    where: { 
      phone_number: formattedPhone,
      phone_verified: true
    }
  });

  if (!user) {
    // Don't reveal if phone exists or not
    return res.json({
      success: true,
      message: 'If an account with that phone number exists, a password reset code has been sent.'
    });
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store OTP
  await user.update({
    password_reset_otp: otp,
    password_reset_otp_expires: otpExpires
  });

  // Send SMS OTP
  try {
    await smsService.sendPasswordResetSMS(formattedPhone, otp, 10);
    
    res.json({
      success: true,
      message: 'Password reset code has been sent to your phone.'
    });
  } catch (error) {
    logger.error('Failed to send password reset SMS:', error);
    
    // Clear OTP on failure
    await user.update({
      password_reset_otp: null,
      password_reset_otp_expires: null
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to send reset code. Please try again.'
    });
  }
}));

/**
 * @route   POST /api/auth/reset-password-sms
 * @desc    Reset password with SMS OTP
 * @access  Public
 */
router.post('/reset-password-sms', asyncHandler(async (req, res) => {
  const { phoneNumber, otp, newPassword } = req.body;

  if (!phoneNumber || !otp || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Phone number, OTP, and new password are required'
    });
  }

  // Format phone number
  const formattedPhone = smsService.formatPhoneNumber(phoneNumber);

  // Find user and verify OTP
  const user = await User.findOne({
    where: {
      phone_number: formattedPhone,
      phone_verified: true,
      password_reset_otp: otp,
      password_reset_otp_expires: { [Op.gt]: new Date() }
    }
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired reset code'
    });
  }

  // Update password
  await user.update({
    password: newPassword,
    password_reset_otp: null,
    password_reset_otp_expires: null
  });

  // Generate new JWT token
  const jwtToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  // Create password change notification
  await Notification.createNotification({
    recipientId: user.id,
    title: 'Password Reset via SMS',
    message: 'Your password has been reset via SMS verification. If this wasn\'t you, please contact support immediately.',
    type: 'security_alert',
    priority: 'high'
  });

  res.json({
    success: true,
    message: 'Password reset successful',
    data: {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        phoneNumber: user.phone_number,
        phoneVerified: user.phone_verified,
        emailVerified: user.email_verified,
        role: user.role,
        status: user.status
      },
      token: jwtToken
    }
  });
}));

export default router;