import Product from '../models/Product.model.js';
import { calculateTotalStock } from '../utils/inventoryHelper.js';

export const getProducts = async (req, res, next) => {
  try {
    const { search, category, status } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    const products = await Product.find(query)
      .populate('category', 'name slug')
      .populate('supplierId', 'name code')
      .sort({ createdAt: -1 });

    // Calculate total stock for products with variants
    const productsWithCalculatedStock = products.map(product => {
      const productObj = product.toObject ? product.toObject() : product;
      const totalStock = calculateTotalStock(productObj);
      return {
        ...productObj,
        stock: totalStock, // Replace stock with calculated total stock
      };
    });

    res.status(200).json({
      success: true,
      count: productsWithCalculatedStock.length,
      data: productsWithCalculatedStock,
    });
  } catch (error) {
    next(error);
  }
};

export const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name slug')
      .populate('supplierId', 'name code');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'المنتج غير موجود',
      });
    }

    // Calculate total stock for products with variants
    const productObj = product.toObject ? product.toObject() : product;
    const totalStock = calculateTotalStock(productObj);
    const productWithCalculatedStock = {
      ...productObj,
      stock: totalStock, // Replace stock with calculated total stock
    };

    res.status(200).json({
      success: true,
      data: productWithCalculatedStock,
    });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      category,
      supplierId,
      price,
      cost,
      stock,
      unit,
      wholesalePrice,
      wholesaleUnit,
      facebookPrice,
      images,
      description,
      status,
      variantName,
      variants,
    } = req.body;

    // If product has variants, stock is optional (variants have their own stock)
    const hasVariants = Array.isArray(variants) && variants.length > 0;
    const stockValue = hasVariants ? (stock !== undefined ? Number(stock) : 0) : Number(stock);

    if (!name || !category || !price || (!hasVariants && stock === undefined)) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال جميع الحقول المطلوبة',
      });
    }

    const product = await Product.create({
      name,
      category,
      supplierId: supplierId || undefined,
      price: Number(price),
      cost: cost ? Number(cost) : 0,
      stock: stockValue,
      unit: 'piece', // Always piece
      wholesalePrice: wholesalePrice ? Number(wholesalePrice) : 0,
      wholesaleUnit: 'piece', // Always piece
      facebookPrice: facebookPrice ? Number(facebookPrice) : 0,
      images: Array.isArray(images) ? images : [],
      description: description || '',
      status: status || 'visible',
      variantName: variantName || '',
      variants: Array.isArray(variants) ? variants : [],
    });

    const populatedProduct = await Product.findById(product._id)
      .populate('category', 'name slug')
      .populate('supplierId', 'name code');

    res.status(201).json({
      success: true,
      data: populatedProduct,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'اسم المنتج مستخدم بالفعل',
      });
    }
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'المنتج غير موجود',
      });
    }

    const {
      name,
      category,
      supplierId,
      price,
      cost,
      stock,
      unit,
      wholesalePrice,
      wholesaleUnit,
      facebookPrice,
      images,
      description,
      status,
      variantName,
      variants,
    } = req.body;

    // Check if product has variants
    const hasVariants = Array.isArray(variants) && variants.length > 0;
    
    if (name) product.name = name;
    if (category) product.category = category;
    if (supplierId !== undefined) product.supplierId = supplierId || null;
    if (price !== undefined) product.price = Number(price);
    if (cost !== undefined) product.cost = Number(cost);
    // If product has variants, stock is optional (variants have their own stock)
    if (stock !== undefined) {
      product.stock = hasVariants ? (Number(stock) || 0) : Number(stock);
    }
    product.unit = 'piece'; // Always piece
    if (wholesalePrice !== undefined) product.wholesalePrice = Number(wholesalePrice);
    product.wholesaleUnit = 'piece'; // Always piece
    if (facebookPrice !== undefined) product.facebookPrice = Number(facebookPrice);
    if (images !== undefined) product.images = Array.isArray(images) ? images : [];
    if (description !== undefined) product.description = description;
    if (status) product.status = status;
    if (variantName !== undefined) product.variantName = variantName;
    if (variants !== undefined) product.variants = Array.isArray(variants) ? variants : [];

    await product.save();

    const populatedProduct = await Product.findById(product._id)
      .populate('category', 'name slug')
      .populate('supplierId', 'name code');

    res.status(200).json({
      success: true,
      data: populatedProduct,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'اسم المنتج مستخدم بالفعل',
      });
    }
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'المنتج غير موجود',
      });
    }

    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: 'تم حذف المنتج بنجاح',
    });
  } catch (error) {
    next(error);
  }
};

