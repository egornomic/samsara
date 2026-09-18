import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const source = await readFile(new URL("icons/samsara.svg", root), "utf8");
const browser = await chromium.launch({ channel: "chromium", headless: true });

try {
  for (const size of [16, 32, 48, 128]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    // Small toolbar icons use the full canvas; the store icon has 16 px padding.
    const svg = size < 128 ? source.replace('viewBox="0 0 128 128"', 'viewBox="16 16 96 96"') : source;
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    const output = `icons/icon-${size}.png`;
    await page.screenshot({ path: fileURLToPath(new URL(output, root)), omitBackground: true });
    await page.close();
    console.log(output);
  }
} finally {
  await browser.close();
}
