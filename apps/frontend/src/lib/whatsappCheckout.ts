import type { AddressSummary, OrderSummary } from '@yurdeals/shared';

interface WhatsappCustomer {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
}

export function buildWhatsappOrderMessage(
  order: OrderSummary,
  customer: WhatsappCustomer | null,
): string {
  const address = order.shippingAddress;
  const customerName = getCustomerName(customer, address);
  const customerPhone = address?.phone ?? customer?.phone ?? 'Not provided';
  const addressText = address ? formatAddress(address) : 'No delivery address selected';
  const items = order.items
    .map((item) => `- ${item.quantity}x ${item.name} - ${formatCurrency(item.total, order.currency)}`)
    .join('\n');

  return [
    'Hi, I want to complete this order via WhatsApp:',
    '',
    `Order: ${order.orderNumber}`,
    '',
    'Items:',
    items,
    '',
    `Total: ${formatCurrency(order.total, order.currency)}`,
    '',
    `Name: ${customerName}`,
    `Phone: ${customerPhone}`,
    `Address: ${addressText}`,
  ].join('\n');
}

export function buildWhatsappCheckoutUrl(order: OrderSummary, customer: WhatsappCustomer | null): string {
  const businessNumber = getWhatsappBusinessNumber();
  const message = encodeURIComponent(buildWhatsappOrderMessage(order, customer));

  return `https://wa.me/${businessNumber}?text=${message}`;
}

export function getWhatsappBusinessNumber(): string {
  // Vite reads this from the repo-root .env via apps/frontend/vite.config.ts envDir.
  // Add VITE_WHATSAPP_BUSINESS_NUMBER="2348000000000" to ./ .env and restart dev.
  return (import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER || '').replace(/\D/g, '');
}

function getCustomerName(customer: WhatsappCustomer | null, address: AddressSummary | null): string {
  const fromUser = [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').trim();
  const fromAddress = address ? `${address.firstName} ${address.lastName}`.trim() : '';

  return fromUser || fromAddress || 'Not provided';
}

function formatAddress(address: AddressSummary): string {
  return [
    address.street,
    address.city,
    address.state,
    address.country,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(', ');
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
