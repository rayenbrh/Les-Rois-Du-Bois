import express from 'express';
import {
  // Admin endpoints
  getHeroConfig,
  updateHeroConfig,
  getFeaturedProducts,
  updateFeaturedProducts,
  reorderFeaturedProducts,
  getTopSellers,
  updateTopSellers,
  reorderTopSellers,
  recalculateTopSellers,
  // Public endpoints
  getPublicHero,
  getPublicFeatured,
  getPublicTopSellers,
} from '../controllers/homepage.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

// Admin routes (protected)
router.get('/admin/hero', protect, getHeroConfig);
router.post('/admin/hero', protect, updateHeroConfig);
router.put('/admin/hero', protect, updateHeroConfig);

router.get('/admin/featured', protect, getFeaturedProducts);
router.post('/admin/featured/update', protect, updateFeaturedProducts);
router.post('/admin/featured/reorder', protect, reorderFeaturedProducts);

router.get('/admin/top-sellers', protect, getTopSellers);
router.post('/admin/top-sellers/update', protect, updateTopSellers);
router.post('/admin/top-sellers/reorder', protect, reorderTopSellers);
router.post('/admin/top-sellers/recalculate', protect, recalculateTopSellers);

// Public routes (no auth required)
router.get('/hero', getPublicHero);
router.get('/featured', optionalAuth, getPublicFeatured);
router.get('/top-sellers', optionalAuth, getPublicTopSellers);

export default router;

