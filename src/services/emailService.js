import nodemailer from 'nodemailer';
import { welcomeTemplate } from './templates/welcome.js';
import { verificationTemplate } from './templates/verification.js';
import { forgotPasswordTemplate } from './templates/forgotPassword.js';
import { passwordUpdatedTemplate } from './templates/passwordUpdated.js';
import { otpTemplate } from './templates/otp.js';
import logger from '../utils/logger.js';

class EmailService {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      // Check if we have production email credentials
      const hasProductionCredentials = 
        process.env.EMAIL_HOST && 
        process.env.EMAIL_USER && 
        process.env.EMAIL_PASS;

      if (process.env.NODE_ENV === 'production' && hasProductionCredentials) {
        // Production: Use real SMTP
        this.transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: Number(process.env.EMAIL_PORT) || 587,
          secure: process.env.EMAIL_SECURE === 'true',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          },
          // Additional production settings
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
          rateLimit: 14, // Limit to 14 emails per second
          tls: {
            rejectUnauthorized: false
          }
        });

        // Verify connection configuration
        this.verifyConnection();
        logger.info('EmailService initialized in production mode with SMTP');
      } else if (process.env.EMAIL_SERVICE === 'gmail' && process.env.GMAIL_APP_PASSWORD) {
        // Gmail OAuth2 setup
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
          }
        });
        logger.info('EmailService initialized with Gmail OAuth2');
      } else if (process.env.EMAIL_SERVICE === 'sendgrid' && process.env.SENDGRID_API_KEY) {
        // SendGrid setup
        this.transporter = nodemailer.createTransport({
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY
          }
        });
        logger.info('EmailService initialized with SendGrid');
      } else if (process.env.EMAIL_SERVICE === 'mailgun' && process.env.MAILGUN_API_KEY) {
        // Mailgun setup
        this.transporter = nodemailer.createTransport({
          host: process.env.MAILGUN_HOST || 'smtp.mailgun.org',
          port: 587,
          secure: false,
          auth: {
            user: process.env.MAILGUN_USER,
            pass: process.env.MAILGUN_API_KEY
          }
        });
        logger.info('EmailService initialized with Mailgun');
      } else {
        // Development/Test mode: Use stream transport
        this.transporter = nodemailer.createTransport({
          streamTransport: true,
          buffer: true,
          newline: 'unix'
        });
        logger.warn('EmailService running in dev/test mode: emails are not sent (using streamTransport).');
        logger.info('To enable production emails, set EMAIL_HOST, EMAIL_USER, EMAIL_PASS or use EMAIL_SERVICE=gmail/sendgrid/mailgun');
      }
    } catch (error) {
      logger.error('Error initializing email transporter:', error);
      // Fallback to stream transport
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        buffer: true,
        newline: 'unix'
      });
      logger.warn('EmailService fallback to stream transport due to initialization error');
    }
  }

  async verifyConnection() {
    try {
      await this.transporter.verify();
      logger.info('Email transporter connection verified successfully');
    } catch (error) {
      logger.error('Email transporter connection verification failed:', error);
      throw new Error('Email service configuration is invalid');
    }
  }

  async sendEmailWithRetry(to, subject, html, retryCount = 0) {
    try {
      const mailOptions = {
        from: this.getFromAddress(),
        to,
        subject,
        html,
        // Additional headers for better deliverability
        headers: {
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
          'Importance': 'normal'
        }
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info(`Email sent successfully: ${info.messageId} to ${to}`);
      
      // Log preview in development
      if (process.env.NODE_ENV !== 'production') {
        const preview = typeof info.message === 'string' ? info.message.slice(0, 500) : '[streamTransport output]';
        logger.info(`Email preview (dev): to=${to}, subject="${subject}"`);
        logger.debug(preview);
      }
      
      return info;
    } catch (error) {
      logger.error(`Email send attempt ${retryCount + 1} failed:`, error);
      
      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        logger.info(`Retrying email send in ${this.retryDelay}ms...`);
        await this.delay(this.retryDelay);
        return this.sendEmailWithRetry(to, subject, html, retryCount + 1);
      }
      
      throw new Error(`Failed to send email after ${this.maxRetries + 1} attempts: ${error.message}`);
    }
  }

  isRetryableError(error) {
    // Retry on network errors, rate limits, and temporary failures
    const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'];
    const retryableMessages = ['rate limit', 'temporary', 'timeout', 'connection'];
    
    return retryableCodes.includes(error.code) || 
           retryableMessages.some(msg => error.message.toLowerCase().includes(msg));
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getFromAddress() {
    const fromName = process.env.EMAIL_FROM_NAME || 'LocalConnect';
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER || 'noreply@localconnect.com';
    return `${fromName} <${fromAddress}>`;
  }

  async sendEmail(to, subject, html) {
    return this.sendEmailWithRetry(to, subject, html);
  }

  async sendWelcomeEmail(email, name) {
    const html = welcomeTemplate(name);
    return this.sendEmail(email, 'Welcome to LocalConnect! 🎉', html);
  }

  async sendVerificationEmail(email, name, token) {
    const verificationUrl = `${process.env.FRONTEND_URL}/auth/email-verification?token=${token}`;
    const html = verificationTemplate(name, verificationUrl);
    return this.sendEmail(email, 'Verify Your Email Address', html);
  }

  async sendPasswordResetEmail(email, name, token) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    const html = forgotPasswordTemplate(name, resetUrl);
    return this.sendEmail(email, 'Reset Your Password', html);
  }

  async sendPasswordUpdatedEmail(email, name) {
    const html = passwordUpdatedTemplate(name);
    return this.sendEmail(email, 'Password Successfully Updated', html);
  }

  async sendOTPEmail(email, name, otp, expiryMinutes = 10) {
    const html = otpTemplate(name, otp, expiryMinutes);
    return this.sendEmail(email, 'Your LocalConnect Verification Code', html);
  }

  // Additional email methods for production
  async sendNotificationEmail(email, name, notificationType, data) {
    const subject = `New ${notificationType} on LocalConnect`;
    const html = `
      <h2>Hello ${name},</h2>
      <p>You have a new ${notificationType} on LocalConnect.</p>
      <p>${data.message || ''}</p>
      <p>Best regards,<br>The LocalConnect Team</p>
    `;
    return this.sendEmail(email, subject, html);
  }

  async sendSecurityAlertEmail(email, name, alertType, details) {
    const subject = `Security Alert - ${alertType}`;
    const html = `
      <h2>Security Alert</h2>
      <p>Hello ${name},</p>
      <p>We detected ${alertType} on your LocalConnect account.</p>
      <p>Details: ${details}</p>
      <p>If this wasn't you, please contact support immediately.</p>
      <p>Best regards,<br>The LocalConnect Security Team</p>
    `;
    return this.sendEmail(email, subject, html);
  }
}

export default new EmailService();
