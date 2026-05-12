-- Add hashed guest order access fields. Raw guest access tokens must never be stored.
ALTER TABLE "orders"
ADD COLUMN "guest_access_token_hash" TEXT,
ADD COLUMN "guest_access_token_expires_at" TIMESTAMP(3);

CREATE INDEX "orders_guest_access_token_hash_idx" ON "orders"("guest_access_token_hash");
CREATE INDEX "orders_guest_access_token_expires_at_idx" ON "orders"("guest_access_token_expires_at");
