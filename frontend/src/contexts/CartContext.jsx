import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import clientApi from '../utils/clientAxios';
import { cartKey } from '../utils/cartItem';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);
const STORAGE_KEY = 'cart';

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};

const loadCart = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((i) => i && i.productId && i.quantity > 0) : [];
  } catch {
    return [];
  }
};

// Max quantity allowed for a line (regular products are limited by stock)
const maxFor = (item) => {
  if (item.productType !== 'regular') return Infinity;
  const stock = item.variant?.stock ?? item.stock;
  return stock === undefined || stock === null ? Infinity : Math.max(0, Number(stock));
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(loadCart);
  const [lastAddedItem, setLastAddedItem] = useState(null);
  const animTimer = useRef(null);
  const itemsRef = useRef(cartItems);
  itemsRef.current = cartItems;
  const { user } = useAuth();
  const tier = user?.role === 'client' ? 'gros' : 'detail';

  // Persist + sync between tabs
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
    } catch {
      /* storage full / unavailable */
    }
  }, [cartItems]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setCartItems(loadCart());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /**
   * Re-price the cart for the current viewer (détail <-> gros) and refresh stock.
   * Runs on load and whenever the account / tier changes.
   */
  const refreshCart = useCallback(async () => {
    const ids = [...new Set(itemsRef.current.filter((i) => i.productType === 'regular').map((i) => i.productId))];
    if (ids.length === 0) return;

    const results = await Promise.allSettled(ids.map((id) => clientApi.get(`/products/${id}`)));
    const fresh = new Map();
    const gone = new Set();
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') fresh.set(ids[idx], r.value.data.data);
      else if (r.reason?.response?.status === 404) gone.add(ids[idx]);
    });

    setCartItems((prev) =>
      prev
        .filter((i) => !(i.productType === 'regular' && gone.has(i.productId)))
        .map((item) => {
          const p = fresh.get(item.productId);
          if (!p || item.productType !== 'regular') return item;
          const variant = item.variant ? p.variants?.find((v) => v.value === item.variant.value) : null;
          const updated = {
            ...item,
            name: p.name,
            price: Number(p.price) || 0,
            retailPrice: Number(p.retailPrice ?? p.price) || 0,
            stock: variant ? variant.stock : p.stock,
            variant: item.variant && variant ? { ...item.variant, stock: variant.stock } : item.variant,
          };
          const max = maxFor(updated);
          return { ...updated, quantity: Math.min(updated.quantity, max) };
        })
        .filter((i) => i.quantity > 0)
    );
  }, []);

  useEffect(() => {
    refreshCart().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, user?._id]);

  const flash = useCallback((item, action) => {
    setLastAddedItem({ ...item, action });
    clearTimeout(animTimer.current);
    animTimer.current = setTimeout(() => setLastAddedItem(null), 600);
  }, []);

  /** Adds an item; returns the quantity actually added (0 when out of stock). */
  const addToCart = useCallback(
    (item, triggerAnimation = true) => {
      const key = cartKey(item);
      const wanted = Math.max(1, Number(item.quantity) || 1);
      const prev = itemsRef.current;
      const existing = prev.find((i) => cartKey(i) === key);
      const merged = existing ? { ...existing, ...item, quantity: existing.quantity } : { ...item, quantity: 0 };
      const newQty = Math.min(merged.quantity + wanted, maxFor(merged));
      const added = newQty - merged.quantity;
      if (added <= 0) return 0;

      const line = { ...merged, quantity: newQty };
      const next = existing ? prev.map((i) => (cartKey(i) === key ? line : i)) : [...prev, line];
      itemsRef.current = next;
      setCartItems(next);

      if (triggerAnimation) flash(item, existing ? 'updated' : 'added');
      return added;
    },
    [flash]
  );

  const removeFromCart = useCallback((index) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateQuantity = useCallback((index, quantity) => {
    setCartItems((prev) => {
      const item = prev[index];
      if (!item) return prev;
      const q = Math.floor(Number(quantity) || 0);
      if (q <= 0) return prev.filter((_, i) => i !== index);
      return prev.map((it, i) => (i === index ? { ...it, quantity: Math.min(q, maxFor(it)) } : it));
    });
  }, []);

  const clearCart = useCallback(() => setCartItems([]), []);

  const getCartTotal = useCallback(
    () => cartItems.reduce((total, item) => total + (Number(item.price) || 0) * item.quantity, 0),
    [cartItems]
  );

  const getCartItemsCount = useCallback(() => cartItems.reduce((count, item) => count + item.quantity, 0), [cartItems]);

  const value = useMemo(
    () => ({
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getCartTotal,
      getCartItemsCount,
      refreshCart,
      lastAddedItem,
      maxQuantityFor: maxFor,
    }),
    [cartItems, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal, getCartItemsCount, refreshCart, lastAddedItem]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
