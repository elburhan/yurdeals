-- Add one durable inventory reservation row per order item.
-- Reservation attempt history is stored through PaymentEvent rows.

CREATE TYPE "InventoryReservationStatus" AS ENUM ('ACTIVE', 'CONFIRMED', 'RELEASED', 'EXPIRED');

CREATE TABLE "inventory_reservations" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "order_item_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "variant_id" TEXT,
  "stock_type" "ProductStockType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "InventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "confirmed_at" TIMESTAMP(3),
  "released_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_reservations_order_item_id_key"
  ON "inventory_reservations"("order_item_id");

CREATE INDEX "inventory_reservations_order_id_status_idx"
  ON "inventory_reservations"("order_id", "status");

CREATE INDEX "inventory_reservations_product_id_variant_id_status_idx"
  ON "inventory_reservations"("product_id", "variant_id", "status");

CREATE INDEX "inventory_reservations_expires_at_status_idx"
  ON "inventory_reservations"("expires_at", "status");

ALTER TABLE "inventory_reservations"
  ADD CONSTRAINT "inventory_reservations_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_reservations"
  ADD CONSTRAINT "inventory_reservations_order_item_id_fkey"
  FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_reservations"
  ADD CONSTRAINT "inventory_reservations_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_reservations"
  ADD CONSTRAINT "inventory_reservations_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
