# Cloudinary Production Guide

This guide covers product image media setup for YurDeals.

## Required Environment Variables

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Do not expose Cloudinary API secrets to the frontend.

## Upload Verification

1. Log in as admin.
2. Create or edit a product.
3. Upload at least three product images.
4. Save the product.
5. Verify:
   - product card uses the first image
   - product detail gallery shows all images
   - thumbnails follow admin order
   - broken images fall back cleanly

## Image Optimization Recommendations

- Prefer compressed JPG/WebP uploads for product photos.
- Keep product images at reasonable dimensions, such as 1200px wide.
- Use square or 4:5 images for best card/gallery consistency.
- Avoid uploading raw full-resolution camera files when a web-sized image is enough.

## Upload Limits

- Confirm Cloudinary account limits before launch.
- Keep admin uploads limited to product images only.
- Monitor storage and transformation usage after launch.

## Troubleshooting

- Upload fails: check Cloudinary credentials and backend logs.
- Product saves without image: confirm the admin form payload includes `images[]`.
- Gallery order wrong: confirm admin image order and `ProductImage.sortOrder`.
- Broken image on storefront: verify Cloudinary URL accessibility and product image fallback UI.

## Product Image QA Checklist

- Create product with three images.
- Verify card image is primary image.
- Verify PDP gallery has swipe/thumbnail navigation.
- Edit image order and save.
- Verify public order updates.
- Test a deliberately broken image URL and confirm placeholder fallback.
