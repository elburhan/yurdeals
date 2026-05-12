interface TrustBannerProps {
  variant?: 'payment' | 'delivery' | 'checkout';
}

const copy = {
  payment: {
    title: 'Secure payment',
    body: 'Pay online through our secure payment flow. YurDeals never stores card details.',
  },
  delivery: {
    title: 'Tracked China to Nigeria flow',
    body: 'Preorders and local deliveries use order tracking updates from payment to delivery.',
  },
  checkout: {
    title: 'Checked before checkout',
    body: 'Prices are snapshotted and product availability is validated on the server.',
  },
};

export function TrustBanner({ variant = 'delivery' }: TrustBannerProps) {
  const content = copy[variant];

  return (
    <aside className="rounded-lg border border-primary-100 bg-primary-50 p-4 text-sm text-primary-900">
      <p className="font-bold">{content.title}</p>
      <p className="mt-1 text-primary-800">{content.body}</p>
    </aside>
  );
}
