-- CreateEnum
CREATE TYPE "ProductStockType" AS ENUM ('IN_STOCK', 'PREORDER');

-- CreateEnum
CREATE TYPE "ProductApprovalStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING', 'PAID', 'PROCESSING', 'INSPECTION_PENDING', 'INSPECTION_PASSED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "status" TYPE "OrderStatus_new" USING (
  CASE
    WHEN "status"::text = 'CONFIRMED' THEN 'PAID'
    WHEN "status"::text = 'CUSTOMS' THEN 'IN_TRANSIT'
    WHEN "status"::text = 'OUT_FOR_DELIVERY' THEN 'IN_TRANSIT'
    WHEN "status"::text = 'REFUNDED' THEN 'CANCELLED'
    ELSE "status"::text
  END::"OrderStatus_new"
);
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('PENDING', 'AUTHORIZED', 'SUCCESS', 'FAILED', 'ABANDONED', 'REFUNDED');
ALTER TABLE "payments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "payments" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING (
  CASE
    WHEN "status"::text = 'PROCESSING' THEN 'PENDING'
    ELSE "status"::text
  END::"PaymentStatus_new"
);
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "PaymentStatus_old";
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropIndex
DROP INDEX "cart_items_cart_id_product_id_key";

-- DropIndex
DROP INDEX "orders_order_number_idx";

-- DropIndex
DROP INDEX "orders_status_idx";

-- DropIndex
DROP INDEX "orders_user_id_idx";

-- DropIndex
DROP INDEX "payments_order_id_idx";

-- DropIndex
DROP INDEX "preorder_campaigns_product_id_idx";

-- DropIndex
DROP INDEX "preorder_campaigns_status_idx";

-- DropIndex
DROP INDEX "product_images_product_id_idx";

-- DropIndex
DROP INDEX "product_variants_product_id_idx";

-- DropIndex
DROP INDEX "products_stock_type_idx";

-- DropIndex
DROP INDEX "shipment_events_shipment_id_idx";

-- DropIndex
DROP INDEX "shipments_order_id_idx";

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "inspection_required" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stock_type_snapshot" "ProductStockType";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivered_at" TIMESTAMP(3),
ADD COLUMN     "inspection_status" "InspectionStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "payment_reference" TEXT,
ADD COLUMN     "shipped_at" TIMESTAMP(3),
ADD COLUMN     "stock_type_snapshot" "ProductStockType",
ADD COLUMN     "tracking_carrier" TEXT,
ADD COLUMN     "tracking_number" TEXT,
ADD COLUMN     "tracking_url" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "access_code" TEXT,
ADD COLUMN     "amount_captured" DECIMAL(12,2),
ADD COLUMN     "amount_refunded" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "authorization_url" TEXT,
ADD COLUMN     "channel" TEXT,
ADD COLUMN     "customer_email" TEXT,
ADD COLUMN     "fees" DECIMAL(12,2),
ADD COLUMN     "gateway_response" TEXT,
ADD COLUMN     "provider_transaction_id" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "verified_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "admin_approved_at" TIMESTAMP(3),
ADD COLUMN     "approval_status" "ProductApprovalStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
ADD COLUMN     "approved_by_user_id" TEXT,
ADD COLUMN     "estimated_arrival_at" TIMESTAMP(3),
ADD COLUMN     "inventory_quantity" INTEGER,
ADD COLUMN     "is_published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preorder_ends_at" TIMESTAMP(3),
ADD COLUMN     "preorder_slots_remaining" INTEGER,
ADD COLUMN     "preorder_slots_total" INTEGER,
ADD COLUMN     "preorder_starts_at" TIMESTAMP(3),
ADD COLUMN     "sales_velocity_30d" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sales_velocity_7d" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "source_country" TEXT NOT NULL DEFAULT 'China',
ADD COLUMN     "stock_type_new" "ProductStockType" NOT NULL DEFAULT 'IN_STOCK',
ADD COLUMN     "trending_score" DECIMAL(10,4) NOT NULL DEFAULT 0,
ADD COLUMN     "units_sold_total" INTEGER NOT NULL DEFAULT 0;

-- Migrate legacy stock type values without dropping live product data.
UPDATE "products"
SET "stock_type_new" = CASE
  WHEN "stock_type"::text = 'PREORDER' THEN 'PREORDER'::"ProductStockType"
  ELSE 'IN_STOCK'::"ProductStockType"
END;

ALTER TABLE "products" DROP COLUMN "stock_type";
ALTER TABLE "products" RENAME COLUMN "stock_type_new" TO "stock_type";

-- Backfill new order item stock snapshots from the current product stock type.
UPDATE "order_items" oi
SET "stock_type_snapshot" = p."stock_type"
FROM "products" p
WHERE p."id" = oi."product_id"
  AND oi."stock_type_snapshot" IS NULL;

ALTER TABLE "order_items"
ALTER COLUMN "stock_type_snapshot" SET NOT NULL;

-- Backfill payment references before enforcing the new required unique field.
UPDATE "payments"
SET "reference" = CONCAT(COALESCE("provider_ref", 'legacy-pay'), '-', "id")
WHERE "reference" IS NULL;

ALTER TABLE "payments"
ALTER COLUMN "reference" SET NOT NULL;

-- DropEnum
DROP TYPE "StockType";

-- CreateTable
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_id" TEXT,
    "status" "PaymentStatus" NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "cover_image" TEXT,
    "category_id" TEXT,
    "author_id" TEXT,
    "author_name" TEXT,
    "status" "BlogPostStatus" NOT NULL DEFAULT 'DRAFT',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reading_time_mins" INTEGER,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_event_id_key" ON "payment_events"("event_id");

-- CreateIndex
CREATE INDEX "payment_events_payment_id_received_at_idx" ON "payment_events"("payment_id", "received_at");

-- CreateIndex
CREATE INDEX "payment_events_provider_event_type_idx" ON "payment_events"("provider", "event_type");

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "blog_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_status_published_at_idx" ON "blog_posts"("status", "published_at");

-- CreateIndex
CREATE INDEX "blog_posts_category_id_status_idx" ON "blog_posts"("category_id", "status");

-- CreateIndex
CREATE INDEX "blog_posts_featured_status_published_at_idx" ON "blog_posts"("featured", "status", "published_at");

-- CreateIndex
CREATE INDEX "blog_posts_slug_idx" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "addresses_user_id_is_default_idx" ON "addresses"("user_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_product_id_variant_id_key" ON "cart_items"("cart_id", "product_id", "variant_id");

-- CreateIndex
CREATE INDEX "categories_parent_id_sort_order_idx" ON "categories"("parent_id", "sort_order");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE INDEX "orders_user_id_status_created_at_idx" ON "orders"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "orders_payment_reference_idx" ON "orders"("payment_reference");

-- CreateIndex
CREATE INDEX "orders_tracking_number_idx" ON "orders"("tracking_number");

-- CreateIndex
CREATE INDEX "orders_inspection_status_idx" ON "orders"("inspection_status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");

-- CreateIndex
CREATE INDEX "payments_order_id_status_idx" ON "payments"("order_id", "status");

-- CreateIndex
CREATE INDEX "payments_provider_status_idx" ON "payments"("provider", "status");

-- CreateIndex
CREATE INDEX "payments_paid_at_idx" ON "payments"("paid_at");

-- CreateIndex
CREATE INDEX "preorder_campaigns_product_id_status_idx" ON "preorder_campaigns"("product_id", "status");

-- CreateIndex
CREATE INDEX "preorder_campaigns_starts_at_ends_at_idx" ON "preorder_campaigns"("starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "preorder_slots_campaign_id_user_id_key" ON "preorder_slots"("campaign_id", "user_id");

-- CreateIndex
CREATE INDEX "product_images_product_id_sort_order_idx" ON "product_images"("product_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_product_id_sort_order_key" ON "product_images"("product_id", "sort_order");

-- CreateIndex
CREATE INDEX "product_variants_product_id_is_active_idx" ON "product_variants"("product_id", "is_active");

-- CreateIndex
CREATE INDEX "products_stock_type_approval_status_is_active_is_published_idx" ON "products"("stock_type", "approval_status", "is_active", "is_published");

-- CreateIndex
CREATE INDEX "products_is_featured_is_active_is_published_idx" ON "products"("is_featured", "is_active", "is_published");

-- CreateIndex
CREATE INDEX "products_trending_score_sales_velocity_7d_is_active_is_publ_idx" ON "products"("trending_score", "sales_velocity_7d", "is_active", "is_published");

-- CreateIndex
CREATE INDEX "products_preorder_ends_at_idx" ON "products"("preorder_ends_at");

-- CreateIndex
CREATE INDEX "shipment_events_shipment_id_occurred_at_idx" ON "shipment_events"("shipment_id", "occurred_at");

-- CreateIndex
CREATE INDEX "shipments_order_id_status_idx" ON "shipments"("order_id", "status");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "blog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "products"
ADD CONSTRAINT "products_preorder_slots_remaining_nonnegative"
CHECK ("preorder_slots_remaining" IS NULL OR "preorder_slots_remaining" >= 0);

-- AddCheckConstraint
ALTER TABLE "products"
ADD CONSTRAINT "products_preorder_slots_total_gte_remaining"
CHECK (
  "preorder_slots_total" IS NULL
  OR "preorder_slots_remaining" IS NULL
  OR "preorder_slots_total" >= "preorder_slots_remaining"
);

