import Category from '../models/Category.model.js';
import Product from '../models/Product.model.js';

export const getCategories = async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const categories = await Category.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

export const getCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'الفئة غير موجودة',
      });
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { name, description, image } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'اسم الفئة مطلوب',
      });
    }

    const category = await Category.create({
      name,
      description: description || '',
      image: image || '',
    });

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'اسم الفئة مستخدم بالفعل',
      });
    }
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { name, description, image } = req.body;

    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'الفئة غير موجودة',
      });
    }

    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    if (image !== undefined) category.image = image;

    await category.save();

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'اسم الفئة مستخدم بالفعل',
      });
    }
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'الفئة غير موجودة',
      });
    }

    // Check if products depend on this category
    const productsCount = await Product.countDocuments({ category: category._id });

    if (productsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `لا يمكن حذف هذه الفئة لأنها مرتبطة بـ ${productsCount} منتج`,
      });
    }

    await category.deleteOne();

    res.status(200).json({
      success: true,
      message: 'تم حذف الفئة بنجاح',
    });
  } catch (error) {
    next(error);
  }
};

