const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function randomToken(length = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return toBase64Url(bytes);
}

export async function hashToken(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return toBase64Url(new Uint8Array(digest));
}

export function parseCookies(request: Request) {
  const cookies = new Map<string, string>();
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies.set(key, decodeURIComponent(value));
  }
  return cookies;
}

export function sessionCookie(token: string, maxAgeSeconds = 60 * 60 * 24 * 30) {
  return `terrys_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie() {
  return 'terrys_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

export function redirectWithCookie(location: string, cookie: string, status = 302) {
  return new Response(null, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      Location: location,
      'Set-Cookie': cookie,
    },
  });
}

export function safeReturnTo(value: string | null | undefined, fallback = '/dashboard') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  return value.slice(0, 500);
}

export function clientAddress(request: Request) {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export async function clientFingerprint(request: Request) {
  const agent = request.headers.get('user-agent')?.slice(0, 160) ?? 'unknown';
  return hashToken(`${clientAddress(request)}|${agent}`);
}

export async function encryptSecret(value: string, secret: string) {
  const key = await encryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(value));
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(value: string, secret: string) {
  const [version, rawIv, rawCipher] = value.split('.');
  if (version !== 'v1' || !rawIv || !rawCipher) throw new Error('Unsupported encrypted value.');
  const key = await encryptionKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(rawIv) },
    key,
    fromBase64Url(rawCipher),
  );
  return decoder.decode(decrypted);
}

async function encryptionKey(secret: string) {
  if (secret.length < 24) throw new Error('APP_ENCRYPTION_KEY must contain at least 24 characters.');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function toBase64Url(bytes: Uint8Array) {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}
