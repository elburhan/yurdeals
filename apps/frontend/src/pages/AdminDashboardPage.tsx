import { type ChangeEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type {
  AdminBlogPostDetail,
  AdminBlogPostSummary,
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
  archiveAdminBlogPost,
  uploadAdminArticleCoverImage,
  createAdminProduct,
  createAdminBlogPost,
  deleteAdminProduct,
  disableAdminProduct,
  getAdminBlogPost,
  getAdminBlogPosts,
  getAdminOrder,
  getAdminOrders,
  getAdminOverview,
  getAdminProducts,
  getAdminShipments,
  updateAdminOrderRiskReview,
  updateAdminOrderStatus,
  updateAdminBlogPost,
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
  { id: 'guides', label: 'Guides' },
  { id: 'shipments', label: 'Shipments' },
] as const;

type DashboardTab = (typeof DASHBOARD_TABS)[number]['id'];
type AdminOrderDetail = AdminOrderDetailData['order'];

interface ProductVariantFormState {
  id?: string;
  name: string;
  price: string;
  stock: string;
  sku: string;
}

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
  fxAdjustmentPercent: string;
  shippingBufferPercent: string;
  preorderMarginPercent: string;
  fxRateSnapshot: string;
  supplierCostSnapshot: string;
  shippingCostSnapshot: string;
  pricingBatchLabel: string;
  isFeatured: boolean;
  isPublished: boolean;
  isSoldOut: boolean;
  marketingBadge: '' | 'SELLING_FAST' | 'TRENDING';
  approvalStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  isActive: boolean;
  imageUrls: string[];
  variants: ProductVariantFormState[];
}

interface ArticleFormState {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  categoryName: string;
  tags: string;
  featured: boolean;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  coverImage: string;
  seoTitle: string;
  seoDescription: string;
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
  fxAdjustmentPercent: '',
  shippingBufferPercent: '',
  preorderMarginPercent: '',
  fxRateSnapshot: '',
  supplierCostSnapshot: '',
  shippingCostSnapshot: '',
  pricingBatchLabel: '',
  isFeatured: false,
  isPublished: true,
  isSoldOut: false,
  marketingBadge: '',
  approvalStatus: 'APPROVED',
  isActive: true,
  imageUrls: ['', '', ''],
  variants: [],
};

const emptyArticleForm: ArticleFormState = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  categoryName: 'Preorder Guide',
  tags: '',
  featured: false,
  status: 'DRAFT',
  coverImage: '',
  seoTitle: '',
  seoDescription: '',
};

const MIN_PRODUCT_IMAGE_SLOTS = 3;
const MAX_ADMIN_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

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

function parseOptionalDecimal(value: string, label: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }

  return parsed;
}

function buildVariantPayload(variants: ProductVariantFormState[]):
  | Array<{ id?: string; name: string; price: number; stock: number; sku?: string }>
  | undefined {
  const filledVariants = variants.filter((variant) =>
    [variant.name, variant.price, variant.stock, variant.sku].some((value) => value.trim().length > 0),
  );

  if (filledVariants.length === 0) {
    return variants.length > 0 ? [] : undefined;
  }

  return filledVariants.map((variant, index) => {
    const name = variant.name.trim();
    const price = Number(variant.price);
    const stock = Number(variant.stock);

    if (!name) {
      throw new Error(`Variant ${index + 1} needs a name`);
    }

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Variant ${index + 1} needs a valid price`);
    }

    if (!Number.isInteger(stock) || stock < 0) {
      throw new Error(`Variant ${index + 1} stock must be a non-negative whole number`);
    }

    return {
      ...(variant.id ? { id: variant.id } : {}),
      name,
      price,
      stock,
      ...(variant.sku.trim() ? { sku: variant.sku.trim() } : {}),
    };
  });
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
  const [articles, setArticles] = useState<AdminBlogPostSummary[]>([]);
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [activeTab, setActiveTab] = useState<DashboardTab>('orders');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('all');
  const [articleStatusFilter, setArticleStatusFilter] = useState('all');
  const [editingProduct, setEditingProduct] = useState<AdminProductSummary | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [editingArticle, setEditingArticle] = useState<AdminBlogPostDetail | null>(null);
  const [articleForm, setArticleForm] = useState<ArticleFormState>(emptyArticleForm);
  const [isArticleFormOpen, setIsArticleFormOpen] = useState(false);
  const [isSavingArticle, setIsSavingArticle] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderDetail | null>(null);
  const [isOrderDetailOpen, setIsOrderDetailOpen] = useState(false);
  const [isLoadingOrderDetail, setIsLoadingOrderDetail] = useState(false);
  const [isSavingOrderRiskReview, setIsSavingOrderRiskReview] = useState(false);
  const [orderDetailError, setOrderDetailError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadDashboard() {
    setIsLoading(true);
    try {
      const [overviewResponse, ordersResponse, productsResponse, articlesResponse, shipmentsResponse] =
        await Promise.all([
          getAdminOverview(),
          getAdminOrders(orderStatusFilter || undefined),
          getAdminProducts(productStatusFilter),
          getAdminBlogPosts(articleStatusFilter),
          getAdminShipments(),
        ]);

      setOverview(overviewResponse.data);
      setOrders(ordersResponse.data.orders);
      setProducts(productsResponse.data.products);
      setArticles(articlesResponse.data.posts);
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
  }, [orderStatusFilter, productStatusFilter, articleStatusFilter]);

  useEffect(() => {
    void loadCategories();
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  async function handleOrderStatus(orderId: string, status: string) {
    setError('');
    setSuccess('');

    try {
      await updateAdminOrderStatus(orderId, status);
      setSuccess('Order status updated');
      await loadDashboard();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to update order status',
      );
    }
  }

  async function handleOrderRiskReview(
    orderId: string,
    input: {
      hold_for_manual_review?: boolean;
      fraud_notes?: string;
      risk_level_override?: 'LOW' | 'MEDIUM' | 'HIGH';
    },
  ) {
    setIsSavingOrderRiskReview(true);
    setOrderDetailError('');

    try {
      const response = await updateAdminOrderRiskReview(orderId, input);
      setSelectedOrder(response.data.order);
      setSuccess('Order review updated');
      await loadDashboard();
    } catch (requestError) {
      setOrderDetailError(
        requestError instanceof Error ? requestError.message : 'Unable to update order review',
      );
    } finally {
      setIsSavingOrderRiskReview(false);
    }
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
      fxAdjustmentPercent: product.fxAdjustmentPercent?.toString() ?? '',
      shippingBufferPercent: product.shippingBufferPercent?.toString() ?? '',
      preorderMarginPercent: product.preorderMarginPercent?.toString() ?? '',
      fxRateSnapshot: product.fxRateSnapshot?.toString() ?? '',
      supplierCostSnapshot: product.supplierCostSnapshot?.toString() ?? '',
      shippingCostSnapshot: product.shippingCostSnapshot?.toString() ?? '',
      pricingBatchLabel: product.pricingBatchLabel ?? '',
      isFeatured: product.isFeatured,
      isPublished: product.isPublished,
      isSoldOut: product.isSoldOutOverride,
      marketingBadge: product.marketingBadge ?? '',
      approvalStatus: product.approvalStatus,
      isActive: product.isActive,
      imageUrls: ensureMinimumImageSlots(
        product.images.length > 0
          ? product.images.map((image) => image.url)
          : product.primaryImage
            ? [product.primaryImage.url]
            : [],
      ),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        price: String(variant.price),
        stock: String(variant.stock),
        sku: variant.sku ?? '',
      })),
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
    const fxAdjustmentPercent = parseOptionalDecimal(
      productForm.fxAdjustmentPercent,
      'FX adjustment percent',
    );
    const shippingBufferPercent = parseOptionalDecimal(
      productForm.shippingBufferPercent,
      'Shipping buffer percent',
    );
    const preorderMarginPercent = parseOptionalDecimal(
      productForm.preorderMarginPercent,
      'Preorder margin percent',
    );
    const fxRateSnapshot = parseOptionalDecimal(productForm.fxRateSnapshot, 'FX rate snapshot');
    const supplierCostSnapshot = parseOptionalDecimal(
      productForm.supplierCostSnapshot,
      'Supplier cost snapshot',
    );
    const shippingCostSnapshot = parseOptionalDecimal(
      productForm.shippingCostSnapshot,
      'Shipping cost snapshot',
    );
    const variants = buildVariantPayload(productForm.variants);

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
      ...(fxAdjustmentPercent !== undefined ? { fx_adjustment_percent: fxAdjustmentPercent } : {}),
      ...(shippingBufferPercent !== undefined ? { shipping_buffer_percent: shippingBufferPercent } : {}),
      ...(preorderMarginPercent !== undefined ? { preorder_margin_percent: preorderMarginPercent } : {}),
      ...(fxRateSnapshot !== undefined ? { fx_rate_snapshot: fxRateSnapshot } : {}),
      ...(supplierCostSnapshot !== undefined ? { supplier_cost_snapshot: supplierCostSnapshot } : {}),
      ...(shippingCostSnapshot !== undefined ? { shipping_cost_snapshot: shippingCostSnapshot } : {}),
      pricing_batch_label: productForm.pricingBatchLabel.trim(),
      is_featured: productForm.isFeatured,
      is_published: productForm.isPublished,
      is_sold_out: productForm.isSoldOut,
      marketing_badge: productForm.marketingBadge || null,
      approval_status: productForm.approvalStatus,
      ...(variants !== undefined ? { variants } : {}),
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

  function openNewArticleForm() {
    setEditingArticle(null);
    setArticleForm(emptyArticleForm);
    setError('');
    setSuccess('');
    setIsArticleFormOpen(true);
  }

  async function openEditArticleForm(article: AdminBlogPostSummary) {
    setError('');
    setSuccess('');

    try {
      const response = await getAdminBlogPost(article.id);
      const post = response.data.post;
      setEditingArticle(post);
      setArticleForm({
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        categoryName: post.category?.name ?? '',
        tags: post.tags.join(', '),
        featured: post.featured,
        status: post.status,
        coverImage: post.coverImage ?? '',
        seoTitle: post.seoTitle ?? '',
        seoDescription: post.seoDescription ?? '',
      });
      setIsArticleFormOpen(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load guide');
    }
  }

  function closeArticleForm() {
    setIsArticleFormOpen(false);
    setEditingArticle(null);
    setArticleForm(emptyArticleForm);
  }

  function buildArticlePayload() {
    const tags = articleForm.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    return {
      title: articleForm.title.trim(),
      ...(articleForm.slug.trim() ? { slug: articleForm.slug.trim() } : {}),
      excerpt: articleForm.excerpt.trim(),
      content: articleForm.content.trim(),
      ...(articleForm.categoryName.trim() ? { category_name: articleForm.categoryName.trim() } : {}),
      tags,
      featured: articleForm.featured,
      status: articleForm.status,
      ...(articleForm.coverImage.trim() ? { cover_image: articleForm.coverImage.trim() } : {}),
      ...(articleForm.seoTitle.trim() ? { seo_title: articleForm.seoTitle.trim() } : {}),
      ...(articleForm.seoDescription.trim()
        ? { seo_description: articleForm.seoDescription.trim() }
        : {}),
    };
  }

  async function handleSaveArticle() {
    setIsSavingArticle(true);
    setError('');
    setSuccess('');

    try {
      const payload = buildArticlePayload();

      if (editingArticle) {
        await updateAdminBlogPost(editingArticle.id, payload);
        setSuccess('Guide updated');
      } else {
        await createAdminBlogPost(payload);
        setSuccess('Guide created');
      }

      closeArticleForm();
      await loadDashboard();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save guide');
    } finally {
      setIsSavingArticle(false);
    }
  }

  async function handleArchiveArticle(article: AdminBlogPostSummary) {
    const confirmed = window.confirm(
      `Archive "${article.title}"? Archived guides are hidden from the public Guides page.`,
    );

    if (!confirmed) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      await archiveAdminBlogPost(article.id);
      setSuccess('Guide archived');
      await loadDashboard();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to archive guide');
    }
  }

  async function handleArticleStatus(
    article: AdminBlogPostSummary,
    status: ArticleFormState['status'],
  ) {
    setError('');
    setSuccess('');

    try {
      await updateAdminBlogPost(article.id, { status });
      setSuccess(status === 'PUBLISHED' ? 'Guide published' : 'Guide unpublished');
      await loadDashboard();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to update guide status',
      );
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

        {activeTab === 'guides' && (
          <GuidesPanel
            articles={articles}
            articleStatusFilter={articleStatusFilter}
            onFilterChange={setArticleStatusFilter}
            onOpenNew={openNewArticleForm}
            onEdit={(article) => void openEditArticleForm(article)}
            onStatusChange={(article, status) => void handleArticleStatus(article, status)}
            onArchive={(article) => void handleArchiveArticle(article)}
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

      {isArticleFormOpen && (
        <ArticleFormModal
          editingArticle={editingArticle}
          form={articleForm}
          isSaving={isSavingArticle}
          onChange={setArticleForm}
          onClose={closeArticleForm}
          onSave={() => void handleSaveArticle()}
        />
      )}

      {isOrderDetailOpen && (
        <OrderDetailDrawer
          order={selectedOrder}
          isLoading={isLoadingOrderDetail}
          isSavingRiskReview={isSavingOrderRiskReview}
          error={orderDetailError}
          onSaveRiskReview={(orderId, input) => void handleOrderRiskReview(orderId, input)}
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
                <div className="mt-2 flex flex-wrap gap-2">
                  <ChannelPill method={order.checkoutMethod} />
                  <CustomerTypePill customerType={order.customerType} />
                  <RiskLevelPill level={order.riskLevel} />
                  {order.holdForManualReview ? <ManualReviewPill /> : null}
                </div>
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
                    <RiskLevelPill level={order.riskLevel} />
                    {order.holdForManualReview ? <ManualReviewPill /> : null}
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
  isSavingRiskReview,
  error,
  onSaveRiskReview,
  onClose,
}: {
  order: AdminOrderDetail | null;
  isLoading: boolean;
  isSavingRiskReview: boolean;
  error: string;
  onSaveRiskReview: (
    orderId: string,
    input: {
      hold_for_manual_review?: boolean;
      fraud_notes?: string;
      risk_level_override?: 'LOW' | 'MEDIUM' | 'HIGH';
    },
  ) => void;
  onClose: () => void;
}) {
  const [fraudNotesDraft, setFraudNotesDraft] = useState('');
  const [holdForManualReviewDraft, setHoldForManualReviewDraft] = useState(false);

  useEffect(() => {
    setFraudNotesDraft(order?.fraudNotes ?? '');
    setHoldForManualReviewDraft(order?.holdForManualReview ?? false);
  }, [order]);

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
                    <InfoRow label="Risk band" value={order.riskLevel} />
                    <InfoRow
                      label="Manual review"
                      value={order.holdForManualReview ? 'Required' : 'Not required'}
                    />
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
                    <InfoRow label="Street address" value={order.shippingAddress?.street ?? 'No address'} />
                    <InfoRow label="Area / district" value={order.shippingAddress?.area ?? 'Not provided'} />
                    <InfoRow label="City / town" value={order.shippingAddress?.city ?? 'Not provided'} />
                    <InfoRow label="LGA" value={order.shippingAddress?.lga ?? 'Not provided'} />
                    <InfoRow label="State" value={order.shippingAddress?.state ?? 'Not provided'} />
                    <InfoRow label="Landmark" value={order.shippingAddress?.landmark ?? 'Not provided'} />
                    <InfoRow
                      label="Delivery notes"
                      value={order.shippingAddress?.deliveryNotes ?? 'No delivery notes'}
                    />
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
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="font-display text-lg font-bold text-surface-950">
                      Order review
                    </h3>
                    <p className="text-sm text-surface-500">
                      Orders that need extra review stay paused here until the ops team clears them for fulfillment.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <RiskLevelPill level={order.riskLevel} />
                      {order.holdForManualReview ? <ManualReviewPill /> : null}
                      {!order.holdForManualReview && order.riskReviewedAt ? <ReviewCompletedPill /> : null}
                    </div>
                  </div>
                  <dl className="grid gap-2 text-sm lg:min-w-80">
                    <InfoRow
                      label="Reviewed at"
                      value={order.riskReviewedAt ? formatDateTime(order.riskReviewedAt) : 'Not reviewed'}
                    />
                    <InfoRow
                      label="Reviewed by"
                      value={order.riskReviewedByName ?? order.riskReviewedBy ?? 'Not reviewed'}
                    />
                  </dl>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                  <div className="rounded-xl border border-surface-200 p-4">
                    <p className="text-sm font-semibold text-surface-900">Review signals</p>
                    {order.riskFlags.length === 0 ? (
                      <p className="mt-3 text-sm text-surface-500">
                        No review signals are currently attached to this order.
                      </p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {order.riskFlags.map((flag) => (
                          <span
                            key={flag}
                            className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800"
                          >
                            {formatRiskFlag(flag)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-surface-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-surface-900">Review controls</p>
                      <label className="flex items-center gap-2 text-sm font-medium text-surface-700">
                        <input
                          type="checkbox"
                          checked={holdForManualReviewDraft}
                          onChange={(event) => setHoldForManualReviewDraft(event.target.checked)}
                        />
                        Needs review before fulfillment
                      </label>
                    </div>

                    <label className="mt-4 grid gap-2 text-sm font-semibold text-surface-700">
                      Fraud notes
                      <textarea
                        value={fraudNotesDraft}
                        onChange={(event) => setFraudNotesDraft(event.target.value)}
                        className="min-h-28 rounded-lg border border-surface-300 px-3 py-2 font-normal"
                        placeholder="Record why the order was reviewed, what was confirmed, and whether it is safe to release."
                      />
                    </label>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          onSaveRiskReview(order.id, {
                            hold_for_manual_review: holdForManualReviewDraft,
                            fraud_notes: fraudNotesDraft,
                          })
                        }
                        disabled={isSavingRiskReview}
                        className="min-h-11 rounded-full bg-primary-600 px-5 text-sm font-semibold text-white hover:bg-primary-700 disabled:bg-surface-300"
                      >
                        {isSavingRiskReview ? 'Saving...' : 'Save review'}
                      </button>
                    </div>
                  </div>
                </div>
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
                  {getProductVisibilityLabel(product)} · {product.stockType}
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
                <td>{getProductVisibilityLabel(product)}</td>
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

function GuidesPanel({
  articles,
  articleStatusFilter,
  onFilterChange,
  onOpenNew,
  onEdit,
  onStatusChange,
  onArchive,
}: {
  articles: AdminBlogPostSummary[];
  articleStatusFilter: string;
  onFilterChange: (value: string) => void;
  onOpenNew: () => void;
  onEdit: (article: AdminBlogPostSummary) => void;
  onStatusChange: (article: AdminBlogPostSummary, status: ArticleFormState['status']) => void;
  onArchive: (article: AdminBlogPostSummary) => void;
}) {
  return (
    <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-surface-950">Guides & articles</h2>
          <p className="text-sm text-surface-500">
            Create, publish, and archive educational guides for the public Guides page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={articleStatusFilter}
            onChange={(event) => onFilterChange(event.target.value)}
            className="min-h-10 rounded-lg border border-surface-300 px-3 text-sm"
            aria-label="Filter guides by status"
          >
            <option value="all">All guides</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <button
            type="button"
            onClick={onOpenNew}
            className="min-h-10 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700"
          >
            New guide
          </button>
        </div>
      </div>

      {articles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-300 p-6 text-center">
          <p className="font-semibold text-surface-900">No guides found</p>
          <p className="mt-1 text-sm text-surface-500">
            Create a draft guide first, then publish it when the copy is ready.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {articles.map((article) => (
              <article key={article.id} className="rounded-xl border border-surface-200 p-4">
                <div className="flex items-start gap-3">
                  {article.coverImage ? (
                    <img
                      src={article.coverImage}
                      alt=""
                      loading="lazy"
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-primary-50" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <BlogStatusBadge status={article.status} />
                      {article.featured ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Featured
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 font-semibold text-surface-950">{article.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-surface-500">
                      {article.excerpt}
                    </p>
                    <p className="mt-2 text-xs text-surface-500">
                      {article.category?.name ?? 'Uncategorized'} · {article.readingTimeMins} min
                      read · Updated {formatDateTime(article.updatedAt)}
                    </p>
                  </div>
                </div>
                <GuideActions
                  article={article}
                  onEdit={onEdit}
                  onStatusChange={onStatusChange}
                  onArchive={onArchive}
                />
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-surface-200 text-xs uppercase text-surface-500">
                <tr>
                  <th className="py-3">Guide</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Views</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {articles.map((article) => (
                  <tr key={article.id}>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        {article.coverImage ? (
                          <img
                            src={article.coverImage}
                            alt=""
                            loading="lazy"
                            className="h-12 w-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-primary-50" aria-hidden="true" />
                        )}
                        <div className="min-w-0">
                          <p className="max-w-80 truncate font-semibold text-surface-950">
                            {article.title}
                          </p>
                          <p className="max-w-80 truncate text-xs text-surface-500">
                            /blog/{article.slug}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>{article.category?.name ?? 'Uncategorized'}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <BlogStatusBadge status={article.status} />
                        {article.featured ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            Featured
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>{article.views}</td>
                    <td>{formatDateTime(article.updatedAt)}</td>
                    <td>
                      <GuideActions
                        article={article}
                        onEdit={onEdit}
                        onStatusChange={onStatusChange}
                        onArchive={onArchive}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function GuideActions({
  article,
  onEdit,
  onStatusChange,
  onArchive,
}: {
  article: AdminBlogPostSummary;
  onEdit: (article: AdminBlogPostSummary) => void;
  onStatusChange: (article: AdminBlogPostSummary, status: ArticleFormState['status']) => void;
  onArchive: (article: AdminBlogPostSummary) => void;
}) {
  const isPublished = article.status === 'PUBLISHED';
  const isArchived = article.status === 'ARCHIVED';

  return (
    <div className="mt-4 flex flex-wrap gap-2 md:mt-0">
      <button
        type="button"
        onClick={() => onEdit(article)}
        className="min-h-10 rounded-lg border border-surface-300 px-3 text-sm font-semibold text-surface-700 hover:border-primary-300 hover:text-primary-700"
      >
        Edit
      </button>
      {!isArchived ? (
        <button
          type="button"
          onClick={() => onStatusChange(article, isPublished ? 'DRAFT' : 'PUBLISHED')}
          className={
            isPublished
              ? 'min-h-10 rounded-lg px-3 text-sm font-semibold text-amber-700 hover:bg-amber-50'
              : 'min-h-10 rounded-lg px-3 text-sm font-semibold text-green-700 hover:bg-green-50'
          }
        >
          {isPublished ? 'Unpublish' : 'Publish'}
        </button>
      ) : null}
      {!isArchived ? (
        <button
          type="button"
          onClick={() => onArchive(article)}
          className="min-h-10 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
        >
          Archive
        </button>
      ) : null}
    </div>
  );
}

function BlogStatusBadge({ status }: { status: AdminBlogPostSummary['status'] }) {
  const classes = {
    DRAFT: 'bg-surface-100 text-surface-700',
    PUBLISHED: 'bg-green-100 text-green-800',
    ARCHIVED: 'bg-red-100 text-red-700',
  } satisfies Record<AdminBlogPostSummary['status'], string>;

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${classes[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
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

function ArticleFormModal({
  editingArticle,
  form,
  isSaving,
  onChange,
  onClose,
  onSave,
}: {
  editingArticle: AdminBlogPostDetail | null;
  form: ArticleFormState;
  isSaving: boolean;
  onChange: (nextForm: ArticleFormState) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const isEditing = editingArticle !== null;
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState('');

  async function handleCoverImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const fileInput = event.currentTarget;
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setCoverUploadError('Choose an image file for the guide cover.');
      fileInput.value = '';
      return;
    }

    if (file.size > MAX_ADMIN_IMAGE_UPLOAD_BYTES) {
      setCoverUploadError('Guide cover image must be 5MB or smaller.');
      fileInput.value = '';
      return;
    }

    setIsUploadingCover(true);
    setCoverUploadError('');

    try {
      const response = await uploadAdminArticleCoverImage(file);
      onChange({ ...form, coverImage: response.data.url });
    } catch (requestError) {
      setCoverUploadError(
        requestError instanceof Error ? requestError.message : 'Unable to upload guide cover',
      );
    } finally {
      setIsUploadingCover(false);
      fileInput.value = '';
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/50 p-4">
      <section
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
        aria-labelledby="article-form-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
              Guide management
            </p>
            <h2 id="article-form-title" className="font-display text-2xl font-bold text-surface-950">
              {isEditing ? 'Edit guide' : 'New guide'}
            </h2>
            <p className="mt-1 text-sm text-surface-500">
              Use plain text or simple HTML for now. Published guides appear on the public Guides
              page.
            </p>
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
            Title
            <input
              value={form.title}
              onChange={(event) => onChange({ ...form, title: event.target.value })}
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
              placeholder="How preordering from China to Nigeria works"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700">
            Slug
            <input
              value={form.slug}
              onChange={(event) => onChange({ ...form, slug: event.target.value })}
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
              placeholder="how-preordering-works"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700">
            Category
            <input
              value={form.categoryName}
              onChange={(event) => onChange({ ...form, categoryName: event.target.value })}
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
              placeholder="Preorder Guide"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700 sm:col-span-2">
            Excerpt
            <textarea
              value={form.excerpt}
              onChange={(event) => onChange({ ...form, excerpt: event.target.value })}
              rows={3}
              className="rounded-lg border border-surface-300 px-3 py-2 font-normal"
              placeholder="Short summary shown on guide cards"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700 sm:col-span-2">
            Content
            <textarea
              value={form.content}
              onChange={(event) => onChange({ ...form, content: event.target.value })}
              rows={12}
              className="rounded-lg border border-surface-300 px-3 py-2 font-mono text-sm font-normal"
              placeholder="<h2>Step 1</h2><p>Explain the preorder flow...</p>"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700">
            Tags
            <input
              value={form.tags}
              onChange={(event) => onChange({ ...form, tags: event.target.value })}
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
              placeholder="preorder, delivery, Paystack"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700">
            Status
            <select
              value={form.status}
              onChange={(event) =>
                onChange({ ...form, status: event.target.value as ArticleFormState['status'] })
              }
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>

          <div className="grid gap-3 rounded-xl border border-surface-200 p-4 sm:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-surface-700">Cover image</p>
                <p className="mt-1 text-xs text-surface-500">
                  Upload from your computer, or paste a Cloudinary/image URL below.
                </p>
              </div>
              {form.coverImage ? (
                <button
                  type="button"
                  onClick={() => {
                    setCoverUploadError('');
                    onChange({ ...form, coverImage: '' });
                  }}
                  className="min-h-10 rounded-lg border border-surface-300 px-3 text-sm font-semibold text-surface-700 hover:bg-surface-50"
                >
                  Remove image
                </button>
              ) : null}
            </div>

            {form.coverImage ? (
              <div className="overflow-hidden rounded-xl border border-surface-200 bg-surface-50">
                <img
                  src={form.coverImage}
                  alt="Guide cover preview"
                  className="h-44 w-full object-cover sm:h-56"
                />
              </div>
            ) : (
              <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-surface-300 bg-surface-50 text-sm text-surface-500">
                Cover preview appears here after upload.
              </div>
            )}

            <label className="grid gap-1 text-sm font-semibold text-surface-700">
              Upload cover image
              <input
                type="file"
                accept="image/*"
                onChange={(event) => void handleCoverImageUpload(event)}
                disabled={isUploadingCover}
                className="block min-h-11 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-700 hover:file:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>

            <label className="grid gap-1 text-sm font-semibold text-surface-700">
              Cover image URL
              <input
                value={form.coverImage}
                onChange={(event) => {
                  setCoverUploadError('');
                  onChange({ ...form, coverImage: event.target.value });
                }}
                className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
                placeholder="https://res.cloudinary.com/..."
              />
            </label>

            {isUploadingCover ? (
              <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700">
                Uploading cover image to Cloudinary...
              </p>
            ) : null}
            {coverUploadError ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {coverUploadError}
              </p>
            ) : null}
          </div>

          <label className="grid gap-1 text-sm font-semibold text-surface-700">
            SEO title
            <input
              value={form.seoTitle}
              onChange={(event) => onChange({ ...form, seoTitle: event.target.value })}
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
              placeholder="Optional search title"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700">
            SEO description
            <input
              value={form.seoDescription}
              onChange={(event) => onChange({ ...form, seoDescription: event.target.value })}
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
              placeholder="Optional search description"
            />
          </label>

          <label className="flex items-center gap-3 rounded-lg border border-surface-200 p-3 text-sm font-semibold text-surface-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(event) => onChange({ ...form, featured: event.target.checked })}
              className="h-4 w-4 rounded border-surface-300 text-primary-600"
            />
            Feature this guide on the public Guides page
          </label>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-surface-300 px-4 text-sm font-semibold text-surface-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="min-h-11 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : isEditing ? 'Save changes' : 'Create guide'}
          </button>
        </div>
      </section>
    </div>
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

  function handleAddVariant() {
    onChange({
      ...form,
      variants: [
        ...form.variants,
        {
          name: '',
          price: form.basePrice,
          stock: form.stockType === 'PREORDER' ? '0' : form.inventoryQuantity,
          sku: '',
        },
      ],
    });
  }

  function handleUpdateVariant(variantIndex: number, updates: Partial<ProductVariantFormState>) {
    onChange({
      ...form,
      variants: form.variants.map((variant, index) =>
        index === variantIndex ? { ...variant, ...updates } : variant,
      ),
    });
  }

  function handleRemoveVariant(variantIndex: number) {
    onChange({
      ...form,
      variants: form.variants.filter((_, index) => index !== variantIndex),
    });
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

          <div className="grid gap-3 rounded-lg border border-dashed border-primary-200 bg-primary-50/40 p-4 sm:col-span-2">
            <div>
              <p className="text-sm font-semibold text-surface-900">Preorder pricing protection</p>
              <p className="text-xs leading-5 text-surface-600">
                Optional operational inputs for preorder batches. These help document the FX and
                landed-cost assumptions behind the current preorder price. They are not required
                for regular products and internal cost snapshots are not shown to customers.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-surface-700">
                Pricing batch label
                <input
                  value={form.pricingBatchLabel}
                  onChange={(event) => onChange({ ...form, pricingBatchLabel: event.target.value })}
                  className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
                  placeholder="Batch A - May 2026"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-surface-700">
                FX rate snapshot
                <input
                  value={form.fxRateSnapshot}
                  onChange={(event) => onChange({ ...form, fxRateSnapshot: event.target.value })}
                  inputMode="decimal"
                  className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
                  placeholder="Optional"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-surface-700">
                FX adjustment percent
                <input
                  value={form.fxAdjustmentPercent}
                  onChange={(event) => onChange({ ...form, fxAdjustmentPercent: event.target.value })}
                  inputMode="decimal"
                  className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
                  placeholder="Optional"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-surface-700">
                Shipping buffer percent
                <input
                  value={form.shippingBufferPercent}
                  onChange={(event) => onChange({ ...form, shippingBufferPercent: event.target.value })}
                  inputMode="decimal"
                  className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
                  placeholder="Optional"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-surface-700">
                Preorder margin percent
                <input
                  value={form.preorderMarginPercent}
                  onChange={(event) => onChange({ ...form, preorderMarginPercent: event.target.value })}
                  inputMode="decimal"
                  className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
                  placeholder="Optional"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-surface-700">
                Supplier cost snapshot
                <input
                  value={form.supplierCostSnapshot}
                  onChange={(event) => onChange({ ...form, supplierCostSnapshot: event.target.value })}
                  inputMode="decimal"
                  className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
                  placeholder="Optional"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-surface-700">
                Shipping cost snapshot
                <input
                  value={form.shippingCostSnapshot}
                  onChange={(event) => onChange({ ...form, shippingCostSnapshot: event.target.value })}
                  inputMode="decimal"
                  className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
                  placeholder="Optional"
                />
              </label>
            </div>
          </div>

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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-surface-700">Variants</p>
                <p className="text-xs leading-5 text-surface-500">
                  Optional. Use variants for sizes, colors, or models. Leave empty to use the main
                  product price and inventory quantity.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddVariant}
                className="min-h-10 rounded-lg border border-primary-200 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-50"
              >
                Add variant
              </button>
            </div>

            {form.variants.length > 0 ? (
              <div className="space-y-3">
                {form.variants.map((variant, variantIndex) => (
                  <div
                    key={variant.id ?? variantIndex}
                    className="grid gap-3 rounded-lg border border-surface-200 p-3 sm:grid-cols-2"
                  >
                    <label className="grid gap-1 text-sm font-semibold text-surface-700">
                      Variant name
                      <input
                        value={variant.name}
                        onChange={(event) =>
                          handleUpdateVariant(variantIndex, { name: event.target.value })
                        }
                        className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
                        placeholder="Black / 128GB"
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold text-surface-700">
                      SKU
                      <input
                        value={variant.sku}
                        onChange={(event) =>
                          handleUpdateVariant(variantIndex, { sku: event.target.value })
                        }
                        className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
                        placeholder="Optional"
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold text-surface-700">
                      Price
                      <input
                        value={variant.price}
                        onChange={(event) =>
                          handleUpdateVariant(variantIndex, { price: event.target.value })
                        }
                        inputMode="decimal"
                        className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
                        placeholder={form.basePrice || '25000'}
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold text-surface-700">
                      Stock
                      <input
                        value={variant.stock}
                        onChange={(event) =>
                          handleUpdateVariant(variantIndex, { stock: event.target.value })
                        }
                        inputMode="numeric"
                        className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
                        placeholder="0"
                      />
                    </label>
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(variantIndex)}
                        className="min-h-9 rounded-lg px-3 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Remove variant
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-surface-300 bg-surface-50 px-3 py-4 text-sm text-surface-500">
                No variants configured. Customers will buy this product using the main product
                price.
              </div>
            )}
          </div>

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

          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-surface-200 px-3 text-sm font-semibold text-surface-700">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(event) => onChange({ ...form, isPublished: event.target.checked })}
            />
            Published to storefront
          </label>

          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800">
            <input
              type="checkbox"
              checked={form.isSoldOut}
              onChange={(event) => onChange({ ...form, isSoldOut: event.target.checked })}
            />
            Mark as sold out
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700">
            Marketing badge
            <select
              value={form.marketingBadge}
              onChange={(event) =>
                onChange({
                  ...form,
                  marketingBadge: event.target.value as ProductFormState['marketingBadge'],
                })
              }
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
            >
              <option value="">No badge</option>
              <option value="SELLING_FAST">Selling Fast</option>
              <option value="TRENDING">Trending Item</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-surface-700">
            Approval status
            <select
              value={form.approvalStatus}
              onChange={(event) =>
                onChange({
                  ...form,
                  approvalStatus: event.target.value as ProductFormState['approvalStatus'],
                })
              }
              className="min-h-11 rounded-lg border border-surface-300 px-3 font-normal"
            >
              <option value="APPROVED">Approved</option>
              <option value="PENDING_REVIEW">Pending review</option>
              <option value="REJECTED">Rejected</option>
              <option value="ARCHIVED">Archived</option>
            </select>
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

function RiskLevelPill({ level }: { level: AdminOrderListItem['riskLevel'] }) {
  const styles = {
    LOW: 'bg-emerald-50 text-emerald-700',
    MEDIUM: 'bg-amber-50 text-amber-800',
    HIGH: 'bg-red-50 text-red-700',
  } satisfies Record<AdminOrderListItem['riskLevel'], string>;

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${styles[level]}`}>
      Risk {level.toLowerCase()}
    </span>
  );
}

function ManualReviewPill() {
  return (
    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
      Needs review
    </span>
  );
}

function ReviewCompletedPill() {
  return (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
      Review completed
    </span>
  );
}

function formatRiskFlag(flag: string): string {
  return flag
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">{label}</p>
      <p className="mt-1 text-surface-900">{value}</p>
    </div>
  );
}

function formatNullableBoolean(value: boolean | null): string {
  if (value === null) {
    return 'Unknown';
  }

  return value ? 'Yes' : 'No';
}

function getProductVisibilityLabel(product: AdminProductSummary): string {
  if (!product.isActive) {
    return 'Inactive';
  }

  if (product.isSoldOut) {
    return 'Sold out';
  }

  if (!product.isPublished) {
    return 'Unpublished';
  }

  if (product.approvalStatus !== 'APPROVED') {
    return product.approvalStatus.replace(/_/g, ' ');
  }

  return 'Public';
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
