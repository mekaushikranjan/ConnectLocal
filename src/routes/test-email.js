import express from 'express';
import EmailService from '../services/emailService.js';

const router = express.Router();
const emailService = new EmailService();

/**
 * @route   POST /api/test/email
 * @desc    Test email sending
 * @access  Public
 */
router.post('/email', async (req, res) => {
    try {
        console.log('Testing email configuration...');
        
        // First verify the connection
        try {
            await emailService.verifyConnection();
            console.log('Email connection verified successfully');
        } catch (error) {
            console.error('Email verification failed:', error);
            return res.status(500).json({
                success: false,
                stage: 'verification',
                error: error.message
            });
        }

        // Try to send a test email
        const testResult = await emailService.sendEmail(
            process.env.EMAIL_USER, // Send to ourselves
            'Test Email from LocalConnect',
            '<h1>Test Email</h1><p>If you receive this email, the email service is working correctly!</p>'
        );

        console.log('Email sent successfully:', testResult);

        res.json({
            success: true,
            message: 'Test email sent successfully',
            result: testResult
        });
    } catch (error) {
        console.error('Failed to send test email:', error);
        res.status(500).json({
            success: false,
            stage: 'sending',
            error: error.message
        });
    }
});

export default router;
