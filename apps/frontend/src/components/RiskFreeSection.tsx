export function RiskFreeSection(): JSX.Element {
  return (
    <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
        Risk-Free Preorder
      </p>
      <h2 className="mt-1 font-display text-2xl font-bold text-surface-950">
        We reduce the risk before your order leaves China.
      </h2>
      <div className="mt-4 grid gap-3 text-sm leading-6 text-surface-700 sm:grid-cols-3">
        <p>Quality inspection in China before shipping.</p>
        <p>Transparent tracking updates from payment to delivery.</p>
        <p>Local WhatsApp and phone support if something goes wrong.</p>
      </div>
    </section>
  );
}
