// ============================================
// Shared Constants — YurDeals
// ============================================

/** Supported user roles */
export const UserRole = {
  CUSTOMER: 'CUSTOMER',
  STAFF: 'STAFF',
  ADMIN: 'ADMIN',
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

/** Order status lifecycle */
export const OrderStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  IN_TRANSIT: 'IN_TRANSIT',
  CUSTOMS: 'CUSTOMS',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;

export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus];

/** Payment status */
export const PaymentStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;

export type PaymentStatusType = (typeof PaymentStatus)[keyof typeof PaymentStatus];

/** Payment provider */
export const PaymentProvider = {
  PAYSTACK: 'PAYSTACK',
  FLUTTERWAVE: 'FLUTTERWAVE',
  BANK_TRANSFER: 'BANK_TRANSFER',
} as const;

export type PaymentProviderType = (typeof PaymentProvider)[keyof typeof PaymentProvider];

/** Shipment status */
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

/** Preorder campaign status */
export const CampaignStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  FUNDED: 'FUNDED',
  ORDERED: 'ORDERED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;

export type CampaignStatusType = (typeof CampaignStatus)[keyof typeof CampaignStatus];

/** Product stock type */
export const StockType = {
  LOCAL: 'LOCAL',
  PREORDER: 'PREORDER',
} as const;

export type StockTypeType = (typeof StockType)[keyof typeof StockType];

/** Standard HTTP status codes used */
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
