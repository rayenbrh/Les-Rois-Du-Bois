import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, Banknote, Pencil, GitMerge, Archive, FileDown } from 'lucide-react';
import api from '../../utils/axios';
import { formatMillimes, formatTunisDate } from '../../utils/money';
import Timeline from './Timeline';
import { PaymentModal, ReverseModal, EditModal, MergeModal, Modal } from './AccountModals';

const today = () => new Date().toISOString().slice(0, 10);

/** Admin: one customer's account, total owed and full timeline. */
const CustomerAccount = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState({ page: 1, pages: 1 });
  const [modal, setModal] = useState(null); // 'payment' | 'edit' | 'merge' | 'statement' | { reverse: entry }
  const [range, setRange] = useState({ from: '', to: today() });

  const load = useCallback(
    async (p = 1) => {
      try {
        const [c, t] = await Promise.all([api.get(`/pos-customers/${id}`), api.get(`/pos-customers/${id}/timeline`, { params: { page: p } })]);
        setCustomer(c.data.data);
        setEntries((prev) => (p === 1 ? t.data.data : [...prev, ...t.data.data]));
        setPage(t.data.pagination);
      } catch (error) {
        toast.error(error.response?.data?.message || 'تعذر تحميل الحساب');
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
    if (!window.confirm(customer.archived ? 'إعادة تفعيل هذا العميل؟' : 'أرشفة هذا العميل؟ (لا يُحذف أي شيء)')) return;
    try {
      await api.post(`/pos-customers/${id}/archive`, { archived: !customer.archived });
      toast.success('تم');
      load(1);
    } catch (error) {
      toast.error(error.response?.data?.message || 'تعذر الأرشفة');
    }
  };

  const downloadStatement = async () => {
    try {
      const res = await api.get(`/pos-customers/${id}/statement`, { params: range, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `releve-${customer.name}-${range.to}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setModal(null);
    } catch {
      toast.error('تعذر إنشاء كشف الحساب');
    }
  };

  if (!customer) return <div className="p-10 text-center text-gray-500">جاري التحميل...</div>;

  const owed = customer.balanceM;

  return (
    <div className="space-y-6">
      <Link to="/admin/customer-debts" className="btn-ghost !px-2">
        <ArrowRight size={18} /> ديون العملاء
      </Link>

      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="page-title">
              {customer.name} {customer.archived && <span className="badge bg-gray-100 text-base text-gray-600 dark:bg-gray-700 dark:text-gray-300">مؤرشف</span>}
            </h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400" dir="ltr">
              {customer.phone}
            </p>
            {customer.notes && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{customer.notes}</p>}
            {customer.oldestUnpaidAt && <p className="mt-1 text-sm text-gray-500">أقدم دين: {formatTunisDate(customer.oldestUnpaidAt)}</p>}
          </div>
          <div className="text-left">
            <p className="text-sm text-gray-500 dark:text-gray-400">{owed < 0 ? 'رصيد دائن للعميل' : 'مجموع الدين'}</p>
            <p className={`text-3xl font-extrabold tabular-nums ${owed > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {formatMillimes(Math.abs(owed))}
            </p>
            {customer.creditLimitM > 0 && <p className="text-sm text-gray-500">السقف: {formatMillimes(customer.creditLimitM)}</p>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <button type="button" onClick={() => setModal('payment')} disabled={owed <= 0} className="btn-primary col-span-2 py-3 text-base sm:col-span-1">
            <Banknote size={20} /> تسجيل دفعة
          </button>
          <button type="button" onClick={() => setModal('statement')} className="btn-secondary py-3">
            <FileDown size={18} /> كشف حساب
          </button>
          <button type="button" onClick={() => setModal('edit')} className="btn-secondary py-3">
            <Pencil size={18} /> تعديل
          </button>
          <button type="button" onClick={() => setModal('merge')} className="btn-secondary py-3">
            <GitMerge size={18} /> دمج
          </button>
          <button type="button" onClick={archive} className="btn-secondary py-3">
            <Archive size={18} /> {customer.archived ? 'إلغاء الأرشفة' : 'أرشفة'}
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="section-title">سجل العمليات</h2>
        <Timeline entries={entries} onReverse={(entry) => setModal({ reverse: entry })} />
        {page.page < page.pages && (
          <button type="button" className="btn-secondary w-full" onClick={() => load(page.page + 1)}>
            عرض المزيد
          </button>
        )}
      </section>

      {modal === 'payment' && <PaymentModal customer={customer} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'edit' && <EditModal customer={customer} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'merge' && <MergeModal customer={customer} onClose={() => setModal(null)} onDone={(intoId) => navigate(`/admin/customer-debts/${intoId}`)} />}
      {modal?.reverse && <ReverseModal entry={modal.reverse} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'statement' && (
        <Modal title="كشف حساب (PDF)" onClose={() => setModal(null)}>
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

export default CustomerAccount;
