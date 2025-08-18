import { sequelize } from './src/config/database.js';
import { User } from './src/models/index.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔍 Login Debug Test');
console.log('==================');

async function testLogin() {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Test user credentials
    const testEmail = 'test@example.com';
    const testPassword = 'password123';

    console.log('\n🔍 Testing login with:', {
      email: testEmail,
      password: testPassword
    });

    // Find user
    const user = await User.findOne({
      where: { email: testEmail.toLowerCase() }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('\n📋 User found:', {
      id: user.id,
      email: user.email,
      emailVerified: user.email_verified,
      status: user.status,
      hasPassword: !!user.password,
      passwordLength: user.password ? user.password.length : 0
    });

    // Test password
    const isPasswordValid = await bcrypt.compare(testPassword, user.password);
    console.log('\n🔐 Password check:', {
      isValid: isPasswordValid
    });

    // Check all login conditions
    console.log('\n🔍 Login conditions:');
    console.log('1. User exists:', !!user);
    console.log('2. Password valid:', isPasswordValid);
    console.log('3. Email verified:', user.email_verified);
    console.log('4. Account active:', user.status === 'active');

    if (!user.email_verified) {
      console.log('\n❌ LOGIN WILL FAIL: Email not verified');
      console.log('💡 Solution: Set email_verified to true for testing');
      
      // Option to fix the user for testing
      console.log('\n🔧 Fixing user for testing...');
      await user.update({ email_verified: true });
      console.log('✅ User email verified status updated');
    }

    if (user.status !== 'active') {
      console.log('\n❌ LOGIN WILL FAIL: Account not active');
      console.log('💡 Solution: Set status to "active"');
    }

    console.log('\n🎉 Login test completed');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testLogin();
