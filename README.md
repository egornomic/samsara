# Tab Cycler

Brave browser extension for cycling through open tabs with shortcuts configured by the user.

Press the configured shortcut to show a tab switcher grid. Keep holding the
modifier key and press the shortcut again to move the selection. Release the
modifier key to activate the selected tab. You can also press `Enter` to commit,
`Esc` to cancel, or click a tab in the grid.

## Install locally in Brave

1. Open `brave://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Open `brave://extensions/shortcuts` to change the shortcuts.

Default shortcuts:

- Next tab: `Ctrl+Shift+Comma` (`Command+Comma` on macOS)
- Previous tab: `Ctrl+Shift+Period` (`Command+Shift+Comma` on macOS)

Some operating system or browser shortcuts can take priority over extension
shortcuts. If Brave does not register a default shortcut, set your preferred
shortcut manually in `brave://extensions/shortcuts`.

## Development

Run tests:

```sh
npm test
```
