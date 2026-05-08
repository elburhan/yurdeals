BEGIN;

DELETE FROM "preorder_slots";
DELETE FROM "preorder_campaigns";
DELETE FROM "reviews";
DELETE FROM "wishlist_items";
DELETE FROM "cart_items";
DELETE FROM "order_items";
DELETE FROM "product_images";
DELETE FROM "product_variants";
DELETE FROM "products";

COMMIT;
