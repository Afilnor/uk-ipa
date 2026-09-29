# CLAUDE.md

Guidance for Claude Code in this repository. This file is public. Private plans and status live in
`CLAUDE.local.md` (gitignored): read it when it exists, and keep its content out of public files, commit
messages and PR descriptions.

## Commands

- `npm run dev`: run the extension in Chrome with hot reload (`dev:firefox` for Firefox)
- `npm test`: Node's built-in test runner on `tests/*.test.ts` (Node runs the TypeScript directly, no build step)
- `npm run compile`: type-check
- `npm run zip` / `npm run zip:firefox`: store packages in `.output/`
- `npm run refresh-dataset [-- --cache]`: rebuild `public/dict/en_UK.json`. It downloads about 500 MB and
  takes about a minute.
- `license-server/` is a separate npm package (Cloudflare Worker): `npm test`, `npm run compile`, `npm run dev`.

## Architecture

- **WXT extension (MV3 for Chrome, MV2 for Firefox):**
  - `entrypoints/content/` sends the selected word to the background script.
  - `entrypoints/background.ts` answers with `utils/lookup.ts` over the bundled JSON dictionary.
  - Messages use `sendResponse` + `return true`, not returned Promises, because Chrome doesn't support
    promise replies everywhere.
- **Build-time settings** are `WXT_*` env vars (see `.env.example`), read in `utils/config.ts` and
  `wxt.config.ts`. With `WXT_REQUIRE_LICENSE` unset (the default), the extension makes no network requests,
  and it must stay that way.
- **Dataset:** `scripts/refresh-dataset.ts` + `scripts/dataset-lib.ts` (pure functions, unit tested).
  - It streams the kaikki.org Wiktextract dump, splitting only on `\n`. `node:readline` also splits on
    U+2028/U+2029, which occur inside JSON strings.
  - Wiktionary wins on collisions, and ipa-dict fills the gaps.
  - The output is sorted, one entry per line, and committed.
- **Licensing:** the project is GPL-3.0-or-later because ipa-dict's en_UK data is GPL-3.0. Every build ships
  `LICENSE.txt` and `THIRD_PARTY_NOTICES.md` (the `build:publicAssets` hook in `wxt.config.ts`).

## Conventions

- Keep permissions minimal: only `storage`, plus the content script on `<all_urls>`. Adding any permission
  means updating `PRIVACY.md` and the store's privacy answers.
- Dictionary keys are lowercase, NFC-normalized, with straight apostrophes. Use `Object.hasOwn` for lookups,
  since words like "constructor" exist.
- Test changes to the content script or popup in a real browser: `npm run dev`, or Puppeteer with Chrome for
  Testing, because branded Chrome ignores `--load-extension`.
