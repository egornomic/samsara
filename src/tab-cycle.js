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

export function createSwitcherTabs(tabs) {
  return [...tabs]
    .sort((left, right) => left.index - right.index)
    .map((tab) => ({
      id: tab.id,
      title: tab.title || tab.url || "Untitled tab",
      url: tab.url || "",
      favIconUrl: tab.favIconUrl || "",
      active: Boolean(tab.active)
    }));
}
