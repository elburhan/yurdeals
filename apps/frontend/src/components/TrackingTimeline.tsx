import type { TrackingTimelineEvent } from '@yurdeals/shared';

interface TrackingTimelineProps {
  events: TrackingTimelineEvent[];
}

export function TrackingTimeline({ events }: TrackingTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-surface-300 bg-white p-6 text-center text-sm text-surface-500">
        Tracking updates will appear here once the order starts moving.
      </div>
    );
  }

  return (
    <ol className="relative space-y-5 border-l border-surface-200 pl-5">
      {events.map((event) => (
        <li key={`${event.status}-${event.timestamp}`} className="relative">
          <span
            className={`absolute -left-[29px] top-1 h-4 w-4 rounded-full border-2 ${
              event.completed
                ? 'border-primary-600 bg-primary-600'
                : 'border-surface-300 bg-white'
            }`}
            aria-hidden="true"
          />
          <article className="rounded-lg border border-surface-200 bg-white p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <h2 className="font-display text-base font-bold text-surface-950">
                {event.label}
              </h2>
              <time className="text-xs font-medium text-surface-500" dateTime={event.timestamp}>
                {formatTimelineDate(event.timestamp)}
              </time>
            </div>
            <p className="mt-2 text-sm text-surface-600">{event.description}</p>
            {event.location && (
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-primary-700">
                {event.location}
              </p>
            )}
          </article>
        </li>
      ))}
    </ol>
  );
}

function formatTimelineDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
