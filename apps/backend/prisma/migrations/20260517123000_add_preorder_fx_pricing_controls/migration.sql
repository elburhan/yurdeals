-- Phase 1 preorder FX protection metadata.
-- Nullable fields preserve existing products and historical order snapshots.
ALTER TABLE "products"
ADD COLUMN "fx_adjustment_percent" DECIMAL(7, 2),
ADD COLUMN "shipping_buffer_percent" DECIMAL(7, 2),
ADD COLUMN "preorder_margin_percent" DECIMAL(7, 2),
ADD COLUMN "fx_rate_snapshot" DECIMAL(14, 4),
ADD COLUMN "supplier_cost_snapshot" DECIMAL(12, 2),
ADD COLUMN "shipping_cost_snapshot" DECIMAL(12, 2),
ADD COLUMN "pricing_batch_label" TEXT;
