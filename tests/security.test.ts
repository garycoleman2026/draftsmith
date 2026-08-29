import { describe, expect, it } from 'vitest';
import {
  decryptSecret,
  encryptSecret,
  hashToken,
  redirectWithCookie,
  safeReturnTo,
} from '../lib/security';

describe('credential helpers', () => {
  it('hashes credentials deterministically without retaining the raw value', async () => {
    const hash = await hashToken('private-link-token');
    expect(hash).toBe(await hashToken('private-link-token'));
    expect(hash).not.toContain('private-link-token');
  });

  it('encrypts webhook credentials with authenticated encryption', async () => {
    const secret = 'a production-length encryption key';
    const encrypted = await encryptSecret('https://discord.com/api/webhooks/example', secret);
    expect(encrypted).not.toContain('discord.com');
    expect(await decryptSecret(encrypted, secret)).toBe('https://discord.com/api/webhooks/example');
  });

  it('keeps OAuth redirects on the same origin', () => {
    expect(safeReturnTo('/dashboard?tab=events')).toBe('/dashboard?tab=events');
    expect(safeReturnTo('//evil.example')).toBe('/dashboard');
    expect(safeReturnTo('https://evil.example')).toBe('/dashboard');
  });

  it('returns an OAuth redirect that carries the new session cookie', () => {
    const response = redirectWithCookie(
      'https://draft.example/bingo/studio',
      'terrys_session=test-token; Path=/; HttpOnly; Secure; SameSite=Lax',
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://draft.example/bingo/studio');
    expect(response.headers.get('set-cookie')).toContain('terrys_session=test-token');
  });
});
