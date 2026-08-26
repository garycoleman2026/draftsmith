import { revokeSession } from '../../../../lib/auth';
import { ensureSchema, json } from '../../../../lib/db';
import { clearSessionCookie } from '../../../../lib/security';

export async function POST(request: Request) {
  await ensureSchema();
  await revokeSession(request);
  const response = json({ signedOut: true });
  response.headers.append('Set-Cookie', clearSessionCookie());
  return response;
}
