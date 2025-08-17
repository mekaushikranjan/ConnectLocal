export const forgotPasswordTemplate = (name, resetUrl) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #4A90E2;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 5px 5px 0 0;
    }
    .content {
      padding: 20px;
      background-color: #fff;
      border: 1px solid #ddd;
      border-radius: 0 0 5px 5px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #4A90E2;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
    }
    .warning {
      background-color: #FFF3CD;
      color: #856404;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Reset Your Password</h1>
    </div>
    <div class="content">
      <h2>Hi ${name},</h2>
      <p>We received a request to reset your LocalConnect password.</p>
      <p>Click the button below to reset your password:</p>
      <a href="${resetUrl}" class="button">Reset Password</a>
      <p>Or copy and paste this link into your browser:</p>
      <p>${resetUrl}</p>
      <div class="warning">
        <strong>Important:</strong>
        <ul>
          <li>This link will expire in 1 hour</li>
          <li>If you didn't request a password reset, please ignore this email</li>
          <li>Your account security is important to us</li>
        </ul>
      </div>
      <p>For security, this request was received from [Device/Location]. If you didn't make this request, please contact our support team immediately.</p>
      <p>Best regards,<br>The LocalConnect Security Team</p>
    </div>
  </div>
</body>
</html>
`;
