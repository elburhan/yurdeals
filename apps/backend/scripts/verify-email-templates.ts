import assert from 'node:assert/strict';
import {
  renderOrderCreatedEmail,
  renderOtpEmail,
  renderPaymentConfirmedEmail,
} from '../src/services/emailTemplates';

const maliciousName = 'Aisha <script>alert("x")</script> & Sons';
const maliciousProduct = 'Power Bank <img src=x onerror=alert(1)>';

const otp = renderOtpEmail({
  code: '123456',
  expiresInSeconds: 600,
});

assert.equal(otp.subject, 'Your YurDeals verification code');
assert.match(otp.html, /123456/);
assert.match(otp.text, /123456/);
assert.match(otp.html, /If you did not request this, you can ignore this email\./);

const orderCreated = renderOrderCreatedEmail({
  customerName: maliciousName,
  orderNumber: 'YD-EMAIL-QA-001',
  items: [
    {
      id: 'item_1',
      productId: 'product_1',
      variantId: null,
      name: maliciousProduct,
      price: 15000,
      quantity: 2,
      total: 30000,
      stockTypeSnapshot: 'PREORDER',
      inspectionRequired: true,
    },
  ],
  total: 30000,
  currency: 'NGN',
});

assert.match(orderCreated.subject, /YD-EMAIL-QA-001/);
assert.match(orderCreated.html, /Your preorder has been received/);
assert.match(orderCreated.html, /YD-EMAIL-QA-001/);
assert.match(orderCreated.text, /Power Bank/);
assert.doesNotMatch(orderCreated.html, /<script>/);
assert.doesNotMatch(orderCreated.html, /<img src=x/);
assert.match(orderCreated.html, /Aisha &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; Sons/);
assert.match(orderCreated.html, /Power Bank &lt;img src=x onerror=alert\(1\)&gt;/);

const paymentConfirmed = renderPaymentConfirmedEmail({
  customerName: maliciousName,
  orderNumber: 'YD-EMAIL-QA-002',
  amount: 45000,
  currency: 'NGN',
});

assert.match(paymentConfirmed.subject, /YD-EMAIL-QA-002/);
assert.match(paymentConfirmed.html, /Payment confirmed/);
assert.match(paymentConfirmed.html, /Amount paid/);
assert.match(paymentConfirmed.text, /supplier confirmation/);
assert.doesNotMatch(paymentConfirmed.html, /<script>/);
assert.match(paymentConfirmed.html, /Aisha &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; Sons/);

process.stdout.write('Email template verification passed.\n');
