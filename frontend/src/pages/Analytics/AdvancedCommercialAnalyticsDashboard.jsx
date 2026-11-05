import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { 
  DollarSign, 
  TrendingUp, 
  FileText, 
  Package, 
  Users, 
  XCircle,
  Filter,
  Download,
  RefreshCw,
  Calendar,
  UserCheck,
  ShoppingCart,
  AlertCircle
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
  ResponsiveContainer 
} from 'recharts';
import OrdersTable from '../../components/Analytics/OrdersTable';
import ExpensesTable from '../../components/Analytics/ExpensesTable';
import SmartAlerts from '../../components/Analytics/SmartAlerts';

const AdvancedCommercialAnalyticsDashboard = () => {
  const navigate = useNavigate();
  
  // State for filters
  const [filters, setFilters] = useState({
    commercialIds: 'all',
    orderSource: 'all', // 'all', 'ecommerce', 'pos'
    dateRange: 'month', // 'today', 'week', 'month', 'custom'
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    expenseCategory: 'all',
  });

  // State for data
  const [analytics, setAnalytics] = useState([]);
  const [commercials, setCommercials] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [ordersBreakdown, setOrdersBreakdown] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [expenseAnalytics, setExpenseAnalytics] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [cancellationData, setCancellationData] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'orders', 'expenses'

  // Fetch commercials list
  useEffect(() => {
    fetchCommercials();
  }, []);

  // Fetch analytics when filters change
  useEffect(() => {
    if (filters.dateRange !== 'custom') {
      updateDateRange();
    }
    fetchAllAnalytics();
  }, [filters.commercialIds, filters.orderSource, filters.dateRange, filters.expenseCategory]);

  // Fetch analytics when custom dates change
  useEffect(() => {
    if (filters.dateRange === 'custom') {
      fetchAllAnalytics();
    }
  }, [filters.startDate, filters.endDate]);

  const fetchCommercials = async () => {
    try {
      const response = await api.get('/users', { params: { role: 'commercial' } });
      setCommercials(response.data.data || []);
    } catch (error) {
      console.error('Error fetching commercials:', error);
    }
  };

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

  const fetchAllAnalytics = async () => {
    try {
      setLoading(true);
      
      const params = {
        commercialIds: filters.commercialIds,
        orderSource: filters.orderSource,
        startDate: filters.startDate,
        endDate: filters.endDate,
        expenseCategory: filters.expenseCategory,
      };

      // Fetch all analytics in parallel
      const [
        overviewRes,
        revenueRes,
        ordersRes,
        productsRes,
        expensesRes,
        leaderboardRes,
        cancellationsRes,
      ] = await Promise.all([
        api.get('/analytics/commercials/advanced/overview', { params }),
        api.get('/analytics/commercials/advanced/revenue-over-time', { params }),
        api.get('/analytics/commercials/advanced/orders-breakdown', { params }),
        api.get('/analytics/commercials/advanced/top-products', { params: { ...params, limit: 10 } }),
        api.get('/analytics/commercials/advanced/expense-analytics', { params }),
        api.get('/analytics/commercials/advanced/leaderboard', { params }),
        api.get('/analytics/commercials/advanced/cancellations', { params }),
      ]);

      setAnalytics(overviewRes.data.data || []);
      setRevenueData(revenueRes.data.data || []);
      setOrdersBreakdown(ordersRes.data.data || null);
      setTopProducts(productsRes.data.data || []);
      setExpenseAnalytics(expensesRes.data.data || null);
      setLeaderboard(leaderboardRes.data.data || []);
      setCancellationData(cancellationsRes.data.data || null);
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
      commercialIds: 'all',
      orderSource: 'all',
      dateRange: 'month',
      startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      expenseCategory: 'all',
    });
  };

  const handleExportPDF = async () => {
    try {
      toast.loading('جاري إنشاء ملف PDF...', { id: 'export-pdf' });

      const params = {
        commercialIds: filters.commercialIds,
        orderSource: filters.orderSource,
        startDate: filters.startDate,
        endDate: filters.endDate,
        expenseCategory: filters.expenseCategory,
      };

      const response = await api.get('/analytics/commercials/advanced/export/pdf', {
        params,
        responseType: 'blob',
      });

      // Check if response is error
      const contentType = response.headers['content-type'];
      if (contentType && contentType.includes('application/json')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const errorData = JSON.parse(e.target.result);
          toast.error(`حدث خطأ: ${errorData.message || 'خطأ غير معروف'}`, { id: 'export-pdf' });
        };
        reader.readAsText(response.data);
        return;
      }

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const fileName = `advanced-analytics-${filters.startDate}_${filters.endDate}.pdf`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('تم تحميل ملف PDF بنجاح', { id: 'export-pdf' });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      const errorMessage = error.response?.data?.message || error.message || 'حدث خطأ غير معروف';
      toast.error(`حدث خطأ أثناء إنشاء ملف PDF: ${errorMessage}`, { id: 'export-pdf' });
    }
  };

  // Calculate aggregated KPIs
  const aggregatedKPIs = analytics.reduce((acc, item) => {
    acc.totalRevenue += item.totalRevenue || 0;
    acc.totalOrders += item.totalOrders || 0;
    acc.totalExpenses += item.totalExpenses || 0;
    acc.canceledOrders += item.canceledOrders || 0;
    acc.totalCustomers += item.totalCustomersReached || 0;
    acc.ecommerceRevenue += item.ecommerceRevenue || 0;
    acc.posRevenue += item.posRevenue || 0;
    return acc;
  }, {
    totalRevenue: 0,
    totalOrders: 0,
    totalExpenses: 0,
    canceledOrders: 0,
    totalCustomers: 0,
    ecommerceRevenue: 0,
    posRevenue: 0,
  });

  const totalProfit = aggregatedKPIs.totalRevenue - aggregatedKPIs.totalExpenses;
  const averageOrderValue = aggregatedKPIs.totalOrders > 0 
    ? aggregatedKPIs.totalRevenue / aggregatedKPIs.totalOrders 
    : 0;
  const conversionRate = 0; // Placeholder
  const expenseToRevenueRatio = aggregatedKPIs.totalRevenue > 0
    ? (aggregatedKPIs.totalExpenses / aggregatedKPIs.totalRevenue) * 100
    : 0;

  // Chart colors
  const COLORS = ['#FFD700', '#FFA500', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899'];

  // Expense breakdown data
  const expenseBreakdown = expenseAnalytics?.breakdown ? [
    { name: 'وقود', value: expenseAnalytics.breakdown.fuel || 0 },
    { name: 'رسوم الطريق السريع', value: expenseAnalytics.breakdown.toll || 0 },
    { name: 'نقل', value: expenseAnalytics.breakdown.transport || 0 },
    { name: 'أخرى', value: expenseAnalytics.breakdown.other || 0 },
  ].filter(item => item.value > 0) : [];

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            لوحة تحليلات المندوبين المتقدمة
          </h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
            تحليل شامل لأداء المندوبين التجاريين مع فلاتر متقدمة
          </p>
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
            onClick={handleExportPDF}
            className="btn-secondary flex items-center justify-center gap-2 text-sm md:text-base px-3 md:px-4 py-2"
          >
            <Download size={18} className="md:w-5 md:h-5" />
            <span className="hidden sm:inline">تصدير PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <button
            onClick={fetchAllAnalytics}
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
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Commercial Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                المندوب التجاري
              </label>
              <select
                value={filters.commercialIds}
                onChange={(e) => handleFilterChange('commercialIds', e.target.value)}
                className="input-field"
              >
                <option value="all">جميع المندوبين</option>
                {commercials.map((commercial) => (
                  <option key={commercial._id} value={commercial._id}>
                    {commercial.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Order Source Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                مصدر الطلب
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleFilterChange('orderSource', 'all')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    filters.orderSource === 'all'
                      ? 'bg-gold-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  الكل
                </button>
                <button
                  onClick={() => handleFilterChange('orderSource', 'ecommerce')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    filters.orderSource === 'ecommerce'
                      ? 'bg-gold-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  E-commerce
                </button>
                <button
                  onClick={() => handleFilterChange('orderSource', 'pos')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    filters.orderSource === 'pos'
                      ? 'bg-gold-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  POS
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

            {/* Expense Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                فئة المصروفات
              </label>
              <select
                value={filters.expenseCategory}
                onChange={(e) => handleFilterChange('expenseCategory', e.target.value)}
                className="input-field"
              >
                <option value="all">جميع الفئات</option>
                <option value="fuel">وقود</option>
                <option value="toll">رسوم الطريق السريع</option>
                <option value="transport">نقل</option>
                <option value="other">أخرى</option>
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

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
        </div>
      ) : (
        <>
          {/* Smart Alerts */}
          <SmartAlerts analytics={analytics} />

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
            <KPICard
              title="إجمالي الإيرادات"
              value={`${aggregatedKPIs.totalRevenue.toFixed(2)} TND`}
              icon={DollarSign}
              color="text-gold-500"
            />
            <KPICard
              title="الربح"
              value={`${(aggregatedKPIs.totalRevenue - aggregatedKPIs.totalExpenses).toFixed(2)} TND`}
              icon={DollarSign}
              color="text-green-500"
            />
            <KPICard
              title="عدد الطلبيات"
              value={aggregatedKPIs.totalOrders}
              icon={Package}
              color="text-blue-500"
            />
            <KPICard
              title="متوسط قيمة الطلبية"
              value={`${averageOrderValue.toFixed(2)} TND`}
              icon={TrendingUp}
              color="text-green-500"
            />
            <KPICard
              title="صافي الربح"
              value={`${totalProfit.toFixed(2)} TND`}
              icon={TrendingUp}
              color={totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}
            />
            <KPICard
              title="إجمالي المصروفات"
              value={`${aggregatedKPIs.totalExpenses.toFixed(2)} TND`}
              icon={FileText}
              color="text-red-500"
            />
            <KPICard
              title="الطلبيات الملغاة"
              value={aggregatedKPIs.canceledOrders}
              icon={XCircle}
              color="text-orange-500"
            />
            <KPICard
              title="عدد العملاء"
              value={aggregatedKPIs.totalCustomers}
              icon={Users}
              color="text-purple-500"
            />
            <KPICard
              title="نسبة المصروفات"
              value={`${expenseToRevenueRatio.toFixed(2)}%`}
              icon={FileText}
              color="text-yellow-500"
            />
          </div>

          {/* Revenue Over Time Chart */}
          <div className="card p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              الإيرادات عبر الزمن
            </h2>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250} className="md:h-[300px]">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="ecommerceRevenue" 
                    stroke="#3B82F6" 
                    name="E-commerce"
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="posRevenue" 
                    stroke="#FFD700" 
                    name="POS"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                لا توجد بيانات
              </div>
            )}
          </div>

          {/* Orders Breakdown and Expense Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Orders Breakdown */}
            <div className="card p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                تفصيل الطلبيات
              </h2>
              {ordersBreakdown ? (
                <ResponsiveContainer width="100%" height={250} className="md:h-[300px]">
                  <BarChart data={[
                    { name: 'POS', ...ordersBreakdown.pos },
                    { name: 'E-commerce', ...ordersBreakdown.ecommerce },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" fill="#FFD700" name="المجموع" />
                    <Bar dataKey="completed" fill="#10B981" name="مكتملة" />
                    <Bar dataKey="pending" fill="#F59E0B" name="قيد الانتظار" />
                    <Bar dataKey="canceled" fill="#EF4444" name="ملغاة" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  لا توجد بيانات
                </div>
              )}
            </div>

            {/* Expense Breakdown */}
            <div className="card p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                توزيع المصروفات
              </h2>
              {expenseBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={250} className="md:h-[300px]">
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {expenseBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  لا توجد بيانات
                </div>
              )}
            </div>
          </div>

          {/* Top Products */}
          {topProducts.length > 0 && (
            <div className="card p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                أفضل المنتجات مبيعاً
              </h2>
              <ResponsiveContainer width="100%" height={250} className="md:h-[300px]">
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="productName" type="category" width={150} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="totalRevenue" fill="#FFD700" name="إجمالي الإيرادات" />
                  <Bar dataKey="totalQuantity" fill="#10B981" name="الكمية" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <div className="card p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                ترتيب المندوبين
              </h2>
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <div className="inline-block min-w-full align-middle">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-right py-3 px-4 text-sm font-medium">الترتيب</th>
                      <th className="text-right py-3 px-4 text-sm font-medium">المندوب</th>
                      <th className="text-right py-3 px-4 text-sm font-medium">الإيرادات</th>
                      <th className="text-right py-3 px-4 text-sm font-medium">الطلبيات</th>
                      <th className="text-right py-3 px-4 text-sm font-medium">الربح</th>
                      <th className="text-right py-3 px-4 text-sm font-medium">المصروفات</th>
                      <th className="text-right py-3 px-4 text-sm font-medium">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((item) => (
                      <tr
                        key={item.commercialId}
                        className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="py-3 px-4">
                          <span className="font-bold text-gold-600">#{item.rank}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{item.commercialName}</p>
                            <p className="text-sm text-gray-500">{item.commercialEmail}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-green-600">
                          {item.totalRevenue.toFixed(2)} TND
                        </td>
                        <td className="py-3 px-4">{item.totalOrders}</td>
                        <td className={`py-3 px-4 font-medium ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.profit.toFixed(2)} TND
                        </td>
                        <td className="py-3 px-4 text-red-600">
                          {item.totalExpenses.toFixed(2)} TND
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => navigate(`/admin/analytics/commercials/${item.commercialId}`)}
                            className="p-2 text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg transition-colors"
                            title="عرض التفاصيل"
                          >
                            <Users size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}

          {/* Tabs for Orders and Expenses Tables */}
          <div className="card p-4 md:p-6">
            <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
              <div className="flex gap-2 md:gap-4 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-3 md:px-4 py-2 text-sm md:text-base font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'overview'
                      ? 'border-gold-600 text-gold-600'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  نظرة عامة
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`px-3 md:px-4 py-2 text-sm md:text-base font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'orders'
                      ? 'border-gold-600 text-gold-600'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  الطلبيات
                </button>
                <button
                  onClick={() => setActiveTab('expenses')}
                  className={`px-3 md:px-4 py-2 text-sm md:text-base font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'expenses'
                      ? 'border-gold-600 text-gold-600'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  المصروفات
                </button>
              </div>
            </div>

            {activeTab === 'orders' && (
              <OrdersTable filters={filters} />
            )}

            {activeTab === 'expenses' && (
              <ExpensesTable filters={filters} />
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

export default AdvancedCommercialAnalyticsDashboard;
