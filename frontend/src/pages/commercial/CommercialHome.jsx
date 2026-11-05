import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { Users, ShoppingCart, AlertCircle, TrendingUp, Plus, Eye } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const CommercialHome = () => {
  const [stats, setStats] = useState({
    totalClients: 0,
    activeClients: 0,
    totalOrders: 0,
    ongoingOrders: 0,
    unpaidInvoices: 0,
    totalRevenue: 0,
    ordersOverTime: [],
    topClients: [],
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/commercial/dashboard/stats');
      if (response.data.success) {
        setStats((prev) => ({ ...prev, ...(response.data.data || {}) }));
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('حدث خطأ أثناء جلب الإحصائيات');
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: 'إجمالي العملاء',
      value: stats.totalClients,
      icon: Users,
      color: 'bg-blue-500',
      action: () => navigate('/commercial/clients'),
    },
    {
      label: 'العملاء النشطون',
      value: stats.activeClients,
      icon: Users,
      color: 'bg-green-500',
      action: () => navigate('/commercial/clients?status=active'),
    },
    {
      label: 'إجمالي الطلبات',
      value: stats.totalOrders,
      icon: ShoppingCart,
      color: 'bg-purple-500',
      action: () => navigate('/commercial/orders'),
    },
    {
      label: 'الطلبات الجارية',
      value: stats.ongoingOrders,
      icon: ShoppingCart,
      color: 'bg-orange-500',
      action: () => navigate('/commercial/orders?status=pending'),
    },
    {
      label: 'الفواتير غير المدفوعة',
      value: stats.unpaidInvoices,
      icon: AlertCircle,
      color: 'bg-red-500',
      action: () => navigate('/commercial/unpaid'),
    },
    {
      label: 'إجمالي الإيرادات',
      value: `${(Number(stats.totalRevenue) || 0).toLocaleString()} TND`,
      icon: TrendingUp,
      color: 'bg-gold-600',
      action: () => navigate('/commercial/invoices'),
    },
    {
      label: 'الربح',
      value: `${((Number(stats.totalRevenue) || 0) - (Number(stats.totalExpenses) || 0)).toLocaleString()} TND`,
      icon: TrendingUp,
      color: 'bg-green-600',
      action: () => navigate('/commercial/invoices'),
    },
  ];

  const chartData = stats.ordersOverTime.map((item) => ({
    month: `${item._id.year}/${item._id.month}`,
    orders: item.count,
    revenue: item.revenue,
  }));

  const COLORS = ['#FFD700', '#E6C200', '#CCAD00', '#B39900', '#998600'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">لوحة التحكم التجارية</h1>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/commercial/pos')}
            className="px-4 py-2 bg-gold-600 hover:bg-gold-700 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={20} />
            إنشاء طلب
          </button>
          <button
            onClick={() => navigate('/commercial/clients?action=create')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={20} />
            إضافة عميل
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              onClick={card.action}
              className="card cursor-pointer transition-shadow hover:shadow-card-hover"
            >
              <div className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-1 sm:mb-2">{card.label}</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{card.value}</p>
                </div>
                <div className={`${card.color} p-2.5 sm:p-3 rounded-xl`}>
                  <Icon className="text-white" size={22} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders Over Time */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">الطلبات على مر الزمن</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="orders" stroke="#FFD700" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Over Time */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">الإيرادات على مر الزمن</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="revenue" fill="#FFD700" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Clients */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">أفضل العملاء</h2>
        {stats.topClients.length > 0 ? (
          <div className="space-y-3">
            {stats.topClients.map((client) => (
              <div
                key={client._id}
                onClick={() => navigate(`/commercial/clients/${client._id}`)}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{client.clientName}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {client.orderCount} طلب • {client.totalSpent.toLocaleString()} TND
                  </p>
                </div>
                <Eye className="text-gray-400" size={20} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">لا توجد بيانات</p>
        )}
      </div>
    </div>
  );
};

export default CommercialHome;

