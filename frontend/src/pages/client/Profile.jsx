import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { User, MapPin, Package, KeyRound, LogOut, Plus, Trash2, ChevronLeft, BadgePercent, Loader2 } from 'lucide-react';
import { useClientAuth } from '../../contexts/ClientAuthContext';
import clientApi from '../../utils/clientAxios';
import PasswordInput from '../../components/shared/PasswordInput';
import EmptyState from '../../components/client/EmptyState';
import { formatPrice, formatDate } from '../../utils/format';
import { statusInfo } from '../../utils/orderStatus';

const TABS = [
  { key: 'orders', label: 'طلباتي', icon: Package },
  { key: 'account', label: 'الحساب', icon: User },
  { key: 'addresses', label: 'العناوين', icon: MapPin },
  { key: 'password', label: 'كلمة المرور', icon: KeyRound },
];

const emptyAddress = (user, phone) => ({ fullName: user?.name || '', street: '', city: '', zip: '', phone: phone || '', isDefault: false });

const Profile = () => {
  const { user, updateProfile, logout, isWholesale } = useClientAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = TABS.some((t) => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'orders';

  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const [addresses, setAddresses] = useState([]);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setProfileForm({ name: user.name || '', phone: user.phone || '' });
    setAddresses(user.addresses || []);
  }, [user]);

  useEffect(() => {
    if (activeTab !== 'orders') return;
    setLoadingOrders(true);
    clientApi
      .get('/orders', { params: { limit: 50 } })
      .then((res) => setOrders(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoadingOrders(false));
  }, [activeTab]);

  const setTab = (key) => setSearchParams(key === 'orders' ? {} : { tab: key }, { replace: true });

  const save = async (data) => {
    setSaving(true);
    await updateProfile(data);
    setSaving(false);
  };

  const updateAddress = (index, field, value) =>
    setAddresses((prev) =>
      prev.map((addr, i) => {
        if (field === 'isDefault') return { ...addr, isDefault: i === index ? value : false };
        return i === index ? { ...addr, [field]: value } : addr;
      })
    );

  const changePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 6) return toast.error('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
    if (passwordForm.newPassword !== passwordForm.confirm) return toast.error('كلمتا المرور غير متطابقتين');
    setSaving(true);
    try {
      await clientApi.put('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success('تم تغيير كلمة المرور');
      setPasswordForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'تعذر تغيير كلمة المرور');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="container py-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 sm:mb-8">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-100 text-xl font-extrabold text-gold-700 dark:text-gold-500">
            {(user.name || 'U').trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-gray-900 dark:text-white">مرحباً، {user.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="truncate text-sm text-gray-500" dir="ltr">
                {user.email}
              </span>
              {isWholesale ? (
                <span className="badge-gold">
                  <BadgePercent size={12} /> حساب جملة
                </span>
              ) : (
                <span className="badge bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">حساب تجزئة</span>
              )}
            </div>
          </div>
        </div>
        <button type="button" onClick={logout} className="btn-secondary">
          <LogOut size={18} />
          تسجيل الخروج
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0" aria-label="أقسام الحساب">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === key
                  ? 'bg-gold-600 text-on-gold shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <section className="min-w-0">
          {activeTab === 'orders' &&
            (loadingOrders ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton h-20 w-full !rounded-2xl" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <EmptyState
                icon={Package}
                title="لا توجد طلبات بعد"
                text="عندما تطلب منتجات ستظهر هنا."
                action={
                  <Link to="/shop/products" className="btn-primary">
                    ابدأ التسوق
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-3">
                {orders.map((order) => {
                  const s = statusInfo(order.status);
                  return (
                    <li key={order._id}>
                      <Link
                        to={`/shop/orders/${order._id}`}
                        className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-gold-400 dark:border-gray-700 dark:bg-gray-800"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 dark:text-gray-100">{order.orderNumber || `#${order._id.slice(-6)}`}</p>
                          <p className="text-xs text-gray-500">
                            {formatDate(order.createdAt)} · {order.items?.length || 0} منتج
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold tabular-nums text-gray-900 dark:text-white">{formatPrice(order.total)}</span>
                          <span className={`badge ${s.className}`}>{s.label}</span>
                        </div>
                        <ChevronLeft size={18} className="text-gray-400" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ))}

          {activeTab === 'account' && (
            <form
              className="card max-w-xl space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save({ name: profileForm.name, phone: profileForm.phone });
              }}
            >
              <div>
                <label className="label" htmlFor="p-name">
                  الاسم
                </label>
                <input id="p-name" required value={profileForm.name} onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="label" htmlFor="p-email">
                  البريد الإلكتروني
                </label>
                <input id="p-email" value={user.email} disabled className="input-field" dir="ltr" />
              </div>
              <div>
                <label className="label" htmlFor="p-phone">
                  الهاتف
                </label>
                <input id="p-phone" type="tel" value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} className="input-field" dir="ltr" />
              </div>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <Loader2 size={18} className="animate-spin" />}
                حفظ التغييرات
              </button>
            </form>
          )}

          {activeTab === 'addresses' && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {addresses.map((addr, idx) => (
                  <div key={idx} className="card space-y-3">
                    <input value={addr.fullName} onChange={(e) => updateAddress(idx, 'fullName', e.target.value)} placeholder="الاسم الكامل" className="input-field" />
                    <input value={addr.street} onChange={(e) => updateAddress(idx, 'street', e.target.value)} placeholder="العنوان" className="input-field" />
                    <div className="grid grid-cols-2 gap-3">
                      <input value={addr.city} onChange={(e) => updateAddress(idx, 'city', e.target.value)} placeholder="المدينة" className="input-field" />
                      <input value={addr.zip} onChange={(e) => updateAddress(idx, 'zip', e.target.value)} placeholder="الرمز البريدي" className="input-field" dir="ltr" />
                    </div>
                    <input value={addr.phone} onChange={(e) => updateAddress(idx, 'phone', e.target.value)} placeholder="الهاتف" className="input-field" dir="ltr" />
                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={!!addr.isDefault}
                          onChange={(e) => updateAddress(idx, 'isDefault', e.target.checked)}
                          className="h-4 w-4 rounded"
                        />
                        العنوان الافتراضي
                      </label>
                      <button
                        type="button"
                        onClick={() => setAddresses((prev) => prev.filter((_, i) => i !== idx))}
                        className="btn-icon h-9 w-9 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        aria-label="حذف العنوان"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setAddresses((prev) => [...prev, emptyAddress(user, profileForm.phone)])}
                  className="flex min-h-[10rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 transition-colors hover:border-gold-400 hover:text-gold-700 dark:border-gray-700"
                >
                  <Plus size={24} />
                  إضافة عنوان
                </button>
              </div>
              <button type="button" onClick={() => save({ addresses })} disabled={saving} className="btn-primary">
                {saving && <Loader2 size={18} className="animate-spin" />}
                حفظ العناوين
              </button>
            </div>
          )}

          {activeTab === 'password' && (
            <form onSubmit={changePassword} className="card max-w-md space-y-4">
              <div>
                <label className="label" htmlFor="cur-pass">
                  كلمة المرور الحالية
                </label>
                <PasswordInput
                  id="cur-pass"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                />
              </div>
              <div>
                <label className="label" htmlFor="new-pass">
                  كلمة المرور الجديدة
                </label>
                <PasswordInput
                  id="new-pass"
                  required
                  autoComplete="new-password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                />
              </div>
              <div>
                <label className="label" htmlFor="new-pass2">
                  تأكيد كلمة المرور
                </label>
                <PasswordInput
                  id="new-pass2"
                  required
                  autoComplete="new-password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
                />
              </div>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <Loader2 size={18} className="animate-spin" />}
                تحديث كلمة المرور
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
};

export default Profile;
