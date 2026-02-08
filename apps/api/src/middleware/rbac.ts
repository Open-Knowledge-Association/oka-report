import type { Context, Next } from "hono";

export function requireRole(allowedRoles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized", code: "unauthorized" }, 401);
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json({ error: "Forbidden", code: "forbidden" }, 403);
    }

    await next();
  };
}
