import { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { Search, Filter } from 'lucide-react';

const InventoryLogTable = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    changeType: '',
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
      if (filters.changeType) params.changeType = filters.changeType;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await api.get('/inventory/logs', { params });
      setLogs(response.data.data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const changeTypeLabels = {
    increase: 'زيادة',
    decrease: 'نقصان',
    adjustment: 'تعديل',
    sale: 'بيع',
    return: 'إرجاع',
    purchase: 'شراء',
  };

  return (
    <div className="card p-4 md:p-6">
      <div className="mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">سجل المخزون</h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4">
          <select
            value={filters.changeType}
            onChange={(e) => setFilters({ ...filters, changeType: e.target.value })}
            className="input-field text-sm md:text-base px-3 py-2 flex-1 sm:flex-none"
          >
            <option value="">جميع الأنواع</option>
            <option value="increase">زيادة</option>
            <option value="decrease">نقصان</option>
            <option value="adjustment">تعديل</option>
            <option value="sale">بيع</option>
            <option value="return">إرجاع</option>
            <option value="purchase">شراء</option>
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="input-field text-sm md:text-base px-3 py-2 flex-1 sm:flex-none"
            placeholder="من تاريخ"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="input-field text-sm md:text-base px-3 py-2 flex-1 sm:flex-none"
            placeholder="إلى تاريخ"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-600"></div>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <div className="inline-block min-w-full align-middle px-4 md:px-0">
            <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                  التاريخ
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                  المنتج
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                  النوع
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                  قبل
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                  بعد
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                  التغيير
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                  السبب
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                  المستخدم
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log._id}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {new Date(log.createdAt).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    })}
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {log.productId?.name || '-'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        log.changeType === 'increase' || log.changeType === 'purchase' || log.changeType === 'return'
                          ? 'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-400'
                          : 'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-400'
                      }`}
                    >
                      {changeTypeLabels[log.changeType] || log.changeType}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {log.quantityBefore}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {log.quantityAfter}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-sm font-medium ${
                        log.quantityChange > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {log.quantityChange > 0 ? '+' : ''}
                      {log.quantityChange}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {log.reason}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {log.userId?.name || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryLogTable;

