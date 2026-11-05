import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { ArrowRight, Receipt, Download, Mail } from 'lucide-react';
import PaymentModal from '../../components/Invoices/PaymentModal';

const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  useEffect(() => {
    fetchInvoice();
    fetchPayments();
  }, [id]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      // Try to fetch as client invoice first
      let response = await api.get(`/invoices/${id}`).catch(() => {
        return null;
      });
      
      // If not found, try as supplier invoice
      if (!response || !response.data || !response.data.success) {
        response = await api.get(`/supplier-invoices/${id}`).catch(() => {
          return null;
        });
      }
      
      if (response && response.data && response.data.success) {
        setInvoice(response.data.data);
      } else {
        console.error('Invoice not found for ID:', id);
        toast.error('الفاتورة غير موجودة');
        setTimeout(() => navigate('/admin/invoices'), 2000);
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
      const errorMessage = error.response?.data?.message || 'حدث خطأ أثناء جلب الفاتورة';
      toast.error(errorMessage);
      setTimeout(() => navigate('/admin/invoices'), 2000);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await api.get(`/invoices/${id}/payments`);
      setPayments(response.data.data || []);
    } catch (error) {
      // Silent error handling
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
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/admin/invoices')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-2"
          >
            <ArrowRight size={20} />
            <span>العودة</span>
          </button>
          <h1 className="text-3xl font-bold">فاتورة #{invoice.invoiceNumber}</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                const response = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `invoice-${invoice.invoiceNumber}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                toast.success('تم تحميل الفاتورة');
              } catch (error) {
                toast.error('حدث خطأ أثناء تحميل الفاتورة');
              }
            }}
            className="btn-secondary flex items-center gap-2"
          >
            <Download size={18} />
            <span>تحميل PDF</span>
          </button>
          <button
            onClick={async () => {
              try {
                await api.post(`/invoices/${id}/send-email`);
                toast.success('تم إرسال الفاتورة بالبريد الإلكتروني');
              } catch (error) {
                toast.error('حدث خطأ أثناء إرسال البريد');
              }
            }}
            className="btn-secondary flex items-center gap-2"
          >
            <Mail size={18} />
            <span>إرسال بالبريد</span>
          </button>
          {invoice.remainingAmount > 0 && (
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="btn-primary"
            >
              تسجيل دفعة
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-xl font-bold mb-4">المنتجات</h2>
            <div className="space-y-4">
              {invoice.items.map((item, index) => (
                <div key={index} className="flex justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div>
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-sm text-gray-600">الكمية: {item.quantity}</p>
                  </div>
                  <p className="font-medium">{item.total} TND</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold mb-4">سجل المدفوعات</h2>
            {payments.length === 0 ? (
              <p className="text-gray-500 text-center py-4">لا توجد مدفوعات</p>
            ) : (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div key={payment._id} className="flex justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div>
                      <p className="font-medium">{payment.amount} TND</p>
                      <p className="text-sm text-gray-600">{payment.paymentMethod}</p>
                    </div>
                    <p className="text-sm text-gray-600">
                      {new Date(payment.paymentDate).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-bold mb-4">معلومات الفاتورة</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">العميل</p>
                <p className="font-medium">{invoice.clientName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">تاريخ الإصدار</p>
                <p className="font-medium">
                  {new Date(invoice.issuedAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">تاريخ الاستحقاق</p>
                <p className="font-medium">
                  {new Date(invoice.dueDate).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold mb-4">الملخص</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>المجموع الفرعي</span>
                <span>{invoice.subtotal} TND</span>
              </div>
              <div className="flex justify-between">
                <span>الضريبة</span>
                <span>{invoice.tax} TND</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="font-bold">الإجمالي</span>
                <span className="font-bold">{invoice.total} TND</span>
              </div>
              <div className="flex justify-between text-gold-600">
                <span>المدفوع</span>
                <span>{invoice.paidAmount} TND</span>
              </div>
              <div className="flex justify-between text-gold-600 font-bold">
                <span>المتبقي</span>
                <span>{invoice.remainingAmount} TND</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isPaymentModalOpen && (
        <PaymentModal
          invoice={invoice}
          onClose={() => {
            setIsPaymentModalOpen(false);
            fetchInvoice();
            fetchPayments();
          }}
        />
      )}
    </div>
  );
};

export default InvoiceDetail;

