import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AddressSummary, OrderSummary } from '@yurdeals/shared';
import { AddressCard } from '../components/AddressCard';
import { AddressForm } from '../components/AddressForm';
import { CustomerNav } from '../components/CustomerNav';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { formatPrice } from '../components/ProductCard';
import { useAuth } from '../hooks/useAuth';
import {
  createAddress,
  deleteAddress,
  getAddresses,
  setDefaultAddress,
  type AddressPayload,
} from '../lib/addressApi';
import { getOrders } from '../lib/orderApi';

export default function AccountPage() {
  return (
    <ProtectedRoute>
      <AccountContent />
    </ProtectedRoute>
  );
}

function AccountContent() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<AddressSummary[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadAccount() {
    setIsLoading(true);
    try {
      const [addressResponse, orderResponse] = await Promise.all([getAddresses(), getOrders(1)]);
      setAddresses(addressResponse.data.addresses);
      setOrders(orderResponse.data.orders.slice(0, 3));
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load account');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAccount();
  }, []);

  async function handleAddressSubmit(payload: AddressPayload) {
    await createAddress(payload);
    setShowAddressForm(false);
    await loadAccount();
  }

  async function handleDeleteAddress(addressId: string) {
    await deleteAddress(addressId);
    await loadAccount();
  }

  async function handleDefaultAddress(addressId: string) {
    await setDefaultAddress(addressId);
    await loadAccount();
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-surface-50 pb-24 sm:pb-0">
      <CustomerNav />
      <section className="container-app py-6">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
            My account
          </p>
          <h1 className="font-display text-3xl font-bold text-surface-950">
            {user.firstName} {user.lastName}
          </h1>
          <p className="mt-2 text-sm text-surface-500">
            Manage your profile, delivery addresses, and recent orders.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadAccount()}
              className="mt-3 min-h-12 rounded-lg bg-red-100 px-4 font-semibold text-red-800"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading && <div className="h-48 rounded-lg bg-surface-200" />}

        <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <section className="rounded-lg border border-surface-200 bg-white p-4">
            <h2 className="font-display text-xl font-bold text-surface-950">Profile</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <ProfileRow label="Name" value={`${user.firstName} ${user.lastName}`} />
              <ProfileRow label="Email" value={user.email} />
              <ProfileRow label="Phone" value={user.phone ?? 'Not added'} />
              <ProfileRow label="Role" value={user.role} />
            </dl>
            <p className="mt-4 rounded-lg bg-surface-50 p-3 text-xs text-surface-500">
              Profile editing uses the existing auth profile once an update endpoint is added.
            </p>
          </section>

          <section className="rounded-lg border border-surface-200 bg-white p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-xl font-bold text-surface-950">Addresses</h2>
              <button
                type="button"
                onClick={() => setShowAddressForm((current) => !current)}
                className="min-h-12 w-full rounded-lg px-3 text-sm font-semibold text-primary-700 hover:bg-primary-50 sm:w-auto"
              >
                {showAddressForm ? 'Close' : 'Add'}
              </button>
            </div>

            {showAddressForm && (
              <div className="mb-4">
                <AddressForm
                  onSubmit={handleAddressSubmit}
                  onCancel={() => setShowAddressForm(false)}
                />
              </div>
            )}

            <div className="space-y-3">
              {addresses.map((address) => (
                <div key={address.id} className="space-y-2">
                  <AddressCard address={address} />
                  <div className="grid gap-2 sm:flex sm:flex-wrap">
                    {!address.isDefault && (
                      <button
                        type="button"
                        onClick={() => void handleDefaultAddress(address.id)}
                        className="min-h-12 rounded-lg border border-surface-300 px-3 text-sm font-semibold"
                      >
                        Set default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDeleteAddress(address.id)}
                      className="min-h-12 rounded-lg px-3 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-lg border border-surface-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-surface-950">Recent orders</h2>
            <Link to="/orders" className="text-sm font-semibold text-primary-700">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                to={`/orders/${order.id}/tracking`}
                className="block rounded-lg border border-surface-100 p-3 hover:border-primary-200"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-surface-950">{order.orderNumber}</p>
                    <p className="text-sm text-surface-500">{order.status}</p>
                  </div>
                  <p className="font-bold text-surface-950">
                    {formatPrice(order.total, order.currency)}
                  </p>
                </div>
              </Link>
            ))}
            {!isLoading && orders.length === 0 && (
              <p className="rounded-lg border border-dashed border-surface-300 p-5 text-center text-sm text-surface-500">
                No orders yet.
              </p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-surface-400">{label}</dt>
      <dd className="mt-1 font-medium text-surface-950">{value}</dd>
    </div>
  );
}
