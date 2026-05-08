BEGIN;

-- Fresh-start reset for the order domain only.
-- This keeps users, products, categories, carts, addresses, and editorial data intact.
TRUNCATE TABLE
  "payment_events",
  "shipment_events",
  "payments",
  "order_items",
  "shipments",
  "orders";

-- Recreate the dedicated order number sequence from a clean starting point.
DROP SEQUENCE IF EXISTS "public"."order_number_seq";

CREATE SEQUENCE "public"."order_number_seq"
  START WITH 1001
  INCREMENT BY 1
  MINVALUE 1001
  NO MAXVALUE
  CACHE 1;

-- Tie the sequence lifecycle to the orders table.
ALTER SEQUENCE "public"."order_number_seq" OWNED BY "orders"."order_number";

-- Set the current value so the first generated order number becomes YD1001.
SELECT setval('public.order_number_seq', 1001, false);

COMMIT;
