CREATE SEQUENCE IF NOT EXISTS "order_number_seq"
  START WITH 1001
  INCREMENT BY 1
  MINVALUE 1001
  NO MAXVALUE
  CACHE 1;

SELECT setval(
  'order_number_seq',
  GREATEST(
    COALESCE(
      (
        SELECT MAX((substring("order_number" from 3))::bigint)
        FROM "orders"
        WHERE "order_number" ~ '^YD[0-9]+$'
      ),
      1000
    ),
    1000
  ),
  true
);
