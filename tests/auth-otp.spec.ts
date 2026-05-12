import { expect, test } from '@playwright/test';

const BACKEND_BASE_URL = process.env.PLAYWRIGHT_BACKEND_URL ?? 'http://localhost:4000/api/v1';

test('register -> verify OTP -> authenticated redirect', async ({ page, request }) => {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `yurdeals_test_${uniqueSuffix}@example.com`;
  const phone = `+23480${Math.floor(100000000 + Math.random() * 899999999)}`;
  const password = 'StrongPass1';

  await page.goto('/register');

  await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();
  await page.getByLabel(/full name/i).fill('Yurdeals Playwright');
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^phone/i).fill(phone);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByLabel(/confirm password/i).fill(password);

  await page.getByRole('button', { name: /create account/i }).click();

  await expect(page).toHaveURL(/\/verify-otp$/);
  await expect(page.getByRole('heading', { name: /verify your account/i })).toBeVisible();

  const otp = await waitForLatestOtp(request, email);

  await page.getByLabel(/verification code/i).fill(otp);
  await page.getByRole('button', { name: /verify account/i }).click();

  await page.waitForURL((url) => /\/dashboard$/.test(url.pathname) || /\/login$/.test(url.pathname), {
    timeout: 20_000,
  });

  const currentUrl = new URL(page.url());
  if (currentUrl.pathname === '/dashboard') {
    await expect(page.getByText(/welcome back,/i)).toBeVisible();
    await expect(page.getByText(/authenticated/i)).toBeVisible();
    return;
  }

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByText(/account verified successfully\. please sign in to continue\./i),
  ).toBeVisible();
});

async function waitForLatestOtp(
  request: { get: (url: string) => Promise<{ ok(): boolean; status(): number; text(): Promise<string>; json(): Promise<unknown> }> },
  email: string,
): Promise<string> {
  const encodedEmail = encodeURIComponent(email);
  const lastErrors: string[] = [];

  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const response = await request.get(
      `${BACKEND_BASE_URL}/auth/dev/latest-otp?identifier=${encodedEmail}&channel=EMAIL`,
    );

    if (response.ok()) {
      const body = (await response.json()) as {
        data?: { verification?: { code?: string } };
      };

      const code = body.data?.verification?.code;
      if (typeof code === 'string' && /^\d{6}$/.test(code)) {
        return code;
      }

      lastErrors.push('OTP helper responded without a valid 6-digit code.');
    } else {
      lastErrors.push(`OTP helper returned ${response.status()}: ${await response.text()}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    [
      'Unable to retrieve a development OTP from /api/v1/auth/dev/latest-otp.',
      'Make sure the backend is running in development mode and the helper route is enabled.',
      ...lastErrors.slice(-3),
    ].join('\n'),
  );
}
