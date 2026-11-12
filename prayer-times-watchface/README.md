# Prayer Times watchface — Amazfit Bip Max

An offline Zepp OS watchface for the Bip Max (432×514, deviceSource `11206915`). It shows:
- the time
- the Hijri date (Umm al-Qura)
- the Gregorian date
- the next prayer with a countdown
- all six times, with the next one highlighted

Everything is computed on the watch. It needs no phone, app-side code or network, so it works with Gadgetbridge.

![Prayers page, night and voluntary prayers, prohibited times, and always-on display](../docs/watchface/pages.png)

*Left to right: prayers (default page), night and voluntary prayers, prohibited times (the current window in red), always-on display.*

![Countdown line states](../docs/watchface/countdown.png)

*Countdown line: normal, last 10 minutes before an adhan, waiting for iqama, last third of the night.*

Screenshots are rendered from the face's own layout and prayer logic (`tools/gen-docs.py`) for Cairo on 12 Nov 2026, so they match what the watch shows.

## Pages (tap the prayer grid to cycle; waking the screen returns to page 1)

1. **Prayers:** a 2×3 grid (Fajr, Sunrise, Dhuhr / Asr, Maghrib, Isha; Dhuhr becomes الجمعة on Fridays). The next prayer is gold, with a countdown above.
   - **Countdown line colours:** teal normally, orange in the last 10 minutes before an adhan, gold while waiting for an iqama, and violet in the last third of the night, when it reads "الثلث الأخير • الفجر بعد …".
   - **Progress bar** under the countdown: fills right to left from the previous adhan to the next one (or from adhan to iqama), in the countdown's colour.
   - **Extras row** underneath: three cells, each chosen in its own edit slot from weather, steps, heart rate, battery, calories or nothing. Defaults are weather, steps and battery.
   - **Weather:** current temperature is drawn by the firmware (`TEXT_IMG` + `WEATHER_CURRENT`) with a transparent `invalid_image`. The condition is today's forecast code as a short Arabic word. With no weather from the phone (e.g. Gadgetbridge without Breezy Weather), the cell stays empty.
   - **Heart rate:** shows the last measurement, and is hidden until there is one.
2. **الليل والنوافل (night and voluntary prayers)**, in the same 3-column grid:
   - night portions between Maghrib and the next Fajr: first third, midpoint, last third, last sixth
   - Duha
   - on 1 Shawwal and 10 Dhul-Hijjah, the Eid prayer window (sunrise + 15 min until noon) instead of Duha
   - optional extra Fajr / Isha at your chosen angles (18°–12°, plus 14.6° for Fajr, or custom from `config.js`). An extra equal to the method's own angle is hidden, e.g. 12° under UIOF.
3. **أوقات النهي (prohibited times):** from Fajr, sunrise to sunrise + 10/15/20 min, the minutes before noon, after Asr, and from the sun at +5° to sunset. The current window is red.

The event definitions follow the Suntimes Prayer Times add-on (`AddonEvents.kt`, `DaysMonthBuilder.kt`).
- **Asr and the before-noon window:** always the majority (Shafi'i) rules, i.e. a shadow ratio of 1× and 10 minutes before noon.
- **Hanafi:** removed from the watch's settings. `lib/prayer.js` still supports it (`asrFactor: 2`).

**Iqama:** between a prayer's adhan and its iqama, the countdown line turns gold and reads "إقامة العشاء بعد ٧ د" (iqama of Isha in 7 min). The prayer stays highlighted until the iqama.
- **Presets:** choose one in the Iqama edit slot, on the next-prayer line where the countdown appears. Minutes are listed in the order Fajr, Dhuhr, Asr, Maghrib, Isha:
  - off
  - short: 10, 10, 10, 5, 10
  - standard: 20, 15, 15, 10, 15
  - long: 30, 20, 20, 10, 20
  - custom: uses `iqama` in `config.js`
- **Jumu'ah:** Friday Dhuhr uses `iqamaJumuah` from `config.js` (0 = no countdown).
- **Hijri day start:** the "Hijri day starts at Maghrib" option now lives in the Hijri slot, as "(المغرب)" variants of each offset.

**Methods** (Method edit slot): Egyptian, MWL, Karachi, ISNA, Umm al-Qura, UIOF (12°/12°), Dubai, Kuwait, Qatar, Singapore, Turkey (Diyanet), Tehran, Moonsighting Committee.

## How it works

```
config.js defaults ───────────┐
edit-slot choices ────────────┼──► settings S
lat/lon (shared storage) ─────┘        │
                                       ▼
Time sensor ──► date + timezone ──► dayEvents() × yesterday / today / tomorrow   lib/prayer.js
                                       │  cached until date, location or timezone change
                                       ▼
                 countdown(now) ──► next prayer, iqama, progress, colour         lib/countdown.js
                 hijriFromEpochDay ► Hijri date                                  lib/hijri.js
                                       │
                                       ▼
                 widgets: normal layer (3 pages) + AOD layer                     watchface/index.js
```

**Lifecycle** (`watchface/index.js`):
- **`build()`** runs once, when the face loads or after Edit:
  - reads the edit-slot choices
  - creates every widget for all three pages, the AOD layer and the edit slots
  - runs a full refresh
- **Every minute:** `Time.onPerMinute` updates the clock, Hijri date, countdown, progress bar and colours, the extras row, and whichever page is visible. Prayer events come from the cache.
- **New day:** `Time.onPerDay` forces a full refresh.
- **Wake:** a `WIDGET_DELEGATE` `resume_call` returns to page 1 and runs a full refresh. Timers don't fire while the screen is off, so this catches up the minutes and re-reads the location.
- **Full refresh:** re-reads location and timezone, and only recomputes events when the date, location or timezone has changed. Waking normally costs no prayer maths.

**Settings:** `S = config.js defaults + edit-slot values`, plus lat/lon from the location app. "Custom" slot options (extra angles, custom iqama) take their values from `config.js`. Changing a slot rebuilds the face, so settings never change mid-run.

**Pages:** all widgets are created up front. Switching pages only toggles visibility. A transparent `BUTTON` (`tap.png`) over the grid and extras row cycles the pages on tap.

**Always-on display:** a separate `ONLY_AOD` layer shows the Hijri date, the time and the next-prayer line in dim grey with no fills (few lit pixels). It's updated by the same refresh as the normal layer.

**Weather:** the current temperature is drawn by the firmware (`TEXT_IMG` + `WEATHER_CURRENT`). Watchface JS can only read the daily forecast, which supplies the condition word.

## Font

Arabic text (dates, names, labels) uses **Prayer Face Naskh**, a 64 KB subset of SIL's [Scheherazade New](https://software.sil.org/scheherazade/) 4.500 Medium. The clock and times stay in the system font, and `arabicFont: null` in `config.js` switches everything back to it.
- **Digits:** the font's digits (Latin and Arabic-Indic) and the punctuation around them (`/ : . % ° ٪`) come from [Noto Sans / Noto Sans Arabic](https://fonts.google.com/noto) Medium (OFL 1.1). Every number on the face is then sans, matching the system-font clock and times, instead of mixing in Scheherazade's serif numerals.
- **Presentation forms:** Zepp OS shapes Arabic by converting letters to Arabic Presentation Forms-B code points. Scheherazade has none of these, so `tools/gen-font.py` adds them, built with HarfBuzz from the font's own shaping. Lam-alef and similar forms are composite glyphs.
- **License:** Scheherazade New is under the SIL Open Font License 1.1. A subset counts as a Modified Version and "Scheherazade" / "SIL" are Reserved Font Names, so the subset is renamed. SIL's copyright and license records stay inside the font, and the license text is in `fonts/OFL.txt` (Noto's copyright is in `fonts/NOTICE`). Noto Sans is from google/fonts `ofl/notosans` and `ofl/notosansarabic`.
- **Adding new Arabic text:** the subset only contains characters found in `watchface/` and `lib/`, so a new string can show missing glyphs. Regenerate it after adding one:
  `mise run :gen` (or `:build`).

## Layout

```
watchface/index.js         ← UI (normal + AOD + edit slots), lifecycle and refresh (see How it works)
config.js                  ← defaults (fallback location, per-prayer minute offsets, 12/24h, custom values)

lib/prayer.js              ← adhan-js wrapper (npm, bundled by zeus) → local minutes; night portions, makruh windows
lib/countdown.js           ← countdown line: next prayer, iqama, progress, last 10 min, last third of the night
lib/hijri.js               ← Hijri conversion (Umm al-Qura table + tabular fallback)
lib/hijri-table.js         ← GENERATED month-length table, 1440–1500 AH
lib/location.js            ← reads lat/lon published by ../prayer-location-app
lib/extras.js              ← extras-row sensors (steps, heart rate, battery, calories) + weather condition
lib/edit-options.js        ← GENERATED on-watch edit slots (tools/gen-edit-assets.py)

tools/gen-hijri-table.mjs  ← regenerates the Hijri table from Node's ICU calendar
tools/gen-edit-assets.py   ← edit-slot previews, runtime icons/digits, lib/edit-options.js
tools/gen-preview.py       ← renders assets/bip-max/icon.png (picker preview, 294×350) from the real layout
tools/render.py            ← shared drawing for the above (layout boxes mirror watchface/index.js)
tools/preview-data.mjs     ← sample face data for the previews, computed by lib/
tools/gen-docs.py          ← README screenshots in ../docs/watchface/ (scenes from tools/docs-data.mjs)
tools/gen-font.py          ← builds the Naskh subset (see Font); tools/fetch-fonts.sh downloads its pinned sources

test/verify.mjs            ← Hijri vs ICU; prayer wrapper vs adhan in Africa/Cairo; event windows; countdown logic
```

## Build / install

The repo is a mise monorepo: shared tools are in the root `mise.toml`, and this folder's tasks are in `./mise.toml`. Run them from this folder, or from anywhere in the repo as `mise run //prayer-times-watchface:build`.
```sh
mise run :build            # fonts + generated assets → tests → lean dist/*.zab (~335 KB)
mise run :build-store      # same, but keeps zeus's source archive (for a Zepp store submission)
mise run :gen              # only regenerate (Hijri table, font, edit previews, picker icon)
mise run :test             # only the math/countdown checks
```
- The Python generators run under `uv`. Pillow is built from source on the first run (a few minutes, then cached) so that it links Homebrew's `libraqm` (`brew install libraqm`), which is needed to draw Arabic in the previews. The PyPI wheel has no RTL support.
- The source fonts are downloaded to `.cache/fonts/` at pinned versions and verified by checksum.
- **Lean vs store builds:** `zeus build` adds `.ip-package` to the `.zab`, a copy of the project source (~75% of its size) that lets the Zepp store rebuild for other devices. It never reaches the watch. `:build` removes it with `zeus prune --ip` for Gadgetbridge sideloading and releases; `:build-store` keeps it.

Install:
```sh
zeus build                 # → dist/*.zab (what :build runs, followed by `zeus prune --ip`)
zeus preview               # QR code → scan from Zepp app (Developer Mode) to install on watch
# or: zeus bridge  →  connect / install   (Zepp app Developer Mode → Bridge on)
```

Gadgetbridge can also install a `.zab`/`.zpk` directly: open the file with Gadgetbridge (the File Installer).

## Verify the math

```sh
mise run :test                  # or: pnpm install && pnpm test; also try TZ=Pacific/Auckland pnpm test
```
The Hijri dates match ICU `islamic-umalqura` on every day from 2018 to 2077. The prayer wrapper's timezone/DST conversion matches adhan's own output formatted for Africa/Cairo, for every method, both Asr shadow ratios, and any host timezone. adhan reads only the input Date's local Y/M/D and returns absolute instants. The face converts those with the offset it derives from the `Time` sensor, so it doesn't depend on QuickJS's `Date` timezone support.

## Notes / findings

- **API level:** the Bip Max reports API_LEVEL 4.4 (Zepp OS 5). The package targets 3.0 so that it can use `@zos/ui`, `@zos/sensor` `Time.onPerMinute`/`onPerDay`, `show_level` (normal / AOD / edit layers), `@zos/share-storage` and `WIDGET_DELEGATE`.
- **Timezone and DST:** these come from the `Time` sensor (local fields compared with UTC). This follows Egypt's summer time automatically. A fixed offset such as `tzOffsetHours = 2` would be wrong in summer.
- **Hijri:** Egypt follows moon sighting (Dar al-Ifta), so it can differ from Umm al-Qura by ±1 day. Correct this with the Hijri edit slot (offset −2…+2); its "(المغرب)" variants also advance the date at Maghrib.
- **Fine-tuning:** if a printed local calendar differs by a minute or two (Egypt's published times often add precaution minutes), use the `adjust` minutes.
- **Arabic:** the firmware shapes Arabic itself (see Font). Names and times are in separate TEXT widgets, and mixed strings that don't start with an Arabic letter get a leading U+200F to avoid BiDi reordering. Putting U+200F before an Arabic letter makes the firmware draw the next letter in its final form, so `rtl()` skips those strings.
- **On-watch settings:** long-press the face → Edit. Nine slots:
  - **Hijri:** offset −2…+2, each also offered with the day starting at Maghrib
  - **Digits:** Arabic or Latin (on the clock)
  - **Extra Fajr** (right half of the Gregorian line) and **Extra Isha** (left half): off, 18°…12° (Fajr also has 14.6°), or custom
  - **Iqama presets** (on the next-prayer line)
  - **Method** (on the grid)
  - **Extras 1–3** (on the extras row)

  **How the slots work:**
  - They use `WATCHFACE_EDIT_GROUP` with custom edit types (≥ 100000), and each slot sits on the element it changes.
  - Its previews are that element rendered with the option applied, so the edit screen looks like the face. Labels are Arabic.
  - `tools/gen-edit-assets.py` generates the previews and `lib/edit-options.js`.
  - There's no dimming mask: it greyed out the previews.
- **Location:** install `../prayer-location-app` too. Open it and tap "تحديث الموقع"; it gets a GPS fix and publishes lat/lon with `ShareTypedStorage('prayer-location')`. The face reads them with `TypedStorage(24847, 'prayer-location')` from `@zos/share-storage` (API 3.0) each time it wakes. Until then it uses Cairo and shows "• القاهرة" next to the date. The appId in `lib/location.js` must match the companion's `app.json`.
- **Device notes:**
  - Per Zepp's device list, the Bip Max has **no SecondaryWidget/shortcut-card support**.
  - `zeus create` only offers API levels up to 4.0.
