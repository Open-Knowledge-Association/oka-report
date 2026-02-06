import type { Context } from "hono";
import { ZodError } from "zod";
import { Prisma } from "@repo/db/generated/prisma/client";

const formatError = (code: string, message: string) => ({
  success: false,
  error: { code, message },
});

export const errorHandler = (err: Error, c: Context) => {
  if (err instanceof ZodError) {
    return c.json(formatError("validation_error", err.message), 400);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      return c.json(formatError("not_found", "Resource not found"), 404);
    }
    if (err.code === "P1001") {
      return c.json(formatError("db_unavailable", "Database unavailable"), 503);
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return c.json(formatError("db_unavailable", "Database unavailable"), 503);
  }

  console.error(err);
  return c.json(formatError("internal_error", "Internal server error"), 500);
};
