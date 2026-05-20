// ============================================
// Product Repository
// ============================================

import { Prisma, ProductApprovalStatus, ProductStockType } from '@prisma/client';
import { ProductDetail, ProductListItem, ProductVariantSummary } from '@yurdeals/shared';
import { prisma } from '../config';
import { ProductQueryInput } from '../schemas/catalog.schema';
import { getPagination } from '../utils/pagination';

const PUBLIC_PRODUCT_BASE_WHERE = {
  isActive: true,
  isPublished: true,
  approvalStatus: ProductApprovalStatus.APPROVED,
  category: {
    isActive: true,
  },
} satisfies Prisma.ProductWhereInput;

const PRODUCT_LIST_SELECT = Prisma.validator<Prisma.ProductSelect>()({
  id: true,
  name: true,
  slug: true,
  shortDesc: true,
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
  pricingBatchLabel: true,
  trendingScore: true,
  salesVelocity7d: true,
  salesVelocity30d: true,
  unitsSoldTotal: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
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
      stock: true,
      isActive: true,
    },
  },
});

const PRODUCT_DETAIL_SELECT = Prisma.validator<Prisma.ProductSelect>()({
  ...PRODUCT_LIST_SELECT,
  description: true,
  metaTitle: true,
  metaDescription: true,
  tags: true,
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
  preorderCampaigns: {
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      title: true,
      description: true,
      targetQty: true,
      currentQty: true,
      pricePerUnit: true,
      status: true,
      startsAt: true,
      endsAt: true,
    },
    orderBy: { endsAt: 'asc' },
  },
});

type ProductListRecord = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_LIST_SELECT;
}>;

type ProductDetailRecord = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_DETAIL_SELECT;
}>;

export interface ProductPageResult {
  products: ProductListItem[];
  total: number;
}

export class ProductRepository {
  async findPublicProducts(query: ProductQueryInput): Promise<ProductPageResult> {
    const [categoryIds, fullTextProductIds] = await Promise.all([
      resolveCategoryIds(query.category, query.category_id),
      query.search ? findProductIdsByFullTextSearch(query.search) : Promise.resolve(undefined),
    ]);

    const where = buildPublicProductWhere(query, categoryIds, fullTextProductIds);
    const orderBy = buildProductOrderBy(query.sort);
    const { skip, take } = getPagination(query);

    const [records, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        select: PRODUCT_LIST_SELECT,
        orderBy,
        skip,
        take,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      products: records.map(mapProductListItem),
      total,
    };
  }

  async findTrendingProducts(limit: number): Promise<ProductListItem[]> {
    const records = await prisma.product.findMany({
      where: PUBLIC_PRODUCT_BASE_WHERE,
      select: PRODUCT_LIST_SELECT,
      orderBy: [
        { trendingScore: 'desc' },
        { salesVelocity7d: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    return records.map(mapProductListItem);
  }

  async findFeaturedProducts(limit: number): Promise<ProductListItem[]> {
    const records = await prisma.product.findMany({
      where: {
        ...PUBLIC_PRODUCT_BASE_WHERE,
        isFeatured: true,
      },
      select: PRODUCT_LIST_SELECT,
      orderBy: [
        { trendingScore: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    return records.map(mapProductListItem);
  }

  async findLatestPublicProducts(limit: number): Promise<ProductListItem[]> {
    const records = await prisma.product.findMany({
      where: PUBLIC_PRODUCT_BASE_WHERE,
      select: PRODUCT_LIST_SELECT,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });

    return records.map(mapProductListItem);
  }

  async findPreorderProducts(limit: number): Promise<ProductListItem[]> {
    const records = await prisma.product.findMany({
      where: {
        ...PUBLIC_PRODUCT_BASE_WHERE,
        stockType: ProductStockType.PREORDER,
      },
      select: PRODUCT_LIST_SELECT,
      orderBy: [
        { preorderEndsAt: 'asc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    return records.map(mapProductListItem);
  }

  async findPublicProductBySlugOrId(slugOrId: string): Promise<ProductDetail | null> {
    const record = await prisma.product.findFirst({
      where: {
        ...PUBLIC_PRODUCT_BASE_WHERE,
        OR: [{ slug: slugOrId }, { id: slugOrId }],
      },
      select: PRODUCT_DETAIL_SELECT,
    });

    return record ? mapProductDetail(record) : null;
  }

  async findRelatedPublicProducts(
    currentProductId: string,
    categoryId: string,
    limit: number,
  ): Promise<ProductListItem[]> {
    const records = await prisma.product.findMany({
      where: {
        ...PUBLIC_PRODUCT_BASE_WHERE,
        id: { not: currentProductId },
        categoryId,
      },
      select: PRODUCT_LIST_SELECT,
      orderBy: [
        { trendingScore: 'desc' },
        { salesVelocity7d: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    return records.map(mapProductListItem);
  }
}

function buildPublicProductWhere(
  query: ProductQueryInput,
  categoryIds?: string[],
  fullTextProductIds?: string[],
): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [PUBLIC_PRODUCT_BASE_WHERE];

  if (categoryIds && categoryIds.length > 0) {
    and.push({ categoryId: { in: categoryIds } });
  }

  const stockType = query.stockType ?? (query.preorder === undefined
    ? undefined
    : query.preorder
      ? ProductStockType.PREORDER
      : ProductStockType.IN_STOCK);

  if (stockType) {
    and.push({ stockType });
  }

  if (query.available_in_nigeria) {
    and.push({
      stockType: ProductStockType.IN_STOCK,
      variants: {
        some: {
          isActive: true,
          stock: { gt: 0 },
        },
      },
    });
  }

  if (query.isFeatured !== undefined) {
    and.push({ isFeatured: query.isFeatured });
  }

  if (query.isPublished !== undefined) {
    and.push({ isPublished: query.isPublished });
  }

  if (query.min_price !== undefined || query.max_price !== undefined) {
    and.push({
      basePrice: {
        ...(query.min_price !== undefined ? { gte: query.min_price } : {}),
        ...(query.max_price !== undefined ? { lte: query.max_price } : {}),
      },
    });
  }

  if (fullTextProductIds) {
    and.push({
      id: {
        in: fullTextProductIds.length > 0 ? fullTextProductIds : ['__no_match__'],
      },
    });
  }

  return { AND: and };
}

function buildProductOrderBy(
  sort: ProductQueryInput['sort'],
): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'price':
    case 'price_asc':
      return [{ basePrice: 'asc' }, { createdAt: 'desc' }];
    case 'price_desc':
      return [{ basePrice: 'desc' }, { createdAt: 'desc' }];
    case 'featured':
      return [{ isFeatured: 'desc' }, { trendingScore: 'desc' }, { createdAt: 'desc' }];
    case 'name_asc':
      return [{ name: 'asc' }, { createdAt: 'desc' }];
    case 'trending':
      return [{ trendingScore: 'desc' }, { salesVelocity7d: 'desc' }, { createdAt: 'desc' }];
    case 'newest':
    default:
      return [{ createdAt: 'desc' }];
  }
}

async function resolveCategoryIds(
  category?: string,
  categoryId?: string,
): Promise<string[] | undefined> {
  const identifier = category?.trim() || categoryId;

  if (!identifier || identifier.toLowerCase() === 'all') {
    return undefined;
  }

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: {
      id: true,
      slug: true,
      parentId: true,
    },
  });

  const root = categories.find((item) => item.id === identifier || item.slug === identifier);
  if (!root) {
    return ['__no_match__'];
  }

  const descendantIds = new Set<string>([root.id]);
  const queue = [root.id];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    categories
      .filter((item) => item.parentId === current)
      .forEach((child) => {
        if (!descendantIds.has(child.id)) {
          descendantIds.add(child.id);
          queue.push(child.id);
        }
      });
  }

  return [...descendantIds];
}

async function findProductIdsByFullTextSearch(search: string): Promise<string[]> {
  const sanitizedSearch = toFullTextSearchText(search);

  if (!sanitizedSearch) {
    return [];
  }

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "products"
    WHERE to_tsvector(
      'simple',
      concat_ws(
        ' ',
        coalesce("name", ''),
        coalesce("short_desc", ''),
        coalesce(array_to_string("tags", ' '), '')
      )
    ) @@ plainto_tsquery('simple', ${sanitizedSearch})
  `;

  return rows.map((row) => row.id);
}

function toFullTextSearchText(search: string): string {
  return search
    .trim()
    .split(/\s+/)
    .map((term) => term.replace(/[^a-zA-Z0-9]/g, ''))
    .filter((term) => term.length > 0)
    .join(' ');
}

function mapProductListItem(record: ProductListRecord): ProductListItem {
  const primaryImage = record.images.find((image) => image.isPrimary) ?? record.images[0] ?? null;

  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    shortDesc: record.shortDesc,
    basePrice: Number(record.basePrice),
    currency: record.currency,
    sourceCountry: record.sourceCountry,
    stockType: record.stockType,
    approvalStatus: record.approvalStatus,
    isPublished: record.isPublished,
    isFeatured: record.isFeatured,
    isSoldOut: isProductSoldOut(record),
    isSoldOutOverride: record.isSoldOut,
    marketingBadge: record.marketingBadge,
    isActive: record.isActive,
    inventoryQuantity: record.inventoryQuantity,
    preorderSlotsTotal: record.preorderSlotsTotal,
    preorderSlotsRemaining: record.preorderSlotsRemaining,
    preorderStartsAt: record.preorderStartsAt?.toISOString() ?? null,
    preorderEndsAt: record.preorderEndsAt?.toISOString() ?? null,
    estimatedArrivalAt: record.estimatedArrivalAt?.toISOString() ?? null,
    pricingBatchLabel: record.pricingBatchLabel,
    trendingScore: Number(record.trendingScore),
    salesVelocity7d: record.salesVelocity7d,
    salesVelocity30d: record.salesVelocity30d,
    unitsSoldTotal: record.unitsSoldTotal,
    primaryImage,
    category: record.category,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function isProductSoldOut(record: Pick<
  ProductListRecord,
  'isSoldOut' | 'stockType' | 'inventoryQuantity' | 'preorderSlotsRemaining' | 'variants'
>): boolean {
  if (record.isSoldOut) {
    return true;
  }

  if (record.stockType === ProductStockType.PREORDER) {
    return record.preorderSlotsRemaining === 0;
  }

  if (record.variants.length > 0) {
    return record.variants.every((variant) => variant.stock <= 0);
  }

  return record.inventoryQuantity === 0;
}

function mapProductDetail(record: ProductDetailRecord): ProductDetail {
  return {
    ...mapProductListItem(record),
    description: record.description,
    images: record.images,
    variants: record.variants.map(mapProductVariant),
    preorderCampaigns: record.preorderCampaigns.map((campaign) => ({
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      targetQty: campaign.targetQty,
      currentQty: campaign.currentQty,
      pricePerUnit: Number(campaign.pricePerUnit),
      status: campaign.status,
      startsAt: campaign.startsAt.toISOString(),
      endsAt: campaign.endsAt.toISOString(),
    })),
    metaTitle: record.metaTitle,
    metaDescription: record.metaDescription,
    tags: record.tags,
  };
}

function mapProductVariant(
  variant: ProductDetailRecord['variants'][number],
): ProductVariantSummary {
  return {
    id: variant.id,
    name: variant.name,
    sku: variant.sku,
    price: Number(variant.price),
    stock: variant.stock,
    attributes: variant.attributes,
    isActive: variant.isActive,
  };
}

export const productRepository = new ProductRepository();
