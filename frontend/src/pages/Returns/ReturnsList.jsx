import { useState, useEffect } from 'react';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { RotateCcw, Plus, Edit, Eye, CheckCircle, Package } from 'lucide-react';
import ReturnModal from './ReturnModal';

const ReturnsList = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReturn, setEditingReturn] = useState(null);

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    try {
      const response = await api.get('/returns');
      setReturns(response.data.data || []);
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب المرتجعات');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.post(`/returns/${id}/approve`);
      toast.success('تم الموافقة على المرتجع');
      fetchReturns();
    } catch (error) {
      toast.error('حدث خطأ');
    }
  };

  const handleRestock = async (id) => {
    try {
      await api.post(`/returns/${id}/restock`);
      toast.success('تم إعادة المخزون بنجاح');
      fetchReturns();
    } catch (error) {
      toast.error('حدث خطأ');
    }
  };

  const handleEdit = (returnItem) => {
    setEditingReturn(returnItem);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingReturn(null);
    fetchReturns();
  };

  const statusLabels = {
    pending: 'قيد الانتظار',
    approved: 'موافق عليه',
    completed: 'مكتمل',
    rejected: 'مرفوض',
  };

  const statusColors = {
    pending: 'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-400',
    approved: 'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-400',
    completed: 'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-400',
    rejected: 'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">المرتجعات</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">إدارة المرتجعات والاستردادات</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          <span>إنشاء مرتجع</span>
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
          </div>
        ) : returns.length === 0 ? (
          <div className="text-center py-12">
            <RotateCcw className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">لا توجد مرتجعات</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-right py-3 px-4 text-sm font-medium">رقم الإرجاع</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">رقم الطلب</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الحالة</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">مبلغ الاسترداد</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">التاريخ</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((returnItem) => (
                  <tr
                    key={returnItem._id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-4">{returnItem.returnNumber}</td>
                    <td className="py-3 px-4">{returnItem.orderId?.orderNumber || '-'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          statusColors[returnItem.status] || statusColors.pending
                        }`}
                      >
                        {statusLabels[returnItem.status] || returnItem.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium">{returnItem.totalRefund} TND</td>
                    <td className="py-3 px-4 text-sm">
                      {new Date(returnItem.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {returnItem.status === 'pending' && (
                          <button
                            onClick={() => handleApprove(returnItem._id)}
                            className="p-2 text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg transition-colors"
                            title="موافقة"
                          >
                            <CheckCircle size={18} />
                          </button>
                        )}
                        {returnItem.status === 'approved' && !returnItem.restocked && (
                          <button
                            onClick={() => handleRestock(returnItem._id)}
                            className="p-2 text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg transition-colors"
                            title="إعادة المخزون"
                          >
                            <Package size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(returnItem)}
                          className="p-2 text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg transition-colors"
                        >
                          <Edit size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <ReturnModal returnItem={editingReturn} onClose={handleCloseModal} />
      )}
    </div>
  );
};

export default ReturnsList;

