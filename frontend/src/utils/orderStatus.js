export const ORDER_STATUS = {
  pending: { label: 'قيد الانتظار', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  preparing: { label: 'قيد التحضير', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  ready: { label: 'جاهز', className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' },
  delivered: { label: 'تم التوصيل', className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300' },
  completed: { label: 'مكتمل', className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  canceled: { label: 'ملغى', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
};

export const ORDER_FLOW = ['pending', 'preparing', 'ready', 'delivered', 'completed'];

export const statusInfo = (status) =>
  ORDER_STATUS[status] || { label: status || '-', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };

export const PAYMENT_METHODS = { cash: 'الدفع عند الاستلام', card: 'بطاقة', credit: 'آجل', mixed: 'مختلط' };
