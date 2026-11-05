import User from '../models/User.model.js';
import { login, changePassword as changeAccountPassword } from './auth.controller.js';

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Client login - same unified login (token never expires)
export const clientLogin = login;

/**
 * Store sign-up. New accounts are always "client en détail" (role `user`).
 * The admin can later switch them to "client en gros" (role `client`).
 */
export const clientRegister = async (req, res, next) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const { password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال جميع الحقول المطلوبة' });
    }
    if (!EMAIL_RX.test(email)) {
      return res.status(400).json({ success: false, message: 'البريد الإلكتروني غير صالح' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    if (await User.exists({ email })) {
      return res.status(400).json({ success: false, message: 'البريد الإلكتروني مستخدم بالفعل' });
    }

    const user = await User.create({
      name: name.slice(0, 100),
      email,
      password,
      phone: phone.slice(0, 30),
      isAdmin: false,
      role: 'user',
      clientType: 'individual',
      clientStatus: 'active',
    });

    res.status(201).json({ success: true, token: user.generateToken(), user: user.toAuthJSON() });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'البريد الإلكتروني مستخدم بالفعل' });
    }
    next(error);
  }
};

// Get current client
export const getClientMe = async (req, res) => {
  res.status(200).json({ success: true, user: req.user.toAuthJSON() });
};

const cleanAddress = (a = {}) => ({
  fullName: String(a.fullName || '').trim().slice(0, 100),
  street: String(a.street || '').trim().slice(0, 200),
  city: String(a.city || '').trim().slice(0, 100),
  zip: String(a.zip || '').trim().slice(0, 20),
  phone: String(a.phone || '').trim().slice(0, 30),
  isDefault: !!a.isDefault,
});

// Update client profile
export const updateClientProfile = async (req, res, next) => {
  try {
    const { name, phone, addresses } = req.body;
    const user = await User.findById(req.user._id);

    if (typeof name === 'string' && name.trim()) user.name = name.trim().slice(0, 100);
    if (typeof phone === 'string') user.phone = phone.trim().slice(0, 30);
    if (Array.isArray(addresses)) user.addresses = addresses.slice(0, 10).map(cleanAddress);

    await user.save();

    res.status(200).json({ success: true, user: user.toAuthJSON() });
  } catch (error) {
    next(error);
  }
};

// Change password
export const changePassword = changeAccountPassword;
