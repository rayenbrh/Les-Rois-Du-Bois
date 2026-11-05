import { useState, useEffect } from 'react';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { FileText, Download, ChevronLeft, ChevronRight, Search, Image as ImageIcon } from 'lucide-react';
import { withBase } from '@/utils/imageUrl';

const ExpensesTable = ({ filters, onExport }) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [receiptPreview, setReceiptPreview] = useState(null);

  useEffect(() => {
    fetchExpenses();
  }, [filters, pagination.page]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = {
        ...filters,
        page: pagination.page,
        limit: pagination.limit,
      };

      const response = await api.get('/analytics/commercials/advanced/expenses-table', { params });
      setExpenses(response.data.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination?.total || 0,
        pages: response.data.pagination?.pages || 0,
      }));
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('حدث خطأ أثناء جلب المصروفات');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['المندوب', 'النوع', 'المبلغ', 'التاريخ', 'الملاحظات'];
    const rows = expenses.map(expense => [
      expense.commercial,
      expense.type,
      `${expense.amount} TND`,
      new Date(expense.date).toLocaleDateString('fr-FR'),
      expense.notes || '-',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('تم تصدير البيانات بنجاح');
  };

  const handleReceiptPreview = (receiptUrl) => {
    if (receiptUrl) {
      setReceiptPreview(withBase(receiptUrl));
    }
  };

  const filteredExpenses = expenses.filter(expense => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      expense.commercial?.toLowerCase().includes(search) ||
      expense.type?.toLowerCase().includes(search) ||
      expense.label?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          جدول المصروفات
        </h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="بحث..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pr-10"
            />
          </div>
          <button
            onClick={handleExportCSV}
            className="btn-secondary flex items-center gap-2"
          >
            <Download size={18} />
            <span>تصدير CSV</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-500">لا توجد مصروفات</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-right py-3 px-4 text-sm font-medium">المندوب</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">النوع</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الوصف</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">المبلغ</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">التاريخ</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الملاحظات</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الإيصال</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => (
                  <tr
                    key={expense._id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-4">{expense.commercial || '-'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {expense.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">{expense.label || '-'}</td>
                    <td className="py-3 px-4 font-medium text-red-600">{expense.amount} TND</td>
                    <td className="py-3 px-4 text-sm">
                      {new Date(expense.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {expense.notes || '-'}
                    </td>
                    <td className="py-3 px-4">
                      {expense.receiptUrl ? (
                        <button
                          onClick={() => handleReceiptPreview(expense.receiptUrl)}
                          className="p-2 text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg transition-colors"
                          title="عرض الإيصال"
                        >
                          <ImageIcon size={18} />
                        </button>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Receipt Preview Modal */}
          {receiptPreview && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setReceiptPreview(null)}>
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <h3 className="text-lg font-bold">عرض الإيصال</h3>
                  <button
                    onClick={() => setReceiptPreview(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-4">
                  <img
                    src={receiptPreview}
                    alt="Receipt"
                    className="max-w-full h-auto rounded"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                  />
                  <div style={{ display: 'none' }} className="text-center py-8">
                    <p className="text-gray-500">لا يمكن تحميل الصورة</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                عرض {((pagination.page - 1) * pagination.limit) + 1} إلى {Math.min(pagination.page * pagination.limit, pagination.total)} من {pagination.total}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <ChevronRight size={18} />
                </button>
                <span className="text-sm font-medium">
                  صفحة {pagination.page} من {pagination.pages}
                </span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ExpensesTable;

