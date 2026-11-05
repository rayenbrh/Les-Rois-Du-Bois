import { useState, useEffect } from 'react';
import api from '../utils/axios';
import toast from 'react-hot-toast';
import { X, Upload, Loader2 } from 'lucide-react';
import { withBase } from '../utils/imageUrl';

const SpecialProductModal = ({ product, onClose }) => {
  const [step, setStep] = useState(1);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    baseProductA: '',
    baseProductB: '',
    finalPrice: '',
    description: '',
    status: 'visible',
    combinations: [],
  });
  const [selectedVariantsA, setSelectedVariantsA] = useState([]);
  const [selectedVariantsB, setSelectedVariantsB] = useState([]);
  const [productA, setProductA] = useState(null);
  const [productB, setProductB] = useState(null);
  const [combinationData, setCombinationData] = useState(null);
  const [uploadingImages, setUploadingImages] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
    if (product) {
      setFormData({
        name: product.name || '',
        baseProductA: product.baseProductA?._id || product.baseProductA || '',
        baseProductB: product.baseProductB?._id || product.baseProductB || '',
        finalPrice: product.finalPrice || '',
        description: product.description || '',
        status: product.status || 'visible',
        combinations: product.combinations || [],
      });
      if (product.combinations && product.combinations.length > 0) {
        setStep(4);
      }
    }
  }, [product]);

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const response = await api.get('/products');
      setProducts(response.data.data || []);
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب المنتجات');
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleGenerateCombinations = async () => {
    if (!formData.baseProductA || !formData.baseProductB) {
      toast.error('يرجى اختيار المنتجين الأساسيين');
      return;
    }

    if (formData.baseProductA === formData.baseProductB) {
      toast.error('يجب اختيار منتجين مختلفين');
      return;
    }

    // Check if variants are selected
    if (productA?.variants?.length > 0 && selectedVariantsA.length === 0) {
      toast.error('يرجى اختيار متغير واحد على الأقل للمنتج الأول');
      return;
    }

    if (productB?.variants?.length > 0 && selectedVariantsB.length === 0) {
      toast.error('يرجى اختيار متغير واحد على الأقل للمنتج الثاني');
      return;
    }

    try {
      setGenerating(true);
      const response = await api.post('/special-products/generate-combinations', {
        productAId: formData.baseProductA,
        productBId: formData.baseProductB,
        selectedVariantsA: selectedVariantsA.length > 0 ? selectedVariantsA : null,
        selectedVariantsB: selectedVariantsB.length > 0 ? selectedVariantsB : null,
      });

      setCombinationData(response.data.data);
      setFormData((prev) => ({
        ...prev,
        combinations: response.data.data.combinations.map((combo) => ({
          optionA: combo.optionA,
          optionB: combo.optionB,
          finalImage: '',
          additionalPrice: combo.additionalPrice || 0,
        })),
      }));
      setStep(4);
      toast.success('تم إنشاء التركيبات بنجاح');
    } catch (error) {
      const message = error.response?.data?.message || 'حدث خطأ أثناء إنشاء التركيبات';
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleImageUpload = async (combinationIndex, file) => {
    if (!file) return;

    try {
      setUploadingImages((prev) => ({ ...prev, [combinationIndex]: true }));
      const formDataUpload = new FormData();
      formDataUpload.append('image', file);

      const response = await api.post('/uploads/special-product', formDataUpload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setFormData((prev) => ({
        ...prev,
        combinations: prev.combinations.map((combo, index) =>
          index === combinationIndex
            ? { ...combo, finalImage: response.data.data.path }
            : combo
        ),
      }));

      toast.success('تم رفع الصورة بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء رفع الصورة');
    } finally {
      setUploadingImages((prev) => ({ ...prev, [combinationIndex]: false }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (step < 5) {
      toast.error('يرجى إكمال جميع الخطوات');
      return;
    }

    // Validate that all combinations have images
    const missingImages = formData.combinations.filter((combo) => !combo.finalImage);
    if (missingImages.length > 0) {
      toast.error('يرجى رفع صورة لكل تركيبة');
      return;
    }

    try {
      setLoading(true);
      if (product) {
        await api.put(`/special-products/${product._id}`, formData);
        toast.success('تم تحديث المنتج الخاص بنجاح');
      } else {
        await api.post('/special-products', formData);
        toast.success('تم إنشاء المنتج الخاص بنجاح');
      }
      onClose();
    } catch (error) {
      const message = error.response?.data?.message || 'حدث خطأ';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const canProceedToStep2 = formData.baseProductA && formData.baseProductB && formData.baseProductA !== formData.baseProductB;
  const canProceedToStep3 = 
    (productA?.variants?.length > 0 ? selectedVariantsA.length > 0 : true) &&
    (productB?.variants?.length > 0 ? selectedVariantsB.length > 0 : true);
  const canProceedToStep5 = formData.combinations.length > 0 && formData.combinations.every((c) => c.finalImage);

  // Update product A and B when selected
  useEffect(() => {
    if (formData.baseProductA) {
      const selectedA = products.find(p => p._id === formData.baseProductA);
      setProductA(selectedA || null);
      setSelectedVariantsA([]);
    } else {
      setProductA(null);
      setSelectedVariantsA([]);
    }
  }, [formData.baseProductA, products]);

  useEffect(() => {
    if (formData.baseProductB) {
      const selectedB = products.find(p => p._id === formData.baseProductB);
      setProductB(selectedB || null);
      setSelectedVariantsB([]);
    } else {
      setProductB(null);
      setSelectedVariantsB([]);
    }
  }, [formData.baseProductB, products]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {product ? 'تعديل المنتج الخاص' : 'إضافة منتج خاص جديد'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Steps Indicator */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    step >= s
                      ? 'bg-gold-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                  }`}
                >
                  {s}
                </div>
                {s < 5 && (
                  <div
                    className={`w-12 h-1 mx-1 ${
                      step > s ? 'bg-gold-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-8 mt-4 text-xs">
            <span className={step >= 1 ? 'text-gold-600 font-medium' : 'text-gray-500'}>
              اختيار المنتجات
            </span>
            <span className={step >= 2 ? 'text-gold-600 font-medium' : 'text-gray-500'}>
              اختيار المتغيرات
            </span>
            <span className={step >= 3 ? 'text-gold-600 font-medium' : 'text-gray-500'}>
              إنشاء التركيبات
            </span>
            <span className={step >= 4 ? 'text-gold-600 font-medium' : 'text-gray-500'}>
              رفع الصور
            </span>
            <span className={step >= 5 ? 'text-gold-600 font-medium' : 'text-gray-500'}>
              التفاصيل
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Step 1: Choose Products */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  اسم المنتج الخاص *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  required
                  placeholder="مثال: طاولة كاملة"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    المنتج الأساسي الأول *
                  </label>
                  <select
                    value={formData.baseProductA}
                    onChange={(e) => setFormData({ ...formData, baseProductA: e.target.value })}
                    className="input-field"
                    required
                    disabled={loadingProducts}
                  >
                    <option value="">اختر المنتج الأول</option>
                    {products.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    المنتج الأساسي الثاني *
                  </label>
                  <select
                    value={formData.baseProductB}
                    onChange={(e) => setFormData({ ...formData, baseProductB: e.target.value })}
                    className="input-field"
                    required
                    disabled={loadingProducts}
                  >
                    <option value="">اختر المنتج الثاني</option>
                    {products
                      .filter((p) => p._id !== formData.baseProductA)
                      .map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {formData.baseProductA && formData.baseProductB && (
                <div className="p-4 bg-gold-50 dark:bg-gold-900/20 rounded-lg">
                  <p className="text-sm text-gold-800 dark:text-gold-300">
                    سيتم إنشاء جميع التركيبات الممكنة من متغيرات المنتجين المختارين
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-4">
                <button type="button" onClick={onClose} className="btn-secondary">
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!canProceedToStep2}
                  className="btn-primary disabled:opacity-50"
                >
                  التالي
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Select Variants */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  اختر المتغيرات
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  اختر المتغيرات التي تريد استخدامها من كل منتج
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Product A Variants */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    {productA?.name || 'المنتج الأول'}
                  </h4>
                  {productA?.variants && productA.variants.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {productA.variants.map((variant, idx) => (
                        <label
                          key={idx}
                          className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedVariantsA.some(v => v.value === variant.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedVariantsA([...selectedVariantsA, variant]);
                              } else {
                                setSelectedVariantsA(selectedVariantsA.filter(v => v.value !== variant.value));
                              }
                            }}
                            className="w-5 h-5 text-gold-600 border-gray-300 rounded focus:ring-gold-500"
                          />
                          <div className="flex-1">
                            {variant.image && (
                              <img
                                src={withBase(variant.image)}
                                alt={variant.value}
                                className="w-16 h-16 object-cover rounded mb-2"
                              />
                            )}
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {variant.value || variant.name}
                            </div>
                            {variant.stock !== undefined && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                المخزون: {variant.stock}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                      هذا المنتج لا يحتوي على متغيرات
                    </div>
                  )}
                </div>

                {/* Product B Variants */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    {productB?.name || 'المنتج الثاني'}
                  </h4>
                  {productB?.variants && productB.variants.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {productB.variants.map((variant, idx) => (
                        <label
                          key={idx}
                          className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedVariantsB.some(v => v.value === variant.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedVariantsB([...selectedVariantsB, variant]);
                              } else {
                                setSelectedVariantsB(selectedVariantsB.filter(v => v.value !== variant.value));
                              }
                            }}
                            className="w-5 h-5 text-gold-600 border-gray-300 rounded focus:ring-gold-500"
                          />
                          <div className="flex-1">
                            {variant.image && (
                              <img
                                src={withBase(variant.image)}
                                alt={variant.value}
                                className="w-16 h-16 object-cover rounded mb-2"
                              />
                            )}
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {variant.value || variant.name}
                            </div>
                            {variant.stock !== undefined && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                المخزون: {variant.stock}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                      هذا المنتج لا يحتوي على متغيرات
                    </div>
                  )}
                </div>
              </div>

              {canProceedToStep3 && (
                <div className="p-4 bg-gold-50 dark:bg-gold-900/20 rounded-lg">
                  <p className="text-sm text-gold-800 dark:text-gold-300">
                    سيتم إنشاء {selectedVariantsA.length || 1} × {selectedVariantsB.length || 1} = {(selectedVariantsA.length || 1) * (selectedVariantsB.length || 1)} تركيبة
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-4">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary">
                  السابق
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!canProceedToStep3}
                  className="btn-primary disabled:opacity-50"
                >
                  التالي
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Generate Combinations */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  إنشاء التركيبات
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  سيتم إنشاء التركيبات من المتغيرات المختارة
                </p>
              </div>

              <button
                type="button"
                onClick={handleGenerateCombinations}
                disabled={generating}
                className="w-full btn-primary disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>جاري إنشاء التركيبات...</span>
                  </>
                ) : (
                  <span>إنشاء التركيبات</span>
                )}
              </button>

              <div className="flex items-center justify-end gap-4">
                <button type="button" onClick={() => setStep(2)} className="btn-secondary">
                  السابق
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Upload Images */}
          {step === 4 && combinationData && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  رفع صور التركيبات
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  يرجى رفع صورة لكل تركيبة من التركيبات التالية
                </p>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {formData.combinations.map((combo, index) => {
                  // Get images for each variant - try variant image first, then product image
                  const variantAImage = combo.optionA.variant.image || 
                    (combinationData?.productA?.images && combinationData.productA.images.length > 0 
                      ? combinationData.productA.images[0] 
                      : '');
                  const variantBImage = combo.optionB.variant.image || 
                    (combinationData?.productB?.images && combinationData.productB.images.length > 0 
                      ? combinationData.productB.images[0] 
                      : '');
                  
                  return (
                    <div
                      key={index}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/30"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                        {/* Product A Variant */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {combo.optionA.productName}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                            {combo.optionA.variant.name || 'المتغير'}: {combo.optionA.variant.value}
                          </p>
                          {variantAImage ? (
                            <div className="w-full h-32 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                              <img
                                src={withBase(variantAImage)}
                                alt={combo.optionA.variant.value}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-32 bg-gray-200 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-center">
                              <span className="text-xs text-gray-500 dark:text-gray-400">لا توجد صورة</span>
                            </div>
                          )}
                        </div>

                        {/* Product B Variant */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {combo.optionB.productName}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                            {combo.optionB.variant.name || 'المتغير'}: {combo.optionB.variant.value}
                          </p>
                          {variantBImage ? (
                            <div className="w-full h-32 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                              <img
                                src={withBase(variantBImage)}
                                alt={combo.optionB.variant.value}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-32 bg-gray-200 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-center">
                              <span className="text-xs text-gray-500 dark:text-gray-400">لا توجد صورة</span>
                            </div>
                          )}
                        </div>

                        {/* Final Combination Image Upload */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            صورة التركيبة النهائية
                          </p>
                          {combo.finalImage ? (
                            <div className="space-y-2">
                              <div className="w-full h-32 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden border-2 border-gold-500">
                                <img
                                  src={withBase(combo.finalImage)}
                                  alt="Combination"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <label className="flex items-center gap-2 btn-secondary cursor-pointer text-sm w-full justify-center">
                                <Upload size={16} />
                                <span>تغيير الصورة</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                      handleImageUpload(index, file);
                                    }
                                  }}
                                  className="hidden"
                                  disabled={uploadingImages[index]}
                                />
                              </label>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="w-full h-32 bg-gray-200 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                                <span className="text-xs text-gray-500 dark:text-gray-400">لم يتم رفع صورة</span>
                              </div>
                              <label className="flex items-center gap-2 btn-primary cursor-pointer text-sm w-full justify-center">
                                <Upload size={16} />
                                <span>رفع صورة التركيبة</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                      handleImageUpload(index, file);
                                    }
                                  }}
                                  className="hidden"
                                  disabled={uploadingImages[index]}
                                />
                              </label>
                            </div>
                          )}
                          {uploadingImages[index] && (
                            <div className="flex items-center gap-2 text-sm text-gold-600 dark:text-gold-400 justify-center">
                              <Loader2 className="animate-spin" size={16} />
                              <span>جاري الرفع...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-4">
                <button type="button" onClick={() => setStep(3)} className="btn-secondary">
                  السابق
                </button>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  disabled={!canProceedToStep5}
                  className="btn-primary disabled:opacity-50"
                >
                  التالي
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Final Details */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  التفاصيل النهائية
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    السعر النهائي (TND) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.finalPrice}
                    onChange={(e) => setFormData({ ...formData, finalPrice: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    الحالة
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="input-field"
                  >
                    <option value="visible">ظاهر</option>
                    <option value="hidden">مخفي</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  الوصف
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  rows="4"
                />
              </div>

              <div className="p-4 bg-gold-50 dark:bg-gold-900/20 rounded-lg">
                <p className="text-sm text-gold-800 dark:text-gold-300">
                  عدد التركيبات: {formData.combinations.length}
                </p>
              </div>

              <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setStep(4)} className="btn-secondary">
                  السابق
                </button>
                <button type="button" onClick={onClose} className="btn-secondary">
                  إلغاء
                </button>
                <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
                  {loading ? 'جاري الحفظ...' : product ? 'تحديث' : 'إنشاء'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default SpecialProductModal;

