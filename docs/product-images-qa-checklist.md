# Product Images QA Checklist

Use this checklist after changing product image upload, ordering, or storefront rendering.

## Admin Setup

- Create a product from the admin dashboard with at least three product images.
- Upload each image through the existing Cloudinary-backed image upload control.
- Confirm each uploaded image URL fills the intended image slot.
- Confirm the first image slot is labeled as the primary image.
- Save the product and refresh the admin products list.

## Storefront Verification

- Open the home page or category listing where the product appears.
- Confirm the product card uses the first admin image as its product image.
- Open the product detail page.
- Confirm the product detail gallery shows all images in the same order as admin.
- Click desktop thumbnails and confirm the main image changes.
- On mobile, swipe the gallery horizontally and confirm all images are reachable.

## Edit/Reorder Verification

- Edit the product in admin.
- Move a different image into the first slot.
- Save the product and reload the storefront.
- Confirm the product card now uses the new first image.
- Confirm the PDP thumbnail/gallery order matches the updated admin order.

## Fallback Verification

- Temporarily paste an invalid image URL into a non-production test product.
- Confirm product cards show the branded placeholder instead of a broken image icon.
- Confirm the PDP gallery, thumbnails, and zoom preview show the branded placeholder.
- Remove all image URLs from a test product only if the current validation allows it.
- Confirm the PDP and product card still keep stable layout with placeholders.
