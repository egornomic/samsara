export function selectAdjacentTabId(tabs, activeTabId, direction) {
  if (!Array.isArray(tabs) || tabs.length === 0) {
    return null;
  }

  const orderedTabs = orderTabsByRecentActivity(tabs);
  const activeIndex = orderedTabs.findIndex((tab) => tab.id === activeTabId);
  const currentIndex = activeIndex === -1 ? 0 : activeIndex;
  const offset = direction === "previous" ? -1 : 1;
  const nextIndex = (currentIndex + offset + orderedTabs.length) % orderedTabs.length;

  return orderedTabs[nextIndex]?.id ?? null;
}

export function selectInitialTabId(tabs, activeTabId, direction) {
  if (direction === "next") {
    const recentTab = orderTabsByRecentActivity(tabs)
      .find((tab) => tab.id !== activeTabId && Number.isFinite(tab.lastAccessed));

    if (recentTab?.id != null) {
      return recentTab.id;
    }
  }

  return selectAdjacentTabId(tabs, activeTabId, direction);
}

export function createSwitcherTabs(tabs, previews = new Map()) {
  return orderTabsByRecentActivity(tabs)
    .map((tab) => ({
      id: tab.id,
      title: tab.title || tab.url || "Untitled tab",
      url: tab.url || "",
      favIconUrl: tab.favIconUrl || "",
      previewUrl: previews.get(tab.id)?.dataUrl || "",
      active: Boolean(tab.active)
    }));
}

function orderTabsByRecentActivity(tabs) {
  return [...tabs].sort((left, right) =>
    (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0) || left.index - right.index
  );
}
