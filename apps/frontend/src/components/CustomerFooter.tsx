import { Link, useLocation } from 'react-router-dom';

const footerLinks = [
  { to: '/', label: 'About' },
  { to: '/#how-preordering-works', label: 'How It Works' },
  { to: '/blog', label: 'Blog & Guides' },
  { to: '/orders', label: 'Track Order' },
  { to: 'mailto:support@yurdeals.com', label: 'Contact' },
] as const;

export function CustomerFooter(): JSX.Element | null {
  const location = useLocation();
  const isOperationsRoute =
    location.pathname.startsWith('/admin') || location.pathname.startsWith('/staff');
  const whatsappNumber = (import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER ?? '').replace(/\D/g, '');

  if (isOperationsRoute) {
    return null;
  }

  return (
    <footer className="border-t border-surface-200 bg-white pb-28 pt-8 sm:pb-8">
      <div className="container-app grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <Link to="/" className="font-display text-xl font-bold text-surface-950">
            Yur<span className="text-primary-600">Deals</span>
          </Link>
          <p className="mt-2 text-sm leading-6 text-surface-500">
            (c) YurDeals - Preorder from China to Nigeria
          </p>
          <p className="mt-3 inline-flex flex-wrap gap-2 rounded-full bg-primary-50 px-3 py-2 text-xs font-bold text-primary-800 ring-1 ring-primary-100">
            <span>Secure Payments</span>
            <span aria-hidden="true">-</span>
            <span>Quality Guarantee</span>
            <span aria-hidden="true">-</span>
            <span>Local Support</span>
          </p>
        </div>

        <div className="grid gap-4 sm:justify-items-end">
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-surface-600" aria-label="Footer">
            {footerLinks.map((link) =>
              link.to.startsWith('mailto:') ? (
                <a key={link.label} href={link.to} className="hover:text-primary-700">
                  {link.label}
                </a>
              ) : (
                <Link key={link.label} to={link.to} className="hover:text-primary-700">
                  {link.label}
                </Link>
              ),
            )}
          </nav>
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hi, I need support with YurDeals.')}`}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary-500 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-primary-600 active:bg-primary-700 sm:w-auto"
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp support
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
