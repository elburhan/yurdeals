import { useEffect } from 'react';
import { Link } from 'react-router-dom';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

const menuItems = [
  { to: '/', label: 'Home' },
  { to: '/categories/all', label: 'Categories' },
  { to: '/categories/all?preorder=true', label: 'Preorder Deals' },
  { to: '/#how-preordering-works', label: 'How It Works' },
  { to: '/orders', label: 'Track Order' },
  { to: 'mailto:support@yurdeals.com', label: 'Support' },
];

const DEFAULT_WHATSAPP_MESSAGE = 'Hi, I need help with YurDeals.';

export function MobileMenu({ open, onClose }: MobileMenuProps): JSX.Element | null {
  const phoneNumber = normalizeWhatsappNumber(import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER);
  const whatsappUrl = phoneNumber
    ? `https://wa.me/${phoneNumber}?text=${encodeURIComponent(DEFAULT_WHATSAPP_MESSAGE)}`
    : '';

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] bg-surface-950/70 backdrop-blur-sm sm:hidden" role="dialog" aria-modal="true" aria-label="Mobile navigation menu">
      <div className="flex h-full flex-col bg-white">
        <div className="flex min-h-16 items-center justify-between border-b border-surface-200 px-4">
          <Link to="/" onClick={onClose} className="font-display text-xl font-bold text-surface-950">
            Yur<span className="text-primary-600">Deals</span> <span className="text-base">🇳🇬</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-full border border-surface-300 px-4 text-sm font-bold text-surface-700"
            aria-label="Close menu"
          >
            ✕ Close
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5" aria-label="Mobile menu links">
          <div className="space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={onClose}
                className="flex min-h-14 items-center rounded-lg border border-surface-200 bg-surface-50 px-4 text-base font-semibold text-surface-900 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="border-t border-surface-200 p-4">
          <button
            type="button"
            disabled={!whatsappUrl}
            onClick={() => {
              if (whatsappUrl) {
                window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            className="min-h-14 w-full rounded-full bg-[#25D366] px-5 text-base font-bold text-white disabled:bg-surface-300"
          >
            Contact Support on WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizeWhatsappNumber(value: string | undefined): string {
  return (value ?? '').replace(/\D/g, '').replace(/^0+/, '');
}
