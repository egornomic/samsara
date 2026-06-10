import { selectAdjacentTabId } from "./tab-cycle.js";

const COMMANDS = {
  "cycle-next-tab": "next",
  "cycle-previous-tab": "previous"
};

chrome.commands.onCommand.addListener(async (command) => {
  const direction = COMMANDS[command];

  if (!direction) {
    return;
  }

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const activeTab = tabs.find((tab) => tab.active);
  const targetTabId = selectAdjacentTabId(tabs, activeTab?.id, direction);

  if (targetTabId != null) {
    await chrome.tabs.update(targetTabId, { active: true });
  }
});
