import { listAliases, getStats, createAlias, updateAlias, deleteAlias } from "../lib/api.js";

let aliases = [];
let searchTimeout = null;

// DOM elements
const errorEl = document.getElementById("error");
const aliasListEl = document.getElementById("aliasList");
const searchInput = document.getElementById("searchInput");
const createBtn = document.getElementById("createBtn");
const createModal = document.getElementById("createModal");
const domainInput = document.getElementById("domainInput");
const labelInput = document.getElementById("labelInput");
const cancelCreate = document.getElementById("cancelCreate");
const confirmCreate = document.getElementById("confirmCreate");
const settingsBtn = document.getElementById("settingsBtn");

// Stats elements
const totalAliasesEl = document.getElementById("totalAliases");
const totalEmailsEl = document.getElementById("totalEmails");
const emails7dEl = document.getElementById("emails7d");

// Initialize
async function init() {
  await Promise.all([loadStats(), loadAliases()]);
  setupListeners();
}

async function loadStats() {
  try {
    const stats = await getStats();
    totalAliasesEl.textContent = stats.total_aliases;
    totalEmailsEl.textContent = stats.total_emails_received;
    emails7dEl.textContent = stats.emails_last_7_days;
  } catch (err) {
    console.error("Failed to load stats:", err);
  }
}

async function loadAliases(search = "") {
  try {
    showError(null);
    aliasListEl.innerHTML = '<div class="loading">Loading...</div>';

    const params = search ? { search } : {};
    const result = await listAliases(params);
    aliases = result.aliases;

    renderAliases();
  } catch (err) {
    showError(err.message);
    aliasListEl.innerHTML = "";
  }
}

function renderAliases() {
  if (aliases.length === 0) {
    aliasListEl.innerHTML = `
      <div class="empty-state">
        <p>No aliases yet</p>
        <p style="font-size: 12px; margin-top: 8px;">Click "+ New" to create one</p>
      </div>
    `;
    return;
  }

  aliasListEl.innerHTML = aliases
    .map(
      (alias) => `
    <div class="alias-item ${alias.enabled ? "" : "disabled"}" data-id="${alias.id}">
      <div class="alias-header">
        <span class="alias-email" data-email="${alias.email}" title="Click to copy">${alias.email}</span>
        <button class="alias-toggle ${alias.enabled ? "enabled" : ""}" data-id="${alias.id}" data-enabled="${alias.enabled}"></button>
      </div>
      <div class="alias-meta">
        <span class="alias-domain">${alias.label || alias.domain_used_for}</span>
        <span class="alias-count">${alias.email_count || 0} emails</span>
      </div>
    </div>
  `
    )
    .join("");
}

function setupListeners() {
  // Search
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadAliases(e.target.value);
    }, 300);
  });

  // Create button
  createBtn.addEventListener("click", openCreateModal);

  // Cancel create
  cancelCreate.addEventListener("click", closeCreateModal);

  // Confirm create
  confirmCreate.addEventListener("click", handleCreate);

  // Settings
  settingsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Alias list clicks (delegation)
  aliasListEl.addEventListener("click", async (e) => {
    // Copy email
    if (e.target.classList.contains("alias-email")) {
      const email = e.target.dataset.email;
      await navigator.clipboard.writeText(email);
      showToast("Copied!");
      return;
    }

    // Toggle enabled
    if (e.target.classList.contains("alias-toggle")) {
      const id = e.target.dataset.id;
      const enabled = e.target.dataset.enabled === "true";
      try {
        await updateAlias(id, { enabled: !enabled });
        await loadAliases(searchInput.value);
      } catch (err) {
        showError(err.message);
      }
      return;
    }
  });

  // Close modal on backdrop click
  createModal.addEventListener("click", (e) => {
    if (e.target === createModal) {
      closeCreateModal();
    }
  });
}

function openCreateModal() {
  // Try to get current tab domain
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.url) {
      try {
        const url = new URL(tabs[0].url);
        domainInput.value = url.hostname.replace(/^www\./, "");
      } catch {
        domainInput.value = "";
      }
    }
  });
  labelInput.value = "";
  createModal.classList.remove("hidden");
  domainInput.focus();
}

function closeCreateModal() {
  createModal.classList.add("hidden");
}

async function handleCreate() {
  const domain = domainInput.value.trim();
  const label = labelInput.value.trim();

  if (!domain) {
    domainInput.focus();
    return;
  }

  try {
    confirmCreate.disabled = true;
    confirmCreate.textContent = "Creating...";

    const alias = await createAlias(domain, label || undefined);
    closeCreateModal();

    // Copy to clipboard
    await navigator.clipboard.writeText(alias.email);
    showToast(`Created & copied: ${alias.email}`);

    // Reload
    await Promise.all([loadStats(), loadAliases(searchInput.value)]);
  } catch (err) {
    showError(err.message);
  } finally {
    confirmCreate.disabled = false;
    confirmCreate.textContent = "Create";
  }
}

function showError(message) {
  if (message) {
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  } else {
    errorEl.classList.add("hidden");
  }
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// Start
init();
