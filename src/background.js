import { createSwitcherTabs, selectAdjacentTabId, selectInitialTabId } from "./tab-cycle.js";

const COMMANDS = {
  "cycle-next-tab": "next",
  "cycle-previous-tab": "previous"
};

const sessions = new Map();
const CAPTURE_COOLDOWN_MS = 30_000;
const PREVIEW_KEY_PREFIX = "preview:";

updateTabCountBadge();

chrome.runtime.onInstalled.addListener(() => {
  updateTabCountBadge();
  installSwitcherInOpenTabs();
});

chrome.runtime.onStartup.addListener(() => {
  updateTabCountBadge();
  installSwitcherInOpenTabs();
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
  updateTabCountBadge();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(previewKey(tabId));

  for (const [windowId, session] of sessions) {
    if (session.hostTabId === tabId || session.selectedTabId === tabId) {
      clearSession(windowId);
    }
  }

  updateTabCountBadge();
});

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  updateTabCountBadge();
  setTimeout(() => captureTabPreview(tabId, windowId), 500);
});

chrome.tabs.onAttached.addListener(() => {
  updateTabCountBadge();
});

chrome.tabs.onDetached.addListener(() => {
  updateTabCountBadge();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active && tab.windowId != null) {
    setTimeout(() => captureTabPreview(tabId, tab.windowId), 500);
  }
});

chrome.windows.onFocusChanged.addListener(() => {
  updateTabCountBadge();
});

async function advanceSwitcher(direction) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const activeTab = tabs.find((tab) => tab.active);
  const windowId = activeTab?.windowId;

  if (windowId == null || activeTab?.id == null) {
    return;
  }

  captureTabPreview(activeTab.id, windowId);

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

  setSession(windowId, nextSession);
  await renderSwitcher(windowId, nextSession, tabs);
}

async function renderSwitcher(windowId, session, tabs) {
  try {
    const pageScale = await chrome.tabs.getZoom(session.hostTabId).catch(() => 1);
    const previews = await loadTabPreviews(tabs);

    const payload = {
      windowId,
      selectedTabId: session.selectedTabId,
      pageScale: pageScale || 1,
      tabs: createSwitcherTabs(tabs, previews)
    };

    await chrome.tabs.sendMessage(session.hostTabId, {
      type: "tabCycler:render",
      payload
    });
  } catch (error) {
    console.warn("Could not render tab switcher; switching tabs directly.", {
      hostTabId: session.hostTabId,
      error: error instanceof Error ? error.message : String(error)
    });
    await chrome.tabs.update(session.selectedTabId, { active: true });
    clearSession(windowId);
  }
}

async function installSwitcherInOpenTabs() {
  const tabs = await chrome.tabs.query({});

  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id == null) {
        return;
      }

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["src/switcher.js"]
        });
      } catch {
        // Chrome internal pages do not allow content scripts.
      }
    })
  );
}

async function commitSwitcher(windowId) {
  const session = sessions.get(windowId);

  if (session) {
    clearSession(windowId);
    await chrome.tabs.update(session.selectedTabId, { active: true });
  }

  return { ok: true };
}

async function cancelSwitcher(windowId) {
  const session = sessions.get(windowId);

  if (session) {
    await hideSwitcher(session.hostTabId);
    clearSession(windowId);
  }

  return { ok: true };
}

async function selectTab(windowId, tabId) {
  const session = sessions.get(windowId);

  if (session && Number.isInteger(tabId)) {
    setSession(windowId, { ...session, selectedTabId: tabId });
  }

  return { ok: true };
}

function setSession(windowId, session) {
  sessions.set(windowId, session);
}

function clearSession(windowId) {
  sessions.delete(windowId);
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
  const key = previewKey(tabId);
  const cachedPreview = (await chrome.storage.session.get(key))[key];

  if (Date.now() - (cachedPreview?.capturedAt ?? 0) < CAPTURE_COOLDOWN_MS) {
    return;
  }

  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
      format: "jpeg",
      quality: 45
    });

    await chrome.storage.session.set({
      [key]: {
        dataUrl,
        capturedAt: Date.now()
      }
    });
  } catch {
    // Keep the last usable preview when Brave blocks a fresh capture.
  }
}

async function loadTabPreviews(tabs) {
  const entries = await chrome.storage.session.get(
    tabs.flatMap((tab) => tab.id == null ? [] : previewKey(tab.id))
  );

  return new Map(
    tabs.flatMap((tab) => {
      const preview = entries[previewKey(tab.id)];
      return tab.id == null || !preview ? [] : [[tab.id, preview]];
    })
  );
}

function previewKey(tabId) {
  return `${PREVIEW_KEY_PREFIX}${tabId}`;
}

async function updateTabCountBadge() {
  let tabCount;

  try {
    const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
    tabCount = tabs.length;
  } catch {
    await chrome.action.setBadgeText({ text: "" });
    await chrome.action.setTitle({ title: "samsara" });
    return;
  }

  await chrome.action.setBadgeBackgroundColor({ color: "#c3432c" });
  await chrome.action.setBadgeTextColor({ color: "#ffffff" });
  await chrome.action.setBadgeText({ text: formatIconCount(tabCount) });
  await chrome.action.setTitle({ title: `samsara (${tabCount} open tabs)` });
}

function formatIconCount(tabCount) {
  if (tabCount > 99) {
    return "99+";
  }

  return String(tabCount);
}
