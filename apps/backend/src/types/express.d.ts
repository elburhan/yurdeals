import type { UserRoleType } from '@yurdeals/shared';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: UserRoleType;
      isActive: boolean;
    };
    correlationId?: string;
  }
}
