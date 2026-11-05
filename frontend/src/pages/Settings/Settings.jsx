import { useState, useEffect } from 'react';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { Settings as SettingsIcon, Save, Mail, Lock, DollarSign, Truck, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { withBase } from '@/utils/imageUrl';

const Settings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [settings, setSettings] = useState({
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    vat: 19,
    deliveryFee: 10,
    storeOpen: true,
    storeLogo: '',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoadingSettings(true);
      const response = await api.get('/settings');
      const data = response.data.data;
      if (data) {
        setSettings((prev) => ({
          ...prev,
          vat: data.vat || 19,
          deliveryFee: data.deliveryFee || 10,
          storeOpen: data.storeOpen !== undefined ? data.storeOpen : true,
          storeLogo: data.storeLogo || '',
        }));
      }
    } catch (error) {
      // Silent error handling
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings({
      ...settings,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    if (!settings.email) {
      toast.error('البريد الإلكتروني مطلوب');
      return;
    }

    try {
      setLoading(true);
      await api.put('/users/me', { email: settings.email });
      toast.success('تم تحديث البريد الإلكتروني بنجاح');
    } catch (error) {
      const message = error.response?.data?.message || 'حدث خطأ';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!settings.currentPassword || !settings.newPassword) {
      toast.error('جميع الحقول مطلوبة');
      return;
    }

    if (settings.newPassword !== settings.confirmPassword) {
      toast.error('كلمات المرور غير متطابقة');
      return;
    }

    if (settings.newPassword.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    try {
      setLoading(true);
      await api.post('/auth/change-password', {
        currentPassword: settings.currentPassword,
        newPassword: settings.newPassword,
      });
      toast.success('تم تحديث كلمة المرور بنجاح');
      setSettings({
        ...settings,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      const message = error.response?.data?.message || 'حدث خطأ';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/settings', {
        vat: settings.vat,
        deliveryFee: settings.deliveryFee,
        storeOpen: settings.storeOpen,
      });
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      const message = error.response?.data?.message || 'حدث خطأ';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('image', file);

      const response = await api.post('/uploads/settings/logo', formData);
      setSettings({ ...settings, storeLogo: response.data.data.path });
      toast.success('تم رفع الشعار بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء رفع الشعار');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">الإعدادات</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">إدارة إعدادات النظام</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Settings */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <Mail className="text-gold-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">إعدادات الحساب</h2>
          </div>
          <form onSubmit={handleUpdateEmail} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                name="email"
                value={settings.email}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              <Save size={18} className="ml-2" />
              تحديث البريد الإلكتروني
            </button>
          </form>
        </div>

        {/* Password Settings */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="text-gold-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">تغيير كلمة المرور</h2>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                كلمة المرور الحالية
              </label>
              <input
                type="password"
                name="currentPassword"
                value={settings.currentPassword}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                كلمة المرور الجديدة
              </label>
              <input
                type="password"
                name="newPassword"
                value={settings.newPassword}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                تأكيد كلمة المرور
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={settings.confirmPassword}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              <Lock size={18} className="ml-2" />
              تغيير كلمة المرور
            </button>
          </form>
        </div>

        {/* Business Settings */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <DollarSign className="text-gold-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">إعدادات الأعمال</h2>
          </div>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                نسبة الضريبة (VAT) %
              </label>
              <input
                type="number"
                name="vat"
                value={settings.vat}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.01"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                رسوم التوصيل (TND)
              </label>
              <input
                type="number"
                name="deliveryFee"
                value={settings.deliveryFee}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="input-field"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                name="storeOpen"
                checked={settings.storeOpen}
                onChange={handleChange}
                className="w-5 h-5 text-gold-600 rounded"
              />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                المتجر مفتوح
              </label>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              <Save size={18} className="ml-2" />
              حفظ الإعدادات
            </button>
          </form>
        </div>

        {/* Store Logo */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <ImageIcon className="text-gold-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">شعار المتجر</h2>
          </div>
          <div className="space-y-4">
            {settings.storeLogo && (
              <div className="w-full h-32 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
                <img
                  src={withBase(settings.storeLogo)}
                  alt="Store Logo"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}
            <label className="block">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={loading}
              />
              <div className="btn-secondary w-full text-center cursor-pointer">
                <ImageIcon size={18} className="ml-2 inline" />
                {settings.storeLogo ? 'تغيير الشعار' : 'رفع شعار'}
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

