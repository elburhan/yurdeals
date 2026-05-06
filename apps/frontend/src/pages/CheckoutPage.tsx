import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AddressSummary, OrderSummary } from '@yurdeals/shared';
import { AddressCard } from '../components/AddressCard';
import { AddressForm } from '../components/AddressForm';
import { CheckoutSteps } from '../components/CheckoutSteps';
import { CustomerNav } from '../components/CustomerNav';
import { OrderSummary as CheckoutOrderSummary } from '../components/OrderSummary';
import { PaymentPanel } from '../components/PaymentPanel';
import { ShippingForm } from '../components/ShippingForm';
import { SkeletonBlock, SummarySkeleton } from '../components/Skeleton';
import { TrustBanner } from '../components/TrustBanner';
import { formatPrice } from '../components/ProductCard';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { useToast } from '../context/ToastContext';
import { createAddress, getAddresses, type AddressPayload } from '../lib/addressApi';
import { createGuestOrder, createOrder } from '../lib/orderApi';

interface GuestFormState {
  fullName: string;
  phone: string;
  email: string;
  state: string;
  city: string;
  area: string;
  preferredContactMethod: 'WHATSAPP' | 'SMS' | 'CALL';
}

const emptyGuestForm: GuestFormState = {
  fullName: '',
  phone: '',
  email: '',
  state: '',
  city: '',
  area: '',
  preferredContactMethod: 'WHATSAPP',
};

export default function CheckoutPage() {
  return <CheckoutContent />;
}

function CheckoutContent() {
  const { isAuthenticated } = useAuth();
  const { cart, refreshCart } = useCart();
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState<AddressSummary[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [guestForm, setGuestForm] = useState<GuestFormState>(emptyGuestForm);
  const [notes, setNotes] = useState('');
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [guestAccessToken, setGuestAccessToken] = useState('');
  const [isLoading, setIsLoading] = useState(isAuthenticated);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [error, setError] = useState('');

  async function loadAddresses() {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await getAddresses();
      setAddresses(response.data.addresses);
      setSelectedAddressId(
        (current) =>
          current ||
          response.data.addresses.find((item) => item.isDefault)?.id ||
          response.data.addresses[0]?.id ||
          '',
      );
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load addresses');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAddresses();
  }, [isAuthenticated]);

  async function handleAddressSubmit(payload: AddressPayload) {
    const response = await createAddress(payload);
    setShowAddressForm(false);
    await loadAddresses();
    setSelectedAddressId(response.data.address.id);
  }

  async function handlePlaceOrder() {
    const items = cart?.items ?? [];

    if (items.length === 0) {
      setError('Your cart is empty.');
      showToast('Your cart is empty.', 'error');
      return;
    }

    if (isAuthenticated && !selectedAddressId) {
      setError('Select a delivery address before placing your order.');
      showToast('Select a delivery address before placing your order.', 'error');
      return;
    }

    if (!isAuthenticated) {
      const validationError = validateGuestForm(guestForm);
      if (validationError) {
        setError(validationError);
        showToast(validationError, 'error');
        return;
      }
    }

    setIsPlacingOrder(true);
    setError('');
    try {
      if (isAuthenticated) {
        const response = await createOrder({
          address_id: selectedAddressId,
          notes: notes.trim() || undefined,
        });
        setOrder(response.data.order);
        await refreshCart();
        showToast('Preorder created. Choose your payment option.', 'success');
      } else {
        const response = await createGuestOrder({
          guest: {
            full_name: guestForm.fullName.trim(),
            phone: guestForm.phone.trim(),
            email: guestForm.email.trim() || undefined,
            state: guestForm.state.trim(),
            city: guestForm.city.trim(),
            area: guestForm.area.trim(),
            preferred_contact_method: guestForm.preferredContactMethod,
          },
          items: items.map((item) => ({
            product_id: item.productId,
            variant_id: item.variantId ?? undefined,
            quantity: item.quantity,
          })),
          notes: notes.trim() || undefined,
        });
        setGuestAccessToken(response.data.guestAccessToken ?? '');
        setOrder(response.data.order);
        showToast('Guest preorder created. Choose your payment option.', 'success');
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to place order';
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsPlacingOrder(false);
    }
  }

  const items = cart?.items ?? [];
  const currentStep = order ? 3 : isAuthenticated ? 2 : 2;

  return (
    <main className="min-h-screen bg-surface-50 pb-24 sm:pb-0">
      <CustomerNav />

      <section className="container-app grid gap-6 py-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <CheckoutSteps currentStep={currentStep} />
          <div>
            <h1 className="font-display text-3xl font-bold leading-tight text-surface-950">
              {isAuthenticated ? 'Checkout' : 'Checkout as Guest'}
            </h1>
            <p className="text-sm text-surface-500">
              {isAuthenticated
                ? 'Review your cart and delivery address.'
                : 'No account needed. Add your delivery details and choose payment or WhatsApp.'}
            </p>
            {!isAuthenticated && (
              <Link to="/login" className="mt-2 inline-flex min-h-10 items-center text-sm font-semibold text-primary-700">
                Sign in for faster checkout
              </Link>
            )}
          </div>
          <TrustBanner variant="payment" />

          <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-xl font-bold text-surface-950">Review order</h2>
            {isLoading ? (
              <div className="mt-4 space-y-3">
                <SkeletonBlock className="h-4 w-full" />
                <SkeletonBlock className="h-4 w-5/6" />
                <SkeletonBlock className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 text-sm">
                    <span className="min-w-0 text-surface-600">
                      {item.quantity} x {item.product.name}
                    </span>
                    <span className="font-medium text-surface-950">
                      {formatPrice(item.lineTotal, item.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
              Estimated delivery: 25-40 days after order confirmation.
            </p>
          </section>

          {error && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}

          {order && (
            <div className="space-y-3">
              <PaymentPanel
                order={order}
                guestAccessToken={guestAccessToken || undefined}
                isGuestCheckout={!isAuthenticated}
              />
              {isAuthenticated && (
                <Link
                  to={`/orders/${order.id}/tracking`}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-surface-300 px-5 py-3 text-sm font-semibold text-surface-700 hover:border-primary-300 hover:text-primary-700 sm:w-auto"
                >
                  View tracking
                </Link>
              )}
            </div>
          )}

          {isAuthenticated ? (
            <RegisteredAddressSection
              addresses={addresses}
              isLoading={isLoading}
              selectedAddressId={selectedAddressId}
              showAddressForm={showAddressForm}
              onAddressSubmit={handleAddressSubmit}
              onSelectAddress={setSelectedAddressId}
              onToggleAddressForm={() => setShowAddressForm((current) => !current)}
            />
          ) : (
            <ShippingForm form={guestForm} onChange={setGuestForm} />
          )}

      <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-display text-xl font-bold text-surface-950">Order notes</h2>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={300}
              rows={4}
              className="w-full rounded-lg border border-surface-300 p-3 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 sm:text-sm"
              placeholder="Delivery notes"
            />
          </section>
        </div>

        <aside className="h-fit lg:sticky lg:top-32">
          {isLoading ? (
            <SummarySkeleton />
          ) : (
            <CheckoutOrderSummary
              itemCount={cart?.summary.itemCount ?? 0}
              subtotal={cart?.summary.subtotal ?? 0}
              currency={cart?.summary.currency ?? 'NGN'}
            />
          )}
          <button
            type="button"
            disabled={items.length === 0 || isPlacingOrder || Boolean(order)}
            onClick={() => void handlePlaceOrder()}
            className="mt-5 min-h-12 w-full rounded-full bg-primary-500 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-primary-600 active:bg-primary-700 disabled:cursor-not-allowed disabled:bg-surface-300"
          >
            {isPlacingOrder ? 'Placing order...' : 'Place order'}
          </button>
          <p className="mt-4 text-sm text-surface-500">
            Your cart snapshots are used for this order total.
          </p>
        </aside>
      </section>
    </main>
  );
}

function RegisteredAddressSection({
  addresses,
  isLoading,
  selectedAddressId,
  showAddressForm,
  onAddressSubmit,
  onSelectAddress,
  onToggleAddressForm,
}: {
  addresses: AddressSummary[];
  isLoading: boolean;
  selectedAddressId: string;
  showAddressForm: boolean;
  onAddressSubmit: (payload: AddressPayload) => Promise<void>;
  onSelectAddress: (addressId: string) => void;
  onToggleAddressForm: () => void;
}) {
  return (
    <section className="rounded-lg border border-surface-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-surface-950">Delivery address</h2>
        <button
          type="button"
          onClick={onToggleAddressForm}
          className="min-h-12 rounded-lg px-3 text-sm font-semibold text-primary-700 hover:bg-primary-50"
        >
          {showAddressForm ? 'Close' : 'Add'}
        </button>
      </div>

      {showAddressForm && (
        <div className="mb-4">
          <AddressForm onSubmit={onAddressSubmit} onCancel={onToggleAddressForm} />
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          <SkeletonBlock className="h-20 w-full" />
          <SkeletonBlock className="h-20 w-full" />
        </div>
      )}

      <div className="space-y-3">
        {!isLoading &&
          addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              selected={selectedAddressId === address.id}
              onSelect={() => onSelectAddress(address.id)}
            />
          ))}
      </div>
    </section>
  );
}

function validateGuestForm(form: GuestFormState): string {
  if (form.fullName.trim().length < 2) return 'Full name is required.';
  if (form.phone.trim().length < 7) return 'A WhatsApp-reachable phone number is required.';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return 'Enter a valid email address or leave it blank.';
  }
  if (form.state.trim().length < 2) return 'State is required.';
  if (form.city.trim().length < 2) return 'City is required.';
  if (form.area.trim().length < 2) return 'Area or landmark is required.';
  return '';
}
