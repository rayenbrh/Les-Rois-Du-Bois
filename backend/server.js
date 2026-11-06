import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { securityHeaders } from './middleware/security.middleware.js';
import authRoutes from './routes/auth.routes.js';
import categoryRoutes from './routes/category.routes.js';
import productRoutes from './routes/product.routes.js';
import specialProductRoutes from './routes/specialProduct.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import orderRoutes from './routes/order.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import auditLogRoutes from './routes/auditLog.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import commercialAnalyticsRoutes from './routes/commercialAnalytics.routes.js';
import ordersProductsAnalyticsRoutes from './routes/ordersProductsAnalytics.routes.js';
import advancedCommercialAnalyticsRoutes from './routes/advancedCommercialAnalytics.routes.js';
import supplierRoutes from './routes/supplier.routes.js';
import purchaseOrderRoutes from './routes/purchaseOrder.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import expenseCategoryRoutes from './routes/expenseCategory.routes.js';
import returnRoutes from './routes/return.routes.js';
import crmRoutes from './routes/crm.routes.js';
import posRoutes from './routes/pos.routes.js';
import jobRoutes from './routes/job.routes.js';
import clientAuthRoutes from './routes/clientAuth.routes.js';
import clientRoutes from './routes/client.routes.js';
import clientOrderRoutes from './routes/clientOrder.routes.js';
import userRoutes from './routes/user.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import commercialRoutes from './routes/commercial.routes.js';
import homepageRoutes from './routes/homepage.routes.js';
import supplierInvoiceRoutes from './routes/supplierInvoice.routes.js';
import { closeBrowser } from './services/pdf/browser.js';

import './models/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware.js';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';
const DEBUG = process.env.DEBUG_LOGS === 'true';

// ---------------------------------------------------------------------------
// Environment validation - only truly required values stop the server
// ---------------------------------------------------------------------------
const mongoUriEnv = process.env.MONGO_URI || process.env.MONGODB_URI;
const missingVars = [];
if (!process.env.JWT_SECRET) missingVars.push('JWT_SECRET');
if (!mongoUriEnv) missingVars.push('MONGO_URI (or MONGODB_URI)');

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}
if (!process.env.FRONTEND_URL) {
  console.warn('⚠️  FRONTEND_URL is not set - browsers from other origins will be rejected by CORS');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Upload directories
// ---------------------------------------------------------------------------
const uploadsDir = path.join(__dirname, 'uploads');
['categories', 'products', 'special-products', 'settings', 'expenses', 'general'].forEach((subdir) => {
  fs.mkdirSync(path.join(uploadsDir, subdir), { recursive: true });
});

const app = express();
app.disable('x-powered-by');

// Running behind Easypanel / Traefik reverse proxy
app.set('trust proxy', 1);

app.use(securityHeaders);

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);
if (!isProd) allowedOrigins.push('http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173');

console.log('🌐 [CORS] Allowed origins:', allowedOrigins);

app.use((req, res, next) =>
  cors({
    origin: (origin, callback) => {
      // Non-browser clients (curl, health checks) send no Origin header;
      // same-origin requests (single-service mode) are always allowed
      const clean = origin && origin.replace(/\/+$/, '');
      let sameOrigin = false;
      try {
        sameOrigin = !!clean && new URL(clean).host === req.headers.host;
      } catch {
        sameOrigin = false;
      }
      if (!origin || sameOrigin || allowedOrigins.includes(clean)) return callback(null, true);
      console.warn('⚠️ [CORS] Rejected origin:', origin);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Cashier-Id'],
    exposedHeaders: ['Authorization', 'Content-Disposition'],
    maxAge: 86400,
    optionsSuccessStatus: 200,
  })(req, res, next)
);

app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compact request log (method, path, status, duration). Verbose details with DEBUG_LOGS=true
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path === '/api/health') return;
    const ms = Date.now() - start;
    if (res.statusCode >= 400 || DEBUG || ms > 2000) {
      console.log(`${res.statusCode >= 500 ? '❌' : res.statusCode >= 400 ? '⚠️ ' : '📥'} ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
    }
  });
  next();
});

// ---------------------------------------------------------------------------
// Static uploads
// ---------------------------------------------------------------------------
app.use(
  '/uploads',
  express.static(uploadsDir, {
    maxAge: '365d',
    immutable: true,
    fallthrough: true,
  }),
  (req, res) => res.status(404).json({ success: false, message: 'الملف غير موجود' })
);

// ---------------------------------------------------------------------------
// Health (always answers, even while the database reconnects)
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  res.status(200).json({
    status: 'OK',
    database: dbState === 1 ? 'connected' : 'connecting',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// While the database is not connected, answer API calls with a clean 503
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  res.set('Retry-After', '5');
  return res.status(503).json({ success: false, message: 'الخادم قيد التشغيل، يرجى المحاولة بعد لحظات' });
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/special-products', specialProductRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/analytics/commercials/advanced', advancedCommercialAnalyticsRoutes);
app.use('/api/analytics/commercials', commercialAnalyticsRoutes);
app.use('/api/analytics/orders-products', ordersProductsAnalyticsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/expense-categories', expenseCategoryRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/commercial', commercialRoutes);
app.use('/api/homepage', homepageRoutes);
app.use('/api/supplier-invoices', supplierInvoiceRoutes);

// Store (public + authenticated)
app.use('/api/client/auth', clientAuthRoutes);
app.use('/api/client/orders', clientOrderRoutes);
app.use('/api/client', clientRoutes);

app.get('/', (req, res, next) => {
  if (process.env.SERVE_FRONTEND_DIR) return next();
  res.json({ status: 'OK', message: 'Les Rois des Bois API Server', health: '/api/health' });
});

// ---------------------------------------------------------------------------
// Optional single-service mode: also serve the built web app (SERVE_FRONTEND_DIR)
// so one address serves everything (local testing, one-container deploys)
// ---------------------------------------------------------------------------
const frontendDir = process.env.SERVE_FRONTEND_DIR ? path.resolve(__dirname, process.env.SERVE_FRONTEND_DIR) : null;
if (frontendDir && fs.existsSync(path.join(frontendDir, 'index.html'))) {
  console.log('🖥️  Serving web app from', frontendDir);
  app.use('/assets', express.static(path.join(frontendDir, 'assets'), { maxAge: '365d', immutable: true }));
  app.use(express.static(frontendDir, { index: false, maxAge: 0 }));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
}

// 404 + errors
app.use(notFoundHandler);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Database connection with automatic retry (never crash-loop on a slow DB)
// ---------------------------------------------------------------------------
let mongoUri = mongoUriEnv;
const isMongoAtlas = mongoUri.includes('mongodb+srv://') || mongoUri.includes('mongodb.net');
if (!isMongoAtlas && !/[?&](ssl|tls)=/.test(mongoUri)) {
  mongoUri = `${mongoUri}${mongoUri.includes('?') ? '&' : '?'}ssl=false`;
}

mongoose.set('strictQuery', true);

const connectWithRetry = async (attempt = 1) => {
  try {
    console.log(`🔌 Connecting to MongoDB (attempt ${attempt})...`);
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 20,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    const delay = Math.min(30000, 2000 * attempt);
    console.error(`❌ MongoDB connection failed: ${error.message}. Retrying in ${delay / 1000}s`);
    setTimeout(() => connectWithRetry(attempt + 1), delay);
  }
};

mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected'));
mongoose.connection.on('error', (err) => console.error('❌ MongoDB error:', err.message));

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

connectWithRetry();

// ---------------------------------------------------------------------------
// Process safety
// ---------------------------------------------------------------------------
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
});

const shutdown = (signal) => {
  console.log(`🛑 ${signal} received - shutting down gracefully`);
  server.close(() => {
    closeBrowser()
      .then(() => mongoose.connection.close(false))
      .finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 10000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
