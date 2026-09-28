# Publish samsara to the Chrome Web Store

Use this guide to prepare a reviewed release package and submit it to the Chrome Web Store. Building or running CI does not upload or publish the extension.

## Prepare the public identity

1. Configure the required **Publisher name** in the Chrome Web Store developer dashboard. Keep personal attribution out of public copy. The package's author metadata does not control the store account's displayed publisher name.
2. Verify a contact email that you are comfortable showing publicly and that does not reveal your real name. The developer contact email is displayed on the listing; do not assume it stays private because the sign-in account does.
3. Complete the trader declaration accurately. Google states that verified trader information, including legal name, address, and phone number, appears publicly on the listing. A pseudonymous publisher name does not conceal these fields. Select non-trader only if it correctly describes your activity.
4. Inspect the account details and available listing preview before submitting. Check the publisher name, public contact details, linked profiles, and any verification information. Do not proceed if they reveal an identity you did not intend to publish.

These are separate from the source ZIP. The ZIP excludes Git history, package metadata, test traces, local paths, and store documents. Public repository history and profile links can still connect a pseudonym to a person; distributing the ZIP does not require publishing the source repository.

Sources: [account setup](https://developer.chrome.com/docs/webstore/set-up-account) and [trader verification FAQ](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq).

## Prepare a release

1. Start from a clean checkout and run `npm ci`.
2. Install Chromium with `npx playwright install chromium`.
3. For an update, choose a higher numeric version in `package.json` and synchronize the lockfile with `npm install --package-lock-only`. Chrome versions use one to four dot-separated integers; do not use prerelease suffixes. The initial prepared package is version `1.0.0`.
4. Run `npm run check`. All business logic and browser tests must pass.
5. Load `dist/chrome` in Chrome and check the shortcut, preview grid, selection, cancellation, and settings button. Check at least one browser-protected page such as `chrome://extensions`, where the extension should switch directly without an overlay.
6. Complete the assets listed in [store materials](../store/README.md) and host [the privacy statement](privacy.md) at a public URL. This repository preparation does not host that page.
7. Commit the source and metadata changes, then create a matching release tag, such as `v1.0.0`. Push the commit and tag when you are ready to run CI.

The **Check and package** workflow runs on pull requests, pushes to `master`, version tags, or manual dispatch. It rejects a tag that does not match the package version. After successful tests, it retains the ZIP as a workflow artifact for 30 days. Download the artifact and extract its outer GitHub archive to obtain the actual `samsara-<version>.zip` store package.

The unpacked directory and ZIP contain the same runtime bytes. Fixed archive timestamps make repeated builds of identical sources reproducible. Keep the tested ZIP for the submission; changing any source file requires rebuilding and retesting.

## Submit the first version

1. In the developer dashboard, choose **Add new item** and upload `dist/samsara-1.0.0.zip`, or the corresponding tested CI package. The manifest is at the ZIP root.
2. Complete the listing using [listing text](../store/listing.md) and the required images.
3. Supply the public privacy URL and describe local tab metadata and screenshot processing accurately. Use the permission explanations in [reviewer notes](../store/reviewer-notes.md); do not describe local processing as an absence of data access.
4. Add the reviewer instructions and choose distribution visibility and regions.
5. Recheck the public identity details. Submit for review with automatic publishing disabled if you want to inspect the approved submission before releasing it.
6. After approval, publish the item from the dashboard when ready.

See Google's [package preparation](https://developer.chrome.com/docs/webstore/prepare) and [publishing instructions](https://developer.chrome.com/docs/webstore/publish/).

## Publish an update

Increase the version, repeat the release checks, and upload the new ZIP to the **existing item** so installed users retain the same extension ID. Store API submission can be added after the first listing exists. Publishing credentials belong in CI secrets and must never enter source files or the extension ZIP.
