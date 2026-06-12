import assert from "node:assert/strict";
import test from "node:test";

import { createSwitcherTabs, selectAdjacentTabId, selectInitialTabId } from "../src/tab-cycle.js";

test("selects the next tab in browser order", () => {
  const tabs = [
    { id: 30, index: 2 },
    { id: 10, index: 0 },
    { id: 20, index: 1 }
  ];

  assert.equal(selectAdjacentTabId(tabs, 10, "next"), 20);
});

test("wraps from the last tab to the first tab", () => {
  const tabs = [
    { id: 10, index: 0 },
    { id: 20, index: 1 }
  ];

  assert.equal(selectAdjacentTabId(tabs, 20, "next"), 10);
});

test("selects the previous tab and wraps to the last tab", () => {
  const tabs = [
    { id: 10, index: 0 },
    { id: 20, index: 1 },
    { id: 30, index: 2 }
  ];

  assert.equal(selectAdjacentTabId(tabs, 10, "previous"), 30);
});

test("returns no target when there are no tabs", () => {
  assert.equal(selectAdjacentTabId([], 10, "next"), null);
});

test("starts next cycling at the most recently active tab", () => {
  const tabs = [
    { id: 10, index: 0, lastAccessed: 500 },
    { id: 20, index: 1, lastAccessed: 900 },
    { id: 30, index: 2, lastAccessed: 100 }
  ];

  assert.equal(selectInitialTabId(tabs, 10, "next"), 20);
});

test("starts a fresh next cycle back at the previous active tab", () => {
  const tabs = [
    { id: 10, index: 0, lastAccessed: 900 },
    { id: 20, index: 1, lastAccessed: 1000 },
    { id: 30, index: 2, lastAccessed: 100 }
  ];

  assert.equal(selectInitialTabId(tabs, 20, "next"), 10);
});

test("falls back to browser order when recency is unavailable", () => {
  const tabs = [
    { id: 10, index: 0 },
    { id: 20, index: 1 }
  ];

  assert.equal(selectInitialTabId(tabs, 10, "next"), 20);
});

test("creates switcher tabs in browser order with cached previews", () => {
  const tabs = [
    { id: 20, index: 1, title: "Second", url: "https://second.test", active: true },
    { id: 10, index: 0, title: "First", url: "https://first.test", favIconUrl: "icon.png" }
  ];
  const previews = new Map([[20, { dataUrl: "data:image/jpeg;base64,preview" }]]);

  assert.deepEqual(createSwitcherTabs(tabs, previews), [
    {
      id: 10,
      title: "First",
      url: "https://first.test",
      favIconUrl: "icon.png",
      previewUrl: "",
      active: false
    },
    {
      id: 20,
      title: "Second",
      url: "https://second.test",
      favIconUrl: "",
      previewUrl: "data:image/jpeg;base64,preview",
      active: true
    }
  ]);
});
