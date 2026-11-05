import { useState } from 'react';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

const PaymentModal = ({ invoice, onClose }) => {
  const [formData, setFormData] = useState({
    amount: invoice?.remainingAmount || 0,
    paymentMethod: 'cash',
    paymentDate: new Date().toISOString().split('T')[0],
    reference: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.amount > invoice.remainingAmount) {
      toast.error('المبلغ أكبر من المتبقي');
      return;
    }

    try {
      setLoading(true);
      await api.post(`/invoices/${invoice._id}/payments`, formData);
      toast.success('تم تسجيل الدفعة بنجاح');
      onClose();
    } catch (error) {
      toast.error('حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">تسجيل دفعة</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">المبلغ *</label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              className="input-field"
              required
              max={invoice.remainingAmount}
            />
            <p className="text-xs text-gray-500 mt-1">
              المتبقي: {invoice.remainingAmount} TND
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">طريقة الدفع *</label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              className="input-field"
              required
            >
              <option value="cash">نقدي</option>
              <option value="card">بطاقة</option>
              <option value="bank_transfer">تحويل بنكي</option>
              <option value="check">شيك</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">تاريخ الدفع *</label>
            <input
              type="date"
              value={formData.paymentDate}
              onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">المرجع</label>
            <input
              type="text"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">ملاحظات</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input-field"
              rows="3"
            />
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              إلغاء
            </button>
            <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
              {loading ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentModal;

