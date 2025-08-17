export const verificationTemplate = (name, verificationUrl) => `
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
    .note {
      font-size: 14px;
      color: #666;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Verify Your Email</h1>
    </div>
    <div class="content">
      <h2>Hi ${name},</h2>
      <p>Welcome to LocalConnect! Please verify your email address to get started.</p>
      <p>Click the button below to verify your email address:</p>
      <a href="${verificationUrl}" class="button">Verify Email</a>
      <p>Or copy and paste this link into your browser:</p>
      <p>${verificationUrl}</p>
      <div class="note">
        <p>This verification link will expire in 24 hours.</p>
        <p>If you didn't create an account with LocalConnect, please ignore this email.</p>
      </div>
      <p>Best regards,<br>The LocalConnect Team</p>
    </div>
  </div>
</body>
</html>
`;
