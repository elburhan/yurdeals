import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AddressSummary, OrderSummary } from '@yurdeals/shared';
import { AddressCard } from '../components/AddressCard';
import { AddressForm } from '../components/AddressForm';
import { CheckoutSteps } from '../components/CheckoutSteps';
import { CustomerNav } from '../components/CustomerNav';
import { OrderSummary as CheckoutOrderSummary } from '../components/OrderSummary';
import { PaymentPanel } from '../components/PaymentPanel';
import {
  getEmailError,
  getNigerianPhoneError,
  normalizeNigerianPhoneNumber,
  ShippingForm,
  type ShippingFormState,
} from '../components/ShippingForm';
import { SkeletonBlock, SummarySkeleton } from '../components/Skeleton';
import { TrustBanner } from '../components/TrustBanner';
import { formatPrice } from '../components/ProductCard';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { useToast } from '../context/ToastContext';
import { createAddress, getAddresses, type AddressPayload } from '../lib/addressApi';
import { createGuestOrder, createOrder } from '../lib/orderApi';

const GUEST_CHECKOUT_STORAGE_KEY = 'yurdeals_guest_checkout_form';

const emptyGuestForm: ShippingFormState = {
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
  const { isAuthenticated, user } = useAuth();
  const { cart, refreshCart } = useCart();
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState<AddressSummary[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [guestForm, setGuestForm] = useState<ShippingFormState>(emptyGuestForm);
  const [notes, setNotes] = useState('');
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [guestAccessToken, setGuestAccessToken] = useState('');
  const [isLoading, setIsLoading] = useState(isAuthenticated);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [error, setError] = useState('');
  const [hasRestoredGuestForm, setHasRestoredGuestForm] = useState(false);

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

  useEffect(() => {
    if (isAuthenticated || hasRestoredGuestForm || typeof window === 'undefined') {
      return;
    }

    try {
      const stored = window.localStorage.getItem(GUEST_CHECKOUT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ShippingFormState>;
        setGuestForm({
          ...emptyGuestForm,
          ...parsed,
          preferredContactMethod:
            parsed.preferredContactMethod === 'SMS' ||
            parsed.preferredContactMethod === 'CALL' ||
            parsed.preferredContactMethod === 'WHATSAPP'
              ? parsed.preferredContactMethod
              : 'WHATSAPP',
        });
      }
    } catch {
      window.localStorage.removeItem(GUEST_CHECKOUT_STORAGE_KEY);
    } finally {
      setHasRestoredGuestForm(true);
    }
  }, [hasRestoredGuestForm, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(GUEST_CHECKOUT_STORAGE_KEY, JSON.stringify(guestForm));
  }, [guestForm, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !user?.email || guestForm.email.trim()) {
      return;
    }

    setGuestForm((current) => ({
      ...current,
      email: current.email.trim() || user.email,
    }));
  }, [guestForm.email, isAuthenticated, user?.email]);

  useEffect(() => {
    if (!order) {
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [order]);

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
        const normalizedPhone = normalizeNigerianPhoneNumber(guestForm.phone) ?? guestForm.phone.trim();

        const response = await createGuestOrder({
          guest: {
            full_name: guestForm.fullName.trim(),
            phone: normalizedPhone,
            email: guestForm.email.trim().toLowerCase(),
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
        setGuestForm((current) => ({ ...current, phone: normalizedPhone }));
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
  const phoneError = !isAuthenticated && error.includes('phone number') ? getNigerianPhoneError(guestForm.phone) : '';
  const selectedAddress =
    order?.shippingAddress ??
    addresses.find((address) => address.id === selectedAddressId) ??
    null;

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

          {order ? (
            <ShippingDetailsSummary
              isAuthenticated={isAuthenticated}
              receiptEmail={isAuthenticated ? user?.email ?? '' : guestForm.email}
              guestForm={guestForm}
              address={selectedAddress}
            />
          ) : isAuthenticated ? (
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
            <ShippingForm form={guestForm} onChange={setGuestForm} phoneError={phoneError} />
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

function ShippingDetailsSummary({
  isAuthenticated,
  receiptEmail,
  guestForm,
  address,
}: {
  isAuthenticated: boolean;
  receiptEmail: string;
  guestForm: ShippingFormState;
  address: AddressSummary | null;
}) {
  const guestPhone = normalizeNigerianPhoneNumber(guestForm.phone) ?? guestForm.phone.trim();
  const summaryItems = isAuthenticated
    ? [
        {
          label: 'Recipient',
          value: address ? `${address.firstName} ${address.lastName}` : 'Not available',
        },
        {
          label: 'Phone',
          value: address?.phone ?? 'Not available',
        },
        {
          label: 'Receipt email',
          value: receiptEmail || 'Not available',
        },
        {
          label: 'Address',
          value: address
            ? `${address.street}, ${address.city}, ${address.state}, ${address.country}${
                address.postalCode ? ` ${address.postalCode}` : ''
              }`
            : 'Not available',
        },
      ]
    : [
        {
          label: 'Full name',
          value: guestForm.fullName.trim() || 'Not provided',
        },
        {
          label: 'Phone',
          value: guestPhone || 'Not provided',
        },
        {
          label: 'Email',
          value: receiptEmail.trim() || 'Not provided',
        },
        {
          label: 'State',
          value: guestForm.state.trim() || 'Not provided',
        },
        {
          label: 'City',
          value: guestForm.city.trim() || 'Not provided',
        },
        {
          label: 'Area / landmark',
          value: guestForm.area.trim() || 'Not provided',
        },
        {
          label: 'Preferred contact',
          value: formatContactMethod(guestForm.preferredContactMethod),
        },
      ];

  return (
    <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-surface-950">Shipping details</h2>
          <p className="mt-1 text-sm text-surface-500">
            Your delivery details are locked for this payment step.
          </p>
          <p className="mt-2 text-sm font-medium text-primary-700">
            Your payment receipt will be sent to {receiptEmail || 'your email address'}.
          </p>
        </div>
        <span className="rounded-full bg-surface-100 px-3 py-1 text-xs font-semibold text-surface-700">
          Read only
        </span>
      </div>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        {summaryItems.map((item) => (
          <div key={item.label} className="rounded-lg bg-surface-50 p-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-surface-500">
              {item.label}
            </dt>
            <dd className="mt-1 text-sm font-medium leading-6 text-surface-900">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
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

function validateGuestForm(form: ShippingFormState): string {
  if (form.fullName.trim().length < 2) return 'Full name is required.';
  const phoneError = getNigerianPhoneError(form.phone);
  if (phoneError) return phoneError;
  const emailError = getEmailError(form.email);
  if (emailError) return emailError;
  if (form.state.trim().length < 2) return 'State is required.';
  if (form.city.trim().length < 2) return 'City is required.';
  if (form.area.trim().length < 2) return 'Area or landmark is required.';
  return '';
}

function formatContactMethod(value: ShippingFormState['preferredContactMethod']): string {
  if (value === 'SMS') return 'SMS';
  if (value === 'CALL') return 'Call';
  return 'WhatsApp';
}
