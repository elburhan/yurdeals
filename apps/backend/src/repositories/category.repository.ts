// ============================================
// Category Repository
// ============================================

import { Prisma } from '@prisma/client';
import { CategoryDetail, CategorySummary } from '@yurdeals/shared';
import { prisma } from '../config';

const PUBLIC_PRODUCT_WHERE = {
  isActive: true,
  isPublished: true,
  approvalStatus: 'APPROVED',
} satisfies Prisma.ProductWhereInput;

const CATEGORY_SELECT = Prisma.validator<Prisma.CategorySelect>()({
  id: true,
  name: true,
  slug: true,
  description: true,
  image: true,
  parentId: true,
  sortOrder: true,
  _count: {
    select: {
      products: {
        where: PUBLIC_PRODUCT_WHERE,
      },
    },
  },
});

type CategoryRecord = Prisma.CategoryGetPayload<{
  select: typeof CATEGORY_SELECT;
}>;

export class CategoryRepository {
  async findPublicCategories(options?: {
    activeOnly?: boolean;
    parentId?: string;
  }): Promise<CategorySummary[]> {
    const records = await prisma.category.findMany({
      where: {
        ...(options?.activeOnly !== false ? { isActive: true } : {}),
        ...(options?.parentId ? { parentId: options.parentId } : {}),
      },
      select: CATEGORY_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return records.map(mapCategorySummary);
  }

  async findPublicCategoryBySlugOrId(
    slugOrId: string,
    activeOnly = true,
  ): Promise<CategoryDetail | null> {
    const record = await prisma.category.findFirst({
      where: {
        ...(activeOnly ? { isActive: true } : {}),
        OR: [{ slug: slugOrId }, { id: slugOrId }],
      },
      select: CATEGORY_SELECT,
    });

    return record ? mapCategoryDetail(record) : null;
  }
}

function mapCategorySummary(record: CategoryRecord): CategorySummary {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    description: record.description,
    image: record.image,
    parentId: record.parentId,
    sortOrder: record.sortOrder,
    productCount: record._count.products,
  };
}

function mapCategoryDetail(record: CategoryRecord): CategoryDetail {
  return {
    ...mapCategorySummary(record),
    productCount: record._count.products,
  };
}

export const categoryRepository = new CategoryRepository();
