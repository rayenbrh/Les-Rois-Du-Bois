import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PosBackLink from '../../components/shared/PosBackLink';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  DollarSign,
  X,
  Check,
  Package,
  Sparkles,
  Filter,
  CheckCircle2,
  Printer,
  Download,
  Users,
  Search as SearchIcon,
  ArrowLeft,
  LogOut,
  BarChart3,
} from 'lucide-react';
import { useAuth, CASHIER_ROLES } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { withBase } from '../../utils/imageUrl';
import CreditSalePanel from '../../components/pos/CreditSale';
import { formatMillimes, newIdempotencyKey } from '../../utils/money';

// Helper function to get redirect path based on role
const getBackPath = (role) => {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'commercial':
      return '/commercial';
    case 'cashier':
    case 'store_cashier':
    case 'saler':
      return '/pos'; // Cashiers stay on POS
    default:
      return '/pos';
  }
};

const POSInterface = () => {
  const { user, loading: authLoading, logout } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Protect POS route - redirect if not authenticated or not authorized
  useEffect(() => {
    // Only redirect after auth has finished loading
    if (!authLoading) {
      const token = localStorage.getItem('token');
      const cashierId = localStorage.getItem('cashierId');
      
      // For cashiers: check cashierId instead of token (they stay logged in)
      if (cashierId && !token) {
        // Cashier is logged in via ID - allow access
        // If we don't have user data yet, it will be fetched by AuthContext
        return;
      }
      
      // If no token and no cashierId and no user, redirect to login
      if (!token && !cashierId && !user) {
        navigate('/login', { replace: true });
        return;
      }
      
      // If we have a user, check their role
      if (user) {
        const allowedRoles = ['cashier', 'store_cashier', 'saler', 'admin', 'commercial'];
        if (!allowedRoles.includes(user.role)) {
          // If not authorized, redirect based on role
          if (user.role === 'commercial') {
            navigate('/commercial', { replace: true });
          } else if (user.role === 'client' || user.role === 'user') {
            navigate('/shop', { replace: true });
          } else {
            navigate('/login', { replace: true });
          }
        }
        // If user is authorized, they're allowed - stay on POS
      } else if (token || cashierId) {
        // We have a token/cashierId but no user - backend might be down
        // Don't redirect to login immediately - keep credentials and stay on POS
        // This allows user to continue working if backend comes back online
        return;
      }
      // If no token/cashierId and no user, redirect will happen above
    }
    // If still loading, don't do anything
  }, [user, authLoading, navigate]);

  // Block browser back button - keep cashiers on POS (admins and sales reps can leave)
  const canLeavePos = Boolean(user) && !CASHIER_ROLES.includes(user.role);
  useEffect(() => {
    if (canLeavePos) return undefined;

    // Push current route to history to have control
    if (window.location.pathname !== '/pos') {
      window.history.pushState(null, '', '/pos');
    }
    
    const handlePopState = (e) => {
      const currentPath = window.location.pathname;
      // If trying to go back to /shop or any non-POS route, redirect to /pos
      if (!currentPath.startsWith('/pos')) {
        window.history.pushState(null, '', '/pos');
        navigate('/pos', { replace: true });
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate, canLeavePos]);

  // State
  const [products, setProducts] = useState({ regularProducts: [], specialProducts: [], categories: [] });
  
  // Load cart from localStorage on mount
  const loadCartFromStorage = () => {
    try {
      const savedCart = localStorage.getItem('posCart');
      if (savedCart) {
        return JSON.parse(savedCart);
      }
    } catch (error) {
      console.error('Error loading cart from storage:', error);
    }
    return [];
  };
  
  const [cart, setCart] = useState(loadCartFromStorage);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeTab, setActiveTab] = useState('regular'); // 'regular' or 'special'
  
  // Load discount and notes from localStorage
  const loadDiscountFromStorage = () => {
    try {
      const saved = localStorage.getItem('posDiscount');
      return saved ? parseFloat(saved) : 0;
    } catch {
      return 0;
    }
  };
  
  const loadNotesFromStorage = () => {
    try {
      return localStorage.getItem('posNotes') || '';
    } catch {
      return '';
    }
  };
  
  const [discount, setDiscount] = useState(loadDiscountFromStorage);
  const [notes, setNotes] = useState(loadNotesFromStorage);
  const [vat, setVat] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [priceType, setPriceType] = useState('retail'); // 'retail' or 'wholesale'
  
  // Save cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('posCart', JSON.stringify(cart));
      console.log('💾 [POS] Cart saved to localStorage:', cart.length, 'items');
    } catch (error) {
      console.error('Error saving cart to storage:', error);
    }
  }, [cart]);
  
  // Save discount and notes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('posDiscount', discount.toString());
      localStorage.setItem('posNotes', notes);
    } catch (error) {
      console.error('Error saving discount/notes to storage:', error);
    }
  }, [discount, notes]);
  
  // Commercial/Admin mode - client selection
  const isCommercial = user?.role === 'commercial';
  const isAdmin = user?.role === 'admin';
  const canSelectClient = isCommercial || isAdmin;
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [loadingClients, setLoadingClients] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);

  // Special product selection state
  const [selectedSpecialProduct, setSelectedSpecialProduct] = useState(null);
  const [specialProductStep, setSpecialProductStep] = useState(1); // 1: select product, 2: select option A, 3: select option B, 4: view combinations
  const [selectedOptionA, setSelectedOptionA] = useState(null);
  const [selectedOptionB, setSelectedOptionB] = useState(null);
  const [selectedCombination, setSelectedCombination] = useState(null);

  // Regular product variant selection state
  const [selectedProductForVariant, setSelectedProductForVariant] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantityToAdd, setQuantityToAdd] = useState(1); // Quantity to add to cart

  // Product quantity modal (for products without variants)
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [productForQuantity, setProductForQuantity] = useState(null);

  // Price modification modal state
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [productForPrice, setProductForPrice] = useState(null);
  const [variantForPrice, setVariantForPrice] = useState(null);
  const [quantityForPrice, setQuantityForPrice] = useState(1);
  const [customPrice, setCustomPrice] = useState(null); // For wholesale: custom price
  const [priceDiscount, setPriceDiscount] = useState(0); // For retail: discount amount
  const [priceDiscountPercent, setPriceDiscountPercent] = useState(0); // For retail: discount percentage

  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  // "Non payé" sale: customer + amount paid now; one key per checkout so a retry never saves twice
  const [creditSale, setCreditSale] = useState({ enabled: false, customer: null, paidNow: '' });
  const checkoutKeyRef = useRef(null);
  // A different cart is a different sale: start a new key
  useEffect(() => {
    checkoutKeyRef.current = null;
  }, [cart, discount]);
  const [lastOrder, setLastOrder] = useState(null);

  // Client search filter for modal
  const [clientSearchTerm, setClientSearchTerm] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchSettings();
    if (canSelectClient) {
      fetchClients();
    }
  }, [canSelectClient]);
  
  // Load client from URL params if provided
  useEffect(() => {
    if (canSelectClient) {
      const clientIdFromUrl = searchParams.get('clientId');
      if (clientIdFromUrl && clients.length > 0 && !selectedClient) {
        const client = clients.find((c) => c._id === clientIdFromUrl);
        if (client) {
          setSelectedClient(client);
        }
      }
    }
  }, [canSelectClient, clients, searchParams, selectedClient]);
  
  // Fetch clients for commercial/admin mode
  const fetchClients = async () => {
    try {
      setLoadingClients(true);
      // Admin can see all clients, commercial only sees their assigned clients
      const endpoint = isAdmin ? '/crm/clients' : '/commercial/clients';
      // For admin, increase limit to get all clients
      const params = isAdmin ? { limit: 1000 } : {};
      const response = await api.get(endpoint, { params });
      if (response.data.success) {
        setClients(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('حدث خطأ أثناء جلب العملاء');
    } finally {
      setLoadingClients(false);
    }
  };

  // Filter clients based on search
  const filteredClients = useMemo(() => {
    if (!clientSearchTerm) return clients;
    const search = clientSearchTerm.toLowerCase();
    return clients.filter(
      (client) =>
        client.name?.toLowerCase().includes(search) ||
        client.email?.toLowerCase().includes(search) ||
        client.phone?.includes(search) ||
        client.companyName?.toLowerCase().includes(search)
    );
  }, [clients, clientSearchTerm]);

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      // Use commercial route if user is commercial, otherwise use POS route
      const endpoint = user?.role === 'commercial' ? '/commercial/products' : '/pos/products';
      const response = await api.get(endpoint);
      setProducts(response.data.data || { regularProducts: [], specialProducts: [], categories: [] });
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب المنتجات');
      console.error(error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings');
      if (response.data.data?.vat) {
        setVat(response.data.data.vat);
      }
    } catch (error) {
      // Use default VAT
    }
  };

  // Helper function to calculate total stock for a product (sum of all variant stocks)
  const calculateTotalStock = (product) => {
    if (!product) return 0;
    
    // If product has variants, sum all variant stocks
    if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
      return product.variants.reduce((total, variant) => {
        const variantStock = variant.stock !== undefined ? variant.stock : 0;
        return total + variantStock;
      }, 0);
    }
    
    // If no variants, return product stock
    return product.stock || 0;
  };

  // Helper function to check if product has any available stock (at least one variant has stock)
  const hasAvailableStock = (product) => {
    if (!product) return false;
    
    // If product has variants, check if at least one variant has stock > 0
    if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
      return product.variants.some((variant) => {
        const variantStock = variant.stock !== undefined ? variant.stock : 0;
        return variantStock > 0;
      });
    }
    
    // If no variants, check product stock
    return (product.stock || 0) > 0;
  };

  // Filter products
  const filteredRegularProducts = useMemo(() => {
    let filtered = products.regularProducts || [];
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((p) => p.category?._id === selectedCategory);
    }
    
    if (searchTerm) {
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [products.regularProducts, selectedCategory, searchTerm]);

  const filteredSpecialProducts = useMemo(() => {
    let filtered = products.specialProducts || [];
    
    if (searchTerm) {
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [products.specialProducts, searchTerm]);

  // Add regular product to cart with custom price
  const addRegularProductToCartWithPrice = (product, variant = null, quantity = null, customPriceValue = null, discountValue = 0) => {
    // Check if product has any available stock (at least one variant has stock)
    if (!hasAvailableStock(product)) {
      toast.error('المنتج غير متوفر في المخزون');
      return;
    }

    // Utiliser la quantité fournie ou 1 par défaut
    const finalQuantity = quantity !== null ? quantity : 1;

    const variantPrice = variant?.additionalPrice || 0;
    let basePrice = priceType === 'wholesale' && product.wholesalePrice > 0 
      ? product.wholesalePrice 
      : product.price;
    
    // Apply custom price or discount
    if (priceType === 'wholesale' && customPriceValue !== null && customPriceValue > 0) {
      // For wholesale: use custom price
      basePrice = customPriceValue;
    } else if (priceType === 'retail' && discountValue > 0) {
      // For retail: apply discount
      basePrice = Math.max(0, basePrice - discountValue);
    }
    
    const finalPrice = basePrice + variantPrice;
    const variantValue = variant?.value || null;

    // Helper function to compare variants
    const variantsMatch = (v1, v2) => {
      if (!v1 && !v2) return true;
      if (!v1 || !v2) return false;
      return v1.value === v2.value || (v1.name === v2.name && v1.value === v2.value);
    };

    const existingItem = cart.find((item) => {
      if (item.productId !== product._id || item.productType !== 'regular') {
        return false;
      }
      // Check if variants match
      return variantsMatch(item.variant, variant);
    });

    // Check stock - for variants, use variant stock; otherwise use product stock
    const availableStock = variant && variant.stock !== undefined ? variant.stock : product.stock;
    const totalQuantity = existingItem ? existingItem.quantity + finalQuantity : finalQuantity;
    
    if (totalQuantity > availableStock) {
      if (availableStock === 0) {
        toast.error('المنتج غير متوفر في المخزون');
        return;
      }
      // Limit quantity to available stock
      const limitedQuantity = availableStock - (existingItem ? existingItem.quantity : 0);
      if (limitedQuantity <= 0) {
        toast.error('تم الوصول إلى الحد الأقصى من الكمية المتاحة في المخزون');
        return;
      }
      toast(`الكمية المتاحة فقط: ${availableStock}. تم تقليل الكمية إلى ${limitedQuantity}`, { icon: '⚠️' });
      const adjustedQuantity = limitedQuantity;
      
      if (existingItem) {
        setCart(
          cart.map((item) =>
            item.productId === product._id &&
            item.productType === 'regular' &&
            variantsMatch(item.variant, variant)
              ? { ...item, quantity: availableStock }
              : item
          )
        );
      } else {
        setCart([
          ...cart,
          {
            productId: product._id,
            productType: 'regular',
            productName: product.name,
            price: finalPrice,
            quantity: adjustedQuantity,
            image: variant?.image || product.images?.[0] || '',
            stock: availableStock,
            variant: variant ? {
              name: variant.name,
              value: variant.value,
              image: variant.image,
              stock: variant.stock,
            } : undefined,
          },
        ]);
      }
      setSelectedProductForVariant(null);
      setSelectedVariant(null);
      setQuantityToAdd(1);
      return;
    }

    if (existingItem) {
      // If item exists, update quantity but keep the existing price (which may be modified)
      // Only update price if a new custom price/discount is provided
      setCart(
        cart.map((item) =>
          item.productId === product._id &&
          item.productType === 'regular' &&
          variantsMatch(item.variant, variant)
            ? { 
                ...item, 
                quantity: item.quantity + finalQuantity,
                // Update price only if custom price or discount is provided
                ...(customPriceValue !== null || discountValue > 0 ? {
                  price: finalPrice,
                  customPrice: customPriceValue,
                  priceDiscount: discountValue,
                } : {})
              }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          productId: product._id,
          productType: 'regular',
          productName: product.name,
          price: finalPrice,
          quantity: finalQuantity,
          image: variant?.image || product.images?.[0] || '',
          stock: availableStock,
          variant: variant ? {
            name: variant.name,
            value: variant.value,
            image: variant.image,
            stock: variant.stock,
          } : undefined,
          // Store price modification info
          customPrice: customPriceValue, // For wholesale: custom price
          priceDiscount: discountValue, // For retail: discount amount
          originalPrice: priceType === 'wholesale' && product.wholesalePrice > 0 
            ? product.wholesalePrice 
            : product.price,
        },
      ]);
    }

    toast.success(`تمت الإضافة ${finalQuantity} ${finalQuantity > 1 ? 'عناصر' : 'عنصر'} إلى السلة`);
    setSelectedProductForVariant(null);
    setSelectedVariant(null);
    setQuantityToAdd(1);
    setShowPriceModal(false);
    setProductForPrice(null);
    setVariantForPrice(null);
    setQuantityForPrice(1);
    setCustomPrice(null);
    setPriceDiscount(0);
    setPriceDiscountPercent(0);
  };

  // Add regular product to cart - opens price modal first
  const addRegularProductToCart = (product, variant = null, quantity = null) => {
    // Check if product has any available stock (at least one variant has stock)
    if (!hasAvailableStock(product)) {
      toast.error('المنتج غير متوفر في المخزون');
      return;
    }

    // Si une quantité est spécifiée, on ouvre le modal de prix
    // Sinon, on vérifie si on doit ouvrir un modal
    
    const hasVariants = product.variants && Array.isArray(product.variants) && product.variants.length > 0;

    // Si le produit a des variants et qu'on n'a pas encore sélectionné de variant, ouvrir le modal de variant
    if (hasVariants && variant === null && quantity === null) {
      setSelectedProductForVariant(product);
      setSelectedVariant(null);
      setQuantityToAdd(1);
      return;
    }

    // Si le produit n'a pas de variants et qu'aucune quantité n'est spécifiée, ouvrir le modal de quantité
    if (!hasVariants && quantity === null) {
      setProductForQuantity(product);
      setShowQuantityModal(true);
      setQuantityToAdd(1);
      return;
    }

    // Si on arrive ici, c'est qu'on a une quantité spécifiée (depuis le modal) ou un variant sélectionné
    // Ouvrir le modal de modification de prix
    const finalQuantity = quantity !== null ? quantity : 1;
    
    // Calculate base price for the modal
    const variantPrice = variant?.additionalPrice || 0;
    const basePrice = priceType === 'wholesale' && product.wholesalePrice > 0 
      ? product.wholesalePrice 
      : product.price;
    
    // Set up price modal
    setProductForPrice(product);
    setVariantForPrice(variant);
    setQuantityForPrice(finalQuantity);
    setCustomPrice(null);
    setPriceDiscount(0);
    setPriceDiscountPercent(0);
    setShowPriceModal(true);
  };

  // Handle adding product with quantity from modal
  const confirmAddToCart = () => {
    if (!productForQuantity) {
      toast.error('لم يتم العثور على المنتج');
      return;
    }
    
    if (!quantityToAdd || quantityToAdd < 1) {
      toast.error('يرجى تحديد كمية صحيحة');
      return;
    }

    // Calculate final price with modifications
    let basePrice = priceType === 'wholesale' && productForQuantity.wholesalePrice > 0 
      ? productForQuantity.wholesalePrice 
      : productForQuantity.price;
    
    let finalPrice = basePrice;
    
    if (priceType === 'wholesale') {
      if (customPrice !== null && customPrice > 0) {
        finalPrice = customPrice;
      }
    } else {
      if (priceDiscount > 0) {
        finalPrice = Math.max(0, basePrice - priceDiscount);
      } else if (priceDiscountPercent > 0) {
        const discountAmount = (basePrice * priceDiscountPercent) / 100;
        finalPrice = Math.max(0, basePrice - discountAmount);
      }
    }

    // Save product and quantity before closing modal
    const productToAdd = productForQuantity;
    const qtyToAdd = quantityToAdd;
    const customPriceToUse = priceType === 'wholesale' ? customPrice : null;
    const discountToUse = priceType === 'retail' ? (priceDiscount > 0 ? priceDiscount : (priceDiscountPercent > 0 ? (basePrice * priceDiscountPercent) / 100 : 0)) : 0;

    // Close modal first
    setShowQuantityModal(false);
    setProductForQuantity(null);
    setQuantityToAdd(1);
    setCustomPrice(null);
    setPriceDiscount(0);
    setPriceDiscountPercent(0);

    // Then add to cart with modified price
    addRegularProductToCartWithPrice(productToAdd, null, qtyToAdd, customPriceToUse, discountToUse);
  };

  // Handle confirming price modification and adding to cart
  const confirmPriceAndAddToCart = () => {
    if (!productForPrice) {
      toast.error('لم يتم العثور على المنتج');
      return;
    }

    // Calculate final price
    const variantPrice = variantForPrice?.additionalPrice || 0;
    let basePrice = priceType === 'wholesale' && productForPrice.wholesalePrice > 0 
      ? productForPrice.wholesalePrice 
      : productForPrice.price;
    
    let finalPrice = basePrice + variantPrice;
    
    if (priceType === 'wholesale') {
      // For wholesale: use custom price if provided
      if (customPrice !== null && customPrice > 0) {
        finalPrice = customPrice + variantPrice;
      }
    } else {
      // For retail: apply discount
      if (priceDiscount > 0) {
        finalPrice = Math.max(0, basePrice - priceDiscount) + variantPrice;
      } else if (priceDiscountPercent > 0) {
        const discountAmount = (basePrice * priceDiscountPercent) / 100;
        finalPrice = Math.max(0, basePrice - discountAmount) + variantPrice;
      }
    }

    // Close price modal
    setShowPriceModal(false);
    const productToAdd = productForPrice;
    const variantToAdd = variantForPrice;
    const qtyToAdd = quantityForPrice;
    const customPriceToUse = priceType === 'wholesale' ? customPrice : null;
    const discountToUse = priceType === 'retail' ? (priceDiscount > 0 ? priceDiscount : (priceDiscountPercent > 0 ? (basePrice * priceDiscountPercent) / 100 : 0)) : 0;

    // Reset price modal state
    setProductForPrice(null);
    setVariantForPrice(null);
    setQuantityForPrice(1);
    setCustomPrice(null);
    setPriceDiscount(0);
    setPriceDiscountPercent(0);

    // Add to cart with modified price
    addRegularProductToCartWithPrice(productToAdd, variantToAdd, qtyToAdd, customPriceToUse, discountToUse);
  };

  // Helper function to get available variants from combinations
  const getAvailableVariantsFromCombinations = (combinations, productType) => {
    if (!combinations || combinations.length === 0) return [];
    const variants = new Map();
    combinations.forEach(combo => {
      const variant = productType === 'A' ? combo.optionA?.variant : combo.optionB?.variant;
      if (variant && variant.value) {
        variants.set(variant.value, variant);
      }
    });
    return Array.from(variants.values());
  };

  // Start special product selection
  const startSpecialProductSelection = (product) => {
    setSelectedSpecialProduct(product);
    setSpecialProductStep(1);
    setSelectedOptionA(null);
    setSelectedOptionB(null);
    setSelectedCombination(null);
    setQuantityToAdd(1); // Reset quantity to 1
  };

  // Select option A for special product
  const selectOptionA = (variant) => {
    setSelectedOptionA(variant);
    setSpecialProductStep(2);
  };

  // Select option B for special product
  const selectOptionB = (variant) => {
    setSelectedOptionB(variant);
    
    // Find matching combination - check multiple possible structures
    let combination = null;
    
    if (selectedSpecialProduct?.combinations && selectedOptionA) {
      // Try to find exact match
      combination = selectedSpecialProduct.combinations.find((c) => {
        // Check option A - try different structures
        let optionAMatches = false;
        if (c.optionA?.variant?.value && selectedOptionA?.value) {
          optionAMatches = c.optionA.variant.value === selectedOptionA.value;
        } else if (c.optionA?.value && selectedOptionA?.value) {
          optionAMatches = c.optionA.value === selectedOptionA.value;
        } else if (c.optionA?.variant?.name && selectedOptionA?.name) {
          optionAMatches = c.optionA.variant.name === selectedOptionA.name;
        } else if (c.optionA?.name && selectedOptionA?.name) {
          optionAMatches = c.optionA.name === selectedOptionA.name;
        }
        
        // Check option B - try different structures
        let optionBMatches = false;
        if (c.optionB?.variant?.value && variant?.value) {
          optionBMatches = c.optionB.variant.value === variant.value;
        } else if (c.optionB?.value && variant?.value) {
          optionBMatches = c.optionB.value === variant.value;
        } else if (c.optionB?.variant?.name && variant?.name) {
          optionBMatches = c.optionB.variant.name === variant.name;
        } else if (c.optionB?.name && variant?.name) {
          optionBMatches = c.optionB.name === variant.name;
        }
        
        return optionAMatches && optionBMatches;
      });
      
      // If no exact match, try name-based matching
      if (!combination) {
        combination = selectedSpecialProduct.combinations.find((c) => {
          const optionAName = c.optionA?.variant?.name || c.optionA?.name || '';
          const optionBName = c.optionB?.variant?.name || c.optionB?.name || '';
          return optionAName === selectedOptionA?.name && optionBName === variant?.name;
        });
      }
      
      // Last resort: use first combination if available
      if (!combination && selectedSpecialProduct.combinations.length > 0) {
        combination = selectedSpecialProduct.combinations[0];
      }
    }
    
    if (combination) {
      setSelectedCombination(combination);
      setSpecialProductStep(3);
    } else {
      toast.error('لم يتم العثور على التركيبة المطابقة. يرجى المحاولة مرة أخرى.');
      console.error('Combination not found:', {
        selectedOptionA,
        selectedOptionB: variant,
        combinations: selectedSpecialProduct?.combinations
      });
    }
  };

  // Add special product combination to cart
  const addSpecialProductToCart = (quantity = 1) => {
    if (!selectedCombination || !selectedSpecialProduct) {
      toast.error('يرجى اختيار التركيبة كاملة');
      return;
    }

    const price = selectedSpecialProduct.finalPrice + (selectedCombination.additionalPrice || 0);
    const combinationTitle = `${selectedCombination.optionA?.variant?.name || selectedOptionA?.name || ''} + ${selectedCombination.optionB?.variant?.name || selectedOptionB?.name || ''}`;

    setCart([
      ...cart,
      {
        productId: selectedSpecialProduct._id,
        productType: 'special',
        productName: selectedSpecialProduct.name,
        price,
        quantity: quantity,
        image: selectedCombination.finalImage || selectedSpecialProduct.baseProductA?.images?.[0] || '',
        combinationId: selectedCombination._id?.toString() || selectedCombination._id,
        variantA: selectedCombination.optionA || { variant: selectedOptionA },
        variantB: selectedCombination.optionB || { variant: selectedOptionB },
        combinationTitle,
      },
    ]);

    toast.success(`تمت الإضافة ${quantity} ${quantity > 1 ? 'عناصر' : 'عنصر'} إلى السلة`);
    // Reset special product selection
    setSelectedSpecialProduct(null);
    setSpecialProductStep(1);
    setSelectedOptionA(null);
    setSelectedOptionB(null);
    setSelectedCombination(null);
    setQuantityToAdd(1);
    setActiveTab('regular');
  };

  // Update cart quantity
  const updateQuantity = (index, delta) => {
    const item = cart[index];
    const newQuantity = item.quantity + delta;

    if (newQuantity <= 0) {
      removeFromCart(index);
      return;
    }

    // Check stock - use variant stock if available, otherwise product stock
    const availableStock = item.variant?.stock !== undefined ? item.variant.stock : item.stock;
    if (item.productType === 'regular' && availableStock && newQuantity > availableStock) {
      toast.error(`الكمية المتاحة في المخزون: ${availableStock}`);
      // Auto-limit to available stock
      setCart(
        cart.map((i, idx) =>
          idx === index ? { ...i, quantity: availableStock } : i
        )
      );
      return;
    }

    setCart(
      cart.map((item, i) =>
        i === index ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  // Remove from cart
  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Clear cart
  const clearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('هل أنت متأكد من إفراغ السلة؟')) {
      setCart([]);
      setDiscount(0);
      setNotes('');
      // Clear from localStorage
      localStorage.removeItem('posCart');
      localStorage.removeItem('posDiscount');
      localStorage.removeItem('posNotes');
    }
  };

  // Calculate totals
  const calculations = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = discount || 0;
    const total = subtotal - discountAmount;

    return {
      subtotal,
      discount: discountAmount,
      vat: 0,
      total,
    };
  }, [cart, discount]);

  // Handle checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('السلة فارغة');
      return;
    }

    // Validate stock for all items in cart before checkout
    for (const item of cart) {
      if (item.productType === 'regular') {
        const availableStock = item.variant?.stock !== undefined ? item.variant.stock : item.stock;
        if (availableStock === undefined || availableStock <= 0) {
          toast.error(`المنتج "${item.productName}" غير متوفر في المخزون`);
          return;
        }
        if (item.quantity > availableStock) {
          toast.error(`الكمية المطلوبة للمنتج "${item.productName}" تتجاوز المخزون المتاح (${availableStock})`);
          // Auto-adjust quantity
          setCart(
            cart.map((i) =>
              i.productId === item.productId && i.productType === item.productType
                ? { ...i, quantity: availableStock }
                : i
            )
          );
          return;
        }
      }
    }

    // For commercial/admin mode, client selection is optional (but recommended)
    // Only show warning for commercial (required), admin can proceed without client
    if (isCommercial && !selectedClient) {
      toast.error('يرجى اختيار عميل قبل إتمام البيع');
      setShowClientModal(true);
      return;
    }

    const usesCommercialOrder = (isCommercial || isAdmin) && selectedClient;
    if (!usesCommercialOrder && creditSale.enabled) {
      if (!creditSale.customer) {
        toast.error('اختر العميل للبيع بالدين');
        return;
      }
      if ((Number(creditSale.paidNow) || 0) > calculations.total) {
        toast.error('المبلغ المدفوع لا يمكن أن يتجاوز الإجمالي');
        return;
      }
    }
    if (loading) return;
    if (!checkoutKeyRef.current) checkoutKeyRef.current = newIdempotencyKey();

    try {
      setLoading(true);

      // Use commercial order creation if in commercial/admin mode and client is selected
      const shouldUseCommercialOrder = (isCommercial || isAdmin) && selectedClient;
      const endpoint = shouldUseCommercialOrder ? '/commercial/orders' : '/pos/order';
      
      // Map cart items to the format expected by backend
      const items = cart.map((item) => {
        const itemData = {
          productId: item.productId,
          productType: item.productType || 'regular',
          quantity: item.quantity,
          unitPrice: item.price,
          discount: 0,
        };
        
        // Add variant info for regular products
        if (item.variant && item.productType === 'regular') {
          itemData.variant = item.variant;
        }
        
        // Add combinationId for special products
        if (item.combinationId && item.productType === 'special') {
          itemData.combinationId = item.combinationId;
        }
        
        return itemData;
      });

      const orderData = shouldUseCommercialOrder ? {
        clientId: selectedClient._id,
        items,
        discount,
        notes,
        paymentMethod: isAdmin && selectedClient ? 'credit' : 'cash',
        status: 'pending',
      } : {
        items,
        discount,
        notes,
        idempotencyKey: checkoutKeyRef.current,
        ...(creditSale.enabled && creditSale.customer
          ? { credit: { customerId: creditSale.customer._id, paidNow: Number(creditSale.paidNow) || 0 } }
          : {}),
      };

      const response = await api.post(endpoint, orderData);

      // Handle response format - commercial/admin returns order directly, POS returns {order, invoice}
      const orderResponse = shouldUseCommercialOrder
        ? { order: response.data.data }
        : response.data.data;
      
      setLastOrder(orderResponse);
      setShowSuccessModal(true);
      checkoutKeyRef.current = null;
      setCreditSale({ enabled: false, customer: null, paidNow: '' });
      setCart([]);
      setDiscount(0);
      setNotes('');
      setSearchTerm('');
      // Clear from localStorage after successful order
      localStorage.removeItem('posCart');
      localStorage.removeItem('posDiscount');
      localStorage.removeItem('posNotes');
      if (canSelectClient) {
        setSelectedClient(null);
      }
      
      // Refresh products to update stock
      fetchProducts();
      
      toast.success('تمت عملية البيع بنجاح!');
    } catch (error) {
      const message =
        error.response?.data?.message || 'حدث خطأ أثناء إتمام العملية';
      toast.error(message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Generate invoice
  const generateInvoice = async () => {
    if (!lastOrder?.order?._id) return;

    try {
      const response = await api.post(`/pos/invoice/${lastOrder.order._id}`);
      toast.success('تم إنشاء الفاتورة بنجاح');
      // In a real implementation, you would download the PDF here
    } catch (error) {
      toast.error('حدث خطأ أثناء إنشاء الفاتورة');
    }
  };

  const [showCartOnMobile, setShowCartOnMobile] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden" style={{ touchAction: 'pan-y' }}>
      {/* Header */}
      <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 md:px-6 py-2 md:py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <PosBackLink />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white truncate">نقطة البيع (POS)</h1>
            <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm mt-1 truncate">
              {user?.name || 'Caissier'} • {new Date().toLocaleDateString('ar-TN')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Dashboard Button */}
          <button
            onClick={() => navigate('/pos/dashboard')}
            className="px-3 md:px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 text-white"
            title="لوحة التحكم"
          >
            <BarChart3 size={18} className="md:w-5 md:h-5" />
            <span className="hidden md:inline">لوحة التحكم</span>
          </button>
          {/* Mobile Cart Toggle Button */}
          <button
            onClick={() => setShowCartOnMobile(!showCartOnMobile)}
            className="md:hidden relative px-3 py-2 bg-gold-600 hover:bg-gold-700 rounded-lg transition-colors flex items-center gap-2 text-white"
          >
            <ShoppingCart size={18} />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              if (window.confirm('هل أنت متأكد من تسجيل الخروج؟')) {
                logout();
              }
            }}
            className="px-3 md:px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2 text-white"
          >
            <LogOut size={18} className="md:w-5 md:h-5" />
            <span className="hidden md:inline">تسجيل الخروج</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* LEFT PANEL - Product Browser */}
        <div className={`${showCartOnMobile ? 'hidden' : 'flex'} md:flex w-full md:w-2/3 flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 min-h-0`}>
          {/* Search and Filters */}
          <div className="flex-shrink-0 p-2 md:p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 space-y-2 md:space-y-4">
            <div className="relative">
              <Search className="absolute right-2 md:right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
              <input
                type="text"
                placeholder="ابحث عن منتج..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-8 md:pr-10 pl-3 md:pl-4 py-2 md:py-3 text-sm md:text-base bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>

            {/* Category Filter */}
            {activeTab === 'regular' && (
              <div className="flex items-center gap-1 md:gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-lg whitespace-nowrap transition-colors flex-shrink-0 ${
                    selectedCategory === 'all'
                      ? 'bg-gold-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  الكل
                </button>
                {products.categories.map((cat) => (
                  <button
                    key={cat._id}
                    onClick={() => setSelectedCategory(cat._id)}
                    className={`px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-lg whitespace-nowrap transition-colors flex-shrink-0 ${
                      selectedCategory === cat._id
                        ? 'bg-gold-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Price Type Toggle */}
            <div className="flex items-center gap-2 md:gap-4">
              <span className="text-gray-700 dark:text-gray-300 text-xs md:text-sm whitespace-nowrap">نوع السعر:</span>
              <div className="flex gap-1 md:gap-2 bg-gray-200 dark:bg-gray-700 rounded-lg p-0.5 md:p-1 flex-1">
                <button
                  onClick={() => setPriceType('retail')}
                  className={`flex-1 px-2 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors ${
                    priceType === 'retail'
                      ? 'bg-gold-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className="hidden sm:inline">السعر بالتجزئة</span>
                  <span className="sm:hidden">تجزئة</span>
                </button>
                <button
                  onClick={() => setPriceType('wholesale')}
                  className={`flex-1 px-2 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors ${
                    priceType === 'wholesale'
                      ? 'bg-gold-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className="hidden sm:inline">السعر بالجملة</span>
                  <span className="sm:hidden">جملة</span>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 md:gap-2">
              <button
                onClick={() => {
                  setActiveTab('regular');
                  setSelectedSpecialProduct(null);
                  setSpecialProductStep(1);
                }}
                className={`flex-1 py-1.5 md:py-2 px-2 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                  activeTab === 'regular'
                    ? 'bg-gold-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                <Package size={16} className="inline ml-1 md:ml-2" />
                <span className="hidden sm:inline">المنتجات العادية</span>
                <span className="sm:hidden">عادية</span>
              </button>
              <button
                onClick={() => setActiveTab('special')}
                className={`flex-1 py-1.5 md:py-2 px-2 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                  activeTab === 'special'
                    ? 'bg-gold-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                <Sparkles size={16} className="inline ml-1 md:ml-2" />
                <span className="hidden sm:inline">المنتجات الخاصة</span>
                <span className="sm:hidden">خاصة</span>
              </button>
            </div>
          </div>

          {/* Products List */}
          <div className="flex-1 overflow-y-auto p-2 md:p-4 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            {loadingProducts ? (
              <div className="text-center py-12 text-gray-600 dark:text-gray-400 text-sm md:text-base">جاري التحميل...</div>
            ) : activeTab === 'regular' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
                {filteredRegularProducts.map((product) => {
                  const totalStock = calculateTotalStock(product);
                  const isAvailable = hasAvailableStock(product);
                  
                  return (
                    <div
                      key={product._id}
                      onClick={() => {
                        if (!isAvailable) {
                          toast.error('المنتج غير متوفر في المخزون');
                          return;
                        }
                        addRegularProductToCart(product);
                      }}
                      className={`bg-white dark:bg-gray-800 rounded-lg p-2 md:p-4 transition-colors border ${
                        !isAvailable
                          ? 'opacity-50 cursor-not-allowed border-red-300 dark:border-red-700'
                          : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700 hover:border-gold-600'
                      }`}
                    >
                      {product.images?.[0] && (
                        <div className="relative">
                          <img
                            src={withBase(product.images[0])}
                            alt={product.name}
                            className={`w-full h-24 md:h-40 object-cover rounded-lg mb-2 md:mb-3 ${
                              !isAvailable ? 'grayscale' : ''
                            }`}
                          />
                          {!isAvailable && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                              <span className="text-white font-bold text-lg">نفد</span>
                            </div>
                          )}
                        </div>
                      )}
                      <h3 className={`font-medium text-xs md:text-base mb-1 md:mb-2 line-clamp-2 ${
                        !isAvailable
                          ? 'text-gray-400 dark:text-gray-500 line-through'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {product.name}
                      </h3>
                      <p className="text-gold-500 font-bold text-sm md:text-base">
                        {priceType === 'wholesale' && product.wholesalePrice > 0 
                          ? product.wholesalePrice 
                          : product.price} TND
                        {priceType === 'wholesale' && product.wholesalePrice > 0 && (
                          <span className="text-xs text-gray-600 dark:text-gray-400 block mt-0.5 md:mt-1">
                            (جملة)
                          </span>
                        )}
                        {priceType === 'wholesale' && (!product.wholesalePrice || product.wholesalePrice === 0) && (
                          <span className="text-xs text-gray-600 dark:text-gray-400 block mt-0.5 md:mt-1">
                            (لا يوجد سعر جملة)
                          </span>
                        )}
                      </p>
                      <p className={`text-xs md:text-sm mt-1 md:mt-2 ${
                        !isAvailable
                          ? 'text-red-600 dark:text-red-400 font-semibold'
                          : totalStock <= 10
                          ? 'text-yellow-600 dark:text-yellow-400 font-semibold'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        المخزون: {totalStock}
                        {!isAvailable && ' (نفد)'}
                        {isAvailable && totalStock <= 10 && ' (منخفض)'}
                      </p>
                    </div>
                  );
                })}
                {filteredRegularProducts.length === 0 && (
                  <div className="col-span-2 sm:col-span-3 text-center py-12 text-gray-600 dark:text-gray-400 text-sm md:text-base">
                    لا توجد منتجات
                  </div>
                )}
              </div>
            ) : (
              <div>
                {!selectedSpecialProduct ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
                    {filteredSpecialProducts.map((product) => (
                      <div
                        key={product._id}
                        onClick={() => startSpecialProductSelection(product)}
                        className="bg-white dark:bg-gray-800 rounded-lg p-2 md:p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700 hover:border-gold-600"
                      >
                        {product.baseProductA?.images?.[0] && (
                          <img
                            src={withBase(product.baseProductA.images[0])}
                            alt={product.name}
                            className="w-full h-24 md:h-40 object-cover rounded-lg mb-2 md:mb-3"
                          />
                        )}
                        <h3 className="font-medium text-gray-900 dark:text-white text-xs md:text-base mb-1 md:mb-2 line-clamp-2">{product.name}</h3>
                        <p className="text-gold-500 font-bold text-sm md:text-base">
                          ابتداءً من {product.finalPrice} TND
                        </p>
                      </div>
                    ))}
                    {filteredSpecialProducts.length === 0 && (
                      <div className="col-span-2 sm:col-span-3 text-center py-12 text-gray-400 text-sm md:text-base">
                        لا توجد منتجات خاصة
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto">
                    {/* Special Product Configuration Steps */}
                    {specialProductStep === 1 && (
                      <div className="bg-gray-800 rounded-lg p-3 md:p-6">
                        <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4">{selectedSpecialProduct.name}</h2>
                        <p className="text-gray-400 text-sm md:text-base mb-4 md:mb-6">اختر الجزء الأول</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
                          {(() => {
                            const availableVariants = getAvailableVariantsFromCombinations(
                              selectedSpecialProduct.combinations,
                              'A'
                            );
                            return availableVariants.length > 0 ? (
                              availableVariants.map((variant, idx) => (
                              <div
                                key={idx}
                                onClick={() => selectOptionA(variant)}
                                className="bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-600 transition-colors border border-gray-600 hover:border-gold-600"
                              >
                                {variant.image && (
                                  <img
                                    src={withBase(variant.image)}
                                    alt={variant.name}
                                    className="w-full h-32 object-cover rounded-lg mb-3"
                                  />
                                )}
                                <p className="text-white font-medium text-xs md:text-sm">{variant.name || variant.value}</p>
                              </div>
                            ))
                            ) : (
                              <div className="col-span-full text-center text-gray-400 py-4">
                                لا توجد خيارات متاحة
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {specialProductStep === 2 && (
                      <div className="bg-gray-800 rounded-lg p-3 md:p-6">
                        <div className="flex items-center gap-2 mb-3 md:mb-4">
                          <CheckCircle2 className="text-gold-500" size={18} />
                          <span className="text-gold-500 text-sm md:text-base">تم اختيار: {selectedOptionA?.name}</span>
                        </div>
                        <p className="text-gray-400 text-sm md:text-base mb-4 md:mb-6">اختر الجزء الثاني</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
                          {(() => {
                            const availableVariants = getAvailableVariantsFromCombinations(
                              selectedSpecialProduct.combinations,
                              'B'
                            );
                            // Filter variants that work with selectedOptionA
                            const filteredVariants = selectedOptionA 
                              ? availableVariants.filter(variantB => {
                                  // Check if there's a combination with selectedOptionA and this variantB
                                  return selectedSpecialProduct.combinations?.some(combo => {
                                    const comboOptionA = combo.optionA?.variant?.value || combo.optionA?.value;
                                    const comboOptionB = combo.optionB?.variant?.value || combo.optionB?.value;
                                    return (comboOptionA === (selectedOptionA.value || selectedOptionA)) && 
                                           (comboOptionB === variantB.value);
                                  });
                                })
                              : availableVariants;
                            
                            return filteredVariants.length > 0 ? (
                              filteredVariants.map((variant, idx) => (
                              <div
                                key={idx}
                                onClick={() => selectOptionB(variant)}
                                className="bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-600 transition-colors border border-gray-600 hover:border-gold-600"
                              >
                                {variant.image && (
                                  <img
                                    src={withBase(variant.image)}
                                    alt={variant.name}
                                    className="w-full h-32 object-cover rounded-lg mb-3"
                                  />
                                )}
                                <p className="text-white font-medium text-xs md:text-sm">{variant.name || variant.value}</p>
                              </div>
                            ))
                            ) : (
                              <div className="col-span-full text-center text-gray-400 py-4">
                                لا توجد خيارات متاحة
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {specialProductStep === 3 && (
                      <div className="bg-gray-800 rounded-lg p-3 md:p-6">
                        {selectedCombination ? (
                          <>
                            <div className="flex items-center justify-between mb-4 md:mb-6">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-lg md:text-xl font-bold">التركيبة المختارة</h3>
                                <p className="text-gray-400 text-sm md:text-base truncate">
                                  {selectedCombination.optionA?.variant?.name || 
                                   selectedOptionA?.name || 
                                   selectedCombination.optionA?.name || 'غير محدد'} +{' '}
                                  {selectedCombination.optionB?.variant?.name || 
                                   selectedOptionB?.name || 
                                   selectedCombination.optionB?.name || 'غير محدد'}
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedSpecialProduct(null);
                                  setSpecialProductStep(1);
                                  setSelectedOptionA(null);
                                  setSelectedOptionB(null);
                                  setSelectedCombination(null);
                                }}
                                className="px-3 md:px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex-shrink-0"
                              >
                                <X size={18} className="md:w-5 md:h-5" />
                              </button>
                            </div>
                            {selectedCombination.finalImage && (
                              <div className="w-full h-48 md:h-64 bg-gray-700 rounded-lg mb-3 md:mb-4 flex items-center justify-center overflow-hidden">
                                <img
                                  src={withBase(selectedCombination.finalImage)}
                                  alt="Combination"
                                  className="max-w-full max-h-full object-contain rounded-lg"
                                />
                              </div>
                            )}
                            {/* Quantity Selector */}
                            <div className="bg-gray-700 rounded-lg p-3 md:p-4 mb-3 md:mb-4">
                              <label className="block text-xs md:text-sm font-semibold text-white mb-2 md:mb-3">
                                الكمية:
                              </label>
                              <div className="flex items-center gap-2 md:gap-4">
                                <button
                                  onClick={() => setQuantityToAdd(Math.max(1, quantityToAdd - 1))}
                                  className="w-9 h-9 md:w-10 md:h-10 bg-gray-600 hover:bg-gray-500 rounded-lg flex items-center justify-center text-white font-bold"
                                >
                                  <Minus size={18} className="md:w-5 md:h-5" />
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  max="999"
                                  value={quantityToAdd}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1;
                                    setQuantityToAdd(Math.max(1, Math.min(val, 999)));
                                  }}
                                  className="w-16 md:w-20 text-center bg-gray-600 text-white rounded-lg py-2 px-2 md:px-3 font-bold text-base md:text-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                                />
                                <button
                                  onClick={() => setQuantityToAdd(Math.min(999, quantityToAdd + 1))}
                                  className="w-9 h-9 md:w-10 md:h-10 bg-gray-600 hover:bg-gray-500 rounded-lg flex items-center justify-center text-white font-bold"
                                >
                                  <Plus size={18} className="md:w-5 md:h-5" />
                                </button>
                              </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4">
                              <div className="flex-1">
                                <p className="text-gray-400 text-sm md:text-base">السعر للقطعة الواحدة</p>
                                <p className="text-xl md:text-2xl font-bold text-gold-500">
                                  {selectedSpecialProduct.finalPrice +
                                    (selectedCombination.additionalPrice || 0)}{' '}
                                  TND
                                </p>
                                {quantityToAdd > 1 && (
                                  <p className="text-xs md:text-sm text-gray-400 mt-1">
                                    الإجمالي ({quantityToAdd} {quantityToAdd > 1 ? 'قطعة' : 'قطعة'}): {' '}
                                    <span className="text-gold-500 font-bold">
                                      {(selectedSpecialProduct.finalPrice + (selectedCombination.additionalPrice || 0)) * quantityToAdd} TND
                                    </span>
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => addSpecialProductToCart(quantityToAdd)}
                                className="w-full sm:w-auto px-4 md:px-6 py-2 md:py-3 bg-gold-600 hover:bg-gold-700 rounded-lg font-semibold flex items-center justify-center gap-2 text-white text-sm md:text-base"
                              >
                                <Plus size={18} className="md:w-5 md:h-5" />
                                إضافة للسلة
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-gray-400 mb-4">جاري البحث عن التركيبة...</p>
                            <button
                              onClick={() => {
                                setSelectedSpecialProduct(null);
                                setSpecialProductStep(1);
                                setSelectedOptionA(null);
                                setSelectedOptionB(null);
                              }}
                              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                            >
                              العودة
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL - Cart */}
        <div className={`${showCartOnMobile ? 'flex' : 'hidden'} md:flex w-full md:w-1/3 flex-col bg-gray-100 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 min-h-0`}>
          <div className="flex-shrink-0 p-3 md:p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
              <ShoppingCart size={20} className="md:w-6 md:h-6" />
              السلة ({cart.length})
            </h2>
            <button
              onClick={() => setShowCartOnMobile(false)}
              className="md:hidden text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-3 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            {cart.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <ShoppingCart size={40} className="md:w-12 md:h-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm md:text-base">السلة فارغة</p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-700 rounded-lg p-2 md:p-3 flex gap-2 md:gap-3 border border-gray-200 dark:border-gray-600"
                >
                  {item.image && (
                    <img
                      src={withBase(item.image)}
                      alt={item.productName}
                      className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm md:text-base text-gray-900 dark:text-white truncate">{item.productName}</p>
                    {item.variant && (
                      <p className="text-xs text-[#fda63a] dark:text-gold-400 font-medium truncate">
                        المتغير: {item.variant.name || item.variant.value}
                      </p>
                    )}
                    {item.combinationTitle && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{item.combinationTitle}</p>
                    )}
                    <p className="text-gold-600 dark:text-gold-500 font-bold text-sm md:text-base">{item.price} TND</p>
                    {item.productType === 'regular' && (item.variant?.stock !== undefined || item.stock !== undefined) && (
                      <p className={`text-xs font-semibold ${
                        (item.variant?.stock !== undefined ? item.variant.stock : item.stock || 0) <= 10
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        متوفر: {item.variant?.stock !== undefined ? item.variant.stock : item.stock || 0}
                        {(item.variant?.stock !== undefined ? item.variant.stock : item.stock || 0) <= 10 && ' (منخفض)'}
                      </p>
                    )}
                    <div className="flex items-center gap-1 md:gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(index, -1)}
                        className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded text-gray-900 dark:text-white"
                      >
                        <Minus size={14} className="md:w-4 md:h-4" />
                      </button>
                      <span className="w-6 md:w-8 text-center text-sm md:text-base font-medium text-gray-900 dark:text-white">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(index, 1)}
                        disabled={
                          item.productType === 'regular' &&
                          (item.variant?.stock !== undefined || item.stock !== undefined) &&
                          item.quantity >= (item.variant?.stock !== undefined ? item.variant.stock : item.stock || 0)
                        }
                        className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus size={14} className="md:w-4 md:h-4" />
                      </button>
                      <button
                        onClick={() => removeFromCart(index)}
                        className="ml-auto p-1 text-[#fda63a] dark:text-gold-400 hover:text-[#e8952d] dark:hover:text-gold-300"
                      >
                        <Trash2 size={14} className="md:w-4 md:h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className="p-3 md:p-4 border-t border-gray-200 dark:border-gray-700 space-y-3 md:space-y-4 bg-white dark:bg-gray-900 flex-shrink-0">
              <div className="space-y-2">
                <div className="flex justify-between text-sm md:text-base text-gray-600 dark:text-gray-400">
                  <span>المجموع الفرعي:</span>
                  <span>{calculations.subtotal.toFixed(2)} TND</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm md:text-base text-gray-600 dark:text-gray-400">الخصم:</span>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-20 md:w-24 px-2 py-1 text-sm md:text-base bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-right text-gray-900 dark:text-white"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="flex justify-between text-lg md:text-xl font-bold text-gold-600 dark:text-gold-500 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span>الإجمالي:</span>
                  <span>{calculations.total.toFixed(2)} TND</span>
                </div>
              </div>

              {/* Client Selection for Commercial/Admin Mode */}
              {canSelectClient && (
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">العميل:</label>
                  {selectedClient ? (
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div>
                        <p className="text-gray-900 dark:text-white font-medium">{selectedClient.name}</p>
                        {selectedClient.phone && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">{selectedClient.phone}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedClient(null);
                            setClientSearchTerm('');
                          }}
                          className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded text-red-700 dark:text-red-400"
                        >
                          إلغاء
                        </button>
                        <button
                          onClick={() => setShowClientModal(true)}
                          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded text-gray-900 dark:text-white"
                        >
                          تغيير
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowClientModal(true)}
                      className="w-full px-4 py-3 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-gold-500 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center justify-center gap-2"
                    >
                      <Users size={20} />
                      اختر عميل
                    </button>
                  )}
                </div>
              )}

              <CreditSalePanel
                value={creditSale}
                onChange={(v) => {
                  checkoutKeyRef.current = null;
                  setCreditSale(v);
                }}
                total={calculations.total}
                disabled={(isCommercial || isAdmin) && !!selectedClient}
              />

              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">ملاحظات:</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  rows="2"
                  placeholder="ملاحظات إضافية..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={clearCart}
                  className="flex-1 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-semibold transition-colors text-gray-900 dark:text-white"
                >
                  إفراغ السلة
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="flex-1 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base bg-gold-600 hover:bg-gold-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-white"
                >
                  {loading ? (
                    'جاري المعالجة...'
                  ) : (
                    <>
                      <Check size={18} className="md:w-5 md:h-5" />
                      <span className="hidden sm:inline">إتمام البيع</span>
                      <span className="sm:hidden">بيع</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && lastOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <CheckCircle2 className="mx-auto text-gold-600 dark:text-gold-500 mb-4" size={64} />
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">تمت العملية بنجاح!</h3>
              <p className="text-gray-600 dark:text-gray-400">
                رقم الطلب: {lastOrder.order?.orderNumber || lastOrder.orderNumber || 'N/A'}
              </p>
              <p className="text-2xl font-bold text-gold-600 dark:text-gold-500 mt-4">
                {(lastOrder.order?.total || lastOrder.total || calculations.total).toFixed(2)} TND
              </p>
              {lastOrder.credit && (
                <div className="mt-4 space-y-1 rounded-xl bg-gold-50 p-3 text-sm dark:bg-gray-700">
                  <p className="font-bold text-gray-900 dark:text-white">بيع بالدين: {lastOrder.credit.customer.name}</p>
                  <p className="text-gray-700 dark:text-gray-300">الباقي على هذا البيع: <b>{formatMillimes(lastOrder.credit.remainingM)}</b></p>
                  <p className="text-gray-700 dark:text-gray-300">مجموع دين العميل: <b>{formatMillimes(lastOrder.credit.balanceM)}</b></p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={generateInvoice}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-semibold flex items-center justify-center gap-2 text-gray-900 dark:text-white"
              >
                <Printer size={20} />
                طباعة
              </button>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setLastOrder(null);
                }}
                className="flex-1 px-4 py-3 bg-gold-600 hover:bg-gold-700 rounded-lg font-semibold text-white"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variant Selection Modal */}
      {selectedProductForVariant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedProductForVariant.name}</h3>
              <button
                onClick={() => {
                  setSelectedProductForVariant(null);
                  setSelectedVariant(null);
                }}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-3 md:space-y-4">
              {/* Product Image */}
              <div className="w-full h-48 md:h-72 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center">
                {(selectedVariant?.image || selectedProductForVariant.images?.[0]) ? (
                  <img
                    src={withBase(selectedVariant?.image || selectedProductForVariant.images[0])}
                    alt={selectedProductForVariant.name}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600 dark:text-gray-400">
                    لا توجد صورة
                  </div>
                )}
              </div>

              {/* Variants Selection */}
              {selectedProductForVariant.variants && selectedProductForVariant.variants.length > 0 && (
                <div>
                  <label className="block text-xs md:text-sm font-semibold text-gray-900 dark:text-white mb-2 md:mb-3">
                    اختر المتغير:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 md:gap-3">
                    {selectedProductForVariant.variants.map((variant, idx) => {
                      const variantStock = variant.stock !== undefined ? variant.stock : selectedProductForVariant.stock || 0;
                      const isOutOfStock = variantStock <= 0;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (isOutOfStock) {
                              toast.error('هذا المتغير غير متوفر في المخزون');
                              return;
                            }
                            setSelectedVariant(variant);
                          }}
                          disabled={isOutOfStock}
                          className={`p-3 rounded-lg border-2 transition-all relative ${
                            isOutOfStock
                              ? 'opacity-50 cursor-not-allowed border-red-300 dark:border-red-700'
                              : selectedVariant?.value === variant.value
                              ? 'border-gold-600 dark:border-gold-500 bg-gold-50 dark:bg-gold-900/20'
                              : 'border-gray-300 dark:border-gray-600 hover:border-gold-600 dark:hover:border-gold-500'
                          }`}
                        >
                          {variant.image ? (
                            <div className="relative">
                              <img
                                src={withBase(variant.image)}
                                alt={variant.name || variant.value}
                                className={`w-full h-20 object-contain rounded mb-2 ${isOutOfStock ? 'grayscale' : ''}`}
                              />
                              {isOutOfStock && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded">
                                  <span className="text-white text-xs font-bold">نفد</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className={`w-full h-20 rounded mb-2 flex items-center justify-center text-xs ${
                              isOutOfStock
                                ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}>
                              {isOutOfStock ? 'نفد' : (variant.name || variant.value)}
                            </div>
                          )}
                          <div className={`text-sm font-medium text-center ${
                            isOutOfStock
                              ? 'text-gray-400 dark:text-gray-500 line-through'
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {variant.name || variant.value}
                          </div>
                          {variant.additionalPrice > 0 && !isOutOfStock && (
                            <div className="text-xs text-gold-600 dark:text-gold-500 text-center mt-1">
                              +{variant.additionalPrice} TND
                            </div>
                          )}
                          {variantStock > 0 && variantStock <= 10 && (
                            <div className="text-xs text-yellow-600 dark:text-yellow-400 text-center mt-1">
                              متوفر: {variantStock}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {!selectedVariant && (
                    <p className="text-sm text-gold-600 dark:text-gold-400 mt-2 text-center">
                      ⚠️ يرجى اختيار متغير قبل الإضافة
                    </p>
                  )}
                </div>
              )}

              {/* Quantity Selector */}
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  الكمية:
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setQuantityToAdd(Math.max(1, quantityToAdd - 1))}
                    className="w-10 h-10 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg flex items-center justify-center text-gray-900 dark:text-white font-bold"
                  >
                    <Minus size={20} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={selectedVariant && selectedVariant.stock !== undefined ? selectedVariant.stock : selectedProductForVariant.stock || 999}
                    value={quantityToAdd}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      const maxStock = selectedVariant && selectedVariant.stock !== undefined ? selectedVariant.stock : selectedProductForVariant.stock || 999;
                      setQuantityToAdd(Math.max(1, Math.min(val, maxStock)));
                    }}
                    className="w-20 text-center bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg py-2 px-3 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                  <button
                    onClick={() => {
                      const maxStock = selectedVariant && selectedVariant.stock !== undefined ? selectedVariant.stock : selectedProductForVariant.stock || 999;
                      setQuantityToAdd(Math.min(maxStock, quantityToAdd + 1));
                    }}
                    className="w-10 h-10 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg flex items-center justify-center text-gray-900 dark:text-white font-bold"
                  >
                    <Plus size={20} />
                  </button>
                  <span className={`text-sm font-semibold ${
                    (selectedVariant && selectedVariant.stock !== undefined ? selectedVariant.stock : selectedProductForVariant.stock || 0) <= 10
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    متوفر: {selectedVariant && selectedVariant.stock !== undefined ? selectedVariant.stock : selectedProductForVariant.stock || 0}
                    {(selectedVariant && selectedVariant.stock !== undefined ? selectedVariant.stock : selectedProductForVariant.stock || 0) <= 10 && ' (منخفض)'}
                  </span>
                </div>
              </div>

              {/* Price Display */}
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 dark:text-gray-400">السعر الأساسي:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {priceType === 'wholesale' && selectedProductForVariant.wholesalePrice > 0 
                      ? selectedProductForVariant.wholesalePrice 
                      : selectedProductForVariant.price} TND
                    {priceType === 'wholesale' && selectedProductForVariant.wholesalePrice > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">(جملة)</span>
                    )}
                  </span>
                </div>
                {selectedVariant?.additionalPrice > 0 && (
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-gray-600 dark:text-gray-400">
                      {selectedVariant.name || selectedVariant.value}:
                    </span>
                    <span className="text-gold-600 dark:text-gold-500 font-medium">
                      +{selectedVariant.additionalPrice} TND
                    </span>
                  </div>
                )}
              </div>

              {/* Price Modification Section */}
              {priceType === 'retail' ? (
                // Retail: Discount options
                <div className="space-y-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      خصم بالمبلغ (TND)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={priceDiscount || ''}
                      onChange={(e) => {
                        const discount = parseFloat(e.target.value) || 0;
                        setPriceDiscount(discount);
                        setPriceDiscountPercent(0);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="text-center text-gray-500 dark:text-gray-400">أو</div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      خصم بالنسبة المئوية (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={priceDiscountPercent || ''}
                      onChange={(e) => {
                        const percent = parseFloat(e.target.value) || 0;
                        setPriceDiscountPercent(percent);
                        setPriceDiscount(0);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ) : (
                // Wholesale: Custom price
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    السعر المخصص للقطعة الواحدة (TND)
                    {selectedVariant?.additionalPrice > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
                        (السعر الأساسي فقط، سيتم إضافة {selectedVariant.additionalPrice} TND للمتغير)
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customPrice !== null ? customPrice : ''}
                    onChange={(e) => {
                      const price = parseFloat(e.target.value);
                      setCustomPrice(isNaN(price) ? null : price);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                    placeholder={(() => {
                      const basePrice = selectedProductForVariant.wholesalePrice > 0 
                        ? selectedProductForVariant.wholesalePrice 
                        : selectedProductForVariant.price;
                      return basePrice.toFixed(2);
                    })()}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    اتركه فارغاً لاستخدام السعر الافتراضي
                  </p>
                </div>
              )}

              {/* Final Price Display */}
              <div className="bg-gold-50 dark:bg-gold-900/20 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">السعر النهائي للقطعة:</span>
                  <span className="text-xl font-bold text-gold-600 dark:text-gold-500">
                    {(() => {
                      const variantPrice = selectedVariant?.additionalPrice || 0;
                      let basePrice = priceType === 'wholesale' && selectedProductForVariant.wholesalePrice > 0 
                        ? selectedProductForVariant.wholesalePrice 
                        : selectedProductForVariant.price;
                      
                      if (priceType === 'wholesale' && customPrice !== null && customPrice > 0) {
                        basePrice = customPrice;
                      } else if (priceType === 'retail') {
                        if (priceDiscount > 0) {
                          basePrice = Math.max(0, basePrice - priceDiscount);
                        } else if (priceDiscountPercent > 0) {
                          const discountAmount = (basePrice * priceDiscountPercent) / 100;
                          basePrice = Math.max(0, basePrice - discountAmount);
                        }
                      }
                      
                      return (basePrice + variantPrice).toFixed(2);
                    })} TND
                  </span>
                </div>
                {quantityToAdd > 1 && (
                  <div className="flex justify-between items-center pt-2 mt-2 border-t border-gold-600 dark:border-gold-600">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">الإجمالي ({quantityToAdd} {quantityToAdd > 1 ? 'قطعة' : 'قطعة'}):</span>
                    <span className="text-2xl font-bold text-gold-600 dark:text-gold-500">
                      {(() => {
                        const variantPrice = selectedVariant?.additionalPrice || 0;
                        let basePrice = priceType === 'wholesale' && selectedProductForVariant.wholesalePrice > 0 
                          ? selectedProductForVariant.wholesalePrice 
                          : selectedProductForVariant.price;
                        
                        if (priceType === 'wholesale' && customPrice !== null && customPrice > 0) {
                          basePrice = customPrice;
                        } else if (priceType === 'retail') {
                          if (priceDiscount > 0) {
                            basePrice = Math.max(0, basePrice - priceDiscount);
                          } else if (priceDiscountPercent > 0) {
                            const discountAmount = (basePrice * priceDiscountPercent) / 100;
                            basePrice = Math.max(0, basePrice - discountAmount);
                          }
                        }
                        
                        return ((basePrice + variantPrice) * quantityToAdd).toFixed(2);
                      })} TND
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setSelectedProductForVariant(null);
                  setSelectedVariant(null);
                  setQuantityToAdd(1);
                  setCustomPrice(null);
                  setPriceDiscount(0);
                  setPriceDiscountPercent(0);
                }}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-semibold text-gray-900 dark:text-white"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  if (!selectedVariant && selectedProductForVariant.variants?.length > 0) {
                    toast.error('يرجى اختيار متغير');
                    return;
                  }
                  // Check variant stock before adding
                  const variantStock = selectedVariant && selectedVariant.stock !== undefined ? selectedVariant.stock : selectedProductForVariant.stock || 0;
                  if (variantStock <= 0) {
                    toast.error('هذا المتغير غير متوفر في المخزون');
                    return;
                  }
                  if (quantityToAdd > variantStock) {
                    toast(`الكمية المتاحة فقط: ${variantStock}. سيتم إضافة ${variantStock} فقط`, { icon: '⚠️' });
                    setQuantityToAdd(variantStock);
                  }
                  
                  // Calculate final price with modifications
                  const variantPrice = selectedVariant?.additionalPrice || 0;
                  let basePrice = priceType === 'wholesale' && selectedProductForVariant.wholesalePrice > 0 
                    ? selectedProductForVariant.wholesalePrice 
                    : selectedProductForVariant.price;
                  
                  let finalPrice = basePrice + variantPrice;
                  
                  if (priceType === 'wholesale') {
                    if (customPrice !== null && customPrice > 0) {
                      finalPrice = customPrice + variantPrice;
                    }
                  } else {
                    if (priceDiscount > 0) {
                      finalPrice = Math.max(0, basePrice - priceDiscount) + variantPrice;
                    } else if (priceDiscountPercent > 0) {
                      const discountAmount = (basePrice * priceDiscountPercent) / 100;
                      finalPrice = Math.max(0, basePrice - discountAmount) + variantPrice;
                    }
                  }

                  // Save values
                  const productToAdd = selectedProductForVariant;
                  const variantToAdd = selectedVariant;
                  const finalQty = Math.min(quantityToAdd, variantStock);
                  const customPriceToUse = priceType === 'wholesale' ? customPrice : null;
                  const discountToUse = priceType === 'retail' ? (priceDiscount > 0 ? priceDiscount : (priceDiscountPercent > 0 ? (basePrice * priceDiscountPercent) / 100 : 0)) : 0;
                  
                  // Close variant modal
                  setSelectedProductForVariant(null);
                  setSelectedVariant(null);
                  setQuantityToAdd(1);
                  setCustomPrice(null);
                  setPriceDiscount(0);
                  setPriceDiscountPercent(0);
                  
                  // Add to cart with modified price
                  addRegularProductToCartWithPrice(productToAdd, variantToAdd, finalQty, customPriceToUse, discountToUse);
                }}
                disabled={
                  (selectedProductForVariant.variants?.length > 0 && !selectedVariant) || 
                  (selectedVariant && selectedVariant.stock !== undefined && selectedVariant.stock <= 0) || 
                  (!selectedProductForVariant.variants || selectedProductForVariant.variants.length === 0) && (selectedProductForVariant.stock <= 0)
                }
                className="flex-1 px-4 py-3 bg-gold-600 hover:bg-gold-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed disabled:text-gray-500 dark:disabled:text-gray-400 rounded-lg font-semibold flex items-center justify-center gap-2 text-white"
              >
                <ShoppingCart size={20} />
                أضف إلى السلة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quantity Modal for products without variants */}
      {showQuantityModal && productForQuantity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">اختر الكمية</h3>
              <button
                onClick={() => {
                  setShowQuantityModal(false);
                  setProductForQuantity(null);
                  setQuantityToAdd(1);
                }}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Product Image */}
              {productForQuantity.images?.[0] && (
                <div className="w-full h-72 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center">
                  <img
                    src={withBase(productForQuantity.images[0])}
                    alt={productForQuantity.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}

              {/* Product Name */}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{productForQuantity.name}</h3>

              {/* Quantity Selector */}
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  الكمية:
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setQuantityToAdd(Math.max(1, quantityToAdd - 1))}
                    className="w-12 h-12 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg flex items-center justify-center text-gray-900 dark:text-white font-bold"
                  >
                    <Minus size={24} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={productForQuantity.stock || 999}
                    value={quantityToAdd}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setQuantityToAdd(Math.max(1, Math.min(val, productForQuantity.stock || 999)));
                    }}
                    className="w-24 text-center bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg py-3 px-4 font-bold text-xl focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                  <button
                    onClick={() => setQuantityToAdd(Math.min(productForQuantity.stock || 999, quantityToAdd + 1))}
                    className="w-12 h-12 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg flex items-center justify-center text-gray-900 dark:text-white font-bold"
                  >
                    <Plus size={24} />
                  </button>
                  <span className="text-gray-600 dark:text-gray-400 text-sm">
                    متوفر: {productForQuantity.stock || 0}
                  </span>
                </div>
              </div>

              {/* Price Display */}
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 dark:text-gray-400">السعر الأساسي:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {priceType === 'wholesale' && productForQuantity.wholesalePrice > 0 
                      ? productForQuantity.wholesalePrice 
                      : productForQuantity.price} TND
                    {priceType === 'wholesale' && productForQuantity.wholesalePrice > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">(جملة)</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Price Modification Section */}
              {priceType === 'retail' ? (
                // Retail: Discount options
                <div className="space-y-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      خصم بالمبلغ (TND)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={priceDiscount || ''}
                      onChange={(e) => {
                        const discount = parseFloat(e.target.value) || 0;
                        setPriceDiscount(discount);
                        setPriceDiscountPercent(0);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="text-center text-gray-500 dark:text-gray-400">أو</div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      خصم بالنسبة المئوية (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={priceDiscountPercent || ''}
                      onChange={(e) => {
                        const percent = parseFloat(e.target.value) || 0;
                        setPriceDiscountPercent(percent);
                        setPriceDiscount(0);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ) : (
                // Wholesale: Custom price
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    السعر المخصص للقطعة الواحدة (TND)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customPrice !== null ? customPrice : ''}
                    onChange={(e) => {
                      const price = parseFloat(e.target.value);
                      setCustomPrice(isNaN(price) ? null : price);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                    placeholder={(() => {
                      const basePrice = productForQuantity.wholesalePrice > 0 
                        ? productForQuantity.wholesalePrice 
                        : productForQuantity.price;
                      return basePrice.toFixed(2);
                    })()}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    اتركه فارغاً لاستخدام السعر الافتراضي
                  </p>
                </div>
              )}

              {/* Final Price Display */}
              <div className="bg-gold-50 dark:bg-gold-900/20 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">السعر النهائي للقطعة:</span>
                  <span className="text-xl font-bold text-gold-600 dark:text-gold-500">
                    {(() => {
                      let basePrice = priceType === 'wholesale' && productForQuantity.wholesalePrice > 0 
                        ? productForQuantity.wholesalePrice 
                        : productForQuantity.price;
                      
                      if (priceType === 'wholesale' && customPrice !== null && customPrice > 0) {
                        basePrice = customPrice;
                      } else if (priceType === 'retail') {
                        if (priceDiscount > 0) {
                          basePrice = Math.max(0, basePrice - priceDiscount);
                        } else if (priceDiscountPercent > 0) {
                          const discountAmount = (basePrice * priceDiscountPercent) / 100;
                          basePrice = Math.max(0, basePrice - discountAmount);
                        }
                      }
                      
                      return basePrice.toFixed(2);
                    })()} TND
                  </span>
                </div>
                {quantityToAdd > 1 && (
                  <div className="flex justify-between items-center pt-2 mt-2 border-t border-gold-600 dark:border-gold-600">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">الإجمالي ({quantityToAdd} {quantityToAdd > 1 ? 'قطعة' : 'قطعة'}):</span>
                    <span className="text-2xl font-bold text-gold-600 dark:text-gold-500">
                      {(() => {
                        let basePrice = priceType === 'wholesale' && productForQuantity.wholesalePrice > 0 
                          ? productForQuantity.wholesalePrice 
                          : productForQuantity.price;
                        
                        if (priceType === 'wholesale' && customPrice !== null && customPrice > 0) {
                          basePrice = customPrice;
                        } else if (priceType === 'retail') {
                          if (priceDiscount > 0) {
                            basePrice = Math.max(0, basePrice - priceDiscount);
                          } else if (priceDiscountPercent > 0) {
                            const discountAmount = (basePrice * priceDiscountPercent) / 100;
                            basePrice = Math.max(0, basePrice - discountAmount);
                          }
                        }
                        
                        return (basePrice * quantityToAdd).toFixed(2);
                      })()} TND
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowQuantityModal(false);
                  setProductForQuantity(null);
                  setQuantityToAdd(1);
                  setCustomPrice(null);
                  setPriceDiscount(0);
                  setPriceDiscountPercent(0);
                }}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-semibold text-gray-900 dark:text-white"
              >
                إلغاء
              </button>
              <button
                onClick={confirmAddToCart}
                className="flex-1 px-4 py-3 bg-gold-600 hover:bg-gold-700 rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <ShoppingCart size={20} />
                أضف إلى السلة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price Modification Modal */}
      {showPriceModal && productForPrice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  تعديل السعر
                </h2>
                <button
                  onClick={() => {
                    setShowPriceModal(false);
                    setProductForPrice(null);
                    setVariantForPrice(null);
                    setQuantityForPrice(1);
                    setCustomPrice(null);
                    setPriceDiscount(0);
                    setPriceDiscountPercent(0);
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Product Info */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {productForPrice.name}
                </h3>
                {variantForPrice && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    المتغير: {variantForPrice.name || variantForPrice.value}
                  </p>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  الكمية: {quantityForPrice}
                </p>
              </div>

              {/* Base Price Display */}
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 dark:text-gray-400">السعر الأساسي:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {(() => {
                      const basePrice = priceType === 'wholesale' && productForPrice.wholesalePrice > 0 
                        ? productForPrice.wholesalePrice 
                        : productForPrice.price;
                      return basePrice;
                    })()} TND
                    {priceType === 'wholesale' && productForPrice.wholesalePrice > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">(جملة)</span>
                    )}
                  </span>
                </div>
                {variantForPrice?.additionalPrice > 0 && (
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-gray-600 dark:text-gray-400">
                      {variantForPrice.name || variantForPrice.value}:
                    </span>
                    <span className="text-gold-600 dark:text-gold-500 font-medium">
                      +{variantForPrice.additionalPrice} TND
                    </span>
                  </div>
                )}
              </div>

              {/* Price Modification Section */}
              {priceType === 'retail' ? (
                // Retail: Discount options
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      خصم بالمبلغ (TND)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={priceDiscount || ''}
                      onChange={(e) => {
                        const discount = parseFloat(e.target.value) || 0;
                        setPriceDiscount(discount);
                        setPriceDiscountPercent(0);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="text-center text-gray-500 dark:text-gray-400">أو</div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      خصم بالنسبة المئوية (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={priceDiscountPercent || ''}
                      onChange={(e) => {
                        const percent = parseFloat(e.target.value) || 0;
                        setPriceDiscountPercent(percent);
                        setPriceDiscount(0);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ) : (
                // Wholesale: Custom price
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    السعر المخصص للقطعة الواحدة (TND)
                    {variantForPrice?.additionalPrice > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
                        (السعر الأساسي فقط، سيتم إضافة {variantForPrice.additionalPrice} TND للمتغير)
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customPrice !== null ? customPrice : ''}
                    onChange={(e) => {
                      const price = parseFloat(e.target.value);
                      setCustomPrice(isNaN(price) ? null : price);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
                    placeholder={(() => {
                      const basePrice = productForPrice.wholesalePrice > 0 
                        ? productForPrice.wholesalePrice 
                        : productForPrice.price;
                      return basePrice.toFixed(2);
                    })()}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    اتركه فارغاً لاستخدام السعر الافتراضي
                  </p>
                </div>
              )}

              {/* Final Price Display */}
              <div className="bg-gold-50 dark:bg-gold-900/20 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">السعر النهائي للقطعة:</span>
                  <span className="text-2xl font-bold text-gold-600 dark:text-gold-500">
                    {(() => {
                      const variantPrice = variantForPrice?.additionalPrice || 0;
                      let basePrice = priceType === 'wholesale' && productForPrice.wholesalePrice > 0 
                        ? productForPrice.wholesalePrice 
                        : productForPrice.price;
                      
                      if (priceType === 'wholesale' && customPrice !== null && customPrice > 0) {
                        basePrice = customPrice;
                      } else if (priceType === 'retail') {
                        if (priceDiscount > 0) {
                          basePrice = Math.max(0, basePrice - priceDiscount);
                        } else if (priceDiscountPercent > 0) {
                          const discountAmount = (basePrice * priceDiscountPercent) / 100;
                          basePrice = Math.max(0, basePrice - discountAmount);
                        }
                      }
                      
                      return (basePrice + variantPrice).toFixed(2);
                    })()} TND
                  </span>
                </div>
                {quantityForPrice > 1 && (
                  <div className="flex justify-between items-center pt-2 mt-2 border-t border-gold-600 dark:border-gold-600">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      الإجمالي ({quantityForPrice} {quantityForPrice > 1 ? 'قطعة' : 'قطعة'}):
                    </span>
                    <span className="text-2xl font-bold text-gold-600 dark:text-gold-500">
                      {(() => {
                        const variantPrice = variantForPrice?.additionalPrice || 0;
                        let basePrice = priceType === 'wholesale' && productForPrice.wholesalePrice > 0 
                          ? productForPrice.wholesalePrice 
                          : productForPrice.price;
                        
                        if (priceType === 'wholesale' && customPrice !== null && customPrice > 0) {
                          basePrice = customPrice;
                        } else if (priceType === 'retail') {
                          if (priceDiscount > 0) {
                            basePrice = Math.max(0, basePrice - priceDiscount);
                          } else if (priceDiscountPercent > 0) {
                            const discountAmount = (basePrice * priceDiscountPercent) / 100;
                            basePrice = Math.max(0, basePrice - discountAmount);
                          }
                        }
                        
                        return ((basePrice + variantPrice) * quantityForPrice).toFixed(2);
                      })()} TND
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPriceModal(false);
                    setProductForPrice(null);
                    setVariantForPrice(null);
                    setQuantityForPrice(1);
                    setCustomPrice(null);
                    setPriceDiscount(0);
                    setPriceDiscountPercent(0);
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-semibold text-gray-900 dark:text-white"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmPriceAndAddToCart}
                  className="flex-1 px-4 py-3 bg-gold-600 hover:bg-gold-700 rounded-lg font-semibold flex items-center justify-center gap-2 text-white"
                >
                  <ShoppingCart size={20} />
                  أضف إلى السلة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Client Selection Modal for Commercial/Admin Mode */}
      {canSelectClient && showClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">اختر عميل</h3>
              <button
                onClick={() => setShowClientModal(false)}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="mb-4">
              <div className="relative">
                <SearchIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                <input
                  type="text"
                  placeholder="ابحث عن عميل..."
                  value={clientSearchTerm}
                  onChange={(e) => setClientSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {loadingClients ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-600 mx-auto"></div>
                  <p className="text-gray-400 mt-2">جاري التحميل...</p>
                </div>
              ) : filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <button
                    key={client._id}
                    onClick={() => {
                      setSelectedClient(client);
                      setShowClientModal(false);
                      setClientSearchTerm('');
                    }}
                    className={`w-full p-4 rounded-lg text-right transition-colors ${
                      selectedClient?._id === client._id
                        ? 'bg-gold-600 hover:bg-gold-700 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <p className={`font-medium ${selectedClient?._id === client._id ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{client.name}</p>
                    {client.phone && (
                      <p className={`text-sm mt-1 ${selectedClient?._id === client._id ? 'text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>{client.phone}</p>
                    )}
                    {client.email && (
                      <p className={`text-xs mt-1 ${selectedClient?._id === client._id ? 'text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>{client.email}</p>
                    )}
                  </button>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400">
                    {clientSearchTerm ? 'لا توجد نتائج للبحث' : 'لا يوجد عملاء'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSInterface;
