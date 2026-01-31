// API client for Email Relay

const DEFAULT_API_URL = "https://email-relay-api.mcpick.workers.dev";

async function getConfig() {
  const result = await chrome.storage.sync.get(["apiUrl", "apiKey"]);
  return {
    apiUrl: result.apiUrl || DEFAULT_API_URL,
    apiKey: result.apiKey || "",
  };
}

async function apiRequest(endpoint, options = {}) {
  const config = await getConfig();

  if (!config.apiKey) {
    throw new Error("API key not configured. Please set it in extension options.");
  }

  const url = `${config.apiUrl}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.apiKey,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// Alias operations
export async function createAlias(domain, label) {
  return apiRequest("/api/aliases", {
    method: "POST",
    body: JSON.stringify({ domain, label }),
  });
}

export async function listAliases(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.enabled !== undefined) searchParams.set("enabled", params.enabled);
  if (params.domain) searchParams.set("domain", params.domain);
  if (params.search) searchParams.set("search", params.search);

  const query = searchParams.toString();
  return apiRequest(`/api/aliases${query ? `?${query}` : ""}`);
}

export async function getAlias(id) {
  return apiRequest(`/api/aliases/${id}`);
}

export async function updateAlias(id, updates) {
  return apiRequest(`/api/aliases/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteAlias(id) {
  return apiRequest(`/api/aliases/${id}`, {
    method: "DELETE",
  });
}

export async function getAliasLogs(id, limit = 50, offset = 0) {
  return apiRequest(`/api/aliases/${id}/logs?limit=${limit}&offset=${offset}`);
}

export async function getStats() {
  return apiRequest("/api/stats");
}

export async function testConnection() {
  const config = await getConfig();
  const response = await fetch(`${config.apiUrl}/health`);
  return response.ok;
}
