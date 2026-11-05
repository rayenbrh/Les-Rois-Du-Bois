# إعداد ملف البيئة (.env)

قم بإنشاء ملف `.env` في مجلد `backend/` مع المحتوى التالي:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/les-rois-des-bois
JWT_SECRET=your-super-secret-jwt-key-change-in-production
NODE_ENV=development
```

## شرح المتغيرات:

- **PORT**: منفذ تشغيل الخادم (افتراضي: 5000)
- **MONGODB_URI**: رابط اتصال MongoDB
  - محلي: `mongodb://localhost:27017/les-rois-des-bois`
  - Atlas: `mongodb+srv://username:password@cluster.mongodb.net/les-rois-des-bois`
- **JWT_SECRET**: مفتاح سري لتوقيع JWT (يجب تغييره في الإنتاج)
- **FRONTEND_URL**: رابط الواجهة الأمامية (للسماح بـ CORS). الجلسات لا تنتهي تلقائياً - يبقى المستخدم متصلاً حتى يسجل الخروج.
- **NODE_ENV**: بيئة التشغيل (development/production)

## ملاحظات:

⚠️ **مهم:** لا ترفع ملف `.env` إلى Git! فهو موجود في `.gitignore`

