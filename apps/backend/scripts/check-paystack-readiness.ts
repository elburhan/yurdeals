import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

const strictMode = process.argv.includes('--strict') || process.argv.includes('--live');
const results: CheckResult[] = [];

const secretKey = getEnv('PAYSTACK_SECRET_KEY');
const publicKey = getEnv('PAYSTACK_PUBLIC_KEY');
const callbackUrl = getEnv('PAYSTACK_CALLBACK_URL');
const paymentWindowMs = parsePositiveInt('PAYMENT_RATE_LIMIT_WINDOW_MS', 60000);
const paymentMaxRequests = parsePositiveInt('PAYMENT_RATE_LIMIT_MAX_REQUESTS', 60);
const webhookWindowMs = parsePositiveInt('WEBHOOK_RATE_LIMIT_WINDOW_MS', 60000);
const webhookMaxRequests = parsePositiveInt('WEBHOOK_RATE_LIMIT_MAX_REQUESTS', 600);
const reconciliationThreshold = parsePositiveInt('PAYMENT_RECONCILIATION_THRESHOLD_MINUTES', 15);
const reconciliationBatchSize = parsePositiveInt('PAYMENT_RECONCILIATION_BATCH_SIZE', 50);

add(validatePresence('PAYSTACK_SECRET_KEY', secretKey, true));
add(validatePresence('PAYSTACK_PUBLIC_KEY', publicKey, true));
add(validateKeyPrefix('PAYSTACK_SECRET_KEY', secretKey, 'sk_live_', 'sk_test_'));
add(validateKeyPrefix('PAYSTACK_PUBLIC_KEY', publicKey, 'pk_live_', 'pk_test_'));
add(validateKeyModeAlignment(secretKey, publicKey));
add(validateCallbackUrl(callbackUrl));
add(validatePositiveInt('PAYMENT_RATE_LIMIT_WINDOW_MS', paymentWindowMs));
add(validatePositiveInt('PAYMENT_RATE_LIMIT_MAX_REQUESTS', paymentMaxRequests));
add(validatePositiveInt('WEBHOOK_RATE_LIMIT_WINDOW_MS', webhookWindowMs));
add(validatePositiveInt('WEBHOOK_RATE_LIMIT_MAX_REQUESTS', webhookMaxRequests));
add(validatePositiveInt('PAYMENT_RECONCILIATION_THRESHOLD_MINUTES', reconciliationThreshold));
add(validatePositiveInt('PAYMENT_RECONCILIATION_BATCH_SIZE', reconciliationBatchSize));

add({
  name: 'Paystack webhook URL',
  status: 'pass',
  message:
    'Configure Paystack dashboard webhook URL as https://api.yourdomain.com/api/v1/payments/paystack/webhook.',
});

add({
  name: 'No-network safety',
  status: 'pass',
  message: 'This check made no Paystack API calls and did not create payments.',
});

for (const result of results) {
  console.info(`${result.status.toUpperCase()} ${result.name}: ${result.message}`);
}

const failures = results.filter((result) => result.status === 'fail');
if (failures.length > 0) {
  console.error(`Paystack readiness check failed with ${failures.length} blocking issue(s).`);
  process.exitCode = 1;
} else {
  console.info('Paystack readiness check completed.');
}

function add(result: CheckResult): void {
  results.push(result);
}

function getEnv(key: string): string {
  return process.env[key]?.trim() ?? '';
}

function parsePositiveInt(key: string, fallback: number): number | null {
  const value = getEnv(key);
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function validatePresence(key: string, value: string, required: boolean): CheckResult {
  if (value) {
    return {
      name: key,
      status: 'pass',
      message: 'Value is set. Secret value was not printed.',
    };
  }

  return {
    name: key,
    status: required || strictMode ? 'fail' : 'warn',
    message: 'Value is not set. Configure it in Render only before live-mode payments.',
  };
}

function validateKeyPrefix(
  key: string,
  value: string,
  livePrefix: string,
  testPrefix: string,
): CheckResult {
  if (!value) {
    return {
      name: `${key} mode`,
      status: strictMode ? 'fail' : 'warn',
      message: `Cannot validate ${key} mode because the value is not set.`,
    };
  }

  if (value.startsWith(livePrefix)) {
    return {
      name: `${key} mode`,
      status: 'pass',
      message: 'Live-mode prefix detected. Secret value was not printed.',
    };
  }

  if (value.startsWith(testPrefix)) {
    return {
      name: `${key} mode`,
      status: strictMode ? 'fail' : 'warn',
      message: strictMode
        ? 'Test-mode prefix detected, but live readiness requires live keys.'
        : 'Test-mode prefix detected. This is acceptable before the live-mode switch.',
    };
  }

  return {
    name: `${key} mode`,
    status: 'fail',
    message: `Unexpected key prefix. Expected ${livePrefix} for live or ${testPrefix} for test.`,
  };
}

function validateKeyModeAlignment(secretKey: string, publicKey: string): CheckResult {
  if (!secretKey || !publicKey) {
    return {
      name: 'Paystack key alignment',
      status: strictMode ? 'fail' : 'warn',
      message: 'Cannot compare key modes until both keys are set.',
    };
  }

  const secretMode = secretKey.startsWith('sk_live_')
    ? 'live'
    : secretKey.startsWith('sk_test_')
      ? 'test'
      : 'unknown';
  const publicMode = publicKey.startsWith('pk_live_')
    ? 'live'
    : publicKey.startsWith('pk_test_')
      ? 'test'
      : 'unknown';

  if (secretMode === publicMode && secretMode !== 'unknown') {
    return {
      name: 'Paystack key alignment',
      status: 'pass',
      message: `${secretMode} secret/public key modes match.`,
    };
  }

  return {
    name: 'Paystack key alignment',
    status: 'fail',
    message: 'Secret and public key modes do not match, or one key has an unknown prefix.',
  };
}

function validateCallbackUrl(value: string): CheckResult {
  if (!value) {
    return {
      name: 'PAYSTACK_CALLBACK_URL',
      status: 'fail',
      message: 'Value is not set.',
    };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return {
      name: 'PAYSTACK_CALLBACK_URL',
      status: 'fail',
      message: 'Value must be a valid absolute URL.',
    };
  }

  if (url.protocol !== 'https:' && strictMode) {
    return {
      name: 'PAYSTACK_CALLBACK_URL',
      status: 'fail',
      message: 'Live mode requires an HTTPS callback URL.',
    };
  }

  if (url.protocol !== 'https:') {
    return {
      name: 'PAYSTACK_CALLBACK_URL',
      status: 'warn',
      message: 'Callback URL is not HTTPS. This is acceptable only for local/test setup.',
    };
  }

  if (url.pathname !== '/payment-return') {
    return {
      name: 'PAYSTACK_CALLBACK_URL',
      status: 'fail',
      message: 'Callback URL path must be /payment-return.',
    };
  }

  return {
    name: 'PAYSTACK_CALLBACK_URL',
    status: 'pass',
    message: 'Callback URL is HTTPS and points to /payment-return.',
  };
}

function validatePositiveInt(key: string, value: number | null): CheckResult {
  if (value === null || value <= 0) {
    return {
      name: key,
      status: 'fail',
      message: 'Value must be a positive integer.',
    };
  }

  return {
    name: key,
    status: 'pass',
    message: `Configured as ${value}.`,
  };
}
