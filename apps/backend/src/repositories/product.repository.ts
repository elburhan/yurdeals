// ============================================
// Product Repository
// ============================================

import { Prisma, StockType } from '@prisma/client';
import {
  ProductDetail,
  ProductImageSummary,
  ProductListItem,
  ProductVariantSummary,
} from '@yurdeals/shared';
import { prisma } from '../config';
import { ProductQueryInput } from '../schemas/catalog.schema';
import { getPagination } from '../utils/pagination';

const PRODUCT_LIST_SELECT = Prisma.validator<Prisma.ProductSelect>()({
  id: true,
  name: true,
  slug: true,
  shortDesc: true,
  basePrice: true,
  currency: true,
  stockType: true,
  isFeatured: true,
  createdAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
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
});

const PRODUCT_DETAIL_SELECT = Prisma.validator<Prisma.ProductSelect>()({
  ...PRODUCT_LIST_SELECT,
  description: true,
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
    const fullTextProductIds = query.search
      ? await findProductIdsByFullTextSearch(query.search)
      : undefined;
    const where = buildPublicProductWhere(query, fullTextProductIds);
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

  async findFeaturedProducts(limit: number): Promise<ProductListItem[]> {
    const records = await prisma.product.findMany({
      where: {
        isActive: true,
        isFeatured: true,
        category: { isActive: true },
      },
      select: PRODUCT_LIST_SELECT,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });

    return records.map(mapProductListItem);
  }

  async findPreorderProducts(limit: number): Promise<ProductListItem[]> {
    const records = await prisma.product.findMany({
      where: {
        isActive: true,
        stockType: StockType.PREORDER,
        category: { isActive: true },
      },
      select: PRODUCT_LIST_SELECT,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });

    return records.map(mapProductListItem);
  }

  async findPublicProductById(id: string): Promise<ProductDetail | null> {
    const record = await prisma.product.findFirst({
      where: {
        id,
        isActive: true,
        category: { isActive: true },
      },
      select: PRODUCT_DETAIL_SELECT,
    });

    return record ? mapProductDetail(record) : null;
  }
}

function buildPublicProductWhere(
  query: ProductQueryInput,
  fullTextProductIds?: string[],
): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [
    {
      isActive: true,
      category: { isActive: true },
    },
  ];

  if (query.category_id) {
    and.push({ categoryId: query.category_id });
  }

  if (query.preorder !== undefined) {
    and.push({
      stockType: query.preorder ? StockType.PREORDER : StockType.LOCAL,
    });
  }

  if (query.available_in_nigeria) {
    and.push({
      stockType: StockType.LOCAL,
      variants: {
        some: {
          isActive: true,
          stock: { gt: 0 },
        },
      },
    });
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
    case 'price_asc':
      return [{ basePrice: 'asc' }, { createdAt: 'desc' }];
    case 'price_desc':
      return [{ basePrice: 'desc' }, { createdAt: 'desc' }];
    case 'featured':
      return [{ isFeatured: 'desc' }, { createdAt: 'desc' }];
    case 'name_asc':
      return [{ name: 'asc' }, { createdAt: 'desc' }];
    case 'newest':
    default:
      return [{ createdAt: 'desc' }];
  }
}

async function findProductIdsByFullTextSearch(search: string): Promise<string[]> {
  const sanitizedSearch = toFullTextSearchText(search);

  if (!sanitizedSearch) {
    return [];
  }

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "products"
    WHERE to_tsvector('simple', "name") @@ plainto_tsquery('simple', ${sanitizedSearch})
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
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    shortDesc: record.shortDesc,
    basePrice: Number(record.basePrice),
    currency: record.currency,
    stockType: record.stockType,
    isFeatured: record.isFeatured,
    primaryImage: record.images[0] ?? null,
    category: record.category,
    createdAt: record.createdAt.toISOString(),
  };
}

function mapProductDetail(record: ProductDetailRecord): ProductDetail {
  return {
    ...mapProductListItem(record),
    description: record.description,
    images: record.images.map(mapProductImage),
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
  };
}

function mapProductImage(image: ProductImageSummary): ProductImageSummary {
  return image;
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
  };
}

export const productRepository = new ProductRepository();
