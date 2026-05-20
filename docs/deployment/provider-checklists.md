# Provider Setup Checklists

## Paystack

- Switch dashboard to live mode only when ready.
- Add live `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` to Render.
- Set callback URL: `https://api.yourdomain.com/payment-return`.
- Set webhook URL: `https://api.yourdomain.com/api/v1/payments/paystack/webhook`.
- Confirm webhook signature verification is active.
- Complete one controlled low-value live payment.
- Verify admin order detail shows payment attempt and timeline.
- Verify order status, payment status, reservation status, and email notification.

## Flutterwave

- Leave all `FLUTTERWAVE_*` variables empty when Flutterwave is not in use.
- If enabling Flutterwave later, set all four variables together:
  - `FLUTTERWAVE_SECRET_KEY`
  - `FLUTTERWAVE_PUBLIC_KEY`
  - `FLUTTERWAVE_WEBHOOK_SECRET_HASH`
  - `FLUTTERWAVE_CALLBACK_URL`
- Confirm backend startup logs show Flutterwave enabled only when intentionally configured.

## Resend

- Add sending domain in Resend.
- Add SPF record from Resend.
- Add DKIM records from Resend.
- Wait for domain verification.
- Set `EMAIL_FROM` to a verified sender, such as `YurDeals <orders@yourdomain.com>`.
- Set `EMAIL_REPLY_TO` to a monitored inbox.
- Set `EMAIL_ENABLED=true` only after verification.
- Test OTP email.
- Test order-created email.
- Test payment-confirmed email.

## Cloudinary

- Create or confirm production Cloudinary account.
- Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to Render.
- Log in as admin.
- Upload one product image.
- Upload multiple product images.
- Verify product card renders the first image.
- Verify PDP gallery renders all images in order.
- Verify image fallback behavior with a broken URL.
