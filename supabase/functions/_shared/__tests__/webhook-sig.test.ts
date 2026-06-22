// Jest test for webhook-sig helper. Uses Node Web Crypto (Node 18+).

import { signPayload, verifyHmacSignature } from '../webhook-sig';

describe('webhook-sig', () => {
  it('signs and verifies a payload', async () => {
    const secret = 'test-secret';
    const payload = JSON.stringify({ event: 'order.created', id: '123' });
    const sig = await signPayload(secret, payload);
    await expect(verifyHmacSignature({ secret, payload, signature: sig })).resolves.toBe(true);
  });

  it('rejects tampered payload', async () => {
    const secret = 'test-secret';
    const sig = await signPayload(secret, '{"a":1}');
    await expect(verifyHmacSignature({ secret, payload: '{"a":2}', signature: sig })).resolves.toBe(false);
  });

  it('rejects wrong signature length', async () => {
    await expect(verifyHmacSignature({ secret: 's', payload: 'p', signature: 'short' })).resolves.toBe(false);
  });
});