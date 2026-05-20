import { useMemo, useState } from 'react';
import { getNigeriaLgas, NIGERIA_STATE_NAMES } from '@yurdeals/shared';

export interface ShippingFormState {
  fullName: string;
  phone: string;
  email: string;
  state: string;
  lga: string;
  city: string;
  area: string;
  street: string;
  landmark: string;
  deliveryNotes: string;
  preferredContactMethod: 'WHATSAPP' | 'SMS' | 'CALL';
}

interface ShippingFormProps {
  form: ShippingFormState;
  onChange: (form: ShippingFormState) => void;
  phoneError?: string;
}

const NIGERIAN_PHONE_ERROR =
  'Enter a valid Nigerian phone number, for example 08012345678 or +2348012345678.';
const EMAIL_ERROR = 'Enter a valid email address. Your payment receipt will be sent here.';

export function normalizeNigerianPhoneNumber(value: string): string | null {
  const compact = value.replace(/[^\d+]/g, '');

  if (/^0\d{10}$/.test(compact)) {
    return isSupportedNigerianMobileLocal(compact) ? `+234${compact.slice(1)}` : null;
  }

  if (/^\+234\d{10}$/.test(compact)) {
    const localFormat = `0${compact.slice(4)}`;
    return isSupportedNigerianMobileLocal(localFormat) ? compact : null;
  }

  if (/^234\d{10}$/.test(compact)) {
    const normalized = `+${compact}`;
    const localFormat = `0${compact.slice(3)}`;
    return isSupportedNigerianMobileLocal(localFormat) ? normalized : null;
  }

  return null;
}

export function getNigerianPhoneError(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'A WhatsApp-reachable Nigerian phone number is required.';
  }

  return normalizeNigerianPhoneNumber(trimmed) ? '' : NIGERIAN_PHONE_ERROR;
}

export function getEmailError(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'Email is required. Your payment receipt will be sent to this address.';
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? '' : EMAIL_ERROR;
}

export function ShippingForm({
  form,
  onChange,
  phoneError,
}: ShippingFormProps): JSX.Element {
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const resolvedPhoneError = useMemo(() => {
    if (phoneError) {
      return phoneError;
    }

    return phoneTouched ? getNigerianPhoneError(form.phone) : '';
  }, [form.phone, phoneError, phoneTouched]);
  const resolvedEmailError = useMemo(
    () => (emailTouched ? getEmailError(form.email) : ''),
    [emailTouched, form.email],
  );
  const lgas = useMemo(() => getNigeriaLgas(form.state), [form.state]);

  return (
    <section className="rounded-lg border border-surface-200 bg-white p-4">
      <div>
        <h2 className="font-display text-xl font-bold text-surface-950">Delivery details</h2>
        <p className="mt-1 text-sm text-surface-500">
          Checkout as guest. You can create an account later to save your details.
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <GuestInput
          label="Full name"
          value={form.fullName}
          required
          autoComplete="name"
          onChange={(fullName) => onChange({ ...form, fullName })}
        />
        <GuestInput
          label="Phone number"
          value={form.phone}
          type="tel"
          autoComplete="tel"
          required
          error={resolvedPhoneError}
          onBlur={() => {
            setPhoneTouched(true);
            const normalized = normalizeNigerianPhoneNumber(form.phone);
            if (normalized) {
              onChange({ ...form, phone: normalized });
            }
          }}
          onChange={(phone) => onChange({ ...form, phone })}
        />
        <GuestInput
          label="Email"
          value={form.email}
          type="email"
          autoComplete="email"
          required
          error={resolvedEmailError}
          helperText="Email is required. Your payment receipt will be sent to this address."
          onBlur={() => {
            setEmailTouched(true);
            onChange({ ...form, email: form.email.trim().toLowerCase() });
          }}
          onChange={(email) => onChange({ ...form, email })}
        />
        <label className="grid gap-1 text-sm font-semibold text-surface-700">
          Preferred contact
          <select
            value={form.preferredContactMethod}
            onChange={(event) =>
              onChange({
                ...form,
                preferredContactMethod: event.target.value as ShippingFormState['preferredContactMethod'],
              })
            }
            className="min-h-12 rounded-lg border border-surface-300 px-3 text-base font-normal sm:text-sm"
          >
            <option value="WHATSAPP">WhatsApp</option>
            <option value="SMS">SMS</option>
            <option value="CALL">Call</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-surface-700">
          State
          <select
            required
            value={form.state}
            autoComplete="address-level1"
            onChange={(event) => onChange({ ...form, state: event.target.value, lga: '' })}
            className="min-h-12 rounded-lg border border-surface-300 px-3 text-base font-normal sm:text-sm"
          >
            <option value="">Select state</option>
            {NIGERIA_STATE_NAMES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-surface-700">
          LGA
          <select
            required
            value={form.lga}
            disabled={!form.state}
            autoComplete="address-level2"
            onChange={(event) => onChange({ ...form, lga: event.target.value })}
            className="min-h-12 rounded-lg border border-surface-300 px-3 text-base font-normal disabled:bg-surface-100 sm:text-sm"
          >
            <option value="">{form.state ? 'Select LGA' : 'Select state first'}</option>
            {lgas.map((lga) => (
              <option key={lga} value={lga}>
                {lga}
              </option>
            ))}
          </select>
        </label>
        <GuestInput
          label="City / town"
          value={form.city}
          autoComplete="address-level3"
          onChange={(city) => onChange({ ...form, city })}
          required
        />
        <GuestInput
          label="Area / district"
          value={form.area}
          autoComplete="address-line2"
          onChange={(area) => onChange({ ...form, area })}
          required
        />
        <GuestInput
          label="Street address"
          value={form.street}
          autoComplete="street-address"
          onChange={(street) => onChange({ ...form, street })}
          required
        />
        <GuestInput
          label="Landmark"
          value={form.landmark}
          helperText="Nearest bus stop, junction, plaza, mosque, filling station, or known building."
          onChange={(landmark) => onChange({ ...form, landmark })}
          required
        />
        <label className="grid gap-1 text-sm font-semibold text-surface-700 sm:col-span-2">
          Delivery notes
          <textarea
            value={form.deliveryNotes}
            maxLength={240}
            rows={3}
            onChange={(event) => onChange({ ...form, deliveryNotes: event.target.value })}
            className="rounded-lg border border-surface-300 px-3 py-2 text-base font-normal sm:text-sm"
            placeholder="Gate color, estate entry instruction, or best time to call"
          />
        </label>
      </div>

      <p className="mt-4 rounded-lg bg-primary-50 p-3 text-sm font-medium text-primary-800">
        We deliver to all major cities in Nigeria.
      </p>
    </section>
  );
}

function isSupportedNigerianMobileLocal(value: string): boolean {
  return /^0(?:70|71|80|81|90|91)\d{8}$/.test(value);
}

function GuestInput({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  required = false,
  error = '',
  helperText,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  onBlur?: () => void;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-surface-700">
      <span>
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? 'true' : 'false'}
        className={`min-h-12 rounded-lg border px-3 text-base font-normal sm:text-sm ${
          error
            ? 'border-red-300 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100'
            : 'border-surface-300'
        }`}
      />
      {error && <span className="text-sm font-normal text-red-600">{error}</span>}
      {!error && helperText ? (
        <span className="text-sm font-normal text-surface-500">{helperText}</span>
      ) : null}
    </label>
  );
}
