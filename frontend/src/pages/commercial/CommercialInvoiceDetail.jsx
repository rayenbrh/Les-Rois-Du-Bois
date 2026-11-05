import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { ArrowRight, Download } from 'lucide-react';

const CommercialInvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/commercial/invoices/${id}`);
      if (response.data.success) {
        setInvoice(response.data.data);
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب الفاتورة');
      navigate('/commercial/invoices');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !invoice) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/commercial/invoices')}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
      >
        <ArrowRight size={20} />
        العودة
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">فاتورة #{invoice.invoiceNumber}</h1>
          <button className="px-4 py-2 bg-gold-600 hover:bg-gold-700 text-white rounded-lg flex items-center gap-2">
            <Download size={20} />
            تحميل PDF
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">معلومات العميل</h3>
            <p className="text-gray-600 dark:text-gray-400">{invoice.clientName}</p>
            {invoice.clientAddress && <p className="text-gray-600 dark:text-gray-400">{invoice.clientAddress}</p>}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">معلومات الفاتورة</h3>
            <p className="text-gray-600 dark:text-gray-400">التاريخ: {new Date(invoice.createdAt).toLocaleDateString('ar-TN')}</p>
            <p className="text-gray-600 dark:text-gray-400">تاريخ الاستحقاق: {new Date(invoice.dueDate).toLocaleDateString('ar-TN')}</p>
            <p className="text-gray-600 dark:text-gray-400">الحالة: {invoice.status}</p>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">المنتجات</h3>
          <div className="space-y-3">
            {invoice.items.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{item.productName}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {item.quantity} × {item.unitPrice.toLocaleString()} TND
                  </p>
                </div>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{item.total.toLocaleString()} TND</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">المجموع الفرعي:</span>
            <span className="text-gray-900 dark:text-gray-100">{invoice.subtotal.toLocaleString()} TND</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">الخصم:</span>
              <span className="text-gray-900 dark:text-gray-100">-{invoice.discount.toLocaleString()} TND</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-semibold pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-gray-900 dark:text-gray-100">الإجمالي:</span>
            <span className="text-gold-600">{invoice.total.toLocaleString()} TND</span>
          </div>
          <div className="flex justify-between text-lg font-semibold pt-2">
            <span className="text-red-600">المتبقي:</span>
            <span className="text-red-600">{invoice.remainingAmount.toLocaleString()} TND</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommercialInvoiceDetail;

