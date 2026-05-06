import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AddressSummary } from '@yurdeals/shared';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AddressCard } from '../components/AddressCard';
import { AddressForm } from '../components/AddressForm';
import {
  createAddress,
  deleteAddress,
  getAddresses,
  setDefaultAddress,
  updateAddress,
  type AddressPayload,
} from '../lib/addressApi';

export default function AddressesPage() {
  return (
    <ProtectedRoute>
      <AddressesContent />
    </ProtectedRoute>
  );
}

function AddressesContent() {
  const [addresses, setAddresses] = useState<AddressSummary[]>([]);
  const [editingAddress, setEditingAddress] = useState<AddressSummary | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadAddresses() {
    setIsLoading(true);
    try {
      const response = await getAddresses();
      setAddresses(response.data.addresses);
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load addresses');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAddresses();
  }, []);

  async function handleSubmit(payload: AddressPayload) {
    if (editingAddress) {
      await updateAddress(editingAddress.id, payload);
    } else {
      await createAddress(payload);
    }
    setEditingAddress(null);
    setShowForm(false);
    await loadAddresses();
  }

  return (
    <main className="min-h-screen bg-surface-50">
      <header className="border-b border-surface-200 bg-white">
        <nav className="container-app flex min-h-16 items-center justify-between">
          <Link to="/" className="font-display text-xl font-bold text-surface-950">
            Yur<span className="text-primary-600">Deals</span>
          </Link>
          <Link to="/checkout" className="text-sm font-medium text-primary-700">
            Checkout
          </Link>
        </nav>
      </header>

      <section className="container-app py-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-surface-950">Addresses</h1>
            <p className="text-sm text-surface-500">Manage delivery addresses for checkout.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingAddress(null);
              setShowForm(true);
            }}
            className="min-h-12 rounded-full bg-primary-600 px-5 py-3 font-semibold text-white hover:bg-primary-700"
          >
            Add address
          </button>
        </div>

        {error && (
          <div
            className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        {showForm && (
          <div className="mb-5">
            <AddressForm
              initialAddress={editingAddress}
              onSubmit={handleSubmit}
              onCancel={() => {
                setEditingAddress(null);
                setShowForm(false);
              }}
            />
          </div>
        )}

        {isLoading && <div className="h-48 rounded-lg bg-surface-200" />}

        <div className="space-y-4">
          {!isLoading &&
            addresses.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                onEdit={() => {
                  setEditingAddress(address);
                  setShowForm(true);
                }}
                onDelete={async () => {
                  await deleteAddress(address.id);
                  await loadAddresses();
                }}
                onSetDefault={async () => {
                  await setDefaultAddress(address.id);
                  await loadAddresses();
                }}
              />
            ))}
        </div>

        {!isLoading && addresses.length === 0 && !showForm && (
          <div className="rounded-lg border border-dashed border-surface-300 bg-white p-8 text-center">
            <p className="text-sm text-surface-500">No addresses yet.</p>
          </div>
        )}
      </section>
    </main>
  );
}
