import { useState, useEffect } from 'react';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { X, Download } from 'lucide-react';

const StockAdjustModal = ({ product, onClose }) => {
  const [formData, setFormData] = useState({
    quantity: '',
    reason: '',
    notes: '',
    generateInvoice: false,
    unitCost: '',
  });
  const [loading, setLoading] = useState(false);
  const [supplierInvoiceId, setSupplierInvoiceId] = useState(null);

  const hasSupplier = product?.supplierId?._id || product?.supplierId;
  const isAddingStock = parseInt(formData.quantity) > 0;
  const canGenerateInvoice = hasSupplier && isAddingStock && formData.reason === 'purchase';

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.quantity || !formData.reason) {
      toast.error('يرجى إدخال الكمية والسبب');
      return;
    }

    if (formData.generateInvoice && !formData.unitCost) {
      toast.error('يرجى إدخال التكلفة الوحدة عند إنشاء الفاتورة');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/inventory/adjust', {
        productId: product._id,
        productType: 'regular',
        quantity: parseInt(formData.quantity),
        reason: formData.reason,
        notes: formData.notes,
        generateInvoice: formData.generateInvoice,
        unitCost: formData.generateInvoice ? parseFloat(formData.unitCost) : undefined,
      });
      
      toast.success('تم تعديل المخزون بنجاح');
      
      // If invoice was generated, store the ID
      if (response.data.data?.supplierInvoiceId) {
        setSupplierInvoiceId(response.data.data.supplierInvoiceId);
        toast.success('تم إنشاء فاتورة المورد بنجاح');
      } else {
        onClose();
      }
    } catch (error) {
      const message = error.response?.data?.message || 'حدث خطأ';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const downloadInvoice = async () => {
    if (!supplierInvoiceId) return;
    try {
      const response = await api.get(`/supplier-invoices/${supplierInvoiceId}/pdf`, {
        responseType: 'blob',
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `supplier-invoice-${supplierInvoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      onClose();
    } catch (error) {
      toast.error('حدث خطأ أثناء تحميل الفاتورة');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            تعديل المخزون
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
              المنتج
            </label>
            <input
              type="text"
              value={product?.name || ''}
              disabled
              className="input-field bg-gray-100 dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              المخزون الحالي
            </label>
            <input
              type="text"
              value={product?.stock || 0}
              disabled
              className="input-field bg-gray-100 dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              الكمية (موجب للزيادة، سالب للنقصان) *
            </label>
            <input
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="input-field"
              required
              placeholder="مثال: +10 أو -5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              السبب *
            </label>
            <select
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="input-field"
              required
            >
              <option value="">اختر السبب</option>
              <option value="purchase">شراء</option>
              <option value="sale">بيع</option>
              <option value="return">إرجاع</option>
              <option value="adjustment">تعديل يدوي</option>
              <option value="damage">تلف</option>
              <option value="other">أخرى</option>
            </select>
          </div>

          {canGenerateInvoice && (
            <>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.generateInvoice}
                    onChange={(e) => setFormData({ ...formData, generateInvoice: e.target.checked })}
                    className="w-4 h-4 text-gold-600 rounded focus:ring-gold-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    إنشاء فاتورة مورد
                  </span>
                </label>
                {formData.generateInvoice && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      التكلفة الوحدة (TND) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.unitCost}
                      onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                      className="input-field"
                      placeholder="مثال: 50.00"
                      required={formData.generateInvoice}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ملاحظات
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input-field"
              rows="3"
            />
          </div>

          {supplierInvoiceId ? (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                تم إنشاء فاتورة المورد بنجاح. يمكنك تحميلها الآن.
              </p>
              <div className="flex items-center justify-end gap-4">
                <button type="button" onClick={onClose} className="btn-secondary">
                  إغلاق
                </button>
                <button
                  type="button"
                  onClick={downloadInvoice}
                  className="btn-primary flex items-center gap-2"
                >
                  <Download size={18} />
                  تحميل الفاتورة
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-4 pt-4">
              <button type="button" onClick={onClose} className="btn-secondary">
                إلغاء
              </button>
              <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
                {loading ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default StockAdjustModal;

