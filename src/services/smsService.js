import twilio from 'twilio';
import logger from '../utils/logger.js';

class SMSService {
  constructor() {
    this.client = null;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    this.initializeClient();
  }

  initializeClient() {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken || !this.fromNumber) {
        logger.warn('Twilio credentials not configured. SMS service will be disabled.');
        this.client = null;
        return;
      }

      this.client = twilio(accountSid, authToken);
      logger.info('SMS service initialized with Twilio');
    } catch (error) {
      logger.error('Failed to initialize SMS service:', error);
      this.client = null;
    }
  }

  /**
   * Send OTP via SMS
   */
  async sendOTP(phoneNumber, otp, expiryMinutes = 10) {
    if (!this.client) {
      throw new Error('SMS service not configured');
    }

    try {
      const message = `Your LocalConnect verification code is: ${otp}. Valid for ${expiryMinutes} minutes. Do not share this code with anyone.`;
      
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber
      });

      logger.info(`SMS OTP sent to ${phoneNumber}, SID: ${result.sid}`);
      return result;
    } catch (error) {
      logger.error(`Failed to send SMS OTP to ${phoneNumber}:`, error);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  /**
   * Send phone verification SMS
   */
  async sendPhoneVerification(phoneNumber, otp, expiryMinutes = 10) {
    if (!this.client) {
      throw new Error('SMS service not configured');
    }

    try {
      const message = `Your LocalConnect phone verification code is: ${otp}. Valid for ${expiryMinutes} minutes.`;
      
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber
      });

      logger.info(`Phone verification SMS sent to ${phoneNumber}, SID: ${result.sid}`);
      return result;
    } catch (error) {
      logger.error(`Failed to send phone verification SMS to ${phoneNumber}:`, error);
      throw new Error(`Failed to send verification SMS: ${error.message}`);
    }
  }

  /**
   * Send password reset SMS
   */
  async sendPasswordResetSMS(phoneNumber, otp, expiryMinutes = 10) {
    if (!this.client) {
      throw new Error('SMS service not configured');
    }

    try {
      const message = `Your LocalConnect password reset code is: ${otp}. Valid for ${expiryMinutes} minutes. If you didn't request this, please ignore.`;
      
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber
      });

      logger.info(`Password reset SMS sent to ${phoneNumber}, SID: ${result.sid}`);
      return result;
    } catch (error) {
      logger.error(`Failed to send password reset SMS to ${phoneNumber}:`, error);
      throw new Error(`Failed to send reset SMS: ${error.message}`);
    }
  }

  /**
   * Send two-factor authentication SMS
   */
  async sendTwoFactorSMS(phoneNumber, otp, expiryMinutes = 5) {
    if (!this.client) {
      throw new Error('SMS service not configured');
    }

    try {
      const message = `Your LocalConnect 2FA code is: ${otp}. Valid for ${expiryMinutes} minutes.`;
      
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber
      });

      logger.info(`2FA SMS sent to ${phoneNumber}, SID: ${result.sid}`);
      return result;
    } catch (error) {
      logger.error(`Failed to send 2FA SMS to ${phoneNumber}:`, error);
      throw new Error(`Failed to send 2FA SMS: ${error.message}`);
    }
  }

  /**
   * Send security alert SMS
   */
  async sendSecurityAlert(phoneNumber, alertType, details) {
    if (!this.client) {
      throw new Error('SMS service not configured');
    }

    try {
      const message = `LocalConnect Security Alert: ${alertType}. ${details}. If this wasn't you, contact support immediately.`;
      
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber
      });

      logger.info(`Security alert SMS sent to ${phoneNumber}, SID: ${result.sid}`);
      return result;
    } catch (error) {
      logger.error(`Failed to send security alert SMS to ${phoneNumber}:`, error);
      throw new Error(`Failed to send security alert: ${error.message}`);
    }
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phoneNumber) {
    // Basic phone number validation (E.164 format)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Format phone number to E.164
   */
  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // If it doesn't start with +, assume it's a US number
    if (!cleaned.startsWith('+')) {
      cleaned = '+1' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Check if SMS service is available
   */
  isAvailable() {
    return this.client !== null;
  }
}

export default new SMSService();
