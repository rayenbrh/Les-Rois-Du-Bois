import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { Users, DollarSign, TrendingUp, FileText, Calendar, Eye } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const CommercialAnalyticsDashboard = () => {
  const navigate = useNavigate();
  const [commercials, setCommercials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchCommercialsAnalytics();
  }, [dateRange]);

  const fetchCommercialsAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.get('/analytics/commercials', {
        params: dateRange,
      });
      setCommercials(response.data.data || []);
    } catch (error) {
      console.error('Error fetching commercials analytics:', error);
      toast.error('حدث خطأ أثناء جلب بيانات المندوبين');
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = commercials.reduce((sum, c) => sum + (c.totalRevenue || 0), 0);
  const totalExpenses = commercials.reduce((sum, c) => sum + (c.totalExpenses || 0), 0);
  const totalProfit = totalRevenue - totalExpenses;
  const totalOrders = commercials.reduce((sum, c) => sum + (c.totalOrders || 0), 0);

  // Prepare chart data
  const revenueChartData = commercials
    .map(c => ({
      name: c.commercialName,
      revenue: c.totalRevenue || 0,
      expenses: c.totalExpenses || 0,
      profit: (c.totalRevenue || 0) - (c.totalExpenses || 0),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            تحليلات المندوبين التجاريين
          </h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
            نظرة شاملة على أداء جميع المندوبين
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 md:gap-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">من تاريخ</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="input-field text-sm md:text-base px-2 md:px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="input-field text-sm md:text-base px-2 md:px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">إجمالي الإيرادات</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {totalRevenue.toFixed(2)} TND
              </p>
            </div>
            <DollarSign className="text-gold-500" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">الربح</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {(totalRevenue - totalExpenses).toFixed(2)} TND
              </p>
            </div>
            <DollarSign className="text-green-500" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">إجمالي المصروفات</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {totalExpenses.toFixed(2)} TND
              </p>
            </div>
            <FileText className="text-red-500" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">صافي الربح</p>
              <p className={`text-2xl font-bold mt-2 ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalProfit.toFixed(2)} TND
              </p>
            </div>
            <TrendingUp className={totalProfit >= 0 ? 'text-green-500' : 'text-red-500'} size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">إجمالي الطلبيات</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {totalOrders}
              </p>
            </div>
            <Users className="text-blue-500" size={32} />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="card p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            الإيرادات والمصروفات حسب المندوب
          </h2>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
            </div>
          ) : revenueChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250} className="md:h-[300px]">
              <BarChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#FFD700" name="الإيرادات" />
                <Bar dataKey="expenses" fill="#FF6347" name="المصروفات" />
                <Bar dataKey="profit" fill="#32CD32" name="الربح" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              لا توجد بيانات
            </div>
          )}
        </div>

        <div className="card p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            توزيع الإيرادات
          </h2>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
            </div>
          ) : revenueChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250} className="md:h-[300px]">
              <PieChart>
                <Pie
                  data={revenueChartData}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {revenueChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              لا توجد بيانات
            </div>
          )}
        </div>
      </div>

      {/* Commercials Table */}
      <div className="card p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          قائمة المندوبين التجاريين
        </h2>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
          </div>
        ) : commercials.length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">لا يوجد مندوبين تجاريين</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <div className="inline-block min-w-full align-middle">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-right py-3 px-4 text-sm font-medium">المندوب</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الإيرادات</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">المصروفات</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الربح</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">عدد الطلبيات</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">نسبة المصروفات</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {commercials
                  .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
                  .map((commercial) => (
                    <tr
                      key={commercial.commercialId}
                      className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {commercial.commercialName}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {commercial.commercialEmail}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-green-600">
                        {(commercial.totalRevenue || 0).toFixed(2)} TND
                      </td>
                      <td className="py-3 px-4 font-medium text-red-600">
                        {(commercial.totalExpenses || 0).toFixed(2)} TND
                      </td>
                      <td className={`py-3 px-4 font-medium ${(commercial.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(commercial.profit || 0).toFixed(2)} TND
                      </td>
                      <td className="py-3 px-4">{commercial.totalOrders || 0}</td>
                      <td className="py-3 px-4">
                        {(commercial.expenseToRevenueRatio || 0).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => navigate(`/admin/analytics/commercials/${commercial.commercialId}`)}
                          className="p-2 text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg transition-colors"
                          title="عرض التفاصيل"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommercialAnalyticsDashboard;
