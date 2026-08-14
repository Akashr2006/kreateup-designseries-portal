import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

import { prisma } from "./prisma";
import { can, canOpenConsole, type PermissionSubject } from "./permissions";
import type { Permission } from "./constants";
import { SESSION_COOKIE } from "./auth-shared";

export { SESSION_COOKIE };

const SESSION_DAYS = Number(process.env.SESSION_DAYS ?? 7);

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or shorter than 32 characters. Copy .env.example to .env and set it."
    );
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: string;
};

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ---------------------------------------------------------------------------
// Session cookie
// ---------------------------------------------------------------------------

export async function createSession(payload: SessionPayload): Promise<void> {
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .setSubject(payload.sub)
    .sign(secretKey());

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      sub: String(payload.sub),
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: String(payload.role ?? "STUDENT"),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

/** Everything the shell and pages need about the signed-in user. */
export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function getCurrentUser() {
  const session = await readSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      name: true,
      email: true,
      rollNo: true,
      department: true,
      year: true,
      mobile: true,
      domain: true,
      mentorName: true,
      linkedin: true,
      github: true,
      role: true,
      systemStatus: true,
      rewardPoints: true,
      avatarSeed: true,
      mustChangePassword: true,
      lastLoginAt: true,
      createdAt: true,
      permUserManagement: true,
      permScanStudentQr: true,
      permMentorTasks: true,
      permLinkedinTracker: true,
      permWorklogs: true,
      permNotifications: true,
      permAttendanceLogs: true,
      permExtensionRequest: true,
      permAdminDatabase: true,
      permActivityApproval: true,
    },
  });

  if (!user || user.systemStatus === "SUSPENDED") return null;
  return user;
}

/** Server-component guard: bounce anonymous visitors to the sign-in page. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user as PermissionSubject, permission)) redirect("/dashboard?denied=1");
  return user;
}

export async function requireConsole() {
  const user = await requireUser();
  if (!canOpenConsole(user as PermissionSubject)) redirect("/dashboard?denied=1");
  return user;
}

// ---------------------------------------------------------------------------
// Route-handler helpers (these throw a Response instead of redirecting)
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "You need to sign in to do that.");
  return user;
}

export async function requireApiPermission(permission: Permission) {
  const user = await requireApiUser();
  if (!can(user as PermissionSubject, permission)) {
    throw new ApiError(403, "You do not have permission to do that.");
  }
  return user;
}
