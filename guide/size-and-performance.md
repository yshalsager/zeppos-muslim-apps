# Size and performance

## Where the bytes go

A `.zpk` is a zip, but the watch stores what's inside it **uncompressed**, after zeus has converted it:

- **Images (build):** every PNG becomes an 8-bit palette TGA without compression: `width × height` bytes plus a ~1 KB palette, whatever the picture. A fully transparent 400 × 216 tap image costs 87 KB. zeus skips images smaller than 3 × 3.
- **JavaScript (build):** compiled to QuickJS bytecode (`index.bin`), loaded on every start. Minifying before compiling saved only 8% for us; zeus 1.10.0's `--compress` didn't change the output.
- **Fonts and data files** are stored as they are.

Our face, per watch, after the trims below: ~300 KB to download, 820 KB on the Bip Max (634 KB on a 360 × 360 round watch, whose images are smaller).

| Part | On the watch |
|---|---:|
| City list (data files, 5,000 cities) | 227 KB |
| Edit slot previews and frames | 203 KB |
| `icon.png` (face picker preview; zeus resizes it to the device's preview size) | 107 KB |
| `index.bin` (all code) | 88 KB |
| Font | 69 KB |

## What helped

- **Taps without images:** `IMG`s with a size and no `src` instead of transparent `BUTTON` images (−132 KB). (We first used alpha-0 `FILL_RECT`s, which API 3.5 firmware draws black; see [watch faces](watch-faces.md).)
- **Fewer, smaller Edit previews:** calculation settings moved from Edit slots into the face's own menu (−700 KB); previews cropped to the element they change; one shared transparent image for unfocused slots.
- **Shared frames:** slots of the same size use the same focus frame files.
- **Data as asset files, not code:** a list compiled into the bundle is parsed at every start. Moved to JSON files, our city list cost nothing until the menu opened, and took 14 KB off the bytecode.
- **Compact data:** coordinates as whole hundredths of a degree, entries nested under their region instead of repeated: 190 → 161 KB.

## Reading asset files on the watch

```js
import { readFileSync, openAssetsSync, readSync, closeSync, statAssetsSync } from '@zos/fs'

// API 3.0: the assets:// prefix (reads assets/<target>/cities/EG.json)
const text = readFileSync({ path: 'assets://cities/EG.json', options: { encoding: 'utf8' } })
```

If that throws or returns nothing, fall back to `statAssetsSync` for the size, `openAssetsSync` + `readSync` into an `ArrayBuffer`, and decode the UTF-8 yourself (there's no `TextDecoder`). Our face does both (`prayer-times-watchface/lib/city-data.js`) and reads its files on the Bip Max (watch); we haven't checked which of the two paths ran.

## What costs time and power

- **Widget count at start:** every widget is created in `build()` on every face load. Build menus and extra pages on first use.
- **Writes per minute:** every property write redraws. Skip writes that don't change anything (see [watch faces](watch-faces.md)).
- **Work on wake:** each wrist raise is a resume. Keep what you can in memory, create sensors once, and redo heavy work (calculations, file reads) only when its inputs change.
- **The always-on instance:** it runs all day. Build only its few widgets.

## Measuring

- `getPerformance()` (`@zos/app`, API 4.0, docs) returns per-file evaluation and build times and memory use. Call it guarded (`typeof getPerformance === 'function'`) if you target API 3.0.
- Gadgetbridge has no log console, so draw numbers on screen in a debug build.
- Off the watch, count widgets and writes with a Node stub of `@zos/*` (see [build and tooling](build-and-tooling.md)).
