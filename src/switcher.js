(() => {
  if (window.__tabCyclerInstalled) {
    return;
  }

  window.__tabCyclerInstalled = true;

  const ROOT_ID = "tab-cycler-switcher-root";
  const PAGE_SIZE = 12;
  const MAX_COLUMNS = 4;
  const state = {
    windowId: null,
    pageScale: 1,
    selectedTabId: null,
    tabs: []
  };

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);

    if (root) {
      return root;
    }

    root = document.createElement("div");
    root.id = ROOT_ID;
    root.attachShadow({ mode: "open" });
    document.documentElement.append(root);

    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial;
      }

      .backdrop {
        --page-scale: 1;
        --page-scale-inverse: 1;
        position: fixed;
        top: 0;
        left: 0;
        width: calc(100vw * var(--page-scale));
        height: calc(100vh * var(--page-scale));
        z-index: 2147483647;
        display: grid;
        place-items: center;
        padding: 32px;
        box-sizing: border-box;
        background: rgb(13 15 18 / 56%);
        color: #f6f4ef;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        transform: scale(var(--page-scale-inverse));
        transform-origin: top left;
      }

      .panel {
        --columns: 1;
        --card-width: 220px;
        --gap: 10px;
        --padding: 14px;
        width: calc((var(--columns) * var(--card-width)) + ((var(--columns) - 1) * var(--gap)) + (var(--padding) * 2));
        max-width: calc(100% - 64px);
        max-height: calc(100% - 64px);
        overflow: hidden;
        border: 1px solid rgb(255 255 255 / 18%);
        border-radius: 18px;
        background: rgb(28 30 34 / 92%);
        box-shadow: 0 24px 80px rgb(0 0 0 / 42%);
        backdrop-filter: blur(22px);
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
        grid-auto-rows: 154px;
        gap: var(--gap);
        max-height: calc((100vh * var(--page-scale)) - 104px);
        overflow: hidden;
        padding: var(--padding);
        box-sizing: border-box;
      }

      .pager {
        display: flex;
        justify-content: center;
        gap: 6px;
        padding: 0 14px 12px;
      }

      .dot {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: rgb(255 255 255 / 28%);
      }

      .dot.current {
        width: 18px;
        background: #ff7a59;
      }

      .tab {
        display: grid;
        grid-template-rows: 88px minmax(0, 1fr);
        gap: 8px;
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        box-sizing: border-box;
        overflow: hidden;
        border: 2px solid transparent;
        border-radius: 12px;
        padding: 8px;
        color: inherit;
        background: rgb(255 255 255 / 8%);
        text-align: left;
        cursor: pointer;
      }

      .tab:hover,
      .tab.selected {
        border-color: #ff7a59;
        background: rgb(255 122 89 / 18%);
      }

      .preview {
        display: grid;
        place-items: center;
        border-radius: 8px;
        background:
          linear-gradient(135deg, rgb(255 255 255 / 16%), rgb(255 255 255 / 4%)),
          #22262c;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
      }

      .preview img {
        width: 30px;
        height: 30px;
      }

      .preview img.screenshot {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .fallback-icon {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 10px;
        color: #151515;
        background: #f3efe7;
        font-size: 17px;
        font-weight: 700;
      }

      .meta {
        display: block;
        min-width: 0;
        overflow: hidden;
      }

      .title {
        display: block;
        overflow: hidden;
        color: #fffaf4;
        font-size: 13px;
        font-weight: 650;
        line-height: 1.25;
        min-width: 0;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .url {
        display: block;
        overflow: hidden;
        margin-top: 3px;
        color: rgb(255 250 244 / 66%);
        font-size: 11px;
        line-height: 1.25;
        min-width: 0;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `;

    root.shadowRoot.append(style);
    return root;
  }

  function render(payload) {
    Object.assign(state, payload);

    const root = ensureRoot();
    const panel = document.createElement("div");
    panel.className = "backdrop";
    const selectedIndex = Math.max(
      state.tabs.findIndex((tab) => tab.id === state.selectedTabId),
      0
    );
    const pageCount = Math.max(Math.ceil(state.tabs.length / PAGE_SIZE), 1);
    const pageIndex = Math.min(Math.floor(selectedIndex / PAGE_SIZE), pageCount - 1);
    const pageTabs = state.tabs.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);
    const columnCount = Math.min(Math.max(pageTabs.length, 1), MAX_COLUMNS);
    const pageScale = Number.isFinite(state.pageScale) && state.pageScale > 0 ? state.pageScale : 1;
    const inversePageScale = 1 / pageScale;
    const pager = pageCount > 1 ? createPager(pageCount, pageIndex) : "";

    panel.style.setProperty("--page-scale", String(pageScale));
    panel.style.setProperty("--page-scale-inverse", String(inversePageScale));
    panel.innerHTML = `
      <div class="panel" style="--columns: ${columnCount}" role="dialog" aria-label="Tab switcher">
        <div class="grid" role="listbox" aria-label="Open tabs"></div>
        ${pager}
      </div>
    `;

    const grid = panel.querySelector(".grid");

    for (const tab of pageTabs) {
      const item = document.createElement("button");
      item.className = tab.id === state.selectedTabId ? "tab selected" : "tab";
      item.type = "button";
      item.dataset.tabId = String(tab.id);
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(tab.id === state.selectedTabId));

      const title = tab.title || tab.url || "Untitled tab";
      const host = formatHost(tab.url);
      const preview = tab.previewUrl
        ? `<img class="screenshot" src="${escapeAttribute(tab.previewUrl)}" alt="">`
        : tab.favIconUrl
        ? `<img src="${escapeAttribute(tab.favIconUrl)}" alt="">`
        : `<span class="fallback-icon">${escapeHtml(title.slice(0, 1).toUpperCase())}</span>`;

      item.innerHTML = `
        <span class="preview">${preview}</span>
        <span class="meta">
          <span class="title">${escapeHtml(title)}</span>
          <span class="url">${escapeHtml(host)}</span>
        </span>
      `;

      item.addEventListener("mouseenter", () => selectTab(tab.id));
      item.addEventListener("focus", () => selectTab(tab.id));
      item.addEventListener("click", () => previewTab(tab.id));
      grid.append(item);
    }

    root.shadowRoot.querySelector(".backdrop")?.remove();
    root.shadowRoot.append(panel);
  }

  function createPager(pageCount, pageIndex) {
    const dots = Array.from({ length: pageCount }, (_, index) => {
      const className = index === pageIndex ? "dot current" : "dot";
      return `<span class="${className}"></span>`;
    }).join("");

    return `<div class="pager" aria-hidden="true">${dots}</div>`;
  }

  function hide() {
    document.getElementById(ROOT_ID)?.remove();
  }

  function selectTab(tabId) {
    state.selectedTabId = tabId;
    updateSelected();
    chrome.runtime.sendMessage({
      type: "tabCycler:select",
      windowId: state.windowId,
      tabId
    });
  }

  function previewTab(tabId) {
    chrome.runtime.sendMessage({
      type: "tabCycler:preview",
      windowId: state.windowId,
      tabId
    });
    hide();
  }

  function updateSelected() {
    const root = document.getElementById(ROOT_ID);

    for (const item of root?.shadowRoot?.querySelectorAll(".tab") ?? []) {
      const selected = Number(item.dataset.tabId) === state.selectedTabId;
      item.classList.toggle("selected", selected);
      item.setAttribute("aria-selected", String(selected));
    }
  }

  function commit() {
    chrome.runtime.sendMessage({
      type: "tabCycler:commit",
      windowId: state.windowId
    });
    hide();
  }

  function cancel() {
    chrome.runtime.sendMessage({
      type: "tabCycler:cancel",
      windowId: state.windowId
    });
    hide();
  }

  function formatHost(url) {
    try {
      return new URL(url).host || url;
    } catch {
      return url;
    }
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };
      return entities[character];
    });
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  document.addEventListener(
    "keyup",
    (event) => {
      if (event.key === "Meta" || event.key === "Control" || event.key === "Alt") {
        commit();
      }
    },
    true
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (!document.getElementById(ROOT_ID)) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }

      if (event.key === "Enter") {
        event.preventDefault();
        commit();
      }
    },
    true
  );

  window.addEventListener("blur", () => {
    if (document.getElementById(ROOT_ID)) {
      commit();
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "tabCycler:render") {
      render(message.payload);
    }

    if (message?.type === "tabCycler:hide") {
      hide();
    }
  });
})();
