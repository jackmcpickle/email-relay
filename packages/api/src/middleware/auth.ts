import { Context, Next } from "hono";
import type { Env } from "../types";

export async function authMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
) {
  const apiKey = c.req.header("X-API-Key");

  if (!apiKey || apiKey !== c.env.API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
}
