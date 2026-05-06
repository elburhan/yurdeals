interface ShippingFormState {
  fullName: string;
  phone: string;
  email: string;
  state: string;
  city: string;
  area: string;
  preferredContactMethod: 'WHATSAPP' | 'SMS' | 'CALL';
}

interface ShippingFormProps {
  form: ShippingFormState;
  onChange: (form: ShippingFormState) => void;
}

export function ShippingForm({ form, onChange }: ShippingFormProps): JSX.Element {
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
          autoComplete="name"
          onChange={(fullName) => onChange({ ...form, fullName })}
        />
        <GuestInput
          label="Phone number"
          value={form.phone}
          type="tel"
          autoComplete="tel"
          required
          onChange={(phone) => onChange({ ...form, phone })}
        />
        <GuestInput
          label="Email (optional)"
          value={form.email}
          type="email"
          autoComplete="email"
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
        <GuestInput
          label="State"
          value={form.state}
          autoComplete="address-level1"
          onChange={(state) => onChange({ ...form, state })}
        />
        <GuestInput
          label="City"
          value={form.city}
          autoComplete="address-level2"
          onChange={(city) => onChange({ ...form, city })}
        />
        <GuestInput
          label="Area / landmark"
          value={form.area}
          autoComplete="street-address"
          onChange={(area) => onChange({ ...form, area })}
        />
      </div>

      <p className="mt-4 rounded-lg bg-primary-50 p-3 text-sm font-medium text-primary-800">
        We deliver to all major cities in Nigeria.
      </p>
    </section>
  );
}

function GuestInput({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-surface-700">
      {label}
      {required && <span className="sr-only">required</span>}
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 rounded-lg border border-surface-300 px-3 text-base font-normal sm:text-sm"
      />
    </label>
  );
}
