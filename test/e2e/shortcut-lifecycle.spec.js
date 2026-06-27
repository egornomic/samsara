import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { chromium } from "@playwright/test";

const extensionPath = path.resolve(import.meta.dirname, "../..");

let server;
let baseUrl;

test.beforeAll(async () => {
  server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><title>Shortcut test</title><main>Shortcut test</main>");
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
