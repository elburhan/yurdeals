import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { MobileMenu } from './MobileMenu';
import { NotificationBell } from './NotificationBell';
import { SearchBar } from './SearchBar';
import { TrustBar } from './TrustBar';

const links = [
  { to: '/', label: 'Home' },
  { to: '/categories/all', label: 'Categories' },
  { to: '/cart', label: 'Cart' },
  { to: '/orders', label: 'Orders' },
  { to: '/account', label: 'Account' },
];

const desktopLinks = [
  { to: '/', label: 'Home' },
  { to: '/categories/all', label: 'Categories' },
  { to: '/categories/all?preorder=true', label: 'Preorder Deals' },
  { to: '/#how-preordering-works', label: 'How It Works' },
  { to: '/orders', label: 'Track Order' },
  { to: 'mailto:support@yurdeals.com', label: 'Support' },
];

export function CustomerNav() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const { cart } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const cartCount = cart?.summary.itemCount ?? 0;
  const roleLink =
    user?.role === 'ADMIN'
      ? { to: '/admin', label: 'Admin' }
      : user?.role === 'STAFF'
        ? { to: '/staff', label: 'Staff' }
        : null;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-surface-200 bg-white/95 backdrop-blur">
        <nav className="container-app grid gap-3 py-3" aria-label="Primary navigation">
          <div className="flex min-h-12 items-center justify-between gap-3">
            <Link
              to="/"
              className="shrink-0 font-display text-xl font-bold text-surface-950"
              aria-label="YurDeals home"
            >
              Yur<span className="text-primary-600">Deals</span>{' '}
              <span className="align-middle text-sm" aria-hidden="true">
                🇳🇬
              </span>
            </Link>

            <div className="hidden min-w-0 flex-1 md:block">
              <SearchBar />
            </div>

            <div className="flex shrink-0 items-center gap-2">
            {roleLink && (
              <Link
                to={roleLink.to}
                className="hidden rounded-full bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-100 sm:inline-flex"
              >
                {roleLink.label}
              </Link>
            )}
            <Link
              to="/cart"
              className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-surface-200 text-sm font-semibold text-surface-700 hover:text-primary-700"
              aria-label={`Cart with ${cartCount} item${cartCount === 1 ? '' : 's'}`}
            >
              🛒
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-primary-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
            {isAuthenticated && <NotificationBell />}
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <Link
                  to={user?.role === 'ADMIN' ? '/admin' : user?.role === 'STAFF' ? '/staff' : '/account'}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-surface-200 text-sm font-semibold text-primary-700"
                  aria-label="Open account dashboard"
                >
                  <span className="hidden lg:inline">{user?.firstName}</span>
                  <span className="lg:hidden" aria-hidden="true">
                    👤
                  </span>
                </Link>
                <button
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                  className="min-h-11 rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm font-semibold text-surface-700 transition-colors hover:bg-surface-50"
                  aria-label="Sign out"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-surface-200 text-sm font-semibold text-primary-700"
                aria-label="Sign in or open account"
              >
                👤
              </Link>
            )}
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-surface-200 text-lg font-bold text-surface-800 md:hidden"
              aria-label="Open menu"
            >
              ☰
            </button>
            </div>
          </div>

          <div className="md:hidden">
            <SearchBar />
          </div>

          <div className="hidden items-center justify-center gap-5 text-sm font-semibold text-surface-600 md:flex">
            {desktopLinks.map((link) => (
              <Link key={link.label} to={link.to} className="hover:text-primary-700">
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <TrustBar />
      <MobileMenu open={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-200 bg-white px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-6px_20px_rgba(15,23,42,0.08)] sm:hidden"
        aria-label="Customer navigation"
      >
        <div className="grid grid-cols-5 gap-1">
          {links.map((link) => {
            const isCart = link.to === '/cart';
            return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `min-h-12 rounded-lg px-1 py-2 text-center text-xs font-semibold ${
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-surface-600'
                }`
              }
            >
              {link.label}
              {isCart && cartCount > 0 ? (
                <span className="ml-1 rounded-full bg-primary-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              ) : null}
            </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}
