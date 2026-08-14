import { audit, handler, ok } from "@/lib/api";
import { destroySession, readSession } from "@/lib/auth";

export const POST = handler(async () => {
  const session = await readSession();
  await destroySession();
  if (session) await audit(session.sub, "LOGOUT", "User", session.sub);
  return ok({ signedOut: true });
});
