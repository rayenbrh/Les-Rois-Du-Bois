import { useState, useEffect } from 'react';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { Activity, Filter, Trash2 } from 'lucide-react';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    resourceType: '',
    action: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.resourceType) params.resourceType = filters.resourceType;
      if (filters.action) params.action = filters.action;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await api.get('/audit-logs', { params });
      setLogs(response.data.data || []);
    } catch (error) {
      // Silent error handling
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLogs = async () => {
    // Check if any filters are active
    const hasFilters = filters.resourceType || filters.action || filters.startDate || filters.endDate;
    
    const confirmMessage = hasFilters
      ? 'هل أنت متأكد من حذف جميع السجلات المطابقة للفلاتر الحالية؟ هذه العملية لا يمكن التراجع عنها.'
      : 'هل أنت متأكد من حذف جميع السجلات؟ هذه العملية لا يمكن التراجع عنها.';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setLoading(true);
      const params = {};
      
      // If no filters, delete all
      if (!hasFilters) {
        params.deleteAll = 'true';
      } else {
        // Otherwise, use filters
        if (filters.resourceType) params.resourceType = filters.resourceType;
        if (filters.action) params.action = filters.action;
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;
      }

      const response = await api.delete('/audit-logs', { params });
      toast.success(response.data.message || 'تم حذف السجلات بنجاح');
      fetchLogs(); // Refresh the list
    } catch (error) {
      toast.error(error.response?.data?.message || 'حدث خطأ أثناء حذف السجلات');
    } finally {
      setLoading(false);
    }
  };

  const actionLabels = {
    create: 'إنشاء',
    update: 'تحديث',
    delete: 'حذف',
    status_change: 'تغيير الحالة',
    price_change: 'تغيير السعر',
    stock_change: 'تغيير المخزون',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">سجل التدقيق</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">سجل جميع العمليات في النظام</p>
        </div>
        <button
          onClick={handleDeleteLogs}
          className="btn-danger flex items-center gap-2"
          disabled={loading}
        >
          <Trash2 size={18} />
          <span>حذف السجلات المفلترة</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={filters.resourceType}
            onChange={(e) => setFilters({ ...filters, resourceType: e.target.value })}
            className="input-field"
          >
            <option value="">جميع الأنواع</option>
            <option value="user">مستخدم</option>
            <option value="product">منتج</option>
            <option value="order">طلب</option>
            <option value="invoice">فاتورة</option>
          </select>
          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            className="input-field"
          >
            <option value="">جميع الإجراءات</option>
            <option value="create">إنشاء</option>
            <option value="update">تحديث</option>
            <option value="delete">حذف</option>
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="input-field"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="input-field"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-right py-3 px-4 text-sm font-medium">التاريخ</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">المستخدم</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">النوع</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الإجراء</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log._id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-4 text-sm">
                      {new Date(log.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4 text-sm">{log.userEmail}</td>
                    <td className="py-3 px-4 text-sm">{log.resourceType}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-gold-100 text-gold-800 rounded-full text-xs">
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {Object.keys(log.changes || {}).length > 0
                        ? `${Object.keys(log.changes).length} تغيير`
                        : '-'}
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

export default AuditLogs;

