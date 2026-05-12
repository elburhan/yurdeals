const trustItems = [
  {
    icon: '100+',
    label: '100+ Deliveries',
    detail: 'to Nigeria',
  },
  {
    icon: 'SEC',
    label: 'Secure online checkout',
    detail: 'protected payment flow',
  },
  {
    icon: '25',
    label: '25-40 day delivery',
    detail: 'China to Nigeria',
  },
  {
    icon: 'NG',
    label: 'Built for Nigerians',
    detail: 'local support',
  },
] as const;

export function TrustBar(): JSX.Element {
  return (
    <section
      className="border-b border-primary-100 bg-white/95 text-surface-800 shadow-[0_1px_8px_rgba(15,23,42,0.04)]"
      aria-label="YurDeals trust signals"
    >
      <div className="container-app flex snap-x snap-mandatory items-center gap-2 overflow-x-auto py-1.5 sm:flex-wrap sm:justify-between sm:overflow-visible sm:py-2">
        {trustItems.map((item) => (
          <div
            key={item.label}
            className="inline-flex min-h-9 shrink-0 snap-center items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-left ring-1 ring-primary-100 sm:min-h-10 sm:py-1.5"
          >
            <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-primary-500 px-1.5 text-[10px] font-black text-white shadow-sm">
              {item.icon}
            </span>
            <span className="whitespace-nowrap leading-tight">
              <span className="block text-xs font-bold text-primary-800 sm:text-sm">
                {item.label}
              </span>
              <span className="hidden text-[11px] font-medium text-surface-500 sm:block sm:text-xs">
                {item.detail}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
