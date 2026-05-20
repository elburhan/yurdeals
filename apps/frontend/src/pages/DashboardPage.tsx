// ============================================
// Dashboard Page — Protected User Area
// ============================================

import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  if (!user) return null;

  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Top bar */}
      <header className="border-b border-surface-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-display font-bold text-surface-950 text-lg">
              Yur<span className="text-primary-600">Deals</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-surface-950">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-surface-500">{user.role}</p>
            </div>

            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
              {initials}
            </div>

            <button
              onClick={handleLogout}
              id="logout-button"
              className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm text-surface-700
                hover:border-primary-300 hover:text-primary-700 transition-all duration-200"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-surface-950 mb-2">
            Welcome back, {user.firstName} 👋
          </h1>
          <p className="text-surface-500 text-sm">
            Here's what's happening with your account.
          </p>
        </div>

        {/* Profile card */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-white border border-surface-200 p-6 animate-slide-up col-span-full sm:col-span-1 lg:col-span-2 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-surface-950 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              Profile Details
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: 'Full Name', value: `${user.firstName} ${user.lastName}` },
                { label: 'Email', value: user.email },
                { label: 'Phone', value: user.phone || '—' },
                { label: 'Role', value: user.role },
                { label: 'Verified', value: user.isVerified ? 'Yes' : 'Not yet' },
                { label: 'Member since', value: new Date(user.createdAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }) },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-0.5">
                  <span className="text-xs text-surface-500 uppercase tracking-wider">{item.label}</span>
                  <span className="text-sm font-medium text-surface-950">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="rounded-lg bg-white border border-surface-200 p-6 animate-slide-up shadow-sm">
            <h2 className="font-display text-lg font-semibold text-surface-950 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              Quick Actions
            </h2>

            <div className="space-y-3">
              {[
                { icon: '🛒', label: 'Browse Products', desc: 'Coming soon' },
                { icon: '📦', label: 'My Orders', desc: 'Coming soon' },
                { icon: '❤️', label: 'Wishlist', desc: 'Coming soon' },
                { icon: '🔔', label: 'Notifications', desc: 'Coming soon' },
              ].map((action) => (
                <div
                  key={action.label}
                  className="flex items-center gap-3 rounded-lg bg-surface-50 p-3 border border-surface-100
                    hover:bg-primary-50 hover:border-primary-100 transition-all duration-200 cursor-pointer"
                >
                  <span className="text-lg">{action.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-surface-950">{action.label}</p>
                    <p className="text-xs text-surface-500">{action.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Auth info badge */}
        <div className="mt-6 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 border border-primary-100 px-3 py-1 text-xs font-medium text-primary-700">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
            Authenticated
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 border border-surface-200 px-3 py-1 text-xs font-medium text-surface-600">
            Secured Session
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 border border-accent-200 px-3 py-1 text-xs font-medium text-accent-700">
            Role: {user.role}
          </span>
        </div>
      </main>
    </div>
  );
}
