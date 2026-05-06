// ============================================
// Notification Repository
// ============================================

import { Prisma } from '@prisma/client';
import { NotificationSummary } from '@yurdeals/shared';
import { prisma } from '../config';

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  title: true,
  message: true,
  data: true,
  isRead: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

type NotificationRecord = Prisma.NotificationGetPayload<{
  select: typeof NOTIFICATION_SELECT;
}>;

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  eventKey: string;
  data?: Prisma.InputJsonObject;
}

export class NotificationRepository {
  async createOnce(input: CreateNotificationInput): Promise<NotificationSummary | null> {
    const existingNotification = await prisma.notification.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        data: {
          path: ['eventKey'],
          equals: input.eventKey,
        },
      },
      select: NOTIFICATION_SELECT,
    });

    if (existingNotification) {
      return null;
    }

    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: {
          ...(input.data ?? {}),
          eventKey: input.eventKey,
        },
      },
      select: NOTIFICATION_SELECT,
    });

    return mapNotification(notification);
  }

  async findRecentByUserId(userId: string, limit: number): Promise<NotificationSummary[]> {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      select: NOTIFICATION_SELECT,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return notifications.map(mapNotification);
  }
}

function mapNotification(notification: NotificationRecord): NotificationSummary {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    data: notification.data,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
  };
}

export const notificationRepository = new NotificationRepository();
