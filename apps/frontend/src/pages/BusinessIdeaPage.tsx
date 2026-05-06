import { Link, Navigate, useParams } from 'react-router-dom';
import { CustomerNav } from '../components/CustomerNav';
import { businessIdeas, getBusinessIdeaBySlug } from '../data/businessIdeas';

export default function BusinessIdeaPage() {
  const { slug = '' } = useParams();
  const idea = getBusinessIdeaBySlug(slug);

  if (!idea) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="min-h-screen bg-surface-50 pb-24 sm:pb-0">
      <CustomerNav />
      <article className="container-app max-w-3xl py-8">
        <Link to="/" className="text-sm font-semibold text-primary-700 hover:text-primary-800">
          Back to home
        </Link>
        <div className="mt-5 rounded-lg border border-surface-200 bg-white p-5 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
            Business Ideas
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-surface-950 sm:text-4xl">
            {idea.title}
          </h1>
          <time className="mt-3 block text-sm text-surface-500" dateTime={idea.publishedAt}>
            {formatDate(idea.publishedAt)}
          </time>
          <p className="mt-5 text-lg leading-8 text-surface-700">{idea.excerpt}</p>
          <div className="mt-6 space-y-5">
            {idea.content.map((paragraph) => (
              <p key={paragraph} className="text-base leading-8 text-surface-600">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <section className="mt-8">
          <h2 className="font-display text-xl font-bold text-surface-950">More ideas</h2>
          <div className="mt-3 grid gap-3">
            {businessIdeas
              .filter((item) => item.id !== idea.id)
              .map((item) => (
                <Link
                  key={item.id}
                  to={`/ideas/${item.slug}`}
                  className="rounded-lg border border-surface-200 bg-white p-4 hover:border-primary-200"
                >
                  <p className="font-semibold text-surface-950">{item.title}</p>
                  <p className="mt-1 text-sm text-surface-500">{item.excerpt}</p>
                </Link>
              ))}
          </div>
        </section>
      </article>
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}
