# Review reference

## Single purpose

Help users recognize and switch between open tabs in the current browser window using a keyboard-operated visual switcher.

## Permission explanations

| Permission | Use in Samsara |
| --- | --- |
| `tabs` | Read open-tab titles, URLs, favicons, and recent activation information for the switcher. |
| `storage` | Cache preview images and capture timestamps in local browser session storage. |
| `scripting` | Install the packaged switcher script into already-open eligible tabs after installation or browser startup. |
| `activeTab` | Permit a visible-tab capture after the user invokes an extension command, including captures Chrome allows through a user gesture on otherwise restricted pages. |
| Host access: `<all_urls>` | Run the switcher on eligible websites and capture visible-tab previews as users activate or finish loading tabs. Chrome still restricts protected pages. |

All executable code is included in the package. There is no remotely hosted executable code, account sign-in, analytics, or publisher backend. The switcher may load a website's favicon URL if no preview image is available.

## Review procedure

1. Install the extension and open three ordinary website tabs in one window.
2. Visit each tab so recent activity order and previews are populated. A preview may be unavailable where Chrome blocks capture.
3. Open the extension popup. Check that both shortcut bindings are shown. Use **Configure shortcuts** if either is unassigned.
4. Invoke the next-tab shortcut on an ordinary website and keep the modifier held. Repeat the shortcut to move selection, then release the modifier to activate the selected tab.
5. Open the switcher again and press Escape while holding the modifier. The overlay should close without changing tabs.
6. Open `chrome://extensions` and invoke the shortcut. Chrome blocks the overlay there, so the extension switches directly to the selected tab.
7. Close a tab. Its cached preview is removed from session storage. No account or test credentials are needed.
