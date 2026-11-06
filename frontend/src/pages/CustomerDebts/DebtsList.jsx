import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Search, Wallet, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../utils/axios';
import useDebounce from '../../hooks/useDebounce';
import { formatMillimes, formatTunisDate, formatTunisDateTime } from '../../utils/money';

const SORTS = [
  { value: 'recent', label: 'آخر نشاط' },
  { value: 'balance', label: 'أكبر دين' },
  { value: 'oldest', label: 'أقدم دين' },
  { value: 'name', label: 'الاسم' },
];

/** Admin: customers who owe money (or everyone with the toggle). */
const DebtsList = () => {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const debounced = useDebounce(q, 300);

  useEffect(() => setPage(1), [debounced, sort, showAll]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get('/pos-customers', { params: { q: debounced, sort, owing: showAll ? undefined : 'true', page, limit: 20 } })
      .then((res) => active && setData({ items: res.data.data, ...res.data.pagination }))
      .catch(() => active && toast.error('تعذر تحميل الديون'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [debounced, sort, showAll, page]);

  const runCheck = async () => {
    try {
      setChecking(true);
      const res = await api.get('/pos-customers/check');
      const { problems, checkedCustomers } = res.data.data;
      if (problems.length === 0) toast.success(`تم فحص ${checkedCustomers} حساب: كل الأرصدة صحيحة`);
      else toast.error(`وُجدت ${problems.length} مشكلة في الأرصدة`, { duration: 8000 });
    } catch {
      toast.error('تعذر فحص الأرصدة');
    } finally {
      setChecking(false);
    }
  };

  const totalOwed = data.items.reduce((s, c) => s + Math.max(0, c.balanceM), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Wallet className="text-gold-600" /> ديون العملاء
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">عملاء نقطة البيع الذين اشتروا بالدين</p>
        </div>
        <button type="button" onClick={runCheck} disabled={checking} className="btn-secondary">
          <ShieldCheck size={18} />
          {checking ? 'جاري الفحص...' : 'فحص الأرصدة'}
        </button>
      </div>

      <div className="card space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative md:col-span-2">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input className="input-field pr-10" placeholder="ابحث بالاسم أو الهاتف..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input-field" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                ترتيب: {s.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" className="h-5 w-5" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          إظهار العملاء الذين سددوا ديونهم
        </label>
      </div>

      <div className="card !p-0">
        {loading ? (
          <div className="p-10 text-center text-gray-500">جاري التحميل...</div>
        ) : data.items.length === 0 ? (
          <div className="p-10 text-center text-gray-500 dark:text-gray-400">لا يوجد عملاء</div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {data.items.map((c) => (
              <li key={c._id}>
                <Link
                  to={`/admin/customer-debts/${c._id}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white">
                      {c.name} {c.archived && <span className="badge bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">مؤرشف</span>}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400" dir="ltr">
                      {c.phone}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <p>آخر نشاط: {formatTunisDateTime(c.lastActivityAt)}</p>
                    {c.oldestUnpaidAt && <p>أقدم دين: {formatTunisDate(c.oldestUnpaidAt)}</p>}
                  </div>
                  <p
                    className={`text-lg font-bold tabular-nums ${
                      c.balanceM > 0 ? 'text-red-600 dark:text-red-400' : c.balanceM < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500'
                    }`}
                  >
                    {c.balanceM < 0 ? `رصيد: ${formatMillimes(-c.balanceM)}` : formatMillimes(c.balanceM)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600 dark:text-gray-400">
        <span>
          {data.total} عميل · مجموع ديون هذه الصفحة: <b className="tabular-nums">{formatMillimes(totalOwed)}</b>
        </span>
        {data.pages > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" className="btn-icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="السابق">
              <ChevronRight />
            </button>
            <span>
              {page} / {data.pages}
            </span>
            <button type="button" className="btn-icon" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} aria-label="التالي">
              <ChevronLeft />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebtsList;
