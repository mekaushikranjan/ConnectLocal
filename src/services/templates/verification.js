export const verificationTemplate = (name) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Verified - LocalConnect</title>
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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .container {
      max-width: 600px;
      width: 100%;
      background-color: #ffffff;
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      animation: slideUp 0.6s ease-out;
    }
    
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
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
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.05);
      }
      100% {
        transform: scale(1);
      }
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
      text-align: center;
    }
    
    .success-icon {
      width: 100px;
      height: 100px;
      background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
      border-radius: 50%;
      margin: 0 auto 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: bounce 1s ease-in-out;
    }
    
    @keyframes bounce {
      0%, 20%, 50%, 80%, 100% {
        transform: translateY(0);
      }
      40% {
        transform: translateY(-10px);
      }
      60% {
        transform: translateY(-5px);
      }
    }
    
    .success-icon::after {
      content: "✓";
      color: white;
      font-size: 50px;
      font-weight: bold;
    }
    
    .greeting {
      font-size: 28px;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 20px;
    }
    
    .success-message {
      font-size: 18px;
      color: #4a5568;
      margin-bottom: 30px;
      line-height: 1.7;
    }
    
    .welcome-section {
      background-color: #f7fafc;
      border-radius: 12px;
      padding: 30px;
      margin: 30px 0;
      border-left: 4px solid #4CAF50;
    }
    
    .welcome-section h3 {
      color: #2d3748;
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 15px;
    }
    
    .welcome-section p {
      color: #4a5568;
      font-size: 16px;
      line-height: 1.6;
    }
    
    .cta-section {
      margin: 35px 0;
    }
    
    .button {
      display: inline-block;
      padding: 16px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      margin: 10px;
    }
    
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
    }
    
    .secondary-button {
      background: transparent;
      color: #667eea;
      border: 2px solid #667eea;
      box-shadow: none;
    }
    
    .secondary-button:hover {
      background: #667eea;
      color: white;
    }
    
    .auto-redirect {
      background-color: #e8f5e8;
      border: 1px solid #4CAF50;
      border-radius: 8px;
      padding: 15px;
      margin: 25px 0;
      text-align: center;
    }
    
    .auto-redirect p {
      color: #2d3748;
      font-size: 14px;
      margin-bottom: 5px;
    }
    
    .countdown {
      color: #4CAF50;
      font-weight: 600;
      font-size: 16px;
    }
    
    .footer {
      background-color: #f7fafc;
      padding: 25px 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    
    .footer p {
      color: #718096;
      font-size: 14px;
      margin-bottom: 10px;
    }
    
    .footer .team {
      color: #2d3748;
      font-weight: 600;
    }
    
    .social-links {
      margin-top: 15px;
    }
    
    .social-links a {
      display: inline-block;
      margin: 0 10px;
      color: #667eea;
      text-decoration: none;
      font-weight: 500;
    }
    
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    
    .feature-item {
      text-align: center;
      padding: 20px;
      background-color: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #e9ecef;
    }
    
    .feature-icon {
      font-size: 24px;
      margin-bottom: 10px;
    }
    
    .feature-title {
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 5px;
    }
    
    .feature-desc {
      font-size: 14px;
      color: #718096;
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
      
      .features-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="cid:icon.png" alt="LocalConnect" class="logo">
      <h1>🎉 Email Verified Successfully!</h1>
      <p>Welcome to your local community</p>
    </div>
    
    <div class="content">
      <div class="success-icon"></div>
      
      <div class="greeting">Hi ${name}!</div>
      
      <div class="success-message">
        Your email has been successfully verified. You're now part of the LocalConnect community!
      </div>
      
      <div class="auto-redirect">
        <p>You will be automatically redirected to the LocalConnect app in <span class="countdown" id="countdown">5</span> seconds.</p>
        <p>If you're not redirected automatically, click the button below.</p>
      </div>
      
      <div class="welcome-section">
        <h3>🌟 Welcome to LocalConnect!</h3>
        <p>You're now ready to connect with your local community. Discover events, find jobs, buy and sell items, and make meaningful connections with people in your area.</p>
      </div>
      
      <div class="features-grid">
        <div class="feature-item">
          <div class="feature-icon">👥</div>
          <div class="feature-title">Connect Locally</div>
          <div class="feature-desc">Meet people in your neighborhood</div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">🎯</div>
          <div class="feature-title">Find Jobs</div>
          <div class="feature-desc">Discover local opportunities</div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">🛍️</div>
          <div class="feature-title">Marketplace</div>
          <div class="feature-desc">Buy and sell locally</div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">📱</div>
          <div class="feature-title">Stay Connected</div>
          <div class="feature-desc">Real-time updates and chat</div>
        </div>
      </div>
      
      <div class="cta-section">
        <a href="localconnect://open" class="button">Open LocalConnect App</a>
        <a href="${process.env.FRONTEND_URL}" class="button secondary-button">Continue in Browser</a>
      </div>
    </div>
    
    <div class="footer">
      <p class="team">Best regards,<br>The LocalConnect Team</p>
      <div class="social-links">
        <a href="#">Help Center</a> • 
        <a href="#">Contact Support</a> • 
        <a href="#">Privacy Policy</a>
      </div>
    </div>
  </div>

  <script>
    // Countdown timer for auto-redirect
    let countdown = 5;
    const countdownElement = document.getElementById('countdown');
    
    const timer = setInterval(() => {
      countdown--;
      countdownElement.textContent = countdown;
      
      if (countdown <= 0) {
        clearInterval(timer);
        // Try to open the app, fallback to web
        window.location.href = 'localconnect://open';
        
        // Fallback after 2 seconds if app doesn't open
        setTimeout(() => {
          window.location.href = '${process.env.FRONTEND_URL}';
        }, 2000);
      }
    }, 1000);
    
    // Add some interactive effects
    document.addEventListener('DOMContentLoaded', function() {
      const buttons = document.querySelectorAll('.button');
      buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
          this.style.transform = 'translateY(-2px)';
        });
        button.addEventListener('mouseleave', function() {
          this.style.transform = 'translateY(0)';
        });
      });
    });
  </script>
</body>
</html>
`;
