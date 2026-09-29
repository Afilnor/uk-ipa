# Third-party notices

UK IPA Pop-up is free software: you can redistribute it and/or modify it under the terms of the
GNU General Public License, version 3 or (at your option) any later version. See `LICENSE`.

## Pronunciation data (`public/dict/en_UK.json`)

The bundled dictionary is built by `scripts/refresh-dataset.ts` by merging two sources. Where both
list a word, the Wiktionary pronunciation is used. Syllable dots were removed from Wiktionary's
transcriptions, and only single words with a British or accent-neutral pronunciation were kept.
`public/dict/SOURCES.json` records the exact source versions of the current file.

The merged file is distributed under the **GNU GPL, version 3 or later**.

### Wiktionary

- Source: English Wiktionary (https://en.wiktionary.org/), extracted by Wiktextract
  (https://github.com/tatuylonen/wiktextract) and published at https://kaikki.org/
- Authors: Wiktionary contributors
- License: Creative Commons Attribution-ShareAlike 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)
- The Wiktionary-derived data was adapted as described above and is licensed under GPL-3.0-or-later,
  as permitted by Creative Commons' one-way compatibility of BY-SA 4.0 with GPLv3
  (https://creativecommons.org/share-your-work/licensing-considerations/compatible-licenses/).

### ipa-dict (en_UK)

- Source: https://github.com/open-dict-data/ipa-dict (`data/en_UK.txt`)
- The en_UK data is derived from ipacards (https://github.com/leoboiko/ipacards) by Leonardo Boiko
- License: GNU General Public License, version 3
