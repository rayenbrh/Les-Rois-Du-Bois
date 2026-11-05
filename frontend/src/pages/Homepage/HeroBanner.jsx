import { useState, useEffect } from 'react';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { Save, Image as ImageIcon, Eye } from 'lucide-react';
import { withBase } from '../../utils/imageUrl';

const HeroBanner = () => {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [formData, setFormData] = useState({
    hero_image: '',
    hero_title: 'ملوك الخشب',
    hero_subtitle: 'أثاث فاخر بتصاميم عصرية وجودة عالية',
    hero_description: 'اكتشف مجموعتنا المميزة من الأثاث المصنوع يدوياً من أجود أنواع الخشب الطبيعي',
    hero_cta_text: 'تسوق الآن',
    hero_cta_link: '/shop/products',
    hero_cta2_text: 'المنتجات المركبة',
    hero_cta2_link: '/shop/special-products',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      const response = await api.get('/homepage/admin/hero');
      if (response.data.success && response.data.data) {
        setFormData({
          hero_image: response.data.data.hero_image || '',
          hero_title: response.data.data.hero_title || 'ملوك الخشب',
          hero_subtitle: response.data.data.hero_subtitle || 'أثاث فاخر بتصاميم عصرية وجودة عالية',
          hero_description: response.data.data.hero_description || '',
          hero_cta_text: response.data.data.hero_cta_text || 'تسوق الآن',
          hero_cta_link: response.data.data.hero_cta_link || '/shop/products',
          hero_cta2_text: response.data.data.hero_cta2_text || 'المنتجات المركبة',
          hero_cta2_link: response.data.data.hero_cta2_link || '/shop/special-products',
        });
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب البيانات');
    } finally {
      setLoadingData(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const formDataUpload = new FormData();
      formDataUpload.append('image', file);

      const response = await api.post('/uploads/product', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setFormData({ ...formData, hero_image: response.data.data.path });
      toast.success('تم رفع الصورة بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء رفع الصورة');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/homepage/admin/hero', formData);
      toast.success('تم حفظ إعدادات البانر بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">إدارة البانر الرئيسي</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">تخصيص البانر الرئيسي للصفحة الرئيسية</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Section */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">إعدادات البانر</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Hero Image */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                صورة البانر
              </label>
              <div className="space-y-3">
                {formData.hero_image && (
                  <div className="w-full h-48 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                    <img
                      src={withBase(formData.hero_image)}
                      alt="Hero Banner"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={loading}
                  />
                  <div className="btn-secondary w-full text-center cursor-pointer">
                    <ImageIcon size={18} className="ml-2 inline" />
                    {formData.hero_image ? 'تغيير الصورة' : 'رفع صورة'}
                  </div>
                </label>
              </div>
            </div>

            {/* Hero Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                العنوان الرئيسي
              </label>
              <input
                type="text"
                name="hero_title"
                value={formData.hero_title}
                onChange={handleChange}
                className="input-field"
                placeholder="ملوك الخشب"
                required
              />
            </div>

            {/* Hero Subtitle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                العنوان الفرعي
              </label>
              <input
                type="text"
                name="hero_subtitle"
                value={formData.hero_subtitle}
                onChange={handleChange}
                className="input-field"
                placeholder="أثاث فاخر بتصاميم عصرية وجودة عالية"
                required
              />
            </div>

            {/* Hero Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                الوصف
              </label>
              <textarea
                name="hero_description"
                value={formData.hero_description}
                onChange={handleChange}
                className="input-field"
                rows="3"
                placeholder="اكتشف مجموعتنا المميزة..."
              />
            </div>

            {/* CTA Button 1 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  نص الزر الأول
                </label>
                <input
                  type="text"
                  name="hero_cta_text"
                  value={formData.hero_cta_text}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="تسوق الآن"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  رابط الزر الأول
                </label>
                <input
                  type="text"
                  name="hero_cta_link"
                  value={formData.hero_cta_link}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="/shop/products"
                />
              </div>
            </div>

            {/* CTA Button 2 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  نص الزر الثاني
                </label>
                <input
                  type="text"
                  name="hero_cta2_text"
                  value={formData.hero_cta2_text}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="المنتجات المركبة"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  رابط الزر الثاني
                </label>
                <input
                  type="text"
                  name="hero_cta2_link"
                  value={formData.hero_cta2_link}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="/shop/special-products"
                />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              <Save size={18} className="ml-2" />
              حفظ التغييرات
            </button>
          </form>
        </div>

        {/* Preview Section */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <Eye className="text-gold-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">معاينة مباشرة</h2>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-lg p-8 border border-gray-200 dark:border-gray-700">
            <div className="space-y-6 text-center">
              {formData.hero_image && (
                <div className="w-full h-64 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                  <img
                    src={withBase(formData.hero_image)}
                    alt="Hero Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="space-y-4">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                  {formData.hero_title || 'العنوان الرئيسي'}
                </h1>
                <p className="text-xl text-gray-600 dark:text-gray-400">
                  {formData.hero_subtitle || 'العنوان الفرعي'}
                </p>
                {formData.hero_description && (
                  <p className="text-gray-500 dark:text-gray-500">
                    {formData.hero_description}
                  </p>
                )}
                <div className="flex gap-4 justify-center">
                  {formData.hero_cta_text && (
                    <button className="bg-gold-600 text-white px-6 py-2 rounded-lg">
                      {formData.hero_cta_text}
                    </button>
                  )}
                  {formData.hero_cta2_text && (
                    <button className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-6 py-2 rounded-lg">
                      {formData.hero_cta2_text}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroBanner;

