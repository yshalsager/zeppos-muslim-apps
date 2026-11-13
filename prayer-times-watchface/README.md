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
   - optional extra Fajr / Isha at angles you set in the face menu (12°–20°, in 1° or 0.1° steps, e.g. 14.6°). An extra equal to the method's own angle is hidden, e.g. 12° under UIOF.
3. **أوقات النهي (prohibited times):** from Fajr, sunrise to sunrise + 10/15/20 min, the minutes before noon, after Asr, and from the sun at +5° to sunset. The current window is red.

The event definitions follow the Suntimes Prayer Times add-on (`AddonEvents.kt`, `DaysMonthBuilder.kt`).
- **Asr school** (face menu → العصر): the majority (shadow ratio 1×, 10 minutes before noon) or Hanafi (2×, 5 minutes).

**Iqama:** between a prayer's adhan and its iqama, the countdown line turns gold and reads "إقامة العشاء بعد ٧ د" (iqama of Isha in 7 min). The prayer stays highlighted until the iqama.
- **Minutes** are set per prayer in the face menu (الإقامة); 0 = no iqama countdown for that prayer. The "قالب" row fills them from a preset (Fajr, Dhuhr, Asr, Maghrib, Isha):
  - none
  - short: 10, 10, 10, 5, 10
  - standard: 20, 15, 15, 10, 15
  - long: 30, 20, 20, 10, 20
- **Jumu'ah:** Friday Dhuhr uses its own iqama minutes (0 = no countdown).

**Methods** (face menu → طريقة الحساب): Egyptian, Umm al-Qura, MWL, Karachi, ISNA, Dubai, Kuwait, Qatar, Singapore, Turkey (Diyanet), Tehran, UIOF (12°/12°), Moonsighting Committee. The method screen's title shows today's Fajr and Isha with the highlighted method, so you can compare before closing.
- **Automatic** (the default) picks the method from the country of the city picked on the face (`lib/methods.js`): Umm al-Qura for Saudi Arabia, Yemen, Bahrain and Oman; Egyptian for Egypt, Sudan, Libya and the Levant/Iraq; Karachi for Pakistan, India, Bangladesh and Afghanistan; Singapore for Malaysia, Indonesia and Brunei; Turkey, Tehran, Dubai, Kuwait, Qatar, ISNA (US/Canada), UIOF (France), Moonsighting Committee (UK); MWL everywhere else. The companion app's GPS fix has no country, so it keeps the last picked city's (Egypt until one is picked).

## How it works

```
config.js defaults ───────────┐
face menu (own storage) ──────┤
edit-slot choices (looks) ────┼──► settings S (method: auto → by country; 12/24h: the watch's)
lat/lon/country (city / app) ─┘        │
                                       ▼
Time sensor ──► date + timezone ──► dayEvents() × yesterday / today / tomorrow   lib/prayer.js
                                       │  cached until date, location, timezone, method or 12/24h change
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
  - creates page 0, the tap areas, the AOD layer and the edit slots (pages 1–2 and the menu are created on first use). The always-on screen runs its own instance (`getScene() === SCENE_AOD`), which creates only the edit slots and the 4 AOD texts.
  - runs a full refresh
- **Every minute:** `Time.onPerMinute` updates the clock, Hijri date, countdown, progress bar and colours, the extras row, and whichever page is visible. Prayer events come from the cache. Every text, colour and visibility write goes through `setText` / `setColor` / `show`, which skip values that haven't changed, so a typical minute costs ~4 widget writes (2 on the always-on screen) instead of ~70.
- **New day:** `Time.onPerDay` forces a full refresh.
- **Wake:** a `WIDGET_DELEGATE` `resume_call` returns to page 1 and runs a full refresh. Timers don't fire while the screen is off, so this catches up the minutes and re-reads the location. The picked city is kept in memory, and the weather forecast is re-read at most every 30 minutes.
- **Full refresh:** re-reads location, timezone and the watch's 12/24h setting, re-resolves the settings, and only recomputes events when the date, location, timezone, method or clock format has changed. Waking normally costs no prayer maths.

**Settings:** `S = config.js defaults ← face settings ← Edit-slot values` (`lib/settings.js`), plus lat/lon from the city picked on the face or the location app (whichever was set last). Each setting has one home:
- **Face menu** (tap the date line, marked with ⚙): **what the face calculates.** Location, method (automatic by country, or one of 13), Asr school, Hijri offset (−2…+2) and day start, iqama minutes per prayer plus Jumu'ah (0–60, with presets), extra Fajr/Isha angles (12°–20°, 1° and 0.1° steps), sunrise window (10/15/20 min), per-prayer minute adjustments (±30) and 12/24h (follows the watch by default, `getTimeFormat()`). The first page holds location, method, Hijri and iqama. Values are saved as one JSON in the face's `LocalStorage` and applied when the menu closes; `config.js` only holds their defaults.
- **Edit slots** (long-press → Edit): **how it looks.** Digits and the three extras cells. Changing a slot rebuilds the face.

![Settings menu: main list, method with today's Fajr and Isha, a value screen, and a location index](../docs/watchface/menu.png)

**Face menu:** `watchface/menu.js` is a generic overlay whose widgets are created on the first tap (not in `build()`) and reused for every screen; `watchface/screens.js` defines the screens. While it's open the page and date tap targets are hidden; waking the screen closes it.
- **Lists:** 4 rows of 68 px that touch, so every pixel of a row is tappable. ▲ / ▼ page through, with a counter (٢/٥) next to ▼. Back is the title row, marked ▶ (it closes the menu at the top level). Nothing tappable sits in the bottom ~60 px: taps there got mistaken for the watch's swipe-up gesture.
- **Values** (iqama minutes, angles, adjustments, Hijri offset): the row opens a value screen with the number large in the middle and big − / + buttons on either side; angles add a 0.1° row underneath.
- **Long location lists** (over 3 pages) open on an index of 4 ranges named by their first and last entry ("أذربيجان … بنغلاديش"); a range that's still long gets its own index, so Punjab's 117 cities take 2 index taps and at most 2 pages.
- **Feedback:** the pressed row or button flashes dark grey (one shared highlight `FILL_RECT`, moved under the tap area on touch down).

**Pages:** pages 1 and 2 are created on the first tap away from page 0 (most face loads never leave it); after that, switching pages only toggles visibility. Widgets created later sit on top and take the taps, so the lower half's tap areas are recreated above the new pages, and opening the menu returns to page 0 first. An invisible tap area over the grid and extras row cycles the pages. On page 0, tapping weather opens the Weather app, steps or calories open Activity, and heart rate opens Heart Rate (`launchApp` with the API 3.0 system app IDs). The battery cell just cycles the pages. Tap areas are alpha-0 `FILL_RECT`s with `CLICK_DOWN`/`CLICK_UP` listeners, so no images are needed. Only a quick, still tap counts, so a long press still opens the face picker.

**Always-on display:** a separate `ONLY_AOD` layer shows the Hijri date, the time, the Gregorian date line and the next-prayer line in dim grey with no fills (few lit pixels). It's updated by the same refresh as the normal layer.

**Weather:** the current temperature is drawn by the firmware (`TEXT_IMG` + `WEATHER_CURRENT`). Watchface JS can only read the daily forecast, which supplies the condition word.

## Font

Arabic text (dates, names, labels) uses **Prayer Face Naskh**, a 64 KB subset of SIL's [Scheherazade New](https://software.sil.org/scheherazade/) 4.500 Medium. The clock and times stay in the system font, and `arabicFont: null` in `config.js` switches everything back to it.
- **Digits:** the font's digits (Latin and Arabic-Indic) and the punctuation around them (`/ : . % ° ٪`) come from [Noto Sans / Noto Sans Arabic](https://fonts.google.com/noto) Medium (OFL 1.1). Every number on the face is then sans, matching the system-font clock and times, instead of mixing in Scheherazade's serif numerals.
- **Presentation forms:** Zepp OS shapes Arabic by converting letters to Arabic Presentation Forms-B code points. Scheherazade has none of these, so `tools/gen-font.py` adds them, built with HarfBuzz from the font's own shaping. Lam-alef and similar forms are composite glyphs.
- **License:** Scheherazade New is under the SIL Open Font License 1.1. A subset counts as a Modified Version and "Scheherazade" / "SIL" are Reserved Font Names, so the subset is renamed. SIL's copyright and license records stay inside the font, and the license text is in `fonts/OFL.txt` (Noto's copyright is in `fonts/NOTICE`). Noto Sans is from google/fonts `ofl/notosans` and `ofl/notosansarabic`.
- **Adding new Arabic text:** the subset only contains characters found in `watchface/` and `lib/`, so a new string can show missing glyphs. Regenerate it after adding one:
  `mise run :gen` (or `:build`).

## City list

`assets/bip-max/cities/` holds **4,997 cities in 241 countries** (161 KB): `index.json` (world regions → countries) plus one `<CC>.json` per country, either `{cities: [[name, lat, lon], …]}` or `{regions: [[region, [[name, lat, lon], …]], …]}`, with lat/lon in whole hundredths of a degree (~1 km, under 3 s of prayer time). The face menu reads them with `@zos/fs` only when you open the location screens, so they cost nothing at startup.
- **Source:** [GeoNames](https://www.geonames.org/) `cities15000` (CC-BY 4.0). Arab League countries keep every city ≥ 15k people, other Muslim-majority countries ≥ 50k, the rest of the world ≥ 250k, plus every capital.
- **Arabic names:** GeoNames `alternateNamesV2`, then the Arabic label of the place's Wikidata item (CC0) where GeoNames has none. Diacritics are dropped, and Persian letter forms are mapped to Arabic ones (ی→ي, ک→ك, ڤ→ف). A name is kept only if the font shapes every letter; otherwise the plain-ASCII English name is used. About 54% of cities, all countries and most governorates have Arabic names. The Maghreb has the most gaps (Morocco ~25%). Fixes go in `OVERRIDES` in `tools/gen-cities.py`.
- **Navigation:** countries with more than 15 cities get a governorate/state step. Lists are alphabetical, ignoring a leading "ال". Admin prefixes like "محافظة" are dropped.
- **Regenerate:** `mise run :gen-cities` downloads ~210 MB from GeoNames (it changes daily, so this isn't part of `:build`). It queries Wikidata once for missing names (cached in `.cache/geonames/`), rewrites the files and regenerates the font. The output is committed.
- **Reading on the watch:** `lib/city-data.js` tries `readFileSync('assets://…')` (API 3.0) first, then `openAssetsSync` + `readSync` with a small UTF-8 decoder (`lib/utf8.js`).

## Layout

```
watchface/index.js         ← UI (normal + AOD + edit slots), lifecycle and refresh (see How it works)
watchface/menu.js          ← face menu overlay (rows, steppers, paging, back)
watchface/screens.js       ← face menu screens: location, adjustments, iqama, angles, 12/24h, sunrise window
config.js                  ← defaults (fallback location, and defaults for the face-menu settings)

lib/prayer.js              ← adhan-js wrapper (npm, MIT, bundled by zeus) → local minutes; night portions, makruh windows
lib/countdown.js           ← countdown line: next prayer, iqama, progress, last 10 min, last third of the night
lib/hijri.js               ← Hijri conversion (Umm al-Qura table + tabular fallback)
lib/hijri-table.js         ← GENERATED month-length table, 1440–1500 AH
lib/settings.js            ← face settings: defaults, sanitizing, steppers, iqama presets, precedence with edit slots
lib/methods.js             ← method names for the menu and the automatic method by country
lib/store.js               ← JSON values in the face's LocalStorage
lib/location.js            ← newest of the picked city and ../prayer-location-app's fix
lib/city-data.js           ← reads the city files on demand (@zos/fs); lib/utf8.js decodes them
assets/bip-max/cities/     ← GENERATED city list: index.json + one <CC>.json per country (tools/gen-cities.py)
lib/extras.js              ← extras-row sensors (steps, heart rate, battery, calories) + weather condition
lib/edit-options.js        ← GENERATED on-watch edit slots (tools/gen-edit-assets.py)

tools/gen-hijri-table.mjs  ← regenerates the Hijri table from Node's ICU calendar
tools/gen-edit-assets.py   ← edit-slot previews, runtime icons/digits, lib/edit-options.js
tools/gen-preview.py       ← renders assets/bip-max/icon.png (picker preview, 294×350) from the real layout
tools/render.py            ← shared drawing for the above (layout boxes mirror watchface/index.js)
tools/uax9.py              ← Unicode bidi runs for render.py (what FriBiDi does inside libraqm)
tools/preview-data.mjs     ← sample face data for the previews, computed by lib/
tools/gen-docs.py          ← README screenshots in ../docs/watchface/ (scenes from tools/docs-data.mjs)
tools/gen-cities.py        ← city list from GeoNames (`mise run :gen-cities`, not part of :build; tools/fetch-geonames.sh downloads ~210 MB)
tools/gen-font.py          ← builds the Naskh subset (see Font); tools/fetch-fonts.sh downloads its pinned sources

test/verify.mjs            ← Hijri vs ICU; prayer wrapper vs adhan in Africa/Cairo; event windows; countdown logic; face-menu settings
```

## Build / install

The repo is a mise monorepo: shared tools are in the root `mise.toml`, and this folder's tasks are in `./mise.toml`. Run them from this folder, or from anywhere in the repo as `mise run //prayer-times-watchface:build`.
```sh
mise run :build            # fonts + generated assets → tests → lean dist/*.zab (~335 KB)
mise run :build-store      # same, but keeps zeus's source archive (for a Zepp store submission)
mise run :gen              # only regenerate (Hijri table, font, edit previews, picker icon)
mise run :test             # only the math/countdown checks
```
- The Python generators run under `uv` with pinned wheels, and need no system libraries or fonts. Arabic is shaped by HarfBuzz (`uharfbuzz`) and drawn by FreeType (`freetype-py`), with `tools/uax9.py` ordering the left-to-right and right-to-left runs (the Unicode bidi algorithm). Pillow's own Arabic support would need `libraqm`, which its macOS wheel lacks. Text the watch draws in its system font uses Noto Sans / Noto Sans Arabic as a stand-in.
- The images come out pixel-identical on macOS and Linux.
- The source fonts are downloaded to `.cache/fonts/` at pinned versions and verified by checksum.
- **Lean vs store builds:** `zeus build` adds `.ip-package` to the `.zab`, a copy of the project source (~75% of its size) that lets the Zepp store rebuild for other devices. It never reaches the watch. `:build` removes it with `zeus prune --ip` for Gadgetbridge sideloading and releases; `:build-store` keeps it.

Install:
```sh
zeus build                 # → dist/*.zab (what :build runs, followed by `zeus prune --ip`)
zeus preview               # QR code → scan from Zepp app (Developer Mode) to install on watch
# or: zeus bridge  →  connect / install   (Zepp app Developer Mode → Bridge on)
```

Gadgetbridge can also install a `.zab`/`.zpk` directly: open the file with Gadgetbridge (the File Installer).

**Simulator:** `mise run simulator`, boot the Bip Max image, then `zeus dev` here. The emulator clock runs on UTC, so prayer times look shifted there.

## Verify the math

```sh
mise run :test                  # or: pnpm install && pnpm test; also try TZ=Pacific/Auckland pnpm test
```
The Hijri dates match ICU `islamic-umalqura` on every day from 2018 to 2077. The prayer wrapper's timezone/DST conversion matches adhan's own output formatted for Africa/Cairo, for every method, both Asr shadow ratios, and any host timezone. adhan reads only the input Date's local Y/M/D and returns absolute instants. The face converts those with the offset it derives from the `Time` sensor, so it doesn't depend on QuickJS's `Date` timezone support.

## Notes / findings

- **API level:** the Bip Max reports API_LEVEL 4.4 (Zepp OS 5). The package targets 3.0 so that it can use `@zos/ui`, `@zos/sensor` `Time.onPerMinute`/`onPerDay`, `show_level` (normal / AOD / edit layers), `@zos/share-storage` and `WIDGET_DELEGATE`.
- **Timezone and DST:** these come from the `Time` sensor (local fields compared with UTC). This follows Egypt's summer time automatically. A fixed offset such as `tzOffsetHours = 2` would be wrong in summer.
- **Hijri:** Egypt follows moon sighting (Dar al-Ifta), so it can differ from Umm al-Qura by ±1 day. Correct this in the face menu (التاريخ الهجري: offset −2…+2, and whether the day starts at Maghrib); its title shows the resulting date as you change it.
- **Fine-tuning:** if a printed local calendar differs by a minute or two (Egypt's published times often add precaution minutes), use the `adjust` minutes.
- **Arabic:** the firmware shapes Arabic itself (see Font). Names and times are in separate TEXT widgets, and mixed strings that don't start with an Arabic letter get a leading U+200F to avoid BiDi reordering. Putting U+200F before an Arabic letter makes the firmware draw the next letter in its final form, so `rtl()` skips those strings.
- **Edit slots:** long-press the face → Edit. Four slots: **Digits** (Arabic or Latin; the slot is just the clock digits' box) and **Extras 1–3** (on the extras row).
  - They use `WATCHFACE_EDIT_GROUP` with custom edit types (≥ 100000), and each slot sits on the element it changes. Its previews are that element rendered with the option applied, so the edit screen looks like the face. Labels are Arabic.
  - `tools/gen-edit-assets.py` generates the previews and `lib/edit-options.js`.
  - Every preview and frame is stored uncompressed on the watch (~w×h bytes), which is why calculation settings moved to the menu: their 6 slots were ~0.7 MB of previews of a sample day. Only the focused slot gets an outline; unfocused slots share one tiny transparent image. There's no dimming mask: it greyed out the previews.
- **Location:** tap the date line → الموقع: region of the world → country → governorate/state (for countries with more than 15 cities) → city, paged with ▲/▼. The choice is saved in the face's own `LocalStorage` and shown after the date. "الموقع من التطبيق" clears it. For GPS, install `../prayer-location-app`, open it and tap "تحديث الموقع"; it publishes lat/lon with `ShareTypedStorage('prayer-location')`, which the face reads with `TypedStorage(24847, 'prayer-location')` (API 3.0) each time it wakes. Whichever of the two was set last wins. Until either exists the face uses Cairo and shows "• القاهرة" next to the date. The appId in `lib/location.js` must match the companion's `app.json`.
- **Device notes:**
  - Per Zepp's device list, the Bip Max has **no SecondaryWidget/shortcut-card support**.
  - `zeus create` only offers API levels up to 4.0.
