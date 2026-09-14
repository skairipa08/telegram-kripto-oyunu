import { z } from 'zod';

const encoder = new TextEncoder();
export const SESSION_SECONDS = 1800;
const userSchema = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  first_name: z.string().min(1).max(256),
  username: z.string().max(64).optional(),
  language_code: z.string().max(32).optional(),
  is_bot: z.literal(false).optional(),
});
export type TelegramUser = z.infer<typeof userSchema>;
export interface SessionClaims {
  sid: string;
  iat: number;
  exp: number;
}
const claimsSchema = z
  .object({
    v: z.literal(1),
    aud: z.literal('empire'),
    sid: z.uuid(),
    iat: z.number().int().nonnegative(),
    exp: z.number().int().nonnegative(),
  })
  .strict();

async function hmacKey(bytes: Uint8Array<ArrayBuffer>) {
  return crypto.subtle.importKey(
    'raw',
    bytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}
function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
function unhex(value: string) {
  return Uint8Array.from(value.match(/../g) ?? [], (b) => parseInt(b, 16));
}
export async function keyedDigest(value: string, secret: string) {
  return hex(
    await crypto.subtle.sign(
      'HMAC',
      await hmacKey(encoder.encode(secret)),
      encoder.encode(value),
    ),
  );
}

export async function validateInitData(
  raw: string,
  botToken: string,
  now: number,
) {
  if (!raw || encoder.encode(raw).byteLength > 16384 || !botToken)
    throw new Error('Invalid initData');
  // URLSearchParams silently replaces malformed encoding; reject it before canonicalizing.
  const params = new Map<string, string>();
  for (const part of raw.split('&')) {
    const separator = part.indexOf('=');
    if (separator < 1) throw new Error('Invalid initData');
    const key = decodeURIComponent(
      part.slice(0, separator).replace(/\+/g, ' '),
    );
    const value = decodeURIComponent(
      part.slice(separator + 1).replace(/\+/g, ' '),
    );
    if (!/^[a-zA-Z0-9_]+$/.test(key) || params.has(key))
      throw new Error('Invalid initData');
    params.set(key, value);
  }
  const hash = params.get('hash');
  if (!hash || !/^[a-fA-F0-9]{64}$/.test(hash))
    throw new Error('Invalid initData');
  params.delete('hash');
  const check = Array.from(params)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(encoder.encode('WebAppData')),
    encoder.encode(botToken),
  );
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(new Uint8Array(secret)),
    unhex(hash),
    encoder.encode(check),
  );
  if (!valid) throw new Error('Invalid initData');
  const date = params.get('auth_date') ?? '';
  if (!/^[0-9]{1,12}$/.test(date)) throw new Error('Invalid initData');
  const authDate = Number(date);
  if (
    !Number.isSafeInteger(authDate) ||
    now - authDate > 300 ||
    authDate - now > 30
  )
    throw new Error('Invalid initData');
  const user = userSchema.parse(JSON.parse(params.get('user') ?? 'null'));
  const fingerprint = await keyedDigest(
    `empire.telegram.v1\n${check}`,
    botToken,
  );
  return { user, fingerprint, authDate };
}

function encode64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
function decode64(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid session');
  const bytes = Uint8Array.from(
    atob(value.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0),
  );
  if (encode64(bytes) !== value) throw new Error('Invalid session');
  return bytes;
}
function assertSecret(secret: string) {
  if (encoder.encode(secret).byteLength < 32)
    throw new Error('Invalid session configuration');
}
export async function signSession(session: SessionClaims, secret: string) {
  assertSecret(secret);
  const claims = claimsSchema.parse({ v: 1, aud: 'empire', ...session });
  if (claims.exp - claims.iat !== SESSION_SECONDS)
    throw new Error('Invalid session lifetime');
  const payload = encode64(encoder.encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(encoder.encode(secret)),
    encoder.encode(`empire.session.v1.${payload}`),
  );
  return `${payload}.${encode64(new Uint8Array(signature))}`;
}
export async function verifySession(
  token: string,
  secret: string,
  now: number,
): Promise<SessionClaims> {
  assertSecret(secret);
  if (token.length > 2048) throw new Error('Invalid session');
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1])
    throw new Error('Invalid session');
  const [payload, signature] = parts as [string, string];
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(encoder.encode(secret)),
    decode64(signature),
    encoder.encode(`empire.session.v1.${payload}`),
  );
  if (!valid) throw new Error('Invalid session');
  const claims = claimsSchema.parse(
    JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(decode64(payload)),
    ),
  );
  if (
    claims.iat > now + 30 ||
    claims.exp <= now ||
    claims.exp - claims.iat !== SESSION_SECONDS
  )
    throw new Error('Invalid session');
  return { sid: claims.sid, iat: claims.iat, exp: claims.exp };
}
