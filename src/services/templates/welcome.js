export const welcomeTemplate = (name) => `
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
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to LocalConnect! 🎉</h1>
    </div>
    <div class="content">
      <h2>Hi ${name},</h2>
      <p>Welcome to LocalConnect! We're thrilled to have you join our community.</p>
      <p>With LocalConnect, you can:</p>
      <ul>
        <li>Connect with people in your local area</li>
        <li>Discover local events and activities</li>
        <li>Find and post local job opportunities</li>
        <li>Buy and sell items in the marketplace</li>
        <li>Join local community discussions</li>
      </ul>
      <p>Get started by completing your profile and exploring your neighborhood!</p>
      <a href="${process.env.FRONTEND_URL}/explore" class="button">Start Exploring</a>
      <p>If you have any questions, feel free to reach out to our support team.</p>
      <p>Best regards,<br>The LocalConnect Team</p>
    </div>
  </div>
</body>
</html>
`;
