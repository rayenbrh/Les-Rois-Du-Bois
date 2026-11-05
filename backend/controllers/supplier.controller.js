import Supplier from '../models/Supplier.model.js';

export const getSuppliers = async (req, res, next) => {
  try {
    const suppliers = await Supplier.find({ isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, data: suppliers });
  } catch (error) {
    next(error);
  }
};

export const getSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'المورد غير موجود' });
    }
    res.json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

export const createSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.create(req.body);
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'الكود مستخدم بالفعل' });
    }
    next(error);
  }
};

export const updateSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'المورد غير موجود' });
    }
    res.json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

export const deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'المورد غير موجود' });
    }
    supplier.isActive = false;
    await supplier.save();
    res.json({ success: true, message: 'تم حذف المورد بنجاح' });
  } catch (error) {
    next(error);
  }
};

