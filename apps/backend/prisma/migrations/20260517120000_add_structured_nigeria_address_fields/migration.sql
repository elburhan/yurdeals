-- Add structured Nigerian delivery fields without breaking existing addresses.
ALTER TABLE "addresses"
ADD COLUMN "lga" TEXT,
ADD COLUMN "area" TEXT,
ADD COLUMN "landmark" TEXT,
ADD COLUMN "delivery_notes" TEXT;
