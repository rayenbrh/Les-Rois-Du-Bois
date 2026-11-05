import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import {
  Package,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  XCircle,
  Filter,
  Download,
  RefreshCw,
  ArrowRight,
  BarChart3,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const OrdersProductsAnalytics = () => {
  const navigate = useNavigate();

  // Filters state
  const [filters, setFilters] = useState({
    source: 'all', // 'all', 'ecommerce', 'pos', 'page'
    dateRange: 'month', // 'today', 'week', 'month', 'custom'
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  // Data state
  const [analytics, setAnalytics] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [productsAnalytics, setProductsAnalytics] = useState([]);
  const [ordersTable, setOrdersTable] = useState([]);
  const [revenueOverTime, setRevenueOverTime] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'orders', 'products'

  useEffect(() => {
    if (filters.dateRange !== 'custom') {
      updateDateRange();
    }
    fetchAllData();
  }, [filters.source, filters.dateRange]);

  useEffect(() => {
    if (filters.dateRange === 'custom') {
      fetchAllData();
    }
  }, [filters.startDate, filters.endDate]);

  const updateDateRange = () => {
    const today = new Date();
    let start, end;

    switch (filters.dateRange) {
      case 'today':
        start = new Date(today);
        start.setHours(0, 0, 0, 0);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        start = new Date(today);
        start.setDate(today.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      case 'month':
        start = new Date(today);
        start.setMonth(today.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      default:
        return;
    }

    setFilters(prev => ({
      ...prev,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    }));
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const params = {
        source: filters.source,
        startDate: filters.startDate,
        endDate: filters.endDate,
      };

      const [
        analyticsRes,
        comparisonRes,
        productsRes,
        ordersRes,
        revenueRes,
      ] = await Promise.all([
        api.get('/analytics/orders-products', { params }),
        api.get('/analytics/orders-products/comparison', { params: { startDate: filters.startDate, endDate: filters.endDate } }),
        api.get('/analytics/orders-products/products', { params }),
        api.get('/analytics/orders-products/orders-table', { params }),
        api.get('/analytics/orders-products/revenue-over-time', { params }),
      ]);

      setAnalytics(analyticsRes.data.data);
      setComparison(comparisonRes.data.data);
      setProductsAnalytics(productsRes.data.data || []);
      setOrdersTable(ordersRes.data.data || []);
      setRevenueOverTime(revenueRes.data.data || []);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('حدث خطأ أثناء جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      source: 'all',
      dateRange: 'month',
      startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    });
  };

  const handleGeneratePDF = async () => {
    try {
      toast.loading('جاري إنشاء تقرير PDF...', { id: 'generate-pdf' });

      const params = {
        source: filters.source,
        startDate: filters.startDate,
        endDate: filters.endDate,
      };

      const response = await api.get('/analytics/orders-products/pdf', {
        params,
        responseType: 'blob',
        validateStatus: (status) => status < 500,
      });

      // Check if response is actually a PDF or an error JSON
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/json') || response.status >= 400) {
        // It's an error response
        try {
          const text = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsText(response.data);
          });
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || 'حدث خطأ أثناء إنشاء ملف PDF');
        } catch (parseError) {
          throw new Error(response.statusText || 'حدث خطأ أثناء إنشاء ملف PDF');
        }
      }

      // It's a valid PDF
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const fileName = `orders-products-analytics-${filters.startDate || 'all'}-${filters.endDate || 'all'}.pdf`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('تم تحميل تقرير PDF بنجاح', { id: 'generate-pdf' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      let errorMessage = 'حدث خطأ أثناء إنشاء ملف PDF';

      if (error.response?.data) {
        try {
          const text = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsText(error.response.data);
          });
          const errorData = JSON.parse(text);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If parsing fails, use default message
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage, { id: 'generate-pdf', duration: 5000 });
    }
  };

  const sourceLabels = {
    ecommerce: 'E-commerce',
    pos: 'المتجر / POS',
    page: 'الصفحة / Social / WhatsApp',
  };

  const priceTypeLabels = {
    gros: 'Prix en Gros',
    detail: 'Prix en Détail',
    page: 'Prix sur Page',
  };

  const COLORS = ['#FFD700', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={() => navigate('/admin/analytics')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
            title="رجوع"
          >
            <ArrowRight size={20} className="md:w-6 md:h-6" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
              تحليلات الطلبيات والمنتجات
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
              تحليل شامل للطلبيات والمنتجات من جميع المصادر
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary flex items-center justify-center gap-2 text-sm md:text-base px-3 md:px-4 py-2"
          >
            <Filter size={18} className="md:w-5 md:h-5" />
            <span className="hidden sm:inline">{showFilters ? 'إخفاء الفلاتر' : 'عرض الفلاتر'}</span>
            <span className="sm:hidden">فلاتر</span>
          </button>
          <button
            onClick={handleGeneratePDF}
            className="btn-primary flex items-center justify-center gap-2 text-sm md:text-base px-3 md:px-4 py-2"
          >
            <Download size={18} className="md:w-5 md:h-5" />
            <span className="hidden sm:inline">إنشاء تقرير PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <button
            onClick={fetchAllData}
            className="btn-secondary flex items-center justify-center gap-2 text-sm md:text-base px-3 md:px-4 py-2"
          >
            <RefreshCw size={18} className="md:w-5 md:h-5" />
            <span className="hidden sm:inline">تحديث</span>
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="card p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Filter size={20} className="md:w-6 md:h-6" />
            الفلاتر
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Source Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                مصدر الطلب
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => handleFilterChange('source', 'all')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    filters.source === 'all'
                      ? 'bg-gold-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  الكل
                </button>
                <button
                  onClick={() => handleFilterChange('source', 'ecommerce')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    filters.source === 'ecommerce'
                      ? 'bg-gold-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  E-commerce
                </button>
                <button
                  onClick={() => handleFilterChange('source', 'pos')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    filters.source === 'pos'
                      ? 'bg-gold-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  المتجر / POS
                </button>
                <button
                  onClick={() => handleFilterChange('source', 'page')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    filters.source === 'page'
                      ? 'bg-gold-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  الصفحة
                </button>
              </div>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                الفترة الزمنية
              </label>
              <select
                value={filters.dateRange}
                onChange={(e) => {
                  handleFilterChange('dateRange', e.target.value);
                  if (e.target.value !== 'custom') {
                    updateDateRange();
                  }
                }}
                className="input-field"
              >
                <option value="today">اليوم</option>
                <option value="week">هذا الأسبوع</option>
                <option value="month">هذا الشهر</option>
                <option value="custom">مخصص</option>
              </select>
            </div>
          </div>

          {/* Custom Date Range */}
          {filters.dateRange === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  من تاريخ
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  إلى تاريخ
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
          )}

          {/* Reset Button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={resetFilters}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw size={18} />
              <span>إعادة تعيين الفلاتر</span>
            </button>
          </div>
        </div>
      )}

      {!analytics ? (
        <div className="text-center py-12">
          <p className="text-gray-500">لا توجد بيانات</p>
        </div>
      ) : (
        <>
          {/* Overall KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
            <KPICard
              title="إجمالي الطلبيات"
              value={analytics.overall.totalOrders}
              icon={ShoppingCart}
              color="text-blue-500"
            />
            <KPICard
              title="إجمالي الإيرادات"
              value={`${analytics.overall.totalRevenue.toFixed(2)} TND`}
              icon={DollarSign}
              color="text-gold-500"
            />
           <KPICard
              title="الربح"
              value={`${(analytics.overall.totalProfit || 0).toFixed(2)} TND`}
              icon={TrendingUp}
              color="text-green-500"
            />
            <KPICard
              title="متوسط قيمة الطلب"
              value={`${analytics.overall.averageOrderValue.toFixed(2)} TND`}
              icon={TrendingUp}
              color="text-blue-500"
            />
            
            <KPICard
              title="الطلبيات الملغاة"
              value={analytics.overall.canceledOrders}
              icon={XCircle}
              color="text-red-500"
            />
          </div>

          {/* KPIs by Source */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {Object.entries(analytics.bySource).map(([source, data]) => (
              <div key={source} className="card">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                  {sourceLabels[source] || source}
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">الطلبيات:</span>
                    <span className="font-medium">{data.totalOrders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">الإيرادات:</span>
                    <span className="font-medium text-gold-600">{data.totalRevenue.toFixed(2)} TND</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">الربح:</span>
                    <span className="font-medium text-green-600">{(data.totalRevenue - (data.totalCost || 0)).toFixed(2)} TND</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">متوسط الطلب:</span>
                    <span className="font-medium">{data.averageOrderValue.toFixed(2)} TND</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">المنتجات المباعة:</span>
                    <span className="font-medium">{data.totalItems}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">ملغاة:</span>
                    <span className="font-medium text-red-600">{data.canceledOrders}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue Over Time Chart */}
          {revenueOverTime.length > 0 && (
            <div className="card p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                الإيرادات عبر الزمن حسب المصدر
              </h2>
              <ResponsiveContainer width="100%" height={250} className="md:h-[300px]">
                <LineChart data={revenueOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="ecommerce"
                    stroke="#FFD700"
                    name="E-commerce"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="pos"
                    stroke="#3B82F6"
                    name="المتجر / POS"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="page"
                    stroke="#10B981"
                    name="الصفحة"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Comparison Section */}
          {comparison && (
            <div className="card p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                مقارنة مصادر الطلبيات
              </h2>
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <div className="inline-block min-w-full align-middle">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-right py-3 px-4 text-sm font-medium">المقياس</th>
                      <th className="text-right py-3 px-4 text-sm font-medium">E-commerce</th>
                      <th className="text-right py-3 px-4 text-sm font-medium">المتجر / POS</th>
                      <th className="text-right py-3 px-4 text-sm font-medium">الصفحة</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-3 px-4 font-medium">إجمالي الطلبيات</td>
                      <td className="py-3 px-4">{comparison.ecommerce.totalOrders}</td>
                      <td className="py-3 px-4">{comparison.pos.totalOrders}</td>
                      <td className="py-3 px-4">{comparison.page.totalOrders}</td>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-3 px-4 font-medium">إجمالي الإيرادات</td>
                      <td className="py-3 px-4 text-gold-600">{comparison.ecommerce.revenue.toFixed(2)} TND</td>
                      <td className="py-3 px-4 text-gold-600">{comparison.pos.revenue.toFixed(2)} TND</td>
                      <td className="py-3 px-4 text-gold-600">{comparison.page.revenue.toFixed(2)} TND</td>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-3 px-4 font-medium">الربح</td>
                      <td className="py-3 px-4 text-green-600">{(comparison.ecommerce.profit || 0).toFixed(2)} TND</td>
                      <td className="py-3 px-4 text-green-600">{(comparison.pos.profit || 0).toFixed(2)} TND</td>
                      <td className="py-3 px-4 text-green-600">{(comparison.page.profit || 0).toFixed(2)} TND</td>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-3 px-4 font-medium">الربح</td>
                      <td className="py-3 px-4 text-green-600">{(comparison.ecommerce.profit || 0).toFixed(2)} TND</td>
                      <td className="py-3 px-4 text-green-600">{(comparison.pos.profit || 0).toFixed(2)} TND</td>
                      <td className="py-3 px-4 text-green-600">{(comparison.page.profit || 0).toFixed(2)} TND</td>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-3 px-4 font-medium">متوسط السعر</td>
                      <td className="py-3 px-4">{comparison.ecommerce.avgPrice.toFixed(2)} TND</td>
                      <td className="py-3 px-4">{comparison.pos.avgPrice.toFixed(2)} TND</td>
                      <td className="py-3 px-4">{comparison.page.avgPrice.toFixed(2)} TND</td>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-3 px-4 font-medium">المنتجات المباعة</td>
                      <td className="py-3 px-4">{comparison.ecommerce.itemsSold}</td>
                      <td className="py-3 px-4">{comparison.pos.itemsSold}</td>
                      <td className="py-3 px-4">{comparison.page.itemsSold}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-medium">الطلبيات الملغاة</td>
                      <td className="py-3 px-4 text-red-600">{comparison.ecommerce.cancellations}</td>
                      <td className="py-3 px-4 text-red-600">{comparison.pos.cancellations}</td>
                      <td className="py-3 px-4 text-red-600">{comparison.page.cancellations}</td>
                    </tr>
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}

          {/* Revenue Share Pie Chart */}
          {analytics && (
            <div className="card p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                توزيع الإيرادات حسب المصدر
              </h2>
              <ResponsiveContainer width="100%" height={250} className="md:h-[300px]">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'E-commerce', value: analytics.bySource.ecommerce.totalRevenue },
                      { name: 'المتجر / POS', value: analytics.bySource.pos.totalRevenue },
                      { name: 'الصفحة', value: analytics.bySource.page.totalRevenue },
                    ].filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[
                      { name: 'E-commerce', value: analytics.bySource.ecommerce.totalRevenue },
                      { name: 'المتجر / POS', value: analytics.bySource.pos.totalRevenue },
                      { name: 'الصفحة', value: analytics.bySource.page.totalRevenue },
                    ].filter(item => item.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabs for Orders and Products Tables */}
          <div className="card p-4 md:p-6">
            <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
              <div className="flex gap-2 md:gap-4 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-3 md:px-4 py-2 text-sm md:text-base font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'overview'
                      ? 'border-gold-600 text-gold-600'
                      : 'border-transparent text-gray-600 dark:text-gray-400'
                  }`}
                >
                  نظرة عامة
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`px-3 md:px-4 py-2 text-sm md:text-base font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'orders'
                      ? 'border-gold-600 text-gold-600'
                      : 'border-transparent text-gray-600 dark:text-gray-400'
                  }`}
                >
                  جدول الطلبيات
                </button>
                <button
                  onClick={() => setActiveTab('products')}
                  className={`px-3 md:px-4 py-2 text-sm md:text-base font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'products'
                      ? 'border-gold-600 text-gold-600'
                      : 'border-transparent text-gray-600 dark:text-gray-400'
                  }`}
                >
                  تحليلات المنتجات
                </button>
              </div>
            </div>

            {activeTab === 'orders' && (
              <OrdersTableComponent orders={ordersTable} filters={filters} />
            )}

            {activeTab === 'products' && (
              <ProductsAnalyticsComponent products={productsAnalytics} />
            )}
          </div>
        </>
      )}
    </div>
  );
};

// KPI Card Component
const KPICard = ({ title, value, icon: Icon, color }) => {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{value}</p>
        </div>
        <Icon className={color} size={32} />
      </div>
    </div>
  );
};

// Orders Table Component
const OrdersTableComponent = ({ orders, filters }) => {
  const sourceLabels = {
    ecommerce: 'E-commerce',
    pos: 'المتجر / POS',
    page: 'الصفحة',
  };

  const priceTypeLabels = {
    gros: 'Prix en Gros',
    detail: 'Prix en Détail',
    page: 'Prix sur Page',
  };

  return (
    <div className="overflow-x-auto -mx-4 md:mx-0">
      <div className="inline-block min-w-full align-middle">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-right py-3 px-4 text-sm font-medium">رقم الطلب</th>
            <th className="text-right py-3 px-4 text-sm font-medium">المصدر</th>
            <th className="text-right py-3 px-4 text-sm font-medium">نوع السعر</th>
            <th className="text-right py-3 px-4 text-sm font-medium">المنتجات</th>
            <th className="text-right py-3 px-4 text-sm font-medium">المجموع</th>
            <th className="text-right py-3 px-4 text-sm font-medium">التاريخ</th>
            <th className="text-right py-3 px-4 text-sm font-medium">الحالة</th>
            <th className="text-right py-3 px-4 text-sm font-medium">العميل</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan="8" className="py-8 text-center text-gray-500">
                لا توجد طلبيات
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr
                key={order._id}
                className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <td className="py-3 px-4 font-medium">{order.orderNumber}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    order.source === 'ecommerce'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : order.source === 'pos'
                      ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                      : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  }`}>
                    {sourceLabels[order.source] || order.source}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm">{priceTypeLabels[order.priceType] || order.priceType}</td>
                <td className="py-3 px-4 text-sm">
                  {order.products?.map((p, idx) => (
                    <div key={idx} className="text-xs">
                      {p.name} x{p.quantity}
                    </div>
                  ))}
                </td>
                <td className="py-3 px-4 font-medium">{order.total} TND</td>
                <td className="py-3 px-4 text-sm">
                  {new Date(order.date).toLocaleDateString('fr-FR')}
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    order.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : order.status === 'canceled'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm">{order.customer}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
};

// Products Analytics Component
const ProductsAnalyticsComponent = ({ products }) => {
  return (
    <div className="space-y-6">
      {/* Top Products Chart */}
      {products.length > 0 && (
        <div>
          <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
            أفضل المنتجات مبيعاً
          </h3>
          <ResponsiveContainer width="100%" height={250} className="md:h-[300px]">
            <BarChart data={products.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="productName" type="category" width={150} />
              <Tooltip />
              <Legend />
              <Bar dataKey="totalRevenue" fill="#FFD700" name="إجمالي الإيرادات" />
              <Bar dataKey="profit" fill="#10B981" name="الربح" />
              <Bar dataKey="totalQuantity" fill="#8B5CF6" name="الكمية" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Products Table */}
      <div>
        <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          جدول المنتجات
        </h3>
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <div className="inline-block min-w-full align-middle">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-right py-3 px-4 text-sm font-medium">المنتج</th>
                <th className="text-right py-3 px-4 text-sm font-medium">الكمية المباعة</th>
                <th className="text-right py-3 px-4 text-sm font-medium">إجمالي الإيرادات</th>
                <th className="text-right py-3 px-4 text-sm font-medium">الربح</th>
                <th className="text-right py-3 px-4 text-sm font-medium">الملغاة</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-gray-500">
                    لا توجد منتجات
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr
                    key={product.productId}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-4 font-medium">{product.productName}</td>
                    <td className="py-3 px-4">{product.totalQuantity}</td>
                    <td className="py-3 px-4 text-gold-600 font-medium">
                      {product.totalRevenue.toFixed(2)} TND
                    </td>
                    <td className={`py-3 px-4 font-medium ${(product.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(product.profit || 0).toFixed(2)} TND
                    </td>
                    <td className="py-3 px-4 text-red-600">{product.canceledQuantity || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrdersProductsAnalytics;
