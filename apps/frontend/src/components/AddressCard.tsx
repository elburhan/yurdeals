import type { AddressSummary } from '@yurdeals/shared';

interface AddressCardProps {
  address: AddressSummary;
  selected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSetDefault?: () => void;
}

export function AddressCard({
  address,
  selected = false,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
}: AddressCardProps) {
  return (
    <article
      className={`rounded-lg border bg-white p-4 ${
        selected ? 'border-primary-500 ring-2 ring-primary-100' : 'border-surface-200'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-surface-950">
              {address.label ?? `${address.firstName} ${address.lastName}`}
            </h3>
            {address.isDefault && (
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700">
                Default
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-surface-600">
            {address.firstName} {address.lastName} · {address.phone}
          </p>
          <p className="mt-2 text-sm leading-6 text-surface-600">
            {address.street}, {address.city}, {address.state}, {address.country}
            {address.postalCode ? ` ${address.postalCode}` : ''}
          </p>
        </div>
        {onSelect && (
          <button
            type="button"
            onClick={onSelect}
            className="min-h-12 w-full rounded-lg px-3 text-sm font-semibold text-primary-700 hover:bg-primary-50 sm:w-auto"
          >
            {selected ? 'Selected' : 'Use'}
          </button>
        )}
      </div>

      {(onEdit || onDelete || onSetDefault) && (
        <div className="mt-4 grid gap-2 text-sm sm:flex sm:flex-wrap">
          {onSetDefault && !address.isDefault && (
            <button
              type="button"
              onClick={onSetDefault}
              className="min-h-12 rounded-lg border border-surface-300 px-3 font-medium text-surface-700 hover:border-primary-300 hover:text-primary-700"
            >
              Set default
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="min-h-12 rounded-lg border border-surface-300 px-3 font-medium text-surface-700 hover:border-primary-300 hover:text-primary-700"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="min-h-12 rounded-lg px-3 font-medium text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </article>
  );
}
