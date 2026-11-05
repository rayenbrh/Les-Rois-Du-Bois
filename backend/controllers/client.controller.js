import mongoose from 'mongoose';
import Product from '../models/Product.model.js';
import Category from '../models/Category.model.js';
import SpecialProduct from '../models/SpecialProduct.model.js';
import Order from '../models/Order.model.js';
import {
  getPriceTier,
  shapeProductForClient,
  shapeProductsForClient,
  shapeSpecialProductForClient,
} from '../utils/pricing.js';

/**
 * Public store API.
 * Every endpoint works for guests; when a valid token is sent (optionalAuth)
 * prices are shown for the viewer's tier (détail / gros).
 */

const toInt = (value, fallback, max = 100) => {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
};

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const notFound = (res, message) => res.status(404).json({ success: false, message });

// Prices vary per viewer - never let shared caches store them
const noSharedCache = (res) => {
  res.set('Cache-Control', 'private, no-store');
  res.set('Vary', 'Authorization');
};

// Effective price expression for the viewer's tier (used for filtering and sorting)
const effectivePriceExpr = (tier) =>
  tier === 'gros'
    ? { $cond: [{ $gt: [{ $ifNull: ['$wholesalePrice', 0] }, 0] }, '$wholesalePrice', '$price'] }
    : '$price';

// Get all public products (visible only)
export const getPublicProducts = async (req, res, next) => {
  try {
    const { category, search, minPrice, maxPrice, sort = 'newest' } = req.query;
    const page = toInt(req.query.page, 1, 10000);
    const limit = toInt(req.query.limit, 20);
    const skip = (page - 1) * limit;
    const tier = getPriceTier(req.user);

    const match = { status: 'visible' };
    if (category && mongoose.isValidObjectId(category)) {
      match.category = new mongoose.Types.ObjectId(category);
    }
    if (search && typeof search === 'string' && search.trim()) {
      const rx = new RegExp(escapeRegex(search.trim().slice(0, 100)), 'i');
      match.$or = [{ name: rx }, { description: rx }];
    }

    const priceMatch = {};
    if (minPrice !== undefined && minPrice !== '' && Number.isFinite(Number(minPrice))) priceMatch.$gte = Number(minPrice);
    if (maxPrice !== undefined && maxPrice !== '' && Number.isFinite(Number(maxPrice))) priceMatch.$lte = Number(maxPrice);

    let sortOption = { createdAt: -1, _id: -1 };
    if (sort === 'price-low') sortOption = { effectivePrice: 1, _id: 1 };
    if (sort === 'price-high') sortOption = { effectivePrice: -1, _id: -1 };
    if (sort === 'name') sortOption = { name: 1, _id: 1 };
    if (sort === 'oldest') sortOption = { createdAt: 1, _id: 1 };

    const pipeline = [
      { $match: match },
      { $addFields: { effectivePrice: effectivePriceExpr(tier) } },
      ...(Object.keys(priceMatch).length ? [{ $match: { effectivePrice: priceMatch } }] : []),
      {
        $facet: {
          items: [{ $sort: sortOption }, { $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await Product.aggregate(pipeline);
    const items = await Product.populate(result?.items || [], { path: 'category', select: 'name slug' });
    const total = result?.total?.[0]?.count || 0;

    noSharedCache(res);
    res.status(200).json({
      success: true,
      data: shapeProductsForClient(items, tier).map(({ effectivePrice, ...p }) => p),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// Get single public product
export const getPublicProduct = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res, 'المنتج غير موجود');

    const product = await Product.findById(req.params.id).populate('category', 'name slug').lean();
    if (!product || product.status !== 'visible') return notFound(res, 'المنتج غير موجود');

    noSharedCache(res);
    res.status(200).json({ success: true, data: shapeProductForClient(product, getPriceTier(req.user)) });
  } catch (error) {
    next(error);
  }
};

// Get all public categories (with number of visible products)
export const getPublicCategories = async (req, res, next) => {
  try {
    const [categories, counts] = await Promise.all([
      Category.find().sort({ name: 1 }).lean(),
      Product.aggregate([{ $match: { status: 'visible' } }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

    res.status(200).json({
      success: true,
      data: categories.map((c) => ({ ...c, productsCount: countMap.get(String(c._id)) || 0 })),
    });
  } catch (error) {
    next(error);
  }
};

// Get single public category with products
export const getPublicCategory = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res, 'الفئة غير موجودة');

    const category = await Category.findById(req.params.id).lean();
    if (!category) return notFound(res, 'الفئة غير موجودة');

    const products = await Product.find({ category: category._id, status: 'visible' })
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .lean();

    noSharedCache(res);
    res.status(200).json({
      success: true,
      data: { category, products: shapeProductsForClient(products, getPriceTier(req.user)) },
    });
  } catch (error) {
    next(error);
  }
};

// ---------- Special (composed) products ----------

const matchVariant = (variants, ref) => {
  if (!ref || !variants?.length) return null;
  const value = ref.value || ref._id?.toString();
  return (
    variants.find(
      (v) => v.value === value || v._id?.toString() === value || (ref._id && v._id?.toString() === ref._id.toString())
    ) || null
  );
};

// Stock of one side of a combination
const optionStock = (baseProduct, option) => {
  if (!baseProduct) return 0;
  if (option?.variant) {
    const variant = matchVariant(baseProduct.variants, option.variant);
    return variant?.stock ?? 0;
  }
  if (!baseProduct.variants || baseProduct.variants.length === 0) return baseProduct.stock ?? 0;
  return 0;
};

// Stock of a combination = minimum stock of both sides
const combinationStock = (productData, combo) =>
  Math.min(optionStock(productData.baseProductA, combo.optionA), optionStock(productData.baseProductB, combo.optionB));

const BASE_FIELDS = 'name images variants stock';

// Get all public special products
export const getPublicSpecialProducts = async (req, res, next) => {
  try {
    const specialProducts = await SpecialProduct.find({ status: 'visible' })
      .populate('baseProductA', BASE_FIELDS)
      .populate('baseProductB', BASE_FIELDS)
      .sort({ createdAt: -1 })
      .lean();

    const data = specialProducts
      .filter((p) => p.baseProductA && p.baseProductB)
      .map((productData) => {
        let totalAvailableStock = 0;
        let hasAvailableCombination = false;
        (productData.combinations || []).forEach((combo) => {
          const stock = combinationStock(productData, combo);
          totalAvailableStock += stock;
          if (stock > 0) hasAvailableCombination = true;
        });
        return {
          ...shapeSpecialProductForClient(productData),
          isAvailable: hasAvailableCombination,
          totalAvailableStock,
        };
      });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// Get single public special product with full details
export const getPublicSpecialProduct = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res, 'المنتج الخاص غير موجود');

    const productData = await SpecialProduct.findById(req.params.id)
      .populate('baseProductA', BASE_FIELDS)
      .populate('baseProductB', BASE_FIELDS)
      .lean();

    if (!productData || productData.status !== 'visible' || !productData.baseProductA || !productData.baseProductB) {
      return notFound(res, 'المنتج الخاص غير موجود');
    }

    productData.combinations = (productData.combinations || []).map((combo) => {
      const stock = combinationStock(productData, combo);
      return { ...combo, stock, isAvailable: stock > 0 };
    });

    res.status(200).json({ success: true, data: shapeSpecialProductForClient(productData) });
  } catch (error) {
    next(error);
  }
};

// Get top selling products for client (public)
export const getTopSellingProducts = async (req, res, next) => {
  try {
    const limit = toInt(req.query.limit, 10, 50);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const topProducts = await Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, status: { $ne: 'canceled' } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productId', totalQuantity: { $sum: '$items.quantity' } } },
      { $sort: { totalQuantity: -1 } },
      { $limit: limit * 2 },
    ]);

    const products = await Product.find({ _id: { $in: topProducts.map((p) => p._id) }, status: 'visible' })
      .populate('category', 'name slug')
      .lean();

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
    const sorted = topProducts
      .map((tp) => productMap.get(String(tp._id)))
      .filter(Boolean)
      .slice(0, limit);

    noSharedCache(res);
    res.status(200).json({ success: true, data: shapeProductsForClient(sorted, getPriceTier(req.user)) });
  } catch (error) {
    next(error);
  }
};

// Get new products (recently added)
export const getNewProducts = async (req, res, next) => {
  try {
    const limit = toInt(req.query.limit, 10, 50);
    const products = await Product.find({ status: 'visible' })
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    noSharedCache(res);
    res.status(200).json({ success: true, data: shapeProductsForClient(products, getPriceTier(req.user)) });
  } catch (error) {
    next(error);
  }
};
