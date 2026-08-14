import { PrismaClient } from "@prisma/client";

/**
 * Next.js dev-server hot reload re-evaluates modules, which would otherwise
 * open a new connection pool on every edit. Cache the client on globalThis.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
