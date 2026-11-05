import { getPriceTier, shapeProductsForClient } from '../utils/pricing.js';
import HomepageConfig from '../models/HomepageConfig.model.js';
import FeaturedProduct from '../models/FeaturedProduct.model.js';
import TopSellerProduct from '../models/TopSellerProduct.model.js';
import Product from '../models/Product.model.js';
import Order from '../models/Order.model.js';

// ==================== HERO CONFIG ====================

export const getHeroConfig = async (req, res, next) => {
  try {
    const config = await HomepageConfig.getConfig();
    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    next(error);
  }
};

export const updateHeroConfig = async (req, res, next) => {
  try {
    const {
      hero_image,
      hero_title,
      hero_subtitle,
      hero_description,
      hero_cta_text,
      hero_cta_link,
      hero_cta2_text,
      hero_cta2_link,
    } = req.body;

    let config = await HomepageConfig.findOne();
    if (!config) {
      config = await HomepageConfig.create({
        hero_image: hero_image || '',
        hero_title: hero_title || 'ملوك الخشب',
        hero_subtitle: hero_subtitle || 'أثاث فاخر بتصاميم عصرية وجودة عالية',
        hero_description: hero_description || '',
        hero_cta_text: hero_cta_text || 'تسوق الآن',
        hero_cta_link: hero_cta_link || '/shop/products',
        hero_cta2_text: hero_cta2_text || 'المنتجات المركبة',
        hero_cta2_link: hero_cta2_link || '/shop/special-products',
      });
    } else {
      if (hero_image !== undefined) config.hero_image = hero_image;
      if (hero_title !== undefined) config.hero_title = hero_title;
      if (hero_subtitle !== undefined) config.hero_subtitle = hero_subtitle;
      if (hero_description !== undefined) config.hero_description = hero_description;
      if (hero_cta_text !== undefined) config.hero_cta_text = hero_cta_text;
      if (hero_cta_link !== undefined) config.hero_cta_link = hero_cta_link;
      if (hero_cta2_text !== undefined) config.hero_cta2_text = hero_cta2_text;
      if (hero_cta2_link !== undefined) config.hero_cta2_link = hero_cta2_link;

      await config.save();
    }

    res.status(200).json({
      success: true,
      message: 'تم تحديث إعدادات البانر بنجاح',
      data: config,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== FEATURED PRODUCTS ====================

export const getFeaturedProducts = async (req, res, next) => {
  try {
    const featured = await FeaturedProduct.find()
      .populate('product_id')
      .sort({ sort_order: 1 });

    // Get all products for selection
    const allProducts = await Product.find({ status: 'visible' })
      .select('name images price stock')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        featured: featured.map((f) => ({
          id: f._id,
          product_id: f.product_id,
          sort_order: f.sort_order,
        })),
        allProducts,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateFeaturedProducts = async (req, res, next) => {
  try {
    const { product_ids } = req.body; // Array of product IDs

    if (!Array.isArray(product_ids)) {
      return res.status(400).json({
        success: false,
        message: 'يجب إرسال مصفوفة من معرفات المنتجات',
      });
    }

    // Remove all existing featured products
    await FeaturedProduct.deleteMany({});

    // Add new featured products
    const featuredProducts = product_ids.map((productId, index) => ({
      product_id: productId,
      sort_order: index,
    }));

    await FeaturedProduct.insertMany(featuredProducts);

    const updated = await FeaturedProduct.find()
      .populate('product_id')
      .sort({ sort_order: 1 });

    res.status(200).json({
      success: true,
      message: 'تم تحديث المنتجات المميزة بنجاح',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const reorderFeaturedProducts = async (req, res, next) => {
  try {
    const { items } = req.body; // Array of { id, sort_order }

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'يجب إرسال مصفوفة من العناصر',
      });
    }

    const updatePromises = items.map((item) =>
      FeaturedProduct.findByIdAndUpdate(item.id, { sort_order: item.sort_order })
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: 'تم تحديث الترتيب بنجاح',
    });
  } catch (error) {
    next(error);
  }
};

// ==================== TOP SELLERS ====================

export const getTopSellers = async (req, res, next) => {
  try {
    const topSellers = await TopSellerProduct.find()
      .populate('product_id')
      .sort({ sort_order: 1 });

    // Get all products for selection
    const allProducts = await Product.find({ status: 'visible' })
      .select('name images price stock')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        topSellers: topSellers.map((t) => ({
          id: t._id,
          product_id: t.product_id,
          sort_order: t.sort_order,
          is_manual: t.is_manual,
        })),
        allProducts,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateTopSellers = async (req, res, next) => {
  try {
    const { product_ids } = req.body; // Array of product IDs

    if (!Array.isArray(product_ids)) {
      return res.status(400).json({
        success: false,
        message: 'يجب إرسال مصفوفة من معرفات المنتجات',
      });
    }

    // Remove all existing manual top sellers (keep auto-calculated ones)
    await TopSellerProduct.deleteMany({ is_manual: true });

    // Add new top sellers
    const topSellerProducts = product_ids.map((productId, index) => ({
      product_id: productId,
      sort_order: index,
      is_manual: true,
    }));

    await TopSellerProduct.insertMany(topSellerProducts);

    const updated = await TopSellerProduct.find()
      .populate('product_id')
      .sort({ sort_order: 1 });

    res.status(200).json({
      success: true,
      message: 'تم تحديث الأكثر مبيعاً بنجاح',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const reorderTopSellers = async (req, res, next) => {
  try {
    const { items } = req.body; // Array of { id, sort_order }

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'يجب إرسال مصفوفة من العناصر',
      });
    }

    const updatePromises = items.map((item) =>
      TopSellerProduct.findByIdAndUpdate(item.id, { sort_order: item.sort_order })
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: 'تم تحديث الترتيب بنجاح',
    });
  } catch (error) {
    next(error);
  }
};

export const recalculateTopSellers = async (req, res, next) => {
  try {
    const { limit = 10 } = req.body;

    // Get orders from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Aggregate sales by product
    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          status: { $ne: 'cancelled' },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          totalQuantity: { $sum: '$items.quantity' },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: parseInt(limit) },
    ]);

    // Remove all auto-calculated top sellers
    await TopSellerProduct.deleteMany({ is_manual: false });

    // Add new auto-calculated top sellers
    const topSellerProducts = salesData.map((sale, index) => ({
      product_id: sale._id,
      sort_order: index,
      is_manual: false,
    }));

    await TopSellerProduct.insertMany(topSellerProducts);

    const updated = await TopSellerProduct.find()
      .populate('product_id')
      .sort({ sort_order: 1 });

    res.status(200).json({
      success: true,
      message: 'تم إعادة حساب الأكثر مبيعاً بنجاح',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== PUBLIC ENDPOINTS ====================

export const getPublicHero = async (req, res, next) => {
  try {
    const config = await HomepageConfig.getConfig();
    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicFeatured = async (req, res, next) => {
  try {
    const { limit = 12 } = req.query;
    const featured = await FeaturedProduct.find()
      .populate({
        path: 'product_id',
        match: { status: 'visible' },
      })
      .sort({ sort_order: 1 })
      .limit(parseInt(limit));

    const products = featured.map((f) => f.product_id).filter(Boolean);

    res.set('Cache-Control', 'private, no-store');
    res.status(200).json({
      success: true,
      data: shapeProductsForClient(products, getPriceTier(req.user)),
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicTopSellers = async (req, res, next) => {
  try {
    const { limit = 12 } = req.query;
    const topSellers = await TopSellerProduct.find()
      .populate({
        path: 'product_id',
        match: { status: 'visible' },
      })
      .sort({ sort_order: 1 })
      .limit(parseInt(limit));

    const products = topSellers.map((t) => t.product_id).filter(Boolean);

    res.set('Cache-Control', 'private, no-store');
    res.status(200).json({
      success: true,
      data: shapeProductsForClient(products, getPriceTier(req.user)),
    });
  } catch (error) {
    next(error);
  }
};

