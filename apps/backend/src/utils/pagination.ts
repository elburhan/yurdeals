// ============================================
// Pagination Helpers
// ============================================

import { PaginationMeta } from '@yurdeals/shared';

export interface PaginationInput {
  page: number;
  limit: number;
}

export interface PaginationResult {
  skip: number;
  take: number;
}

export function getPagination(input: PaginationInput): PaginationResult {
  return {
    skip: (input.page - 1) * input.limit,
    take: input.limit,
  };
}

export function getPaginationMeta(input: PaginationInput, total: number): PaginationMeta {
  return {
    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.ceil(total / input.limit),
  };
}
