import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../utils/axios';
import toast from 'react-hot-toast';

const UserModal = ({ user, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'user',
    isAdmin: false,
    commercialId: '',
  });
  const [commercials, setCommercials] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCommercials();
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        password: '',
        role: user.role || 'user',
        isAdmin: user.isAdmin || false,
        commercialId: user.commercialId?._id || user.commercialId || '',
      });
    }
  }, [user]);

  const fetchCommercials = async () => {
    try {
      const response = await api.get('/users', { params: { role: 'commercial' } });
      setCommercials(response.data.data || []);
    } catch (error) {
      // Silent error handling
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user && !formData.password) {
      toast.error('كلمة المرور مطلوبة للمستخدمين الجدد');
      return;
    }

    if (formData.password && formData.password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setLoading(true);

    try {
      const submitData = { ...formData };
      if (user && !submitData.password) {
        delete submitData.password;
      }
      if (formData.role !== 'client') {
        submitData.commercialId = '';
      }

      if (user) {
        await api.put(`/users/${user._id}`, submitData);
        toast.success('تم تحديث المستخدم بنجاح');
      } else {
        await api.post('/users', submitData);
        toast.success('تم إضافة المستخدم بنجاح');
      }
      onClose();
    } catch (error) {
      const message = error.response?.data?.message || 'حدث خطأ';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {user ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                الاسم *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                البريد الإلكتروني *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                الهاتف
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {user ? 'كلمة المرور الجديدة (اتركها فارغة للاحتفاظ بالحالية)' : 'كلمة المرور *'}
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required={!user}
                minLength={6}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                الدور *
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
                className="input-field"
              >
                <option value="user">عميل تجزئة (Détail) - أسعار التجزئة</option>
                <option value="admin">مدير</option>
                <option value="commercial">تجاري</option>
                <option value="store_cashier">كاشير</option>
                <option value="client">عميل جملة (Gros) - أسعار الجملة</option>
              </select>
            </div>

            {formData.role === 'client' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  التجاري المسؤول (اختياري)
                </label>
                <select
                  name="commercialId"
                  value={formData.commercialId}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="">بدون تجاري</option>
                  {commercials.map((commercial) => (
                    <option key={commercial._id} value={commercial._id}>
                      {commercial.name} ({commercial.email})
                    </option>
                  ))}
                </select>
                {commercials.length === 0 && (
                  <p className="text-sm text-gray-500 mt-1">لا يوجد تجاريون متاحون</p>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                name="isAdmin"
                checked={formData.isAdmin}
                onChange={handleChange}
                className="w-5 h-5 text-gold-600 rounded"
              />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                صلاحيات المدير
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              إلغاء
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'جاري الحفظ...' : user ? 'تحديث' : 'إضافة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserModal;

