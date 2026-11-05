import { requireAuth } from './auth.middleware.js';

const requireCommercial = requireAuth(['admin', 'commercial'], 'ليس لديك صلاحية للوصول إلى هذه الصفحة');

// Middleware for Commercial routes - allows admin and commercial roles
export const protectCommercial = (req, res, next) =>
  requireCommercial(req, res, (err) => {
    if (err) return next(err);
    // Commercials only see their own data; admins default to their id (can be overridden by query)
    req.commercialId = req.user._id;
    next();
  });

// Helper middleware to ensure commercial can only access their own clients
export const filterByCommercial = (req, res, next) => {
  if (req.user.role === 'commercial' && !req.user.isAdmin) {
    req.query.commercialId = req.commercialId.toString();
  }
  next();
};
