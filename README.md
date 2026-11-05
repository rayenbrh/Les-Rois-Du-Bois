# Les Rois Du Bois - Admin Dashboard

نظام إدارة متكامل لشركة Les Rois Du Bois - متخصصة في الأثاث الفاخر والنجارة.

## 🚀 المميزات

### الجزء الأول (Part 1) - المكتمل

- ✅ **لوحة تحكم إدارية** مع إحصائيات ورسوم بيانية
- ✅ **نظام تسجيل الدخول** للمدراء مع JWT
- ✅ **إدارة الفئات** (CRUD كامل + رفع الصور)
- ✅ **إدارة المنتجات العادية** (CRUD + رفع صور متعددة + متغيرات)
- ✅ **إدارة المنتجات الخاصة** مع نظام توليد التركيبات التلقائي
- ✅ **وضع فاتح/داكن** مع دعم RTL للغة العربية
- ✅ **تصميم متجاوب** لجميع الأجهزة

### الميزات الخاصة بالمنتجات الخاصة

المنتجات الخاصة هي منتجات مكونة من منتجين عاديين. النظام يقوم تلقائياً بـ:

1. توليد جميع التركيبات الممكنة من متغيرات المنتجين
2. السماح برفع صورة لكل تركيبة
3. حفظ كل تركيبة كمنتج مستقل

**مثال:**
- منتج 1: سطح الطاولة (متغيرات: أحمر، أخضر، أزرق)
- منتج 2: أرجل الطاولة (متغيرات: معدني، خشبي)
- النتيجة: 6 تركيبات (3 × 2) مع صورة لكل تركيبة

## 🛠 التقنيات المستخدمة

### Backend
- Node.js + Express
- MongoDB + Mongoose
- JWT Authentication
- Multer (رفع الملفات)
- bcryptjs (تشفير كلمات المرور)

### Frontend
- React 18
- Vite
- TailwindCSS
- React Router
- Axios
- Recharts (الرسوم البيانية)
- React Hot Toast (الإشعارات)
- Lucide React (الأيقونات)

## 📦 التثبيت

### المتطلبات
- Node.js 18+
- MongoDB

### خطوات التثبيت

1. **تثبيت جميع الحزم:**
```bash
npm run install-all
```

2. **إعداد ملف البيئة للـ Backend:**
```bash
cd backend
cp .env.example .env
```

قم بتعديل ملف `.env` وإضافة:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/les-rois-des-bois
JWT_SECRET=your-super-secret-jwt-key-change-in-production
NODE_ENV=development
```

3. **تشغيل المشروع:**
```bash
npm run dev
```

سيتم تشغيل:
- Backend على: http://localhost:5000
- Frontend على: http://localhost:3000

## 📁 هيكل المشروع

```
les-rois-des-bois-2/
├── backend/
│   ├── controllers/      # منطق العمل
│   ├── models/          # نماذج MongoDB
│   ├── routes/          # مسارات API
│   ├── middleware/      # Middleware (Auth, Error Handler)
│   ├── uploads/         # الملفات المرفوعة
│   └── server.js        # نقطة البداية
│
├── frontend/
│   ├── src/
│   │   ├── components/  # المكونات القابلة لإعادة الاستخدام
│   │   ├── contexts/    # Context API (Auth, Theme)
│   │   ├── pages/       # صفحات التطبيق
│   │   ├── utils/       # Utilities (Axios config)
│   │   └── App.jsx      # المكون الرئيسي
│   └── package.json
│
└── package.json         # Root package.json
```

## 🔐 إنشاء حساب مدير

يمكنك إنشاء حساب مدير من خلال API:

```bash
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "name": "Admin",
  "email": "admin@example.com",
  "password": "password123"
}
```

أو يمكنك إنشاء حساب مباشرة من MongoDB.

## 📝 API Endpoints

### Authentication
- `POST /api/auth/login` - تسجيل الدخول
- `POST /api/auth/register` - إنشاء حساب (للتطوير فقط)
- `GET /api/auth/me` - معلومات المستخدم الحالي

### Categories
- `GET /api/categories` - جلب جميع الفئات
- `GET /api/categories/:id` - جلب فئة واحدة
- `POST /api/categories` - إنشاء فئة (محمي)
- `PUT /api/categories/:id` - تحديث فئة (محمي)
- `DELETE /api/categories/:id` - حذف فئة (محمي)

### Products
- `GET /api/products` - جلب جميع المنتجات
- `GET /api/products/:id` - جلب منتج واحد
- `POST /api/products` - إنشاء منتج (محمي)
- `PUT /api/products/:id` - تحديث منتج (محمي)
- `DELETE /api/products/:id` - حذف منتج (محمي)

### Special Products
- `GET /api/special-products` - جلب جميع المنتجات الخاصة
- `GET /api/special-products/:id` - جلب منتج خاص واحد
- `POST /api/special-products/generate-combinations` - توليد التركيبات (محمي)
- `POST /api/special-products` - إنشاء منتج خاص (محمي)
- `PUT /api/special-products/:id` - تحديث منتج خاص (محمي)
- `DELETE /api/special-products/:id` - حذف منتج خاص (محمي)

### Uploads
- `POST /api/uploads/category` - رفع صورة فئة (محمي)
- `POST /api/uploads/product` - رفع صورة منتج واحدة (محمي)
- `POST /api/uploads/product/multiple` - رفع صور منتج متعددة (محمي)
- `POST /api/uploads/special-product` - رفع صورة تركيبة (محمي)

## 🎨 الواجهة

- **اللغة:** العربية (RTL)
- **الوضع الفاتح/الداكن:** متوفر مع تبديل سريع
- **الألوان:** أسود + ذهبي (الوضع الداكن) | أبيض + ذهبي (الوضع الفاتح)
- **التصميم:** متجاوب بالكامل

## 🔮 الميزات المستقبلية (Placeholders)

تم إضافة مسارات للميزات المستقبلية:

- 📦 **نظام نقاط البيع (POS)**
- 📋 **إدارة الطلبات**
- 💳 **نظام الائتمان والفواتير غير المدفوعة**
- 👥 **المستخدمون التجاريون**
- 📄 **توليد PDF للفواتير**
- 🌐 **دعم متعدد اللغات**

## 📄 الترخيص

هذا المشروع خاص بشركة Les Rois Du Bois.

## 👨‍💻 الدعم

لأي استفسارات أو مشاكل، يرجى التواصل مع فريق التطوير.

