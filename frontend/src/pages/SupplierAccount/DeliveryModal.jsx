import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2, Plus, Camera } from 'lucide-react';
import api from '../../utils/axios';
import useDebounce from '../../hooks/useDebounce';
import { formatMillimes, newIdempotencyKey } from '../../utils/money';
import { Modal } from '../CustomerDebts/AccountModals';

const today = () => new Date().toISOString().slice(0, 10);
const lineTotalM = (l) => Math.round((Number(l.unitCost) || 0) * 1000) * (Number(l.quantity) || 0);

/** Product search; picking a product adds a line (with its option picker when it has options). */
const ProductSearch = ({ onPick }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const debounced = useDebounce(q, 300);

  useEffect(() => {
    let active = true;
    if (!debounced.trim()) {
      setResults([]);
      return undefined;
    }
    api
      .get('/products', { params: { search: debounced } })
      .then((res) => active && setResults((res.data.data || []).slice(0, 10)))
      .catch(() => active && setResults([]));
    return () => {
      active = false;
    };
  }, [debounced]);

  return (
    <div>
      <input className="input-field" placeholder="ابحث عن منتج لإضافته..." value={q} onChange={(e) => setQ(e.target.value)} />
      {results.length > 0 && (
        <ul className="mt-1 max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {results.map((p) => (
            <li key={p._id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 p-3 text-right hover:bg-gold-50 dark:hover:bg-gray-700"
                onClick={() => {
                  onPick(p);
                  setQ('');
                  setResults([]);
                }}
              >
                <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                <span className="text-sm text-gray-500">تكلفة: {Number(p.cost || 0).toFixed(3)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const DeliveryLine = ({ line, onChange, onRemove }) => (
  <li className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
    <div className="flex items-start justify-between gap-2">
      <p className="font-semibold text-gray-900 dark:text-white">{line.product.name}</p>
      <button type="button" className="btn-icon text-red-600" onClick={onRemove} aria-label="حذف السطر">
        <Trash2 size={18} />
      </button>
    </div>
    {line.product.variants?.length > 0 && (
      <div className="mt-2">
        <label className="label">{line.product.variantName || 'الخيار'} *</label>
        <select className="input-field" value={line.variant} onChange={(e) => onChange({ variant: e.target.value })} required>
          <option value="">اختر...</option>
          {line.product.variants.map((v) => (
            <option key={v._id || v.value} value={v.value}>
              {v.value} (المخزون: {v.stock})
            </option>
          ))}
        </select>
      </div>
    )}
    <div className="mt-2 grid grid-cols-2 gap-2">
      <div>
        <label className="label">الكمية *</label>
        <input type="number" min="1" step="1" inputMode="numeric" className="input-field" value={line.quantity} onChange={(e) => onChange({ quantity: e.target.value })} required />
      </div>
      <div>
        <label className="label">سعر الوحدة (TND) *</label>
        <input type="number" min="0" step="0.001" inputMode="decimal" className="input-field" value={line.unitCost} onChange={(e) => onChange({ unitCost: e.target.value })} required />
      </div>
    </div>
    <p className="mt-1 text-left text-sm text-gray-600 tabular-nums dark:text-gray-400">{formatMillimes(lineTotalM(line))}</p>
  </li>
);

/** After a delivery: ask (never silently) whether to update the products' cost price. */
const CostQuestion = ({ changes, deliveryId, onClose }) => {
  const [chosen, setChosen] = useState(changes.map((c) => c.productId));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    try {
      setSaving(true);
      const updates = changes.filter((c) => chosen.includes(c.productId)).map((c) => ({ productId: c.productId, cost: c.deliveryCost }));
      await api.post('/suppliers/cost-prices', { updates, deliveryId });
      toast.success('تم تحديث سعر الشراء');
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'تعذر تحديث الأسعار');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-gray-700 dark:text-gray-300">سعر الشراء في هذا التوريد يختلف عن سعر الشراء المسجل. هل تريد تحديثه؟</p>
      <ul className="space-y-2">
        {changes.map((c) => (
          <li key={c.productId}>
            <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={chosen.includes(c.productId)}
                onChange={(e) => setChosen(e.target.checked ? [...chosen, c.productId] : chosen.filter((x) => x !== c.productId))}
              />
              <span className="flex-1 text-gray-900 dark:text-white">{c.productName}</span>
              <span className="text-sm tabular-nums text-gray-600 dark:text-gray-400" dir="ltr">
                {c.currentCost.toFixed(3)} → {c.deliveryCost.toFixed(3)}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-primary py-3" disabled={saving || chosen.length === 0} onClick={save}>
          {saving ? 'جاري الحفظ...' : 'تحديث المختار'}
        </button>
        <button type="button" className="btn-secondary py-3" onClick={onClose}>
          لا، اتركه كما هو
        </button>
      </div>
    </div>
  );
};

/** Record a delivery: lines, receipt photo, add-to-stock (on by default), duplicate warning, cost question. */
const DeliveryModal = ({ supplier, onClose, onDone }) => {
  const [lines, setLines] = useState([]);
  const [notes, setNotes] = useState('');
  const [deliveredAt, setDeliveredAt] = useState(today());
  const [addToStock, setAddToStock] = useState(true);
  const [receipt, setReceipt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState(null);
  const [costStep, setCostStep] = useState(null); // { changes, deliveryId }
  const keyRef = useRef(newIdempotencyKey());

  const totalM = lines.reduce((s, l) => s + lineTotalM(l), 0);
  const addProduct = (product) =>
    setLines((prev) => [...prev, { id: newIdempotencyKey(), product, variant: '', quantity: 1, unitCost: product.cost || '' }]);
  const updateLine = (id, patch) => setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const uploadReceipt = async (file) => {
    if (!file) return;
    const form = new FormData();
    form.append('receipt', file);
    try {
      setUploading(true);
      const res = await api.post('/uploads/supplier-delivery/receipt', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setReceipt(res.data.data.path);
      toast.success('تم رفع صورة الوصل');
    } catch (error) {
      toast.error(error.response?.data?.message || 'تعذر رفع الصورة');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (confirmDuplicate = false) => {
    if (saving) return;
    try {
      setSaving(true);
      const items = lines.map((l) => ({
        productId: l.product._id,
        variant: l.variant ? { value: l.variant } : undefined,
        quantity: Number(l.quantity),
        unitCost: l.unitCost,
      }));
      const res = await api.post(`/suppliers/${supplier._id}/deliveries`, {
        items,
        notes,
        deliveredAt,
        addToStock,
        receiptImage: receipt,
        confirmDuplicate,
        idempotencyKey: keyRef.current,
      });
      toast.success('تم تسجيل التوريد');
      if (res.data.costChanges?.length) setCostStep({ changes: res.data.costChanges, deliveryId: res.data.data._id });
      else onDone();
    } catch (error) {
      if (error.response?.data?.code === 'DUPLICATE_WARNING') setDuplicate(error.response.data.duplicateWarning);
      else toast.error(error.response?.data?.message || 'تعذر تسجيل التوريد');
    } finally {
      setSaving(false);
    }
  };

  if (costStep) {
    return (
      <Modal title="تحديث سعر الشراء؟" onClose={onDone}>
        <CostQuestion changes={costStep.changes} deliveryId={costStep.deliveryId} onClose={onDone} />
      </Modal>
    );
  }

  if (duplicate) {
    return (
      <Modal title="تنبيه: توريد مشابه" onClose={() => setDuplicate(null)}>
        <div className="space-y-4">
          <p className="rounded-xl bg-amber-50 p-3 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">{duplicate.message}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-primary py-3" disabled={saving} onClick={() => submit(true)}>
              نعم، سجّله
            </button>
            <button type="button" className="btn-secondary py-3" onClick={() => setDuplicate(null)}>
              لا، رجوع
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`توريد من ${supplier.name}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
      >
        <ProductSearch onPick={addProduct} />
        {lines.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Plus size={16} /> أضف المنتجات التي وصلت
          </p>
        ) : (
          <ul className="space-y-2">
            {lines.map((l) => (
              <DeliveryLine key={l.id} line={l} onChange={(patch) => updateLine(l.id, patch)} onRemove={() => setLines((prev) => prev.filter((x) => x.id !== l.id))} />
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">تاريخ التوريد</label>
            <input type="date" className="input-field" value={deliveredAt} max={today()} onChange={(e) => setDeliveredAt(e.target.value)} />
          </div>
          <div>
            <label className="label">صورة الوصل</label>
            <label className="btn-secondary w-full cursor-pointer py-2.5">
              <Camera size={18} /> {uploading ? 'جاري الرفع...' : receipt ? 'تم ✓' : 'تصوير / اختيار'}
              <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => uploadReceipt(e.target.files?.[0])} />
            </label>
          </div>
        </div>
        <div>
          <label className="label">ملاحظات</label>
          <input className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <label className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 text-gray-800 dark:bg-gray-900/40 dark:text-gray-200">
          <input type="checkbox" className="h-5 w-5" checked={addToStock} onChange={(e) => setAddToStock(e.target.checked)} />
          إضافة الكميات إلى المخزون
        </label>
        <p className="text-lg font-bold text-gray-900 dark:text-white">
          المجموع: <span className="tabular-nums">{formatMillimes(totalM)}</span>
        </p>
        <button type="submit" disabled={saving || uploading || lines.length === 0} className="btn-primary w-full py-3 text-base">
          {saving ? 'جاري الحفظ...' : 'تسجيل التوريد'}
        </button>
      </form>
    </Modal>
  );
};

export default DeliveryModal;
