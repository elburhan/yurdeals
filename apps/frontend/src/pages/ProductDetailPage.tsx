import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ProductDetail } from '@yurdeals/shared';
import { getProduct } from '../lib/catalogApi';
import { CustomerNav } from '../components/CustomerNav';
import { DeliveryTimeline } from '../components/DeliveryTimeline';
import { formatPrice } from '../components/ProductCard';
import { ProductImageGallery } from '../components/ProductImageGallery';
import { QuantityStepper } from '../components/QuantityStepper';
import { RiskFreeSection } from '../components/RiskFreeSection';
import { SkeletonBlock } from '../components/Skeleton';
import { SocialProof } from '../components/SocialProof';
import { StickyPreorderBar } from '../components/StickyPreorderBar';
import { TrustBanner } from '../components/TrustBanner';
import { useCart } from '../hooks/useCart';
import { useToast } from '../context/ToastContext';
import { getDeliveryEstimate } from '../lib/deliveryEstimate';

export default function ProductDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [cartMessage, setCartMessage] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!productId) {
      setError('Product id is missing');
      setIsLoading(false);
      return;
    }

    getProduct(productId)
      .then((response) => {
        if (isMounted) {
          setProduct(response.data.product);
          document.title = `${response.data.product.name} - Preorder to Nigeria | Yurdeals`;
          setSelectedVariantId(getInitialVariantId(response.data.product));
          setError('');
        }
      })
      .catch((requestError: Error) => {
        if (isMounted) {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [productId]);

  async function handleAddToCart(): Promise<boolean> {
    if (!product) return false;

    if (product.isSoldOut) {
      const message = 'This item is currently sold out. Check back later or contact support.';
      setCartMessage(message);
      showToast(message, 'error');
      return false;
    }

    if (product.stockType === 'IN_STOCK' && product.variants.length > 0 && !selectedVariantId) {
      setCartMessage('Select a variant before adding this product.');
      showToast('Select a variant before adding this product.', 'error');
      return false;
    }

    setIsAdding(true);
    setCartMessage('');
    try {
      await addItem({
        product_id: product.id,
        variant_id: selectedVariantId || undefined,
        quantity,
      });
      setCartMessage('Added to cart.');
      showToast(`${product.name} added to cart.`, 'success');
      return true;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to add item';
      setCartMessage(message);
      showToast(message, 'error');
      return false;
    } finally {
      setIsAdding(false);
    }
  }

  async function handlePreorderNow() {
    const added = await handleAddToCart();
    if (added) {
      navigate('/checkout');
    }
  }

  function handleShare() {
    if (!product) return;
    const url = window.location.href;
    const text = `Check this YurDeals preorder: ${product.name} - ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCartMessage('Product link copied.');
    showToast('Product link copied.', 'success');
  }

  const selectedVariant = product?.variants.find((variant) => variant.id === selectedVariantId);
  const preorderPrice = product
    ? formatPrice(selectedVariant?.price ?? product.basePrice, product.currency)
    : '';
  const deliveryEstimate = product ? getDeliveryEstimate(product.stockType) : null;
  const availabilityLabel = product ? getProductAvailabilityLabel(product, selectedVariant?.stock) : null;
  const preorderBatchMessage = product ? getPreorderBatchMessage(product) : null;
  const quantityMax = product ? getQuantityMax(product, selectedVariant?.stock) : 99;
  const isSoldOut = product?.isSoldOut ?? false;
  const marketingBadge = product && !isSoldOut ? getMarketingBadgeLabel(product.marketingBadge) : null;

  return (
    <main className="min-h-screen bg-surface-50 pb-56 lg:pb-0">
      <CustomerNav />

      <section className="container-app space-y-6 py-6">
        {isLoading && (
          <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
            <SkeletonBlock className="aspect-square w-full" />
            <div className="space-y-4">
              <SkeletonBlock className="h-8 w-40" />
              <SkeletonBlock className="h-12 w-full" />
              <SkeletonBlock className="h-8 w-48" />
              <SkeletonBlock className="h-24 w-full" />
              <SkeletonBlock className="h-40 w-full" />
            </div>
          </div>
        )}

        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        {product && (
          <>
            <nav className="flex flex-wrap items-center gap-2 text-sm text-surface-500" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-primary-700">
                Home
              </Link>
              <span>/</span>
              <Link to={`/categories/${product.category.id}`} className="hover:text-primary-700">
                {product.category.name}
              </Link>
              <span>/</span>
              <span className="font-medium text-surface-700">{product.name}</span>
            </nav>

            <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
              <ProductImageGallery images={product.images} productName={product.name} />

              <article className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  {deliveryEstimate && (
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${deliveryEstimate.badgeClassName}`}
                    >
                      <span aria-hidden="true">{deliveryEstimate.icon}</span>
                      <span>{deliveryEstimate.label}</span>
                    </span>
                  )}
                  <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-bold text-primary-700">
                    {product.stockType === 'PREORDER' ? 'Preorder' : 'Local stock'}
                  </span>
                  {isSoldOut && (
                    <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-red-700">
                      Sold Out
                    </span>
                  )}
                  {marketingBadge && (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-800">
                      {marketingBadge}
                    </span>
                  )}
                </div>

                <div>
                  <h1 className="font-display text-3xl font-bold leading-tight text-surface-950 sm:text-4xl">
                    {product.name}
                  </h1>
                  <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-surface-500">
                    Preorder price
                  </p>
                  <p className="font-display text-3xl font-bold text-surface-950">
                    {preorderPrice}
                  </p>
                
                  <Link
                    to="/blog/how-preordering-from-china-to-nigeria-works-step-by-step"
                    className="mt-3 inline-flex min-h-10 items-center rounded-full border border-primary-200 bg-white px-4 text-sm font-bold text-primary-700 hover:bg-primary-50"
                  >
                    Not sure how preordering works? Read our complete guide
                  </Link>
                </div>

                <div className="rounded-full bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm">
                  Factory Direct Prices
                </div>

                {deliveryEstimate && !isSoldOut ? (
                  <div className={`rounded-2xl border p-4 text-sm leading-6 shadow-sm ${deliveryEstimate.panelClassName}`}>
                    <p className={`inline-flex items-center gap-2 font-semibold ${deliveryEstimate.textClassName}`}>
                      <span aria-hidden="true">{deliveryEstimate.icon}</span>
                      <span>{deliveryEstimate.label}</span>
                    </p>
                    <p className={`mt-1 ${deliveryEstimate.textClassName}`}>{deliveryEstimate.note}</p>
                  </div>
                ) : null}

                {isSoldOut ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-800 shadow-sm">
                    This item is currently sold out. Check back later or contact support and we will
                    help you confirm availability.
                  </div>
                ) : availabilityLabel ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-800 shadow-sm">
                    {availabilityLabel}
                  </div>
                ) : null}

                {preorderBatchMessage && !isSoldOut ? (
                  <div className="rounded-2xl border border-primary-200 bg-primary-50 p-4 text-sm leading-6 text-primary-900 shadow-sm">
                    <p className="font-semibold">Preorder batch notice</p>
                    <p className="mt-1">{preorderBatchMessage}</p>
                  </div>
                ) : null}

                <p className="text-base leading-7 text-surface-600">{product.description}</p>
                <TrustBanner variant={product.stockType === 'PREORDER' ? 'delivery' : 'checkout'} />

                <div className="rounded-lg border border-surface-200 bg-white p-4">
                  <h2 className="mb-3 font-semibold text-surface-950">Available variants</h2>
                  {product.variants.length > 0 ? (
                    <div className="space-y-2">
                      {product.variants.map((variant) => {
                        const isVariantUnavailable = getIsVariantUnavailable(product, variant);

                        return (
                          <label
                            key={variant.id}
                            className={`flex min-h-12 flex-col gap-2 rounded-lg border px-3 py-3 text-base sm:flex-row sm:items-center sm:justify-between sm:text-sm ${
                              isVariantUnavailable
                                ? 'cursor-not-allowed border-surface-200 bg-surface-100 text-surface-400'
                                : selectedVariantId === variant.id
                                  ? 'cursor-pointer border-primary-400 bg-primary-50'
                                  : 'cursor-pointer border-surface-200 bg-surface-50'
                            }`}
                          >
                            <span className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
                              <input
                                type="radio"
                                name="variant"
                                value={variant.id}
                                checked={selectedVariantId === variant.id}
                                onChange={() => setSelectedVariantId(variant.id)}
                                disabled={isVariantUnavailable}
                                className="h-4 w-4 accent-primary-600"
                              />
                              {variant.name}
                            </span>
                            <span className="w-full font-medium sm:w-auto">
                              {isVariantUnavailable
                                ? 'Unavailable'
                                : formatPrice(variant.price, product.currency)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-surface-500">Variant details will appear here.</p>
                  )}
                </div>

                <div id="preorder-actions" className="rounded-lg border border-surface-200 bg-white p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-surface-950">Quantity</p>
                      <p className="text-sm text-surface-500 sm:text-xs">
                        Stock and price are checked.
                      </p>
                    </div>
                    <QuantityStepper
                      value={quantity}
                      max={quantityMax}
                      onChange={setQuantity}
                    />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={isAdding || isSoldOut}
                      onClick={() => void handlePreorderNow()}
                      className="min-h-[52px] w-full rounded-full bg-primary-500 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-primary-600 active:bg-primary-700 disabled:cursor-not-allowed disabled:bg-surface-300"
                    >
                      {isSoldOut ? 'Sold Out' : isAdding ? 'Adding...' : 'Preorder Now - Pay Now'}
                    </button>
                    <button
                      type="button"
                      disabled={isAdding || isSoldOut}
                      onClick={() => void handleAddToCart()}
                      className="min-h-[52px] w-full rounded-full border border-primary-200 bg-white px-5 py-3 font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:text-surface-400"
                    >
                      {isSoldOut ? 'Sold Out' : 'Add to Cart'}
                    </button>
                  </div>
                  {cartMessage && (
                    <p className="mt-3 text-sm font-medium text-surface-700" role="status">
                      {cartMessage}
                    </p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleShare}
                    className="min-h-12 rounded-full border border-green-200 bg-green-50 px-5 text-sm font-bold text-green-700"
                  >
                    Share on WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyLink()}
                    className="min-h-12 rounded-full border border-surface-300 bg-white px-5 text-sm font-bold text-surface-700"
                  >
                    Copy Link
                  </button>
                </div>
              </article>
            </div>

            <DeliveryTimeline />

            <section className="grid gap-4 lg:grid-cols-3">
              <InfoSection title="Description">{product.description}</InfoSection>
              <InfoSection title="Specifications">
                Category: {product.category.name}. Stock type: {product.stockType.toLowerCase()}.
              </InfoSection>
              <InfoSection title="Why Preorder This">
                Secure lower preorder pricing before the product reaches the local market.
              </InfoSection>
            </section>

            <RiskFreeSection />
            <SocialProof />

            <StickyPreorderBar
              price={preorderPrice}
              stockType={product.stockType}
              isAdding={isAdding}
              isSoldOut={isSoldOut}
              onPreorder={() => void handlePreorderNow()}
            />
          </>
        )}
      </section>
    </main>
  );
}

function getMarketingBadgeLabel(badge: ProductDetail['marketingBadge']): string | null {
  if (badge === 'SELLING_FAST') {
    return 'Selling Fast';
  }

  if (badge === 'TRENDING') {
    return 'Trending Item';
  }

  return null;
}

function getInitialVariantId(product: ProductDetail): string {
  return product.variants.find((variant) => !getIsVariantUnavailable(product, variant))?.id
    ?? product.variants[0]?.id
    ?? '';
}

function getIsVariantUnavailable(
  product: ProductDetail,
  variant: ProductDetail['variants'][number],
): boolean {
  if (variant.isActive === false) {
    return true;
  }

  return product.stockType === 'IN_STOCK' && variant.stock <= 0;
}

function getProductAvailabilityLabel(
  product: ProductDetail,
  selectedVariantStock?: number,
): string | null {
  if (product.stockType === 'PREORDER') {
    if (product.preorderSlotsRemaining !== null) {
      return `${product.preorderSlotsRemaining} few preorder slot(s) left at this price. Prices may rise due to exchange rate after this batch.`;
    }

    return 'Limited preorder slots at factory pricing. Prices may rise due to exchange rate after this batch.';
  }

  if (selectedVariantStock !== undefined) {
    return `${selectedVariantStock} unit(s) available for this variant.`;
  }

  if (product.inventoryQuantity !== null) {
    return `${product.inventoryQuantity} unit(s) available in local stock.`;
  }

  return null;
}

function getQuantityMax(product: ProductDetail, selectedVariantStock?: number): number {
  if (product.stockType === 'PREORDER' && product.preorderSlotsRemaining !== null) {
    return Math.max(1, product.preorderSlotsRemaining);
  }

  if (selectedVariantStock !== undefined) {
    return Math.max(1, selectedVariantStock);
  }

  if (product.inventoryQuantity !== null) {
    return Math.max(1, product.inventoryQuantity);
  }

  return 99;
}

function getPreorderBatchMessage(product: ProductDetail): string | null {
  if (product.stockType !== 'PREORDER') {
    return null;
  }

  if (isClosingSoon(product.preorderEndsAt)) {
    return 'Current preorder batch closes soon. Secure your slot now because prices may update in future preorder batches.';
  }

  if (product.pricingBatchLabel) {
    return `${product.pricingBatchLabel} is the current preorder batch. Prices may update in future preorder batches.`;
  }

  return 'This preorder price applies to the current batch and may update in future preorder batches.';
}

function isClosingSoon(preorderEndsAt: string | null): boolean {
  if (!preorderEndsAt) {
    return false;
  }

  const closingTime = new Date(preorderEndsAt).getTime();
  if (Number.isNaN(closingTime)) {
    return false;
  }

  const hoursUntilClose = (closingTime - Date.now()) / (1000 * 60 * 60);
  return hoursUntilClose > 0 && hoursUntilClose <= 72;
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
      <h2 className="font-display text-xl font-bold text-surface-950">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-surface-600 sm:text-base sm:leading-7">
        {children}
      </p>
    </section>
  );
}
