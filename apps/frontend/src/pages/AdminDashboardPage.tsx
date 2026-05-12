import { type ChangeEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type {
  AdminOrderDetailData,
  AdminOrderListItem,
  AdminOverviewData,
  AdminProductSummary,
  CategorySummary,
  ShipmentSummary,
} from '@yurdeals/shared';
import { NotificationBell } from '../components/NotificationBell';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { formatPrice } from '../components/ProductCard';
import { useAuth } from '../hooks/useAuth';
import {
  createAdminProduct,
  deleteAdminProduct,
  disableAdminProduct,
  getAdminOrder,
  getAdminOrders,
  getAdminOverview,
  getAdminProducts,
  getAdminShipments,
  updateAdminOrderStatus,
  updateAdminProduct,
  uploadAdminProductImage,
} from '../lib/adminApi';
import { getCategories } from '../lib/catalogApi';

const ORDER_STATUSES = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'INSPECTION_PENDING',
  'INSPECTION_PASSED',
  'SHIPPED',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
] as const;

const DASHBOARD_TABS = [
  { id: 'orders', label: 'Orders' },
  { id: 'products', label: 'Products' },
  { id: 'shipments', label: 'Shipments' },
] as const;

type DashboardTab = (typeof DASHBOARD_TABS)[number]['id'];
type AdminOrderDetail = AdminOrderDetailData['order'];

interface ProductFormState {
  name: string;
  description: string;
  shortDesc: string;
  categoryId: string;
  basePrice: string;
  currency: string;
  stockType: 'IN_STOCK' | 'PREORDER';
  inventoryQuantity: string;
  preorderSlotsTotal: string;
  preorderSlotsRemaining: string;
  preorderStartsAt: string;
  preorderEndsAt: string;
  estimatedArrivalAt: string;
  isFeatured: boolean;
  isActive: boolean;
  imageUrls: string[];
}

const emptyProductForm: ProductFormState = {
  name: '',
  description: '',
  shortDesc: '',
  categoryId: '',
  basePrice: '',
  currency: 'NGN',
  stockType: 'IN_STOCK',
  inventoryQuantity: '',
  preorderSlotsTotal: '',
  preorderSlotsRemaining: '',
  preorderStartsAt: '',
  preorderEndsAt: '',
  estimatedArrivalAt: '',
  isFeatured: false,
  isActive: true,
  imageUrls: ['', '', ''],
};

const MIN_PRODUCT_IMAGE_SLOTS = 3;

function ensureMinimumImageSlots(imageUrls: string[]): string[] {
  const nextImageUrls = [...imageUrls];
  while (nextImageUrls.length < MIN_PRODUCT_IMAGE_SLOTS) {
    nextImageUrls.push('');
  }

  return nextImageUrls;
}

function updateImageUrlAtIndex(imageUrls: string[], imageIndex: number, imageUrl: string): string[] {
  const nextImageUrls = ensureMinimumImageSlots(imageUrls);
  nextImageUrls[imageIndex] = imageUrl;
  return nextImageUrls;
}

function toDateTimeLocal(value?: string | null): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 16);
}

function parseOptionalInteger(value: string, label: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative whole number`);
  }

  return parsed;
}

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute roles={['ADMIN']}>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}

function AdminDashboardContent() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [products, setProducts] = useState<AdminProductSummary[]>([]);
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [activeTab, setActiveTab] = useState<DashboardTab>('orders');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('all');
  const [editingProduct, setEditingProduct] = useState<AdminProductSummary | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderDetail | null>(null);
  const [isOrderDetailOpen, setIsOrderDetailOpen] = useState(false);
  const [isLoadingOrderDetail, setIsLoadingOrderDetail] = useState(false);
  const [orderDetailError, setOrderDetailError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadDashboard() {
    setIsLoading(true);
    try {
      const [overviewResponse, ordersResponse, productsResponse, shipmentsResponse] =
        await Promise.all([
          getAdminOverview(),
          getAdminOrders(orderStatusFilter || undefined),
          getAdminProducts(productStatusFilter),
          getAdminShipments(),
        ]);

      setOverview(overviewResponse.data);
      setOrders(ordersResponse.data.orders);
      setProducts(productsResponse.data.products);
      setShipments(shipmentsResponse.data.shipments);
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load admin data');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const response = await getCategories();
      setCategories(response.data.categories);
    } catch {
      setCategories([]);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [orderStatusFilter, productStatusFilter]);

  useEffect(() => {
    void loadCategories();
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  async function handleOrderStatus(orderId: string, status: string) {
    await updateAdminOrderStatus(orderId, status);
    setSuccess('Order status updated');
    await loadDashboard();
  }

  async function openOrderDetail(orderId: string) {
    setIsOrderDetailOpen(true);
    setSelectedOrder(null);
    setOrderDetailError('');
    setIsLoadingOrderDetail(true);

    try {
      const response = await getAdminOrder(orderId);
      setSelectedOrder(response.data.order);
    } catch (requestError) {
      setOrderDetailError(
        requestError instanceof Error ? requestError.message : 'Unable to load order details',
      );
    } finally {
      setIsLoadingOrderDetail(false);
    }
  }

  function closeOrderDetail() {
    setIsOrderDetailOpen(false);
    setSelectedOrder(null);
    setOrderDetailError('');
  }

  function openNewProductForm() {
    setEditingProduct(null);
    setProductForm({
      ...emptyProductForm,
      categoryId: categories[0]?.id ?? '',
    });
    setError('');
    setSuccess('');
    setIsProductFormOpen(true);
  }

  function openEditProductForm(product: AdminProductSummary) {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: '',
      shortDesc: '',
      categoryId: product.categoryId,
      basePrice: String(product.basePrice),
      currency: product.currency,
      stockType: product.stockType,
      inventoryQuantity: product.inventoryQuantity?.toString() ?? '',
      preorderSlotsTotal: product.preorderSlotsTotal?.toString() ?? '',
      preorderSlotsRemaining: product.preorderSlotsRemaining?.toString() ?? '',
      preorderStartsAt: toDateTimeLocal(product.preorderStartsAt),
      preorderEndsAt: toDateTimeLocal(product.preorderEndsAt),
      estimatedArrivalAt: toDateTimeLocal(product.estimatedArrivalAt),
      isFeatured: product.isFeatured,
      isActive: product.isActive,
      imageUrls: ensureMinimumImageSlots(
        product.images.length > 0
          ? product.images.map((image) => image.url)
          : product.primaryImage
            ? [product.primaryImage.url]
            : [],
      ),
    });
    setError('');
    setSuccess('');
    setIsProductFormOpen(true);
  }

  function closeProductForm() {
    setIsProductFormOpen(false);
    setEditingProduct(null);
    setProductForm(emptyProductForm);
  }

  function buildProductPayload() {
    const price = Number(productForm.basePrice);
    const name = productForm.name.trim();
    const description = productForm.description.trim();
    const shortDesc = productForm.shortDesc.trim();
    const imageUrls = productForm.imageUrls.map((imageUrl) => imageUrl.trim()).filter(Boolean);
    const inventoryQuantity = parseOptionalInteger(productForm.inventoryQuantity, 'Inventory quantity');
    const preorderSlotsTotal = parseOptionalInteger(productForm.preorderSlotsTotal, 'Preorder slots total');
    const preorderSlotsRemaining = parseOptionalInteger(
      productForm.preorderSlotsRemaining,
      'Preorder slots remaining',
    );

    if (name.length < 2) {
      throw new Error('Product name must be at least 2 characters');
    }

    if (!editingProduct && description.length < 5) {
      throw new Error('Product description must be at least 5 characters');
    }

    if (!productForm.categoryId) {
      throw new Error('Choose a product category');
    }

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error('Enter a valid product price');
    }

    return {
      name,
      ...(description ? { description } : {}),
      ...(shortDesc ? { short_desc: shortDesc } : {}),
      category_id: productForm.categoryId,
      base_price: price,
      currency: productForm.currency.trim().toUpperCase() || 'NGN',
      stock_type: productForm.stockType,
      ...(inventoryQuantity !== undefined ? { inventory_quantity: inventoryQuantity } : {}),
      ...(preorderSlotsTotal !== undefined ? { preorder_slots_total: preorderSlotsTotal } : {}),
      ...(preorderSlotsRemaining !== undefined
        ? { preorder_slots_remaining: preorderSlotsRemaining }
        : {}),
      ...(productForm.preorderStartsAt
        ? { preorder_starts_at: new Date(productForm.preorderStartsAt).toISOString() }
        : {}),
      ...(productForm.preorderEndsAt
        ? { preorder_ends_at: new Date(productForm.preorderEndsAt).toISOString() }
        : {}),
      ...(productForm.estimatedArrivalAt
        ? { estimated_arrival_at: new Date(productForm.estimatedArrivalAt).toISOString() }
        : {}),
      is_featured: productForm.isFeatured,
      ...(imageUrls.length > 0 ? { images: imageUrls, image_url: imageUrls[0] } : {}),
    };
  }

  async function handleSaveProduct() {
    setIsSavingProduct(true);
    setError('');
    setSuccess('');

    try {
      const payload = buildProductPayload();

      if (editingProduct) {
        await updateAdminProduct(editingProduct.id, {
          ...payload,
          is_active: productForm.isActive,
        });
        setSuccess('Product updated');
      } else {
        await createAdminProduct({
          ...payload,
          description: payload.description ?? productForm.description.trim(),
        });
        setSuccess('Product created');
      }

      closeProductForm();
      await loadDashboard();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save product');
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function handleToggleProductActive(product: AdminProductSummary) {
    setError('');
    setSuccess('');

    try {
      if (product.isActive) {
        await disableAdminProduct(product.id);
        setSuccess('Product disabled');
      } else {
        await updateAdminProduct(product.id, { is_active: true });
        setSuccess('Product enabled');
      }

      await loadDashboard();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to update product status',
      );
    }
  }

  async function handleDeleteProduct(product: AdminProductSummary) {
    const confirmed = window.confirm(
      `Delete "${product.name}" from the storefront? This keeps order history intact and marks the product inactive.`,
    );

    if (!confirmed) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      await deleteAdminProduct(product.id);
      setSuccess('Product removed from storefront. Order history remains intact.');
      await loadDashboard();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete product');
    }
  }

  return (
    <main className="min-h-screen bg-surface-50">
      <header className="border-b border-surface-200 bg-white">
        <nav className="container-app flex min-h-16 items-center justify-between gap-4">
          <Link to="/" className="font-display text-xl font-bold text-surface-950">
            Yur<span className="text-primary-600">Deals</span>
          </Link>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Link to="/account" className="text-sm font-medium text-primary-700">
              Account
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="min-h-10 rounded-full border border-surface-300 px-4 text-sm font-semibold text-surface-700 hover:bg-surface-50"
            >
              Logout
            </button>
          </div>
        </nav>
      </header>

      <section className="container-app py-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
              Operations
            </p>
            <h1 className="font-display text-3xl font-bold text-surface-950">Admin dashboard</h1>
            <p className="mt-2 text-sm text-surface-500">
              Move between orders, products, and shipments without losing context.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="min-h-11 rounded-full border border-surface-300 px-5 text-sm font-semibold text-surface-700 hover:border-primary-300 hover:text-primary-700"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {success}
          </div>
        )}

        {isLoading && <div className="h-48 rounded-lg bg-surface-200" />}

        {overview && (
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <Metric
              label="Orders"
              value={overview.orders.total}
              detail={`${overview.orders.pending} pending`}
            />
            <Metric label="In transit" value={overview.orders.inTransit} detail="orders moving" />
            <Metric
              label="Shipments"
              value={overview.shipments.total}
              detail={`${overview.shipments.localDelivery} local`}
            />
            <Metric
              label="Products"
              value={overview.products.total}
              detail={`${overview.products.active} active`}
            />
          </div>
        )}

        <div className="mb-6 overflow-x-auto">
          <div className="inline-flex min-w-full gap-2 rounded-2xl border border-surface-200 bg-white p-2 sm:min-w-0">
            {DASHBOARD_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-11 rounded-xl px-4 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'orders' && (
          <OrdersPanel
            orders={orders}
            orderStatusFilter={orderStatusFilter}
            onFilterChange={setOrderStatusFilter}
            onStatusChange={handleOrderStatus}
            onViewDetails={(orderId) => void openOrderDetail(orderId)}
          />
        )}

        {activeTab === 'products' && (
          <ProductsPanel
            products={products}
            productStatusFilter={productStatusFilter}
            onFilterChange={setProductStatusFilter}
            onOpenNew={openNewProductForm}
            onEdit={openEditProductForm}
            onToggleActive={handleToggleProductActive}
            onDelete={handleDeleteProduct}
          />
        )}

        {activeTab === 'shipments' && <ShipmentsPanel shipments={shipments} />}
      </section>

      {isProductFormOpen && (
        <ProductFormModal
          categories={categories}
          editingProduct={editingProduct}
          form={productForm}
          isSaving={isSavingProduct}
          onChange={setProductForm}
          onClose={closeProductForm}
          onSave={() => void handleSaveProduct()}
        />
      )}

      {isOrderDetailOpen && (
        <OrderDetailDrawer
          order={selectedOrder}
          isLoading={isLoadingOrderDetail}
          error={orderDetailError}
          onClose={closeOrderDetail}
        />
      )}
    </main>
  );
}

function OrdersPanel({
  orders,
  orderStatusFilter,
  onFilterChange,
  onStatusChange,
  onViewDetails,
}: {
  orders: AdminOrderListItem[];
  orderStatusFilter: string;
  onFilterChange: (value: string) => void;
  onStatusChange: (orderId: string, status: string) => Promise<void>;
  onViewDetails: (orderId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-surface-950">Orders</h2>
          <p className="text-sm text-surface-500">
            Customer context is visible here so ops can act without opening every record.
          </p>
        </div>
        <select
          value={orderStatusFilter}
          onChange={(event) => onFilterChange(event.target.value)}
          className="min-h-10 rounded-lg border border-surface-300 px-3 text-sm"
          aria-label="Filter orders by status"
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3 md:hidden">
        {orders.map((order) => (
          <article key={order.id} className="rounded-xl border border-surface-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-surface-950">{order.orderNumber}</p>
                <p className="text-xs text-surface-500">{formatDateTime(order.createdAt)}</p>
              </div>
              <StatusPill status={order.status} />
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <InfoRow label="Customer" value={order.customerName} />
              <InfoRow label="Phone" value={order.customerPhone ?? 'No phone'} />
              <InfoRow label="Email" value={order.customerEmail} />
              <InfoRow label="Address" value={order.deliveryAddressShort ?? 'No address'} />
              <InfoRow label="State" value={order.deliveryState ?? 'No state'} />
              <InfoRow label="Total" value={formatPrice(order.total, order.currency)} />
            </dl>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => onViewDetails(order.id)}
                className="mb-3 min-h-11 w-full rounded-lg border border-primary-200 px-3 text-sm font-semibold text-primary-700 hover:bg-primary-50"
              >
                View details
              </button>
              <select
                value={order.status}
                onChange={(event) => void onStatusChange(order.id, event.target.value)}
                className="min-h-11 w-full rounded-lg border border-surface-300 px-3 text-sm"
                aria-label={`Update ${order.orderNumber} status`}
              >
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-surface-200 text-xs uppercase text-surface-500">
            <tr>
              <th className="py-3">Order</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Delivery address</th>
              <th>State</th>
              <th>Total</th>
              <th>Status</th>
              <th>Details</th>
              <th>Update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {orders.map((order) => (
              <tr key={order.id} className="align-top">
                <td className="py-3">
                  <p className="font-semibold text-surface-950">{order.orderNumber}</p>
                  <p className="mt-1 text-xs text-surface-500">{formatDateTime(order.createdAt)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ChannelPill method={order.checkoutMethod} />
                    <CustomerTypePill customerType={order.customerType} />
                  </div>
                </td>
                <td>
                  <p className="font-medium text-surface-950">{order.customerName}</p>
                  <p className="mt-1 text-xs text-surface-500">{order.customerEmail}</p>
                </td>
                <td>{order.customerPhone ?? 'No phone'}</td>
                <td className="max-w-[220px] text-surface-600">
                  <span className="line-clamp-2">{order.deliveryAddressShort ?? 'No address'}</span>
                </td>
                <td>{order.deliveryState ?? 'No state'}</td>
                <td>{formatPrice(order.total, order.currency)}</td>
                <td>
                  <StatusPill status={order.status} />
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => onViewDetails(order.id)}
                    className="min-h-10 rounded-lg border border-primary-200 px-3 text-sm font-semibold text-primary-700 hover:bg-primary-50"
                  >
                    View details
                  </button>
                </td>
                <td>
                  <select
                    value={order.status}
                    onChange={(event) => void onStatusChange(order.id, event.target.value)}
                    className="min-h-10 rounded-lg border border-surface-300 px-3"
                    aria-label={`Update ${order.orderNumber} status`}
                  >
                    {ORDER_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OrderDetailDrawer({
  order,
  isLoading,
  error,
  onClose,
}: {
  order: AdminOrderDetail | null;
  isLoading: boolean;
  error: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-surface-950/50">
      <aside
        className="ml-auto flex h-full w-full max-w-5xl flex-col overflow-y-auto bg-surface-50 shadow-2xl"
        aria-labelledby="admin-order-detail-title"
      >
        <header className="sticky top-0 z-10 border-b border-surface-200 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
                Order operations
              </p>
              <h2
                id="admin-order-detail-title"
                className="font-display text-2xl font-bold text-surface-950"
              >
                {order ? order.orderNumber : 'Order details'}
              </h2>
              <p className="mt-1 text-sm text-surface-500">
                Payment visibility only. This panel does not reconcile or mutate payment state.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 rounded-lg border border-surface-300 px-3 text-sm font-semibold text-surface-700 hover:bg-surface-50"
            >
              Close
            </button>
          </div>
        </header>

        <div className="grid gap-5 p-5">
          {isLoading && <div className="h-60 rounded-2xl bg-surface-200" />}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {!isLoading && !error && order && (
            <>
              <section className="grid gap-4 lg:grid-cols-3">
                <article className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
                  <h3 className="font-display text-lg font-bold text-surface-950">
                    Order summary
                  </h3>
                  <dl className="mt-4 grid gap-3 text-sm">
                    <InfoRow label="Status" value={order.status} />
                    <InfoRow label="Inspection" value={order.inspectionStatus ?? 'Not set'} />
                    <InfoRow label="Checkout method" value={order.checkoutMethod} />
                    <InfoRow label="Customer type" value={order.customerType} />
                    <InfoRow label="Payment reference" value={order.paymentReference ?? 'None'} />
                    <InfoRow label="Created" value={formatDateTime(order.createdAt)} />
                    <InfoRow
                      label="Updated"
                      value={order.updatedAt ? formatDateTime(order.updatedAt) : 'Not updated'}
                    />
                  </dl>
                </article>

                <article className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
                  <h3 className="font-display text-lg font-bold text-surface-950">
                    Customer and delivery
                  </h3>
                  <dl className="mt-4 grid gap-3 text-sm">
                    <InfoRow label="Customer" value={order.customer.name} />
                    <InfoRow label="Email" value={order.customer.email} />
                    <InfoRow label="Phone" value={order.customer.phone ?? 'No phone'} />
                    <InfoRow
                      label="Delivery phone"
                      value={order.shippingAddress?.phone ?? 'No delivery phone'}
                    />
                    <InfoRow label="Address" value={formatAddress(order.shippingAddress)} />
                  </dl>
                </article>

                <article className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
                  <h3 className="font-display text-lg font-bold text-surface-950">Amounts</h3>
                  <dl className="mt-4 grid gap-3 text-sm">
                    <InfoRow label="Subtotal" value={formatPrice(order.subtotal, order.currency)} />
                    <InfoRow
                      label="Shipping"
                      value={formatPrice(order.shippingFee, order.currency)}
                    />
                    <InfoRow label="Tax" value={formatPrice(order.tax, order.currency)} />
                    <InfoRow label="Discount" value={formatPrice(order.discount, order.currency)} />
                    <InfoRow label="Total" value={formatPrice(order.total, order.currency)} />
                  </dl>
                </article>
              </section>

              <section className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
                <h3 className="font-display text-lg font-bold text-surface-950">Items</h3>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-surface-200 text-xs uppercase text-surface-500">
                      <tr>
                        <th className="py-3">Product</th>
                        <th>Variant</th>
                        <th>Qty</th>
                        <th>Unit price</th>
                        <th>Line total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {order.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3">
                            <p className="font-semibold text-surface-950">{item.name}</p>
                            <p className="mt-1 text-xs text-surface-500">
                              {item.stockTypeSnapshot ?? 'Stock type unknown'}
                              {item.inspectionRequired ? ' · inspection required' : ''}
                            </p>
                          </td>
                          <td>{item.variantId ?? 'No variant'}</td>
                          <td>{item.quantity}</td>
                          <td>{formatPrice(item.price, order.currency)}</td>
                          <td>{formatPrice(item.total, order.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <InventoryReservationsSection reservations={order.reservations} />
              <PaymentAttemptsSection payments={order.payments} />
              <PaymentEventsSection events={order.paymentEvents} />
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function InventoryReservationsSection({
  reservations,
}: {
  reservations: AdminOrderDetail['reservations'];
}) {
  return (
    <section className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-surface-950">
            Inventory reservations
          </h3>
          <p className="text-sm text-surface-500">
            Current item holds created during online payment initiation.
          </p>
        </div>
        <span className="rounded-full bg-surface-100 px-3 py-1 text-xs font-bold text-surface-600">
          {reservations.length} reservation(s)
        </span>
      </div>

      {reservations.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-surface-300 p-4 text-sm text-surface-500">
          No inventory reservation has been created yet. This usually means payment has not been initialized.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {reservations.map((reservation) => (
            <article key={reservation.id} className="rounded-xl border border-surface-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ReservationStatusPill status={reservation.status} />
                <span className="rounded-full bg-surface-100 px-3 py-1 text-xs font-bold text-surface-600">
                  {reservation.stockType}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 text-sm">
                <InfoRow label="Quantity held" value={String(reservation.quantity)} />
                <InfoRow label="Order item" value={reservation.orderItemId} />
                <InfoRow label="Product" value={reservation.productId} />
                <InfoRow label="Variant" value={reservation.variantId ?? 'No variant'} />
                <InfoRow label="Expires" value={formatDateTime(reservation.expiresAt)} />
                <InfoRow
                  label="Confirmed"
                  value={
                    reservation.confirmedAt
                      ? formatDateTime(reservation.confirmedAt)
                      : 'Not confirmed'
                  }
                />
                <InfoRow
                  label="Released"
                  value={
                    reservation.releasedAt
                      ? formatDateTime(reservation.releasedAt)
                      : 'Not released'
                  }
                />
                <InfoRow label="Updated" value={formatDateTime(reservation.updatedAt)} />
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PaymentAttemptsSection({ payments }: { payments: AdminOrderDetail['payments'] }) {
  return (
    <section className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-surface-950">Payment attempts</h3>
          <p className="text-sm text-surface-500">
            Provider references and status history for support inspection.
          </p>
        </div>
        <span className="rounded-full bg-surface-100 px-3 py-1 text-xs font-bold text-surface-600">
          {payments.length} attempt(s)
        </span>
      </div>

      {payments.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-surface-300 p-4 text-sm text-surface-500">
          No payment attempt has been initialized for this order.
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          {payments.map((payment) => (
            <article key={payment.id} className="rounded-xl border border-surface-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={payment.status} />
                    <span className="rounded-full bg-surface-100 px-3 py-1 text-xs font-bold text-surface-600">
                      {payment.provider}
                    </span>
                    {payment.hasAuthorizationUrl ? (
                      <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700">
                        Has checkout URL
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 font-semibold text-surface-950">
                    {formatPrice(payment.amount, payment.currency)}
                  </p>
                  <p className="mt-1 break-all text-sm text-surface-500">
                    Reference: {payment.reference}
                  </p>
                </div>
                <dl className="grid gap-2 text-sm md:min-w-80">
                  <InfoRow label="Provider ref" value={payment.providerRef ?? 'None'} />
                  <InfoRow
                    label="Provider transaction"
                    value={payment.providerTransactionId ?? 'None'}
                  />
                  <InfoRow label="Channel" value={payment.channel ?? 'Unknown'} />
                  <InfoRow label="Customer email" value={payment.customerEmail ?? 'None'} />
                  <InfoRow label="Created" value={formatDateTime(payment.createdAt)} />
                  <InfoRow
                    label="Verified"
                    value={payment.verifiedAt ? formatDateTime(payment.verifiedAt) : 'Not verified'}
                  />
                  <InfoRow label="Paid" value={payment.paidAt ? formatDateTime(payment.paidAt) : 'Not paid'} />
                </dl>
              </div>
              {payment.gatewayResponse ? (
                <p className="mt-3 rounded-lg bg-surface-50 p-3 text-sm text-surface-600">
                  Gateway response: {payment.gatewayResponse}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PaymentEventsSection({ events }: { events: AdminOrderDetail['paymentEvents'] }) {
  return (
    <section className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-surface-950">
            Payment and webhook timeline
          </h3>
          <p className="text-sm text-surface-500">
            Safe event summaries. Raw provider payloads are intentionally hidden.
          </p>
        </div>
        <span className="rounded-full bg-surface-100 px-3 py-1 text-xs font-bold text-surface-600">
          {events.length} event(s)
        </span>
      </div>

      {events.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-surface-300 p-4 text-sm text-surface-500">
          No webhook or payment event has been recorded yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {events.map((event) => (
            <article key={event.id} className="rounded-xl border border-surface-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={event.status} />
                    <span className="rounded-full bg-surface-100 px-3 py-1 text-xs font-bold text-surface-600">
                      {event.provider}
                    </span>
                  </div>
                  <p className="mt-3 font-semibold text-surface-950">{event.eventType}</p>
                  <p className="mt-1 break-all text-sm text-surface-500">
                    Reference: {event.providerReference}
                  </p>
                </div>
                <dl className="grid gap-2 text-sm md:min-w-80">
                  <InfoRow label="Received" value={formatDateTime(event.receivedAt)} />
                  <InfoRow label="Provider event ID" value={event.eventId ?? 'None'} />
                  <InfoRow label="Provider ref" value={event.providerRef ?? 'None'} />
                  <InfoRow
                    label="Amount matched"
                    value={formatNullableBoolean(event.amountMatched)}
                  />
                  <InfoRow
                    label="Currency matched"
                    value={formatNullableBoolean(event.currencyMatched)}
                  />
                  <InfoRow
                    label="Provider transaction"
                    value={event.providerTransactionId ?? 'None'}
                  />
                  <InfoRow label="Channel" value={event.channel ?? 'Unknown'} />
                </dl>
              </div>
              {event.gatewayMessage ? (
                <p className="mt-3 rounded-lg bg-surface-50 p-3 text-sm text-surface-600">
                  Gateway message: {event.gatewayMessage}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ProductsPanel({
  products,
  productStatusFilter,
  onFilterChange,
  onOpenNew,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  products: AdminProductSummary[];
  productStatusFilter: string;
  onFilterChange: (value: string) => void;
  onOpenNew: () => void;
  onEdit: (product: AdminProductSummary) => void;
  onToggleActive: (product: AdminProductSummary) => Promise<void>;
  onDelete: (product: AdminProductSummary) => Promise<void>;
}) {
  return (
    <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-surface-950">Products</h2>
          <p className="text-sm text-surface-500">
            Manage the storefront without jumping to a separate screen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={productStatusFilter}
            onChange={(event) => onFilterChange(event.target.value)}
            className="min-h-10 rounded-lg border border-surface-300 px-3 text-sm"
            aria-label="Filter products by active status"
          >
            <option value="all">All products</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            type="button"
            onClick={onOpenNew}
            className="min-h-10 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700"
          >
            New product
          </button>
        </div>
      </div>

      <p className="mb-4 text-xs text-surface-500">
        Disable or delete both hide products from customers. Delete is implemented as a safe soft
        delete for products that may already appear in orders.
      </p>

      <div className="space-y-3 md:hidden">
        {products.map((product) => (
          <article key={product.id} className="rounded-xl border border-surface-200 p-4">
            <div className="flex items-start gap-3">
              {product.primaryImage ? (
                <img
                  src={product.primaryImage.url}
                  alt={product.primaryImage.alt ?? product.name}
                  loading="lazy"
                  className="h-14 w-14 rounded-lg object-cover"
                />
              ) : (
                <div className="h-14 w-14 rounded-lg bg-surface-100" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-surface-950">{product.name}</p>
                <p className="text-sm text-surface-500">{product.categoryName}</p>
                <p className="mt-1 text-sm font-medium text-surface-900">
                  {formatPrice(product.basePrice, product.currency)}
                </p>
                <p className="mt-1 text-xs text-surface-500">
                  {product.isActive ? 'Active' : 'Inactive'} · {product.stockType}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onEdit(product)}
                className="min-h-10 rounded-lg border border-surface-300 px-3 text-sm font-semibold text-surface-700 hover:border-primary-300 hover:text-primary-700"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void onToggleActive(product)}
                className={
                  product.isActive
                    ? 'min-h-10 rounded-lg px-3 text-sm font-semibold text-red-600 hover:bg-red-50'
                    : 'min-h-10 rounded-lg px-3 text-sm font-semibold text-green-700 hover:bg-green-50'
                }
              >
                {product.isActive ? 'Disable' : 'Enable'}
              </button>
              <button
                type="button"
                onClick={() => void onDelete(product)}
                className="min-h-10 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-surface-200 text-xs uppercase text-surface-500">
            <tr>
              <th className="py-3">Product</th>
              <th>Category</th>
              <th>Price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {products.map((product) => (
              <tr key={product.id}>
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    {product.primaryImage ? (
                      <img
                        src={product.primaryImage.url}
                        alt={product.primaryImage.alt ?? product.name}
                        loading="lazy"
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-surface-100" aria-hidden="true" />
                    )}
                    <div>
                      <p className="font-semibold text-surface-950">{product.name}</p>
                      {product.primaryImage && (
                        <p className="max-w-60 truncate text-xs text-surface-500">
                          {product.primaryImage.url}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td>{product.categoryName}</td>
                <td>{formatPrice(product.basePrice, product.currency)}</td>
                <td>{product.isActive ? 'Active' : 'Inactive'}</td>
                <td>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(product)}
                      className="min-h-10 rounded-lg border border-surface-300 px-3 text-sm font-semibold text-surface-700 hover:border-primary-300 hover:text-primary-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void onToggleActive(product)}
                      className={
                        product.isActive
                          ? 'min-h-10 rounded-lg px-3 text-sm font-semibold text-red-600 hover:bg-red-50'
                          : 'min-h-10 rounded-lg px-3 text-sm font-semibold text-green-700 hover:bg-green-50'
                      }
                    >
                      {product.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(product)}
                      className="min-h-10 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ShipmentsPanel({ shipments }: { shipments: ShipmentSummary[] }) {
  return (
    <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="font-display text-xl font-bold text-surface-950">Shipments</h2>
        <p className="text-sm text-surface-500">
          Track active delivery records without scrolling past unrelated admin blocks.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shipments.map((shipment) => (
          <article key={shipment.id} className="rounded-lg border border-surface-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-surface-950">{shipment.orderNumber}</p>
                <p className="text-sm text-surface-500">{shipment.customerName}</p>
              </div>
              <span className="rounded-full bg-surface-100 px-3 py-1 text-xs font-semibold">
                {shipment.status}
              </span>
            </div>
            <dl className="mt-4 grid gap-2 text-sm">
              <InfoRow label="Phone" value={shipment.customerPhone ?? 'No phone on file'} />
              <InfoRow
                label="Tracking"
                value={shipment.trackingNumber ?? shipment.carrier ?? 'Awaiting tracking'}
              />
              <InfoRow
                label="Delivery area"
                value={
                  shipment.address
                    ? `${shipment.address.city}, ${shipment.address.state}`
                    : 'Address pending'
                }
              />
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductFormModal({
  categories,
  editingProduct,
  form,
  isSaving,
  onChange,
  onClose,
  onSave,
}: {
  categories: CategorySummary[];
  editingProduct: AdminProductSummary | null;
  form: ProductFormState;
  isSaving: boolean;
  onChange: (nextForm: ProductFormState) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const isEditing = editingProduct !== null;
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>, imageIndex: number) {
    const fileInput = event.currentTarget;
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setImageUploadError('Choose an image file');
      fileInput.value = '';
      return;
    }

    setIsUploadingImage(true);
    setImageUploadError('');

    try {
      const response = await uploadAdminProductImage(file);
      onChange({
        ...form,
        imageUrls: updateImageUrlAtIndex(form.imageUrls, imageIndex, response.data.url),
      });
    } catch (requestError) {
      setImageUploadError(
        requestError instanceof Error ? requestError.message : 'Unable to upload image',
      );
    } finally {
      setIsUploadingImage(false);
      fileInput.value = '';
    }
  }

  function handleImageUrlChange(imageIndex: number, imageUrl: string) {
    onChange({
      ...form,
      imageUrls: updateImageUrlAtIndex(form.imageUrls, imageIndex, imageUrl),
    });
  }

  function handleAddImageSlot() {
    onChange({ ...form, imageUrls: [...form.imageUrls, ''] });
  }

  function handleRemoveImageSlot(imageIndex: number) {
    const nextImageUrls = form.imageUrls.filter((_, index) => index !== imageIndex);
    onChange({ ...form, imageUrls: ensureMinimumImageSlots(nextImageUrls) });
  }

  function handleMoveImage(imageIndex: number, direction: -1 | 1) {
    const targetIndex = imageIndex + direction;
    if (targetIndex < 0 || targetIndex >= form.imageUrls.length) {
      return;
    }

    const nextImageUrls = [...form.imageUrls];
    const currentImageUrl = nextImageUrls[imageIndex];
    nextImageUrls[imageIndex] = nextImageUrls[targetIndex] ?? '';
    nextImageUrls[targetIndex] = currentImageUrl ?? '';
    onChange({ ...form, imageUrls: nextImageUrls });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/50 p-4">
      <section
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
        aria-labelledby="product-form-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
              Product management
            </p>
            <h2 id="product-form-title" className="font-display text-2xl font-bold text-surface-950">
              {isEditing ? 'Edit product' : 'New product'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-lg border border-surface-300 px-3 text-sm font-semibold text-surface-700"
          >
            Close
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-surface-700 sm:col-span-2">
            Product name
            <input
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
              placeholder="Portable rice cooker"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700">
            Category
            <select
              value={form.categoryId}
              onChange={(event) => onChange({ ...form, categoryId: event.target.value })}
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
            >
              <option value="">Choose category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700">
            Price
            <input
              value={form.basePrice}
              onChange={(event) => onChange({ ...form, basePrice: event.target.value })}
              inputMode="decimal"
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
              placeholder="25000"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700">
            Currency
            <input
              value={form.currency}
              onChange={(event) => onChange({ ...form, currency: event.target.value })}
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal uppercase"
              maxLength={3}
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700">
            Stock type
            <select
              value={form.stockType}
              onChange={(event) =>
                onChange({ ...form, stockType: event.target.value as ProductFormState['stockType'] })
              }
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
            >
              <option value="IN_STOCK">In stock</option>
              <option value="PREORDER">Preorder</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700">
            Inventory quantity
            <input
              value={form.inventoryQuantity}
              onChange={(event) => onChange({ ...form, inventoryQuantity: event.target.value })}
              inputMode="numeric"
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
              placeholder="Optional"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700">
            Preorder slots total
            <input
              value={form.preorderSlotsTotal}
              onChange={(event) => onChange({ ...form, preorderSlotsTotal: event.target.value })}
              inputMode="numeric"
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
              placeholder="Optional"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700">
            Preorder slots remaining
            <input
              value={form.preorderSlotsRemaining}
              onChange={(event) =>
                onChange({ ...form, preorderSlotsRemaining: event.target.value })
              }
              inputMode="numeric"
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
              placeholder="Optional"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700">
            Preorder starts
            <input
              type="datetime-local"
              value={form.preorderStartsAt}
              onChange={(event) => onChange({ ...form, preorderStartsAt: event.target.value })}
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700">
            Preorder ends
            <input
              type="datetime-local"
              value={form.preorderEndsAt}
              onChange={(event) => onChange({ ...form, preorderEndsAt: event.target.value })}
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700">
            Estimated arrival
            <input
              type="datetime-local"
              value={form.estimatedArrivalAt}
              onChange={(event) => onChange({ ...form, estimatedArrivalAt: event.target.value })}
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700 sm:col-span-2">
            Short description
            <input
              value={form.shortDesc}
              onChange={(event) => onChange({ ...form, shortDesc: event.target.value })}
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
              placeholder="Compact, practical, ready for small kitchens"
            />
          </label>

          <div className="grid gap-3 sm:col-span-2">
            <div>
              <p className="text-sm font-semibold text-surface-700">Product images</p>
              <p className="text-xs text-surface-500">
                The first image is primary. Upload an image or paste a URL for each slot.
              </p>
            </div>
            {isUploadingImage ? (
              <p className="text-sm font-medium text-primary-700">Uploading image...</p>
            ) : null}
            {imageUploadError ? (
              <p className="text-sm font-semibold text-red-600">{imageUploadError}</p>
            ) : null}
            <div className="space-y-3">
              {form.imageUrls.map((imageUrl, imageIndex) => (
                <div
                  key={imageIndex}
                  className="grid gap-3 rounded-lg border border-surface-200 p-3 sm:grid-cols-[5rem_1fr]"
                >
                  <div className="flex items-start gap-3 sm:block">
                    {imageUrl.trim() ? (
                      <img
                        src={imageUrl}
                        alt={`Product preview ${imageIndex + 1}`}
                        className="h-20 w-20 rounded-lg border border-surface-200 object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-surface-300 bg-surface-50 text-xs font-semibold text-surface-400">
                        Image
                      </div>
                    )}
                    {imageIndex === 0 ? (
                      <span className="mt-2 inline-flex rounded-full bg-primary-50 px-2 py-1 text-xs font-bold text-primary-700">
                        Primary
                      </span>
                    ) : null}
                  </div>
                  <div className="grid gap-2">
                    <label className="grid gap-1 text-sm font-semibold text-surface-700">
                      Image {imageIndex + 1} URL
                      <input
                        value={imageUrl}
                        onChange={(event) => handleImageUrlChange(imageIndex, event.target.value)}
                        className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
                        placeholder="https://res.cloudinary.com/..."
                      />
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => void handleImageUpload(event, imageIndex)}
                      disabled={isUploadingImage}
                      className="min-h-11 rounded-lg border border-surface-300 px-3 py-2 text-sm font-normal file:mr-3 file:rounded-full file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-700"
                      aria-label={`Upload product image ${imageIndex + 1}`}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleMoveImage(imageIndex, -1)}
                        disabled={imageIndex === 0}
                        className="min-h-9 rounded-lg border border-surface-300 px-3 text-xs font-semibold text-surface-700 disabled:opacity-40"
                      >
                        Move up
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveImage(imageIndex, 1)}
                        disabled={imageIndex === form.imageUrls.length - 1}
                        className="min-h-9 rounded-lg border border-surface-300 px-3 text-xs font-semibold text-surface-700 disabled:opacity-40"
                      >
                        Move down
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveImageSlot(imageIndex)}
                        disabled={form.imageUrls.length <= MIN_PRODUCT_IMAGE_SLOTS && !imageUrl.trim()}
                        className="min-h-9 rounded-lg px-3 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddImageSlot}
              className="min-h-10 rounded-lg border border-primary-200 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-50"
            >
              Add another image
            </button>
          </div>

          <label className="grid gap-1 text-sm font-semibold text-surface-700 sm:col-span-2">
            Description {isEditing ? <span className="font-normal text-surface-500">(optional)</span> : null}
            <textarea
              value={form.description}
              onChange={(event) => onChange({ ...form, description: event.target.value })}
              className="min-h-28 rounded-lg border border-surface-300 px-3 py-2 font-normal"
              placeholder={
                isEditing
                  ? 'Only enter this if you want to replace the description'
                  : 'Describe the product, use case, and delivery expectation'
              }
            />
          </label>

          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-surface-200 px-3 text-sm font-semibold text-surface-700">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(event) => onChange({ ...form, isFeatured: event.target.checked })}
            />
            Featured
          </label>

          {isEditing && (
            <label className="flex min-h-11 items-center gap-3 rounded-lg border border-surface-200 px-3 text-sm font-semibold text-surface-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => onChange({ ...form, isActive: event.target.checked })}
              />
              Active
            </label>
          )}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full border border-surface-300 px-5 text-sm font-semibold text-surface-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || isUploadingImage}
            className="min-h-11 rounded-full bg-primary-600 px-5 text-sm font-semibold text-white hover:bg-primary-700 disabled:bg-surface-300"
          >
            {isUploadingImage ? 'Uploading...' : isSaving ? 'Saving...' : isEditing ? 'Save product' : 'Create product'}
          </button>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <article className="rounded-lg border border-surface-200 bg-white p-4">
      <p className="text-sm font-medium text-surface-500">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-surface-950">{value}</p>
      <p className="mt-1 text-sm text-surface-500">{detail}</p>
    </article>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700">
      {status}
    </span>
  );
}

function ReservationStatusPill({
  status,
}: {
  status: AdminOrderDetail['reservations'][number]['status'];
}) {
  const styles = {
    ACTIVE: 'bg-amber-50 text-amber-700',
    CONFIRMED: 'bg-emerald-50 text-emerald-700',
    RELEASED: 'bg-surface-100 text-surface-700',
    EXPIRED: 'bg-red-50 text-red-700',
  } satisfies Record<AdminOrderDetail['reservations'][number]['status'], string>;

  const labels = {
    ACTIVE: 'Held for payment',
    CONFIRMED: 'Confirmed after payment',
    RELEASED: 'Released',
    EXPIRED: 'Expired',
  } satisfies Record<AdminOrderDetail['reservations'][number]['status'], string>;

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function ChannelPill({ method }: { method: AdminOrderListItem['checkoutMethod'] }) {
  return (
    <span
      className={
        method === 'WHATSAPP'
          ? 'rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700'
          : 'rounded-full bg-surface-100 px-3 py-1 text-xs font-semibold text-surface-600'
      }
    >
      {method === 'WHATSAPP' ? 'WhatsApp' : 'Online'}
    </span>
  );
}

function CustomerTypePill({ customerType }: { customerType: AdminOrderListItem['customerType'] }) {
  return (
    <span
      className={
        customerType === 'GUEST'
          ? 'rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700'
          : 'rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700'
      }
    >
      {customerType === 'GUEST' ? 'Guest' : 'Registered'}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">{label}</p>
      <p className="mt-1 text-surface-900">{value}</p>
    </div>
  );
}

function formatAddress(address: AdminOrderDetail['shippingAddress']): string {
  if (!address) {
    return 'No delivery address';
  }

  return [address.street, address.city, address.state, address.country].filter(Boolean).join(', ');
}

function formatNullableBoolean(value: boolean | null): string {
  if (value === null) {
    return 'Unknown';
  }

  return value ? 'Yes' : 'No';
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
