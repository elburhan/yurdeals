// ============================================
// Shared Type Definitions — YurDeals
// ============================================

/** Standard API success response */
export interface ApiResponse<T> {
  success: true;
  data: T;
  message: string;
  meta?: PaginationMeta;
}

/** Standard API error response */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
}

/** Pagination metadata */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Pagination query parameters */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** Health check response shape */
export interface HealthCheckData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  database: 'connected' | 'disconnected';
}

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  sortOrder: number;
}

export interface ProductImageSummary {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductVariantSummary {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  attributes: unknown;
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  shortDesc: string | null;
  basePrice: number;
  currency: string;
  stockType: 'LOCAL' | 'PREORDER';
  isFeatured: boolean;
  primaryImage: ProductImageSummary | null;
  category: Pick<CategorySummary, 'id' | 'name' | 'slug'>;
  createdAt: string;
}

export interface ProductDetail extends ProductListItem {
  description: string;
  images: ProductImageSummary[];
  variants: ProductVariantSummary[];
  preorderCampaigns: PreorderCampaignSummary[];
}

export interface PreorderCampaignSummary {
  id: string;
  title: string;
  description: string | null;
  targetQty: number;
  currentQty: number;
  pricePerUnit: number;
  status: string;
  startsAt: string;
  endsAt: string;
}

export interface ProductCatalogFilters {
  category_id?: string;
  search?: string;
  preorder?: boolean;
  available_in_nigeria?: boolean;
  min_price?: number;
  max_price?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'featured' | 'name_asc';
  page?: number;
  limit?: number;
}

export interface ProductListData {
  products: ProductListItem[];
}

export interface CategoryListData {
  categories: CategorySummary[];
}

export interface HomeCatalogData {
  categories: CategorySummary[];
  featuredProducts: ProductListItem[];
  preorderProducts: ProductListItem[];
}

export interface CartProductSummary {
  id: string;
  name: string;
  slug: string;
  stockType: 'LOCAL' | 'PREORDER';
  currency: string;
  primaryImage: ProductImageSummary | null;
}

export interface CartVariantSummary {
  id: string;
  name: string;
  sku: string;
  stock: number;
  price: number;
}

export interface CartItemSummary {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  priceSnapshot: number;
  lineTotal: number;
  currency: string;
  product: CartProductSummary;
  variant: CartVariantSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface CartSummary {
  itemCount: number;
  subtotal: number;
  currency: string;
}

export interface CartData {
  cart: {
    id: string;
    items: CartItemSummary[];
    summary: CartSummary;
    createdAt: string;
    updatedAt: string;
  };
}

export interface AddressSummary {
  id: string;
  label: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddressListData {
  addresses: AddressSummary[];
}

export interface OrderItemSummary {
  id: string;
  productId: string;
  variantId: string | null;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  shippingFee: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  itemCount: number;
  shippingAddress: AddressSummary | null;
  items: OrderItemSummary[];
  createdAt: string;
}

export interface OrderCreationData {
  order: OrderSummary;
  guestAccessToken?: string;
}

export interface OrderListData {
  orders: OrderSummary[];
}

export interface OrderDetailData {
  order: OrderSummary;
}

export interface PaymentSummary {
  id: string;
  orderId: string;
  provider: 'PAYSTACK' | 'FLUTTERWAVE' | 'BANK_TRANSFER';
  providerRef: string | null;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentInitiationData {
  payment: PaymentSummary;
  authorizationUrl: string;
  reference: string;
}

export interface PaymentStatusData {
  payment: PaymentSummary;
}

export interface NotificationSummary {
  id: string;
  type: string;
  title: string;
  message: string;
  data: unknown;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListData {
  notifications: NotificationSummary[];
}

export interface TrackingTimelineEvent {
  status: string;
  label: string;
  description: string;
  timestamp: string;
  location: string | null;
  completed: boolean;
}

export interface OrderTrackingData {
  currentStatus: string;
  eta: string | null;
  timeline: TrackingTimelineEvent[];
}

export interface AdminProductSummary {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  categoryName: string;
  basePrice: number;
  currency: string;
  stockType: 'LOCAL' | 'PREORDER';
  isFeatured: boolean;
  isActive: boolean;
  primaryImage: ProductImageSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProductListData {
  products: AdminProductSummary[];
}

export interface AdminOrderListItem {
  id: string;
  orderNumber: string;
  checkoutMethod: 'ONLINE' | 'WHATSAPP';
  customerType: 'REGISTERED' | 'GUEST';
  status: string;
  total: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderListData {
  orders: AdminOrderListItem[];
}

export interface AdminOrderDetailData {
  order: OrderSummary & {
    customer: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
    };
    payments: PaymentSummary[];
  };
}

export interface ShipmentSummary {
  id: string;
  orderId: string;
  orderNumber: string;
  status: string;
  trackingNumber: string | null;
  carrier: string | null;
  customerName: string;
  customerPhone: string | null;
  address: AddressSummary | null;
  total: number;
  currency: string;
  estimatedAt: string | null;
  deliveredAt: string | null;
  updatedAt: string;
}

export interface AdminShipmentListData {
  shipments: ShipmentSummary[];
}

export interface StaffLastMileData {
  shipments: ShipmentSummary[];
}

export interface AdminOverviewData {
  orders: {
    total: number;
    pending: number;
    confirmed: number;
    inTransit: number;
    delivered: number;
  };
  shipments: {
    total: number;
    inWarehouse: number;
    localDelivery: number;
    delivered: number;
  };
  products: {
    total: number;
    active: number;
  };
}
