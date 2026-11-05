import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'الاسم مطلوب'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'البريد الإلكتروني مطلوب'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'كلمة المرور مطلوبة'],
      minlength: [6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'],
      select: false,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['admin', 'commercial', 'store_manager', 'store_cashier', 'accountant', 'inventory_manager', 'user', 'client'],
      default: 'user',
    },
    // CRM fields
    clientType: {
      type: String,
      enum: ['individual', 'business'],
    },
    commercialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    companyName: {
      type: String,
    },
    taxId: {
      type: String,
    },
    creditLimit: {
      type: Number,
      default: 0,
    },
    paymentTerms: {
      type: String,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    lastOrderDate: {
      type: Date,
    },
    clientStatus: {
      type: String,
      enum: ['active', 'inactive', 'blocked'],
      default: 'active',
    },
    // Store assignment
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
    },
    // Client fields
    phone: {
      type: String,
    },
    addresses: [
      {
        fullName: String,
        street: String,
        city: String,
        zip: String,
        phone: String,
        isDefault: { type: Boolean, default: false },
      },
    ],
    // Incremented on password change/reset to revoke existing sessions
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ role: 1 });
userSchema.index({ commercialId: 1 });

// Hash password before saving (only when it actually changed)
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT token - no expiry: the session lasts until the user logs out
// (or the password is changed/reset, which bumps tokenVersion).
userSchema.methods.generateToken = function () {
  return jwt.sign({ id: this._id, v: this.tokenVersion || 0 }, process.env.JWT_SECRET);
};

// Public representation of the authenticated user
userSchema.methods.toAuthJSON = function () {
  return {
    id: this._id,
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    isAdmin: this.isAdmin,
    phone: this.phone,
    addresses: this.addresses || [],
    storeId: this.storeId,
    commercialId: this.commercialId,
    companyName: this.companyName,
    totalOrders: this.totalOrders || 0,
    totalSpent: this.totalSpent || 0,
    priceTier: this.role === 'client' ? 'gros' : 'detail',
  };
};

export default mongoose.model('User', userSchema);

