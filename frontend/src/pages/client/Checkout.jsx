import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, ShieldCheck, Truck, BadgePercent, ShoppingBag } from 'lucide-react';
import clientApi from '../../utils/clientAxios';
import { useCart } from '../../contexts/CartContext';
import { useClientAuth } from '../../contexts/ClientAuthContext';
import EmptyState from '../../components/client/EmptyState';
import { formatPrice } from '../../utils/format';
import { cartKey } from '../../utils/cartItem';
import { PLACEHOLDER_IMAGE } from '../../utils/imageUrl';

const Field = ({ id, label, children }) => (
  <div>
    <label htmlFor={id} className="label">
      {label}
    </label>
    {children}
  </div>
);

const Checkout = () => {
  const navigate = useNavigate();
  const { user, isWholesale } = useClientAuth();
  const { cartItems, clearCart, getCartTotal, refreshCart } = useCart();

  const defaultAddress = useMemo(
    () => user?.addresses?.find((a) => a.isDefault) || user?.addresses?.[0] || {},
    [user]
  );

  const [form, setForm] = useState({ fullName: '', email: '', phone: '', street: '', city: '', zip: '', notes: '' });
  const [saving, setSaving] = useState(false);

  // Make sure prices/stock are current for this account before confirming
  useEffect(() => {
    refreshCart().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      fullName: prev.fullName || defaultAddress.fullName || user.name || '',
      email: prev.email || user.email || '',
      phone: prev.phone || defaultAddress.phone || user.phone || '',
      street: prev.street || defaultAddress.street || '',
      city: prev.city || defaultAddress.city || '',
      zip: prev.zip || defaultAddress.zip || '',
    }));
  }, [user, defaultAddress]);

  const total = getCartTotal();
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cartItems.length || saving) return;
    setSaving(true);
    try {
      const payload = {
        items: cartItems.map((item) => ({
          productId: item.productId,
          productType: item.productType,
          quantity: item.quantity,
          combinationId: item.combinationId,
          variant: item.variant ? { value: item.variant.value, image: item.variant.image, _id: item.variant._id } : undefined,
        })),
        paymentMethod: 'cash',
        notes: form.notes,
        shippingAddress: {
          fullName: form.fullName,
          street: form.street,
          city: form.city,
          zip: form.zip,
          phone: form.phone,
          email: form.email,
        },
      };

      const res = await clientApi.post('/orders', payload);
      const createdOrder = res.data.data?.order || res.data.data;
      clearCart();
      toast.success('تم إنشاء الطلب بنجاح');
      navigate(createdOrder?._id ? `/shop/orders/${createdOrder._id}?new=1` : '/shop/profile', { replace: true });
    } catch (error) {
      const data = error.response?.data;
      if (data?.stockIssues?.length) {
        const names = data.stockIssues.map((i) => `${i.productName}${i.variant ? ` (${i.variant})` : ''}: ${i.available}`).join('، ');
        toast.error(`المخزون غير كافٍ - المتاح: ${names}`, { duration: 6000 });
        refreshCart().catch(() => {});
      } else {
        toast.error(data?.message || 'تعذر إنشاء الطلب');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!cartItems.length) {
    return (
      <div className="container py-10">
        <EmptyState
          icon={ShoppingBag}
          title="لا توجد منتجات لإتمام الطلب"
          action={
            <Link to="/shop/products" className="btn-primary">
              تسوق المنتجات
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container py-6 sm:py-10">
      <div className="mb-6 sm:mb-8">
        <p className="text-sm font-semibold text-gold-700 dark:text-gold-500">إتمام الطلب</p>
        <h1 className="page-title mt-1">أكمل طلبك</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">أدخل عنوان التوصيل ثم أكّد الطلب.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="space-y-6">
          <section className="card space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
              <Truck size={20} className="text-gold-600" />
              معلومات التوصيل
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="fullName" label="الاسم الكامل *">
                <input id="fullName" required autoComplete="name" value={form.fullName} onChange={set('fullName')} className="input-field" />
              </Field>
              <Field id="phone" label="الهاتف *">
                <input id="phone" required type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} className="input-field" dir="ltr" />
              </Field>
              <Field id="email" label="البريد الإلكتروني">
                <input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} className="input-field" dir="ltr" />
              </Field>
              <Field id="city" label="المدينة *">
                <input id="city" required autoComplete="address-level2" value={form.city} onChange={set('city')} className="input-field" />
              </Field>
              <div className="sm:col-span-2">
                <Field id="street" label="العنوان *">
                  <input id="street" required autoComplete="street-address" value={form.street} onChange={set('street')} className="input-field" />
                </Field>
              </div>
              <Field id="zip" label="الرمز البريدي">
                <input id="zip" inputMode="numeric" autoComplete="postal-code" value={form.zip} onChange={set('zip')} className="input-field" dir="ltr" />
              </Field>
            </div>
            <Field id="notes" label="ملاحظات (اختياري)">
              <textarea id="notes" rows={3} value={form.notes} onChange={set('notes')} className="input-field resize-none" maxLength={1000} />
            </Field>
          </section>

          <section className="card">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
              <ShieldCheck size={20} className="text-gold-600" />
              الدفع
            </h2>
            <label className="mt-4 flex items-center gap-3 rounded-xl border-2 border-gold-500 bg-gold-50 p-4">
              <input type="radio" checked readOnly className="h-4 w-4 accent-[rgb(var(--gold-600))]" />
              <span className="font-semibold text-gray-900 dark:text-gray-100">الدفع عند الاستلام</span>
            </label>
          </section>
        </div>

        <aside className="card h-fit space-y-4 lg:sticky lg:top-24">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ملخص الطلب</h2>
          {isWholesale && (
            <p className="badge-gold">
              <BadgePercent size={14} />
              أسعار الجملة مطبقة
            </p>
          )}
          <ul className="max-h-72 space-y-3 overflow-y-auto">
            {cartItems.map((item) => (
              <li key={cartKey(item)} className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
                  <img src={item.image || PLACEHOLDER_IMAGE} alt="" className="h-full w-full object-cover" />
                  <span className="absolute -left-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-gray-900 px-1 text-[11px] font-bold text-white dark:bg-gray-100 dark:text-gray-900">
                    {item.quantity}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{item.name}</p>
                  {item.variant && <p className="truncate text-xs text-gray-500">{item.variant.value}</p>}
                </div>
                <p className="text-sm font-semibold tabular-nums">{formatPrice(item.price * item.quantity)}</p>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-gray-100 pt-3 text-base font-bold text-gray-900 dark:border-gray-800 dark:text-white">
            <span>الإجمالي</span>
            <span className="text-gold-700 tabular-nums dark:text-gold-500">{formatPrice(total)}</span>
          </div>
          <p className="text-xs text-gray-500">يتم تأكيد الأسعار النهائية والمخزون عند إرسال الطلب.</p>
          <button type="submit" disabled={saving} className="btn-primary w-full py-3 text-base">
            {saving && <Loader2 size={20} className="animate-spin" />}
            {saving ? 'جار إرسال الطلب...' : 'تأكيد الطلب'}
          </button>
        </aside>
      </form>
    </div>
  );
};

export default Checkout;
