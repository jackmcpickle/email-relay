export interface Env {
  DB: D1Database;
  API_KEY: string;
  RELAY_DOMAIN: string;
}

export interface AliasRecord {
  id: string;
  alias: string;
  domain_used_for: string;
  label: string | null;
  destination: string;
  enabled: number;
  created_at: string;
  last_email_at: string | null;
}

export interface EmailLogRecord {
  id: number;
  alias_id: string;
  from_address: string;
  to_address: string;
  subject: string | null;
  received_at: string;
  size_bytes: number | null;
  forwarded: number;
  blocked_reason: string | null;
}

export interface AliasResponse {
  id: string;
  alias: string;
  email: string;
  domain_used_for: string;
  label: string | null;
  enabled: boolean;
  created_at: string;
  last_email_at: string | null;
  email_count?: number;
}

export interface CreateAliasBody {
  domain: string;
  label?: string;
}

export interface UpdateAliasBody {
  enabled?: boolean;
  label?: string;
}
