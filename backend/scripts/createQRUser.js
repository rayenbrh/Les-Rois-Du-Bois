import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.model.js';

dotenv.config();

const createQRUser = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ ERROR: MONGODB_URI or MONGO_URI environment variable is required');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const qrUserData = {
      name: 'QR Code User',
      email: 'QR_code@lesroisdubois.com',
      password: 'QrP@ssw0rd!2025', // Will be hashed by pre-save hook
      role: 'client',
      isAdmin: false,
    };

    const existingUser = await User.findOne({ email: qrUserData.email });

    if (existingUser) {
      console.log('⚠️  QR Code user already exists');
      console.log('📧 Email:', qrUserData.email);
      console.log('🔄 Updating password...');
      
      // Update password if user exists
      existingUser.password = qrUserData.password;
      await existingUser.save();
      console.log('✅ QR Code user password updated successfully!');
    } else {
      const qrUser = await User.create(qrUserData);
      console.log('✅ QR Code user created successfully!');
      console.log('📧 Email:', qrUserData.email);
      console.log('🔑 Password (plain):', qrUserData.password);
      console.log('👤 Role:', qrUserData.role);
      console.log('📱 QR Login URL:');
      console.log(`https://lesroisdubois.com/login?u=${encodeURIComponent(qrUserData.email)}&p=${encodeURIComponent(qrUserData.password)}`);
    }

    console.log('⚠️  Keep credentials secure!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating QR user:', error);
    process.exit(1);
  }
};

createQRUser();




