import User from '../models/User.model.js';

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

/**
 * Unified login for every role (admin, commercial, cashier, clients).
 * The returned token never expires: the session lasts until logout.
 */
export const login = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'الرجاء إدخال البريد وكلمة المرور' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    if (['user', 'client'].includes(user.role) && user.clientStatus === 'blocked') {
      return res.status(403).json({ success: false, message: 'تم حظر هذا الحساب' });
    }

    res.status(200).json({ success: true, token: user.generateToken(), user: user.toAuthJSON() });
  } catch (error) {
    next(error);
  }
};

/**
 * Bootstrap endpoint: creates the FIRST admin account only.
 * Once an admin exists it is disabled (admins create users from the dashboard).
 */
export const register = async (req, res, next) => {
  try {
    const adminExists = await User.exists({ $or: [{ role: 'admin' }, { isAdmin: true }] });
    if (adminExists) {
      return res.status(403).json({ success: false, message: 'التسجيل غير متاح' });
    }

    const { name, password } = req.body;
    const email = normalizeEmail(req.body.email);
    if (!name || !email || !password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'الاسم، البريد، وكلمة المرور (6 أحرف على الأقل) مطلوبة' });
    }

    if (await User.exists({ email })) {
      return res.status(400).json({ success: false, message: 'المستخدم موجود مسبقاً' });
    }

    const user = await User.create({ name, email, password, isAdmin: true, role: 'admin' });
    res.status(201).json({ success: true, token: user.generateToken(), user: user.toAuthJSON() });
  } catch (error) {
    next(error);
  }
};

// Current user (any role)
export const getMe = async (req, res) => {
  res.status(200).json({ success: true, user: req.user.toAuthJSON() });
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'كلمة المرور الحالية والجديدة مطلوبة' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'كلمة المرور الحالية غير صحيحة' });
    }

    user.password = newPassword;
    // Revoke other sessions, keep this one by returning a fresh token
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.status(200).json({ success: true, message: 'تم تحديث كلمة المرور بنجاح', token: user.generateToken() });
  } catch (error) {
    next(error);
  }
};
