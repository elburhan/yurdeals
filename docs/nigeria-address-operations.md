# Nigeria Address Operations

YurDeals uses structured Nigerian delivery addresses to reduce failed last-mile delivery while keeping checkout fast on mobile.

## Required Delivery Fields

New checkout and saved-address flows collect:

- Recipient name
- Nigerian phone number
- State
- LGA
- City or town
- Area or district
- Street address
- Landmark
- Optional delivery notes

Landmark is required because Nigerian delivery often depends on known physical references such as bus stops, junctions, plazas, mosques, filling stations, schools, estates, or notable buildings.

## Validation Rules

The backend rejects addresses that are too vague for dispatch, including placeholder values like `123`, `home`, `near road`, `none`, or text with no useful letters. State and LGA values are validated against the internal Nigeria state/LGA dataset. The `Other / Not listed` LGA option exists as a fallback for edge cases and should be reviewed by support before dispatch.

## Backward Compatibility

Existing address records remain valid. The new structured fields are nullable in the database, so older orders can still be viewed and fulfilled from their original street, city, and state values.

## Support Workflow

When preparing delivery:

1. Confirm the delivery phone is reachable on WhatsApp or call.
2. Review state, LGA, city/town, and area/district together.
3. Use the landmark as the rider handoff anchor.
4. Check delivery notes for gate, estate, security, or best-time-to-call instructions.
5. If LGA is `Other / Not listed` or landmark is unclear, contact the customer before dispatch.

## Future Readiness

This structure prepares YurDeals for later dispatch/rider tooling, delivery-zone pricing, route grouping, and optional map-assisted verification without requiring paid map APIs at launch.
