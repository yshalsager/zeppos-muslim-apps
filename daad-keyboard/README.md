# Daad Arabic Keyboard (ضاد)

An Arabic and English keyboard for the **Amazfit Bip Max**, **Bip 6**, **Active 2** and recent round Amazfit watches such as the **Balance 2/3**, **Cheetah 2**, **T-Rex 3 Pro** and **Active 3 Premium** (Zepp OS 4.2+ custom keyboard, see [Devices](#devices)). It works offline and with Gadgetbridge, including notification replies.

## Features

- **Arabic:** the phone's (Gboard) layout in 3 rows of 11. Long-press for variants: ا → أ إ آ ٱ, ي → ئ ى, و → ؤ, ه → ة, ء → أ إ ؤ ئ, ج ك ف ب → چ گ ڤ پ, ، → ؟ ؛ . ! « » :. Keys with variants are tinted.
- **English:** QWERTY with shift (abc / Abc / ABC), a capital at the start and after `. ! ?`, a punctuation row, accents on long-press.
- **١٢٣ / 123:** digits in the current language's style (long-press a digit for the other style), tashkeel on the Arabic side, symbols.
- **رد:** greetings and replies (السلام عليكم، وعليكم السلام، جزاك الله خيرا …), then honorifics. Long-press صلى الله عليه وسلم for ﷺ.
- **Bottom row:** EN/ع switches language (long-press: pick another keyboard), ١٢٣, رد, emoji, space (long-press: next keyboard), DEL (hold to repeat, then whole words), OK. On round watches EN/ع and ١٢٣ sit at the two ends of the widest letter row instead, since the bottom of a circle is narrow.
- A magnified preview of the pressed key, a light vibration, and the last language used is remembered.

## Setup

1. Install the `.zab` (open it with Gadgetbridge).
2. Open **Daad** on the watch and tap **Keyboard settings**, or go to Settings → Preferences → Keyboard, and enable it. Only one custom keyboard can be enabled at a time.
3. Tap **Try it** on the app's screen, or reply to a notification.

Gadgetbridge adds " (canned reply)" to watch replies by default. To remove it: device settings → Calls and notifications → Replies → Common suffix.

## How it works

- `data-widget/index.page.js` is the keyboard; `data-widget/text.js` holds the pure text helpers (`test/`); `page/index.js` is the setup screen.
- **Right-to-left:** the firmware's text field draws Arabic left to right (سلام shows as ملاس), though the text it holds and sends is correct. The keyboard covers the field with a black rectangle and draws the text itself from `keyboard.getTextContext()`. The cost: the system cursor is hidden, so editing happens at the end. Details: [custom keyboards](../guide/custom-keyboards.md).
- **Screen size:** inside a keyboard, `getDeviceInfo()` reports the Bip 6's 390×450 unless `app.json` has `"_pikeCompatibled": 1` and a platform entry with `dw: 432` ([screen adaptation](https://docs.zepp.com/docs/guides/framework/device/screen-adaption/)).
- **Speed:** the firmware builds every enabled keyboard when any keyboard opens, so the keys are built on `onResume`. Each page is a cached GROUP that is shown or hidden; the other letters page is built in the background.
- **Storage:** only the last-used language, in LocalStorage (needs the permission `device:os.local_storage`).

## Devices

| Target | Screen | Watches (deviceSource) | Tested |
|---|---|---|---|
| `bip-max` | 432 × 514 | Bip Max (11206915) | on the watch |
| `square-390x450` | 390 × 450 | Bip 6 (9765120, 9765121, 10158337), Active 2 Square (10223872, 10223873, 10223875, 9830656, 9830657, 9830659) | layout in the simulator (Bip 6); not on a watch |
| `round-480` | 480 × 480 | Balance 3, Balance Ultra, Cheetah 2 Ultra, T-Rex Ultra 2, Active Max, T-Rex 3 Pro 48 mm, Balance 2, Balance 2 XT (28 ids, in `app.json`) | not yet |
| `round-466` | 466 × 466 | Cheetah 2 Pro, Active 3 Premium, T-Rex 3 Pro 44 mm, Active 2 Round (19 ids) | layout in the simulator (Active 2 Round); not on a watch |

Custom keyboards need API 4.2 ([device list](https://docs.zepp.com/docs/reference/related-resources/device-list/)). The watchface's other watches can't run one: Active, GTS 4 and Cheetah Square (API 3.6), Bip 5 Unity (3.0), and the round T-Rex 3 (4.0), Balance, Cheetah Pro and GTR 4. Device ids are the watchface's, matched to models with Zepp Explorer and the device list.

The keyboard sizes its keys from `getDeviceInfo()`, so one layout serves every screen. At 390 px a letter key is 29 px wide (33 on the Bip Max).

**Round screens** (picked by `width === height`): `lib/geometry.js` gives each row the width of the circle at its height (`span`), so the rows form an arc. The bottom ~10% stays free, rows start no higher than 22% of the height, and EN/ع and ١٢٣ move to the ends of the widest row (on the last row they'd squeeze its letters to ~23 px). Letter keys come out 27–37 px wide depending on the row, and `test/geometry.test.js` checks that every key on every page fits inside the circle and is at least 26 px wide. On the Active 2 (Round) in the simulator the system input field is about 146 px tall; the test covers 60–180 px. To add a screen: add an `app.json` target with its `deviceSource`s, copy `assets/bip-max/NOTICE.txt` into `assets/<target>/`, and run `mise run :build` (`:gen` draws the icon for every target, and the tests check both files exist).

## Build

```sh
mise run //daad-keyboard:build         # tests, icon, lean .zab in dist/
mise run //daad-keyboard:build-store   # keeps zeus's source archive, for a store submission
mise run //daad-keyboard:ci            # what CI runs: also fails if the committed icon is stale
```

`tools/gen-icon.py` draws `assets/<target>/icon.png` with Scheherazade New (fetched by `../scripts/fetch-fonts.sh`). `:gen` also writes the app ID (1136372, root `mise.toml` `[env]`) into `app.json`. Store text is in `store-listing.json`.

**Store images:** `:gen` writes the app form's images to `docs/daad-keyboard/store/`: `tools/gen-previews.py` draws `<lang>-round.png` and `<lang>-square.png` (360 × 360 on a transparent background: the round screen fills the canvas inside the circle, the Bip Max's is scaled to the full height and centred) from the real keyboard, and `tools/gen-icon.py` the 240 × 240 `icon.png`. `tools/preview-data.mjs` runs `data-widget/index.page.js` on stub `@zos` modules (`tools/zos-stub.mjs`) and lists the widgets it shows, and `../shared/text_draw.py` draws their text, with Noto Sans standing in for the system font. The input field is 132 px tall on the Bip Max, as measured on the watch, and 146 px on the Active 2 (Round) in the simulator. CI checks the committed images are up to date.

## License

[GPL-3.0](../LICENSE). The package bundles no third-party code or fonts (`assets/<target>/NOTICE.txt`).
