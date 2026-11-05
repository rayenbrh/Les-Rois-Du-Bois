import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { DollarSign, Plus, Edit, Trash2, Search, FileText, Download, X, Tag } from 'lucide-react';
import ExpenseModal from './ExpenseModal';

const ExpensesList = () => {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfParams, setPdfParams] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    benefit: 0,
  });
  const [commercials, setCommercials] = useState([]);
  const [filters, setFilters] = useState({
    categoryId: '',
    commercialId: '',
    subcategory: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchCategories();
    fetchCommercials();
    fetchExpenses();
  }, [filters]);

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

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.categoryId) params.categoryId = filters.categoryId;
      if (filters.commercialId) params.commercialId = filters.commercialId;
      if (filters.subcategory) params.subcategory = filters.subcategory;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await api.get('/expenses', { params });
      setExpenses(response.data.data || []);
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب المصروفات');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = async () => {
    try {
      const { month, year, benefit } = pdfParams;
      
      // Get the base URL from axios config
      const response = await api.get('/expenses/pdf', {
        params: { month, year, benefit },
        responseType: 'blob',
      });
      
      // Create blob URL and trigger download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `depenses-${year}-${String(month).padStart(2, '0')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('تم تحميل ملف PDF بنجاح');
      setShowPdfModal(false);
    } catch (error) {
      toast.error('حدث خطأ أثناء توليد ملف PDF');
      console.error('PDF generation error:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
      return;
    }

    try {
      await api.delete(`/expenses/${id}`);
      toast.success('تم حذف المصروف بنجاح');
      fetchExpenses();
    } catch (error) {
      const message = error.response?.data?.message || 'حدث خطأ أثناء حذف المصروف';
      toast.error(message);
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
    fetchExpenses();
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">المصروفات</h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">إدارة المصروفات والنفقات</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <button
            onClick={() => navigate('/admin/expenses/categories')}
            className="btn-secondary flex items-center justify-center gap-2 text-sm md:text-base px-3 md:px-4 py-2"
          >
            <Tag size={18} className="md:w-5 md:h-5" />
            <span className="hidden sm:inline">إدارة الفئات</span>
            <span className="sm:hidden">الفئات</span>
          </button>
          <button
            onClick={() => setShowPdfModal(true)}
            className="btn-secondary flex items-center justify-center gap-2 text-sm md:text-base px-3 md:px-4 py-2"
          >
            <FileText size={18} className="md:w-5 md:h-5" />
            <span className="hidden sm:inline">توليد تقرير PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center justify-center gap-2 text-sm md:text-base px-3 md:px-4 py-2"
          >
            <Plus size={18} className="md:w-5 md:h-5" />
            <span className="hidden sm:inline">إضافة مصروف</span>
            <span className="sm:hidden">إضافة</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">إجمالي المصروفات</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {totalExpenses.toFixed(2)} TND
              </p>
            </div>
            <DollarSign className="text-gold-500" size={32} />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">عدد المصروفات</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {expenses.length}
              </p>
            </div>
            <DollarSign className="text-gold-500" size={32} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
          <select
            value={filters.categoryId}
            onChange={(e) => setFilters({ ...filters, categoryId: e.target.value, subcategory: '' })}
            className="input-field"
          >
            <option value="">جميع الفئات</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.name}
              </option>
            ))}
          </select>
          
          <select
            value={filters.commercialId}
            onChange={(e) => setFilters({ ...filters, commercialId: e.target.value })}
            className="input-field"
          >
            <option value="">جميع المندوبين</option>
            {commercials.map((commercial) => (
              <option key={commercial._id} value={commercial._id}>
                {commercial.name}
              </option>
            ))}
          </select>

          {filters.categoryId && categories.find(c => c._id === filters.categoryId)?.isCommercialExpense && (
            <select
              value={filters.subcategory}
              onChange={(e) => setFilters({ ...filters, subcategory: e.target.value })}
              className="input-field"
            >
              <option value="">جميع الأنواع</option>
              <option value="fuel">وقود</option>
              <option value="toll">رسوم الطريق السريع</option>
              <option value="transport">نقل</option>
              <option value="other">أخرى</option>
            </select>
          )}
          
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="input-field"
            placeholder="من تاريخ"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="input-field"
            placeholder="إلى تاريخ"
          />
        </div>
      </div>

      <div className="card p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">لا توجد مصروفات</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <div className="inline-block min-w-full align-middle px-4 md:px-0">
              <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-right py-3 px-4 text-sm font-medium">رقم المصروف</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الفئة</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الوصف</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">المبلغ</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">التاريخ</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr
                    key={expense._id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-4">{expense.expenseNumber}</td>
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium">
                          {expense.categoryId?.name || expense.category || '-'}
                        </div>
                        {expense.subcategory && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {expense.subcategory === 'fuel' && 'وقود'}
                            {expense.subcategory === 'toll' && 'رسوم الطريق السريع'}
                            {expense.subcategory === 'transport' && 'نقل'}
                            {expense.subcategory === 'other' && expense.customSubcategory && expense.customSubcategory}
                            {expense.subcategory === 'other' && !expense.customSubcategory && 'أخرى'}
                          </div>
                        )}
                        {expense.commercialId && (
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            Commercial: {expense.commercialId.name || expense.commercialId}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {expense.label || expense.description || '-'}
                    </td>
                    <td className="py-3 px-4 font-medium">{expense.amount} TND</td>
                    <td className="py-3 px-4 text-sm">
                      {new Date(expense.date || expense.expenseDate).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 md:gap-2">
                        <button
                          onClick={() => handleEdit(expense)}
                          className="p-1.5 md:p-2 text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <Edit size={16} className="md:w-[18px] md:h-[18px]" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense._id)}
                          className="p-1.5 md:p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <ExpenseModal expense={editingExpense} onClose={handleCloseModal} />
      )}

      {showPdfModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
              <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-100">
                توليد تقرير المصروفات
              </h2>
              <button
                onClick={() => setShowPdfModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
              >
                <X size={20} className="md:w-6 md:h-6" />
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  الشهر
                </label>
                <select
                  value={pdfParams.month}
                  onChange={(e) => setPdfParams({ ...pdfParams, month: parseInt(e.target.value) })}
                  className="input-field"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <option key={m} value={m}>
                      {new Date(2024, m - 1).toLocaleDateString('fr-FR', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  السنة
                </label>
                <input
                  type="number"
                  value={pdfParams.year}
                  onChange={(e) => setPdfParams({ ...pdfParams, year: parseInt(e.target.value) })}
                  className="input-field"
                  min="2020"
                  max="2100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  BÉNÉFICE (TND)
                </label>
                <input
                  type="number"
                  value={pdfParams.benefit}
                  onChange={(e) => setPdfParams({ ...pdfParams, benefit: parseFloat(e.target.value) || 0 })}
                  className="input-field"
                  step="0.01"
                  min="0"
                  placeholder="0"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 md:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowPdfModal(false)}
                  className="btn-secondary text-sm md:text-base px-4 py-2 order-2 sm:order-1"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePDF}
                  className="btn-primary flex items-center justify-center gap-2 text-sm md:text-base px-4 py-2 order-1 sm:order-2"
                >
                  <Download size={18} className="md:w-5 md:h-5" />
                  <span>تحميل PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesList;

