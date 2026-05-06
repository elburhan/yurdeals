// ============================================
// Cart Context
// ============================================

import { createContext, useCallback, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { CartData, CartItemSummary, ProductDetail } from '@yurdeals/shared';
import { useAuth } from '../hooks/useAuth';
import {
  addCartItem as addCartItemRequest,
  getCart,
  removeCartItem as removeCartItemRequest,
  updateCartItem as updateCartItemRequest,
  type AddCartItemPayload,
} from '../lib/cartApi';
import { getProduct } from '../lib/catalogApi';

interface CartState {
  cart: CartData['cart'] | null;
  isLoading: boolean;
  error: string;
}

type CartAction =
  | { type: 'loading' }
  | { type: 'loaded'; cart: CartData['cart'] }
  | { type: 'error'; error: string }
  | { type: 'clear' };

export interface CartContextValue extends CartState {
  refreshCart: () => Promise<void>;
  addItem: (payload: AddCartItemPayload) => Promise<void>;
  updateItem: (cartItemId: string, quantity: number) => Promise<void>;
  removeItem: (cartItemId: string) => Promise<void>;
}

export const CartContext = createContext<CartContextValue | null>(null);

interface CartProviderProps {
  children: ReactNode;
}

const GUEST_CART_STORAGE_KEY = 'yurdeals_guest_cart';

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'loading':
      return { ...state, isLoading: true, error: '' };
    case 'loaded':
      return { cart: action.cart, isLoading: false, error: '' };
    case 'error':
      return { ...state, isLoading: false, error: action.error };
    case 'clear':
      return { cart: null, isLoading: false, error: '' };
    default:
      return state;
  }
}

const initialState: CartState = {
  cart: null,
  isLoading: false,
  error: '',
};

export function CartProvider({ children }: CartProviderProps) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const loadGuestCart = useCallback(() => {
    const cart = readGuestCart();
    dispatch({ type: 'loaded', cart });
  }, []);

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated) {
      loadGuestCart();
      return;
    }

    dispatch({ type: 'loading' });
    try {
      const response = await getCart();
      dispatch({ type: 'loaded', cart: response.data.cart });
    } catch (error) {
      dispatch({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unable to load cart',
      });
    }
  }, [isAuthenticated, loadGuestCart]);

  useEffect(() => {
    if (!isAuthLoading) {
      void refreshCart();
    }
  }, [isAuthLoading, refreshCart]);

  const addItem = useCallback(
    async (payload: AddCartItemPayload) => {
      if (isAuthenticated) {
        const response = await addCartItemRequest(payload);
        dispatch({ type: 'loaded', cart: response.data.cart });
        return;
      }

      const response = await getProduct(payload.product_id);
      const cart = addGuestCartItem(readGuestCart(), response.data.product, payload);
      writeGuestCart(cart);
      dispatch({ type: 'loaded', cart });
    },
    [isAuthenticated],
  );

  const updateItem = useCallback(
    async (cartItemId: string, quantity: number) => {
      if (isAuthenticated) {
        const response = await updateCartItemRequest(cartItemId, { quantity });
        dispatch({ type: 'loaded', cart: response.data.cart });
        return;
      }

      const cart = mapGuestCart(readGuestCart().items.map((item) =>
        item.id === cartItemId ? { ...item, quantity, lineTotal: item.priceSnapshot * quantity } : item,
      ));
      writeGuestCart(cart);
      dispatch({ type: 'loaded', cart });
    },
    [isAuthenticated],
  );

  const removeItem = useCallback(
    async (cartItemId: string) => {
      if (isAuthenticated) {
        const response = await removeCartItemRequest(cartItemId);
        dispatch({ type: 'loaded', cart: response.data.cart });
        return;
      }

      const cart = mapGuestCart(readGuestCart().items.filter((item) => item.id !== cartItemId));
      writeGuestCart(cart);
      dispatch({ type: 'loaded', cart });
    },
    [isAuthenticated],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      ...state,
      refreshCart,
      addItem,
      updateItem,
      removeItem,
    }),
    [state, refreshCart, addItem, updateItem, removeItem],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

function readGuestCart(): CartData['cart'] {
  const emptyCart = createEmptyGuestCart();
  const rawCart = window.localStorage.getItem(GUEST_CART_STORAGE_KEY);

  if (!rawCart) {
    return emptyCart;
  }

  try {
    const parsedCart = JSON.parse(rawCart) as CartData['cart'];
    return mapGuestCart(parsedCart.items ?? []);
  } catch {
    return emptyCart;
  }
}

function writeGuestCart(cart: CartData['cart']): void {
  window.localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(cart));
}

function createEmptyGuestCart(): CartData['cart'] {
  const now = new Date().toISOString();
  return {
    id: 'guest-cart',
    items: [],
    summary: {
      itemCount: 0,
      subtotal: 0,
      currency: 'NGN',
    },
    createdAt: now,
    updatedAt: now,
  };
}

function addGuestCartItem(
  cart: CartData['cart'],
  product: ProductDetail,
  payload: AddCartItemPayload,
): CartData['cart'] {
  const variant = payload.variant_id
    ? product.variants.find((candidate) => candidate.id === payload.variant_id)
    : product.variants[0] ?? null;
  const selectedVariant = variant ?? null;

  if (payload.variant_id && !selectedVariant) {
    throw new Error('Variant not found or inactive');
  }

  if (product.stockType === 'LOCAL' && product.variants.length > 0 && !selectedVariant) {
    throw new Error('Select a product variant before adding to cart');
  }

  if (selectedVariant && payload.quantity > selectedVariant.stock) {
    throw new Error('Requested quantity exceeds available stock');
  }

  const variantId = selectedVariant?.id ?? null;
  const existingItem = cart.items.find((item) => item.productId === product.id);
  if (existingItem && existingItem.variantId !== variantId) {
    throw new Error('This product is already in your cart with a different variant');
  }

  const price = selectedVariant?.price ?? product.basePrice;
  const nextItems = existingItem
    ? cart.items.map((item) =>
        item.id === existingItem.id
          ? {
              ...item,
              quantity: item.quantity + payload.quantity,
              lineTotal: item.priceSnapshot * (item.quantity + payload.quantity),
              updatedAt: new Date().toISOString(),
            }
          : item,
      )
    : [
        ...cart.items,
        createGuestCartItem(product, selectedVariant, payload.quantity, price),
      ];

  return mapGuestCart(nextItems);
}

function createGuestCartItem(
  product: ProductDetail,
  variant: ProductDetail['variants'][number] | null,
  quantity: number,
  price: number,
): CartItemSummary {
  const now = new Date().toISOString();
  return {
    id: `guest-${product.id}-${variant?.id ?? 'base'}`,
    productId: product.id,
    variantId: variant?.id ?? null,
    quantity,
    priceSnapshot: price,
    lineTotal: price * quantity,
    currency: product.currency,
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      stockType: product.stockType,
      currency: product.currency,
      primaryImage: product.primaryImage,
    },
    variant: variant
      ? {
          id: variant.id,
          name: variant.name,
          sku: variant.sku,
          stock: variant.stock,
          price: variant.price,
        }
      : null,
    createdAt: now,
    updatedAt: now,
  };
}

function mapGuestCart(items: CartItemSummary[]): CartData['cart'] {
  const now = new Date().toISOString();
  const currency = items[0]?.currency ?? 'NGN';
  return {
    id: 'guest-cart',
    items: items.map((item) => ({
      ...item,
      lineTotal: item.priceSnapshot * item.quantity,
    })),
    summary: {
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      subtotal: items.reduce((total, item) => total + item.priceSnapshot * item.quantity, 0),
      currency,
    },
    createdAt: items[0]?.createdAt ?? now,
    updatedAt: now,
  };
}
