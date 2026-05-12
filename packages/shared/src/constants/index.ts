export const UserRole = {
  CUSTOMER: 'CUSTOMER',
  STAFF: 'STAFF',
  ADMIN: 'ADMIN',
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

export const OrderStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  PROCESSING: 'PROCESSING',
  INSPECTION_PENDING: 'INSPECTION_PENDING',
  INSPECTION_PASSED: 'INSPECTION_PASSED',
  SHIPPED: 'SHIPPED',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus];

export const InspectionStatus = {
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
} as const;

export type InspectionStatusType = (typeof InspectionStatus)[keyof typeof InspectionStatus];

export const PaymentStatus = {
  PENDING: 'PENDING',
  AUTHORIZED: 'AUTHORIZED',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  ABANDONED: 'ABANDONED',
  REFUNDED: 'REFUNDED',
} as const;

export type PaymentStatusType = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentProvider = {
  PAYSTACK: 'PAYSTACK',
  FLUTTERWAVE: 'FLUTTERWAVE',
  BANK_TRANSFER: 'BANK_TRANSFER',
} as const;

export type PaymentProviderType = (typeof PaymentProvider)[keyof typeof PaymentProvider];

export const ShipmentStatus = {
  PENDING: 'PENDING',
  PICKED_UP: 'PICKED_UP',
  IN_WAREHOUSE: 'IN_WAREHOUSE',
  SHIPPED: 'SHIPPED',
  IN_TRANSIT: 'IN_TRANSIT',
  CUSTOMS_CLEARANCE: 'CUSTOMS_CLEARANCE',
  LOCAL_DELIVERY: 'LOCAL_DELIVERY',
  DELIVERED: 'DELIVERED',
} as const;

export type ShipmentStatusType = (typeof ShipmentStatus)[keyof typeof ShipmentStatus];

export const CampaignStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  FUNDED: 'FUNDED',
  ORDERED: 'ORDERED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;

export type CampaignStatusType = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export const ProductStockType = {
  IN_STOCK: 'IN_STOCK',
  PREORDER: 'PREORDER',
} as const;

export type ProductStockTypeType =
  (typeof ProductStockType)[keyof typeof ProductStockType];

export const ProductApprovalStatus = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type ProductApprovalStatusType =
  (typeof ProductApprovalStatus)[keyof typeof ProductApprovalStatus];

export const BlogPostStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type BlogPostStatusType = (typeof BlogPostStatus)[keyof typeof BlogPostStatus];

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
} as const;
