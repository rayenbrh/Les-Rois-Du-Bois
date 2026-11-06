import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import api from '../../utils/axios';
import useDebounce from '../../hooks/useDebounce';
import { formatMillimes, formatTunisDate, newIdempotencyKey } from '../../utils/money';
import { METHOD_LABELS } from './Timeline';

export const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
    <div
      className="max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl dark:bg-gray-800"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="إغلاق">
          <X size={22} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

/** Record a payment: oldest unpaid orders first, or the orders ticked here. */
export const PaymentModal = ({ customer, onClose, onDone }) => {
  const openOrders = (customer.orders || []).filter((o) => o.dueM > 0);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [chosen, setChosen] = useState([]);
  const [saving, setSaving] = useState(false);
  const keyRef = useRef(newIdempotencyKey());
  const owed = Math.max(0, customer.balanceM);

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    try {
      setSaving(true);
      await api.post(`/pos-customers/${customer._id}/payments`, { amount, method, note, orderIds: chosen, idempotencyKey: keyRef.current });
      toast.success('تم تسجيل الدفعة');
      onDone();
    } catch (error) {
      toast.error(error.response?.data?.message || 'تعذر تسجيل الدفعة');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="تسجيل دفعة" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          الدين الحالي: <b className="tabular-nums text-red-600">{formatMillimes(owed)}</b>
        </p>
        <div>
          <label className="label">المبلغ (TND) *</label>
          <div className="flex gap-2">
            <input type="number" min="0.001" step="0.001" inputMode="decimal" className="input-field" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
            <button type="button" className="btn-secondary shrink-0" onClick={() => setAmount(String(owed / 1000))}>
              كل الدين
            </button>
          </div>
        </div>
        <div>
          <label className="label">طريقة الدفع</label>
          <select className="input-field" value={method} onChange={(e) => setMethod(e.target.value)}>
            {['cash', 'card', 'bank_transfer', 'check'].map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        {openOrders.length > 1 && (
          <div>
            <p className="label">الطلبات المسددة (اختياري: بدون اختيار تُسدد الأقدم أولاً)</p>
            <ul className="space-y-1">
              {openOrders.map((o) => (
                <li key={o._id}>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={chosen.includes(o._id)}
                      onChange={(e) => setChosen(e.target.checked ? [...chosen, o._id] : chosen.filter((x) => x !== o._id))}
                    />
                    <bdi>{o.orderNumber}</bdi> · {formatTunisDate(o.createdAt)} · باقي <span className="tabular-nums">{formatMillimes(o.dueM)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <label className="label">ملاحظة</label>
          <input className="input-field" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button type="submit" disabled={saving} className="btn-primary w-full py-3 text-base">
          {saving ? 'جاري الحفظ...' : 'تسجيل الدفعة'}
        </button>
      </form>
    </Modal>
  );
};

export const ReverseModal = ({ entry, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const keyRef = useRef(newIdempotencyKey());
  const submit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post(`/pos-customers/entries/${entry._id}/reverse`, { reason, idempotencyKey: keyRef.current });
      toast.success('تم إلغاء الدفعة');
      onDone();
    } catch (error) {
      toast.error(error.response?.data?.message || 'تعذر الإلغاء');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="إلغاء دفعة" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-gray-700 dark:text-gray-300">
          ستُضاف عملية إلغاء بقيمة <b className="tabular-nums">{formatMillimes(-entry.amountM)}</b>. الدفعة الأصلية تبقى في السجل.
        </p>
        <div>
          <label className="label">السبب *</label>
          <input className="input-field" value={reason} onChange={(e) => setReason(e.target.value)} required autoFocus />
        </div>
        <button type="submit" disabled={saving || !reason.trim()} className="btn-danger w-full py-3 text-base">
          {saving ? 'جاري الحفظ...' : 'تأكيد الإلغاء'}
        </button>
      </form>
    </Modal>
  );
};

export const EditModal = ({ customer, onClose, onDone }) => {
  const [form, setForm] = useState({
    name: customer.name,
    phone: customer.phone,
    notes: customer.notes || '',
    creditLimit: customer.creditLimitM ? customer.creditLimitM / 1000 : '',
  });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.patch(`/pos-customers/${customer._id}`, { ...form, creditLimit: form.creditLimit || 0 });
      toast.success('تم حفظ التعديلات');
      onDone();
    } catch (error) {
      toast.error(error.response?.data?.message || 'تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  };
  const field = (key, label, props = {}) => (
    <div>
      <label className="label">{label}</label>
      <input className="input-field" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
    </div>
  );
  return (
    <Modal title="تعديل بيانات العميل" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {field('name', 'الاسم *', { required: true })}
        {field('phone', 'الهاتف *', { required: true, dir: 'ltr', inputMode: 'tel' })}
        {field('notes', 'ملاحظات')}
        {field('creditLimit', 'سقف الدين (TND، 0 = بدون سقف)', { type: 'number', min: 0, step: '0.001', inputMode: 'decimal' })}
        <p className="text-xs text-gray-500 dark:text-gray-400">القيم القديمة تبقى محفوظة في السجل.</p>
        <button type="submit" disabled={saving} className="btn-primary w-full py-3 text-base">
          {saving ? 'جاري الحفظ...' : 'حفظ'}
        </button>
      </form>
    </Modal>
  );
};

/** Merge this account INTO another one (the other one keeps everything). */
export const MergeModal = ({ customer, onClose, onDone }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [target, setTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const debounced = useDebounce(q, 300);

  useEffect(() => {
    if (!debounced.trim()) return setResults([]);
    api.get('/pos-customers', { params: { q: debounced, limit: 10 } }).then((res) => setResults(res.data.data.filter((c) => c._id !== customer._id)));
    return undefined;
  }, [debounced, customer._id]);

  const submit = async () => {
    try {
      setSaving(true);
      await api.post(`/pos-customers/${customer._id}/merge`, { intoId: target._id });
      toast.success('تم دمج الحسابين');
      onDone(target._id);
    } catch (error) {
      toast.error(error.response?.data?.message || 'تعذر الدمج');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="دمج مع حساب آخر" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          كل طلبات ودفعات <b>{customer.name}</b> تنتقل إلى الحساب المختار، ويبقى السجل كاملاً.
        </p>
        <input className="input-field" placeholder="ابحث عن الحساب الآخر..." value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {results.map((c) => (
            <li key={c._id}>
              <button
                type="button"
                onClick={() => setTarget(c)}
                className={`flex w-full justify-between p-3 text-right ${target?._id === c._id ? 'bg-gold-50 dark:bg-gray-700' : ''}`}
              >
                <span>
                  {c.name} <span className="text-sm text-gray-500" dir="ltr">{c.phone}</span>
                </span>
                <span className="tabular-nums">{formatMillimes(c.balanceM)}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" disabled={!target || saving} onClick={submit} className="btn-primary w-full py-3 text-base">
          {saving ? 'جاري الدمج...' : target ? `دمج في حساب ${target.name}` : 'اختر حساباً'}
        </button>
      </div>
    </Modal>
  );
};
