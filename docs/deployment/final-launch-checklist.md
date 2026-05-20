# Final Launch Checklist

Use this checklist before opening YurDeals to real customers.

## Security

- Rotate all exposed or old secrets.
- Confirm `.env` files are ignored and not committed.
- Confirm HTTPS for frontend and backend.
- Confirm auth cookies are HttpOnly.
- Confirm `COOKIE_SAME_SITE=none` for Render plus Vercel cross-site deployment.
- Confirm no production debug auth routes are exposed.

## Backend

- Deploy backend service.
- Verify `/api/v1/health`.
- Run production migrations.
- Run seed with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.
- Confirm admin login.

## Frontend

- Deploy frontend.
- Verify direct refresh on `/categories/all`, `/orders/track`, and `/payment-return`.
- Verify API connectivity through `VITE_API_URL`.
- Verify mobile layout on 360px to 414px widths.

## Payments

- Confirm Paystack live keys.
- Confirm Paystack callback URL.
- Confirm Paystack webhook URL.
- Complete one successful controlled payment.
- Test one failed/cancelled payment.
- Verify payment timeline in admin.

## Email

- Confirm Resend domain verification.
- Send OTP email.
- Trigger order-created email.
- Trigger payment-confirmed email.
- Confirm no duplicate payment-confirmed email.

## Media

- Upload product image via admin.
- Upload multiple product images.
- Verify ProductCard and PDP gallery.
- Verify broken-image fallback.

## Guest Flows

- Complete guest checkout.
- Complete guest Paystack return in the same browser.
- Open payment return in a fresh browser and confirm calm recovery UX.
- Track order using order number and phone.

## Admin

- Log in as admin.
- Create product.
- Edit product images.
- View order/payment detail drawer.
- Confirm payment timeline is visible.
- Confirm inventory reservations are visible.

## Smoke Tests

- Auth signup/login/logout.
- OTP verification.
- Product browsing.
- Cart and checkout.
- Guest checkout.
- Paystack payment.
- Order tracking.
- Email notifications.
- Inventory reservation and confirmation.
- Mobile UI scan.

## Go-Live

- Remove or unpublish test products if needed.
- Confirm support WhatsApp number.
- Confirm analytics if enabled.
- Soft launch to internal testers first.
- Monitor logs, payments, emails, and admin order timeline during the first real transactions.
