// Content script - detects email fields and injects generate button

const BUTTON_OFFSET = 4;
const processedFields = new WeakSet();

// SVG icons
const ENVELOPE_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`;
const SPINNER_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>`;

function isEmailField(input) {
  if (input.type === "email") return true;

  const name = (input.name || "").toLowerCase();
  const id = (input.id || "").toLowerCase();
  const placeholder = (input.placeholder || "").toLowerCase();
  const autocomplete = (input.autocomplete || "").toLowerCase();

  const emailPatterns = ["email", "e-mail", "mail"];
  return emailPatterns.some(
    (p) =>
      name.includes(p) ||
      id.includes(p) ||
      placeholder.includes(p) ||
      autocomplete.includes(p)
  );
}

function createButton(input) {
  const btn = document.createElement("button");
  btn.className = "email-relay-btn";
  btn.type = "button";
  btn.title = "Generate email alias";
  btn.innerHTML = ENVELOPE_ICON;

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await generateAlias(input, btn);
  });

  return btn;
}

function positionButton(input, btn) {
  const rect = input.getBoundingClientRect();
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  btn.style.position = "absolute";
  btn.style.top = `${rect.top + scrollY + (rect.height - 24) / 2}px`;
  btn.style.left = `${rect.right + scrollX - 28 - BUTTON_OFFSET}px`;
}

async function generateAlias(input, btn) {
  const domain = window.location.hostname.replace(/^www\./, "");

  btn.classList.add("loading");
  btn.innerHTML = SPINNER_ICON;

  try {
    // Send message to background script
    const response = await chrome.runtime.sendMessage({
      action: "createAlias",
      domain,
    });

    if (response.error) {
      throw new Error(response.error);
    }

    // Fill the input
    input.value = response.email;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    showToast(`Generated: ${response.email}`, "success");

    // Copy to clipboard
    await navigator.clipboard.writeText(response.email);
  } catch (err) {
    console.error("Email Relay error:", err);
    showToast(err.message || "Failed to generate alias", "error");
  } finally {
    btn.classList.remove("loading");
    btn.innerHTML = ENVELOPE_ICON;
  }
}

function showToast(message, type = "success") {
  // Remove existing toasts
  document.querySelectorAll(".email-relay-toast").forEach((t) => t.remove());

  const toast = document.createElement("div");
  toast.className = `email-relay-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

function processField(input) {
  if (processedFields.has(input)) return;
  if (!isEmailField(input)) return;
  if (input.offsetParent === null) return; // Hidden

  processedFields.add(input);

  const btn = createButton(input);
  document.body.appendChild(btn);
  positionButton(input, btn);

  // Reposition on scroll/resize
  const reposition = () => positionButton(input, btn);
  window.addEventListener("scroll", reposition, { passive: true });
  window.addEventListener("resize", reposition, { passive: true });

  // Remove button if input is removed
  const observer = new MutationObserver(() => {
    if (!document.contains(input)) {
      btn.remove();
      observer.disconnect();
      window.removeEventListener("scroll", reposition);
      window.removeEventListener("resize", reposition);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function scanForEmailFields() {
  const inputs = document.querySelectorAll('input[type="email"], input[type="text"]');
  inputs.forEach(processField);
}

// Initial scan
scanForEmailFields();

// Watch for dynamically added fields
const domObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      if (node.matches?.('input[type="email"], input[type="text"]')) {
        processField(node);
      }

      // Check children
      const inputs = node.querySelectorAll?.('input[type="email"], input[type="text"]');
      inputs?.forEach(processField);
    }
  }
});

domObserver.observe(document.body, { childList: true, subtree: true });
