# Custom keyboards

From building the Daad Arabic/English keyboard ([`daad-keyboard/`](../daad-keyboard/), API 4.2 code on the Bip Max).

## The platform

- **API 4.2 or later (docs).** A keyboard is a mini app with one `data-widget` module whose `ability` is `[{ name: '<lang>', type: 2 }]`, and the permission `device:os.input.method`. The widget uses the `DataWidget()` lifecycle. [Intro](https://docs.zepp.com/docs/guides/keyboard/intro/), [keyboard API](https://docs.zepp.com/docs/reference/device-app-api/newAPI/ui/keyboard/), samples `application/4.2/simple-keyboard` and `t9-keyboard` in [zeppos-samples](https://github.com/zepp-health/zeppos-samples).
- **One keyboard per app, one enabled at a time (docs).** Several languages have to share one widget with a toggle of their own.
- **The user enables it** in Settings → Preferences → Keyboard. `keyboard.isEnabled()` and `keyboard.gotoSettings()` let the app's own page show the state and open that screen (watch).
- **The `keyboard` API (watch):** `inputText`, `backspace`, `getTextContext` (the whole field, in logical order), `sendFnKey(ENTER | SWITCH | SELECT)`, `switchInputType(inputType.EMOJI)` for the system emoji picker, `isSelected`, `getContentRect` (the input field's area at the top). `setContentRect` changes the reported rect but doesn't move the visible field.
- **No scrolling lists, `VIEW_CONTAINER`, BLE or phone messaging** in a data widget (docs).
- **It works for notification replies through Gadgetbridge (watch).** See [Gadgetbridge](gadgetbridge.md).
- **Screen size:** on the Bip Max the widget sees 390 × 450 unless `app.json` has the `_pikeCompatibled` flag. See [multiple devices](multiple-devices.md).

## Lifecycle and speed (watch)

- **Every enabled keyboard is built whenever any keyboard opens,** then paused, and resumed only when it's selected. Build the keys in `onResume` (or in `build()` when `keyboard.isSelected()` is true), not in `build()` alone, or a hidden keyboard does the work every time.
- **Cache pages as `GROUP`s.** Build each page (letters, symbols, …) once into a `GROUP` and show or hide it with `prop.VISIBLE`; switching is then instant. Children of a group use coordinates relative to the group.
- **Relabel instead of rebuilding:** shift and similar changes set `prop.TEXT` on the existing buttons.
- **Build the next page in the background** with a short `setTimeout` after the first page appears.
- **`setTimeout`, `setInterval`, `Vibrator` (`VIBRATOR_SCENE_SHORT_LIGHT`) and `LocalStorage` work in the widget.** `LocalStorage` needs the permission `device:os.local_storage`; without it reads and writes fail silently.

## Buttons (watch)

- **Press events:** `button.addEventListener(event.CLICK_DOWN | CLICK_UP | MOVE_OUT, fn)` work. Use `CLICK_DOWN` to start a repeat (held delete) and stop it on both `CLICK_UP` and `MOVE_OUT`, so a finger sliding off doesn't leave it running. `MOVE_OUT` also cancels a key preview.
- **Moving a button with `setProperty(prop.MORE, …)`** is ignored unless `x`, `y`, `w` and `h` are all passed (docs say so too).
- **`normal_color` can't be changed after creation.** Pick a key's colour when you create it.
- **Long press** is a `CLICK_DOWN` timer (~450 ms) cancelled by `CLICK_UP` or `MOVE_OUT`.

## Round screens (build, simulator)

Daad's round layout is checked by tests at 466 and 480, and in the simulator on the Active 2 (Round, 466). Not yet on a round watch.

- **Size each row to the circle** at its height (see [multiple devices](multiple-devices.md#round-screens)); the rows then form an arc. One helper, `span(y0, y1)`, returning the full width less a margin on rectangles, kept the square layouts unchanged.
- **The bottom of a circle can't hold a full action row.** Eight keys at the bottom of a 480 screen get about 30 px each. Moving two of them (language and symbols) to the ends of a letter row left six keys of about 40 px.
- **Put extra keys on the widest row,** the one nearest the middle. On the last row they squeezed its 11 Arabic letters to about 23 px; on the middle row the narrowest letters stay about 28 px.
- **Don't start the rows too high:** with a short input field, a first row near the top of the circle is narrow. Daad starts them no higher than 22% of the screen.
- **The input field takes the top third (simulator).** On the Active 2 (Round) `keyboard.getContentRect()` gives a field about 146 px tall on a 466 screen (read from where our rows start, `rect.h + 8`), so the keys get the lower two thirds.

## Labels (watch)

- **Wide glyphs scroll:** a label wider than its key slides sideways like a ticker (ض and ص at 30 px on a 37 px key). Size text to the key, e.g. `min(30, w × 0.62)`.
- **Combining marks** (tashkeel) need a base to sit on in a label; put a tatweel (ـ) before them.
- See [text and languages](text-and-languages.md) for mirrored brackets, missing symbols (⌫ ↵) and the reversed input field.

## The app's own page (watch)

- The keyboard app still has a normal page, a good place for setup steps, an "enabled" status, a settings button and a "try it" field (`createKeyboard` with `inputType.JSKB`).
- **The status bar overlaps a full-screen page;** hide it with `setStatusBarVisible(false)` (`@zos/ui`).
