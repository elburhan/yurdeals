export interface ApiResponse<T> {
  success: true;
  data: T;
  message: string;
  meta?: PaginationMeta;
}

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

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface HealthCheckData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  database: 'connected' | 'disconnected';
  environment?: string;
}

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  sortOrder: number;
  productCount?: number;
}

export interface CategoryTreeNode extends CategorySummary {
  children: CategoryTreeNode[];
}

export interface CategoryDetail extends CategorySummary {
  productCount: number;
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
  isActive?: boolean;
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

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  shortDesc: string | null;
  basePrice: number;
  currency: string;
  sourceCountry: string;
  stockType: 'IN_STOCK' | 'PREORDER';
  approvalStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  isPublished: boolean;
  isFeatured: boolean;
  isSoldOut: boolean;
  isSoldOutOverride?: boolean;
  marketingBadge: 'SELLING_FAST' | 'TRENDING' | null;
  isActive?: boolean;
  inventoryQuantity: number | null;
  preorderSlotsTotal: number | null;
  preorderSlotsRemaining: number | null;
  preorderStartsAt: string | null;
  preorderEndsAt: string | null;
  estimatedArrivalAt: string | null;
  pricingBatchLabel: string | null;
  trendingScore: number;
  salesVelocity7d: number;
  salesVelocity30d: number;
  unitsSoldTotal: number;
  primaryImage: ProductImageSummary | null;
  category: Pick<CategorySummary, 'id' | 'name' | 'slug'>;
  createdAt: string;
  updatedAt?: string;
}

export interface ProductDetail extends ProductListItem {
  description: string;
  images: ProductImageSummary[];
  variants: ProductVariantSummary[];
  preorderCampaigns: PreorderCampaignSummary[];
  metaTitle?: string | null;
  metaDescription?: string | null;
  tags?: string[];
}

export interface ProductDetailData {
  product: ProductDetail;
  relatedProducts: ProductListItem[];
}

export interface ProductCatalogFilters {
  category?: string;
  category_id?: string;
  search?: string;
  stockType?: 'IN_STOCK' | 'PREORDER';
  preorder?: boolean;
  available_in_nigeria?: boolean;
  isFeatured?: boolean;
  isPublished?: boolean;
  min_price?: number;
  max_price?: number;
  sort?: 'newest' | 'price' | 'price_asc' | 'price_desc' | 'featured' | 'name_asc' | 'trending';
  page?: number;
  limit?: number;
}

export interface ProductListData {
  products: ProductListItem[];
}

export interface CategoryListData {
  categories: CategorySummary[];
  flat: CategorySummary[];
  tree: CategoryTreeNode[];
}

export interface CategoryDetailData {
  category: CategoryDetail;
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
  stockType: 'IN_STOCK' | 'PREORDER';
  currency: string;
  sourceCountry?: string;
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
  lga: string | null;
  area: string | null;
  landmark: string | null;
  country: string;
  postalCode: string | null;
  deliveryNotes: string | null;
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
  stockTypeSnapshot?: 'IN_STOCK' | 'PREORDER';
  inspectionRequired?: boolean;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status:
    | 'PENDING'
    | 'PAID'
    | 'PROCESSING'
    | 'INSPECTION_PENDING'
    | 'INSPECTION_PASSED'
    | 'SHIPPED'
    | 'IN_TRANSIT'
    | 'DELIVERED'
    | 'CANCELLED';
  inspectionStatus?: 'NOT_REQUIRED' | 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED';
  paymentReference?: string | null;
  subtotal: number;
  shippingFee: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  itemCount: number;
  shippingAddress: AddressSummary | null;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  trackingUrl?: string | null;
  paidAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  items: OrderItemSummary[];
  createdAt: string;
  updatedAt?: string;
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
  status: 'PENDING' | 'AUTHORIZED' | 'SUCCESS' | 'FAILED' | 'ABANDONED' | 'REFUNDED';
  reference: string;
  providerRef: string | null;
  providerTransactionId: string | null;
  authorizationUrl: string | null;
  accessCode: string | null;
  customerEmail: string | null;
  amount: number;
  amountCaptured: number | null;
  amountRefunded: number;
  fees: number | null;
  currency: string;
  channel: string | null;
  gatewayResponse: string | null;
  paidAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentInitiationData {
  payment: PaymentSummary;
  authorizationUrl: string;
  reference: string;
  accessCode?: string | null;
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

export interface PublicOrderTrackingData {
  orderNumber: string;
  status: string;
  stockType: 'IN_STOCK' | 'PREORDER';
  paymentStatus: string | null;
  shipmentStatus: string | null;
  eta: string | null;
  itemCount: number;
  itemSummary: string[];
  tracking: OrderTrackingData;
}

export interface AdminProductSummary {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  categoryName: string;
  basePrice: number;
  currency: string;
  sourceCountry: string;
  stockType: 'IN_STOCK' | 'PREORDER';
  approvalStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  isPublished: boolean;
  isFeatured: boolean;
  isSoldOut: boolean;
  isSoldOutOverride: boolean;
  marketingBadge: 'SELLING_FAST' | 'TRENDING' | null;
  isActive: boolean;
  inventoryQuantity: number | null;
  preorderSlotsTotal: number | null;
  preorderSlotsRemaining: number | null;
  preorderStartsAt: string | null;
  preorderEndsAt: string | null;
  estimatedArrivalAt: string | null;
  fxAdjustmentPercent: number | null;
  shippingBufferPercent: number | null;
  preorderMarginPercent: number | null;
  fxRateSnapshot: number | null;
  supplierCostSnapshot: number | null;
  shippingCostSnapshot: number | null;
  pricingBatchLabel: string | null;
  trendingScore: number;
  primaryImage: ProductImageSummary | null;
  images: ProductImageSummary[];
  variants: ProductVariantSummary[];
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
  inspectionStatus?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  holdForManualReview: boolean;
  total: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  deliveryAddressShort: string | null;
  deliveryState: string | null;
  itemCount: number;
  paymentReference?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderListData {
  orders: AdminOrderListItem[];
}

export interface AdminPaymentAttemptSummary {
  id: string;
  provider: 'PAYSTACK' | 'FLUTTERWAVE' | 'BANK_TRANSFER';
  status: 'PENDING' | 'AUTHORIZED' | 'SUCCESS' | 'FAILED' | 'ABANDONED' | 'REFUNDED';
  amount: number;
  amountCaptured: number | null;
  amountRefunded: number;
  fees: number | null;
  currency: string;
  reference: string;
  providerRef: string | null;
  providerTransactionId: string | null;
  customerEmail: string | null;
  channel: string | null;
  gatewayResponse: string | null;
  hasAuthorizationUrl: boolean;
  hasAccessCode: boolean;
  paidAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPaymentEventSummary {
  id: string;
  paymentId: string;
  provider: 'PAYSTACK' | 'FLUTTERWAVE' | 'BANK_TRANSFER';
  eventType: string;
  eventId: string | null;
  providerReference: string;
  providerRef: string | null;
  status: 'PENDING' | 'AUTHORIZED' | 'SUCCESS' | 'FAILED' | 'ABANDONED' | 'REFUNDED';
  amountMatched: boolean | null;
  currencyMatched: boolean | null;
  providerTransactionId: string | null;
  channel: string | null;
  gatewayMessage: string | null;
  paidAt: string | null;
  receivedAt: string;
}

export interface AdminInventoryReservationSummary {
  id: string;
  orderItemId: string;
  productId: string;
  variantId: string | null;
  stockType: 'IN_STOCK' | 'PREORDER';
  quantity: number;
  status: 'ACTIVE' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED';
  expiresAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderDetailData {
  order: OrderSummary & {
    checkoutMethod: 'ONLINE' | 'WHATSAPP';
    customerType: 'REGISTERED' | 'GUEST';
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    riskFlags: string[];
    riskReviewedAt: string | null;
    riskReviewedBy: string | null;
    riskReviewedByName: string | null;
    holdForManualReview: boolean;
    fraudNotes: string | null;
    customer: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
    };
    payments: AdminPaymentAttemptSummary[];
    paymentEvents: AdminPaymentEventSummary[];
    reservations: AdminInventoryReservationSummary[];
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
    paid?: number;
    processing: number;
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
    published?: number;
    preorder?: number;
  };
}

export interface BlogCategorySummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
}

export interface BlogPostListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string | null;
  tags: string[];
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  views: number;
  featured: boolean;
  readingTimeMins: number | null;
  publishedAt: string | null;
  authorName: string | null;
  category: BlogCategorySummary | null;
}

export interface BlogPostDetail extends BlogPostListItem {
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface BlogPostListData {
  posts: BlogPostListItem[];
}

export interface BlogPostDetailData {
  post: BlogPostDetail;
  relatedPosts: BlogPostListItem[];
}

export interface BlogCategoryListData {
  categories: BlogCategorySummary[];
}

export interface AdminBlogPostSummary extends BlogPostListItem {
  updatedAt: string;
}

export interface AdminBlogPostDetail extends BlogPostDetail {
  updatedAt: string;
}

export interface AdminBlogPostListData {
  posts: AdminBlogPostSummary[];
}

export interface AdminBlogPostDetailData {
  post: AdminBlogPostDetail;
}
