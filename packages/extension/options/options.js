const DEFAULT_API_URL = "https://email-relay-api.mcpick.workers.dev";

const apiUrlInput = document.getElementById("apiUrl");
const apiKeyInput = document.getElementById("apiKey");
const testBtn = document.getElementById("testBtn");
const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");

// Load saved settings
async function loadSettings() {
  const result = await chrome.storage.sync.get(["apiUrl", "apiKey"]);
  apiUrlInput.value = result.apiUrl || "";
  apiKeyInput.value = result.apiKey || "";
}

// Save settings
async function saveSettings() {
  const apiUrl = apiUrlInput.value.trim() || DEFAULT_API_URL;
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showStatus("API key is required", "error");
    return;
  }

  await chrome.storage.sync.set({ apiUrl, apiKey });
  showStatus("Settings saved!", "success");
}

// Test connection
async function testConnection() {
  const apiUrl = apiUrlInput.value.trim() || DEFAULT_API_URL;
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showStatus("Please enter an API key first", "error");
    return;
  }

  testBtn.disabled = true;
  testBtn.textContent = "Testing...";

  try {
    // First test health endpoint
    const healthResponse = await fetch(`${apiUrl}/health`);
    if (!healthResponse.ok) {
      throw new Error("API server not reachable");
    }

    // Then test authenticated endpoint
    const statsResponse = await fetch(`${apiUrl}/api/stats`, {
      headers: {
        "X-API-Key": apiKey,
      },
    });

    if (statsResponse.status === 401) {
      throw new Error("Invalid API key");
    }

    if (!statsResponse.ok) {
      throw new Error("API request failed");
    }

    const stats = await statsResponse.json();
    showStatus(`Connected! ${stats.total_aliases} aliases found.`, "success");
  } catch (err) {
    showStatus(err.message, "error");
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = "Test Connection";
  }
}

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.classList.remove("hidden");

  if (type === "success") {
    setTimeout(() => {
      statusEl.classList.add("hidden");
    }, 3000);
  }
}

// Event listeners
testBtn.addEventListener("click", testConnection);
saveBtn.addEventListener("click", saveSettings);

// Load on start
loadSettings();
