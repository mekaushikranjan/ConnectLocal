export const verificationSuccessTemplate = (redirectUrl) => `
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
      max-width: 500px;
      width: 100%;
      background-color: #ffffff;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
      overflow: hidden;
      text-align: center;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
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
    
    .app-name {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 10px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .success-icon {
      font-size: 60px;
      margin-bottom: 20px;
      display: block;
    }
    
    .content {
      padding: 40px 30px;
    }
    
    .success-title {
      font-size: 32px;
      font-weight: 700;
      color: #2d3748;
      margin-bottom: 15px;
    }
    
    .success-message {
      font-size: 18px;
      color: #4a5568;
      margin-bottom: 30px;
      line-height: 1.6;
    }
    
    .redirect-message {
      background-color: #f7fafc;
      border-radius: 12px;
      padding: 20px;
      margin: 30px 0;
      border-left: 4px solid #48bb78;
    }
    
    .redirect-message p {
      color: #2d3748;
      font-size: 16px;
      margin-bottom: 10px;
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
      margin-top: 10px;
    }
    
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
    }
    
    .footer {
      background-color: #f7fafc;
      padding: 25px;
      border-top: 1px solid #e2e8f0;
    }
    
    .footer p {
      color: #718096;
      font-size: 14px;
    }
    
    .loading {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-left: 10px;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    @media (max-width: 600px) {
      .container {
        margin: 10px;
        border-radius: 16px;
      }
      
      .header, .content, .footer {
        padding: 25px 20px;
      }
      
      .success-title {
        font-size: 24px;
      }
      
      .app-name {
        font-size: 22px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="cid:icon.png" alt="LocalConnect" class="logo">
      <div class="app-name">LocalConnect</div>
      <span class="success-icon">✅</span>
    </div>
    
    <div class="content">
      <div class="success-title">Email Verified Successfully!</div>
      
      <div class="success-message">
        Congratulations! Your email address has been successfully verified. You're now ready to explore LocalConnect and connect with your local community.
      </div>
      
      <div class="redirect-message">
        <p><strong>Redirecting to LocalConnect...</strong></p>
        <p>You will be automatically redirected to the app in a few seconds.</p>
        <div class="loading"></div>
      </div>
      
      <a href="${redirectUrl}" class="button">Open LocalConnect App</a>
    </div>
    
    <div class="footer">
      <p>If you're not redirected automatically, click the button above to open the LocalConnect app.</p>
    </div>
  </div>
  
  <script>
    // Try to open the mobile app immediately
    window.location.href = '${redirectUrl}';
    
    // Fallback: if app doesn't open within 5 seconds, show manual link
    setTimeout(function() {
      const redirectMessage = document.querySelector('.redirect-message');
      redirectMessage.innerHTML = '<p><strong>App not opened automatically?</strong></p><p>Click the button below to open LocalConnect manually.</p>';
    }, 5000);
  </script>
</body>
</html>
`;
