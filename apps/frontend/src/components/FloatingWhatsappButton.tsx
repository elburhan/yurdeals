import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

const DEFAULT_WHATSAPP_MESSAGE = 'Hi, I have a question about Yurdeals.';

export function FloatingWhatsappButton(): JSX.Element | null {
  const location = useLocation();
  const phoneNumber = normalizeWhatsappNumber(import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER);
  const isOperationsRoute =
    location.pathname.startsWith('/admin') || location.pathname.startsWith('/staff');
  const isProductRoute = location.pathname.startsWith('/products/');

  const whatsappUrl = useMemo(() => {
    if (!phoneNumber) {
      return '';
    }

    return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(DEFAULT_WHATSAPP_MESSAGE)}`;
  }, [phoneNumber]);

  if (!phoneNumber || isOperationsRoute) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => window.open(whatsappUrl, '_blank', 'noopener,noreferrer')}
      className={`fixed right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366] sm:bottom-6 sm:right-6 ${
        isProductRoute
          ? 'bottom-[calc(11rem+env(safe-area-inset-bottom))]'
          : 'bottom-[calc(6rem+env(safe-area-inset-bottom))]'
      }`}
      aria-label="Chat with YurDeals on WhatsApp"
    >
      Chat
    </button>
  );
}

function normalizeWhatsappNumber(value: string | undefined): string {
  return (value ?? '').replace(/\D/g, '').replace(/^0+/, '');
}
