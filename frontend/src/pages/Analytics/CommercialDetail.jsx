import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { ArrowRight, DollarSign, FileText, TrendingUp, Package, Calendar, Download } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const CommercialDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [commercial, setCommercial] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [expensesBreakdown, setExpensesBreakdown] = useState({});
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (id) {
      fetchCommercialDetail();
      fetchCommercialExpenses();
    }
  }, [id, dateRange]);

  const fetchCommercialDetail = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/analytics/commercials/${id}`, {
        params: dateRange,
      });
      setCommercial(response.data.data.commercial);
      setMetrics(response.data.data.metrics);
    } catch (error) {
      console.error('Error fetching commercial detail:', error);
      toast.error('حدث خطأ أثناء جلب بيانات المندوب');
    } finally {
      setLoading(false);
    }
  };

  const fetchCommercialExpenses = async () => {
    try {
      const response = await api.get(`/analytics/commercials/${id}/expenses`, {
        params: dateRange,
      });
      setExpenses(response.data.data.expenses || []);
      setExpensesBreakdown(response.data.data.breakdown || {});
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  };

  const handleExportPDF = async () => {
    try {
      toast.loading('جاري إنشاء ملف PDF...', { id: 'export-pdf' });
      
      const response = await api.get(`/analytics/commercials/${id}/export`, {
        params: {
          format: 'pdf',
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
        responseType: 'blob',
        validateStatus: (status) => status < 500, // Don't throw for 4xx errors
      });

      // Check if response is actually a PDF or an error JSON
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/json') || response.status >= 400) {
        // It's an error response - try to parse JSON
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
      const safeName = (commercial?.name || 'commercial').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `analytics-${safeName}-${dateRange.startDate}_${dateRange.endDate}.pdf`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('تم تحميل ملف PDF بنجاح', { id: 'export-pdf' });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      let errorMessage = 'حدث خطأ أثناء إنشاء ملف PDF';
      
      if (error.response?.data) {
        // Try to get error message from blob response
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
      
      toast.error(errorMessage, { id: 'export-pdf', duration: 5000 });
    }
  };

  const subcategoryLabels = {
    fuel: 'وقود',
    toll: 'رسوم الطريق السريع',
    transport: 'نقل',
    other: 'أخرى',
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

  // Prepare expense breakdown chart data
  const expenseBreakdownData = Object.entries(expensesBreakdown).map(([key, value]) => ({
    name: subcategoryLabels[key] || key,
    value: value || 0,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
      </div>
    );
  }

  if (!commercial || !metrics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">المندوب التجاري غير موجود</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/analytics/commercials')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="رجوع"
          >
            <ArrowRight size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {commercial.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{commercial.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">من تاريخ</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="input-field"
            />
          </div>
          <button
            onClick={handleExportPDF}
            className="btn-secondary flex items-center gap-2"
            disabled={loading}
          >
            <Download size={20} />
            <span>تصدير PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">إجمالي الإيرادات</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {(metrics.totalRevenue || 0).toFixed(2)} TND
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
                {((metrics.totalRevenue || 0) - (metrics.totalExpenses || 0)).toFixed(2)} TND
              </p>
            </div>
            <DollarSign className="text-green-500" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">عدد الطلبيات</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {metrics.totalOrders || 0}
              </p>
            </div>
            <Package className="text-blue-500" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">إجمالي المصروفات</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {(metrics.totalExpenses || 0).toFixed(2)} TND
              </p>
            </div>
            <FileText className="text-red-500" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">صافي الربح</p>
              <p className={`text-2xl font-bold mt-2 ${(metrics.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(metrics.profit || 0).toFixed(2)} TND
              </p>
            </div>
            <TrendingUp className={(metrics.profit || 0) >= 0 ? 'text-green-500' : 'text-red-500'} size={32} />
          </div>
        </div>
      </div>

      {/* Expense Breakdown Chart */}
      {expenseBreakdownData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              توزيع المصروفات حسب النوع
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expenseBreakdownData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {expenseBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Expenses Table */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          المصروفات
        </h2>
        {expenses.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">لا توجد مصروفات</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-right py-3 px-4 text-sm font-medium">التاريخ</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">النوع</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الوصف</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr
                    key={expense._id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-4 text-sm">
                      {new Date(expense.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4">
                      {expense.subcategory ? subcategoryLabels[expense.subcategory] || expense.subcategory : '-'}
                    </td>
                    <td className="py-3 px-4">{expense.label || '-'}</td>
                    <td className="py-3 px-4 font-medium">{expense.amount} TND</td>
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

export default CommercialDetail;

