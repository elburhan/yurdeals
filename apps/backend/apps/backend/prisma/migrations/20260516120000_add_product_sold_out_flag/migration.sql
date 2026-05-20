-- Add explicit admin sold-out override for products.
ALTER TABLE "products"
ADD COLUMN "is_sold_out" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "products_is_sold_out_is_active_is_published_idx"
ON "products"("is_sold_out", "is_active", "is_published");
