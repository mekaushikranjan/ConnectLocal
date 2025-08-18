export const welcomeTemplate = (name) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to LocalConnect</title>
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
    
    .welcome-text {
      font-size: 18px;
      color: #4a5568;
      margin-bottom: 30px;
      line-height: 1.7;
    }
    
    .features {
      background-color: #f7fafc;
      border-radius: 12px;
      padding: 30px;
      margin: 30px 0;
      border-left: 4px solid #667eea;
    }
    
    .features h3 {
      color: #2d3748;
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    
    .features ul {
      list-style: none;
      padding: 0;
    }
    
    .features li {
      padding: 12px 0;
      color: #4a5568;
      position: relative;
      padding-left: 30px;
      font-size: 16px;
    }
    
    .features li:before {
      content: "✓";
      position: absolute;
      left: 0;
      color: #48bb78;
      font-weight: bold;
      font-size: 18px;
      background-color: #f0fff4;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
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
    
    .social-links {
      margin-top: 20px;
    }
    
    .social-links a {
      display: inline-block;
      margin: 0 10px;
      color: #667eea;
      text-decoration: none;
      font-weight: 500;
      padding: 8px 16px;
      border-radius: 6px;
      transition: background-color 0.3s ease;
    }
    
    .social-links a:hover {
      background-color: #edf2f7;
    }
    
    .app-info {
      background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
      border-radius: 12px;
      padding: 25px;
      margin: 30px 0;
      text-align: center;
      border: 1px solid #e2e8f0;
    }
    
    .app-info h4 {
      color: #2d3748;
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 10px;
    }
    
    .app-info p {
      color: #4a5568;
      font-size: 14px;
      line-height: 1.6;
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
      
      .features {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="cid:icon.png" alt="LocalConnect" class="logo">
      <h1>🎉 Welcome to LocalConnect!</h1>
      <p>Your local community awaits</p>
    </div>
    
    <div class="content">
      <div class="greeting">Hi ${name}!</div>
      
      <div class="welcome-text">
        Welcome to LocalConnect! We're thrilled to have you join our vibrant community where neighbors become friends and local connections flourish.
      </div>
      
      <div class="app-info">
        <h4>🌟 About LocalConnect</h4>
        <p>LocalConnect is your gateway to meaningful local connections. Our app combines location-based networking with community features to help you discover, connect, and engage with people in your area.</p>
      </div>
      
      <div class="features">
        <h3>What you can do with LocalConnect:</h3>
        <ul>
          <li>Connect with people in your local area</li>
          <li>Discover local events and activities</li>
          <li>Find and post local job opportunities</li>
          <li>Buy and sell items in the marketplace</li>
          <li>Join local community discussions</li>
          <li>Share local news and updates</li>
          <li>Create and join local groups</li>
          <li>Get real-time local notifications</li>
        </ul>
      </div>
      
      <div class="cta-section">
        <p style="margin-bottom: 20px; color: #4a5568; font-size: 16px;">Ready to explore your neighborhood?</p>
        <a href="${process.env.FRONTEND_URL}/explore" class="button">Start Exploring</a>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <p style="color: #718096; font-size: 14px;">
          If you have any questions, feel free to reach out to our support team.
        </p>
      </div>
    </div>
    
    <div class="footer">
      <p class="team">Best regards,<br>The LocalConnect Team</p>
      <div class="social-links">
        <a href="#">Help Center</a> • 
        <a href="#">Contact Support</a> • 
        <a href="#">Privacy Policy</a> • 
        <a href="#">Terms of Service</a>
      </div>
    </div>
  </div>
</body>
</html>
`;
