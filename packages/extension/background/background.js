// Background service worker - handles API communication

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
    throw new Error("API key not configured");
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

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "createAlias") {
    handleCreateAlias(message.domain)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true; // Keep channel open for async response
  }
});

async function handleCreateAlias(domain) {
  const result = await apiRequest("/api/aliases", {
    method: "POST",
    body: JSON.stringify({ domain }),
  });
  return result;
}

// Update badge with alias count
async function updateBadge() {
  try {
    const config = await getConfig();
    if (!config.apiKey) {
      chrome.action.setBadgeText({ text: "" });
      return;
    }

    const stats = await apiRequest("/api/stats");
    const count = stats.total_aliases;
    chrome.action.setBadgeText({ text: count > 99 ? "99+" : String(count) });
    chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
  } catch {
    chrome.action.setBadgeText({ text: "" });
  }
}

// Update badge on startup and periodically
chrome.runtime.onStartup.addListener(updateBadge);
chrome.runtime.onInstalled.addListener(updateBadge);

// Update badge every 5 minutes
setInterval(updateBadge, 5 * 60 * 1000);
