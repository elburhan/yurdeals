// ============================================
// Admin Product Repository
// ============================================

import { Prisma } from '@prisma/client';
import { AdminProductSummary } from '@yurdeals/shared';
import { prisma } from '../config';
import {
  AdminCreateProductInput,
  AdminProductQueryInput,
  AdminUpdateProductInput,
} from '../schemas/admin.schema';
import { getPagination } from '../utils/pagination';

const ADMIN_PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  categoryId: true,
  basePrice: true,
  currency: true,
  stockType: true,
  isFeatured: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
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
  category: {
    select: {
      name: true,
    },
  },
} satisfies Prisma.ProductSelect;

type AdminProductRecord = Prisma.ProductGetPayload<{ select: typeof ADMIN_PRODUCT_SELECT }>;

export interface AdminProductPageResult {
  products: AdminProductSummary[];
  total: number;
}

export class AdminProductRepository {
  async findProducts(query: AdminProductQueryInput): Promise<AdminProductPageResult> {
    const where: Prisma.ProductWhereInput = {
      ...(query.status === 'active' ? { isActive: true } : {}),
      ...(query.status === 'inactive' ? { isActive: false } : {}),
      ...(query.category_id ? { categoryId: query.category_id } : {}),
    };
    const { skip, take } = getPagination(query);

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        select: ADMIN_PRODUCT_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      products: products.map(mapAdminProduct),
      total,
    };
  }

  async createProduct(input: AdminCreateProductInput): Promise<AdminProductSummary> {
    const product = await prisma.product.create({
      data: {
        name: input.name,
        slug: input.slug ?? createSlug(input.name),
        description: input.description,
        shortDesc: input.short_desc,
        categoryId: input.category_id,
        basePrice: input.base_price,
        currency: input.currency,
        stockType: input.stock_type,
        sku: input.sku,
        weight: input.weight,
        isFeatured: input.is_featured,
        ...(input.image_url
          ? {
              images: {
                create: {
                  url: input.image_url,
                  alt: input.name,
                  sortOrder: 0,
                  isPrimary: true,
                },
              },
            }
          : {}),
      },
      select: ADMIN_PRODUCT_SELECT,
    });

    return mapAdminProduct(product);
  }

  async updateProduct(
    productId: string,
    input: AdminUpdateProductInput,
  ): Promise<AdminProductSummary> {
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.slug ? { slug: input.slug } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.short_desc !== undefined ? { shortDesc: input.short_desc } : {}),
        ...(input.category_id ? { categoryId: input.category_id } : {}),
        ...(input.base_price !== undefined ? { basePrice: input.base_price } : {}),
        ...(input.currency ? { currency: input.currency } : {}),
        ...(input.stock_type ? { stockType: input.stock_type } : {}),
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.weight !== undefined ? { weight: input.weight } : {}),
        ...(input.is_featured !== undefined ? { isFeatured: input.is_featured } : {}),
        ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
      },
      select: ADMIN_PRODUCT_SELECT,
    });

    if (input.image_url) {
      const imageUrl = input.image_url;
      await prisma.$transaction(async (tx) => {
        const primaryImage = await tx.productImage.findFirst({
          where: { productId, isPrimary: true },
          select: { id: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });

        if (primaryImage) {
          await tx.productImage.update({
            where: { id: primaryImage.id },
            data: {
              url: imageUrl,
              alt: input.name ?? product.name,
            },
          });
          return;
        }

        await tx.productImage.create({
          data: {
            productId,
            url: imageUrl,
            alt: input.name ?? product.name,
            sortOrder: 0,
            isPrimary: true,
          },
        });
      });

      const productWithImage = await prisma.product.findUniqueOrThrow({
        where: { id: productId },
        select: ADMIN_PRODUCT_SELECT,
      });

      return mapAdminProduct(productWithImage);
    }

    return mapAdminProduct(product);
  }

  async disableProduct(productId: string): Promise<AdminProductSummary> {
    const product = await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
      select: ADMIN_PRODUCT_SELECT,
    });

    return mapAdminProduct(product);
  }

  async softDeleteProduct(productId: string): Promise<AdminProductSummary> {
    const product = await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
      select: ADMIN_PRODUCT_SELECT,
    });

    return mapAdminProduct(product);
  }
}

function createSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${base}-${Date.now().toString(36)}`;
}

function mapAdminProduct(product: AdminProductRecord): AdminProductSummary {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    categoryId: product.categoryId,
    categoryName: product.category.name,
    basePrice: Number(product.basePrice),
    currency: product.currency,
    stockType: product.stockType,
    isFeatured: product.isFeatured,
    isActive: product.isActive,
    primaryImage: product.images[0] ?? null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export const adminProductRepository = new AdminProductRepository();
