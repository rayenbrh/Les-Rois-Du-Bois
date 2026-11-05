/**
 * Central error handling - always answers with JSON, never leaks internals in production.
 */

export const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, message: 'المسار غير موجود', path: req.originalUrl });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return;

  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'خطأ في الخادم';

  // Invalid MongoDB ObjectId in URL / body
  if (err.name === 'CastError') {
    statusCode = 404;
    message = 'العنصر غير موجود';
  }

  // Mongoose validation errors -> 400 with the first readable message
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const first = Object.values(err.errors || {})[0];
    message = first?.message || 'بيانات غير صالحة';
  }

  // Duplicate key
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0];
    message = field === 'email' ? 'البريد الإلكتروني مستخدم بالفعل' : 'هذه القيمة مستخدمة بالفعل';
  }

  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'بيانات الطلب غير صالحة';
  }

  // Payload too large
  if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'حجم البيانات كبير جداً';
  }

  // Multer upload errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'حجم الملف كبير جداً' : 'خطأ في رفع الملف';
  }

  if (statusCode >= 500) {
    console.error(`❌ [ERROR] ${req.method} ${req.originalUrl}:`, err.stack || err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
