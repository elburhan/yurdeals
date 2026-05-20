CREATE TYPE "ProductMarketingBadge" AS ENUM ('SELLING_FAST', 'TRENDING');

ALTER TABLE "products"
ADD COLUMN "marketing_badge" "ProductMarketingBadge";
