import { useState, useEffect } from 'react';
import { X, Upload, FileText, XCircle } from 'lucide-react';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { withBase } from '@/utils/imageUrl';

const ExpenseModal = ({ expense, onClose }) => {
  const [formData, setFormData] = useState({
    categoryId: '',
    label: '',
    description: '', // Legacy support
    amount: '',
    date: new Date().toISOString().split('T')[0],
    expenseDate: new Date().toISOString().split('T')[0], // Legacy support
    notes: '',
    paymentMethod: 'cash',
    supplierId: '',
    reference: '',
    commercialId: '',
    subcategory: '',
    customSubcategory: '',
    receiptPath: '',
  });
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [commercials, setCommercials] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [loading, setLoading] = useState(false);

  // Subcategories mapping (Arabic)
  const subcategories = {
    fuel: 'وقود',
    toll: 'رسوم الطريق السريع',
    transport: 'نقل',
    other: 'أخرى',
  };

  useEffect(() => {
    fetchSuppliers();
    fetchCategories();
    fetchCommercials();
    if (expense) {
      setFormData({
        categoryId: expense.categoryId?._id || expense.categoryId || '',
        category: expense.category || '', // Legacy support
        label: expense.label || expense.description || '',
        description: expense.description || expense.label || '',
        amount: expense.amount || '',
        date: expense.date ? new Date(expense.date).toISOString().split('T')[0] : (expense.expenseDate ? new Date(expense.expenseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
        expenseDate: expense.expenseDate ? new Date(expense.expenseDate).toISOString().split('T')[0] : (expense.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
        paymentMethod: expense.paymentMethod || 'cash',
        supplierId: expense.supplierId?._id || expense.supplierId || '',
        notes: expense.notes || '',
        reference: expense.reference || '',
        commercialId: expense.commercialId?._id || expense.commercialId || '',
        subcategory: expense.subcategory || '',
        customSubcategory: expense.customSubcategory || '',
        receiptPath: expense.receiptPath || '',
      });
      
      // Set receipt preview if exists
      if (expense.receiptPath) {
        setReceiptPreview(withBase(expense.receiptPath));
      }
      
      // Find and set selected category
      const category = categories.find(cat => cat._id === (expense.categoryId?._id || expense.categoryId));
      if (category) {
        setSelectedCategory(category);
      }
    }
  }, [expense, categories]);

  // Update selected category when categoryId changes
  useEffect(() => {
    if (formData.categoryId) {
      const category = categories.find(cat => cat._id === formData.categoryId);
      setSelectedCategory(category);
      
      // Reset commercial expense fields when switching away
      if (category && !category.isCommercialExpense) {
        setFormData(prev => ({
          ...prev,
          commercialId: '',
          subcategory: '',
          customSubcategory: '',
        }));
      }
    } else {
      setSelectedCategory(null);
    }
  }, [formData.categoryId, categories]);

  const fetchCommercials = async () => {
    try {
      const response = await api.get('/users', { params: { role: 'commercial' } });
      setCommercials(response.data.data || []);
    } catch (error) {
      console.error('Error fetching commercials:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/expense-categories');
      setCategories(response.data.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data.data || []);
    } catch (error) {
      // Silent error handling
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // If switching to "other" subcategory, clear customSubcategory label
    if (name === 'subcategory' && value !== 'other') {
      setFormData(prev => ({ ...prev, customSubcategory: '' }));
    }
  };

  const handleReceiptChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('نوع الملف غير مدعوم. يرجى رفع صورة أو ملف PDF');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('حجم الملف كبير جداً. الحد الأقصى هو 10MB');
      return;
    }

    setReceiptFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
      setReceiptPreview('pdf');
    }

    // Upload receipt immediately
    await handleReceiptUpload(file);
  };

  const handleReceiptUpload = async (file) => {
    if (!file) return;

    try {
      setUploadingReceipt(true);
      const formDataUpload = new FormData();
      formDataUpload.append('receipt', file);

      const response = await api.post('/uploads/expense/receipt', formDataUpload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setFormData(prev => ({
        ...prev,
        receiptPath: response.data.data.path,
      }));
      toast.success('تم رفع الإيصال بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء رفع الإيصال');
      setReceiptFile(null);
      setReceiptPreview('');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview('');
    setFormData(prev => ({ ...prev, receiptPath: '' }));
  };

  const isCommercialExpense = selectedCategory?.isCommercialExpense;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate label is required for all expenses
    if (!formData.label || formData.label.trim() === '') {
      toast.error('يجب إدخال الوصف');
      return;
    }

    // Validate commercial expense requirements
    if (isCommercialExpense) {
      if (!formData.commercialId) {
        toast.error('يجب اختيار المندوب التجاري');
        return;
      }
    }

    setLoading(true);

    try {
      // Prepare data - label is required for all expenses
      const submitData = {
        categoryId: formData.categoryId,
        label: formData.label || formData.description || '',
        amount: formData.amount,
        date: formData.date || formData.expenseDate,
        notes: formData.notes || '',
        paymentMethod: formData.paymentMethod,
      };
      
      if (formData.supplierId && formData.supplierId.trim() !== '') {
        submitData.supplierId = formData.supplierId;
      }
      
      if (formData.reference) {
        submitData.reference = formData.reference;
      }

      // Add commercial expense fields
      if (isCommercialExpense) {
        submitData.commercialId = formData.commercialId;
        submitData.subcategory = formData.subcategory;
        if (formData.customSubcategory) {
          submitData.customSubcategory = formData.customSubcategory;
        }
        if (formData.receiptPath) {
          submitData.receiptPath = formData.receiptPath;
        }
      }

      if (expense) {
        await api.put(`/expenses/${expense._id}`, submitData);
        toast.success('تم تحديث المصروف بنجاح');
      } else {
        await api.post('/expenses', submitData);
        toast.success('تم إضافة المصروف بنجاح');
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-100">
            {expense ? 'تعديل مصروف' : 'إضافة مصروف جديد'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
          >
            <X size={20} className="md:w-6 md:h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                الفئة *
              </label>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                required
                className="input-field"
              >
                <option value="">اختر الفئة</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Commercial Expense Fields */}
            {isCommercialExpense && (
              <>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    المندوب التجاري * <span className="text-red-500">(مطلوب للمصروفات التجارية)</span>
                  </label>
                  <select
                    name="commercialId"
                    value={formData.commercialId}
                    onChange={handleChange}
                    required={isCommercialExpense}
                    className="input-field"
                  >
                    <option value="">اختر المندوب التجاري</option>
                    {commercials.map((commercial) => (
                      <option key={commercial._id} value={commercial._id}>
                        {commercial.name} ({commercial.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    نوع المصروف <span className="text-gray-500">(اختياري)</span>
                  </label>
                  <select
                    name="subcategory"
                    value={formData.subcategory}
                    onChange={handleChange}
                    className="input-field"
                  >
                    <option value="">اختر نوع المصروف</option>
                    {selectedCategory?.subcategories?.map((sub) => (
                      <option key={sub} value={sub}>
                        {subcategories[sub] || sub}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.subcategory === 'other' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      وصف المصروف <span className="text-gray-500">(اختياري)</span>
                    </label>
                    <input
                      type="text"
                      name="customSubcategory"
                      value={formData.customSubcategory}
                      onChange={(e) => {
                        setFormData({ ...formData, customSubcategory: e.target.value, label: e.target.value });
                      }}
                      className="input-field"
                      placeholder="أدخل وصف المصروف..."
                    />
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    إيصال / Reçu <span className="text-gray-500">(اختياري)</span>
                  </label>
                  
                  {receiptPreview && receiptPreview !== 'pdf' && (
                    <div className="mb-3 relative">
                      <img
                        src={receiptPreview}
                        alt="Receipt preview"
                        className="w-full max-w-full md:max-w-md h-auto md:h-64 object-contain rounded-lg border border-gray-300 dark:border-gray-600"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveReceipt}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <XCircle size={20} />
                      </button>
                    </div>
                  )}

                  {receiptPreview === 'pdf' && (
                    <div className="mb-3 relative p-4 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText size={24} className="text-red-500" />
                        <span className="text-gray-700 dark:text-gray-300">تم رفع ملف PDF</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveReceipt}
                        className="p-1 text-red-500 hover:text-red-600"
                      >
                        <XCircle size={20} />
                      </button>
                    </div>
                  )}

                  {!receiptPreview && (
                    <label className="flex items-center gap-2 btn-secondary cursor-pointer w-full sm:w-fit text-sm md:text-base px-3 md:px-4 py-2">
                      <Upload size={18} className="md:w-5 md:h-5" />
                      <span className="text-xs sm:text-sm md:text-base">{uploadingReceipt ? 'جاري الرفع...' : 'رفع إيصال (صورة أو PDF)'}</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleReceiptChange}
                        className="hidden"
                        disabled={uploadingReceipt}
                      />
                    </label>
                  )}

                  {uploadingReceipt && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gold-600"></div>
                      <span>جاري رفع الإيصال...</span>
                    </div>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                المبلغ (TND) *
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                step="0.01"
                min="0"
                required
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                تاريخ المصروف *
              </label>
              <input
                type="date"
                name="date"
                value={formData.date || formData.expenseDate}
                onChange={(e) => {
                  setFormData({ ...formData, date: e.target.value, expenseDate: e.target.value });
                }}
                required
                className="input-field"
              />
            </div>

            {/* Payment method - hide for commercial expenses */}
            {!isCommercialExpense && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  طريقة الدفع
                </label>
                <select
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="cash">نقدي</option>
                  <option value="card">بطاقة</option>
                  <option value="bank_transfer">تحويل بنكي</option>
                  <option value="check">شيك</option>
                </select>
              </div>
            )}

            {/* Supplier - hide for commercial expenses */}
            {!isCommercialExpense && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  المورد (اختياري)
                </label>
                <select
                  name="supplierId"
                  value={formData.supplierId}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="">لا يوجد</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier._id} value={supplier._id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reference - hide for commercial expenses */}
            {!isCommercialExpense && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  المرجع (اختياري)
                </label>
                <input
                  type="text"
                  name="reference"
                  value={formData.reference}
                  onChange={handleChange}
                  placeholder="رقم الفاتورة أو المرجع"
                  className="input-field"
                />
              </div>
            )}

            {/* Label field - required for all expenses */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                الوصف / Label *
              </label>
              <input
                type="text"
                name="label"
                value={formData.label || formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, label: e.target.value, description: e.target.value });
                }}
                className="input-field"
                placeholder="وصف المصروف..."
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ملاحظات (اختياري)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                className="input-field"
                placeholder="ملاحظات إضافية..."
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 md:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-sm md:text-base px-4 py-2 order-2 sm:order-1"
              disabled={loading}
            >
              إلغاء
            </button>
            <button type="submit" className="btn-primary text-sm md:text-base px-4 py-2 order-1 sm:order-2" disabled={loading}>
              {loading ? 'جاري الحفظ...' : expense ? 'تحديث' : 'إضافة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExpenseModal;

