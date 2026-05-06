// ============================================
// Cart Service
// ============================================

import { CartData } from '@yurdeals/shared';
import { AppError } from '../middleware/errorHandler';
import {
  cartRepository,
  getCartPrice,
  getVariantStock,
  isLocalProduct,
} from '../repositories/cart.repository';
import { AddCartItemInput, UpdateCartItemInput } from '../schemas/cart.schema';

export async function getCart(userId: string): Promise<CartData> {
  return cartRepository.findCartByUserId(userId);
}

export async function addCartItem(userId: string, input: AddCartItemInput): Promise<CartData> {
  const product = await cartRepository.findProductForCart(input.product_id);

  if (!product) {
    throw new AppError('Product not found or inactive', 404, 'PRODUCT_NOT_FOUND');
  }

  if (input.variant_id) {
    const variant = product.variants.find((candidate) => candidate.id === input.variant_id);
    if (!variant) {
      throw new AppError('Variant not found or inactive', 404, 'VARIANT_NOT_FOUND');
    }
  }

  if (isLocalProduct(product)) {
    if (!input.variant_id && product.variants.length > 0) {
      throw new AppError('Select a product variant before adding to cart', 422, 'VARIANT_REQUIRED');
    }

    const stock = getVariantStock(product, input.variant_id);
    if (input.variant_id && stock !== null && input.quantity > stock) {
      throw new AppError('Requested quantity exceeds available stock', 409, 'INSUFFICIENT_STOCK');
    }
  }

  const existingLine = await cartRepository.findExistingProductLine(
    userId,
    input.product_id,
    input.variant_id,
  );
  if (existingLine) {
    if (existingLine.variantId !== (input.variant_id ?? null)) {
      throw new AppError(
        'This product is already in your cart with a different variant',
        409,
        'CART_VARIANT_CONFLICT',
      );
    }

    if (isLocalProduct(product)) {
      const stock = getVariantStock(product, input.variant_id);
      const finalQuantity = existingLine.quantity + input.quantity;
      if (input.variant_id && stock !== null && finalQuantity > stock) {
        throw new AppError('Requested quantity exceeds available stock', 409, 'INSUFFICIENT_STOCK');
      }
    }
  }

  return cartRepository.addItem({
    userId,
    productId: input.product_id,
    variantId: input.variant_id,
    quantity: input.quantity,
    priceSnapshot: getCartPrice(product, input.variant_id),
    currency: product.currency,
  });
}

export async function updateCartItem(
  userId: string,
  cartItemId: string,
  input: UpdateCartItemInput,
): Promise<CartData> {
  const item = await cartRepository.findCartItemForStockCheck(userId, cartItemId);

  if (!item) {
    throw new AppError('Cart item not found', 404, 'CART_ITEM_NOT_FOUND');
  }

  if (item.product.stockType === 'IN_STOCK') {
    if (item.variant && input.quantity > item.variant.stock) {
      throw new AppError('Requested quantity exceeds available stock', 409, 'INSUFFICIENT_STOCK');
    }

    if (!item.variant && item.product.variants.length > 0) {
      throw new AppError(
        'Select a product variant before updating quantity',
        422,
        'VARIANT_REQUIRED',
      );
    }
  }

  return cartRepository.updateItem(userId, cartItemId, input.quantity);
}

export async function removeCartItem(userId: string, cartItemId: string): Promise<CartData> {
  const item = await cartRepository.findCartItemForStockCheck(userId, cartItemId);

  if (!item) {
    throw new AppError('Cart item not found', 404, 'CART_ITEM_NOT_FOUND');
  }

  return cartRepository.removeItem(userId, cartItemId);
}
