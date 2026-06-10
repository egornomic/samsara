const COMMAND_LABELS = new Map([
  ["cycle-next-tab", "Next tab"],
  ["cycle-previous-tab", "Previous tab"]
]);

const commandList = document.querySelector("#commands");
const shortcutsButton = document.querySelector("#open-shortcuts");

async function renderCommands() {
  const commands = await chrome.commands.getAll();
  const rows = commands
    .filter((command) => COMMAND_LABELS.has(command.name))
    .map((command) => {
      const row = document.createElement("div");
      row.className = "command";

      const name = document.createElement("dt");
      name.textContent = COMMAND_LABELS.get(command.name);

      const value = document.createElement("dd");
      const shortcut = document.createElement("kbd");
      shortcut.textContent = command.shortcut || "Not set";
      value.append(shortcut);

      row.append(name, value);
      return row;
    });

  commandList.replaceChildren(...rows);
}

shortcutsButton.addEventListener("click", async () => {
  await chrome.tabs.create({ url: "brave://extensions/shortcuts" });
});

renderCommands();
