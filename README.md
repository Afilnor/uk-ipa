# UK IPA Pop-up

A browser extension that shows the British (UK) IPA pronunciation of any word you highlight.

- **Instant and offline:** about 115,000 words are bundled in the extension. Lookups never touch the network.
- **Private:** no data is collected. See the [privacy policy](PRIVACY.md).
- **Understands word forms:** "running", "cities" or "colonel's" fall back to "run", "city" and "colonel" when needed.

**Install:** Chrome Web Store (link coming soon).
**Support, bugs and missing words:** [open an issue](https://github.com/Afilnor/uk-ipa/issues).

## Project layout

| Path | What it is |
|---|---|
| `entrypoints/background.ts` | Loads the dictionary and answers lookups |
| `entrypoints/content/` | Detects the highlighted word and shows the pop-up next to it |
| `entrypoints/popup/` | Toolbar popup |
| `utils/` | Lookup (including the fallback to base forms) and config helpers |
| `public/dict/en_UK.json` | Generated dictionary, committed. Rebuild it with `npm run refresh-dataset` |
| `scripts/refresh-dataset.ts` | Merges Wiktionary and ipa-dict into `en_UK.json` |
| `.github/workflows/` | CI, releases to the Chrome Web Store, monthly dataset refresh |

The extension is built with [WXT](https://wxt.dev), which produces a package for each browser from the same code.

## Development

```sh
npm install
npm run dev                 # opens Chrome with the extension loaded and auto-reloads
npm run dev:firefox         # same for Firefox
npm test                    # unit tests
npm run compile             # type-check
npm run zip                 # .output/uk-ipa-<version>-chrome.zip
npm run zip:firefox         # Firefox package plus the sources zip
```

## Pronunciation data

`npm run refresh-dataset` downloads the latest English Wiktionary extract from [kaikki.org](https://kaikki.org/)
(about 500 MB, streamed) and [ipa-dict](https://github.com/open-dict-data/ipa-dict)'s `en_UK` list, then merges them:
- **British pronunciations:** from Wiktionary, the Received Pronunciation, UK and standard British
  transcriptions are kept, along with accent-neutral ones.
- **Collisions:** when both sources have a word, Wiktionary's pronunciation is used, and ipa-dict fills in the
  words Wiktionary lacks.
- **Output:** the script rewrites `public/dict/en_UK.json` and `SOURCES.json` only if something changed. Add
  `-- --cache` to keep the download in `.dataset-cache/` between runs.

The **Refresh dataset** workflow does the same on GitHub every month, or when run by hand from the Actions tab.
It opens a pull request with the changes. Builds never download data; they use the committed file.

Found a wrong or missing pronunciation? [Open an issue](https://github.com/Afilnor/uk-ipa/issues) with the word and
where you saw it. Fixes to the source data on [Wiktionary](https://en.wiktionary.org/) reach the extension with the
next refresh.

## Releasing (maintainers)

1. Bump `version` in `package.json` and commit.
2. `git tag v1.2.0 && git push origin v1.2.0`
3. The **Release** workflow tests, builds and submits the zip to the Chrome Web Store, then creates a GitHub
   release.

It needs these repository secrets:
- `CHROME_EXTENSION_ID`
- `CHROME_PUBLISHER_ID`
- `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL`
- `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY`

The last two come from a Google Cloud service account with the Chrome Web Store API enabled.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The pronunciation data
comes from Wiktionary (CC BY-SA 4.0) and ipa-dict (GPL-3.0).
