import { useState, useEffect } from 'react';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { Settings as SettingsIcon, Save, Mail, Lock, DollarSign, Truck, Image as ImageIcon, Building2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { withBase } from '@/utils/imageUrl';

// Company identity printed on every PDF (invoices, bons de commande, reports)
const COMPANY_FIELDS = [
  { name: 'companyName', label: 'اسم الشركة', placeholder: 'Les Rois Du Bois', type: 'text', dir: 'auto' },
  { name: 'companyAddress', label: 'العنوان', placeholder: "Rte de Monastir 4070 M'saken", type: 'text', dir: 'auto' },
  { name: 'companyPhone', label: 'الهاتف', placeholder: '58 111 106', type: 'text', dir: 'ltr' },
  { name: 'companyEmail', label: 'البريد الإلكتروني', placeholder: 'contact@example.tn', type: 'email', dir: 'ltr' },
  { name: 'companyTaxId', label: 'المعرف الجبائي (Matricule fiscal)', placeholder: '1234567/A/M/000', type: 'text', dir: 'ltr' },
];

const EMPTY_COMPANY = COMPANY_FIELDS.reduce((acc, field) => ({ ...acc, [field.name]: '' }), { companyLogo: '' });

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
  const [company, setCompany] = useState(EMPTY_COMPANY);

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
        setCompany(
          Object.keys(EMPTY_COMPANY).reduce((acc, key) => ({ ...acc, [key]: data[key] || '' }), {})
        );
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

  const handleCompanyChange = (e) => {
    const { name, value } = e.target;
    setCompany((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = COMPANY_FIELDS.reduce(
        (acc, field) => ({ ...acc, [field.name]: company[field.name].trim() }),
        {}
      );
      await api.post('/settings', payload);
      toast.success('تم حفظ معلومات الشركة بنجاح');
    } catch (error) {
      const message = error.response?.data?.message || 'حدث خطأ';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyLogoUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.post('/uploads/settings/logo', formData);
      const logoPath = response.data.data.path;
      await api.post('/settings', { companyLogo: logoPath });
      setCompany((prev) => ({ ...prev, companyLogo: logoPath }));
      toast.success('تم تحديث شعار المستندات');
    } catch (error) {
      toast.error(error.response?.data?.message || 'حدث خطأ أثناء رفع الشعار');
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyLogoReset = async () => {
    try {
      setLoading(true);
      await api.post('/settings', { companyLogo: '' });
      setCompany((prev) => ({ ...prev, companyLogo: '' }));
      toast.success('سيتم استعمال الشعار الافتراضي');
    } catch (error) {
      toast.error(error.response?.data?.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  const companyLogoSrc = company.companyLogo ? withBase(company.companyLogo) : '/logo-light.webp';

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

        {/* Company identity printed on PDFs */}
        <div className="card lg:col-span-2">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="text-gold-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">معلومات الشركة في المستندات</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            تظهر هذه المعلومات في رأس الفواتير وأذون الطلب والتقارير (PDF). الحقول الفارغة تستعمل القيم الافتراضية.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form onSubmit={handleSaveCompany} className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              {COMPANY_FIELDS.map((field) => (
                <div key={field.name} className={field.name === 'companyAddress' ? 'md:col-span-2' : ''}>
                  <label
                    htmlFor={field.name}
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {field.label}
                  </label>
                  <input
                    id={field.name}
                    type={field.type}
                    name={field.name}
                    dir={field.dir}
                    value={company[field.name]}
                    onChange={handleCompanyChange}
                    placeholder={field.placeholder}
                    className="input-field"
                    disabled={loadingSettings}
                  />
                </div>
              ))}
              <div className="md:col-span-2">
                <button type="submit" className="btn-primary w-full" disabled={loading || loadingSettings}>
                  <Save size={18} className="ml-2" />
                  حفظ معلومات الشركة
                </button>
              </div>
            </form>

            <div className="space-y-4">
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">شعار المستندات</span>
              <div className="w-full h-32 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
                <img src={companyLogoSrc} alt="Logo" className="max-w-full max-h-full object-contain" />
              </div>
              {!company.companyLogo && (
                <p className="text-xs text-gray-500 dark:text-gray-400">يتم استعمال الشعار الافتراضي حالياً.</p>
              )}
              <label className="block">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleCompanyLogoUpload}
                  className="hidden"
                  disabled={loading}
                />
                <div className="btn-secondary w-full text-center cursor-pointer">
                  <ImageIcon size={18} className="ml-2 inline" />
                  {company.companyLogo ? 'تغيير شعار المستندات' : 'رفع شعار المستندات'}
                </div>
              </label>
              {company.companyLogo && (
                <button
                  type="button"
                  onClick={handleCompanyLogoReset}
                  className="btn-secondary w-full"
                  disabled={loading}
                >
                  استعمال الشعار الافتراضي
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

