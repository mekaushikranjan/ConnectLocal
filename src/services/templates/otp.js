export const otpTemplate = (name, otp, expiryMinutes) => `
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
    .otp-code {
      font-size: 32px;
      font-weight: bold;
      text-align: center;
      padding: 20px;
      background-color: #F8F9FA;
      border-radius: 5px;
      letter-spacing: 5px;
      margin: 20px 0;
    }
    .warning {
      color: #721C24;
      background-color: #F8D7DA;
      padding: 15px;
      border-radius: 5px;
      margin-top: 20px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Verification Code</h1>
    </div>
    <div class="content">
      <h2>Hi ${name},</h2>
      <p>Your verification code for LocalConnect is:</p>
      <div class="otp-code">${otp}</div>
      <p>This code will expire in ${expiryMinutes} minutes.</p>
      <div class="warning">
        <strong>Important:</strong>
        <ul>
          <li>Never share this code with anyone</li>
          <li>Our team will never ask for this code</li>
          <li>If you didn't request this code, please ignore this email</li>
        </ul>
      </div>
      <p>If you're having trouble, contact our support team.</p>
      <p>Best regards,<br>The LocalConnect Security Team</p>
    </div>
  </div>
</body>
</html>
`;
