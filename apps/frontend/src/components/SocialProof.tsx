interface Testimonial {
  name: string;
  location: string;
  text: string;
  proof: string;
  rating: string;
}

export const testimonials = [
  {
    name: 'Chinedu O.',
    location: 'Lagos',
    text: 'My earbuds arrived well packed and the quality was exactly what I expected.',
    proof: 'Delivered to Lagos - 12 days ago',
    rating: '4.9',
  },
  {
    name: 'Aisha B.',
    location: 'Abuja',
    text: 'I paid online and got updates from China until delivery. The process felt safe.',
    proof: 'Verified Purchase',
    rating: '5.0',
  },
  {
    name: 'Olumide K.',
    location: 'Ibadan',
    text: 'The preorder price was better than what I found locally. I will use YurDeals again.',
    proof: 'Delivered to Oyo - 8 days ago',
    rating: '4.8',
  },
  {
    name: 'Chioma E.',
    location: 'Port Harcourt',
    text: 'Support responded on WhatsApp quickly and helped me track my shipment.',
    proof: 'Verified Purchase',
    rating: '4.9',
  },
] as const satisfies Testimonial[];

interface SocialProofProps {
  limit?: number;
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  className?: string;
}

export function SocialProof({
  limit = 3,
  title = 'What Nigerian Customers Are Saying',
  eyebrow = 'Delivery proof',
  subtitle,
  className = '',
}: SocialProofProps): JSX.Element {
  const visibleTestimonials = testimonials.slice(0, limit);

  return (
    <section className={`rounded-2xl border border-surface-200 bg-white p-5 shadow-sm ${className}`}>
      <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">{eyebrow}</p>
      <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-surface-950">
        {title}
      </h2>
      {subtitle && <p className="mt-2 max-w-2xl text-sm leading-6 text-surface-500">{subtitle}</p>}
      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleTestimonials.map((item) => (
          <TestimonialCard key={item.name} item={item} />
        ))}
      </div>
    </section>
  );
}

function TestimonialCard({ item }: { item: Testimonial }): JSX.Element {
  return (
    <article className="rounded-2xl border border-surface-200 bg-surface-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-black text-primary-700">
            {getInitials(item.name)}
          </div>
          <div>
            <h3 className="font-semibold text-surface-950">{item.name}</h3>
            <p className="text-sm text-surface-500">{item.location}</p>
          </div>
        </div>
        <div className="text-right" aria-label={`${item.rating} out of 5 stars`}>
          <p className="text-sm font-black text-amber-500">5 stars</p>
          <p className="text-xs font-bold text-surface-600">{item.rating}</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-surface-700">{item.text}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <p className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700 ring-1 ring-primary-100">
          <VerifiedIcon />
          Verified Purchase
        </p>
        <p className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-surface-600 ring-1 ring-surface-200">
          {item.proof}
        </p>
      </div>
    </article>
  );
}

function VerifiedIcon(): JSX.Element {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.9-9.9a1 1 0 0 0-1.4-1.4L9 10.2 7.5 8.7a1 1 0 0 0-1.4 1.4l2.2 2.2a1 1 0 0 0 1.4 0l4.2-4.2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
