// ============================================
// Admin Product Repository
// ============================================

import { Prisma, ProductApprovalStatus } from '@prisma/client';
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
  sourceCountry: true,
  stockType: true,
  approvalStatus: true,
  isPublished: true,
  isFeatured: true,
  isActive: true,
  inventoryQuantity: true,
  preorderSlotsTotal: true,
  preorderSlotsRemaining: true,
  preorderStartsAt: true,
  preorderEndsAt: true,
  estimatedArrivalAt: true,
  trendingScore: true,
  createdAt: true,
  updatedAt: true,
  images: {
    select: {
      id: true,
      url: true,
      alt: true,
      sortOrder: true,
      isPrimary: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  },
  category: {
    select: {
      name: true,
    },
  },
} satisfies Prisma.ProductSelect;

type AdminProductRecord = Prisma.ProductGetPayload<{ select: typeof ADMIN_PRODUCT_SELECT }>;

interface NormalizedInventoryFields {
  inventoryQuantity?: number;
  preorderSlotsTotal?: number;
  preorderSlotsRemaining?: number;
  preorderStartsAt?: Date;
  preorderEndsAt?: Date;
  estimatedArrivalAt?: Date;
}

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
    const imageUrls = normalizeProductImageUrls(input);
    const inventoryFields = normalizeInventoryFields(input);
    const product = await prisma.product.create({
      data: {
        name: input.name,
        slug: input.slug ?? createSlug(input.name),
        description: input.description,
        shortDesc: input.short_desc ?? null,
        categoryId: input.category_id,
        basePrice: input.base_price,
        currency: input.currency,
        sourceCountry: 'China',
        stockType: input.stock_type,
        approvalStatus: ProductApprovalStatus.APPROVED,
        isPublished: true,
        sku: input.sku ?? null,
        weight: input.weight ?? null,
        isFeatured: input.is_featured,
        ...inventoryFields,
        ...(imageUrls
          ? {
              images: {
                create: imageUrls.map((url, index) => ({
                  url,
                  alt: input.name,
                  sortOrder: index,
                  isPrimary: index === 0,
                })),
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
    const imageUrls = normalizeProductImageUrls(input);
    const product = await prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.slug !== undefined ? { slug: input.slug } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.short_desc !== undefined ? { shortDesc: input.short_desc ?? null } : {}),
          ...(input.category_id !== undefined ? { categoryId: input.category_id } : {}),
          ...(input.base_price !== undefined ? { basePrice: input.base_price } : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.stock_type !== undefined ? { stockType: input.stock_type } : {}),
          ...(input.sku !== undefined ? { sku: input.sku ?? null } : {}),
          ...(input.weight !== undefined ? { weight: input.weight ?? null } : {}),
          ...(input.is_featured !== undefined ? { isFeatured: input.is_featured } : {}),
          ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
          ...normalizeInventoryFields(input),
        },
        select: { id: true, name: true },
      });

      if (imageUrls) {
        await tx.productImage.deleteMany({ where: { productId } });
        await tx.productImage.createMany({
          data: imageUrls.map((url, index) => ({
            productId,
            url,
            alt: input.name ?? updatedProduct.name,
            sortOrder: index,
            isPrimary: index === 0,
          })),
        });
      }

      return tx.product.findUniqueOrThrow({
        where: { id: productId },
        select: ADMIN_PRODUCT_SELECT,
      });
    });

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
  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0] ?? null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    categoryId: product.categoryId,
    categoryName: product.category.name,
    basePrice: Number(product.basePrice),
    currency: product.currency,
    sourceCountry: product.sourceCountry,
    stockType: product.stockType,
    approvalStatus: product.approvalStatus,
    isPublished: product.isPublished,
    isFeatured: product.isFeatured,
    isActive: product.isActive,
    inventoryQuantity: product.inventoryQuantity,
    preorderSlotsTotal: product.preorderSlotsTotal,
    preorderSlotsRemaining: product.preorderSlotsRemaining,
    preorderStartsAt: product.preorderStartsAt?.toISOString() ?? null,
    preorderEndsAt: product.preorderEndsAt?.toISOString() ?? null,
    estimatedArrivalAt: product.estimatedArrivalAt?.toISOString() ?? null,
    trendingScore: Number(product.trendingScore),
    primaryImage,
    images: product.images,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

function normalizeInventoryFields(
  input: AdminCreateProductInput | AdminUpdateProductInput,
): NormalizedInventoryFields {
  const inventoryQuantity = input.inventory_quantity ?? input.inventoryQuantity;
  const preorderSlotsTotal = input.preorder_slots_total ?? input.preorderSlotsTotal;
  const preorderSlotsRemaining = input.preorder_slots_remaining ?? input.preorderSlotsRemaining;
  const preorderStartsAt = input.preorder_starts_at ?? input.preorderStartsAt;
  const preorderEndsAt = input.preorder_ends_at ?? input.preorderEndsAt;
  const estimatedArrivalAt = input.estimated_arrival_at ?? input.estimatedArrivalAt;

  return {
    ...(inventoryQuantity !== undefined ? { inventoryQuantity } : {}),
    ...(preorderSlotsTotal !== undefined ? { preorderSlotsTotal } : {}),
    ...(preorderSlotsRemaining !== undefined ? { preorderSlotsRemaining } : {}),
    ...(preorderStartsAt !== undefined ? { preorderStartsAt: new Date(preorderStartsAt) } : {}),
    ...(preorderEndsAt !== undefined ? { preorderEndsAt: new Date(preorderEndsAt) } : {}),
    ...(estimatedArrivalAt !== undefined ? { estimatedArrivalAt: new Date(estimatedArrivalAt) } : {}),
  };
}

function normalizeProductImageUrls(
  input: Pick<AdminCreateProductInput, 'image_url' | 'images'>,
): string[] | undefined {
  if (input.images && input.images.length > 0) {
    return input.images;
  }

  if (input.image_url) {
    return [input.image_url];
  }

  return undefined;
}

export const adminProductRepository = new AdminProductRepository();
