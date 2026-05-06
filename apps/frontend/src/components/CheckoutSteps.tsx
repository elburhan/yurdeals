const steps = ['Review Order', 'Delivery Details', 'Payment'];

export function CheckoutSteps({ currentStep }: { currentStep: number }): JSX.Element {
  return (
    <nav className="rounded-lg border border-surface-200 bg-white p-3" aria-label="Checkout progress">
      <ol className="grid gap-2 sm:grid-cols-3">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber <= currentStep;

          return (
            <li
              key={step}
              className={`flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-semibold ${
                isActive ? 'bg-primary-50 text-primary-700' : 'bg-surface-50 text-surface-500'
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  isActive ? 'bg-primary-600 text-white' : 'bg-surface-200 text-surface-600'
                }`}
              >
                {stepNumber}
              </span>
              {step}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
