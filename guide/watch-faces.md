# Watch faces

Notes for faces written in JavaScript (`@zos/ui`, API 3.0), as opposed to faces made in a designer tool.

## Lifecycle

- **`build()` runs once per instance (docs, watch).** The normal face, the always-on display and the Edit screen are separate instances; `getScene()` (`@zos/app`) returns `SCENE_WATCHFACE`, `SCENE_AOD` or `SCENE_SETTINGS`. Build only what each needs: our always-on instance creates 14 widgets instead of 68.
- **Timers stop while the screen is off (watch).** `Time.onPerMinute` and `setTimeout` don't fire then. Catch up on wake with a `WIDGET_DELEGATE` whose `resume_call` runs a full refresh.
- **Write properties only when they change.** Every `setProperty` redraws the widget. A small memo in front of `setText` / `setColor` / visibility took our per-minute writes from about 70 to under 5; on the always-on display that is power saved every minute.
- **Create rarely used parts on first use (watch).** A menu or extra pages built on the first tap instead of in `build()` make every face start cheaper. See the tap-order rule below.
- **Rebuilding at run time works (watch).** Deleting every widget (`deleteWidget`) and building again inside a `setTimeout(0)` (after the tap that triggered it) switches language or layout direction without reloading the face.
- **Use the `Time` sensor for the timezone.** Comparing its local fields with UTC follows daylight saving; a fixed offset doesn't.

## Always-on display

- **`lockscreen: 1` is required (watch).** A face's own always-on layer (`show_level: ONLY_AOD`) only appears with `"lockscreen": 1` in `app.json`'s `module.watchface`. With 0, the watch draws its own system always-on face instead.
- **Few lit pixels (docs).** Zepp's [screen-off spec](https://docs.zepp.com/docs/designs/specifications/screen-off-mode/) asks for at most 10% of pixels lit: dim text, no fills.

## Taps

- **No images needed.** An `IMG` with only `x`, `y`, `w`, `h` (no `src`) and `CLICK_DOWN` / `CLICK_UP` listeners is an invisible tap area of any size (watch: Bip Max; simulator: Active Edge on API 3.5 and Bip 6). `BUTTON`s need images, and a transparent image still costs `w × h` bytes on the watch.
- **Don't use an alpha-0 `FILL_RECT` for taps.** It works on API 4 watches (watch: Bip Max), but API 3.5 firmware ignores `alpha` (simulator: Active Edge), although the docs list it from API 3.0. The tap areas, created last so they sit on top, then cover the face in black.
- **Count only quick, still taps.** Accept a tap only if `CLICK_UP` comes within about 600 ms and 24 px of `CLICK_DOWN`; long press (face picker) and swipes then still reach the system.
- **The last widget created takes the taps (watch).** A widget created after a tap area covers it, even an always-on widget that isn't showing. Create tap areas last, and recreate them after building anything new on top.
- **Keep taps away from the bottom edge (watch).** Taps in the bottom ~60 px of the Bip Max were taken as the start of the swipe-up gesture.
- **Faces can open system apps (watch).** `launchApp({ appId: SYSTEM_APP_WEATHER, native: true })` from `@zos/router` (also `SYSTEM_APP_STATUS`, `SYSTEM_APP_HR`) works from a face with no extra permission.

## What a face can't do

Tested on the watch, these did nothing in a face:
- `onGesture` and `onKey` from `@zos/interaction` (swipes, the physical button);
- telling swipes apart by the `CLICK_DOWN` → `CLICK_UP` coordinates on a tap area: the system takes the swipe first.

So in-face menus have to be tap-only: page with ▲ / ▼ rows, and make the title row "back".

## Storage and data

- **`LocalStorage` works in a face on API 4 (watch: Bip Max)** with the `device:os.local_storage` permission. Without the permission it fails silently.
- **But not on API 3.5 (simulator: Active Edge):** `new LocalStorage()` throws "not a function" in a face, though the docs list it from API 3.0. Fall back to a file in the face's data folder with `@zos/fs` (`openSync` / `writeSync` / `readSync` / `statSync`). There's no UTF-8 encoder, so escape non-ASCII characters in the JSON (`\uXXXX`) and write one byte per character.
- **Faces can read data from another app (watch: Bip Max).** An app publishes with `ShareTypedStorage` (`@zos/storage`), and the face reads it with `TypedStorage(appId, key)` from `@zos/share-storage`. On API 3.5 (simulator: Active Edge) `@zos/share-storage` isn't there at all in a face, so treat shared data as optional.
- **Faces can read their own asset files (watch).** See [size and performance](size-and-performance.md).
- **Weather (watch):** let the firmware draw it. `IMG_LEVEL` with `type: data_type.WEATHER` (one image per Zepp weather code) and `TEXT_IMG` with `WEATHER_CURRENT` both work. Reading the forecast through the old `hmSensor` weather sensor gave nothing on the Bip Max.
- **Health and battery values:** the sensors in `@zos/sensor` (`Step`, `HeartRate`, `Battery`, `Calorie`) work in a face.

## Edit slots

- **Edit groups (`WATCHFACE_EDIT_GROUP`)** are the face's long-press → Edit settings. Custom types (`≥ 100000`) can hold any option list; read the current choice in `build()`; changing a slot rebuilds the face.
- **Every option needs a preview image, stored uncompressed (build).** A slot with 13 options at 400 × 144 cost 880 KB on the watch. Keep slots for visual choices with few options, make previews only as big as the element they change, and move calculation settings into an in-face menu stored in `LocalStorage`.
- **Focus frames cost too.** Each slot size needs its own select frame (`w × h`). The unselected frame can be one tiny transparent image shared by every slot (watch); an outline on every slot just clutters the Edit screen.
- **Previews that look like the face work best:** render the element with the option applied, in the face's language.
