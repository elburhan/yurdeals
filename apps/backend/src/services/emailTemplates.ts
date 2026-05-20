import { OrderItemSummary } from '@yurdeals/shared';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface OtpEmailInput {
  code: string;
  expiresInSeconds: number;
}

interface OrderCreatedEmailInput {
  customerName: string;
  orderNumber: string;
  items: OrderItemSummary[];
  total: number;
  currency: string;
}

interface PaymentConfirmedEmailInput {
  customerName: string;
  orderNumber: string;
  amount: number;
  currency: string;
}

export function renderOtpEmail(input: OtpEmailInput): RenderedEmail {
  const expiryMinutes = Math.max(1, Math.ceil(input.expiresInSeconds / 60));
  const subject = 'Your YurDeals verification code';

  return {
    subject,
    html: renderLayout({
      preview: `Your YurDeals code is ${input.code}`,
      title: 'Verify your email',
      body: `
        <p>Use this 6-digit code to finish verifying your YurDeals account.</p>
        <div class="code">${escapeHtml(input.code)}</div>
        <p>This code expires in ${expiryMinutes} minutes.</p>
        <p class="muted">If you did not request this, you can ignore this email.</p>
      `,
    }),
    text: [
      'Verify your YurDeals email',
      `Your verification code is: ${input.code}`,
      `This code expires in ${expiryMinutes} minutes.`,
      'If you did not request this, you can ignore this email.',
    ].join('\n\n'),
  };
}

export function renderOrderCreatedEmail(input: OrderCreatedEmailInput): RenderedEmail {
  const subject = `Order received: ${input.orderNumber}`;
  const itemRows = input.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)} <span class="muted">x${item.quantity}</span></td>
          <td class="amount">${escapeHtml(formatMoney(item.total, input.currency))}</td>
        </tr>
      `,
    )
    .join('');

  return {
    subject,
    html: renderLayout({
      preview: `We received your YurDeals preorder ${input.orderNumber}`,
      title: 'Your order has been received',
      body: `
        <p>Hi ${escapeHtml(input.customerName)},</p>
        <p>We received your preorder <strong>${escapeHtml(input.orderNumber)}</strong>. You can now complete payment online or continue through WhatsApp support.</p>
        <table>${itemRows}</table>
        <div class="total">
          <span>Total</span>
          <strong>${escapeHtml(formatMoney(input.total, input.currency))}</strong>
        </div>
        <p>What happens next: we confirm payment, inspect your products in China, then keep you updated until delivery in Nigeria.</p>
        <p class="muted">Need help? Reply to this email and YurDeals support will assist.</p>
      `,
    }),
    text: [
      `Hi ${input.customerName},`,
      `We received your preorder ${input.orderNumber}.`,
      ...input.items.map((item) => `${item.quantity} x ${item.name} - ${formatMoney(item.total, input.currency)}`),
      `Total: ${formatMoney(input.total, input.currency)}`,
      'What happens next: we confirm payment, inspect your products in China, then keep you updated until delivery in Nigeria.',
      'Need help? Reply to this email and YurDeals support will assist.',
    ].join('\n\n'),
  };
}

export function renderPaymentConfirmedEmail(input: PaymentConfirmedEmailInput): RenderedEmail {
  const subject = `Payment confirmed for ${input.orderNumber}`;

  return {
    subject,
    html: renderLayout({
      preview: `Payment confirmed for YurDeals order ${input.orderNumber}`,
      title: 'Payment confirmed',
      body: `
        <p>Hi ${escapeHtml(input.customerName)},</p>
        <p>Your payment for order <strong>${escapeHtml(input.orderNumber)}</strong> has been confirmed.</p>
        <div class="total">
          <span>Amount paid</span>
          <strong>${escapeHtml(formatMoney(input.amount, input.currency))}</strong>
        </div>
        <p>We're preparing your order now. For China orders, this includes supplier confirmation, quality inspection, and shipping updates.</p>
        <p class="muted">We may contact you if we need any additional confirmation before dispatch.</p>
        <p class="muted">Need help? Reply to this email and YurDeals support will assist.</p>
      `,
    }),
    text: [
      `Hi ${input.customerName},`,
      `Your payment for order ${input.orderNumber} has been confirmed.`,
      `Amount paid: ${formatMoney(input.amount, input.currency)}`,
      "We're preparing your order now. This includes supplier confirmation, quality inspection, and shipping updates for your preorder.",
      'We may contact you if we need any additional confirmation before dispatch.',
      'Need help? Reply to this email and YurDeals support will assist.',
    ].join('\n\n'),
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLayout(input: { preview: string; title: string; body: string }): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(input.title)}</title>
    <style>
      body { margin: 0; background: #f8fafc; color: #0f172a; font-family: Arial, sans-serif; }
      .preview { display: none; max-height: 0; overflow: hidden; opacity: 0; }
      .wrap { padding: 24px 12px; }
      .card { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
      .header { padding: 22px 24px; background: #ecfdf5; border-bottom: 1px solid #bbf7d0; }
      .brand { font-size: 20px; font-weight: 800; color: #14532d; margin: 0; }
      .content { padding: 24px; }
      h1 { font-size: 24px; line-height: 1.2; margin: 0 0 16px; color: #0f172a; }
      p { font-size: 15px; line-height: 1.65; margin: 0 0 16px; color: #334155; }
      table { width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 14px; }
      td { padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #334155; vertical-align: top; }
      .amount { text-align: right; font-weight: 700; color: #0f172a; }
      .code { margin: 20px 0; padding: 18px; border-radius: 14px; background: #f0fdf4; color: #166534; font-size: 32px; font-weight: 800; letter-spacing: 8px; text-align: center; }
      .total { display: flex; justify-content: space-between; gap: 16px; margin: 18px 0; padding: 16px; border-radius: 14px; background: #f8fafc; color: #0f172a; }
      .total strong { color: #166534; }
      .muted { color: #64748b; font-size: 13px; }
      .footer { padding: 18px 24px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="preview">${escapeHtml(input.preview)}</div>
    <div class="wrap">
      <div class="card">
        <div class="header"><p class="brand">YurDeals</p></div>
        <div class="content">
          <h1>${escapeHtml(input.title)}</h1>
          ${input.body}
        </div>
        <div class="footer">YurDeals - Preorder from China to Nigeria. Secure payments, quality inspection, and local support.</div>
      </div>
    </div>
  </body>
</html>`;
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
