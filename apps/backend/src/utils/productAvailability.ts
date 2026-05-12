// ============================================
// Product Availability Helpers
// ============================================

import { ProductStockType } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

export interface ProductAvailabilityInput {
  name: string;
  stockType: ProductStockType;
  inventoryQuantity?: number | null;
  preorderSlotsRemaining?: number | null;
  preorderStartsAt?: Date | null;
  preorderEndsAt?: Date | null;
  variants?: Array<{
    id: string;
    stock: number;
    isActive?: boolean;
  }>;
}

export interface VariantAvailabilityInput {
  id: string;
  stock: number;
  isActive?: boolean;
}

export function assertProductAvailabilityForQuantity(input: {
  product: ProductAvailabilityInput;
  quantity: number;
  variant?: VariantAvailabilityInput | null;
  now?: Date;
}): void {
  const now = input.now ?? new Date();

  if (input.product.stockType === ProductStockType.PREORDER) {
    assertPreorderAvailability(input.product, input.quantity, now);
    return;
  }

  assertInStockAvailability(input.product, input.quantity, input.variant ?? null);
}

function assertPreorderAvailability(
  product: ProductAvailabilityInput,
  quantity: number,
  now: Date,
): void {
  if (product.preorderStartsAt && product.preorderStartsAt.getTime() > now.getTime()) {
    throw new AppError(
      `"${product.name}" is not open for preorder yet`,
      409,
      'PREORDER_NOT_STARTED',
    );
  }

  if (product.preorderEndsAt && product.preorderEndsAt.getTime() < now.getTime()) {
    throw new AppError(
      `"${product.name}" preorder window has closed`,
      409,
      'PREORDER_CLOSED',
    );
  }

  if (product.preorderSlotsRemaining !== null && product.preorderSlotsRemaining !== undefined) {
    if (quantity > product.preorderSlotsRemaining) {
      throw new AppError(
        `Only ${product.preorderSlotsRemaining} preorder slot(s) remain for "${product.name}"`,
        409,
        'PREORDER_SLOTS_UNAVAILABLE',
      );
    }
  }
}

function assertInStockAvailability(
  product: ProductAvailabilityInput,
  quantity: number,
  variant: VariantAvailabilityInput | null,
): void {
  if (variant) {
    if (variant.isActive === false || quantity > variant.stock) {
      throw new AppError(
        `Insufficient stock for "${product.name}"`,
        409,
        'INSUFFICIENT_STOCK',
      );
    }
    return;
  }

  if ((product.variants?.length ?? 0) > 0) {
    throw new AppError('Select a product variant before checkout', 422, 'VARIANT_REQUIRED');
  }

  if (product.inventoryQuantity !== null && product.inventoryQuantity !== undefined) {
    if (quantity > product.inventoryQuantity) {
      throw new AppError(
        `Insufficient stock for "${product.name}"`,
        409,
        'INSUFFICIENT_STOCK',
      );
    }
  }
}
