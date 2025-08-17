export const passwordUpdatedTemplate = (name) => `
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
    .success {
      background-color: #D4EDDA;
      color: #155724;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
    }
    .contact {
      background-color: #E9ECEF;
      padding: 15px;
      border-radius: 5px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Updated Successfully</h1>
    </div>
    <div class="content">
      <h2>Hi ${name},</h2>
      <div class="success">
        <p><strong>✅ Your password has been successfully updated!</strong></p>
      </div>
      <p>This is a confirmation that your LocalConnect account password has been changed.</p>
      <p>If you made this change, no further action is required.</p>
      <div class="contact">
        <p><strong>Didn't change your password?</strong></p>
        <p>If you didn't make this change, please:</p>
        <ol>
          <li>Contact our support team immediately</li>
          <li>Change your password</li>
          <li>Enable two-factor authentication if not already enabled</li>
        </ol>
      </div>
      <p>Best regards,<br>The LocalConnect Security Team</p>
    </div>
  </div>
</body>
</html>
`;
