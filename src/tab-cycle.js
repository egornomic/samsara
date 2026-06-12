export function selectAdjacentTabId(tabs, activeTabId, direction) {
  if (!Array.isArray(tabs) || tabs.length === 0) {
    return null;
  }

  const orderedTabs = [...tabs].sort((left, right) => left.index - right.index);
  const activeIndex = orderedTabs.findIndex((tab) => tab.id === activeTabId);
  const currentIndex = activeIndex === -1 ? 0 : activeIndex;
  const offset = direction === "previous" ? -1 : 1;
  const nextIndex = (currentIndex + offset + orderedTabs.length) % orderedTabs.length;

  return orderedTabs[nextIndex]?.id ?? null;
}

export function selectInitialTabId(tabs, activeTabId, direction) {
  if (direction === "next") {
    const recentTab = [...tabs]
      .filter((tab) => tab.id !== activeTabId && Number.isFinite(tab.lastAccessed))
      .sort((left, right) => right.lastAccessed - left.lastAccessed)[0];

    if (recentTab?.id != null) {
      return recentTab.id;
    }
  }

  return selectAdjacentTabId(tabs, activeTabId, direction);
}

export function createSwitcherTabs(tabs, previews = new Map()) {
  return [...tabs]
    .sort((left, right) => left.index - right.index)
    .map((tab) => ({
      id: tab.id,
      title: tab.title || tab.url || "Untitled tab",
      url: tab.url || "",
      favIconUrl: tab.favIconUrl || "",
      previewUrl: previews.get(tab.id)?.dataUrl || "",
      active: Boolean(tab.active)
    }));
}
