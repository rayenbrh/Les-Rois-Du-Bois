import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, UserPlus, X, AlertTriangle, Wallet } from 'lucide-react';
import api from '../../utils/axios';
import useDebounce from '../../hooks/useDebounce';
import { formatMillimes, formatTunisDate } from '../../utils/money';

const inputClass =
  'w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

/** Picker: customers who owe money first; the search also finds fully-paid customers. */
const DebtorPicker = ({ onPick, onClose }) => {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const debounced = useDebounce(q, 250);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = debounced.trim() ? { q: debounced.trim(), limit: 30 } : { owing: 'true', limit: 30 };
    api
      .get('/pos-customers', { params })
      .then((res) => active && setItems(res.data.data || []))
      .catch(() => active && toast.error('تعذر تحميل العملاء'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [debounced]);

  const addCustomer = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('الاسم ورقم الهاتف مطلوبان');
      return;
    }
    try {
      setSaving(true);
      const res = await api.post('/pos-customers', form);
      if (res.data.existed) toast(res.data.message, { icon: 'ℹ️' });
      onPick(res.data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'تعذر إضافة العميل');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="اختيار العميل"
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{adding ? 'إضافة عميل جديد' : 'بيع بالدين: اختر العميل'}</h3>
          <button type="button" onClick={onClose} className="btn-icon" aria-label="إغلاق">
            <X size={22} />
          </button>
        </div>

        {adding ? (
          <form onSubmit={addCustomer} className="space-y-4 p-4">
            <div>
              <label className="label">الاسم *</label>
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div>
              <label className="label">الهاتف *</label>
              <input className={inputClass} dir="ltr" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">ملاحظات</label>
              <input className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAdding(false)} className="btn-secondary flex-1 py-3 text-base">
                رجوع
              </button>
              <button type="submit" disabled={saving} className="btn-primary flex-1 py-3 text-base">
                {saving ? 'جاري الحفظ...' : 'حفظ واختيار'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="space-y-3 p-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input className={`${inputClass} pr-10`} placeholder="ابحث بالاسم أو الهاتف..." value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
              </div>
              <button type="button" onClick={() => setAdding(true)} className="btn-primary w-full py-3 text-base">
                <UserPlus size={20} />
                إضافة عميل جديد
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400">{q.trim() ? 'نتائج البحث (بما فيهم من سدد ديونه)' : 'العملاء الذين عليهم دين حالياً'}</p>
            </div>
            <ul className="flex-1 divide-y divide-gray-100 overflow-y-auto overscroll-contain border-t border-gray-100 dark:divide-gray-700 dark:border-gray-700">
              {loading && <li className="p-4 text-center text-gray-500">جاري التحميل...</li>}
              {!loading && items.length === 0 && <li className="p-6 text-center text-gray-500 dark:text-gray-400">لا يوجد عملاء</li>}
              {!loading &&
                items.map((c) => (
                  <li key={c._id}>
                    <button
                      type="button"
                      onClick={() => onPick(c)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right transition-colors hover:bg-gold-50 dark:hover:bg-gray-700"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-gray-900 dark:text-white">{c.name}</span>
                        <span className="block text-sm text-gray-500 dark:text-gray-400" dir="ltr">
                          {c.phone}
                        </span>
                      </span>
                      <span className={`shrink-0 font-bold tabular-nums ${c.balanceM > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {c.balanceM > 0 ? formatMillimes(c.balanceM) : 'لا دين'}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * "Non payé / بيع بالدين" block of the POS checkout.
 * value = { enabled, customer, paidNow }
 */
const CreditSalePanel = ({ value, onChange, total, disabled }) => {
  const [picking, setPicking] = useState(false);
  const { enabled, customer, paidNow } = value;
  const paidNowNumber = Number(paidNow) || 0;
  const newBalanceM = customer ? customer.balanceM + Math.round((total - paidNowNumber) * 1000) : 0;
  const overLimit = customer?.creditLimitM > 0 && newBalanceM > customer.creditLimitM;

  const toggle = (checked) => {
    onChange({ ...value, enabled: checked, ...(checked ? {} : { customer: null, paidNow: '' }) });
    if (checked && !customer) setPicking(true);
  };

  if (disabled) return null;

  return (
    <div className={`rounded-xl border-2 p-3 transition-colors ${enabled ? 'border-gold-500 bg-gold-50 dark:bg-gold-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
      <label className="flex cursor-pointer items-center gap-3 text-base font-bold text-gray-900 dark:text-white">
        <input type="checkbox" className="h-6 w-6 accent-[rgb(var(--gold-600))]" checked={enabled} onChange={(e) => toggle(e.target.checked)} />
        <Wallet size={20} className="text-gold-600" />
        بيع بالدين / Non payé
      </label>

      {enabled && (
        <div className="mt-3 space-y-3">
          {customer ? (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-white p-3 dark:bg-gray-700">
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900 dark:text-white">{customer.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400" dir="ltr">
                  {customer.phone}
                </p>
                {customer.balanceM > 0 && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    دين سابق: {formatMillimes(customer.balanceM)}
                    {customer.oldestUnpaidAt ? ` (منذ ${formatTunisDate(customer.oldestUnpaidAt)})` : ''}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setPicking(true)} className="btn-secondary shrink-0 !px-3 !py-2">
                تغيير
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setPicking(true)} className="btn-primary w-full py-3 text-base">
              اختر العميل
            </button>
          )}

          <div>
            <label className="label">المدفوع الآن (اختياري)</label>
            <input
              type="number"
              min="0"
              step="0.001"
              max={total}
              inputMode="decimal"
              className={inputClass}
              placeholder="0"
              value={paidNow}
              onChange={(e) => onChange({ ...value, paidNow: e.target.value })}
            />
            {paidNowNumber > total && <p className="mt-1 text-sm text-red-600">لا يمكن أن يتجاوز الإجمالي</p>}
          </div>

          {customer && (
            <div className="rounded-lg bg-white p-3 text-sm dark:bg-gray-700">
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>الباقي على هذا البيع</span>
                <span className="font-bold tabular-nums">{formatMillimes(Math.max(0, Math.round((total - paidNowNumber) * 1000)))}</span>
              </div>
              <div className="mt-1 flex justify-between font-bold text-gray-900 dark:text-white">
                <span>مجموع الدين الجديد</span>
                <span className="tabular-nums">{formatMillimes(newBalanceM)}</span>
              </div>
            </div>
          )}

          {overLimit && (
            <p className="flex items-center gap-2 rounded-lg bg-amber-100 p-2 text-sm font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              <AlertTriangle size={18} />
              تنبيه: الدين سيتجاوز السقف المحدد ({formatMillimes(customer.creditLimitM)})
            </p>
          )}
        </div>
      )}

      {picking && (
        <DebtorPicker
          onClose={() => setPicking(false)}
          onPick={(c) => {
            onChange({ ...value, enabled: true, customer: c });
            setPicking(false);
          }}
        />
      )}
    </div>
  );
};

export default CreditSalePanel;
