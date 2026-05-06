const steps = ['Order Placed', 'Inspection in China', 'Shipping to Nigeria', 'Delivered to Your Door'];

export function DeliveryTimeline(): JSX.Element {
  return (
    <section className="rounded-lg border border-surface-200 bg-white p-5">
      <h2 className="font-display text-xl font-bold text-surface-950">Delivery timeline</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3 sm:flex-col sm:items-start">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
              {index + 1}
            </span>
            <p className="text-sm font-semibold text-surface-800">{step}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
