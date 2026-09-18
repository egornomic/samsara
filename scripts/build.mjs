import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";
import manifest from "../manifest.config.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "dist");
const extension = path.join(output, "chrome");

// Only these runtime files are shipped. Repo metadata and store assets stay out.
const runtimeFiles = [
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
  "src/background.js",
  "src/options.css",
  "src/options.html",
  "src/options.js",
  "src/switcher.js",
  "src/tab-cycle.js"
];

const files = {
  "manifest.json": Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`),
  ...Object.fromEntries(await Promise.all(runtimeFiles.map(async (file) => [
    file,
    await readFile(path.join(root, file))
  ])))
};

await rm(output, { recursive: true, force: true });
await mkdir(extension, { recursive: true });

for (const [file, contents] of Object.entries(files)) {
  const destination = path.join(extension, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, contents);
}

// Fixed ZIP timestamps make identical sources produce identical release files.
const archive = zipSync(files, { level: 9, mtime: new Date(1980, 0, 1) });
const archiveName = `${manifest.name}-${manifest.version}.zip`;
await writeFile(path.join(output, archiveName), archive);

console.log(`Load unpacked: dist/chrome`);
console.log(`Store package: dist/${archiveName} (${archive.length} bytes)`);
