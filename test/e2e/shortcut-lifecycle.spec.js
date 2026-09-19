import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { chromium } from "@playwright/test";
import { createSwitcherTabs, selectInitialTabId } from "../../src/tab-cycle.js";

const extensionPath = path.resolve(import.meta.dirname, "../../dist/chrome");

let server;
let baseUrl;
let newTabNavigation = Promise.resolve();

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    if (request.url === "/new-tab") {
      await newTabNavigation;
    }

    response.writeHead(200, { "content-type": "text/html" });

    if (request.url === "/focus-frame") {
      response.end("<!doctype html><title>Focus frame</title><input>");
      return;
    }

    const focusFrame = request.url === "/focus-transfer"
      ? "<iframe src='/focus-frame'></iframe>"
      : "";
    response.end(`<!doctype html><title>Shortcut test</title><main tabindex="0">Shortcut test</main><a href="/new-tab">Open tab</a>${focusFrame}`);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

async function launchExtension() {
  const userDataDir = await mkdtemp(path.join(tmpdir(), "samsara-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto(baseUrl);
  const tab = await worker.evaluate(async () => {
    globalThis.__shortcutMessages = [];
    chrome.runtime.onMessage.addListener((message) => {
      globalThis.__shortcutMessages.push(message);
    });
    return (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  });

  return {
    context,
    page,
    tab,
    worker,
    close: async () => {
      await context.close();
      await rm(userDataDir, { force: true, recursive: true });
    }
  };
}

async function renderSwitcher(worker, tab) {
  await worker.evaluate(async ({ tabId, windowId }) => {
    await chrome.tabs.sendMessage(tabId, {
      type: "tabCycler:render",
      payload: {
        windowId,
        selectedTabId: tabId,
        pageScale: 1,
        tabs: [{ id: tabId, title: "Shortcut test", url: "http://example.test" }]
      }
    });
  }, { tabId: tab.id, windowId: tab.windowId });
}

async function renderLiveTabGrid(worker) {
  const tabs = await worker.evaluate(() => chrome.tabs.query({ currentWindow: true }));
  const activeTab = tabs.find((tab) => tab.active);

  await worker.evaluate(async ({ activeTab, switcherTabs }) => {
    await chrome.tabs.sendMessage(activeTab.id, {
      type: "tabCycler:render",
      payload: {
        windowId: activeTab.windowId,
        selectedTabId: activeTab.id,
        pageScale: 1,
        tabs: switcherTabs
      }
    });
  }, { activeTab, switcherTabs: createSwitcherTabs(tabs) });

  return {
    browserOrder: [...tabs]
      .sort((left, right) => left.index - right.index)
      .map((tab) => tab.id),
    recentOrder: [...tabs]
      .sort((left, right) => right.lastAccessed - left.lastAccessed)
      .map((tab) => tab.id),
    tabs: tabs.map(({ id, lastAccessed }) => ({ id, lastAccessed }))
  };
}

test("commits when the modifier was released before rendering finishes", async () => {
  const extension = await launchExtension();

  try {
    await extension.page.keyboard.down("Meta");
    await extension.page.keyboard.up("Meta");
    await renderSwitcher(extension.worker, extension.tab);

    await expect.poll(() => extension.worker.evaluate(() =>
      globalThis.__shortcutMessages.some((message) => message.type === "tabCycler:commit")
    )).toBe(true);
    await expect(extension.page.locator("#tab-cycler-switcher-root")).toHaveCount(0);
  } finally {
    await extension.close();
  }
});

test("commits when the modifier is released after rendering", async () => {
  const extension = await launchExtension();

  try {
    await extension.page.keyboard.down("Meta");
    await renderSwitcher(extension.worker, extension.tab);
    await expect(extension.page.locator("#tab-cycler-switcher-root")).toHaveCount(1);

    await extension.page.keyboard.up("Meta");

    await expect.poll(() => extension.worker.evaluate(() =>
      globalThis.__shortcutMessages.some((message) => message.type === "tabCycler:commit")
    )).toBe(true);
    await expect(extension.page.locator("#tab-cycler-switcher-root")).toHaveCount(0);
  } finally {
    await extension.close();
  }
});

test("commits when focus leaves the page before rendering finishes", async () => {
  const extension = await launchExtension();

  try {
    await extension.page.goto(`${baseUrl}/focus-transfer`);
    await extension.page.locator("main").focus();
    await extension.page.keyboard.down("Meta");
    await extension.page.frameLocator("iframe").locator("input").focus();

    await renderSwitcher(extension.worker, extension.tab);
    await extension.page.keyboard.up("Meta");

    await expect.poll(() => extension.worker.evaluate(() =>
      globalThis.__shortcutMessages.some((message) => message.type === "tabCycler:commit")
    )).toBe(true);
    await expect(extension.page.locator("#tab-cycler-switcher-root")).toHaveCount(0);
  } finally {
    await extension.close();
  }
});

test("orders the selection grid by most recent activation", async () => {
  const extension = await launchExtension();

  try {
    const oldestPage = await extension.context.newPage();
    await oldestPage.goto(`${baseUrl}/oldest`);
    const recentPage = await extension.context.newPage();
    await recentPage.goto(`${baseUrl}/recent`);

    await oldestPage.bringToFront();
    await recentPage.bringToFront();
    await extension.page.bringToFront();
    await extension.page.keyboard.down("Meta");

    const liveTabs = await renderLiveTabGrid(extension.worker);
    const renderedTabIds = await extension.page
      .locator("#tab-cycler-switcher-root .tab")
      .evaluateAll((tabs) => tabs.map((tab) => Number(tab.dataset.tabId)));

    expect(liveTabs.tabs.every((tab) => Number.isFinite(tab.lastAccessed))).toBe(true);
    expect(liveTabs.recentOrder).not.toEqual(liveTabs.browserOrder);
    expect(renderedTabIds).toEqual(liveTabs.recentOrder);
  } finally {
    await extension.close();
  }
});

test("selects a background link immediately, before its page loads", async () => {
  const extension = await launchExtension();
  let releaseNavigation;
  newTabNavigation = new Promise((resolve) => { releaseNavigation = resolve; });

  try {
    const olderPage = await extension.context.newPage();
    await olderPage.goto(`${baseUrl}/older`);
    await extension.page.bringToFront();

    await extension.page.getByRole("link", { name: "Open tab" }).click({
      modifiers: [process.platform === "darwin" ? "Meta" : "Control"]
    });

    const tabs = await extension.worker.evaluate(() => chrome.tabs.query({ currentWindow: true }));
    const newTab = tabs.find((tab) => tab.pendingUrl === `${baseUrl}/new-tab`);
    expect(newTab).toBeDefined();
    expect(newTab.status).toBe("loading");
    expect(newTab.active).toBe(false);
    expect(tabs.find((tab) => tab.active).id).toBe(extension.tab.id);
    expect(selectInitialTabId(tabs, extension.tab.id, "next")).toBe(newTab.id);

    releaseNavigation();
    await expect.poll(async () => {
      const loadedTabs = await extension.worker.evaluate(() => chrome.tabs.query({ currentWindow: true }));
      return loadedTabs.find((tab) => tab.id === newTab.id)?.status;
    }).toBe("complete");
    const loadedTabs = await extension.worker.evaluate(() => chrome.tabs.query({ currentWindow: true }));
    expect(selectInitialTabId(loadedTabs, extension.tab.id, "next")).toBe(newTab.id);
  } finally {
    releaseNavigation();
    await extension.close();
  }
});

test("opens Chrome shortcut settings from the extension settings", async () => {
  const extension = await launchExtension();

  try {
    const settings = await extension.context.newPage();
    await settings.goto(new URL("./options.html", extension.worker.url()).href);
    await expect(settings.locator("#commands .command")).toHaveCount(2);

    const shortcutsPromise = extension.context.waitForEvent("page");
    await settings.getByRole("button", { name: "Configure shortcuts" }).click();
    const shortcuts = await shortcutsPromise;
    await expect(shortcuts).toHaveURL("chrome://extensions/shortcuts");
    await expect(shortcuts.locator("extensions-keyboard-shortcuts")).toBeVisible();
  } finally {
    await extension.close();
  }
});

test("updates the toolbar badge as tabs open and close", async () => {
  const extension = await launchExtension();
  const badgeText = () => extension.worker.evaluate(() => chrome.action.getBadgeText({}));

  try {
    await expect.poll(badgeText).toBe("1");
    const secondTab = await extension.context.newPage();
    await secondTab.goto(`${baseUrl}/second`);
    await expect.poll(badgeText).toBe("2");
    await expect.poll(() => extension.worker.evaluate(() => chrome.action.getTitle({})))
      .toBe("samsara (2 open tabs)");

    await secondTab.close();
    await expect.poll(badgeText).toBe("1");
  } finally {
    await extension.close();
  }
});
