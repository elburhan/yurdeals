// ============================================
// Catalog Service
// ============================================

import {
  CategoryDetailData,
  CategoryListData,
  CategorySummary,
  CategoryTreeNode,
  HomeCatalogData,
  ProductDetailData,
  ProductListData,
} from '@yurdeals/shared';
import { AppError } from '../middleware/errorHandler';
import { categoryRepository } from '../repositories/category.repository';
import { productRepository } from '../repositories/product.repository';
import {
  CategoryQueryInput,
  ProductCollectionQueryInput,
  ProductQueryInput,
} from '../schemas/catalog.schema';
import { getPaginationMeta } from '../utils/pagination';

export async function listCategories(query: CategoryQueryInput): Promise<CategoryListData> {
  const flat = await categoryRepository.findPublicCategories({
    activeOnly: query.active !== false,
    parentId: query.parent_id,
  });

  const tree = buildCategoryTree(flat);

  return {
    categories: flat,
    flat,
    tree,
  };
}

export async function getCategoryDetail(slugOrId: string): Promise<CategoryDetailData> {
  const [flat, category] = await Promise.all([
    categoryRepository.findPublicCategories({ activeOnly: true }),
    categoryRepository.findPublicCategoryBySlugOrId(slugOrId, true),
  ]);

  if (!category) {
    throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND');
  }

  const tree = buildCategoryTree(flat);
  const node = findTreeNode(tree, category.id);

  return {
    category: {
      ...category,
      productCount: node ? sumCategoryTreeCount(node) : category.productCount,
    },
  };
}

export async function listProducts(query: ProductQueryInput): Promise<{
  data: ProductListData;
  meta: ReturnType<typeof getPaginationMeta>;
}> {
  const result = await productRepository.findPublicProducts(query);

  return {
    data: { products: result.products },
    meta: getPaginationMeta(query, result.total),
  };
}

export async function getTrendingProducts(
  query: ProductCollectionQueryInput,
): Promise<ProductListData> {
  const products = await productRepository.findTrendingProducts(query.limit);
  return { products };
}

export async function getFeaturedProducts(
  query: ProductCollectionQueryInput,
): Promise<ProductListData> {
  const products = await productRepository.findFeaturedProducts(query.limit);
  return { products };
}

export async function getProductDetail(slugOrId: string): Promise<ProductDetailData> {
  const product = await productRepository.findPublicProductBySlugOrId(slugOrId);

  if (!product) {
    throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
  }

  const relatedProducts = await productRepository.findRelatedPublicProducts(
    product.id,
    product.category.id,
    4,
  );

  return { product, relatedProducts };
}

export async function getHomeCatalog(): Promise<HomeCatalogData> {
  const [categories, featuredProducts, preorderProducts, latestProducts] = await Promise.all([
    categoryRepository.findPublicCategories({ activeOnly: true }),
    productRepository.findFeaturedProducts(8),
    productRepository.findPreorderProducts(6),
    productRepository.findLatestPublicProducts(8),
  ]);

  return {
    categories,
    featuredProducts: featuredProducts.length > 0 ? featuredProducts : latestProducts,
    preorderProducts,
  };
}

function buildCategoryTree(categories: CategorySummary[]): CategoryTreeNode[] {
  const byId = new Map<string, CategoryTreeNode>();

  categories.forEach((category) => {
    byId.set(category.id, {
      ...category,
      children: [],
    });
  });

  const roots: CategoryTreeNode[] = [];

  categories.forEach((category) => {
    const node = byId.get(category.id);
    if (!node) {
      return;
    }

    if (category.parentId) {
      const parent = byId.get(category.parentId);
      if (parent) {
        parent.children.push(node);
        return;
      }
    }

    roots.push(node);
  });

  const sortNodes = (nodes: CategoryTreeNode[]) => {
    nodes.sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.name.localeCompare(right.name);
    });

    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);
  return roots;
}

function findTreeNode(nodes: CategoryTreeNode[], categoryId: string): CategoryTreeNode | null {
  for (const node of nodes) {
    if (node.id === categoryId) {
      return node;
    }

    const childMatch = findTreeNode(node.children, categoryId);
    if (childMatch) {
      return childMatch;
    }
  }

  return null;
}

function sumCategoryTreeCount(node: CategoryTreeNode): number {
  return (node.productCount ?? 0) + node.children.reduce((sum, child) => sum + sumCategoryTreeCount(child), 0);
}
