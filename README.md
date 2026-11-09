# QCMify — app + tooling (v1.12.0)

The revision app plus the development tooling around it. The app itself is still a
single `index.html` with no runtime dependencies; everything else is only needed
for content QA, manifest generation and browser tests.

```
qcmify/
├── index.html                 the app (open this)
├── sw.js                      service worker — offline shell + banks
├── manifest.webmanifest       installable PWA metadata
├── icon.svg                   vector app icon
├── icon-192.png               PWA icon (192×192)
├── icon-512.png               PWA icon (512×512)
├── icon-maskable-512.png      maskable icon (safe-zone padding)
├── apple-touch-icon.png       iOS home-screen icon (180×180)
├── og-image.png               social preview (1200×630)
├── package.json               dev scripts only
├── tests/
│   ├── run.mjs                unit suite (60 checks)
│   ├── fixtures/              small sample bank for the unit suite
│   └── e2e/                   Playwright — static server, config, 7 specs
├── tools/
│   ├── build-manifest.mjs     generates manifest.json for the data repo
│   └── validate-data.mjs      content QA (conflicting keys, bad answers, tags…)
└── .github/workflows/
    └── validate.yml           CI template — copy `.github/` to the repo root
```

## Try it

Open `index.html` in a browser. Three behaviours to know:

- **No `manifest.json` yet?** The app falls back to the old eager prefetch, so
  everything still works — just without the fast counts.
- **Service worker** requires a secure context: `https://` or
  `http://localhost` / `http://127.0.0.1`. Opening the file directly (`file://`)
  skips it, because browsers cannot register a worker there. A `file://` copy
  reads the banks from the published data root; served copies use the sibling
  `questions/` folder, so previews and mirrors work without editing the code.
- **Old question links** (`index.html#module=neurologie&q=<hash>`) still resolve
  if you already have one, but the app no longer generates new per-question links.

## What changed in 1.12.0

- **Copy a question.** Each card has a small copy button. It writes a plain-text
  block to the clipboard in this exact shape:
  `Question` / `Les Choix` / `La Réponse`, with the options lettered A–E and the
  correct answer letter(s) plus their text. A toast confirms “La question a été
  copiée”. The copy is independent of the user's current selection; HTML tags are
  stripped and entities decoded.
- **Repeat arrows follow the display order.** Up goes to the occurrence above,
  down to the one below, with no wrapping; the arrow is disabled at either end.
  Long jumps use an instant scroll and re-center once the card has laid out.
- **Interaction polish.** The tap sound is back on every click, including empty
  space, and waits for the AudioContext to resume before playing. Option text is
  selectable, the confirmation toast now appears at the top of the screen, and
  “intelligemment” has a theme-coloured glow.

## What changed in 1.11.0

- **All matches, no pager.** After any filter change the total count appears
  immediately and every matching card is appended in small time-budgeted batches
  (about 12 per 16 ms, with only the first 24 animated). The “Afficher plus”
  button is gone; deep links and repeat arrows still scroll to their target once
  the target card has been appended.
- **Performance pass.** Sanitised stem/option markup is cached per question,
  question lookup uses a qid map, answer changes compute progress stats once,
  scroll work is coalesced to one animation frame, offscreen cards use
  `content-visibility:auto`, and the expensive fixed/backdrop-filter backgrounds
  were removed. The home-card cascade is 60 ms instead of 300 ms.
- **Generated manifest included.** `questions/manifest.json` now lists the six
  current banks (3,576 questions) so opening a year does not prefetch every bank.
  Copy it into the data repo alongside the bank folders; regenerate it when the
  banks change.

## What changed in 1.10.0

- **Repeated-question detection rewritten.** A pair is repeated when either of
  these holds:
  1. the stems are **nearly identical** (fuzzy weighted Jaccard after stopword
     removal, light stemming and a small synonym map) **and at least 2 answer
     choices are identical** (order, accents, case and punctuation ignored);
  2. **all choices but one are identical** (4 options require 3 shared, 5 require
     4), even when the stem is inverted (“which is true” vs “which is false”).
     A minimal stem-overlap floor (`REPEAT_INVERTED_TEXT_FLOOR = 0.20`) is still
     required so unrelated questions sharing a generic option set are not linked.
  Arbitrary unseen synonyms still need an entry in `REPEAT_SYNONYMS` for
  condition 1; condition 2 only needs the small overlap floor.
- **Answers are no longer shared.** Each occurrence has its own key and progress.
  Answering one row does not mark the others as done.
- **Visual comparison.** A yellow **Répétée** tag marks a repeated question; it
  turns red when the occurrences disagree on the answer key. Clicking the tag
  reveals ↑/↓ arrows and an `n/total` counter. The arrows follow the currently
  displayed order, stop at the first/last visible occurrence, and a long jump is
  followed by a reliable re-center.
- **Removed the per-question copy-link and Telegram report buttons.** Screenshots
  are the intended way to flag a question, so the extra controls and their report
  plumbing are gone.
- **Old links remain readable.** The router still accepts `#module=…&q=…` for
  previously shared links, but no new link is created.

## What changed in 1.9.0

- **Progress survives data edits.** Answers are stored per occurrence and
  validated per key, so adding, removing or rewording one question no longer
  wipes a student's whole module history. A changed stem/options/answer changes
  only that occurrence's key.
- **No lost answer on navigation.** The 250 ms persistence debounce is flushed
  before a module switch, and an abandoned exam is restored under its own module
  slug (the previous code could persist it against the module being opened).
- **Portable data path.** `DATA_BASE` is now `./`, so the bank and manifest are
  same-origin in production, on localhost, and on any mirror. The service worker
  can therefore cache the banks everywhere.
- **Manifest retry.** A transient manifest failure is retried after 15 s instead
  of being cached as “no manifest” for the whole session.
- **Question-key collisions.** Occurrence keys include the content hash, exam
  year, rotation and an occurrence counter, so two different questions can never
  share answer state even if the hash collides.
- **Focus and keyboard.** `Esc` returns focus to the filter trigger it closed.
- **Sound.** The tap now plays only on interactive elements; clicking empty space
  is silent. The validate button still plays the answer motif, and the mute
  preference is remembered.
- **PWA/share.** Added PNG 192/512, maskable and iOS icons, plus `og:image` /
  `twitter:image` (1200×630). Telegram/WhatsApp links now have a preview image.
- **Service worker.** A 4 s navigation timeout serves the cached shell on a slow
  (not just dead) connection, and cache writes are attached to the event.
- **Landmarks/no-JS.** Only one exposed `<main>` at a time; the `<noscript>` block
  now carries readable content instead of a one-line warning.
- **Version alignment.** `index.html`, `package.json`, README and `sw.js` all
  report 1.12.0.

The Google Fonts request (Inter) is intentionally unchanged: one render-blocking
stylesheet on first visit, cached afterwards, with the original font stack as the
fallback.

## Earlier feature pass (still current)

**Data loading**
- `manifest.json` supplies question/lesson counts and “coming soon” states, so
  opening a year does not download the banks. A bank is fetched only when a module
  is opened. Falls back to prefetch without a manifest.
- Prefetch is paced (4 at a time, 2 under Data Saver) for the fallback path.
- `MODULE_DATA` is an LRU of 6 modules instead of growing forever.
- Every valid row is kept. A question asked in 2024 · rotation 2 and again in
  2025 · rotation 3 is two rows, because the year/rotation filters need both.
  Rows identical in year, rotation and content are reported as data noise, never
  silently removed. Each row has its own answer state; repeated questions are
  grouped and tagged separately (see 1.10.0 above).

**Rendering**
- Selection toggles update classes/ARIA on the four buttons instead of rebuilding
  the card's `innerHTML` (keeps focus, one less layout pass).
- `getFilteredQuestions()` filters before copying.
- Filter dropdowns are only rebuilt when the module or language changes.
- One sort control only (exam year); courses keep a stable order (TD/Sim/TP last).

**Search**
- A ✕ button inside the search field appears when there is text; clears,
  refocuses and re-renders. `Esc` inside the field does the same.
- Printing works through the browser (`Ctrl/⌘+P`); the print stylesheet ships.

**Study features**
- **Exam mode**: random draw from the current filters, 10/20/30/all questions,
  optional timer, live countdown, score summary, auto-submit, “new set” / “leave”
  / “review my mistakes”. An abandoned attempt restores the answers it displaced.
- **Repeated questions**: yellow/red **Répétée** tag, ↑/↓ occurrence navigation,
  independent answers per occurrence.
- **Copy question**: plain-text Question / Les Choix / La Réponse block with a
  confirmation toast.
- **Welcome shortcuts**: “Tout afficher” starts at the first question; all matching
  cards stream in progressively. “Au hasard” draws a question and applies its year,
  rotation and course.
- **Keyboard**: `1`–`5` toggle an option, `Enter` validates, `j`/`k` move between
  questions, `Esc` closes panels / clears search / returns focus.

**Polish**
- Inter webfont and the original font stack; the logo mark is a text glyph.
- Dark theme, with green `--success`.
- Web Audio sound effects, no audio files; choice remembered (`qcm-sound`) and
  tap timbre selectable with `?tap=pop|tick|tock`.
- Offline shell is network-first; banks are stale-while-revalidate, versioned by
  `?v=DATA_VERSION`.
- `?debug` enables informational console logs.

## Checks

```bash
node tests/run.mjs                         # 60 checks, no dependencies
node tools/build-manifest.mjs <data-dir>   # writes manifest.json next to the banks
node tools/validate-data.mjs <data-dir>    # exit 1 on blocking content errors
```

The unit tests read `index.html` and extract the real functions, so they cannot
drift from the shipped code. They cover i18n parity, normalisation (dedupe/clamp/
signature), answer classification, every card state (untouched, selected, partial,
wrong+missed, correct, hostile markup), persistence round-trips and manifest
helpers.

### End-to-end (Playwright)

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

Seven flows: home + manifest counts, welcome → “Tout afficher” progressive rendering,
search + ✕, answer/validate + persistence across a reload, randomize (year +
rotation + course), exam mode draw + score, and year-1 back navigation.

The app's backend is intercepted per test with `page.route`, so the suite never
touches the network; `tests/e2e/server.mjs` (no dependencies) serves the app root
on `127.0.0.1:4173`.

**Release gate:** these suites must be run before deploying. They were not
executed in this build environment (no Node/browser available), so treat selectors
as the first thing CI should verify. `manifest.json` freshness and content
validation are wired as separate CI steps.

## CI

`.github/workflows/validate.yml` runs on every push that touches the JSON banks or
`index.html`: the app tests, a check that `manifest.json` is not stale, and the
content validator. Place it at the **root** of `qcmify-data` (together with
`tools/` and `tests/`).

The content step starts as **advisory** (`continue-on-error: true`) because the
current banks still have conflicting answer keys; delete that line once it passes.
The manifest step *does* block — a stale manifest silently shows wrong counts.

## Repo layout and deploying

```
qcmify-data/
├── index.html               ← the app
├── sw.js                    ← must stay at the root (its scope is the whole site)
├── manifest.webmanifest
├── icon.svg
├── icon-192.png
├── icon-512.png
├── icon-maskable-512.png
├── apple-touch-icon.png
├── og-image.png
└── questions/
    ├── manifest.json        ← generated: counts + availability
    ├── year1/  biochimie-s1.json …
    ├── year4/  cardiologie.json  infectieuses.json  neurologie.json
    └── year5/  gynecologie.json  locomoteur.json  pediatrie.json
```

1. App files go to the **root** (including the PNG icons and `og-image.png`).
2. Every `<slug>.json` goes in `questions/year<N>/` where **N is the study year
   from `CURRICULUM` (1–6)** — not the exam year stored inside the JSON. The slug
   must match `CURRICULUM` exactly (`locomoteur`, not `locomotoeur`), otherwise
   the module silently stays “coming soon”.
3. `node tools/build-manifest.mjs questions` → writes `questions/manifest.json`
   (it walks the year folders; duplicate slugs make it fail).
4. Bump `CACHE` in `sw.js` and `APP_VERSION` in `index.html` on each release;
   bump `DATA_VERSION` only when the banks change.

Do it on a branch: the merge is a single commit, so Pages rebuilds once and there
is no window where the app points at a folder that does not exist yet.

## Deliberately not done yet

- **Cross-module search** — needs a generated stem index and a ranking UI.
- **`curriculum.json`** — moving the 53-module tree out of the code is a repo
  refactor, and it would make the shell depend on a network file unless precached.
- **Content translation** (questions are French-only) and **content coverage**
  (6 of 53 modules have data) — editorial, not code.
- **SSR / per-question pages** — the app is a single hash-routed document, so
  individual questions are not separately indexable by crawlers. The static meta
  tags and the `<noscript>` content cover the home page only. Per-question links
  are no longer generated.
