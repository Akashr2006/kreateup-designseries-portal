import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ApiError } from "./auth";
import { prisma } from "./prisma";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

/**
 * Wraps a route handler so auth failures, validation errors and unexpected
 * crashes all come back as the same JSON envelope the client expects.
 */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ApiError) return fail(error.message, error.status);
      if (error instanceof ZodError) {
        const first = error.issues[0];
        return fail(first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input", 422, error.issues);
      }
      console.error("[api]", error);
      return fail("Something went wrong on our side. Please try again.", 500);
    }
  };
}

/** Records a privileged mutation. Never throws — auditing must not break a write. */
export async function audit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId = "",
  meta: Record<string, unknown> = {}
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { actorId, action, entity, entityId, meta: JSON.stringify(meta) },
    });
  } catch (error) {
    console.error("[audit] failed to record", action, error);
  }
}
