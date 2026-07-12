/**
 * Session middleware using express-session with MemoryStore.
 * Simple demo auth with a hardcoded password.
 */

import session from 'express-session';
import type { Express, Request } from 'express';

export interface SessionUser {
  userId: string;
  userName: string;
}

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
  }
}

const DEMO_PASSWORD = 'demo123';

export function initializeSessionMiddleware(app: Express): void {
  const sessionSecret = process.env.SESSION_SECRET || 'demo-secret-change-in-prod';

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax',
      },
    })
  );
}

export function getSessionUser(req: Request): SessionUser | null {
  return req.session.user ?? null;
}

export function validateDemoPassword(password: string): boolean {
  return password === DEMO_PASSWORD;
}

export function setSessionUser(req: Request, user: SessionUser): void {
  req.session.user = user;
}

export function clearSessionUser(req: Request): void {
  delete req.session.user;
}
