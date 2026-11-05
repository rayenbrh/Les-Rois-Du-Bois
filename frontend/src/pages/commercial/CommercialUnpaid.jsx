import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { AlertCircle, Eye, Phone } from 'lucide-react';

const CommercialUnpaid = () => {
  const [data, setData] = useState({ invoices: [], clientTotals: [] });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUnpaidInvoices();
  }, []);

  const fetchUnpaidInvoices = async () => {
    try {
      setLoading(true);
      const response = await api.get('/commercial/invoices/unpaid/list');
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب الفواتير غير المدفوعة');
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

  const totalUnpaid = data.invoices.reduce((sum, inv) => sum + inv.remainingAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">الفواتير غير المدفوعة</h1>
        <div className="bg-red-100 dark:bg-red-900/30 px-4 py-2 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">الإجمالي غير المدفوع</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{totalUnpaid.toLocaleString()} TND</p>
        </div>
      </div>

      {/* Client Totals */}
      {data.clientTotals.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">إجمالي غير المدفوع حسب العميل</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.clientTotals.map((item) => (
              <div
                key={item._id}
                onClick={() => navigate(`/commercial/clients/${item._id}`)}
                className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">العميل</p>
                <p className="text-2xl font-bold text-red-600">{item.totalUnpaid.toLocaleString()} TND</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.invoiceCount} فاتورة</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unpaid Invoices */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">الفواتير المتأخرة وغير المدفوعة</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">رقم الفاتورة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">العميل</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">تاريخ الاستحقاق</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">المبلغ المتبقي</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">الحالة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.invoices.map((invoice) => (
                <tr
                  key={invoice._id}
                  className={invoice.isOverdue ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {invoice.invoiceNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {invoice.clientName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {new Date(invoice.dueDate).toLocaleDateString('ar-TN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                    {invoice.remainingAmount.toLocaleString()} TND
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        invoice.status === 'overdue' || invoice.isOverdue
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}
                    >
                      {invoice.isOverdue ? 'متأخرة' : invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/commercial/invoices/${invoice._id}`)}
                        className="text-gold-600 hover:text-gold-700 flex items-center gap-1"
                      >
                        <Eye size={16} />
                        عرض
                      </button>
                      <button
                        onClick={() => navigate(`/commercial/clients/${invoice.clientId._id || invoice.clientId}`)}
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Phone size={16} />
                        اتصال
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.invoices.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">لا توجد فواتير غير مدفوعة</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommercialUnpaid;

