import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { Receipt, Eye, Download, Trash2, ChevronDown } from 'lucide-react';

const InvoicesList = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    startDate: '',
    endDate: '',
  });
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      const isInsideDropdown = target.closest('.status-dropdown');
      if (!isInsideDropdown && openDropdown) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

  useEffect(() => {
    fetchInvoices();
  }, [filters]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.type) params.type = filters.type;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await api.get('/invoices', { params });
      setInvoices(response.data.data || []);
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب الفواتير');
    } finally {
      setLoading(false);
    }
  };

  const statusLabels = {
    draft: 'مسودة',
    sent: 'مرسلة',
    paid: 'مدفوعة',
    partial: 'مدفوعة جزئياً',
    overdue: 'متأخرة',
    canceled: 'ملغاة',
    pending: 'قيد الانتظار',
  };

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    partial: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    canceled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    pending: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  };

  const supplierStatusLabels = {
    pending: 'قيد الانتظار',
    paid: 'مدفوعة',
    partial: 'مدفوعة جزئياً',
    overdue: 'متأخرة',
    canceled: 'ملغاة',
  };

  const handleStatusChange = async (invoiceId, newStatus, invoiceType) => {
    try {
      if (invoiceType === 'supplier') {
        await api.put(`/supplier-invoices/${invoiceId}/status`, { status: newStatus });
      } else {
        await api.put(`/invoices/${invoiceId}/status`, { status: newStatus });
      }
      toast.success('تم تحديث حالة الفاتورة بنجاح');
      fetchInvoices();
      setOpenDropdown(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'حدث خطأ أثناء تحديث الحالة');
    }
  };

  const handleDelete = async (invoiceId, invoiceType, invoiceNumber) => {
    if (!window.confirm(`هل أنت متأكد من حذف الفاتورة ${invoiceNumber}؟`)) {
      return;
    }

    try {
      if (invoiceType === 'supplier') {
        await api.delete(`/supplier-invoices/${invoiceId}`);
      } else {
        await api.delete(`/invoices/${invoiceId}`);
      }
      toast.success('تم حذف الفاتورة بنجاح');
      fetchInvoices();
    } catch (error) {
      toast.error(error.response?.data?.message || 'حدث خطأ أثناء حذف الفاتورة');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">الفواتير</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">إدارة جميع الفواتير</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="input-field"
          >
            <option value="">جميع أنواع الفواتير</option>
            <option value="client">فواتير العملاء</option>
            <option value="supplier">فواتير الموردين</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="input-field"
          >
            <option value="">جميع الحالات</option>
            <option value="draft">مسودة</option>
            <option value="sent">مرسلة</option>
            <option value="pending">قيد الانتظار</option>
            <option value="paid">مدفوعة</option>
            <option value="partial">مدفوعة جزئياً</option>
            <option value="overdue">متأخرة</option>
            <option value="canceled">ملغاة</option>
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="input-field"
            placeholder="من تاريخ"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="input-field"
            placeholder="إلى تاريخ"
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500 dark:text-gray-400">لا توجد فواتير</p>
          </div>
        ) : (
          <div className="overflow-x-auto relative">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-right py-3 px-4 text-sm font-medium">رقم الفاتورة</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">النوع</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">العميل / المورد</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الحالة</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الإجمالي</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">المدفوع</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">التاريخ</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice._id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-4 font-medium">{invoice.invoiceNumber}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        invoice.invoiceType === 'supplier' 
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {invoice.displayType || (invoice.invoiceType === 'supplier' ? 'مورد' : 'عميل')}
                      </span>
                    </td>
                    <td className="py-3 px-4">{invoice.displayName || invoice.clientName || 'N/A'}</td>
                    <td className="py-3 px-4">
                      <div className="relative status-dropdown inline-block">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdown(openDropdown === invoice._id ? null : invoice._id);
                          }}
                          className={`px-3 py-1 rounded-full text-xs flex items-center gap-1 cursor-pointer ${statusColors[invoice.status] || 'bg-gray-100 text-gray-800'}`}
                        >
                          <span>
                            {invoice.invoiceType === 'supplier' 
                              ? (supplierStatusLabels[invoice.status] || statusLabels[invoice.status] || 'قيد الانتظار')
                              : (statusLabels[invoice.status] || 'مدفوعة')
                            }
                          </span>
                          <ChevronDown size={12} className={`transition-transform ${openDropdown === invoice._id ? 'rotate-180' : ''}`} />
                        </button>
                        {openDropdown === invoice._id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-[9999] min-w-max">
                            {(invoice.invoiceType === 'supplier' 
                              ? Object.entries(supplierStatusLabels)
                              : Object.entries(statusLabels)
                            ).map(([key, label]) => (
                              <button
                                key={key}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(invoice._id, key, invoice.invoiceType);
                                }}
                                className={`w-full text-right px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                                  invoice.status === key ? 'bg-gold-50 dark:bg-gold-900/20 font-medium' : ''
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">{invoice.total.toFixed(2)} TND</td>
                    <td className="py-3 px-4">{invoice.paidAmount?.toFixed(2) || invoice.total.toFixed(2)} TND</td>
                    <td className="py-3 px-4 text-sm">
                      {invoice.dueDate 
                        ? new Date(invoice.dueDate).toLocaleDateString('fr-FR')
                        : new Date(invoice.createdAt).toLocaleDateString('fr-FR')
                      }
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const response = await api.get(
                                invoice.invoiceType === 'supplier'
                                  ? `/supplier-invoices/${invoice._id}/pdf`
                                  : `/invoices/${invoice._id}/pdf`,
                                { responseType: 'blob' }
                              );
                              const blob = new Blob([response.data], { type: 'application/pdf' });
                              const url = window.URL.createObjectURL(blob);
                              window.open(url, '_blank');
                            } catch (error) {
                              toast.error('حدث خطأ أثناء فتح الفاتورة');
                            }
                          }}
                          className="p-2 text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg"
                          title="عرض الفاتورة"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const response = await api.get(
                                invoice.invoiceType === 'supplier'
                                  ? `/supplier-invoices/${invoice._id}/pdf`
                                  : `/invoices/${invoice._id}/pdf`,
                                { responseType: 'blob' }
                              );
                              const url = window.URL.createObjectURL(new Blob([response.data]));
                              const link = document.createElement('a');
                              link.href = url;
                              link.setAttribute('download', `invoice-${invoice.invoiceNumber}.pdf`);
                              document.body.appendChild(link);
                              link.click();
                              link.remove();
                              window.URL.revokeObjectURL(url);
                              toast.success('تم تحميل الفاتورة');
                            } catch (error) {
                              toast.error('حدث خطأ أثناء تحميل الفاتورة');
                            }
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                          title="تحميل الفاتورة"
                        >
                          <Download size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(invoice._id, invoice.invoiceType, invoice.invoiceNumber)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          title="حذف الفاتورة"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoicesList;

