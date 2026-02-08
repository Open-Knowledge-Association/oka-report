import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { prisma } from "@repo/db";
import { authMiddleware } from "../middleware/auth";

export const authRoutes = new Hono();

authRoutes.get("/session", async (c) => {
  const sessionToken = getCookie(c, "session");

  if (!sessionToken) {
    return c.json({ user: null }, 200);
  }

  const session = await prisma.session.findUnique({
    where: { token: sessionToken },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    deleteCookie(c, "session");
    return c.json({ user: null }, 200);
  }

  return c.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    },
  });
});

authRoutes.post("/logout", authMiddleware, async (c) => {
  const session = c.get("session");

  if (session) {
    await prisma.session.delete({ where: { id: session.id } });
  }

  deleteCookie(c, "session");

  return c.json({ success: true });
});

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback";

authRoutes.get("/google", async (c) => {
  if (!GOOGLE_CLIENT_ID) {
    return c.json({ error: "Google OAuth not configured" }, 500);
  }

  const state = crypto.randomUUID();

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  googleAuthUrl.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("state", state);
  googleAuthUrl.searchParams.set("access_type", "offline");
  googleAuthUrl.searchParams.set("prompt", "consent");

  setCookie(c, "oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 600,
    path: "/",
  });

  return c.redirect(googleAuthUrl.toString());
});

authRoutes.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const storedState = getCookie(c, "oauth_state");

  if (!code || !state) {
    return c.json({ error: "Missing code or state parameter" }, 400);
  }

  if (state !== storedState) {
    return c.json({ error: "Invalid state parameter" }, 400);
  }

  deleteCookie(c, "oauth_state");

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return c.json({ error: "Google OAuth not configured" }, 500);
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      return c.json({ error: "Failed to exchange code for tokens" }, 400);
    }

    const tokens = await tokenResponse.json();

    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      return c.json({ error: "Failed to fetch user info" }, 400);
    }

    const googleUser = await userInfoResponse.json();

    let user = await prisma.user.findUnique({
      where: { googleId: googleUser.id },
    });

    if (!user) {
      user = await prisma.user.findUnique({
        where: { email: googleUser.email },
      });

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: googleUser.id },
        });
      } else {
        user = await prisma.user.create({
          data: {
            email: googleUser.email,
            name: googleUser.name || googleUser.email.split("@")[0],
            googleId: googleUser.id,
            role: "viewer",
          },
        });
      }
    }

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    setCookie(c, "session", session.token, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return c.redirect("/");
  } catch (error) {
    console.error("Google OAuth error:", error);
    return c.json({ error: "Authentication failed" }, 500);
  }
});
