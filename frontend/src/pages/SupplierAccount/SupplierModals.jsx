import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/axios';
import useDebounce from '../../hooks/useDebounce';
import { formatMillimes, formatTunisDate, newIdempotencyKey } from '../../utils/money';
import { Modal } from '../CustomerDebts/AccountModals';
import { MONEY_TYPES, METHOD_LABELS, balanceWords } from './balance';

const today = () => new Date().toISOString().slice(0, 10);

/** We gave money / supplier paid us / goods returned, linked to a delivery or with a reason. */
export const MoneyModal = ({ supplier, onClose, onDone }) => {
  const [type, setType] = useState('advance_given');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [deliveryId, setDeliveryId] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const keyRef = useRef(newIdempotencyKey());
  const deliveries = (supplier.deliveries || []).filter((d) => !d.reversedBy);
  const current = MONEY_TYPES.find((t) => t.value === type);

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    try {
      setSaving(true);
      await api.post(`/suppliers/${supplier._id}/movements`, {
        type,
        amount,
        method: type === 'goods_returned' ? undefined : method,
        deliveryId: deliveryId || undefined,
        reason,
        date,
        idempotencyKey: keyRef.current,
      });
      toast.success('تم التسجيل');
      onDone();
    } catch (error) {
      toast.error(error.response?.data?.message || 'تعذر التسجيل');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="تسجيل مبلغ" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{balanceWords(supplier.balanceM)}</p>
        <div className="grid gap-2">
          {MONEY_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`rounded-xl border-2 p-3 text-right font-semibold transition-colors ${
                type === t.value
                  ? 'border-gold-500 bg-gold-50 text-gold-800 dark:bg-gold-900/20 dark:text-gold-300'
                  : 'border-gray-200 text-gray-800 dark:border-gray-700 dark:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{current.hint}</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">المبلغ (TND) *</label>
            <input type="number" min="0.001" step="0.001" inputMode="decimal" className="input-field" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div>
            <label className="label">التاريخ</label>
            <input type="date" className="input-field" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        {type !== 'goods_returned' && (
          <div>
            <label className="label">طريقة الدفع</label>
            <select className="input-field" value={method} onChange={(e) => setMethod(e.target.value)}>
              {Object.entries(METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label">التوريد المرتبط</label>
          <select className="input-field" value={deliveryId} onChange={(e) => setDeliveryId(e.target.value)}>
            <option value="">بدون</option>
            {deliveries.map((d) => (
              <option key={d._id} value={d._id}>
                {d.poNumber} · {formatTunisDate(d.deliveredAt)} · {formatMillimes(d.totalM)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">السبب {deliveryId ? '' : '*'}</label>
          <input className="input-field" value={reason} onChange={(e) => setReason(e.target.value)} required={!deliveryId} />
        </div>
        <button type="submit" disabled={saving} className="btn-primary w-full py-3 text-base">
          {saving ? 'جاري الحفظ...' : 'تسجيل'}
        </button>
      </form>
    </Modal>
  );
};

/** Reverse a money movement or a delivery (with the stock) — a reason is always required. */
export const ReverseModal = ({ target, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const keyRef = useRef(newIdempotencyKey());
  const isDelivery = target.kind === 'delivery';
  const url = isDelivery ? `/suppliers/deliveries/${target.delivery._id}/reverse` : `/suppliers/entries/${target.entry._id}/reverse`;
  const amountM = isDelivery ? target.delivery.totalM : Math.abs(target.entry.amountM);

  const submit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post(url, { reason, idempotencyKey: keyRef.current });
      toast.success('تم الإلغاء');
      onDone();
    } catch (error) {
      toast.error(error.response?.data?.message || 'تعذر الإلغاء', { duration: 8000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isDelivery ? 'إلغاء توريد' : 'إلغاء عملية'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-gray-700 dark:text-gray-300">
          ستُضاف عملية معاكسة بقيمة <b className="tabular-nums">{formatMillimes(amountM)}</b>. العملية الأصلية تبقى في السجل.
          {isDelivery && target.delivery.stockAdded && ' الكميات ستُسحب من المخزون.'}
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

/** Merge this supplier INTO another one (the other one keeps everything). */
export const MergeModal = ({ supplier, onClose, onDone }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [target, setTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const debounced = useDebounce(q, 300);

  useEffect(() => {
    let active = true;
    if (!debounced.trim()) {
      setResults([]);
      return undefined;
    }
    api
      .get('/suppliers', { params: { q: debounced, page: 1, limit: 10 } })
      .then((res) => active && setResults(res.data.data.filter((s) => s._id !== supplier._id)))
      .catch(() => active && setResults([]));
    return () => {
      active = false;
    };
  }, [debounced, supplier._id]);

  const submit = async () => {
    try {
      setSaving(true);
      await api.post(`/suppliers/${supplier._id}/merge`, { intoId: target._id });
      toast.success('تم دمج الموردين');
      onDone(target._id);
    } catch (error) {
      toast.error(error.response?.data?.message || 'تعذر الدمج');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="دمج مع مورد آخر" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          كل توريدات ورصيد <b>{supplier.name}</b> تنتقل إلى المورد المختار، ويبقى السجل كاملاً.
        </p>
        <input className="input-field" placeholder="ابحث عن المورد الآخر..." value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {results.map((s) => (
            <li key={s._id}>
              <button
                type="button"
                onClick={() => setTarget(s)}
                className={`flex w-full justify-between p-3 text-right ${target?._id === s._id ? 'bg-gold-50 dark:bg-gray-700' : ''}`}
              >
                <span>
                  {s.name} <span className="text-sm text-gray-500">{s.code}</span>
                </span>
                <span className="tabular-nums" dir="ltr">{formatMillimes(s.balanceM)}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" disabled={!target || saving} onClick={submit} className="btn-primary w-full py-3 text-base">
          {saving ? 'جاري الدمج...' : target ? `دمج في ${target.name}` : 'اختر مورداً'}
        </button>
      </div>
    </Modal>
  );
};
