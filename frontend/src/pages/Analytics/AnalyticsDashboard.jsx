import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { BarChart3, TrendingUp, DollarSign, Package, Users } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const AnalyticsDashboard = () => {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [salesData, setSalesData] = useState([]);
  const [revenueByCategory, setRevenueByCategory] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
    avgOrderValue: 0,
    totalItemsSold: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [salesRes, categoryRes, productsRes, profitabilityRes] = await Promise.all([
        api.get('/analytics/sales-over-time', {
          params: { startDate: dateRange.startDate, endDate: dateRange.endDate, groupBy: 'month' },
        }),
        api.get('/analytics/revenue-by-category', {
          params: { startDate: dateRange.startDate, endDate: dateRange.endDate },
        }),
        api.get('/analytics/top-products', {
          params: { startDate: dateRange.startDate, endDate: dateRange.endDate, limit: 5 },
        }),
        api.get('/analytics/profitability', {
          params: { startDate: dateRange.startDate, endDate: dateRange.endDate },
        }),
      ]);

      // Format sales data
      const formattedSalesData = (salesRes.data.data || []).map((item) => ({
        date: item.date,
        sales: item.sales || 0,
        revenue: item.revenue || 0,
        profit: item.profit || 0,
      }));
      setSalesData(formattedSalesData);

      // Format category data - API returns 'category' but chart needs 'name'
      const formattedCategoryData = (categoryRes.data.data || []).map((item) => ({
        name: item.category || item.name || 'غير محدد',
        revenue: item.revenue || 0,
      }));
      setRevenueByCategory(formattedCategoryData);

      // Format products data - API returns 'productName' but chart needs 'name', and 'quantity' for sales
      const formattedProductsData = (productsRes.data.data || []).map((item) => ({
        name: item.productName || item.name || 'غير محدد',
        sales: item.quantity || 0,
        revenue: item.revenue || 0,
        profit: item.profit || 0,
      }));
      setTopProducts(formattedProductsData);

      // Set statistics from profitability endpoint
      const profitabilityData = profitabilityRes.data.data || {};
      setStats({
        totalSales: profitabilityData.orders || 0,
        totalRevenue: profitabilityData.revenue || 0,
        totalProfit: profitabilityData.profit || 0,
        avgOrderValue: parseFloat(profitabilityData.avgOrderValue || 0),
        totalItemsSold: profitabilityData.totalItemsSold || 0,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('حدث خطأ أثناء جلب البيانات');
      // Set empty data on error
      setSalesData([]);
      setRevenueByCategory([]);
      setTopProducts([]);
      setStats({
        totalSales: 0,
        totalRevenue: 0,
        totalProfit: 0,
        avgOrderValue: 0,
        totalItemsSold: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">التقارير والتحليلات</h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">تحليل شامل للأداء</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 md:gap-4">
          <button
            onClick={() => navigate('/admin/analytics/orders-products')}
            className="btn-secondary flex items-center justify-center gap-2 text-sm md:text-base px-3 md:px-4 py-2"
          >
            <Package size={18} className="md:w-5 md:h-5" />
            <span className="hidden sm:inline">تحليلات الطلبيات والمنتجات</span>
            <span className="sm:hidden">الطلبيات</span>
          </button>
          <button
            onClick={() => navigate('/admin/analytics/commercials')}
            className="btn-secondary flex items-center justify-center gap-2 text-sm md:text-base px-3 md:px-4 py-2"
          >
            <Users size={18} className="md:w-5 md:h-5" />
            <span className="hidden sm:inline">تحليلات المندوبين</span>
            <span className="sm:hidden">المندوبين</span>
          </button>
          <div className="flex gap-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="input-field text-sm md:text-base px-2 md:px-3 py-2"
            />
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="input-field text-sm md:text-base px-2 md:px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                </div>
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">إجمالي المبيعات</p>
                <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-gray-100">
                  {stats.totalSales.toLocaleString()}
                </p>
              </div>
              <TrendingUp className="text-gold-500" size={32} />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">إجمالي الإيرادات</p>
                <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-gray-100">
                  {stats.totalRevenue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND
                </p>
              </div>
              <DollarSign className="text-gold-500" size={32} />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">الربح</p>
                <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-gray-100">
                  {stats.totalProfit.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND
                </p>
              </div>
              <DollarSign className="text-green-500" size={32} />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">متوسط الطلب</p>
                <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-gray-100">
                  {stats.avgOrderValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND
                </p>
              </div>
              <BarChart3 className="text-gold-500" size={32} />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">المنتجات المباعة</p>
                <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-gray-100">
                  {stats.totalItemsSold.toLocaleString()}
                </p>
              </div>
              <Package className="text-gold-500" size={32} />
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`card p-4 md:p-6 animate-pulse ${i === 2 ? 'lg:col-span-2' : ''}`}>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
              <div className="h-[250px] md:h-[300px] bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div className="card p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">المبيعات والإيرادات</h2>
            {salesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250} className="md:h-[300px]">
                <LineChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => {
                      if (name === 'revenue' || name === 'profit') {
                        return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND`;
                      }
                      return value;
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="sales" stroke="#3b82f6" name="المبيعات" />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" name="الإيرادات" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] md:h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
                لا توجد بيانات متاحة
              </div>
            )}
          </div>

          <div className="card p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">الإيرادات حسب الفئة</h2>
            {revenueByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={250} className="md:h-[300px]">
                <PieChart>
                  <Pie
                    data={revenueByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="revenue"
                  >
                    {revenueByCategory.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={['#3b82f6', '#10b981', '#FFD700', '#ef4444', '#8b5cf6'][index % 5]}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND`}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] md:h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
                لا توجد بيانات متاحة
              </div>
            )}
          </div>

          <div className="card lg:col-span-2 p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">أفضل المنتجات</h2>
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={250} className="md:h-[300px]">
                <BarChart data={topProducts}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => {
                      if (name === 'revenue' || name === 'profit') {
                        return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND`;
                      }
                      return value;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="sales" fill="#3b82f6" name="المبيعات" />
                  <Bar dataKey="revenue" fill="#10b981" name="الإيرادات" />
                  <Bar dataKey="profit" fill="#22c55e" name="الربح" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] md:h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
                لا توجد بيانات متاحة
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;

