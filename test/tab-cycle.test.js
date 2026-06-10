import assert from "node:assert/strict";
import test from "node:test";

import { selectAdjacentTabId } from "../src/tab-cycle.js";

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
