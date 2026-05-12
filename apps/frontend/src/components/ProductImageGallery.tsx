import { useEffect, useState } from 'react';
import type { ProductImageSummary } from '@yurdeals/shared';

interface ProductImageGalleryProps {
  images: ProductImageSummary[];
  productName: string;
}

export function ProductImageGallery({ images, productName }: ProductImageGalleryProps): JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [zoomImage, setZoomImage] = useState<ProductImageSummary | null>(null);
  const visibleImages = [...images].sort((first, second) => first.sortOrder - second.sortOrder);

  useEffect(() => {
    if (selectedIndex >= visibleImages.length) {
      setSelectedIndex(0);
    }
  }, [selectedIndex, visibleImages.length]);

  const firstImage = visibleImages[0];

  if (!firstImage) {
    return <ProductImagePlaceholder productName={productName} />;
  }

  const selectedImage = visibleImages[selectedIndex] ?? firstImage;

  return (
    <section className="space-y-3" aria-label="Product image gallery">
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-lg lg:hidden">
        {visibleImages.map((image) => (
          <div
            key={image.id}
            className="aspect-square w-full min-w-full snap-center rounded-lg bg-gradient-to-r from-surface-100 via-surface-200 to-surface-100 bg-[length:200%_100%]"
          >
            <SafeProductImage
              src={image.url}
              alt={image.alt ?? productName}
              productName={productName}
              className="h-full w-full rounded-lg object-cover"
              fetchPriority={image.id === visibleImages[0]?.id ? 'high' : 'auto'}
              loading={image.id === visibleImages[0]?.id ? 'eager' : 'lazy'}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => selectedImage && setZoomImage(selectedImage)}
        className="hidden aspect-square w-full overflow-hidden rounded-lg bg-surface-100 lg:block"
        aria-label="Open product image preview"
      >
        <SafeProductImage
          src={selectedImage.url}
          alt={selectedImage.alt ?? productName}
          productName={productName}
          className="h-full w-full object-cover transition-transform hover:scale-105"
          fetchPriority="high"
          loading="eager"
        />
      </button>

      {visibleImages.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {visibleImages.slice(0, 8).map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`aspect-square overflow-hidden rounded-lg border bg-surface-100 ${
                selectedIndex === index ? 'border-primary-500' : 'border-transparent'
              }`}
              aria-label={`Show image ${index + 1}`}
            >
              <SafeProductImage
                src={image.url}
                alt={image.alt ?? productName}
                productName={productName}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {zoomImage && (
        <div
          className="fixed inset-0 z-[80] hidden items-center justify-center bg-surface-950/80 p-6 lg:flex"
          role="dialog"
          aria-modal="true"
          aria-label="Product image preview"
        >
          <button
            type="button"
            onClick={() => setZoomImage(null)}
            className="absolute right-6 top-6 min-h-12 rounded-full bg-white px-5 text-sm font-bold text-surface-900"
          >
            Close
          </button>
          <SafeProductImage
            src={zoomImage.url}
            alt={zoomImage.alt ?? productName}
            productName={productName}
            className="max-h-full max-w-4xl rounded-lg object-contain"
          />
        </div>
      )}
    </section>
  );
}

function SafeProductImage({
  src,
  alt,
  productName,
  className,
  fetchPriority,
  loading,
}: {
  src: string;
  alt: string;
  productName: string;
  className: string;
  fetchPriority?: 'high' | 'low' | 'auto';
  loading?: 'eager' | 'lazy';
}): JSX.Element {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src.trim()) {
    return <ProductImagePlaceholder productName={productName} className={className} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      fetchPriority={fetchPriority}
      loading={loading}
      onError={() => setHasError(true)}
    />
  );
}

function ProductImagePlaceholder({
  productName,
  className = 'flex aspect-square items-center justify-center rounded-lg bg-gradient-to-br from-primary-100 via-white to-accent-100 p-6 text-center font-semibold text-surface-500',
}: {
  productName: string;
  className?: string;
}): JSX.Element {
  return (
    <div className={`${className} flex items-center justify-center bg-gradient-to-br from-primary-100 via-white to-accent-100 p-4 text-center text-sm font-semibold text-surface-500`}>
      {productName}
    </div>
  );
}
