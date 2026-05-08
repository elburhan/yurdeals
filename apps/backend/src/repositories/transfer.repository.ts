// ============================================
// Transfer Repository (Internal Scaffolding)
// ============================================

import { Prisma } from '@prisma/client';
import { prisma } from '../config';

export interface TransferAuditRecordInput {
  userId?: string | null;
  action: string;
  reference: string;
  payload: Record<string, unknown>;
}

class TransferRepository {
  async recordAudit(input: TransferAuditRecordInput): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: 'Transfer',
        entityId: input.reference,
        newData: ensureJsonCompatible(input.payload),
      },
    });
  }

  async listAuditTrail(reference: string): Promise<
    Array<{
      id: string;
      action: string;
      createdAt: Date;
      newData: unknown;
      userId: string | null;
    }>
  > {
    return prisma.auditLog.findMany({
      where: {
        entity: 'Transfer',
        entityId: reference,
      },
      select: {
        id: true,
        action: true,
        createdAt: true,
        newData: true,
        userId: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}

function ensureJsonCompatible(payload: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(payload ?? {})) as Prisma.InputJsonValue;
}

export const transferRepository = new TransferRepository();
