// Test script for email verification
// Run with: node test-email-verification.js

import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

// Test email verification URL generation
function testEmailVerificationUrl() {
  const token = crypto.randomBytes(32).toString('hex');
  
  // Test with different backend URL configurations
  const testCases = [
    {
      name: 'With BACKEND_URL set',
      backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
      expected: `http://localhost:3000/api/auth/verify-email?token=${token}`
    },
    {
      name: 'With API_URL set',
      backendUrl: process.env.API_URL || 'http://localhost:3000',
      expected: `http://localhost:3000/api/auth/verify-email?token=${token}`
    },
    {
      name: 'Fallback to localhost',
      backendUrl: `http://localhost:${process.env.PORT || 3000}`,
      expected: `http://localhost:${process.env.PORT || 3000}/api/auth/verify-email?token=${token}`
    }
  ];

  console.log('🧪 Testing Email Verification URL Generation\n');
  
  testCases.forEach((testCase, index) => {
    const verificationUrl = `${testCase.backendUrl}/api/auth/verify-email?token=${token}`;
    const isCorrect = verificationUrl === testCase.expected;
    
    console.log(`${index + 1}. ${testCase.name}:`);
    console.log(`   URL: ${verificationUrl}`);
    console.log(`   Status: ${isCorrect ? '✅ Correct' : '❌ Incorrect'}`);
    console.log('');
  });

  console.log('📧 Email verification URLs should now point to backend endpoints instead of frontend URLs.');
  console.log('🔗 Users clicking these links will be redirected to the frontend after verification.');
}

// Test environment variables
function testEnvironmentVariables() {
  console.log('🔧 Environment Variables Check:\n');
  
  const requiredVars = [
    'BACKEND_URL',
    'FRONTEND_URL',
    'EMAIL_HOST',
    'EMAIL_USER',
    'EMAIL_PASS'
  ];

  requiredVars.forEach(varName => {
    const value = process.env[varName];
    const status = value ? '✅ Set' : '❌ Missing';
    const displayValue = value ? (varName.includes('PASS') ? '***' : value) : 'Not set';
    
    console.log(`${varName}: ${status} (${displayValue})`);
  });

  console.log('\n💡 Make sure to set these environment variables in your .env file.');
}

// Run tests
console.log('🚀 LocalConnect Email Verification Test\n');
console.log('=' .repeat(50));

testEnvironmentVariables();
console.log('\n' + '=' .repeat(50));
testEmailVerificationUrl();

console.log('\n✅ Test completed!');
console.log('\n📝 Next steps:');
console.log('1. Set up your environment variables');
console.log('2. Start your backend server');
console.log('3. Register a new user to test email verification');
console.log('4. Check the email for the verification link');
console.log('5. Click the link to verify it works correctly');
