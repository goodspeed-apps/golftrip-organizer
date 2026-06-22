import * as Crypto from 'expo-crypto';

export async function signBatchAsync(payload: unknown, secret: string): Promise<string> {
  const body = JSON.stringify(payload);
  const data = `${secret}:${body}`;
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
}
