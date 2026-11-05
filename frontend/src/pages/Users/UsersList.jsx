import { useState, useEffect } from 'react';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { Users, Plus, Edit, Trash2, Search, Shield, User as UserIcon, Lock } from 'lucide-react';
import UserModal from '../../components/UserModal';

const CUSTOMER_TIERS = [
  { role: 'client', label: 'جملة', confirmed: 'أصبح العميل عميل جملة (Gros)' },
  { role: 'user', label: 'تجزئة', confirmed: 'أصبح العميل عميل تجزئة (Détail)' },
];

/** One-click switch between wholesale and retail pricing for a customer. */
const CustomerTierSwitch = ({ user, isBusy, onChange }) => (
  <div
    role="group"
    aria-label={`نوع العميل ${user.name}`}
    className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-600"
  >
    {CUSTOMER_TIERS.map(({ role, label }) => {
      const isActive = user.role === role;
      return (
        <button
          key={role}
          type="button"
          disabled={isBusy}
          aria-pressed={isActive}
          onClick={() => {
            if (!isActive) onChange(user, role);
          }}
          className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${
            isActive
              ? 'bg-gold-600 text-on-gold'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          {label}
        </button>
      );
    })}
  </div>
);

const UsersList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [switchingUserId, setSwitchingUserId] = useState(null);
  const [filters, setFilters] = useState({
    role: '',
    search: '',
  });

  useEffect(() => {
    fetchUsers();
  }, [filters]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.role) params.role = filters.role;
      if (filters.search) params.search = filters.search;

      const response = await api.get('/users', { params });
      setUsers(response.data.data || []);
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
      return;
    }

    try {
      await api.delete(`/users/${id}`);
      toast.success('تم حذف المستخدم بنجاح');
      fetchUsers();
    } catch (error) {
      const message = error.response?.data?.message || 'حدث خطأ أثناء حذف المستخدم';
      toast.error(message);
    }
  };

  const handleResetPassword = async (id) => {
    const newPassword = window.prompt('أدخل كلمة المرور الجديدة (6 أحرف على الأقل):');
    if (!newPassword || newPassword.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    try {
      await api.post(`/users/${id}/reset-password`, { newPassword });
      toast.success('تم تحديث كلمة المرور بنجاح');
    } catch (error) {
      const message = error.response?.data?.message || 'حدث خطأ';
      toast.error(message);
    }
  };

  const handleTierChange = async (user, role) => {
    // Retail customers can't have a sales rep: the server removes the link
    if (
      role !== 'client' &&
      user.commercialId &&
      !window.confirm(`سيتم إلغاء ربط هذا العميل بالتجاري ${user.commercialId.name}. هل تريد المتابعة؟`)
    ) {
      return;
    }

    try {
      setSwitchingUserId(user._id);
      const response = await api.put(`/users/${user._id}`, { role });
      setUsers((current) => current.map((u) => (u._id === user._id ? response.data.data : u)));
      toast.success(CUSTOMER_TIERS.find((tier) => tier.role === role).confirmed);
    } catch (error) {
      toast.error(error.response?.data?.message || 'حدث خطأ أثناء تغيير نوع العميل');
    } finally {
      setSwitchingUserId(null);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    fetchUsers();
  };

  const roleLabels = {
    admin: 'مدير',
    commercial: 'تجاري',
    store_cashier: 'كاشير',
    client: 'عميل جملة (Gros)',
    user: 'عميل تجزئة (Détail)',
  };

  const roleColors = {
    admin: 'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-400',
    commercial: 'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-400',
    store_cashier: 'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-400',
    client: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    user: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">إدارة المستخدمين</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">إدارة جميع المستخدمين والصلاحيات</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          <span>إضافة مستخدم</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="البحث عن مستخدم..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="input-field pr-10"
            />
          </div>
          <select
            value={filters.role}
            onChange={(e) => setFilters({ ...filters, role: e.target.value })}
            className="input-field"
          >
            <option value="">جميع الأدوار</option>
            <option value="admin">مدير</option>
            <option value="commercial">تجاري</option>
            <option value="store_cashier">كاشير</option>
            <option value="client">عميل جملة (Gros)</option>
            <option value="user">عميل تجزئة (Détail)</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500 dark:text-gray-400">لا يوجد مستخدمون</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    الاسم
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    البريد الإلكتروني
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    الهاتف
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    الدور
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    التجاري المسؤول
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    الحالة
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user._id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {user.isAdmin ? (
                          <Shield className="text-gold-500" size={18} />
                        ) : (
                          <UserIcon className="text-gray-400" size={18} />
                        )}
                        <span className="font-medium text-gray-900 dark:text-gray-100">{user.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{user.email}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{user.phone || '-'}</td>
                    <td className="py-3 px-4">
                      {CUSTOMER_TIERS.some((tier) => tier.role === user.role) ? (
                        <CustomerTierSwitch
                          user={user}
                          isBusy={switchingUserId === user._id}
                          onChange={handleTierChange}
                        />
                      ) : (
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            roleColors[user.role] || roleColors.user
                          }`}
                        >
                          {roleLabels[user.role] || user.role}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {user.role === 'client' && user.commercialId ? (
                        <div>
                          <div className="font-medium">{user.commercialId.name}</div>
                          <div className="text-xs text-gray-500">{user.commercialId.email}</div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.isAdmin
                            ? 'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-400'
                            : 'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-400'
                        }`}
                      >
                        {user.isAdmin ? 'مدير' : 'نشط'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleResetPassword(user._id)}
                          className="p-2 text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg transition-colors"
                          title="إعادة تعيين كلمة المرور"
                        >
                          <Lock size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(user._id)}
                          className="p-2 text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <UserModal user={editingUser} onClose={handleCloseModal} />
      )}
    </div>
  );
};

export default UsersList;

