import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔍 Authentication Debug Script');
console.log('==============================');

// Check environment variables
console.log('\n📋 Environment Variables:');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'SET (' + process.env.JWT_SECRET.length + ' chars)' : 'NOT SET');
console.log('- JWT_REFRESH_SECRET:', process.env.JWT_REFRESH_SECRET ? 'SET' : 'NOT SET');
console.log('- JWT_EXPIRES_IN:', process.env.JWT_EXPIRES_IN || '7d');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');

// Test JWT operations
console.log('\n🔐 Testing JWT Operations:');

try {
  const testUserId = 'test-user-123';
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    console.error('❌ JWT_SECRET is not set! This will cause authentication failures.');
    process.exit(1);
  }
  
  // Generate a test token
  const testToken = jwt.sign(
    { userId: testUserId },
    secret,
    { expiresIn: '1h' }
  );
  
  console.log('✅ Test token generated successfully');
  console.log('  - Token length:', testToken.length);
  console.log('  - Token starts with:', testToken.substring(0, 20) + '...');
  
  // Verify the test token
  const decoded = jwt.verify(testToken, secret);
  console.log('✅ Test token verified successfully');
  console.log('  - Decoded userId:', decoded.userId);
  console.log('  - Decoded exp:', new Date(decoded.exp * 1000).toISOString());
  
  // Test token expiration
  const expiredToken = jwt.sign(
    { userId: testUserId },
    secret,
    { expiresIn: '0s' } // Expired immediately
  );
  
  try {
    jwt.verify(expiredToken, secret);
    console.log('❌ Expired token verification should have failed');
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log('✅ Expired token correctly rejected');
    } else {
      console.log('❌ Unexpected error with expired token:', error.name);
    }
  }
  
  console.log('\n🎉 All JWT tests passed!');
  
} catch (error) {
  console.error('❌ JWT test failed:', error.message);
  process.exit(1);
}

// Test token format that might be sent from frontend
console.log('\n📱 Testing Frontend Token Format:');
try {
  const testUserId = 'test-user-123';
  const secret = process.env.JWT_SECRET;
  
  // Generate token like the backend does
  const token = jwt.sign(
    { userId: testUserId },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  
  console.log('✅ Backend-style token generated');
  console.log('  - Token:', token);
  console.log('  - Length:', token.length);
  
  // Test with Bearer prefix (like frontend sends)
  const bearerToken = `Bearer ${token}`;
  console.log('✅ Bearer token format:', bearerToken.substring(0, 30) + '...');
  
  // Extract token from Bearer format
  const extractedToken = bearerToken.replace('Bearer ', '');
  console.log('✅ Token extraction test passed');
  
  // Verify extracted token
  const decoded = jwt.verify(extractedToken, secret);
  console.log('✅ Extracted token verification passed');
  console.log('  - UserId:', decoded.userId);
  
} catch (error) {
  console.error('❌ Frontend token format test failed:', error.message);
}

console.log('\n📋 Recommendations:');
console.log('1. Check if JWT_SECRET is set in your Render environment variables');
console.log('2. Verify the frontend is sending tokens in "Bearer <token>" format');
console.log('3. Check if tokens are being stored properly in AsyncStorage');
console.log('4. Verify the backend is receiving Authorization headers');

console.log('\n🔍 Next Steps:');
console.log('1. Deploy this updated code to Render');
console.log('2. Check the logs for detailed authentication debugging');
console.log('3. Test login and subsequent API calls');
console.log('4. Look for the detailed logs in the console output');
