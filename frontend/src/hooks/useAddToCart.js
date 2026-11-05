import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { useCart } from '../contexts/CartContext';
import { toCartItem } from '../utils/cartItem';

/** Add a regular product (optionally a variant) to the cart with consistent feedback. */
export const useAddToCart = () => {
  const { addToCart } = useCart();

  return useCallback(
    (product, variant = null, quantity = 1) => {
      const item = toCartItem(product, variant, quantity);
      if (item.stock <= 0) {
        toast.error('المنتج غير متوفر في المخزون');
        return 0;
      }
      const added = addToCart(item);
      if (added <= 0) {
        toast.error(`لا يمكن إضافة المزيد - المخزون المتاح: ${item.stock}`);
      } else if (added < quantity) {
        toast(`تمت إضافة ${added} فقط (حد المخزون)`, { icon: '⚠️' });
      } else {
        const label = variant ? `${product.name} (${variant.value})` : product.name;
        toast.success(`تمت إضافة ${label} إلى السلة`);
      }
      return added;
    },
    [addToCart]
  );
};

export default useAddToCart;
