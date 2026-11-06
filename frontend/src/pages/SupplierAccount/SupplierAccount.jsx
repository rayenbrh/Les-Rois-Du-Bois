import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, PackagePlus, Banknote, GitMerge, Archive, FileDown } from 'lucide-react';
import api from '../../utils/axios';
import { formatMillimes } from '../../utils/money';
import { Modal } from '../CustomerDebts/AccountModals';
import SupplierTimeline from './SupplierTimeline';
import DeliveryModal from './DeliveryModal';
import { MoneyModal, ReverseModal, MergeModal } from './SupplierModals';
import { balanceWords, balanceColor } from './balance';

const today = () => new Date().toISOString().slice(0, 10);

/** Admin: one supplier's account ("حساب المورد"): balance, buttons and full timeline. */
const SupplierAccount = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState(null);
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState({ page: 1, pages: 1 });
  const [modal, setModal] = useState(null); // 'delivery' | 'money' | 'merge' | 'statement' | { reverse }
  const [range, setRange] = useState({ from: '', to: today() });

  const load = useCallback(
    async (p = 1) => {
      try {
        const [s, t] = await Promise.all([api.get(`/suppliers/${id}/account`), api.get(`/suppliers/${id}/timeline`, { params: { page: p } })]);
        setSupplier(s.data.data);
        setEntries((prev) => (p === 1 ? t.data.data : [...prev, ...t.data.data]));
        setPage(t.data.pagination);
      } catch (error) {
        toast.error(error.response?.data?.message || 'تعذر تحميل حساب المورد');
      }
    },
    [id]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const done = () => {
    setModal(null);
    load(1);
  };

  const archive = async () => {
    if (!window.confirm(supplier.archived ? 'إعادة تفعيل هذا المورد؟' : 'أرشفة هذا المورد؟ (لا يُحذف أي شيء)')) return;
    try {
      await api.post(`/suppliers/${supplier._id}/archive`, { archived: !supplier.archived });
      toast.success('تم');
      load(1);
    } catch (error) {
      toast.error(error.response?.data?.message || 'تعذر الأرشفة');
    }
  };

  const downloadStatement = async () => {
    try {
      const res = await api.get(`/suppliers/${supplier._id}/statement`, { params: range, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `releve-fournisseur-${supplier.code}-${range.to}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setModal(null);
    } catch (error) {
      toast.error(error.response?.status === 501 ? 'كشف حساب المورد غير جاهز بعد' : 'تعذر إنشاء كشف الحساب');
    }
  };

  if (!supplier) return <div className="p-10 text-center text-gray-500">جاري التحميل...</div>;

  const balance = supplier.balanceM || 0;

  return (
    <div className="space-y-6">
      <Link to="/admin/suppliers" className="btn-ghost !px-2">
        <ArrowRight size={18} /> الموردون
      </Link>

      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="page-title">
              {supplier.name}{' '}
              {supplier.archived && <span className="badge bg-gray-100 text-base text-gray-600 dark:bg-gray-700 dark:text-gray-300">مؤرشف</span>}
            </h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              {supplier.code}
              {supplier.phone && (
                <>
                  {' · '}
                  <span dir="ltr">{supplier.phone}</span>
                </>
              )}
            </p>
          </div>
          <div className="text-left">
            <p className={`text-3xl font-extrabold tabular-nums ${balanceColor(balance)}`}>{formatMillimes(Math.abs(balance))}</p>
          </div>
        </div>
        <p className={`mt-3 rounded-xl bg-gray-50 p-3 text-lg font-semibold dark:bg-gray-900/40 ${balanceColor(balance)}`}>{balanceWords(balance)}</p>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <button type="button" onClick={() => setModal('delivery')} disabled={supplier.archived} className="btn-primary py-3 text-base">
            <PackagePlus size={20} /> تسجيل توريد
          </button>
          <button type="button" onClick={() => setModal('money')} className="btn-primary py-3 text-base">
            <Banknote size={20} /> تسجيل مبلغ
          </button>
          <button type="button" onClick={() => setModal('statement')} className="btn-secondary py-3">
            <FileDown size={18} /> Relevé
          </button>
          <button type="button" onClick={() => setModal('merge')} className="btn-secondary py-3">
            <GitMerge size={18} /> دمج
          </button>
          <button type="button" onClick={archive} className="btn-secondary col-span-2 py-3 sm:col-span-1">
            <Archive size={18} /> {supplier.archived ? 'إلغاء الأرشفة' : 'أرشفة'}
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="section-title">سجل العمليات</h2>
        <SupplierTimeline
          entries={entries}
          onReverseMoney={(entry) => setModal({ reverse: { kind: 'money', entry } })}
          onReverseDelivery={(delivery) => setModal({ reverse: { kind: 'delivery', delivery } })}
        />
        {page.page < page.pages && (
          <button type="button" className="btn-secondary w-full" onClick={() => load(page.page + 1)}>
            عرض المزيد
          </button>
        )}
      </section>

      {modal === 'delivery' && <DeliveryModal supplier={supplier} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'money' && <MoneyModal supplier={supplier} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'merge' && <MergeModal supplier={supplier} onClose={() => setModal(null)} onDone={(intoId) => navigate(`/admin/suppliers/${intoId}`)} />}
      {modal?.reverse && <ReverseModal target={modal.reverse} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'statement' && (
        <Modal title="كشف حساب المورد (Relevé PDF)" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="label">من (فارغ = منذ البداية)</label>
              <input type="date" className="input-field" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            </div>
            <div>
              <label className="label">إلى</label>
              <input type="date" className="input-field" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            </div>
            <button type="button" onClick={downloadStatement} className="btn-primary w-full py-3 text-base">
              <FileDown size={20} /> تحميل
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SupplierAccount;
