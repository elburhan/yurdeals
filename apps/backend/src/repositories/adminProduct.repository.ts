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
  isSoldOut: true,
  marketingBadge: true,
  isActive: true,
  inventoryQuantity: true,
  preorderSlotsTotal: true,
  preorderSlotsRemaining: true,
  preorderStartsAt: true,
  preorderEndsAt: true,
  estimatedArrivalAt: true,
  fxAdjustmentPercent: true,
  shippingBufferPercent: true,
  preorderMarginPercent: true,
  fxRateSnapshot: true,
  supplierCostSnapshot: true,
  shippingCostSnapshot: true,
  pricingBatchLabel: true,
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
  variants: {
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      stock: true,
      attributes: true,
      isActive: true,
    },
    orderBy: { createdAt: 'asc' },
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
  fxAdjustmentPercent?: number;
  shippingBufferPercent?: number;
  preorderMarginPercent?: number;
  fxRateSnapshot?: number;
  supplierCostSnapshot?: number;
  shippingCostSnapshot?: number;
  pricingBatchLabel?: string | null;
}

interface NormalizedPreorderPricingFields {
  fxAdjustmentPercent?: number;
  shippingBufferPercent?: number;
  preorderMarginPercent?: number;
  fxRateSnapshot?: number;
  supplierCostSnapshot?: number;
  shippingCostSnapshot?: number;
  pricingBatchLabel?: string | null;
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
    const pricingFields = normalizePreorderPricingFields(input);
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
        approvalStatus: input.approval_status ?? ProductApprovalStatus.APPROVED,
        isPublished: input.is_published ?? true,
        isSoldOut: input.is_sold_out ?? input.isSoldOut ?? false,
        marketingBadge: input.marketing_badge ?? input.marketingBadge ?? null,
        sku: input.sku ?? null,
        weight: input.weight ?? null,
        isFeatured: input.is_featured,
        ...inventoryFields,
        ...pricingFields,
        ...(input.variants && input.variants.length > 0
          ? {
              variants: {
                create: input.variants.map((variant) => ({
                  name: variant.name,
                  sku: normalizeVariantSku(
                    variant.sku,
                    `${input.sku ?? input.slug ?? input.name}-${variant.name}`,
                  ),
                  price: variant.price,
                  stock: variant.stock,
                  attributes: {},
                  isActive: true,
                })),
              },
            }
          : {}),
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
          ...(input.is_published !== undefined ? { isPublished: input.is_published } : {}),
          ...(input.is_sold_out !== undefined || input.isSoldOut !== undefined
            ? { isSoldOut: input.is_sold_out ?? input.isSoldOut }
            : {}),
          ...(input.marketing_badge !== undefined || input.marketingBadge !== undefined
            ? { marketingBadge: input.marketing_badge ?? input.marketingBadge }
            : {}),
          ...(input.approval_status !== undefined ? { approvalStatus: input.approval_status } : {}),
          ...normalizeInventoryFields(input),
          ...normalizePreorderPricingFields(input),
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

      if (input.variants !== undefined) {
        await syncProductVariants(tx, productId, input.variants);
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

function normalizeVariantSku(sku: string | undefined, fallbackBase: string): string {
  if (sku?.trim()) {
    return sku.trim();
  }

  const base = fallbackBase
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${base || 'VARIANT'}-${Date.now().toString(36).toUpperCase()}`.slice(0, 80);
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
    isSoldOut: isAdminProductSoldOut(product),
    isSoldOutOverride: product.isSoldOut,
    marketingBadge: product.marketingBadge,
    isActive: product.isActive,
    inventoryQuantity: product.inventoryQuantity,
    preorderSlotsTotal: product.preorderSlotsTotal,
    preorderSlotsRemaining: product.preorderSlotsRemaining,
    preorderStartsAt: product.preorderStartsAt?.toISOString() ?? null,
    preorderEndsAt: product.preorderEndsAt?.toISOString() ?? null,
    estimatedArrivalAt: product.estimatedArrivalAt?.toISOString() ?? null,
    fxAdjustmentPercent: product.fxAdjustmentPercent ? Number(product.fxAdjustmentPercent) : null,
    shippingBufferPercent: product.shippingBufferPercent ? Number(product.shippingBufferPercent) : null,
    preorderMarginPercent: product.preorderMarginPercent ? Number(product.preorderMarginPercent) : null,
    fxRateSnapshot: product.fxRateSnapshot ? Number(product.fxRateSnapshot) : null,
    supplierCostSnapshot: product.supplierCostSnapshot ? Number(product.supplierCostSnapshot) : null,
    shippingCostSnapshot: product.shippingCostSnapshot ? Number(product.shippingCostSnapshot) : null,
    pricingBatchLabel: product.pricingBatchLabel,
    trendingScore: Number(product.trendingScore),
    primaryImage,
    images: product.images,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      price: Number(variant.price),
      stock: variant.stock,
      attributes: variant.attributes,
      isActive: variant.isActive,
    })),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

async function syncProductVariants(
  tx: Prisma.TransactionClient,
  productId: string,
  variants: NonNullable<AdminUpdateProductInput['variants']>,
): Promise<void> {
  const existingVariants = await tx.productVariant.findMany({
    where: { productId },
    select: { id: true, sku: true },
  });
  const existingIds = new Set(existingVariants.map((variant) => variant.id));
  const existingSkuById = new Map(
    existingVariants.map((variant) => [variant.id, variant.sku]),
  );
  const incomingExistingIds = variants
    .map((variant) => variant.id)
    .filter((id): id is string => typeof id === 'string' && existingIds.has(id));

  await tx.productVariant.updateMany({
    where: {
      productId,
      ...(incomingExistingIds.length > 0 ? { id: { notIn: incomingExistingIds } } : {}),
    },
    data: { isActive: false },
  });

  for (const [index, variant] of variants.entries()) {
    if (variant.id && existingIds.has(variant.id)) {
      await tx.productVariant.update({
        where: { id: variant.id },
        data: {
          name: variant.name,
          sku: variant.sku ?? existingSkuById.get(variant.id),
          price: variant.price,
          stock: variant.stock,
          isActive: true,
        },
      });
      continue;
    }

    await tx.productVariant.create({
      data: {
        productId,
        name: variant.name,
        sku: normalizeVariantSku(variant.sku, `${productId}-${variant.name}-${index + 1}`),
        price: variant.price,
        stock: variant.stock,
        attributes: {},
        isActive: true,
      },
    });
  }
}

function isAdminProductSoldOut(product: AdminProductRecord): boolean {
  if (product.isSoldOut) {
    return true;
  }

  if (product.stockType === 'PREORDER') {
    return product.preorderSlotsRemaining === 0;
  }

  if (product.variants.length > 0) {
    return product.variants.every((variant) => variant.stock <= 0);
  }

  return product.inventoryQuantity === 0;
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

function normalizePreorderPricingFields(
  input: AdminCreateProductInput | AdminUpdateProductInput,
): NormalizedPreorderPricingFields {
  const fxAdjustmentPercent = input.fx_adjustment_percent ?? input.fxAdjustmentPercent;
  const shippingBufferPercent = input.shipping_buffer_percent ?? input.shippingBufferPercent;
  const preorderMarginPercent = input.preorder_margin_percent ?? input.preorderMarginPercent;
  const fxRateSnapshot = input.fx_rate_snapshot ?? input.fxRateSnapshot;
  const supplierCostSnapshot = input.supplier_cost_snapshot ?? input.supplierCostSnapshot;
  const shippingCostSnapshot = input.shipping_cost_snapshot ?? input.shippingCostSnapshot;
  const pricingBatchLabel = input.pricing_batch_label ?? input.pricingBatchLabel;

  return {
    ...(fxAdjustmentPercent !== undefined ? { fxAdjustmentPercent } : {}),
    ...(shippingBufferPercent !== undefined ? { shippingBufferPercent } : {}),
    ...(preorderMarginPercent !== undefined ? { preorderMarginPercent } : {}),
    ...(fxRateSnapshot !== undefined ? { fxRateSnapshot } : {}),
    ...(supplierCostSnapshot !== undefined ? { supplierCostSnapshot } : {}),
    ...(shippingCostSnapshot !== undefined ? { shippingCostSnapshot } : {}),
    ...(pricingBatchLabel !== undefined ? { pricingBatchLabel: pricingBatchLabel || null } : {}),
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
