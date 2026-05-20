-- Phase 1 fraud-risk metadata for order review and fulfillment safety.
ALTER TABLE "orders"
ADD COLUMN "risk_level" TEXT NOT NULL DEFAULT 'LOW',
ADD COLUMN "risk_flags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "risk_reviewed_at" TIMESTAMP(3),
ADD COLUMN "risk_reviewed_by" TEXT,
ADD COLUMN "hold_for_manual_review" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "fraud_notes" TEXT;

CREATE INDEX "orders_hold_for_manual_review_risk_level_created_at_idx"
ON "orders"("hold_for_manual_review", "risk_level", "created_at");

CREATE INDEX "orders_risk_reviewed_by_idx"
ON "orders"("risk_reviewed_by");

ALTER TABLE "orders"
ADD CONSTRAINT "orders_risk_reviewed_by_fkey"
FOREIGN KEY ("risk_reviewed_by") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
