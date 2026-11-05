import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { ArrowRight, Phone, Mail, Building, FileText, ShoppingCart, Plus, Edit } from 'lucide-react';

const CommercialClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    fetchClientData();
  }, [id]);

  const fetchClientData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/commercial/clients/${id}`);
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب بيانات العميل');
      navigate('/commercial/clients');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
      </div>
    );
  }

  const { client, orders, unpaidInvoices, totalUnpaid, ongoingOrders, notes } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/commercial/clients')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowRight size={20} />
          العودة
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/commercial/pos?clientId=${id}`)}
            className="px-4 py-2 bg-gold-600 hover:bg-gold-700 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={20} />
            إنشاء طلب
          </button>
        </div>
      </div>

      {/* Client Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{client.name}</h1>
            <div className="flex items-center gap-4 mt-2">
              {client.phone && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Phone size={16} />
                  {client.phone}
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Mail size={16} />
                  {client.email}
                </div>
              )}
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm ${
              client.clientStatus === 'active'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            {client.clientStatus === 'active' ? 'نشط' : 'غير نشط'}
          </span>
        </div>

        {client.companyName && (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-4">
            <Building size={16} />
            {client.companyName}
            {client.taxId && <span className="text-sm">({client.taxId})</span>}
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">إجمالي الطلبات</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{orders.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">الفواتير غير المدفوعة</p>
            <p className="text-2xl font-bold text-red-600">{unpaidInvoices.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">إجمالي غير المدفوع</p>
            <p className="text-2xl font-bold text-red-600">{totalUnpaid.toLocaleString()} TND</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">الطلبات الجارية</p>
            <p className="text-2xl font-bold text-orange-600">{ongoingOrders.length}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-4 px-6">
            <button
              onClick={() => setActiveTab('info')}
              className={`py-4 px-2 border-b-2 transition-colors ${
                activeTab === 'info'
                  ? 'border-gold-600 text-gold-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400'
              }`}
            >
              المعلومات
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-4 px-2 border-b-2 transition-colors ${
                activeTab === 'orders'
                  ? 'border-gold-600 text-gold-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400'
              }`}
            >
              الطلبات ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`py-4 px-2 border-b-2 transition-colors ${
                activeTab === 'invoices'
                  ? 'border-gold-600 text-gold-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400'
              }`}
            >
              الفواتير ({unpaidInvoices.length})
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`py-4 px-2 border-b-2 transition-colors ${
                activeTab === 'notes'
                  ? 'border-gold-600 text-gold-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400'
              }`}
            >
              الملاحظات ({notes.length})
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'info' && <ClientInfo client={client} />}
          {activeTab === 'orders' && <ClientOrders orders={orders} navigate={navigate} />}
          {activeTab === 'invoices' && <ClientInvoices invoices={unpaidInvoices} navigate={navigate} />}
          {activeTab === 'notes' && <ClientNotes clientId={id} notes={notes} onUpdate={fetchClientData} />}
        </div>
      </div>
    </div>
  );
};

const ClientInfo = ({ client }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">معلومات الاتصال</h3>
      <div className="space-y-3">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">الاسم</p>
          <p className="text-gray-900 dark:text-gray-100">{client.name}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">البريد الإلكتروني</p>
          <p className="text-gray-900 dark:text-gray-100">{client.email}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">رقم الهاتف</p>
          <p className="text-gray-900 dark:text-gray-100">{client.phone || '-'}</p>
        </div>
      </div>
    </div>
    <div>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">معلومات إضافية</h3>
      <div className="space-y-3">
        {client.companyName && (
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">اسم الشركة</p>
            <p className="text-gray-900 dark:text-gray-100">{client.companyName}</p>
          </div>
        )}
        {client.taxId && (
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">الرقم الضريبي</p>
            <p className="text-gray-900 dark:text-gray-100">{client.taxId}</p>
          </div>
        )}
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">حد الائتمان</p>
          <p className="text-gray-900 dark:text-gray-100">{client.creditLimit?.toLocaleString() || 0} TND</p>
        </div>
        {client.paymentTerms && (
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">شروط الدفع</p>
            <p className="text-gray-900 dark:text-gray-100">{client.paymentTerms}</p>
          </div>
        )}
      </div>
    </div>
  </div>
);

const ClientOrders = ({ orders, navigate }) => (
  <div className="space-y-3">
    {orders.length > 0 ? (
      orders.map((order) => (
        <div
          key={order._id}
          onClick={() => navigate(`/commercial/orders/${order._id}`)}
          className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{order.orderNumber}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {new Date(order.createdAt).toLocaleDateString('ar-TN')}
              </p>
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-900 dark:text-gray-100">{order.total.toLocaleString()} TND</p>
              <span
                className={`px-2 py-1 rounded text-xs ${
                  order.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : order.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {order.status}
              </span>
            </div>
          </div>
        </div>
      ))
    ) : (
      <p className="text-center text-gray-500 dark:text-gray-400 py-8">لا توجد طلبات</p>
    )}
  </div>
);

const ClientInvoices = ({ invoices, navigate }) => (
  <div className="space-y-3">
    {invoices.length > 0 ? (
      invoices.map((invoice) => (
        <div
          key={invoice._id}
          onClick={() => navigate(`/commercial/invoices/${invoice._id}`)}
          className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{invoice.invoiceNumber}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                تاريخ الاستحقاق: {new Date(invoice.dueDate).toLocaleDateString('ar-TN')}
              </p>
            </div>
            <div className="text-left">
              <p className="font-semibold text-red-600">{invoice.remainingAmount.toLocaleString()} TND</p>
              <span
                className={`px-2 py-1 rounded text-xs ${
                  invoice.status === 'paid'
                    ? 'bg-green-100 text-green-800'
                    : invoice.status === 'overdue'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {invoice.status}
              </span>
            </div>
          </div>
        </div>
      ))
    ) : (
      <p className="text-center text-gray-500 dark:text-gray-400 py-8">لا توجد فواتير غير مدفوعة</p>
    )}
  </div>
);

const ClientNotes = ({ clientId, notes, onUpdate }) => {
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      setLoading(true);
      const response = await api.post(`/commercial/clients/${clientId}/notes`, {
        content: newNote,
      });
      if (response.data.success) {
        toast.success('تمت إضافة الملاحظة بنجاح');
        setNewNote('');
        onUpdate();
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء إضافة الملاحظة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleAddNote} className="flex gap-2">
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="أضف ملاحظة..."
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-gold-600 hover:bg-gold-700 text-white rounded-lg transition-colors"
        >
          إضافة
        </button>
      </form>
      <div className="space-y-2">
        {notes.map((note) => (
          <div key={note._id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-gray-900 dark:text-gray-100">{note.content}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {new Date(note.createdAt).toLocaleDateString('ar-TN')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommercialClientDetail;

