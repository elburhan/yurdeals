// ============================================
// Cart Repository
// ============================================

import { Prisma, ProductApprovalStatus, ProductStockType } from '@prisma/client';
import { CartData, CartItemSummary } from '@yurdeals/shared';
import { prisma } from '../config';

const CART_SELECT = {
  id: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      productId: true,
      variantId: true,
      quantity: true,
      priceSnapshot: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          stockType: true,
          currency: true,
          sourceCountry: true,
          images: {
            where: { isPrimary: true },
            select: {
              id: true,
              url: true,
              alt: true,
              sortOrder: true,
              isPrimary: true,
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            take: 1,
          },
        },
      },
      variant: {
        select: {
          id: true,
          name: true,
          sku: true,
          stock: true,
          price: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.CartSelect;

const PUBLIC_PRODUCT_SELECT = {
  id: true,
  name: true,
  basePrice: true,
  currency: true,
  stockType: true,
  isActive: true,
  isPublished: true,
  approvalStatus: true,
  category: {
    select: {
      isActive: true,
    },
  },
  variants: {
    where: { isActive: true },
    select: {
      id: true,
      productId: true,
      price: true,
      stock: true,
      isActive: true,
    },
  },
} satisfies Prisma.ProductSelect;

type CartRecord = Prisma.CartGetPayload<{ select: typeof CART_SELECT }>;
type PublicProductRecord = Prisma.ProductGetPayload<{ select: typeof PUBLIC_PRODUCT_SELECT }>;

export interface AddCartItemData {
  userId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  priceSnapshot: Prisma.Decimal;
  currency: string;
}

export interface ExistingCartItem {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
}

export interface CartItemStockCheck {
  id: string;
  quantity: number;
  product: {
    stockType: ProductStockType;
    variants: Array<{
      id: string;
      stock: number;
      isActive: boolean;
    }>;
  };
  variant: {
    id: string;
    stock: number;
    isActive: boolean;
  } | null;
}

export class CartRepository {
  async findCartByUserId(userId: string): Promise<CartData> {
    const cart = await prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: CART_SELECT,
    });

    return mapCart(cart);
  }

  async findProductForCart(productId: string): Promise<PublicProductRecord | null> {
    return prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true,
        isPublished: true,
        approvalStatus: ProductApprovalStatus.APPROVED,
        category: { isActive: true },
      },
      select: PUBLIC_PRODUCT_SELECT,
    });
  }

  async findExistingProductLine(
    userId: string,
    productId: string,
    variantId?: string,
  ): Promise<ExistingCartItem | null> {
    return prisma.cartItem.findFirst({
      where: {
        productId,
        variantId: variantId ?? null,
        cart: { userId },
      },
      select: {
        id: true,
        productId: true,
        variantId: true,
        quantity: true,
      },
    });
  }

  async findCartItemForStockCheck(
    userId: string,
    cartItemId: string,
  ): Promise<CartItemStockCheck | null> {
    return prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: { userId },
      },
      select: {
        id: true,
        quantity: true,
        product: {
          select: {
            stockType: true,
            variants: {
              where: { isActive: true },
              select: {
                id: true,
                stock: true,
                isActive: true,
              },
            },
          },
        },
        variant: {
          select: {
            id: true,
            stock: true,
            isActive: true,
          },
        },
      },
    });
  }

  async addItem(data: AddCartItemData): Promise<CartData> {
    const cart = await prisma.$transaction(async (tx) => {
      const userCart = await tx.cart.upsert({
        where: { userId: data.userId },
        create: { userId: data.userId },
        update: {},
        select: { id: true },
      });

      const existingItem = await tx.cartItem.findFirst({
        where: {
          cartId: userCart.id,
          productId: data.productId,
          variantId: data.variantId ?? null,
        },
        select: {
          id: true,
          quantity: true,
          variantId: true,
        },
      });

      if (existingItem) {
        await tx.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: existingItem.quantity + data.quantity },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: userCart.id,
            productId: data.productId,
            variantId: data.variantId,
            quantity: data.quantity,
            priceSnapshot: data.priceSnapshot,
            currency: data.currency,
          },
        });
      }

      return tx.cart.findUniqueOrThrow({
        where: { id: userCart.id },
        select: CART_SELECT,
      });
    });

    return mapCart(cart);
  }

  async updateItem(userId: string, cartItemId: string, quantity: number): Promise<CartData> {
    const cart = await prisma.$transaction(async (tx) => {
      const item = await tx.cartItem.findFirstOrThrow({
        where: {
          id: cartItemId,
          cart: { userId },
        },
        select: {
          id: true,
          cartId: true,
        },
      });

      await tx.cartItem.update({
        where: { id: item.id },
        data: { quantity },
      });

      return tx.cart.findUniqueOrThrow({
        where: { id: item.cartId },
        select: CART_SELECT,
      });
    });

    return mapCart(cart);
  }

  async removeItem(userId: string, cartItemId: string): Promise<CartData> {
    const cart = await prisma.$transaction(async (tx) => {
      const item = await tx.cartItem.findFirstOrThrow({
        where: {
          id: cartItemId,
          cart: { userId },
        },
        select: {
          id: true,
          cartId: true,
        },
      });

      await tx.cartItem.delete({ where: { id: item.id } });

      return tx.cart.findUniqueOrThrow({
        where: { id: item.cartId },
        select: CART_SELECT,
      });
    });

    return mapCart(cart);
  }
}

function mapCart(cart: CartRecord): CartData {
  const items = cart.items.map(mapCartItem);
  const currency = items[0]?.currency ?? 'NGN';

  return {
    cart: {
      id: cart.id,
      items,
      summary: {
        itemCount: items.reduce((total, item) => total + item.quantity, 0),
        subtotal: items.reduce((total, item) => total + item.lineTotal, 0),
        currency,
      },
      createdAt: cart.createdAt.toISOString(),
      updatedAt: cart.updatedAt.toISOString(),
    },
  };
}

function mapCartItem(item: CartRecord['items'][number]): CartItemSummary {
  const priceSnapshot = Number(item.priceSnapshot);

  return {
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
    priceSnapshot,
    lineTotal: priceSnapshot * item.quantity,
    currency: item.currency,
    product: {
      id: item.product.id,
      name: item.product.name,
      slug: item.product.slug,
      stockType: item.product.stockType,
      currency: item.product.currency,
      sourceCountry: item.product.sourceCountry,
      primaryImage: item.product.images[0] ?? null,
    },
    variant: item.variant
      ? {
          id: item.variant.id,
          name: item.variant.name,
          sku: item.variant.sku,
          stock: item.variant.stock,
          price: Number(item.variant.price),
        }
      : null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function getCartPrice(product: PublicProductRecord, variantId?: string): Prisma.Decimal {
  if (!variantId) {
    return product.basePrice;
  }

  const variant = product.variants.find((candidate) => candidate.id === variantId);
  return variant?.price ?? product.basePrice;
}

export function getVariantStock(product: PublicProductRecord, variantId?: string): number | null {
  if (!variantId) {
    return null;
  }

  return product.variants.find((candidate) => candidate.id === variantId)?.stock ?? null;
}

export function isLocalProduct(product: PublicProductRecord): boolean {
  return product.stockType === ProductStockType.IN_STOCK;
}

export const cartRepository = new CartRepository();
