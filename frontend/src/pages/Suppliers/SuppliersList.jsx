import { useState, useEffect } from 'react';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { Truck, Plus, Edit, Trash2 } from 'lucide-react';
import SupplierModal from '../../components/SupplierModal';

const SuppliersList = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data.data || []);
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب الموردين');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المورد؟')) {
      return;
    }

    try {
      await api.delete(`/suppliers/${id}`);
      toast.success('تم حذف المورد بنجاح');
      fetchSuppliers();
    } catch (error) {
      const message = error.response?.data?.message || 'حدث خطأ أثناء حذف المورد';
      toast.error(message);
    }
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
    fetchSuppliers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">الموردون</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">إدارة الموردين</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          <span>إضافة مورد</span>
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-12">
            <Truck className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">لا يوجد موردون</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-right py-3 px-4 text-sm font-medium">الاسم</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الكود</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">جهة الاتصال</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الهاتف</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr
                    key={supplier._id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-4 font-medium">{supplier.name}</td>
                    <td className="py-3 px-4">{supplier.code}</td>
                    <td className="py-3 px-4">{supplier.contactName || '-'}</td>
                    <td className="py-3 px-4">{supplier.phone || '-'}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(supplier)}
                          className="p-2 text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg transition-colors"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(supplier._id)}
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
        <SupplierModal
          supplier={editingSupplier}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default SuppliersList;

