import { useState, useEffect } from 'react';
import { AlertCircle, TrendingDown, DollarSign, XCircle } from 'lucide-react';

const SmartAlerts = ({ analytics }) => {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    checkForAlerts();
  }, [analytics]);

  const checkForAlerts = () => {
    const newAlerts = [];

    analytics.forEach((commercial) => {
      // Check for extreme expenses
      const expenseRatio = commercial.expenseToRevenueRatio || 0;
      if (expenseRatio > 50) {
        newAlerts.push({
          type: 'warning',
          icon: DollarSign,
          title: 'مصروفات عالية',
          message: `${commercial.commercialName}: نسبة المصروفات تصل إلى ${expenseRatio.toFixed(1)}% من الإيرادات`,
          commercialId: commercial.commercialId,
        });
      }

      // Check for high cancellation rate
      const cancellationRate = commercial.totalOrders > 0
        ? (commercial.canceledOrders / commercial.totalOrders) * 100
        : 0;
      if (cancellationRate > 20) {
        newAlerts.push({
          type: 'error',
          icon: XCircle,
          title: 'معدل إلغاء مرتفع',
          message: `${commercial.commercialName}: ${cancellationRate.toFixed(1)}% من الطلبيات ملغاة`,
          commercialId: commercial.commercialId,
        });
      }

      // Check for negative profit
      if (commercial.profit < 0) {
        newAlerts.push({
          type: 'error',
          icon: TrendingDown,
          title: 'خسارة',
          message: `${commercial.commercialName}: خسارة ${Math.abs(commercial.profit).toFixed(2)} TND`,
          commercialId: commercial.commercialId,
        });
      }

      // Check for unusual expenses (more than 3x average)
      const avgExpenseRatio = analytics.reduce((sum, c) => sum + (c.expenseToRevenueRatio || 0), 0) / analytics.length;
      if (expenseRatio > avgExpenseRatio * 3 && expenseRatio > 30) {
        newAlerts.push({
          type: 'warning',
          icon: AlertCircle,
          title: 'مصروفات غير عادية',
          message: `${commercial.commercialName}: المصروفات أعلى بكثير من المتوسط`,
          commercialId: commercial.commercialId,
        });
      }
    });

    setAlerts(newAlerts);
  };

  if (alerts.length === 0) {
    return null;
  }

  const getAlertColor = (type) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  const getIconColor = (type) => {
    switch (type) {
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
        <AlertCircle className="text-orange-500" size={24} />
        التنبيهات الذكية
      </h2>
      <div className="space-y-3">
        {alerts.map((alert, index) => {
          const Icon = alert.icon;
          return (
            <div
              key={index}
              className={`p-4 rounded-lg border ${getAlertColor(alert.type)}`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`${getIconColor(alert.type)} flex-shrink-0 mt-1`} size={20} />
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                    {alert.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {alert.message}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SmartAlerts;

