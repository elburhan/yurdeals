interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (quantity: number) => void;
}

export function QuantityStepper({
  value,
  min = 1,
  max = 99,
  disabled = false,
  onChange,
}: QuantityStepperProps) {
  return (
    <div className="inline-flex min-h-12 items-center rounded-lg border border-surface-300 bg-white">
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
        className="min-h-12 min-w-12 text-lg font-semibold text-surface-700 disabled:cursor-not-allowed disabled:text-surface-300"
        aria-label="Decrease quantity"
      >
        -
      </button>
      <span className="min-w-10 text-center text-base font-semibold text-surface-950 sm:text-sm">{value}</span>
      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        className="min-h-12 min-w-12 text-lg font-semibold text-surface-700 disabled:cursor-not-allowed disabled:text-surface-300"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
