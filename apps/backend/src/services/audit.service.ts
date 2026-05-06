// ============================================
// Audit Log Service
// ============================================

import { Prisma } from '@prisma/client';
import { prisma } from '../config';
import { logger } from '../utils';

export interface AuditContext {
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditLogInput extends AuditContext {
  action: string;
  entity: string;
  entityId?: string | null;
  oldData?: Prisma.InputJsonValue;
  newData?: Prisma.InputJsonValue;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        oldData: input.oldData ?? undefined,
        newData: input.newData ?? undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    logger.warn('Audit logging failed', {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      error: error instanceof Error ? error.message : 'Unknown audit error',
    });
  }
}
