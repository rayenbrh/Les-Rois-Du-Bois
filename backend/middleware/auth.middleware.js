import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';

/**
 * Unified authentication layer.
 *
 * Sessions never expire on a timer: a token stays valid until the user logs
 * out (client side) or the user's password is changed/reset (tokenVersion bump).
 * Legacy tokens that were issued with an `exp` claim are still accepted so that
 * nobody is logged out by this change.
 */

export const POS_ROLES = ['admin', 'store_cashier', 'cashier', 'saler', 'store_manager', 'commercial'];
export const STAFF_ROLES = [...POS_ROLES, 'accountant', 'inventory_manager'];
export const CUSTOMER_ROLES = ['user', 'client'];

export const normalizeRole = (user) => {
  if (!user) return null;
  if (user.role === 'cashier') return 'store_cashier';
  return user.role || (user.isAdmin ? 'admin' : 'user');
};

export const hasRole = (user, roles) => {
  if (!user) return false;
  const role = normalizeRole(user);
  if (roles.includes(role)) return true;
  // Legacy: `isAdmin` flag grants admin access
  if (roles.includes('admin') && user.isAdmin) return true;
  // `cashier` alias
  if (roles.includes('cashier') && role === 'store_cashier') return true;
  return false;
};

const readToken = (req) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token && token !== 'null' && token !== 'undefined') return token;
  }
  return null;
};

/**
 * Resolve the user attached to the request token.
 * Returns { user } or { status, message }.
 */
export const resolveUser = async (req) => {
  const token = readToken(req);
  if (!token) {
    return { status: 401, message: 'غير مصرح بالوصول - يرجى تسجيل الدخول' };
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
  } catch {
    return { status: 401, message: 'رمز الدخول غير صالح' };
  }

  const user = await User.findById(decoded.id).select('-password');
  if (!user) {
    return { status: 401, message: 'المستخدم غير موجود' };
  }

  if ((decoded.v ?? 0) !== (user.tokenVersion ?? 0)) {
    return { status: 401, message: 'انتهت صلاحية الجلسة - يرجى تسجيل الدخول من جديد' };
  }

  if (CUSTOMER_ROLES.includes(user.role) && user.clientStatus === 'blocked') {
    return { status: 403, message: 'تم حظر هذا الحساب' };
  }

  return { user };
};

/**
 * Build a middleware that requires authentication and (optionally) one of `roles`.
 */
export const requireAuth = (roles = null, forbiddenMessage = 'ليس لديك صلاحية للوصول إلى هذا المورد') =>
  async (req, res, next) => {
    try {
      const result = await resolveUser(req);
      if (!result.user) {
        return res.status(result.status).json({ success: false, message: result.message });
      }
      if (roles && !hasRole(result.user, roles)) {
        return res.status(403).json({ success: false, message: forbiddenMessage });
      }
      req.user = result.user;
      next();
    } catch (error) {
      next(error);
    }
  };

/** Attaches req.user when a valid token is present, never rejects. */
export const optionalAuth = async (req, res, next) => {
  try {
    if (readToken(req)) {
      const result = await resolveUser(req);
      if (result.user) req.user = result.user;
    }
  } catch {
    // ignore - public route
  }
  next();
};

/** Any authenticated account (customers + staff). */
export const authenticate = requireAuth();

/** Admin only. */
export const protect = requireAuth(['admin']);

/** POS: admin, cashiers, store managers and commercials. */
export const protectPOS = requireAuth(POS_ROLES, 'ليس لديك صلاحية للوصول إلى نقطة البيع');
