interface Env {
  DB: D1Database;
  DESTINATION_EMAIL: string;
  RELAY_DOMAIN: string;
}

interface AliasRecord {
  id: string;
  alias: string;
  domain_used_for: string;
  label: string | null;
  destination: string;
  enabled: number;
  created_at: string;
  last_email_at: string | null;
}

interface ForwardableEmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream;
  readonly rawSize: number;
  setReject(reason: string): void;
  forward(rcptTo: string, headers?: Headers | { headers?: Headers }): Promise<void>;
}

async function logEmail(
  db: D1Database,
  aliasId: string,
  message: ForwardableEmailMessage,
  forwarded: boolean,
  blockedReason: string | null
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO email_logs (alias_id, from_address, to_address, subject, size_bytes, forwarded, blocked_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      aliasId,
      message.from,
      message.to,
      message.headers.get("subject") || "(no subject)",
      message.rawSize,
      forwarded ? 1 : 0,
      blockedReason
    )
    .run();
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const toAddress = message.to;
    const alias = toAddress.split("@")[0].toLowerCase();

    // 1. Look up alias in database
    const aliasRecord = await env.DB.prepare(
      "SELECT * FROM aliases WHERE alias = ?"
    )
      .bind(alias)
      .first<AliasRecord>();

    // 2. Reject unknown aliases
    if (!aliasRecord) {
      message.setReject("Address not found");
      return;
    }

    // 3. Check if alias is enabled
    if (!aliasRecord.enabled) {
      await logEmail(env.DB, aliasRecord.id, message, false, "Alias disabled");
      message.setReject("Address no longer active");
      return;
    }

    // 4. Log the email
    await logEmail(env.DB, aliasRecord.id, message, true, null);

    // 5. Update last_email_at
    await env.DB.prepare("UPDATE aliases SET last_email_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), aliasRecord.id)
      .run();

    // 6. Forward with tracking headers
    await message.forward(aliasRecord.destination, {
      headers: new Headers({
        "X-Original-To": toAddress,
        "X-Alias-ID": aliasRecord.id,
        "X-Alias-Domain": aliasRecord.domain_used_for,
        "X-Alias-Label": aliasRecord.label || "",
      }),
    });
  },
};
