import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { Search, Eye } from 'lucide-react';

const OrdersList = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    source: '',
    search: '',
    startDate: '',
    endDate: '',
  });
  const navigate = useNavigate();
  const searchTimeoutRef = useRef(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.source) params.source = filters.source;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.search && filters.search.trim()) params.search = filters.search.trim();

      const response = await api.get('/orders', { params });
      setOrders(response.data.data || []);
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب الطلبات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // For search, debounce. For other filters, apply immediately
    if (filters.search) {
      searchTimeoutRef.current = setTimeout(() => {
        fetchOrders();
      }, 500);
    } else {
      fetchOrders();
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.source, filters.startDate, filters.endDate, filters.search]);


  const statusLabels = {
    pending: 'قيد الانتظار',
    preparing: 'قيد التحضير',
    ready: 'جاهز',
    delivered: 'تم التسليم',
    completed: 'مكتمل',
    canceled: 'ملغي',
  };

  const statusColors = {
    pending: 'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-400',
    preparing: 'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-400',
    ready: 'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-400',
    delivered: 'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-400',
    completed: 'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-400',
    canceled: 'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-400',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">الطلبات</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">إدارة جميع الطلبات</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="البحث..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="input-field pr-10"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="input-field"
          >
            <option value="">جميع الحالات</option>
            <option value="pending">قيد الانتظار</option>
            <option value="preparing">قيد التحضير</option>
            <option value="ready">جاهز</option>
            <option value="delivered">تم التسليم</option>
            <option value="completed">مكتمل</option>
            <option value="canceled">ملغي</option>
          </select>
          <select
            value={filters.source}
            onChange={(e) => setFilters({ ...filters, source: e.target.value })}
            className="input-field"
          >
            <option value="">جميع المصادر</option>
            <option value="catalog">E-commerce / الكتالوج</option>
            <option value="pos">POS / نقطة البيع</option>
            <option value="commercial_pos">Commercial POS / المبيعات التجارية</option>
            <option value="admin">Admin / الإداري</option>
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

      {/* Orders Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">لا توجد طلبات</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    رقم الطلب
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    المصدر
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    العميل
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    الحالة
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    الإجمالي
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    تاريخ الإنشاء
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order._id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {order.orderNumber}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        {order.source && (
                          <span
                            className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              order.source === 'catalog'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                : order.source === 'pos'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : order.source === 'commercial_pos'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                            }`}
                          >
                            {order.source === 'catalog'
                              ? 'E-commerce'
                              : order.source === 'pos'
                              ? 'POS'
                              : order.source === 'commercial_pos'
                              ? 'Commercial'
                              : 'Admin'}
                          </span>
                        )}
                        {order.storeId && typeof order.storeId === 'object' && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Store: {order.storeId.name}
                          </div>
                        )}
                        {order.commercialId && typeof order.commercialId === 'object' && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Commercial: {order.commercialId.name}
                          </div>
                        )}
                        {order.cashierId && typeof order.cashierId === 'object' && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Cashier: {order.cashierId.name}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {order.clientName || 'عميل مباشر'}
                      </div>
                      {order.clientPhone && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {order.clientPhone}
                        </div>
                      )}
                      {order.clientId && typeof order.clientId === 'object' && order.clientId.email && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {order.clientId.email}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          statusColors[order.status] || ''
                        }`}
                      >
                        {statusLabels[order.status] || order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {order.total} TND
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/admin/orders/${order._id}`)}
                          className="p-2 text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg transition-colors"
                        >
                          <Eye size={18} />
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

export default OrdersList;

