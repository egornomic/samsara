import { createSwitcherTabs, selectAdjacentTabId, selectInitialTabId } from "./tab-cycle.js";

const COMMANDS = {
  "cycle-next-tab": "next",
  "cycle-previous-tab": "previous"
};

const sessions = new Map();
const previews = new Map();
const CAPTURE_COOLDOWN_MS = 30_000;

updateTabCountIcon();

chrome.runtime.onInstalled.addListener(() => {
  updateTabCountIcon();
});

chrome.runtime.onStartup.addListener(() => {
  updateTabCountIcon();
});

chrome.commands.onCommand.addListener(async (command) => {
  const direction = COMMANDS[command];

  if (!direction) {
    return;
  }

  await advanceSwitcher(direction);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "tabCycler:commit") {
    commitSwitcher(message.windowId).then(sendResponse);
    return true;
  }

  if (message?.type === "tabCycler:cancel") {
    cancelSwitcher(message.windowId).then(sendResponse);
    return true;
  }

  if (message?.type === "tabCycler:select") {
    selectTab(message.windowId, message.tabId).then(sendResponse);
    return true;
  }

  if (message?.type === "tabCycler:preview") {
    previewTab(message.windowId, message.tabId).then(sendResponse);
    return true;
  }

  return false;
});

chrome.tabs.onCreated.addListener(() => {
  updateTabCountIcon();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  previews.delete(tabId);

  for (const [windowId, session] of sessions) {
    if (session.hostTabId === tabId || session.selectedTabId === tabId) {
      sessions.delete(windowId);
    }
  }

  updateTabCountIcon();
});

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  updateTabCountIcon();
  setTimeout(() => captureTabPreview(tabId, windowId), 500);
});

chrome.tabs.onAttached.addListener(() => {
  updateTabCountIcon();
});

chrome.tabs.onDetached.addListener(() => {
  updateTabCountIcon();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active && tab.windowId != null) {
    setTimeout(() => captureTabPreview(tabId, tab.windowId), 500);
  }
});

chrome.windows.onFocusChanged.addListener(() => {
  updateTabCountIcon();
});

async function advanceSwitcher(direction) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const activeTab = tabs.find((tab) => tab.active);
  const windowId = activeTab?.windowId;

  if (windowId == null || activeTab?.id == null) {
    return;
  }

  await captureTabPreview(activeTab.id, windowId);

  const session = sessions.get(windowId);
  const selectedTabId = session
    ? selectAdjacentTabId(tabs, session.selectedTabId, direction)
    : selectInitialTabId(tabs, activeTab.id, direction);

  if (selectedTabId == null) {
    return;
  }

  const nextSession = {
    hostTabId: session?.hostTabId ?? activeTab.id,
    selectedTabId
  };

  sessions.set(windowId, nextSession);
  await renderSwitcher(windowId, nextSession, tabs);
}

async function renderSwitcher(windowId, session, tabs) {
  const payload = {
    windowId,
    selectedTabId: session.selectedTabId,
    pageScale: await chrome.tabs.getZoom(session.hostTabId),
    tabs: createSwitcherTabs(tabs, previews)
  };

  try {
    await chrome.scripting.executeScript({
      target: { tabId: session.hostTabId },
      files: ["src/switcher.js"]
    });

    await chrome.tabs.sendMessage(session.hostTabId, {
      type: "tabCycler:render",
      payload
    });
  } catch {
    await chrome.tabs.update(session.selectedTabId, { active: true });
    sessions.delete(windowId);
  }
}

async function commitSwitcher(windowId) {
  const session = sessions.get(windowId);

  if (session) {
    await chrome.tabs.update(session.selectedTabId, { active: true });
    sessions.delete(windowId);
  }

  return { ok: true };
}

async function cancelSwitcher(windowId) {
  const session = sessions.get(windowId);

  if (session) {
    await hideSwitcher(session.hostTabId);
    sessions.delete(windowId);
  }

  return { ok: true };
}

async function selectTab(windowId, tabId) {
  const session = sessions.get(windowId);

  if (session && Number.isInteger(tabId)) {
    sessions.set(windowId, { ...session, selectedTabId: tabId });
  }

  return { ok: true };
}

async function previewTab(windowId, tabId) {
  await selectTab(windowId, tabId);
  return commitSwitcher(windowId);
}

async function hideSwitcher(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "tabCycler:hide" });
  } catch {
    // The overlay is already gone when the page navigated or became unavailable.
  }
}

async function captureTabPreview(tabId, windowId) {
  const cachedPreview = previews.get(tabId);

  if (Date.now() - (cachedPreview?.capturedAt ?? 0) < CAPTURE_COOLDOWN_MS) {
    return;
  }

  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
      format: "jpeg",
      quality: 45
    });

    previews.set(tabId, {
      dataUrl,
      capturedAt: Date.now()
    });
  } catch {
    // Keep the last usable preview when Brave blocks a fresh capture.
  }
}

async function updateTabCountIcon() {
  let tabCount;

  try {
    const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
    tabCount = tabs.length;
  } catch {
    await chrome.action.setBadgeText({ text: "" });
    await chrome.action.setTitle({ title: "samsara" });
    return;
  }

  try {
    await chrome.action.setIcon({ imageData: createTabCountIcons(tabCount) });
    await chrome.action.setBadgeText({ text: "" });
  } catch {
    await chrome.action.setBadgeBackgroundColor({ color: "#2d722f" });
    await chrome.action.setBadgeText({ text: formatIconCount(tabCount) });
  }

  await chrome.action.setTitle({ title: `samsara (${tabCount} open tabs)` });
}

function createTabCountIcons(tabCount) {
  return Object.fromEntries(
    [16, 32, 48, 128].map((size) => [size, createTabCountIcon(size, tabCount)])
  );
}

function createTabCountIcon(size, tabCount) {
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d");
  const scale = size / 128;
  const label = formatIconCount(tabCount);

  context.clearRect(0, 0, size, size);
  drawRoundedRect(context, 0, 0, size, size, 28 * scale);
  context.fillStyle = "#f7fff2";
  context.fill();

  drawRoundedRect(context, 4 * scale, 4 * scale, 120 * scale, 120 * scale, 24 * scale);
  context.fillStyle = "#2d722f";
  context.fill();

  context.fillStyle = "#ffffff";
  context.font = `800 ${selectIconFontSize(label, scale)}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, size / 2, size / 2 + 1 * scale);

  return context.getImageData(0, 0, size, size);
}

function drawRoundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function selectIconFontSize(label, scale) {
  if (label.length >= 3) {
    return 50 * scale;
  }

  if (label.length === 2) {
    return 72 * scale;
  }

  return 92 * scale;
}

function formatIconCount(tabCount) {
  if (tabCount > 99) {
    return "99+";
  }

  return String(tabCount);
}
