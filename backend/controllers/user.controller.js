import User from '../models/User.model.js';

export const createUser = async (req, res, next) => {
  try {
    const { name, phone, password, role, isAdmin, commercialId } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : req.body.email;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'الاسم، البريد الإلكتروني، وكلمة المرور مطلوبة',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
      });
    }

    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني مستخدم بالفعل',
      });
    }

    // Verify commercial if provided
    if (role === 'client' && commercialId) {
      const commercial = await User.findById(commercialId);
      if (!commercial || commercial.role !== 'commercial') {
        return res.status(400).json({
          success: false,
          message: 'التجاري المحدد غير صحيح',
        });
      }
    }

    const userData = {
      name,
      email,
      phone,
      password,
      role: role || 'user',
      isAdmin: isAdmin || false,
    };

    if (role === 'client' && commercialId) {
      userData.commercialId = commercialId;
    }

    const user = await User.create(userData);

    const createdUser = await User.findById(user._id).populate('commercialId', 'name email').select('-password');
    res.status(201).json({
      success: true,
      data: createdUser,
    });
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const { role, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;
    const query = {};

    if (role) query.role = role;
    if (search && typeof search === 'string') {
      const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }

    const [users, total] = await Promise.all([
      User.find(query).select('-password').populate('commercialId', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password').populate('commercialId', 'name email');
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { name, phone, role, isAdmin, commercialId, password } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : req.body.email;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'البريد الإلكتروني مستخدم بالفعل' });
      }
      user.email = email;
    }

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (role) {
      user.role = role;
      // If role is not client, remove commercialId
      if (role !== 'client') {
        user.commercialId = undefined;
      }
    }
    if (isAdmin !== undefined) user.isAdmin = isAdmin;

    // Optional password change from the admin "edit user" form
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
      }
      user.password = password;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }
    
    // Handle commercialId
    if (role === 'client' && commercialId) {
      // Verify the commercial exists and has the right role
      const commercial = await User.findById(commercialId);
      if (!commercial || commercial.role !== 'commercial') {
        return res.status(400).json({ success: false, message: 'التجاري المحدد غير صحيح' });
      }
      user.commercialId = commercialId;
    } else if (role === 'client' && commercialId === '') {
      user.commercialId = undefined;
    }

    await user.save();

    const updatedUser = await User.findById(user._id).populate('commercialId', 'name email').select('-password');
    res.json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    if (user.isAdmin && user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'لا يمكنك حذف حسابك الخاص' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'تم حذف المستخدم بنجاح' });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    user.password = newPassword;
    // Existing sessions of this user are revoked
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.json({ success: true, message: 'تم تحديث كلمة المرور بنجاح' });
  } catch (error) {
    next(error);
  }
};

