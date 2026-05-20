// ============================================
// Admin Service
// ============================================

import { FraudRiskLevel, OrderStatus } from '@prisma/client';
import {
  AdminOrderDetailData,
  AdminOrderListData,
  AdminOverviewData,
  AdminProductListData,
  AdminProductSummary,
  AdminShipmentListData,
} from '@yurdeals/shared';
import { AppError } from '../middleware/errorHandler';
import { adminOrderRepository } from '../repositories/adminOrder.repository';
import { adminProductRepository } from '../repositories/adminProduct.repository';
import { shipmentRepository } from '../repositories/shipment.repository';
import {
  AdminCreateProductInput,
  AdminOrderQueryInput,
  AdminProductQueryInput,
  AdminShipmentQueryInput,
  AdminUpdateOrderRiskReviewInput,
  AdminUpdateProductInput,
} from '../schemas/admin.schema';
import { handleOrderStatusTransition } from './shipmentEvent.service';
import { AuditContext, writeAuditLog } from './audit.service';
import { assertOrderStatusAllowedWhileRiskHeld } from './fraudRisk.service';

export async function getAdminOverview(): Promise<AdminOverviewData> {
  return adminOrderRepository.getOverview();
}

export async function listAdminProducts(
  query: AdminProductQueryInput,
): Promise<{ data: AdminProductListData; total: number }> {
  const result = await adminProductRepository.findProducts(query);
  return { data: { products: result.products }, total: result.total };
}

export async function createAdminProduct(
  input: AdminCreateProductInput,
  auditContext?: AuditContext,
): Promise<{ product: AdminProductSummary }> {
  const product = await adminProductRepository.createProduct(input);
  await writeAuditLog({
    ...auditContext,
    action: 'ADMIN_PRODUCT_CREATED',
    entity: 'Product',
    entityId: product.id,
    newData: { name: product.name, slug: product.slug, price: product.basePrice },
  });
  return { product };
}

export async function updateAdminProduct(
  productId: string,
  input: AdminUpdateProductInput,
  auditContext?: AuditContext,
): Promise<{ product: AdminProductSummary }> {
  const product = await adminProductRepository.updateProduct(productId, input);
  await writeAuditLog({
    ...auditContext,
    action: 'ADMIN_PRODUCT_UPDATED',
    entity: 'Product',
    entityId: product.id,
    newData: { fields: Object.keys(input), name: product.name, slug: product.slug },
  });
  return { product };
}

export async function disableAdminProduct(
  productId: string,
  auditContext?: AuditContext,
): Promise<{ product: AdminProductSummary }> {
  const product = await adminProductRepository.disableProduct(productId);
  await writeAuditLog({
    ...auditContext,
    action: 'ADMIN_PRODUCT_DISABLED',
    entity: 'Product',
    entityId: product.id,
    newData: { name: product.name, slug: product.slug, isActive: product.isActive },
  });
  return { product };
}

export async function deleteAdminProduct(
  productId: string,
  auditContext?: AuditContext,
): Promise<{ product: AdminProductSummary }> {
  const product = await adminProductRepository.softDeleteProduct(productId);
  await writeAuditLog({
    ...auditContext,
    action: 'ADMIN_PRODUCT_SOFT_DELETED',
    entity: 'Product',
    entityId: product.id,
    oldData: { name: product.name, slug: product.slug },
    newData: { isActive: product.isActive },
  });
  return { product };
}

export async function listAdminOrders(
  query: AdminOrderQueryInput,
): Promise<{ data: AdminOrderListData; total: number }> {
  return adminOrderRepository.findOrders(query);
}

export async function getAdminOrder(orderId: string): Promise<AdminOrderDetailData> {
  const data = await adminOrderRepository.findOrder(orderId);

  if (!data) {
    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  return data;
}

export async function updateAdminOrderStatus(
  orderId: string,
  status: OrderStatus,
  auditContext?: AuditContext,
): Promise<AdminOrderDetailData> {
  const riskGate = await adminOrderRepository.findOrderRiskGate(orderId);

  if (!riskGate) {
    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  assertOrderStatusAllowedWhileRiskHeld(riskGate, status);

  const data = await adminOrderRepository.updateOrderStatus(orderId, status);
  await handleOrderStatusTransition(orderId, status);
  await writeAuditLog({
    ...auditContext,
    action: 'ADMIN_ORDER_STATUS_UPDATED',
    entity: 'Order',
    entityId: orderId,
    newData: { status, orderNumber: data.order.orderNumber },
  });
  return data;
}

export async function updateAdminOrderRiskReview(
  orderId: string,
  input: AdminUpdateOrderRiskReviewInput,
  auditContext?: AuditContext,
): Promise<AdminOrderDetailData> {
  if (!auditContext?.userId) {
    throw new AppError('Admin review requires an authenticated user', 401, 'UNAUTHORIZED');
  }

  const nextHoldForManualReview =
    typeof input.hold_for_manual_review === 'boolean' ? input.hold_for_manual_review : undefined;
  const nextFraudNotes =
    typeof input.fraud_notes === 'string' ? (input.fraud_notes.trim() || null) : undefined;
  const riskLevelOverride =
    input.risk_level_override === 'LOW' ||
    input.risk_level_override === 'MEDIUM' ||
    input.risk_level_override === 'HIGH'
      ? input.risk_level_override
      : undefined;

  const data = await adminOrderRepository.updateOrderRiskReview(orderId, {
    holdForManualReview: nextHoldForManualReview,
    fraudNotes: nextFraudNotes,
    riskLevelOverride: riskLevelOverride as FraudRiskLevel | undefined,
    reviewedByUserId: auditContext.userId,
  });

  await writeAuditLog({
    ...auditContext,
    action: 'ADMIN_ORDER_RISK_REVIEW_UPDATED',
    entity: 'Order',
    entityId: orderId,
    newData: {
      holdForManualReview: data.order.holdForManualReview,
      riskLevel: data.order.riskLevel,
      riskFlags: data.order.riskFlags,
      fraudNotes: data.order.fraudNotes,
      reviewedAt: data.order.riskReviewedAt,
    },
  });

  return data;
}

export async function listAdminShipments(
  query: AdminShipmentQueryInput,
): Promise<{ data: AdminShipmentListData; total: number }> {
  const result = await shipmentRepository.findAdminShipments(query);
  return { data: { shipments: result.shipments }, total: result.total };
}
