// ============================================
// Catalog Service
// ============================================

import {
  CategoryListData,
  HomeCatalogData,
  ProductDetail,
  ProductListData,
} from '@yurdeals/shared';
import { categoryRepository } from '../repositories/category.repository';
import { productRepository } from '../repositories/product.repository';
import { CategoryQueryInput, ProductQueryInput } from '../schemas/catalog.schema';
import { getPaginationMeta } from '../utils/pagination';
import { AppError } from '../middleware/errorHandler';

export async function listCategories(query: CategoryQueryInput): Promise<CategoryListData> {
  const categories = await categoryRepository.findPublicCategories(query.parent_id);
  return { categories };
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

export async function getProductDetail(productId: string): Promise<{ product: ProductDetail }> {
  const product = await productRepository.findPublicProductById(productId);

  if (!product) {
    throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
  }

  return { product };
}

export async function getHomeCatalog(): Promise<HomeCatalogData> {
  const [categories, featuredProducts, preorderProducts] = await Promise.all([
    categoryRepository.findPublicCategories(),
    productRepository.findFeaturedProducts(8),
    productRepository.findPreorderProducts(6),
  ]);

  return {
    categories,
    featuredProducts,
    preorderProducts,
  };
}
