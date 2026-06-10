import { createSwitcherTabs, selectAdjacentTabId } from "./tab-cycle.js";

const COMMANDS = {
  "cycle-next-tab": "next",
  "cycle-previous-tab": "previous"
};

const sessions = new Map();
const previews = new Map();
const CAPTURE_COOLDOWN_MS = 30_000;

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

chrome.tabs.onRemoved.addListener((tabId) => {
  previews.delete(tabId);

  for (const [windowId, session] of sessions) {
    if (session.hostTabId === tabId || session.selectedTabId === tabId) {
      sessions.delete(windowId);
    }
  }
});

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  setTimeout(() => captureTabPreview(tabId, windowId), 500);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active && tab.windowId != null) {
    setTimeout(() => captureTabPreview(tabId, tab.windowId), 500);
  }
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
  const selectedTabId = selectAdjacentTabId(
    tabs,
    session?.selectedTabId ?? activeTab.id,
    direction
  );

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
