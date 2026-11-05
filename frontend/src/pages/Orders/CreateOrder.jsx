import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { ArrowRight, Plus, Trash2, Package } from 'lucide-react';

const CreateOrder = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    clientAddress: '',
    items: [],
    discount: 0,
    paymentMethod: 'cash',
    notes: '',
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data.data || []);
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب المنتجات');
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct || quantity < 1) {
      toast.error('يرجى اختيار منتج وكمية');
      return;
    }

    const existingItemIndex = formData.items.findIndex(
      (item) => item.productId === selectedProduct._id
    );

    if (existingItemIndex >= 0) {
      const updatedItems = [...formData.items];
      updatedItems[existingItemIndex].quantity += quantity;
      updatedItems[existingItemIndex].total =
        updatedItems[existingItemIndex].quantity * updatedItems[existingItemIndex].unitPrice;
      setFormData({ ...formData, items: updatedItems });
    } else {
      const newItem = {
        productId: selectedProduct._id,
        productType: 'regular',
        quantity,
        unitPrice: selectedProduct.price,
        discount: 0,
      };
      newItem.total = newItem.quantity * newItem.unitPrice;
      setFormData({ ...formData, items: [...formData.items, newItem] });
    }

    setSelectedProduct(null);
    setQuantity(1);
  };

  const handleRemoveItem = (index) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: updatedItems });
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.total, 0);
    const discount = formData.discount || 0;
    const tax = (subtotal - discount) * 0.19;
    const total = subtotal - discount + tax;
    return { subtotal, discount, tax, total };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.clientName) {
      toast.error('اسم العميل مطلوب');
      return;
    }

    if (formData.items.length === 0) {
      toast.error('يجب إضافة منتجات على الأقل');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/orders', formData);
      toast.success('تم إنشاء الطلب بنجاح');
      navigate(`/admin/orders/${response.data.data._id}`);
    } catch (error) {
      const message = error.response?.data?.message || 'حدث خطأ أثناء إنشاء الطلب';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/admin/orders')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-2"
          >
            <ArrowRight size={20} />
            <span>العودة إلى القائمة</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">إنشاء طلب جديد</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Client Information */}
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                معلومات العميل
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    اسم العميل *
                  </label>
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    رقم الهاتف
                  </label>
                  <input
                    type="text"
                    value={formData.clientPhone}
                    onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    العنوان
                  </label>
                  <input
                    type="text"
                    value={formData.clientAddress}
                    onChange={(e) => setFormData({ ...formData, clientAddress: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>
            </div>

            {/* Add Products */}
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                إضافة منتجات
              </h2>
              <div className="flex gap-4 mb-4">
                <select
                  value={selectedProduct?._id || ''}
                  onChange={(e) => {
                    const product = products.find((p) => p._id === e.target.value);
                    setSelectedProduct(product);
                  }}
                  className="input-field flex-1"
                >
                  <option value="">اختر منتج</option>
                  {products.map((product) => (
                    <option key={product._id} value={product._id}>
                      {product.name} - {product.price} TND (المخزون: {product.stock || 0})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="input-field w-24"
                  placeholder="الكمية"
                />
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus size={18} />
                  <span>إضافة</span>
                </button>
              </div>

              {/* Order Items */}
              {formData.items.length > 0 && (
                <div className="space-y-2">
                  {formData.items.map((item, index) => {
                    const product = products.find((p) => p._id === item.productId);
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <Package className="text-gray-400" size={24} />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {product?.name || 'منتج'}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {item.quantity} × {item.unitPrice} TND
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {item.total} TND
                          </p>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-2 text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                ملخص الطلب
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    الخصم (TND)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.discount}
                    onChange={(e) =>
                      setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    طريقة الدفع
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="input-field"
                  >
                    <option value="cash">نقدي</option>
                    <option value="card">بطاقة</option>
                    <option value="credit">ائتمان</option>
                  </select>
                </div>
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
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">الإجمالي</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">المجموع الفرعي</span>
                  <span className="font-medium">{totals.subtotal.toFixed(2)} TND</span>
                </div>
                {formData.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">الخصم</span>
                    <span className="font-medium text-gold-600">-{totals.discount.toFixed(2)} TND</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">الضريبة (19%)</span>
                  <span className="font-medium">{totals.tax.toFixed(2)} TND</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between">
                  <span className="font-bold text-lg">الإجمالي</span>
                  <span className="font-bold text-lg text-gold-600">
                    {totals.total.toFixed(2)} TND
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => navigate('/admin/orders')}
                className="btn-secondary flex-1"
              >
                إلغاء
              </button>
              <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
                {loading ? 'جاري الإنشاء...' : 'إنشاء الطلب'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateOrder;

