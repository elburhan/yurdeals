import { useState, type FormEvent } from 'react';
import type { AddressSummary } from '@yurdeals/shared';
import type { AddressPayload } from '../lib/addressApi';

interface AddressFormProps {
  initialAddress?: AddressSummary | null;
  isSubmitting?: boolean;
  onSubmit: (payload: AddressPayload) => Promise<void>;
  onCancel?: () => void;
}

export function AddressForm({
  initialAddress = null,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: AddressFormProps) {
  const [form, setForm] = useState<AddressPayload>({
    label: initialAddress?.label ?? '',
    first_name: initialAddress?.firstName ?? '',
    last_name: initialAddress?.lastName ?? '',
    phone: initialAddress?.phone ?? '',
    street: initialAddress?.street ?? '',
    city: initialAddress?.city ?? '',
    state: initialAddress?.state ?? '',
    country: initialAddress?.country ?? 'Nigeria',
    postal_code: initialAddress?.postalCode ?? '',
    is_default: initialAddress?.isDefault ?? false,
  });
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    try {
      await onSubmit({
        ...form,
        label: form.label?.trim() || undefined,
        postal_code: form.postal_code?.trim() || undefined,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save address');
    }
  }

  function updateField(field: keyof AddressPayload, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-surface-200 bg-white p-4"
    >
      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Label"
          value={form.label ?? ''}
          onChange={(value) => updateField('label', value)}
        />
        <Field
          label="Phone"
          value={form.phone}
          onChange={(value) => updateField('phone', value)}
          required
        />
        <Field
          label="First name"
          value={form.first_name}
          onChange={(value) => updateField('first_name', value)}
          required
        />
        <Field
          label="Last name"
          value={form.last_name}
          onChange={(value) => updateField('last_name', value)}
          required
        />
      </div>

      <Field
        label="Street"
        value={form.street}
        onChange={(value) => updateField('street', value)}
        required
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label="City"
          value={form.city}
          onChange={(value) => updateField('city', value)}
          required
        />
        <Field
          label="State"
          value={form.state}
          onChange={(value) => updateField('state', value)}
          required
        />
        <Field
          label="Postal code"
          value={form.postal_code ?? ''}
          onChange={(value) => updateField('postal_code', value)}
        />
      </div>

      <Field
        label="Country"
        value={form.country ?? 'Nigeria'}
        onChange={(value) => updateField('country', value)}
      />

      <label className="flex min-h-12 items-center gap-3 text-sm font-medium text-surface-700">
        <input
          type="checkbox"
          checked={Boolean(form.is_default)}
          onChange={(event) => updateField('is_default', event.target.checked)}
          className="h-5 w-5 accent-primary-600"
        />
        Use as default address
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-12 rounded-full bg-primary-600 px-5 py-3 font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-surface-300"
        >
          {isSubmitting ? 'Saving...' : 'Save address'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-full border border-surface-300 px-5 py-3 font-semibold text-surface-700 hover:border-primary-300 hover:text-primary-700"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

interface FieldProps {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}

function Field({ label, value, required = false, onChange }: FieldProps) {
  const id = label.toLowerCase().replace(/\s+/g, '-');

  return (
    <label htmlFor={id} className="block text-sm font-medium text-surface-700">
      <span>{label}</span>
      <input
        id={id}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-12 w-full rounded-lg border border-surface-300 px-3 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 sm:text-sm"
      />
    </label>
  );
}
