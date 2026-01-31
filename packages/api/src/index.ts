import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { authMiddleware } from "./middleware/auth";
import aliases from "./routes/aliases";
import stats from "./routes/stats";

const app = new Hono<{ Bindings: Env }>();

// CORS for browser extension
app.use(
  "*",
  cors({
    origin: "*", // Extension will use API key auth
    allowMethods: ["GET", "POST", "PATCH", "DELETE"],
    allowHeaders: ["Content-Type", "X-API-Key"],
  })
);

// Health check (no auth)
app.get("/health", (c) => c.json({ status: "ok" }));

// All /api routes require auth
app.use("/api/*", authMiddleware);

// Mount routes
app.route("/api/aliases", aliases);
app.route("/api/stats", stats);

// 404 handler
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
