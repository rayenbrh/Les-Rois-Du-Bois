import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PosBackLink from '../../components/shared/PosBackLink';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import {
  ShoppingCart,
  Package,
  TrendingUp,
  Play,
  BarChart3,
  Calendar,
  Search,
  RefreshCw,
  Edit,
  ArrowLeft,
  X,
  Plus,
  Minus,
  Trash2,
  Check,
  AlertCircle,
  Download,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import POSInterface from './POSInterface';
import { withBase } from '../../utils/imageUrl';

const POSDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    todaySales: 0,
    todayRevenue: 0,
    totalItems: 0,
  });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInterface, setShowInterface] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [exchangeItem, setExchangeItem] = useState(null);
  const [returnItem, setReturnItem] = useState(null);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  // Protect POS route - redirect if not authenticated or not a cashier
  useEffect(() => {
    if (!authLoading) {
      const token = localStorage.getItem('token');
      const cashierId = localStorage.getItem('cashierId');
      
      // For cashiers: check cashierId instead of token (they stay logged in)
      if (cashierId && !token) {
        // Cashier is logged in via ID - allow access
        // If we don't have user data yet, it will be fetched by AuthContext
        return;
      }
      
      // If no token and no cashierId and no user, redirect to login
      if (!token && !cashierId && !user) {
        navigate('/login', { replace: true });
        return;
      }
      
      if (user) {
        const cashierRoles = ['cashier', 'store_cashier', 'saler', 'admin', 'commercial'];
        if (!cashierRoles.includes(user.role)) {
          if (user.role === 'client' || user.role === 'user') {
            navigate('/shop', { replace: true });
          } else {
            navigate('/login', { replace: true });
          }
        }
        // If user is a cashier, they're allowed - stay on POS
      } else if (token || cashierId) {
        // We have a token/cashierId but no user - backend might be down
        // Don't redirect to login immediately - keep credentials and stay on POS
        // This allows user to continue working if backend comes back online
        return;
      }
      // If no token/cashierId and no user, redirect will happen above
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && !authLoading) {
      fetchData();
      fetchProducts();
    }
  }, [user, authLoading, dateFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const startDate = new Date(dateFilter.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateFilter.endDate);
      endDate.setHours(23, 59, 59, 999);

      // Use POS-specific endpoint that allows cashiers
      // Don't filter by status - get all orders for the selected period
      const ordersRes = await api.get('/pos/orders', {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: 1000,
        },
      });

      const ordersData = ordersRes.data.data || [];
      
      // Filter only completed orders for display and stats
      const completedOrders = ordersData.filter(order => order.status === 'completed');
      setOrders(completedOrders);

      // Calculate stats from completed orders only
      const totalItems = completedOrders.reduce((sum, order) => {
        return sum + (order.items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0);
      }, 0);

      setStats({
        todaySales: completedOrders.length,
        todayRevenue: completedOrders.reduce((sum, order) => sum + (order.total || 0), 0),
        totalItems,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('حدث خطأ أثناء جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const endpoint = user?.role === 'commercial' ? '/commercial/products' : '/pos/products';
      const response = await api.get(endpoint);
      setProducts(response.data.data?.regularProducts || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      order.orderNumber?.toLowerCase().includes(search) ||
      order.clientName?.toLowerCase().includes(search) ||
      order.clientPhone?.includes(search)
    );
  });

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const handleExchangeProduct = (order, item) => {
    setSelectedOrder(order);
    setExchangeItem(item);
    setShowExchangeModal(true);
  };

  const handleReturnProduct = (order, item) => {
    setSelectedOrder(order);
    setReturnItem(item);
    setShowReturnModal(true);
  };

  const handleDownloadBonCommande = async (order) => {
    try {
      const response = await api.get(`/pos/orders/${order._id}/bon-commande`, {
        responseType: 'blob',
      });

      // Check if response is actually a PDF (blob) or an error (JSON)
      if (response.data.type === 'application/json') {
        // If it's JSON, it's an error - read it
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        toast.error(errorData.message || 'حدث خطأ أثناء تحميل البون');
        return;
      }

      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bon-commande-${order.orderNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('تم تحميل البون بنجاح');
    } catch (error) {
      console.error('Error downloading bon de commande:', error);
      
      // Try to extract error message from response
      if (error.response?.data) {
        try {
          if (error.response.data instanceof Blob) {
            const text = await error.response.data.text();
            const errorData = JSON.parse(text);
            toast.error(errorData.message || 'حدث خطأ أثناء تحميل البون');
          } else {
            toast.error(error.response.data.message || 'حدث خطأ أثناء تحميل البون');
          }
        } catch (parseError) {
          toast.error('حدث خطأ أثناء تحميل البون');
        }
      } else {
        toast.error('حدث خطأ أثناء تحميل البون');
      }
    }
  };

  // Save an edited POS order. When the customer of a credit sale already paid more than
  // the new total, ask whether the difference is given back or kept as credit.
  const saveOrderChange = async (payload) => {
    const send = (overpaid) => api.put(`/pos/orders/${selectedOrder._id}`, { ...payload, ...(overpaid && { overpaid }) });
    try {
      return await send();
    } catch (error) {
      if (error.response?.data?.code !== 'OVERPAID_CHOICE_REQUIRED') throw error;
      const message = error.response.data.message;
      if (window.confirm(`${message}

موافق = إرجاع المبلغ للعميل نقداً
إلغاء = خيار آخر`)) return send('refund');
      if (window.confirm('إبقاء المبلغ رصيداً للعميل يُستعمل في مشترياته القادمة؟')) return send('credit');
      throw new Error('تم إلغاء العملية');
    }
  };

  const handleExchange = async (newProduct, variant, quantity) => {
    try {
      const oldItem = exchangeItem;
      // Update order items
      const oldItemProductId = typeof oldItem.productId === 'object' && oldItem.productId?._id 
        ? oldItem.productId._id.toString() 
        : oldItem.productId?.toString() || oldItem.productId;
      
      // Ensure newProduct._id is a string
      const newProductId = typeof newProduct._id === 'object' && newProduct._id?.toString
        ? newProduct._id.toString()
        : newProduct._id?.toString() || newProduct._id;
      
      const updatedItems = selectedOrder.items.map((item) => {
        const itemProductId = typeof item.productId === 'object' && item.productId?._id 
          ? item.productId._id.toString() 
          : item.productId?.toString() || item.productId;
        
        if (item._id?.toString() === oldItem._id?.toString() || 
            (itemProductId === oldItemProductId && JSON.stringify(item.variant) === JSON.stringify(oldItem.variant))) {
          const unitPrice = variant?.additionalPrice 
            ? (newProduct.price + variant.additionalPrice)
            : newProduct.price;
          return {
            ...item,
            productId: newProductId, // Use the string version
            productName: newProduct.name,
            variant: variant ? {
              value: variant.value,
              name: variant.name,
              additionalPrice: variant.additionalPrice || 0,
            } : undefined,
            quantity: quantity,
            unitPrice: unitPrice,
            total: quantity * unitPrice,
          };
        }
        // Ensure all productId are strings, not objects
        const cleanProductId = typeof item.productId === 'object' && item.productId?._id 
          ? item.productId._id.toString() 
          : item.productId?.toString() || item.productId;
        return {
          ...item,
          productId: cleanProductId,
        };
      });

      // Recalculate totals
      const subtotal = updatedItems.reduce((sum, item) => sum + (item.total || 0), 0);
      const total = subtotal - (selectedOrder.discount || 0);

      // Update order (stock and customer debt are updated on the server, all together)
      await saveOrderChange({ items: updatedItems, action: 'exchange', subtotal, total });

      toast.success('تم استبدال المنتج بنجاح');
      setShowExchangeModal(false);
      setExchangeItem(null);
      setSelectedOrder(null);
      fetchData();
    } catch (error) {
      console.error('Error exchanging product:', error);
      toast.error(error.response?.data?.message || 'حدث خطأ أثناء استبدال المنتج');
    }
  };

  const handleReturn = async (quantity, reason) => {
    try {
      // Update order items - remove or reduce quantity
      const returnProductId = typeof returnItem.productId === 'object' && returnItem.productId?._id 
        ? returnItem.productId._id.toString() 
        : returnItem.productId?.toString() || returnItem.productId;
      
      const updatedItems = selectedOrder.items
        .map((item) => {
          const itemProductId = typeof item.productId === 'object' && item.productId?._id 
            ? item.productId._id.toString() 
            : item.productId?.toString() || item.productId;
          
          if (item._id?.toString() === returnItem._id?.toString() || 
              (itemProductId === returnProductId && JSON.stringify(item.variant) === JSON.stringify(returnItem.variant))) {
            const newQuantity = item.quantity - quantity;
            if (newQuantity <= 0) {
              return null; // Remove item
            }
            return {
              ...item,
              productId: itemProductId, // Ensure productId is a string
              quantity: newQuantity,
              total: newQuantity * item.unitPrice,
            };
          }
          // Ensure all productId are strings, not objects
          return {
            ...item,
            productId: itemProductId,
          };
        })
        .filter(Boolean);

      // Recalculate totals
      const subtotal = updatedItems.reduce((sum, item) => sum + (item.total || 0), 0);
      const total = subtotal - (selectedOrder.discount || 0);

      // Update order (stock and customer debt are updated on the server, all together)
      await saveOrderChange({ items: updatedItems, action: 'return', reason, subtotal, total });

      toast.success('تم إرجاع المنتج بنجاح');
      setShowReturnModal(false);
      setReturnItem(null);
      setSelectedOrder(null);
      fetchData();
    } catch (error) {
      console.error('Error returning product:', error);
      toast.error(error.response?.data?.message || 'حدث خطأ أثناء إرجاع المنتج');
    }
  };

  if (showInterface) {
    return <POSInterface />;
  }

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">جار التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
              لوحة تحكم نقطة البيع
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {user?.name || 'Caissier'} • {dateFilter.startDate === dateFilter.endDate 
                ? new Date(dateFilter.startDate).toLocaleDateString('ar-TN')
                : `${new Date(dateFilter.startDate).toLocaleDateString('ar-TN')} - ${new Date(dateFilter.endDate).toLocaleDateString('ar-TN')}`
              }
            </p>
          </div>
          <div className="flex gap-2">
            <PosBackLink />
            <button
              onClick={() => navigate('/pos')}
              className="btn-primary flex items-center gap-2"
            >
              <Play size={18} />
              <span className="hidden sm:inline">فتح واجهة البيع</span>
              <span className="sm:hidden">بيع</span>
            </button>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2 text-gray-900 dark:text-white"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">عدد المبيعات</p>
                <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-gray-100">
                  {stats.todaySales}
                </p>
              </div>
              <ShoppingCart className="text-gold-500" size={32} />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">الإيرادات</p>
                <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-gray-100">
                  {stats.todayRevenue.toFixed(2)} TND
                </p>
              </div>
              <TrendingUp className="text-gold-500" size={32} />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">إجمالي القطع</p>
                <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-gray-100">
                  {stats.totalItems}
                </p>
              </div>
              <Package className="text-gold-500" size={32} />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 md:p-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                البحث
              </label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="ابحث برقم الطلب أو اسم العميل..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  من تاريخ
                </label>
                <input
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(e) => setDateFilter({ ...dateFilter, startDate: e.target.value })}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  إلى تاريخ
                </label>
                <input
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(e) => setDateFilter({ ...dateFilter, endDate: e.target.value })}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">
              الطلبات ({filteredOrders.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    رقم الطلب
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    التاريخ
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    العميل
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    العناصر
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    الإجمالي
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      لا توجد طلبات
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {order.orderNumber}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {new Date(order.createdAt).toLocaleDateString('ar-TN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {order.clientName || 'عميل مباشر'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0} قطعة
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {order.total?.toFixed(2) || '0.00'} TND
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewOrder(order)}
                            className="text-gold-600 dark:text-gold-400 hover:text-gold-700 dark:hover:text-gold-300"
                            title="عرض التفاصيل"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDownloadBonCommande(order)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                            title="تحميل بون الأمر"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Order Detail Modal */}
      {showOrderModal && selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => {
            setShowOrderModal(false);
            setSelectedOrder(null);
          }}
          onExchange={handleExchangeProduct}
          onReturn={handleReturnProduct}
        />
      )}

      {/* Exchange Modal */}
      {showExchangeModal && selectedOrder && exchangeItem && (
        <ExchangeModal
          order={selectedOrder}
          item={exchangeItem}
          products={products}
          onClose={() => {
            setShowExchangeModal(false);
            setExchangeItem(null);
            setSelectedOrder(null);
          }}
          onConfirm={handleExchange}
        />
      )}

      {/* Return Modal */}
      {showReturnModal && selectedOrder && returnItem && (
        <ReturnModal
          order={selectedOrder}
          item={returnItem}
          onClose={() => {
            setShowReturnModal(false);
            setReturnItem(null);
            setSelectedOrder(null);
          }}
          onConfirm={handleReturn}
        />
      )}
    </div>
  );
};

// Order Detail Modal Component
const OrderDetailModal = ({ order, onClose, onExchange, onReturn }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            تفاصيل الطلب: {order.orderNumber}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">التاريخ</p>
              <p className="text-gray-900 dark:text-white font-medium">
                {new Date(order.createdAt).toLocaleString('ar-TN')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">العميل</p>
              <p className="text-gray-900 dark:text-white font-medium">
                {order.clientName || 'عميل مباشر'}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">المنتجات</p>
            <div className="space-y-2">
              {order.items?.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{item.productName}</p>
                    {item.variant && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        المتغير: {item.variant.name || item.variant.value}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      الكمية: {item.quantity} × {item.unitPrice} TND
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {item.total?.toFixed(2) || (item.quantity * item.unitPrice).toFixed(2)} TND
                    </p>
                    <button
                      onClick={() => onExchange(order, item)}
                      className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
                      title="استبدال"
                    >
                      استبدال
                    </button>
                    <button
                      onClick={() => onReturn(order, item)}
                      className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                      title="إرجاع"
                    >
                      إرجاع
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600 dark:text-gray-400">المجموع الفرعي</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {order.subtotal?.toFixed(2) || '0.00'} TND
              </span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 dark:text-gray-400">الخصم</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {order.discount.toFixed(2)} TND
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-lg font-bold text-gray-900 dark:text-white">الإجمالي</span>
              <span className="text-lg font-bold text-gold-600 dark:text-gold-400">
                {order.total?.toFixed(2) || '0.00'} TND
              </span>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-gray-900 dark:text-white"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

// Exchange Modal Component
const ExchangeModal = ({ order, item, products, onClose, onConfirm }) => {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(item.quantity);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleConfirm = () => {
    if (!selectedProduct) {
      toast.error('يرجى اختيار منتج');
      return;
    }
    if (selectedProduct.variants?.length > 0 && !selectedVariant) {
      toast.error('يرجى اختيار متغير');
      return;
    }
    onConfirm(selectedProduct, selectedVariant, quantity);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">استبدال منتج</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">المنتج الحالي</p>
            <p className="font-medium text-gray-900 dark:text-white">{item.productName}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">الكمية: {item.quantity}</p>
          </div>
          <div>
            <input
              type="text"
              placeholder="ابحث عن منتج..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
            {filteredProducts.map((product) => (
              <button
                key={product._id}
                onClick={() => {
                  setSelectedProduct(product);
                  setSelectedVariant(null);
                }}
                className={`p-3 border-2 rounded-lg text-right ${
                  selectedProduct?._id === product._id
                    ? 'border-gold-600 bg-gold-50 dark:bg-gold-900/20'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                <p className="font-medium text-sm text-gray-900 dark:text-white">{product.name}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{product.price} TND</p>
              </button>
            ))}
          </div>
          {selectedProduct?.variants && selectedProduct.variants.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                اختر المتغير
              </p>
              <div className="grid grid-cols-3 gap-2">
                {selectedProduct.variants.map((variant, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedVariant(variant)}
                    disabled={!variant.stock || variant.stock <= 0}
                    className={`p-2 border-2 rounded-lg text-sm ${
                      selectedVariant?.value === variant.value
                        ? 'border-gold-600 bg-gold-50 dark:bg-gold-900/20'
                        : 'border-gray-300 dark:border-gray-600'
                    } ${!variant.stock || variant.stock <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {variant.name || variant.value}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              الكمية
            </label>
            <input
              type="number"
              min="1"
              max={selectedVariant?.stock || selectedProduct?.stock || 999}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-gray-900 dark:text-white"
          >
            إلغاء
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-gold-600 hover:bg-gold-700 rounded-lg text-white"
          >
            تأكيد الاستبدال
          </button>
        </div>
      </div>
    </div>
  );
};

// Return Modal Component
const ReturnModal = ({ order, item, onClose, onConfirm }) => {
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (quantity <= 0 || quantity > item.quantity) {
      toast.error('الكمية غير صحيحة');
      return;
    }
    if (!reason.trim()) {
      toast.error('يرجى إدخال سبب الإرجاع');
      return;
    }
    onConfirm(quantity, reason);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">إرجاع منتج</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">المنتج</p>
            <p className="font-medium text-gray-900 dark:text-white">{item.productName}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              الكمية المتاحة للإرجاع: {item.quantity}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              الكمية المراد إرجاعها
            </label>
            <input
              type="number"
              min="1"
              max={item.quantity}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(item.quantity, parseInt(e.target.value) || 1)))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              سبب الإرجاع
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="أدخل سبب الإرجاع..."
            />
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-gray-900 dark:text-white"
          >
            إلغاء
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white"
          >
            تأكيد الإرجاع
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSDashboard;
