import { useState, useEffect } from 'react';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { Save, Search, CheckCircle2, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { withBase } from '../../utils/imageUrl';

const FeaturedProducts = () => {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [allProducts, setAllProducts] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      const response = await api.get('/homepage/admin/featured');
      if (response.data.success) {
        setAllProducts(response.data.data.allProducts || []);
        setFeaturedProducts(response.data.data.featured || []);
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب البيانات');
    } finally {
      setLoadingData(false);
    }
  };

  const toggleFeatured = (productId) => {
    const isFeatured = featuredProducts.some((fp) => fp.product_id._id === productId);
    if (isFeatured) {
      setFeaturedProducts(featuredProducts.filter((fp) => fp.product_id._id !== productId));
    } else {
      const product = allProducts.find((p) => p._id === productId);
      if (product) {
        setFeaturedProducts([
          ...featuredProducts,
          {
            product_id: product,
            sort_order: featuredProducts.length,
          },
        ]);
      }
    }
  };

  const moveUp = (index) => {
    if (index === 0) return;
    const newFeatured = [...featuredProducts];
    [newFeatured[index - 1], newFeatured[index]] = [newFeatured[index], newFeatured[index - 1]];
    newFeatured[index - 1].sort_order = index - 1;
    newFeatured[index].sort_order = index;
    setFeaturedProducts(newFeatured);
  };

  const moveDown = (index) => {
    if (index === featuredProducts.length - 1) return;
    const newFeatured = [...featuredProducts];
    [newFeatured[index], newFeatured[index + 1]] = [newFeatured[index + 1], newFeatured[index]];
    newFeatured[index].sort_order = index;
    newFeatured[index + 1].sort_order = index + 1;
    setFeaturedProducts(newFeatured);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const productIds = featuredProducts.map((fp) => fp.product_id._id || fp.product_id);
      await api.post('/homepage/admin/featured/update', { product_ids: productIds });
      toast.success('تم حفظ المنتجات المميزة بنجاح');
      fetchData();
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = allProducts.filter((product) =>
    product.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const featuredProductIds = featuredProducts.map((fp) => fp.product_id._id || fp.product_id);

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">إدارة المنتجات المميزة</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">اختر المنتجات التي تظهر في القسم المميز</p>
      </div>

      {/* Featured Products List */}
      {featuredProducts.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            المنتجات المميزة المحددة ({featuredProducts.length})
          </h2>
          <div className="space-y-2">
            {featuredProducts.map((fp, index) => {
              const product = fp.product_id;
              return (
                <div
                  key={product._id || product}
                  className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <span className="text-gray-500 dark:text-gray-400 font-medium w-8">
                    #{index + 1}
                  </span>
                  <div className="flex-1 flex items-center gap-4">
                    {product.images?.[0] && (
                      <img
                        src={withBase(product.images[0])}
                        alt={product.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {product.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {product.price} TND
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-50"
                    >
                      <ArrowUp size={20} />
                    </button>
                    <button
                      onClick={() => moveDown(index)}
                      disabled={index === featuredProducts.length - 1}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-50"
                    >
                      <ArrowDown size={20} />
                    </button>
                    <button
                      onClick={() => toggleFeatured(product._id || product)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products List */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">جميع المنتجات</h2>
            <div className="relative w-64">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="البحث..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pr-10"
              />
            </div>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredProducts.map((product) => {
              const isFeatured = featuredProductIds.includes(product._id);
              return (
                <div
                  key={product._id}
                  className={`flex items-center gap-4 p-3 rounded-lg border-2 ${
                    isFeatured
                      ? 'border-gold-500 bg-gold-50 dark:bg-gold-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {product.images?.[0] && (
                    <img
                      src={withBase(product.images[0])}
                      alt={product.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">{product.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{product.price} TND</p>
                  </div>
                  <button
                    onClick={() => toggleFeatured(product._id)}
                    className={`p-2 rounded ${
                      isFeatured
                        ? 'bg-gold-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <CheckCircle2 size={20} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Save Button */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">الإجراءات</h2>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              تم تحديد {featuredProducts.length} منتج مميز
            </p>
            <button onClick={handleSave} className="btn-primary w-full" disabled={loading}>
              <Save size={18} className="ml-2" />
              حفظ التغييرات
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeaturedProducts;

