// ============================================
// Category Repository
// ============================================

import { CategorySummary } from '@yurdeals/shared';
import { prisma } from '../config';

const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  image: true,
  parentId: true,
  sortOrder: true,
} as const;

export class CategoryRepository {
  async findPublicCategories(parentId?: string): Promise<CategorySummary[]> {
    return prisma.category.findMany({
      where: {
        isActive: true,
        ...(parentId ? { parentId } : {}),
      },
      select: CATEGORY_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }
}

export const categoryRepository = new CategoryRepository();
