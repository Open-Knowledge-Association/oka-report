import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { prisma } from "@repo/db";

export async function authMiddleware(c: Context, next: Next) {
  const sessionToken = getCookie(c, "session");

  if (!sessionToken) {
    return c.json({ error: "Unauthorized", code: "unauthorized" }, 401);
  }

  const session = await prisma.session.findUnique({
    where: { token: sessionToken },
    include: { user: true },
  });

  if (!session) {
    return c.json({ error: "Unauthorized", code: "unauthorized" }, 401);
  }

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return c.json({ error: "Session expired", code: "session_expired" }, 401);
  }

  c.set("user", session.user);
  c.set("session", session);

  await next();
}
