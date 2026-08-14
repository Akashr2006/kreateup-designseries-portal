/**
 * Constants shared between the edge middleware and the Node server runtime.
 *
 * `auth.ts` imports `server-only` and pulls in Prisma and bcrypt, neither of
 * which can run on the edge — so the cookie name lives here instead, where both
 * runtimes can reach it.
 */
export const SESSION_COOKIE = "kup_session";
