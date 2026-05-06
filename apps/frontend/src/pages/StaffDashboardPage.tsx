import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ShipmentSummary } from '@yurdeals/shared';
import { NotificationBell } from '../components/NotificationBell';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { formatPrice } from '../components/ProductCard';
import { useAuth } from '../hooks/useAuth';
import {
  getStaffLastMileShipments,
  updateStaffShipmentStatus,
  type StaffShipmentAction,
} from '../lib/staffApi';

const ACTIONS: Array<{ status: StaffShipmentAction; label: string; intent: string }> = [
  { status: 'LOCAL_DELIVERY', label: 'Out for delivery', intent: 'primary' },
  { status: 'DELIVERED', label: 'Delivered', intent: 'success' },
  { status: 'DELIVERY_FAILED', label: 'Delivery failed', intent: 'danger' },
];

export default function StaffDashboardPage() {
  return (
    <ProtectedRoute roles={['STAFF']}>
      <StaffDashboardContent />
    </ProtectedRoute>
  );
}

function StaffDashboardContent() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');

  async function loadShipments() {
    setIsLoading(true);
    try {
      const response = await getStaffLastMileShipments();
      setShipments(response.data.shipments);
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load shipments');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadShipments();
  }, []);

  async function handleUpdate(shipmentId: string, status: StaffShipmentAction) {
    setUpdatingId(shipmentId);
    setError('');

    try {
      const response = await updateStaffShipmentStatus(shipmentId, status);
      setShipments((current) =>
        current.map((shipment) =>
          shipment.id === shipmentId ? response.data.shipment : shipment,
        ),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update shipment');
    } finally {
      setUpdatingId('');
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <main className="min-h-screen bg-surface-50">
      <header className="border-b border-surface-200 bg-white">
        <nav className="container-app flex min-h-16 items-center justify-between gap-3">
          <Link to="/" className="font-display text-xl font-bold text-surface-950">
            Yur<span className="text-primary-600">Deals</span>
          </Link>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="min-h-10 rounded-full border border-surface-300 px-4 text-sm font-semibold text-surface-700 hover:bg-surface-50"
            >
              Logout
            </button>
          </div>
        </nav>
      </header>

      <section className="container-app py-5">
        <div className="mb-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
            Staff queue
          </p>
          <h1 className="font-display text-3xl font-bold text-surface-950">Last-mile deliveries</h1>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {isLoading && <div className="h-48 rounded-lg bg-surface-200" />}

        {!isLoading && shipments.length === 0 && (
          <div className="rounded-lg border border-dashed border-surface-300 bg-white p-8 text-center">
            <h2 className="font-display text-xl font-bold text-surface-950">No shipments queued</h2>
            <p className="mt-2 text-sm text-surface-500">Last-mile orders will appear here.</p>
          </div>
        )}

        <div className="space-y-4">
          {shipments.map((shipment) => (
            <article key={shipment.id} className="rounded-lg border border-surface-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-bold text-surface-950">
                    {shipment.orderNumber}
                  </p>
                  <p className="text-sm text-surface-500">{shipment.customerName}</p>
                </div>
                <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700">
                  {shipment.status}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm text-surface-600">
                <p>{shipment.customerPhone ?? 'No phone on file'}</p>
                {shipment.address && (
                  <p>
                    {shipment.address.street}, {shipment.address.city}, {shipment.address.state}
                  </p>
                )}
                <p className="font-semibold text-surface-950">
                  {formatPrice(shipment.total, shipment.currency)}
                </p>
              </div>

              <div className="mt-4 grid gap-3">
                {ACTIONS.map((action) => (
                  <button
                    key={action.status}
                    type="button"
                    disabled={updatingId === shipment.id}
                    onClick={() => void handleUpdate(shipment.id, action.status)}
                    className={getActionClass(action.intent)}
                  >
                    {updatingId === shipment.id ? 'Updating...' : action.label}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function getActionClass(intent: string): string {
  const base =
    'min-h-12 w-full rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-surface-300';

  if (intent === 'success') {
    return `${base} bg-green-600 text-white hover:bg-green-700`;
  }

  if (intent === 'danger') {
    return `${base} border border-red-200 text-red-700 hover:bg-red-50`;
  }

  return `${base} bg-primary-600 text-white hover:bg-primary-700`;
}
