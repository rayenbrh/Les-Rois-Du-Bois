import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { Truck, Plus, Edit, Trash2, Search, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import SupplierModal from '../../components/SupplierModal';
import useDebounce from '../../hooks/useDebounce';
import { formatMillimes } from '../../utils/money';
import { balanceShort, balanceColor } from '../SupplierAccount/balance';

const FILTERS = [
  { value: '', label: 'الكل' },
  { value: 'owes_us', label: 'مدينون لنا' },
  { value: 'we_owe', label: 'نحن مدينون لهم' },
];

const Balance = ({ value }) => (
  <div className={balanceColor(value)}>
    <p className="font-bold tabular-nums">{formatMillimes(Math.abs(value || 0))}</p>
    <p className="text-xs">{balanceShort(value || 0)}</p>
  </div>
);

const SuppliersList = () => {
  const [q, setQ] = useState('');
  const [balance, setBalance] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const debounced = useDebounce(q, 300);

  useEffect(() => setPage(1), [debounced, balance, showArchived]);

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/suppliers', {
        params: { q: debounced, balance: balance || undefined, archived: showArchived ? 'true' : undefined, page, limit: 20 },
      });
      setData({ items: res.data.data || [], ...res.data.pagination });
    } catch {
      toast.error('حدث خطأ أثناء جلب الموردين');
    } finally {
      setLoading(false);
    }
  }, [debounced, balance, showArchived, page]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleDelete = async (supplier) => {
    if (!window.confirm(`حذف المورد ${supplier.name}؟ (إذا كان له سجل عمليات سيُؤرشف بدل الحذف)`)) return;
    try {
      const res = await api.delete(`/suppliers/${supplier._id}`);
      toast.success(res.data.message || 'تم');
      fetchSuppliers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'حدث خطأ أثناء حذف المورد');
    }
  };

  const runCheck = async () => {
    try {
      setChecking(true);
      const res = await api.get('/suppliers/accounts/check');
      const { problems, checkedSuppliers } = res.data.data;
      if (problems.length === 0) toast.success(`تم فحص ${checkedSuppliers} مورد: كل الأرصدة صحيحة`);
      else toast.error(`وُجدت ${problems.length} مشكلة في أرصدة الموردين`, { duration: 8000 });
    } catch {
      toast.error('تعذر فحص الأرصدة');
    } finally {
      setChecking(false);
    }
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
    fetchSuppliers();
  };

  const actions = (supplier) => (
    <div className="flex gap-1">
      <button type="button" onClick={() => handleEdit(supplier)} className="btn-icon text-gold-600" aria-label="تعديل">
        <Edit size={18} />
      </button>
      <button type="button" onClick={() => handleDelete(supplier)} className="btn-icon text-gold-600" aria-label="حذف">
        <Trash2 size={18} />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">الموردون</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">الحسابات: من مدين لمن</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={runCheck} disabled={checking} className="btn-secondary">
            <ShieldCheck size={18} /> {checking ? 'جاري الفحص...' : 'فحص الأرصدة'}
          </button>
          <button type="button" onClick={() => setIsModalOpen(true)} className="btn-primary">
            <Plus size={20} /> إضافة مورد
          </button>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input className="input-field pr-10" placeholder="بحث بالاسم أو الكود أو الهاتف..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" onClick={() => setBalance(f.value)} className={balance === f.value ? 'btn-primary' : 'btn-secondary'}>
              {f.label}
            </button>
          ))}
          <label className="mr-auto flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" className="h-5 w-5" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            إظهار المؤرشفين
          </label>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-gold-600"></div>
          </div>
        ) : data.items.length === 0 ? (
          <div className="py-12 text-center">
            <Truck className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-gray-500">لا يوجد موردون</p>
          </div>
        ) : (
          <>
            {/* Phone: cards */}
            <ul className="space-y-2 sm:hidden">
              {data.items.map((s) => (
                <li key={s._id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                  <Link to={`/admin/suppliers/${s._id}`} className="min-w-0 flex-1">
                    <p className="truncate font-bold text-gray-900 dark:text-white">
                      {s.name} {s.archived && <span className="text-xs text-gray-500">(مؤرشف)</span>}
                    </p>
                    <p className="text-sm text-gray-500">{s.code}</p>
                  </Link>
                  <Link to={`/admin/suppliers/${s._id}`} className="text-left">
                    <Balance value={s.balanceM} />
                  </Link>
                  {actions(s)}
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-right text-sm font-medium">الاسم</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">الكود</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">الهاتف</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">الرصيد</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((s) => (
                    <tr key={s._id} className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 font-medium">
                        <Link to={`/admin/suppliers/${s._id}`} className="text-gold-700 hover:underline dark:text-gold-400">
                          {s.name}
                        </Link>
                        {s.archived && <span className="mr-2 text-xs text-gray-500">(مؤرشف)</span>}
                      </td>
                      <td className="px-4 py-3">{s.code}</td>
                      <td className="px-4 py-3" dir="ltr">
                        {s.phone || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Balance value={s.balanceM} />
                      </td>
                      <td className="px-4 py-3">{actions(s)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.pages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="السابق">
                  <ChevronRight size={18} />
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {page} / {data.pages}
                </span>
                <button type="button" className="btn-secondary" disabled={page >= data.pages} onClick={() => setPage(page + 1)} aria-label="التالي">
                  <ChevronLeft size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {isModalOpen && <SupplierModal supplier={editingSupplier} onClose={handleCloseModal} />}
    </div>
  );
};

export default SuppliersList;
