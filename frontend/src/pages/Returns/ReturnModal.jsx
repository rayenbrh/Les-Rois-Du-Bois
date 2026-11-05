import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../../utils/axios';
import toast from 'react-hot-toast';

const ReturnModal = ({ returnItem, onClose }) => {
  const [formData, setFormData] = useState({
    orderId: '',
    reason: '',
    items: [],
  });
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
    if (returnItem) {
      setFormData({
        orderId: returnItem.orderId?._id || returnItem.orderId || '',
        reason: returnItem.reason || '',
        items: returnItem.items || [],
      });
    }
  }, [returnItem]);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/orders', { params: { status: 'completed,delivered' } });
      setOrders(response.data.data || []);
    } catch (error) {
      // Silent error handling
    }
  };

  const handleOrderSelect = async (orderId) => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      setSelectedOrder(response.data.data);
      setFormData({
        ...formData,
        orderId,
        items: response.data.data.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: 0,
          refundAmount: 0,
        })),
      });
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب بيانات الطلب');
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    if (field === 'quantity' && selectedOrder) {
      const orderItem = selectedOrder.items[index];
      updatedItems[index].refundAmount = (orderItem.unitPrice * value).toFixed(2);
    }
    setFormData({ ...formData, items: updatedItems });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.orderId) {
      toast.error('يرجى اختيار طلب');
      return;
    }
    if (formData.items.filter((item) => item.quantity > 0).length === 0) {
      toast.error('يرجى تحديد المنتجات المراد إرجاعها');
      return;
    }

    setLoading(true);
    try {
      if (returnItem) {
        await api.put(`/returns/${returnItem._id}`, formData);
        toast.success('تم تحديث المرتجع بنجاح');
      } else {
        await api.post('/returns', formData);
        toast.success('تم إنشاء المرتجع بنجاح');
      }
      onClose();
    } catch (error) {
      const message = error.response?.data?.message || 'حدث خطأ';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {returnItem ? 'تعديل مرتجع' : 'إنشاء مرتجع جديد'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              الطلب *
            </label>
            <select
              value={formData.orderId}
              onChange={(e) => handleOrderSelect(e.target.value)}
              required
              className="input-field"
              disabled={!!returnItem}
            >
              <option value="">اختر الطلب</option>
              {orders.map((order) => (
                <option key={order._id} value={order._id}>
                  {order.orderNumber} - {order.clientName} - {order.total} TND
                </option>
              ))}
            </select>
          </div>

          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  سبب الإرجاع *
                </label>
                <textarea
                  name="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  required
                  className="input-field"
                  placeholder="اذكر سبب الإرجاع..."
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  المنتجات المراد إرجاعها
                </h3>
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div
                      key={index}
                      className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {item.productName}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          الكمية الأصلية: {selectedOrder.items[index]?.quantity || 0}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <label className="text-xs text-gray-600 dark:text-gray-400">الكمية</label>
                          <input
                            type="number"
                            min="0"
                            max={selectedOrder.items[index]?.quantity || 0}
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)
                            }
                            className="input-field w-20"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 dark:text-gray-400">مبلغ الاسترداد</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.refundAmount}
                            onChange={(e) =>
                              handleItemChange(index, 'refundAmount', parseFloat(e.target.value) || 0)
                            }
                            className="input-field w-32"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              إلغاء
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'جاري الحفظ...' : returnItem ? 'تحديث' : 'إنشاء'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReturnModal;

