// supabase/functions/_shared/webhook-sig.ts
// HMAC signature verify/sign for webhook payloads.

export interface VerifyParams {
  secret: string;
  payload: string;
  signature: string;
}

async function hmac(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function signPayload(secret: string, payload: string): Promise<string> {
  return hmac(secret, payload);
}

export async function verifyHmacSignature(p: VerifyParams): Promise<boolean> {
  const expected = await hmac(p.secret, p.payload);
  // Constant-time compare
  if (expected.length !== p.signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ p.signature.charCodeAt(i);
  }
  return diff === 0;
}