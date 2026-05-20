import { useEffect, useRef, useState } from 'react';
import type { NotificationSummary } from '@yurdeals/shared';
import { useAuth } from '../hooks/useAuth';
import { getNotifications, markAllNotificationsRead } from '../lib/notificationApi';

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let isMounted = true;
    function loadNotifications() {
      getNotifications()
      .then((response) => {
        if (isMounted) {
          setNotifications(response.data.notifications);
          setError('');
        }
      })
      .catch((requestError: Error) => {
        if (isMounted) {
          setError(requestError.message);
        }
      });
    }

    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 60000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  if (!isAuthenticated) {
    return null;
  }

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  function handleToggleNotifications() {
    const nextIsOpen = !isOpen;
    setIsOpen(nextIsOpen);

    if (!nextIsOpen || unreadCount === 0) {
      return;
    }

    const previousNotifications = notifications;
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => ({ ...notification, isRead: true })),
    );

    markAllNotificationsRead().catch((requestError: Error) => {
      setNotifications(previousNotifications);
      setError(requestError.message);
    });
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={handleToggleNotifications}
        className="relative min-h-11 rounded-full border border-surface-200 px-4 text-sm font-semibold text-surface-700 hover:border-primary-300 hover:text-primary-700"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        Alerts
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1 text-xs font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-surface-200 bg-white p-3 shadow-xl"
          role="dialog"
          aria-label="Recent notifications"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-bold text-surface-950">Notifications</h2>
            <span className="text-xs text-surface-500">{notifications.length} recent</span>
          </div>

          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          {!error && notifications.length === 0 && (
            <p className="rounded-lg bg-surface-50 p-3 text-sm text-surface-500">
              No notifications yet.
            </p>
          )}

          <div className="max-h-80 space-y-2 overflow-y-auto">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className={
                  notification.isRead
                    ? 'rounded-lg border border-surface-100 bg-surface-50 p-3'
                    : 'rounded-lg border border-primary-100 bg-primary-50 p-3'
                }
              >
                <h3 className="text-sm font-semibold text-surface-950">{notification.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-surface-600">
                  {notification.message}
                </p>
                <time
                  className="mt-2 block text-xs text-surface-400"
                  dateTime={notification.createdAt}
                >
                  {formatNotificationTime(notification.createdAt)}
                </time>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatNotificationTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
