import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { Search, Eye, Download } from 'lucide-react';

const CommercialInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    search: '',
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchInvoices();
  }, [filters]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = { ...filters };
      const response = await api.get('/commercial/invoices', { params });
      if (response.data.success) {
        setInvoices(response.data.data);
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب الفواتير');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">الفواتير</h1>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="ابحث عن فاتورة..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="">جميع الحالات</option>
            <option value="draft">مسودة</option>
            <option value="sent">مرسلة</option>
            <option value="paid">مدفوعة</option>
            <option value="partial">مدفوعة جزئياً</option>
            <option value="overdue">متأخرة</option>
          </select>
        </div>
      </div>

      {/* Invoices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {invoices.map((invoice) => (
          <div
            key={invoice._id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{invoice.invoiceNumber}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{invoice.clientName}</p>
              </div>
              <span
                className={`px-2 py-1 rounded text-xs ${
                  invoice.status === 'paid'
                    ? 'bg-green-100 text-green-800'
                    : invoice.status === 'overdue'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {invoice.status}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">الإجمالي:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{invoice.total.toLocaleString()} TND</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">المتبقي:</span>
                <span className="font-semibold text-red-600">{invoice.remainingAmount.toLocaleString()} TND</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">تاريخ الاستحقاق:</span>
                <span className="text-gray-900 dark:text-gray-100">
                  {new Date(invoice.dueDate).toLocaleDateString('ar-TN')}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/commercial/invoices/${invoice._id}`)}
                className="flex-1 px-3 py-2 bg-gold-600 hover:bg-gold-700 text-white rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Eye size={16} />
                عرض
              </button>
            </div>
          </div>
        ))}
      </div>

      {invoices.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <p className="text-gray-500 dark:text-gray-400">لا توجد فواتير</p>
        </div>
      )}
    </div>
  );
};

export default CommercialInvoices;

