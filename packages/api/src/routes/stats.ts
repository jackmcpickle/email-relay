import { Hono } from "hono";
import type { Env } from "../types";

const stats = new Hono<{ Bindings: Env }>();

// GET /api/stats - Dashboard statistics
stats.get("/", async (c) => {
  // Total aliases
  const totalResult = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM aliases"
  ).first<{ count: number }>();

  // Active aliases
  const activeResult = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM aliases WHERE enabled = 1"
  ).first<{ count: number }>();

  // Disabled aliases
  const disabledResult = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM aliases WHERE enabled = 0"
  ).first<{ count: number }>();

  // Total emails received
  const totalEmailsResult = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM email_logs"
  ).first<{ count: number }>();

  // Emails last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const emails7dResult = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM email_logs WHERE received_at >= ?"
  )
    .bind(sevenDaysAgo.toISOString())
    .first<{ count: number }>();

  // Top domains by email count
  const topDomainsResult = await c.env.DB.prepare(`
    SELECT a.domain_used_for as domain, COUNT(l.id) as count
    FROM aliases a
    LEFT JOIN email_logs l ON a.id = l.alias_id
    GROUP BY a.domain_used_for
    ORDER BY count DESC
    LIMIT 10
  `).all<{ domain: string; count: number }>();

  return c.json({
    total_aliases: totalResult?.count || 0,
    active_aliases: activeResult?.count || 0,
    disabled_aliases: disabledResult?.count || 0,
    total_emails_received: totalEmailsResult?.count || 0,
    emails_last_7_days: emails7dResult?.count || 0,
    top_domains: topDomainsResult.results,
  });
});

export default stats;
