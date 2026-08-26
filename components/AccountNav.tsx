'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type SessionState = {
  configured: boolean;
  user: { displayName: string | null; username: string } | null;
};

export function AccountNav() {
  const [session, setSession] = useState<SessionState | null>(null);

  useEffect(() => {
    let active = true;
    void fetch('/api/auth/session', { cache: 'no-store' })
      .then((response) => response.json() as Promise<SessionState>)
      .then((next) => {
        if (active) setSession(next);
      })
      .catch(() => {
        if (active) setSession({ configured: false, user: null });
      });
    return () => {
      active = false;
    };
  }, []);

  if (!session) return <span className="h-9 w-24 animate-pulse rounded bg-white/5" aria-hidden="true" />;
  if (session.user) {
    return (
      <Link className="iron-button px-3 py-2 text-xs" href="/dashboard">
        {session.user.displayName || session.user.username}
      </Link>
    );
  }
  return session.configured ? (
    <a className="iron-button px-3 py-2 text-xs" href="/api/auth/discord/start?returnTo=/dashboard">
      Sign in
    </a>
  ) : (
    <Link className="iron-button px-3 py-2 text-xs" href="/dashboard">
      Dashboard
    </Link>
  );
}
