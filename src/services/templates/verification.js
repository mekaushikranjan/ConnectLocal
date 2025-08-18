export const verificationTemplate = (name, verificationUrl) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - LocalConnect</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f8f9fa;
      padding: 20px 0;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
      position: relative;
    }
    
    .logo {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      margin: 0 auto 20px;
      display: block;
      background-color: white;
      padding: 10px;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
    }
    
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 10px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .header p {
      font-size: 18px;
      opacity: 0.9;
      font-weight: 300;
    }
    
    .content {
      padding: 40px 30px;
    }
    
    .greeting {
      font-size: 28px;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 20px;
    }
    
    .message {
      font-size: 18px;
      color: #4a5568;
      margin-bottom: 30px;
      line-height: 1.7;
    }
    
    .cta-section {
      text-align: center;
      margin: 40px 0;
    }
    
    .button {
      display: inline-block;
      padding: 16px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 600;
      font-size: 16px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }
    
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
    }
    
    .link-section {
      background-color: #f7fafc;
      border-radius: 12px;
      padding: 20px;
      margin: 30px 0;
      border-left: 4px solid #667eea;
    }
    
    .link-section p {
      color: #2d3748;
      font-size: 14px;
      margin-bottom: 10px;
      font-weight: 600;
    }
    
    .verification-link {
      word-break: break-all;
      color: #667eea;
      font-size: 14px;
      font-family: monospace;
      background-color: #edf2f7;
      padding: 10px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    
    .footer {
      background-color: #f7fafc;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    
    .footer p {
      color: #718096;
      font-size: 14px;
      margin-bottom: 15px;
    }
    
    .footer .team {
      color: #2d3748;
      font-weight: 600;
    }
    
    .note {
      background-color: #fff5f5;
      border-radius: 8px;
      padding: 20px;
      margin: 30px 0;
      border-left: 4px solid #f56565;
    }
    
    .note p {
      color: #c53030;
      font-size: 14px;
      margin-bottom: 8px;
    }
    
    @media (max-width: 600px) {
      .container {
        margin: 10px;
        border-radius: 12px;
      }
      
      .header, .content, .footer {
        padding: 25px 20px;
      }
      
      .header h1 {
        font-size: 24px;
      }
      
      .greeting {
        font-size: 22px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="cid:icon.png" alt="LocalConnect" class="logo">
      <h1>🔐 Verify Your Email</h1>
      <p>Complete your LocalConnect registration</p>
    </div>
    
    <div class="content">
      <div class="greeting">Hi ${name}!</div>
      
      <div class="message">
        Welcome to LocalConnect! To complete your registration and start connecting with your local community, please verify your email address by clicking the button below.
      </div>
      
      <div class="cta-section">
        <a href="${verificationUrl}" class="button">Verify Email Address</a>
      </div>
      
      <div class="link-section">
        <p>Or copy and paste this link into your browser:</p>
        <div class="verification-link">${verificationUrl}</div>
      </div>
      
      <div class="note">
        <p><strong>Important:</strong> This verification link will expire in 24 hours.</p>
        <p>If you didn't create an account with LocalConnect, please ignore this email.</p>
      </div>
    </div>
    
    <div class="footer">
      <p class="team">Best regards,<br>The LocalConnect Team</p>
      <p>Need help? Contact our support team</p>
    </div>
  </div>
</body>
</html>
`;
