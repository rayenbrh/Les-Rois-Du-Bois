import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { Tag, Plus, Edit, Trash2, GripVertical, X, ArrowRight } from 'lucide-react';

const ExpenseCategories = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await api.get('/expense-categories');
      setCategories(response.data.data || []);
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب الفئات');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('يجب إدخال اسم الفئة');
      return;
    }

    setSaving(true);
    try {
      if (editingCategory) {
        await api.put(`/expense-categories/${editingCategory._id}`, formData);
        toast.success('تم تحديث الفئة بنجاح');
      } else {
        await api.post('/expense-categories', formData);
        toast.success('تم إضافة الفئة بنجاح');
      }
      setIsModalOpen(false);
      setEditingCategory(null);
      setFormData({ name: '' });
      fetchCategories();
    } catch (error) {
      const message = error.response?.data?.message || 'حدث خطأ';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({ name: category.name });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الفئة؟')) {
      return;
    }

    try {
      await api.delete(`/expense-categories/${id}`);
      toast.success('تم حذف الفئة بنجاح');
      fetchCategories();
    } catch (error) {
      const message = error.response?.data?.message || 'حدث خطأ أثناء حذف الفئة';
      toast.error(message);
    }
  };

  const handleReorder = async (fromIndex, toIndex) => {
    const newCategories = [...categories];
    const [removed] = newCategories.splice(fromIndex, 1);
    newCategories.splice(toIndex, 0, removed);

    // Update orderIndex for all categories
    const reordered = newCategories.map((cat, index) => ({
      id: cat._id,
      orderIndex: index,
    }));

    try {
      await api.post('/expense-categories/reorder', { categories: reordered });
      toast.success('تم تحديث الترتيب بنجاح');
      fetchCategories();
    } catch (error) {
      toast.error('حدث خطأ أثناء تحديث الترتيب');
      fetchCategories(); // Revert on error
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormData({ name: '' });
  };

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={() => navigate('/admin/expenses')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
            title="رجوع إلى المصروفات"
          >
            <ArrowRight size={20} className="md:w-6 md:h-6" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
              فئات المصروفات
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
              إدارة فئات المصروفات وترتيبها
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center justify-center gap-2 text-sm md:text-base px-4 py-2"
        >
          <Plus size={18} className="md:w-5 md:h-5" />
          <span>إضافة فئة</span>
        </button>
      </div>

      <div className="card p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">لا توجد فئات</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary mt-4 text-sm md:text-base px-4 py-2"
            >
              إضافة فئة جديدة
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((category, index) => (
              <div
                key={category._id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 md:p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                  <div className="text-gray-400 dark:text-gray-500 flex-shrink-0">
                    <GripVertical size={18} className="md:w-5 md:h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100 truncate">
                      {category.name}
                    </p>
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                      الترتيب: {index + 1}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                  <button
                    onClick={() => handleEdit(category)}
                    className="p-1.5 md:p-2 text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg transition-colors"
                    title="تعديل"
                  >
                    <Edit size={16} className="md:w-[18px] md:h-[18px]" />
                  </button>
                  <button
                    onClick={() => handleDelete(category._id)}
                    className="p-1.5 md:p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="حذف"
                  >
                    <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
                  </button>
                  {index > 0 && (
                    <button
                      onClick={() => handleReorder(index, index - 1)}
                      className="p-1.5 md:p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm md:text-base"
                      title="نقل لأعلى"
                    >
                      ↑
                    </button>
                  )}
                  {index < categories.length - 1 && (
                    <button
                      onClick={() => handleReorder(index, index + 1)}
                      className="p-1.5 md:p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm md:text-base"
                      title="نقل لأسفل"
                    >
                      ↓
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
              <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-100">
                {editingCategory ? 'تعديل فئة' : 'إضافة فئة جديدة'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
              >
                <X size={20} className="md:w-6 md:h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  اسم الفئة *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="input-field"
                  placeholder="أدخل اسم الفئة"
                  autoFocus
                />
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 md:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-secondary text-sm md:text-base px-4 py-2 order-2 sm:order-1"
                  disabled={saving}
                >
                  إلغاء
                </button>
                <button type="submit" className="btn-primary text-sm md:text-base px-4 py-2 order-1 sm:order-2" disabled={saving}>
                  {saving ? 'جاري الحفظ...' : editingCategory ? 'تحديث' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseCategories;

