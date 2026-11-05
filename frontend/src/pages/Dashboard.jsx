import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';
import { FolderTree, Package, Boxes, Users, ShoppingCart, FileText, CreditCard, TrendingUp, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

// Custom Tooltip component that adapts to theme
const CustomTooltip = ({ active, payload, label }) => {
  const isDark = document.documentElement.classList.contains('dark');
  
  if (active && payload && payload.length) {
    return (
      <div
        className={`rounded-lg border p-3 shadow-lg ${
          isDark
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
        }`}
      >
        <p
          className={`mb-2 font-semibold ${
            isDark ? 'text-gray-100' : 'text-gray-900'
          }`}
        >
          {label}
        </p>
        {payload.map((entry, index) => (
          <p
            key={index}
            className={`text-sm ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            }`}
            style={{ color: entry.color }}
          >
            {`${entry.name}: ${typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Custom Legend for Pie Chart
const CustomPieLegend = ({ stockData }) => {
  const isDark = document.documentElement.classList.contains('dark');
  const total = stockData.reduce((sum, item) => sum + item.value, 0);
  
  return (
    <div className="flex justify-center items-center gap-6 mt-4 flex-wrap">
      {stockData.map((item, index) => {
        const percentage = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
        return (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span
              className={`text-sm ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              {item.name}: {percentage}%
            </span>
          </div>
        );
      })}
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    categories: 0,
    products: 0,
    specialProducts: 0,
    users: 0,
    orders: 0,
    pendingOrders: 0,
    revenue: 0,
    profit: 0,
    creditInvoices: 0,
    unpaidInvoices: 0,
    unpaidAmount: 0,
  });
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lowStockProducts, setLowStockProducts] = useState([]);
      const [topProducts, setTopProducts] = useState([]);
  const [stockData, setStockData] = useState([]);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [stockFilter, setStockFilter] = useState('all'); // 'all', 'low', 'out'
  const [topProductsLimit, setTopProductsLimit] = useState(5);
  const [topProductsStartDate, setTopProductsStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return date.toISOString().split('T')[0];
  });
  const [topProductsEndDate, setTopProductsEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    fetchStats();
    fetchChartsData();
  }, []);

  const fetchStats = async () => {
    try {
      const [categoriesRes, productsRes, specialProductsRes, ordersRes, invoicesRes, usersRes] = await Promise.all([
        api.get('/categories'),
        api.get('/products'),
        api.get('/special-products'),
        api.get('/orders'),
        api.get('/invoices'),
        api.get('/users').catch(() => ({ data: { data: [] } })),
      ]);

      const orders = ordersRes.data.data || [];
      const invoices = invoicesRes.data.data || [];
      const users = usersRes.data.data || [];

      // Filter only fully paid client invoices (status = 'paid' or remainingAmount = 0)
      const paidClientInvoices = invoices.filter((inv) => {
        const isClientInvoice = !inv.invoiceType || inv.invoiceType === 'client';
        const isFullyPaid = inv.status === 'paid' || (inv.remainingAmount !== undefined && inv.remainingAmount === 0);
        return isClientInvoice && isFullyPaid;
      });

      // Calculate revenue and profit only from fully paid invoices
      const revenue = paidClientInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      
      // Calculate profit: for each paid invoice, get the associated order and sum the profit
      // Handle both populated and non-populated orderId
      const profit = paidClientInvoices.reduce((sum, inv) => {
        if (inv.orderId) {
          // Handle both cases: orderId as object with _id or as string
          const orderId = typeof inv.orderId === 'object' && inv.orderId._id 
            ? inv.orderId._id 
            : inv.orderId;
          const order = orders.find((o) => {
            const oId = typeof o._id === 'object' ? o._id.toString() : o._id?.toString();
            const invOrderId = typeof orderId === 'object' ? orderId.toString() : orderId?.toString();
            return oId === invOrderId;
          });
          return sum + (order?.profit || 0);
        }
        return sum;
      }, 0);

      // Get unpaid invoices (client invoices that are not fully paid)
      const unpaid = invoices.filter((inv) => {
        const isClientInvoice = !inv.invoiceType || inv.invoiceType === 'client';
        const isUnpaid = inv.status !== 'paid' && inv.status !== 'canceled' && 
                        (inv.remainingAmount === undefined || inv.remainingAmount > 0);
        return isClientInvoice && isUnpaid;
      });

      setUnpaidInvoices(unpaid.slice(0, 10)); // Show top 10 unpaid invoices

      setStats({
        categories: categoriesRes.data.count || 0,
        products: productsRes.data.count || 0,
        specialProducts: specialProductsRes.data.count || 0,
        users: users.length || 0,
        orders: orders.length,
        pendingOrders: orders.filter((o) => o.status === 'pending').length,
        revenue: revenue,
        profit: profit,
        creditInvoices: invoices.filter((i) => i.status === 'partial' || i.status === 'overdue').length,
        unpaidInvoices: unpaid.length,
        unpaidAmount: unpaid.reduce((sum, inv) => sum + (inv.remainingAmount || inv.total || 0), 0),
      });
    } catch (error) {
      // Silent error handling
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'إجمالي الإيرادات', value: `${stats.revenue.toLocaleString()} TND`, icon: TrendingUp, color: 'bg-gold-500' },
    { label: 'الربح', value: `${stats.profit.toLocaleString()} TND`, icon: TrendingUp, color: 'bg-green-500' },
    { label: 'إجمالي الطلبات', value: stats.orders, icon: ShoppingCart, color: 'bg-gold-600' },
    { label: 'إجمالي المنتجات', value: stats.products, icon: Package, color: 'bg-gold-600' },
    { label: 'المنتجات الخاصة', value: stats.specialProducts, icon: Boxes, color: 'bg-gold-500' },
    { label: 'إجمالي الفئات', value: stats.categories, icon: FolderTree, color: 'bg-gold-500' },
    { label: 'إجمالي المستخدمين', value: stats.users, icon: Users, color: 'bg-gold-500' },
    { label: 'الطلبات المعلقة', value: stats.pendingOrders, icon: FileText, color: 'bg-gold-600' },
  ];

  const fetchChartsData = async () => {
    try {
      setLoadingCharts(true);

      const [topProductsRes, stockDistributionRes, lowStockRes] = await Promise.all([
        api.get('/analytics/top-products', {
          params: {
            startDate: topProductsStartDate,
            endDate: topProductsEndDate,
            limit: topProductsLimit,
          },
        }).catch(() => ({ data: { data: [] } })),
        api.get('/analytics/stock-distribution').catch(() => ({ data: { data: {} } })),
        api.get('/analytics/low-stock', { params: { threshold: 10 } }).catch(() => ({ data: { data: [] } })),
      ]);

      // Format top products
      const formattedTopProducts = (topProductsRes.data.data || []).slice(0, topProductsLimit).map((product) => ({
        name: product.productName?.substring(0, 15) || 'غير محدد',
        sales: product.quantity || 0,
        revenue: product.revenue || 0,
      }));
      setTopProducts(formattedTopProducts);

      // Format stock distribution
      const stockDist = stockDistributionRes.data.data || {};
      // Use counts (actual numbers) instead of percentages for the pie chart
      const counts = stockDist.counts || {};
      const formattedStockData = [
        { name: 'متوفر', value: counts.available || 0, color: '#10B981' },
        { name: 'منخفض', value: counts.lowStock || 0, color: '#F59E0B' },
        { name: 'نفد', value: counts.outOfStock || 0, color: '#EF4444' },
      ];
      setStockData(formattedStockData);

      // Set low stock products
      setLowStockProducts(lowStockRes.data.data || []);
    } catch (error) {
      console.error('Error fetching charts data:', error);
      toast.error('حدث خطأ أثناء تحميل بيانات الرسوم البيانية');
    } finally {
      setLoadingCharts(false);
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">لوحة التحكم</h1>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="card">
              <div className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-2.5 sm:p-3 rounded-xl`}>
                  <Icon className="text-white" size={22} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="card">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">أفضل المنتجات</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">عدد المنتجات:</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={topProductsLimit}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 5;
                    setTopProductsLimit(Math.min(Math.max(1, value), 20));
                  }}
                  onBlur={fetchChartsData}
                  className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">من:</label>
                <input
                  type="date"
                  value={topProductsStartDate}
                  onChange={(e) => setTopProductsStartDate(e.target.value)}
                  onBlur={fetchChartsData}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">إلى:</label>
                <input
                  type="date"
                  value={topProductsEndDate}
                  onChange={(e) => setTopProductsEndDate(e.target.value)}
                  onBlur={fetchChartsData}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>
          {loadingCharts ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
            </div>
          ) : topProducts.length > 0 ? (
            <div className="pt-11">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart 
                  data={topProducts} 
                  margin={{ top: 20, right: 20, left: 20, bottom: 60 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={document.documentElement.classList.contains('dark') ? '#44403c' : '#e7e5e4'} />
                  <XAxis 
                    dataKey="name" 
                    angle={0} 
                    textAnchor="middle" 
                    height={60}
                    tick={{ 
                      fontSize: 14,
                      fill: document.documentElement.classList.contains('dark') ? '#d6d3d1' : '#44403c',
                      fontWeight: 600
                    }}
                    stroke={document.documentElement.classList.contains('dark') ? '#a8a29e' : '#78716c'}
                    interval={0}
                  />
                  <YAxis 
                    width={50}
                    tick={{ 
                      fontSize: 12,
                      fill: document.documentElement.classList.contains('dark') ? '#d6d3d1' : '#44403c',
                      fontWeight: 500
                    }}
                    stroke={document.documentElement.classList.contains('dark') ? '#a8a29e' : '#78716c'}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="sales" 
                    name="الكمية المباعة"
                    radius={[4, 4, 0, 0]}
                  >
                    {topProducts.map((entry, index) => {
                      const colors = ['#FFD700', '#10B981', '#3B82F6', '#F59E0B', '#EF4444'];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Custom Legend */}
              <div className="flex flex-wrap justify-center gap-4 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                {topProducts.map((product, index) => {
                  const colors = ['#FFD700', '#10B981', '#3B82F6', '#F59E0B', '#EF4444'];
                  const colorNames = ['ذهبي', 'أخضر', 'أزرق', 'برتقالي', 'أحمر'];
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: colors[index % colors.length] }}
                      ></div>
                      <span className="text-base font-medium text-gray-700 dark:text-gray-300">
                        {product.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              لا توجد بيانات متاحة
            </div>
          )}
        </div>

        {/* Stock Distribution */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">توزيع المخزون</h2>
          {loadingCharts ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
            </div>
          ) : stockData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={stockData}
                    cx="50%"
                    cy="45%"
                    labelLine={false}
                    label={false}
                    outerRadius={120}
                    fill="#FFD700"
                    dataKey="value"
                  >
                    {stockData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <CustomPieLegend stockData={stockData} />
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              لا توجد بيانات متاحة
            </div>
          )}
        </div>
      </div>

      {/* Unpaid Invoices Table */}
      {unpaidInvoices.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-red-500" size={24} />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">الفواتير غير المدفوعة</h2>
            </div>
            <button
              onClick={() => navigate('/admin/invoices?status=pending&type=client')}
              className="btn-secondary text-sm"
            >
              عرض الكل
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    رقم الفاتورة
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    العميل
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    الإجمالي
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    المدفوع
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    المتبقي
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    تاريخ الاستحقاق
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    الحالة
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {unpaidInvoices.map((invoice) => (
                  <tr key={invoice._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {invoice.clientName || invoice.displayName || 'غير محدد'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {invoice.total?.toLocaleString() || 0} TND
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {invoice.paidAmount?.toLocaleString() || 0} TND
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600 dark:text-red-400">
                      {invoice.remainingAmount?.toLocaleString() || invoice.total?.toLocaleString() || 0} TND
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('fr-FR') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          invoice.status === 'overdue'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : invoice.status === 'partial'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                        }`}
                      >
                        {invoice.status === 'overdue' ? 'متأخرة' : 
                         invoice.status === 'partial' ? 'جزئية' : 
                         invoice.status === 'pending' ? 'قيد الانتظار' : 
                         invoice.status || 'غير محدد'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Low Stock Products Table */}
      {lowStockProducts.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-red-500" size={24} />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">المنتجات ذات المخزون المنخفض</h2>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">فلتر:</label>
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className="px-4 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
              >
                <option value="all">الكل</option>
                <option value="low">منخفض</option>
                <option value="out">نفد</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    اسم المنتج
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    الفئة
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    المخزون المتاح
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    الحالة
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {lowStockProducts
                  .flatMap((product) => {
                    // If product has variants, create a row for each variant with low stock
                    if (product.variants && product.variants.length > 0) {
                      return product.variants
                        .map((variant) => ({
                          productId: product._id,
                          productName: product.name,
                          category: product.category,
                          variantName: product.variantName || 'المتغير',
                          variantValue: variant.value,
                          stock: variant.stock,
                          isVariant: true,
                        }));
                    }
                    // If no variants, show general product stock
                    return [{
                      productId: product._id,
                      productName: product.name,
                      category: product.category,
                      variantName: null,
                      variantValue: null,
                      stock: product.stock || 0,
                      isVariant: false,
                    }];
                  })
                  .filter((item) => {
                    // Apply filter based on stockFilter state
                    if (stockFilter === 'low') {
                      return item.stock > 0; // Only low stock (not out)
                    } else if (stockFilter === 'out') {
                      return item.stock === 0; // Only out of stock
                    }
                    return true; // Show all
                  })
                  .map((item, index) => (
                    <tr key={`${item.productId}-${item.variantValue || 'general'}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {item.productName}
                        {item.isVariant && (
                          <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {item.variantName}: {item.variantValue}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {item.category?.name || 'غير محدد'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {item.stock || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            item.stock === 0
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}
                        >
                          {item.stock === 0 ? 'نفد' : 'منخفض'}
                        </span>
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

export default Dashboard;

