import { Hono } from "hono";
import { nanoid } from "nanoid";
import type {
  Env,
  AliasRecord,
  AliasResponse,
  CreateAliasBody,
  UpdateAliasBody,
} from "../types";

const aliases = new Hono<{ Bindings: Env }>();

function toAliasResponse(
  record: AliasRecord,
  relayDomain: string,
  emailCount?: number
): AliasResponse {
  return {
    id: record.id,
    alias: record.alias,
    email: `${record.alias}@${relayDomain}`,
    domain_used_for: record.domain_used_for,
    label: record.label,
    enabled: record.enabled === 1,
    created_at: record.created_at,
    last_email_at: record.last_email_at,
    ...(emailCount !== undefined && { email_count: emailCount }),
  };
}

// POST /api/aliases - Create new alias
aliases.post("/", async (c) => {
  const body = await c.req.json<CreateAliasBody>();

  if (!body.domain) {
    return c.json({ error: "domain is required" }, 400);
  }

  const id = crypto.randomUUID();
  const alias = nanoid(8).toLowerCase();
  const destination = "jack@mcpickle.com.au"; // hardcoded for single-user

  await c.env.DB.prepare(
    `INSERT INTO aliases (id, alias, domain_used_for, label, destination)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, alias, body.domain, body.label || null, destination)
    .run();

  const record = await c.env.DB.prepare("SELECT * FROM aliases WHERE id = ?")
    .bind(id)
    .first<AliasRecord>();

  return c.json(toAliasResponse(record!, c.env.RELAY_DOMAIN), 201);
});

// GET /api/aliases - List all aliases
aliases.get("/", async (c) => {
  const enabled = c.req.query("enabled");
  const domain = c.req.query("domain");
  const search = c.req.query("search");

  let query = "SELECT * FROM aliases WHERE 1=1";
  const params: (string | number)[] = [];

  if (enabled !== undefined) {
    query += " AND enabled = ?";
    params.push(enabled === "true" ? 1 : 0);
  }

  if (domain) {
    query += " AND domain_used_for = ?";
    params.push(domain);
  }

  if (search) {
    query += " AND (domain_used_for LIKE ? OR label LIKE ? OR alias LIKE ?)";
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  query += " ORDER BY created_at DESC";

  const stmt = c.env.DB.prepare(query);
  const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all<AliasRecord>();

  const aliasesWithCounts = await Promise.all(
    result.results.map(async (record) => {
      const countResult = await c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM email_logs WHERE alias_id = ?"
      )
        .bind(record.id)
        .first<{ count: number }>();
      return toAliasResponse(record, c.env.RELAY_DOMAIN, countResult?.count || 0);
    })
  );

  return c.json({
    aliases: aliasesWithCounts,
    total: result.results.length,
  });
});

// GET /api/aliases/:id - Get alias details
aliases.get("/:id", async (c) => {
  const id = c.req.param("id");

  const record = await c.env.DB.prepare("SELECT * FROM aliases WHERE id = ?")
    .bind(id)
    .first<AliasRecord>();

  if (!record) {
    return c.json({ error: "Alias not found" }, 404);
  }

  const countResult = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM email_logs WHERE alias_id = ?"
  )
    .bind(id)
    .first<{ count: number }>();

  return c.json(toAliasResponse(record, c.env.RELAY_DOMAIN, countResult?.count || 0));
});

// PATCH /api/aliases/:id - Update alias
aliases.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<UpdateAliasBody>();

  const existing = await c.env.DB.prepare("SELECT * FROM aliases WHERE id = ?")
    .bind(id)
    .first<AliasRecord>();

  if (!existing) {
    return c.json({ error: "Alias not found" }, 404);
  }

  const updates: string[] = [];
  const params: (string | number)[] = [];

  if (body.enabled !== undefined) {
    updates.push("enabled = ?");
    params.push(body.enabled ? 1 : 0);
  }

  if (body.label !== undefined) {
    updates.push("label = ?");
    params.push(body.label);
  }

  if (updates.length === 0) {
    return c.json({ error: "No valid fields to update" }, 400);
  }

  params.push(id);

  await c.env.DB.prepare(`UPDATE aliases SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...params)
    .run();

  const updated = await c.env.DB.prepare("SELECT * FROM aliases WHERE id = ?")
    .bind(id)
    .first<AliasRecord>();

  return c.json(toAliasResponse(updated!, c.env.RELAY_DOMAIN));
});

// DELETE /api/aliases/:id - Delete alias
aliases.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare("SELECT * FROM aliases WHERE id = ?")
    .bind(id)
    .first<AliasRecord>();

  if (!existing) {
    return c.json({ error: "Alias not found" }, 404);
  }

  await c.env.DB.prepare("DELETE FROM aliases WHERE id = ?").bind(id).run();

  return c.body(null, 204);
});

// GET /api/aliases/:id/logs - Get email logs for alias
aliases.get("/:id/logs", async (c) => {
  const id = c.req.param("id");
  const limit = parseInt(c.req.query("limit") || "50", 10);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const existing = await c.env.DB.prepare("SELECT * FROM aliases WHERE id = ?")
    .bind(id)
    .first<AliasRecord>();

  if (!existing) {
    return c.json({ error: "Alias not found" }, 404);
  }

  const logs = await c.env.DB.prepare(
    `SELECT id, from_address, subject, received_at, size_bytes, forwarded
     FROM email_logs
     WHERE alias_id = ?
     ORDER BY received_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(id, limit, offset)
    .all();

  const countResult = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM email_logs WHERE alias_id = ?"
  )
    .bind(id)
    .first<{ count: number }>();

  return c.json({
    logs: logs.results.map((log: Record<string, unknown>) => ({
      id: log.id,
      from_address: log.from_address,
      subject: log.subject,
      received_at: log.received_at,
      size_bytes: log.size_bytes,
      forwarded: log.forwarded === 1,
    })),
    total: countResult?.count || 0,
  });
});

export default aliases;
