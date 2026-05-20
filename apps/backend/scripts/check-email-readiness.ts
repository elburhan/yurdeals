import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

interface ParsedAddress {
  email: string;
  domain: string;
}

const strictMode = process.argv.includes('--strict');
const emailEnabled = parseBoolean(process.env.EMAIL_ENABLED);
const resendApiKey = getTrimmedEnv('RESEND_API_KEY');
const emailFrom = getTrimmedEnv('EMAIL_FROM');
const emailReplyTo = getTrimmedEnv('EMAIL_REPLY_TO');
const results: CheckResult[] = [];

addResult({
  name: 'EMAIL_ENABLED',
  status: emailEnabled ? 'pass' : strictMode ? 'fail' : 'warn',
  message: emailEnabled
    ? 'Email delivery is enabled.'
    : 'Email delivery is disabled. Set EMAIL_ENABLED=true only after Resend domain verification is complete.',
});

addResult(validateSecretPresence('RESEND_API_KEY', resendApiKey, emailEnabled || strictMode));
addResult(validateResendKeyShape(resendApiKey, emailEnabled || strictMode));

const fromAddress = parseEmailAddress(emailFrom);
addResult(validateAddress('EMAIL_FROM', emailFrom, fromAddress, emailEnabled || strictMode));

const replyToAddress = parseEmailAddress(emailReplyTo);
addResult(validateAddress('EMAIL_REPLY_TO', emailReplyTo, replyToAddress, emailEnabled || strictMode));

if (fromAddress) {
  addResult({
    name: 'EMAIL_FROM domain',
    status: fromAddress.domain === 'yurdeals.com' ? 'pass' : 'warn',
    message:
      fromAddress.domain === 'yurdeals.com'
        ? 'Sender uses the recommended yurdeals.com domain.'
        : 'Sender should use the verified production domain, recommended: YurDeals <orders@yurdeals.com>.',
  });
}

if (replyToAddress) {
  addResult({
    name: 'EMAIL_REPLY_TO inbox',
    status: replyToAddress.email === 'support@yurdeals.com' ? 'pass' : 'warn',
    message:
      replyToAddress.email === 'support@yurdeals.com'
        ? 'Reply-to uses the recommended support inbox.'
        : 'Reply-to should route to a monitored inbox, recommended: support@yurdeals.com.',
  });
}

const failures = results.filter((result) => result.status === 'fail');

for (const result of results) {
  console.info(`${result.status.toUpperCase()} ${result.name}: ${result.message}`);
}

console.info('No network calls were made and no emails were sent.');

if (failures.length > 0) {
  console.error(`Email readiness check failed with ${failures.length} blocking issue(s).`);
  process.exitCode = 1;
} else {
  console.info('Email readiness check completed.');
}

function addResult(result: CheckResult): void {
  results.push(result);
}

function getTrimmedEnv(key: string): string {
  return process.env[key]?.trim() ?? '';
}

function parseBoolean(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

function validateSecretPresence(key: string, value: string, required: boolean): CheckResult {
  if (value.length > 0) {
    return {
      name: key,
      status: 'pass',
      message: 'Value is set. Secret value was not printed.',
    };
  }

  return {
    name: key,
    status: required ? 'fail' : 'warn',
    message: 'Value is not set. Configure it in Render only before enabling production email.',
  };
}

function validateResendKeyShape(value: string, required: boolean): CheckResult {
  if (!value) {
    return {
      name: 'RESEND_API_KEY shape',
      status: required ? 'fail' : 'warn',
      message: 'Cannot validate key shape because RESEND_API_KEY is not set.',
    };
  }

  if (!value.startsWith('re_')) {
    return {
      name: 'RESEND_API_KEY shape',
      status: 'fail',
      message: 'Resend API keys should start with re_. Secret value was not printed.',
    };
  }

  return {
    name: 'RESEND_API_KEY shape',
    status: 'pass',
    message: 'Key has the expected Resend prefix. Secret value was not printed.',
  };
}

function validateAddress(
  key: string,
  value: string,
  parsedAddress: ParsedAddress | null,
  required: boolean,
): CheckResult {
  if (!value) {
    return {
      name: key,
      status: required ? 'fail' : 'warn',
      message: 'Value is not set.',
    };
  }

  if (!parsedAddress) {
    return {
      name: key,
      status: 'fail',
      message: `${key} must be a valid email address or display name address.`,
    };
  }

  if (parsedAddress.domain === 'resend.dev') {
    return {
      name: key,
      status: 'fail',
      message: `${key} uses the Resend sandbox domain. Production must use a verified YurDeals domain.`,
    };
  }

  if (parsedAddress.email.endsWith('.local')) {
    return {
      name: key,
      status: 'fail',
      message: `${key} must not use a .local placeholder address.`,
    };
  }

  return {
    name: key,
    status: 'pass',
    message: `${key} is syntactically valid.`,
  };
}

function parseEmailAddress(value: string): ParsedAddress | null {
  const trimmed = value.trim();
  const angleMatch = /^.+<([^<>]+)>$/.exec(trimmed);
  const email = (angleMatch?.[1] ?? trimmed).trim().toLowerCase();

  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    return null;
  }

  const domain = email.split('@')[1];
  if (!domain) {
    return null;
  }

  return { email, domain };
}
