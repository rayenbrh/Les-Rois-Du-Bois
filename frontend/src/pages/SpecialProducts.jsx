import { useState, useEffect } from 'react';
import api from '../utils/axios';
import toast from 'react-hot-toast';
import { Plus, Search, Edit, Trash2, Boxes } from 'lucide-react';
import SpecialProductModal from '../components/SpecialProductModal';

const SpecialProducts = () => {
  const [specialProducts, setSpecialProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    fetchSpecialProducts();
  }, [searchTerm, selectedStatus]);

  const fetchSpecialProducts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (selectedStatus) params.status = selectedStatus;

      const response = await api.get('/special-products', { params });
      setSpecialProducts(response.data.data || []);
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب المنتجات الخاصة');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المنتج الخاص؟')) {
      return;
    }

    try {
      await api.delete(`/special-products/${id}`);
      toast.success('تم حذف المنتج الخاص بنجاح');
      fetchSpecialProducts();
    } catch (error) {
      const message = error.response?.data?.message || 'حدث خطأ أثناء حذف المنتج الخاص';
      toast.error(message);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    fetchSpecialProducts();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">إدارة المنتجات الخاصة</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">إدارة المنتجات المكونة من منتجين</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          <span>إضافة منتج خاص</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="البحث عن منتج خاص..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pr-10"
            />
          </div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="input-field"
          >
            <option value="">جميع الحالات</option>
            <option value="visible">ظاهر</option>
            <option value="hidden">مخفي</option>
          </select>
        </div>
      </div>

      {/* Special Products Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
          </div>
        ) : specialProducts.length === 0 ? (
          <div className="text-center py-12">
            <Boxes className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500 dark:text-gray-400">لا توجد منتجات خاصة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">الاسم</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">المنتج الأساسي 1</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">المنتج الأساسي 2</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">عدد التركيبات</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">السعر النهائي</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">الحالة</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {specialProducts.map((product) => (
                  <tr key={product._id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{product.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{product.slug}</div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {product.baseProductA?.name || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {product.baseProductB?.name || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-gold-100 dark:bg-gold-900/30 text-gold-800 dark:text-gold-400 rounded-full text-sm font-medium">
                        {product.combinations?.length || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{product.finalPrice} TND</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          product.status === 'visible'
                            ? 'bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                        }`}
                      >
                        {product.status === 'visible' ? 'ظاهر' : 'مخفي'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(product)}
                          className="p-2 text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg transition-colors"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(product._id)}
                          className="p-2 text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
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
        <SpecialProductModal
          product={editingProduct}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default SpecialProducts;

