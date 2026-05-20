# Preorder FX Protection

Phase 1 adds optional preorder pricing protection metadata to `Product` so the team can track the assumptions behind a live preorder batch without changing checkout, payment, or order price snapshot behavior.

## Fields

- `fxAdjustmentPercent`: optional FX cushion used when setting the current preorder price.
- `shippingBufferPercent`: optional shipping-risk cushion used when setting the current preorder price.
- `preorderMarginPercent`: optional operational margin applied to the batch.
- `fxRateSnapshot`: optional FX reference rate used when the batch price was approved.
- `supplierCostSnapshot`: optional supplier cost captured when the batch price was approved.
- `shippingCostSnapshot`: optional shipping cost captured when the batch price was approved.
- `pricingBatchLabel`: optional human-readable label for the current batch, such as `Batch A - May 2026`.

All fields are nullable so existing products and historical orders remain valid.

## Ownership and Visibility

- These fields live on `Product` and are managed through admin product create/update flows.
- Historical paid order prices still come from the existing order and order-item price snapshots.
- Checkout, payment verification, and inventory reservation logic do not read or mutate these fields.
- Customer-facing product responses only expose the safe batch label needed for preorder messaging.
- Internal cost snapshots and margin fields remain admin-only.

## Customer Messaging

Storefront messaging should stay high level:

- `Current preorder batch closes soon`
- `Prices may update in future preorder batches`

The storefront can derive urgency from `preorderEndsAt` and display the optional `pricingBatchLabel` when present. It must not show supplier cost, shipping cost, FX snapshot, or margin inputs.

## Migration

The schema change is represented by:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20260517123000_add_preorder_fx_pricing_controls/migration.sql`

If the database migration was not applied yet in your environment, run the appropriate Prisma migration command during deployment:

```bash
npx prisma migrate deploy --schema apps/backend/prisma/schema.prisma
```

For local development where a new migration does not need to be created again:

```bash
npx prisma migrate dev --schema apps/backend/prisma/schema.prisma
```

## Admin Workflow

1. Set the base preorder price as usual.
2. Optionally add the FX, shipping, and cost snapshot inputs for the active batch.
3. Add a `pricingBatchLabel` if the batch should be referenced in customer messaging.
4. Publish the product only after the live preorder window and slot counts are confirmed.

## Scope Limits

Phase 1 does not add:

- automatic repricing,
- batch rollover automation,
- supplier-cost publishing,
- inventory ledger changes,
- order snapshot redesign.
