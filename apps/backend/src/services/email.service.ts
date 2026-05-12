import { env, isDevelopment } from '../config';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils';
import { RenderedEmail } from './emailTemplates';

interface SendEmailInput extends RenderedEmail {
  to: string;
  idempotencyKey?: string;
}

interface ResendErrorBody {
  message?: string;
  name?: string;
}

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

export function isEmailReady(): boolean {
  return Boolean(env.EMAIL_ENABLED && env.RESEND_API_KEY && env.EMAIL_FROM);
}

export function isDeliverableEmail(email: string | null | undefined): email is string {
  if (!email) {
    return false;
  }

  const normalized = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && !normalized.endsWith('.local');
}

export async function sendTransactionalEmail(
  input: SendEmailInput,
  options: { required?: boolean } = {},
): Promise<boolean> {
  if (!isDeliverableEmail(input.to)) {
    if (options.required) {
      throw new AppError('A deliverable email address is required', 422, 'EMAIL_RECIPIENT_INVALID');
    }

    logger.info('Transactional email skipped for non-deliverable recipient', {
      subject: input.subject,
    });
    return false;
  }

  if (!isEmailReady()) {
    if (options.required && !isDevelopment) {
      throw new AppError('Email delivery is not configured', 503, 'EMAIL_NOT_CONFIGURED');
    }

    logger.info('Transactional email skipped because email delivery is disabled', {
      to: maskEmail(input.to),
      subject: input.subject,
    });
    return false;
  }

  const response = await fetch(RESEND_EMAILS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(env.EMAIL_REPLY_TO ? { reply_to: env.EMAIL_REPLY_TO } : {}),
    }),
  });

  if (!response.ok) {
    const errorBody = await readResendError(response);
    logger.warn('Transactional email delivery failed', {
      to: maskEmail(input.to),
      subject: input.subject,
      status: response.status,
      providerError: errorBody.message ?? errorBody.name ?? 'Unknown Resend error',
    });
    throw new AppError('Email delivery failed', 502, 'EMAIL_DELIVERY_FAILED');
  }

  logger.info('Transactional email sent', {
    to: maskEmail(input.to),
    subject: input.subject,
    idempotencyKey: input.idempotencyKey ?? null,
  });
  return true;
}

async function readResendError(response: Response): Promise<ResendErrorBody> {
  try {
    const body = (await response.json()) as unknown;
    if (!body || typeof body !== 'object') {
      return {};
    }

    const record = body as Record<string, unknown>;
    return {
      message: typeof record.message === 'string' ? record.message : undefined,
      name: typeof record.name === 'string' ? record.name : undefined,
    };
  } catch {
    return {};
  }
}

function maskEmail(email: string): string {
  const [localPartRaw, domainRaw = ''] = email.split('@');
  const localPart = localPartRaw ?? '';
  const domain = domainRaw || 'unknown';
  const visible = localPart.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(localPart.length - 2, 1))}@${domain}`;
}
