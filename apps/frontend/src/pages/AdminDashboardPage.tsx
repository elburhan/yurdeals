import { type ChangeEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type {
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
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'IN_TRANSIT',
  'CUSTOMS',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

interface ProductFormState {
  name: string;
  description: string;
  shortDesc: string;
  categoryId: string;
  basePrice: string;
  currency: string;
  stockType: 'LOCAL' | 'PREORDER';
  isFeatured: boolean;
  isActive: boolean;
  imageUrl: string;
}

const emptyProductForm: ProductFormState = {
  name: '',
  description: '',
  shortDesc: '',
  categoryId: '',
  basePrice: '',
  currency: 'NGN',
  stockType: 'LOCAL',
  isFeatured: false,
  isActive: true,
  imageUrl: '',
};

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
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('all');
  const [editingProduct, setEditingProduct] = useState<AdminProductSummary | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
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
      isFeatured: product.isFeatured,
      isActive: product.isActive,
      imageUrl: product.primaryImage?.url ?? '',
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
    const imageUrl = productForm.imageUrl.trim();

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
      is_featured: productForm.isFeatured,
      ...(imageUrl ? { image_url: imageUrl } : {}),
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
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
              Operations
            </p>
            <h1 className="font-display text-3xl font-bold text-surface-950">Admin dashboard</h1>
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

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-lg border border-surface-200 bg-white p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-xl font-bold text-surface-950">Orders</h2>
              <select
                value={orderStatusFilter}
                onChange={(event) => setOrderStatusFilter(event.target.value)}
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-surface-200 text-xs uppercase text-surface-500">
                  <tr>
                    <th className="py-3">Order</th>
                    <th>Channel</th>
                    <th>Customer type</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="py-3 font-semibold text-surface-950">{order.orderNumber}</td>
                      <td>
                        <span
                          className={
                            order.checkoutMethod === 'WHATSAPP'
                              ? 'rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700'
                              : 'rounded-full bg-surface-100 px-3 py-1 text-xs font-semibold text-surface-600'
                          }
                        >
                          {order.checkoutMethod === 'WHATSAPP' ? 'WhatsApp' : 'Online'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            order.customerType === 'GUEST'
                              ? 'rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700'
                              : 'rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700'
                          }
                        >
                          {order.customerType === 'GUEST' ? 'Guest' : 'Registered'}
                        </span>
                      </td>
                      <td>
                        <p>{order.customerName}</p>
                        <p className="text-xs text-surface-500">{order.customerEmail}</p>
                      </td>
                      <td>{formatPrice(order.total, order.currency)}</td>
                      <td>{order.status}</td>
                      <td>
                        <select
                          value={order.status}
                          onChange={(event) => void handleOrderStatus(order.id, event.target.value)}
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

          <section className="rounded-lg border border-surface-200 bg-white p-4">
            <h2 className="mb-4 font-display text-xl font-bold text-surface-950">Shipments</h2>
            <div className="space-y-3">
              {shipments.map((shipment) => (
                <article key={shipment.id} className="rounded-lg border border-surface-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-surface-950">{shipment.orderNumber}</p>
                      <p className="text-sm text-surface-500">{shipment.customerName}</p>
                    </div>
                    <span className="rounded-full bg-surface-100 px-3 py-1 text-xs font-semibold">
                      {shipment.status}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-lg border border-surface-200 bg-white p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-xl font-bold text-surface-950">Products</h2>
            <div className="flex flex-wrap gap-2">
              <select
                value={productStatusFilter}
                onChange={(event) => setProductStatusFilter(event.target.value)}
                className="min-h-10 rounded-lg border border-surface-300 px-3 text-sm"
                aria-label="Filter products by active status"
              >
                <option value="all">All products</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <p className="basis-full text-xs text-surface-500">
                Disable or Delete both hide products from customers. Delete is implemented as a
                safe soft delete for products that may already appear in orders.
              </p>
              <button
                type="button"
                onClick={openNewProductForm}
                className="min-h-10 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700"
              >
                New product
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
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
                          onClick={() => openEditProductForm(product)}
                          className="min-h-10 rounded-lg border border-surface-300 px-3 text-sm font-semibold text-surface-700 hover:border-primary-300 hover:text-primary-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleProductActive(product)}
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
                          onClick={() => void handleDeleteProduct(product)}
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
    </main>
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

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
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
      onChange({ ...form, imageUrl: response.data.url });
    } catch (requestError) {
      setImageUploadError(
        requestError instanceof Error ? requestError.message : 'Unable to upload image',
      );
    } finally {
      setIsUploadingImage(false);
      fileInput.value = '';
    }
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
              <option value="LOCAL">Local stock</option>
              <option value="PREORDER">Preorder</option>
            </select>
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

          <div className="grid gap-2 sm:col-span-2">
            <label className="grid gap-1 text-sm font-semibold text-surface-700">
              Upload product image
              <input
                type="file"
                accept="image/*"
                onChange={(event) => void handleImageUpload(event)}
                disabled={isUploadingImage}
                className="min-h-11 rounded-lg border border-surface-300 px-3 py-2 text-sm font-normal file:mr-3 file:rounded-full file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-700"
              />
            </label>
            {isUploadingImage ? (
              <p className="text-sm font-medium text-primary-700">Uploading image...</p>
            ) : null}
            {imageUploadError ? (
              <p className="text-sm font-semibold text-red-600">{imageUploadError}</p>
            ) : null}
            {form.imageUrl ? (
              <img
                src={form.imageUrl}
                alt="Product preview"
                className="h-24 w-24 rounded-lg border border-surface-200 object-cover"
                loading="lazy"
              />
            ) : null}
          </div>

          <label className="grid gap-1 text-sm font-semibold text-surface-700 sm:col-span-2">
            Image URL
            <input
              value={form.imageUrl}
              onChange={(event) => onChange({ ...form, imageUrl: event.target.value })}
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
              placeholder="https://res.cloudinary.com/..."
            />
            <span className="text-xs font-normal text-surface-500">
              Uploading fills this field automatically. You can still paste a URL manually.
            </span>
          </label>

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
