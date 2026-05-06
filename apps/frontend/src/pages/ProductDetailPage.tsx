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
          setSelectedVariantId(response.data.product.variants[0]?.id ?? '');
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

    if (product.stockType === 'LOCAL' && product.variants.length > 0 && !selectedVariantId) {
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
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                    Estimated Arrival: 25-40 days
                  </span>
                  <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-bold text-primary-700">
                    {product.stockType === 'PREORDER' ? 'Preorder' : 'Local stock'}
                  </span>
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
                  <p className="mt-3 inline-flex rounded-full bg-primary-50 px-3 py-1.5 text-sm font-bold text-primary-700 ring-1 ring-primary-100">
                    Free shipping on orders above NGN 500,000
                  </p>
                  <Link
                    to="/blog/how-preordering-from-china-to-nigeria-works-step-by-step"
                    className="mt-3 inline-flex min-h-10 items-center rounded-full border border-primary-200 bg-white px-4 text-sm font-bold text-primary-700 hover:bg-primary-50"
                  >
                    Not sure how preordering works? Read our complete guide
                  </Link>
                </div>

                <div className="rounded-full bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm">
                  Factory Direct - We Inspect in China
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-800 shadow-sm">
                  Limited preorder slots at this price. Only 12 left before prices rise after arrival in Nigeria.
                </div>

                <p className="text-base leading-7 text-surface-600">{product.description}</p>
                <TrustBanner variant={product.stockType === 'PREORDER' ? 'delivery' : 'checkout'} />

                <div className="rounded-lg border border-surface-200 bg-white p-4">
                  <h2 className="mb-3 font-semibold text-surface-950">Available variants</h2>
                  {product.variants.length > 0 ? (
                    <div className="space-y-2">
                      {product.variants.map((variant) => (
                        <label
                          key={variant.id}
                          className={`flex min-h-12 cursor-pointer flex-col gap-2 rounded-lg border px-3 py-3 text-base sm:flex-row sm:items-center sm:justify-between sm:text-sm ${
                            selectedVariantId === variant.id
                              ? 'border-primary-400 bg-primary-50'
                              : 'border-surface-200 bg-surface-50'
                          }`}
                        >
                          <span className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
                            <input
                              type="radio"
                              name="variant"
                              value={variant.id}
                              checked={selectedVariantId === variant.id}
                              onChange={() => setSelectedVariantId(variant.id)}
                              className="h-4 w-4 accent-primary-600"
                            />
                            {variant.name}
                          </span>
                          <span className="w-full font-medium sm:w-auto">
                            {formatPrice(variant.price, product.currency)} - {variant.stock} left
                          </span>
                        </label>
                      ))}
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
                        Stock and price are checked on the server.
                      </p>
                    </div>
                    <QuantityStepper
                      value={quantity}
                      max={selectedVariant?.stock ?? 99}
                      onChange={setQuantity}
                    />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={isAdding}
                      onClick={() => void handlePreorderNow()}
                      className="min-h-[52px] w-full rounded-full bg-primary-500 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-primary-600 active:bg-primary-700 disabled:cursor-not-allowed disabled:bg-surface-300"
                    >
                      {isAdding ? 'Adding...' : 'Preorder Now - Pay Now'}
                    </button>
                    <button
                      type="button"
                      disabled={isAdding}
                      onClick={() => void handleAddToCart()}
                      className="min-h-[52px] w-full rounded-full border border-primary-200 bg-white px-5 py-3 font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:text-surface-400"
                    >
                      Add to Cart
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
              isAdding={isAdding}
              onPreorder={() => void handlePreorderNow()}
            />
          </>
        )}
      </section>
    </main>
  );
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
