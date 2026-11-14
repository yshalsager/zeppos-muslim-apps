# Multiple devices

## Device ids and targets

- **Each watch model has several device ids (`deviceSource`)**, one per region or variant (docs). Zepp's [device list](https://docs.zepp.com/docs/reference/related-resources/device-list/) gives them with each model's screen, shape, corner radius, API level and picker preview size; the store can know extra ids the list doesn't show, which [Zepp Explorer](https://ze.mmk.pw/catalog/)'s device list reveals. List every id, or the store won't offer the app on that variant.
- **One `app.json` target per screen size, not per model (build).** A target names its module and lists `platforms` (`{ name, deviceSource }`) for every id it covers. Watches with the same screen can share a target: Bip 6, Active 2 (Square), Active, GTS 4 and Cheetah (Square) are all 390 × 450 and use the same assets.
- **Each target has its own `assets/<target>/` folder (build).** zeus packs only that folder into the target's packages. Generated images go there per target; shared files (fonts, data, notices) have to be copied in. See the symlink note in [build and tooling](build-and-tooling.md).
- **API level decides which watches are possible.** Our projects target API 3.0, which rules out older models on Zepp OS 1–2 (Bip 5, GTS 4 mini, GTS 3, Band 7). Custom keyboards need API 4.2, which leaves only the Bip Max, Bip 6 and Active 2 (Square) among the rectangular watches; Active, GTS 4 and Cheetah (Square) stop at 3.6 (docs). Check the device list before promising a model.
- **The Bip Max special case (watch, docs).** Inside an app or widget built without `"_pikeCompatibled": 1` in `app.json`'s `app` section (plus `dw: 432` on the platform), `getDeviceInfo()` on the Bip Max reports 390 × 450, the size of older watches. With it, it reports the real 432 × 514. Check what your target receives before laying out from it.

## One design, many screens

What worked for a rectangular face:

- **Keep every box in one module** (`lib/layout.js`), written for one design screen. Other screens get it scaled: x by width, y by height, and text sizes and icons by the smaller of the two, so text never grows wider than its box. The design screen itself isn't scaled, so it stays pixel-exact.
- **Read the real screen size at run time** with `getDeviceInfo()` and build the layout from it. It needs the `data:os.device.info` permission in `app.json`; without it the call throws `PERMISSION DENIED` (simulator). If your fallback is the design size, the design screen still looks right and every other screen is silently unscaled, so test the fallback path and check the permission in a test. Watch for fixed pixel sizes that only fit the design screen: a strip of 7 × 56 px keys (392 px) or a page laid out down to y = 480 overflows 390 × 450.
- **Generate every target's images from the same boxes.** The image tools read the layout through a small Node script, so icons, edit previews and screenshots match each screen.
- **Check every target in tests:** each `devices.json` entry has an `app.json` target and an asset folder, and every box fits its screen.
- **One design per shape.** Rectangles of similar proportions (432 × 514, 390 × 450, 320 × 380) scale well from one design. Round screens need their own; see [Round screens](#round-screens).
- **Small screens shrink everything.** At 320 × 380, 26 px text becomes 19 px and 68 px menu rows become 50 px. Check readability and tap sizes, in the simulator at least.
- **Measured text doesn't scale exactly.** Width estimates made at one size hold at another only roughly (fonts are hinted per size). Leave some margin.

## What adding a target costs

- **Nothing per watch (build).** Each watch installs only its own package, about the same size as before; smaller screens get smaller images.
- **A bigger `.zab`.** The file you sideload or attach to a GitHub release bundles every package: ours went from 0.3 MB (one package) to 1.5 MB (five) to 3.9 MB (thirteen, with the round targets). Gadgetbridge and the store pick the right one by device id; we have seen the store do it, not Gadgetbridge.
- **A much bigger store upload.** The store build keeps zeus's source copy (`.ip-package`), which holds every target's assets: ours is 6.5 MB, of which 2.6 MB is the source copy. We don't know whether the store has a size limit.
- **Testing.** A model nobody has tried is a guess. Mark untested targets as such, and use the simulator, which includes most models.

## Round screens

Our watch face has a round design since November 2026. Its layout, tests and screenshots are checked (build); it hasn't run on a round watch yet.

### Which watches

Round models at API 3.0 and up, from Zepp's device list (docs):

| Screen | Models | API |
|---|---|---|
| 480 × 480 | Balance 3, Balance Ultra, Cheetah 2 Ultra, T-Rex Ultra 2, Active Max, T-Rex 3 Pro 48 mm, Balance 2, T-Rex 3, Balance, Cheetah Pro | 3.6–4.4 |
| 466 × 466 | Cheetah 2 Pro, Active 3 Premium, T-Rex 3 Pro 44 mm, Active 2 (Round), GTR 4 | 3.6–4.3 |
| 454 × 454 | Cheetah (Round), T-Rex Ultra | 3.6 |
| 416 × 416 | Falcon | 3.6 |
| 360 × 360 | Active Edge | 3.5 |

- **Below API 3.0:** GTR 3, GTR 3 Pro, GTR Mini and T-Rex 2.
- **Custom keyboards (API 4.2)** leave only the first 7 of the 480 models and the first 4 of the 466 ones.
- **The store knows more ids than the device list:** extra ids for Balance 3, Balance Ultra, Cheetah 2 Ultra, Cheetah Pro, Active 2 (Round) and GTR 4, and the Balance 2 XT (480) isn't in the list at all. The T-Rex Dual Solar (456 × 456) is in the store but not the device list; we left it out until its preview size is documented.
- **Picker previews are square** (docs): 324 for 480, 314 for 466, 306 for 454, 280 for 416, 243 for 360.

### Layout

- **Pick the design by `width === height`.** Every round Zepp OS screen is square in pixels, and none of the rectangular ones in the device list is, so the screen size alone tells them apart. (`getDeviceInfo()` also returns a `screenShape` field (docs), which we haven't used.)
- **Design once at 480 and scale evenly** (the same factor for x, y and text). 360 is 0.75 of 480, so 28 px times become 21 px; that was still readable in our renders. Physically the gap is smaller: the smaller round screens also have physically smaller displays, so text ends up roughly 10–15% smaller than on a 480 watch, not 25% (our estimate from published screen diagonals).
- **Size each box to the circle at its height.** The usable width at height `y` is `2·√(r² − (y − r)²)`: about 300 px at y = 50 on a 480 screen, 480 at the middle, 320 at y = 420. A row near the top or bottom must be narrower than one in the middle. For lists, compute each row's width from its own height.
- **Test it:** every drawn box's corners stay inside the circle, allowing a pixel or two for rounding when scaling down. Tap areas and full-screen backgrounds may reach past it; the glass ends there anyway.
- **Keep the same pages and rows as the rectangle.** Narrower boxes and slightly smaller text were enough for us to keep the 3 × 2 prayer grid, three extras cells and a 4-row menu on 480 down to 360. On a 480 screen: times 28 px (32 on the Bip Max), labels 20 px (24), menu rows 58 px (68).
- **Move corner items inward.** Things that sat in a rectangle's corners (a menu's back arrow, a page counter beside ▼, a settings icon at the end of a line) go just inside the curve, next to the text they belong to.
- **Keep the bottom free.** As on the rectangle, nothing tappable in the bottom ~60 px; on a circle that strip is narrow anyway.
- **Mirroring for right-to-left still works:** `x → width − x − w` on a layout centred on the screen.

### Tools and checks

- **Width checks run per design.** If you shorten text by estimated widths (see [text and languages](text-and-languages.md)), check the fit on the round design's boxes too: they are narrower relative to their text size. Ours needed 2 px more reserve for cut Arabic names.
- **Screenshots:** a circle is a rounded rectangle with radius = width / 2, so the same renderer draws both shapes. Render each new target's pages and menus and look at them before trying a watch; it catches most clipping. Our renderer takes the target from an environment variable (`ZOS_TARGET`).
- **Simulator:** test the smallest round screen first (Active Edge, 360). If it looks right there, the larger ones usually do too.
