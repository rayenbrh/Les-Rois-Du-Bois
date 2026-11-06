import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { protect } from '../middleware/auth.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = path.join(__dirname, '../uploads');
    let folderType = 'general';

    if (req.path.includes('/category')) {
      uploadPath = path.join(uploadPath, 'categories');
      folderType = 'categories';
    } else if (req.path.includes('/product')) {
      uploadPath = path.join(uploadPath, 'products');
      folderType = 'products';
    } else if (req.path.includes('/special-product')) {
      uploadPath = path.join(uploadPath, 'special-products');
      folderType = 'special-products';
    } else if (req.path.includes('/settings')) {
      uploadPath = path.join(uploadPath, 'settings');
      folderType = 'settings';
    } else if (req.path.includes('/supplier-delivery')) {
      uploadPath = path.join(uploadPath, 'supplier-deliveries');
      folderType = 'supplier-deliveries';
    } else if (req.path.includes('/expense') || req.path.includes('/receipt')) {
      uploadPath = path.join(uploadPath, 'expenses');
      folderType = 'expenses';
    } else {
      uploadPath = path.join(uploadPath, 'general');
    }

    console.log(`📁 [MULTER] Destination determined: ${folderType}`);
    console.log(`📁 [MULTER] Upload path: ${uploadPath}`);
    console.log(`📁 [MULTER] Request path: ${req.path}`);

    // Ensure the upload directory exists
    try {
      fs.mkdirSync(uploadPath, { recursive: true });
      console.log(`✅ [MULTER] Directory created/verified: ${uploadPath}`);
    } catch (error) {
      console.error(`❌ [MULTER] Error creating directory: ${error.message}`);
      return cb(error);
    }

    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
    console.log(`📁 [MULTER] Generated filename: ${filename}`);
    console.log(`📁 [MULTER] Original filename: ${file.originalname}`);
    cb(null, filename);
  }
});

// File filter for images
const imageFilter = (req, file, cb) => {
  console.log(`🔍 [FILTER] Checking file: ${file.originalname}`);
  console.log(`🔍 [FILTER] MIME type: ${file.mimetype}`);
  
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  console.log(`🔍 [FILTER] Extension check: ${extname}`);
  console.log(`🔍 [FILTER] MIME type check: ${mimetype}`);

  if (mimetype && extname) {
    console.log(`✅ [FILTER] File accepted: ${file.originalname}`);
    return cb(null, true);
  } else {
    console.error(`❌ [FILTER] File rejected: ${file.originalname} (ext: ${extname}, mime: ${mimetype})`);
    cb(new Error('يسمح فقط بملفات الصور (jpeg, jpg, png, gif, webp)'));
  }
};

// File filter for receipts (images + PDF)
const receiptFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'application/pdf';

  if (mimetype || extname) {
    return cb(null, true);
  } else {
    cb(new Error('يسمح فقط بملفات الصور أو PDF (jpeg, jpg, png, gif, webp, pdf)'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: imageFilter,
});

const uploadReceipt = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for receipts (can include PDFs)
  },
  fileFilter: receiptFilter,
});

const router = express.Router();

// Category image upload
router.post('/category', protect, upload.single('image'), (req, res) => {
  console.log('📤 [UPLOAD] Category image upload requested');
  console.log('📤 [UPLOAD] Request body:', req.body);
  console.log('📤 [UPLOAD] Request file:', req.file ? {
    filename: req.file.filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    path: req.file.path,
  } : 'No file');
  
  if (!req.file) {
    console.error('❌ [UPLOAD] No file received for category upload');
    return res.status(400).json({
      success: false,
      message: 'لم يتم رفع أي ملف',
    });
  }

  const responseData = {
    success: true,
    data: {
      filename: req.file.filename,
      path: `/uploads/categories/${req.file.filename}`,
      originalName: req.file.originalname,
    },
  };
  
  console.log('✅ [UPLOAD] Category image uploaded successfully:', responseData);
  res.status(200).json(responseData);
});

// Product image upload (single)
router.post('/product', protect, upload.single('image'), (req, res) => {
  console.log('📤 [UPLOAD] Single product image upload requested');
  console.log('📤 [UPLOAD] Request body:', req.body);
  console.log('📤 [UPLOAD] Request file:', req.file ? {
    filename: req.file.filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    path: req.file.path,
  } : 'No file');
  
  if (!req.file) {
    console.error('❌ [UPLOAD] No file received for single product upload');
    return res.status(400).json({
      success: false,
      message: 'لم يتم رفع أي ملف',
    });
  }

  const responseData = {
    success: true,
    data: {
      filename: req.file.filename,
      path: `/uploads/products/${req.file.filename}`,
      originalName: req.file.originalname,
    },
  };
  
  console.log('✅ [UPLOAD] Single product image uploaded successfully:', responseData);
  res.status(200).json(responseData);
});

// Product multiple images upload
router.post('/product/multiple', protect, upload.array('images', 10), (req, res) => {
  console.log('📤 [UPLOAD] Multiple product images upload requested');
  console.log('📤 [UPLOAD] Files count:', req.files ? req.files.length : 0);
  console.log('📤 [UPLOAD] Request headers:', {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length'],
  });
  
  if (!req.files || req.files.length === 0) {
    console.error('❌ [UPLOAD] No files received for multiple product upload');
    console.error('❌ [UPLOAD] Request files:', req.files);
    return res.status(400).json({
      success: false,
      message: 'لم يتم رفع أي ملفات',
    });
  }

  console.log('📤 [UPLOAD] Processing', req.files.length, 'files...');
  const files = req.files.map((file, index) => {
    const fileData = {
      filename: file.filename,
      path: `/uploads/products/${file.filename}`,
      originalName: file.originalname,
    };
    console.log(`📤 [UPLOAD] File ${index + 1}/${req.files.length}:`, {
      ...fileData,
      size: file.size,
      mimetype: file.mimetype,
      savedPath: file.path,
    });
    return fileData;
  });

  const responseData = {
    success: true,
    data: files,
  };
  
  console.log('✅ [UPLOAD] Multiple product images uploaded successfully');
  console.log('✅ [UPLOAD] Response:', {
    success: responseData.success,
    filesCount: responseData.data.length,
    paths: responseData.data.map(f => f.path),
  });
  
  res.status(200).json(responseData);
});

// Special product combination image upload
router.post('/special-product', protect, upload.single('image'), (req, res) => {
  console.log('📤 [UPLOAD] Special product image upload requested');
  console.log('📤 [UPLOAD] Request file:', req.file ? {
    filename: req.file.filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    path: req.file.path,
  } : 'No file');
  
  if (!req.file) {
    console.error('❌ [UPLOAD] No file received for special product upload');
    return res.status(400).json({
      success: false,
      message: 'لم يتم رفع أي ملف',
    });
  }

  const responseData = {
    success: true,
    data: {
      filename: req.file.filename,
      path: `/uploads/special-products/${req.file.filename}`,
      originalName: req.file.originalname,
    },
  };
  
  console.log('✅ [UPLOAD] Special product image uploaded successfully:', responseData);
  res.status(200).json(responseData);
});

// Settings logo upload
router.post('/settings/logo', protect, upload.single('image'), (req, res) => {
  console.log('📤 [UPLOAD] Settings logo upload requested');
  console.log('📤 [UPLOAD] Request file:', req.file ? {
    filename: req.file.filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    path: req.file.path,
  } : 'No file');
  
  if (!req.file) {
    console.error('❌ [UPLOAD] No file received for settings logo upload');
    return res.status(400).json({
      success: false,
      message: 'لم يتم رفع أي ملف',
    });
  }

  const responseData = {
    success: true,
    data: {
      filename: req.file.filename,
      path: `/uploads/settings/${req.file.filename}`,
      originalName: req.file.originalname,
    },
  };
  
  console.log('✅ [UPLOAD] Settings logo uploaded successfully:', responseData);
  res.status(200).json(responseData);
});

// Expense receipt upload (supports images and PDFs)
router.post('/expense/receipt', protect, uploadReceipt.single('receipt'), (req, res) => {
  console.log('📤 [UPLOAD] Expense receipt upload requested');
  console.log('📤 [UPLOAD] Request file:', req.file ? {
    filename: req.file.filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    path: req.file.path,
  } : 'No file');
  
  if (!req.file) {
    console.error('❌ [UPLOAD] No file received for expense receipt upload');
    return res.status(400).json({
      success: false,
      message: 'لم يتم رفع أي ملف',
    });
  }

  const responseData = {
    success: true,
    data: {
      filename: req.file.filename,
      path: `/uploads/expenses/${req.file.filename}`,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
    },
  };
  
  console.log('✅ [UPLOAD] Expense receipt uploaded successfully:', responseData);
  res.status(200).json(responseData);
});

// Supplier delivery receipt photo (images and PDFs), saved under /uploads/supplier-deliveries
router.post('/supplier-delivery/receipt', protect, uploadReceipt.single('receipt'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'لم يتم رفع أي ملف' });
  }
  res.status(200).json({
    success: true,
    data: {
      filename: req.file.filename,
      path: `/uploads/supplier-deliveries/${req.file.filename}`,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
    },
  });
});

export default router;

