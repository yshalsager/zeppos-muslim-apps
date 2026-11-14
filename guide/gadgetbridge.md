# Gadgetbridge

[Gadgetbridge](https://gadgetbridge.org/) talks to Zepp OS watches without the Zepp app and without an account. Apps that should work for its users need a few design choices.

## What Gadgetbridge gives an app

From its [Zepp OS page](https://gadgetbridge.org/basics/topics/zeppos/), checked November 2026:

- **Installing `.zab` files.** Open the file with Gadgetbridge; it picks the package for the paired watch.
- **Weather** for one location, which the firmware passes to apps and faces like the Zepp app's weather.
- **No app-side code.** Zepp OS apps can include JavaScript that runs inside the Zepp phone app (the "side service": fetch, phone settings pages, messaging). Gadgetbridge doesn't run it, and answers the watch's HTTP requests only for weather.
- **No settings app.** Settings pages that live in the Zepp app aren't available; put settings on the watch.

Watch-to-phone messages for third-party apps are in progress: [PR #7290](https://codeberg.org/Freeyourgadget/Gadgetbridge/pulls/7290) (open when checked on 2026-11-13) passes messages between a watch app and an Android app through Gadgetbridge's Intent API. Full side-service support is tracked in [issue #3266](https://codeberg.org/Freeyourgadget/Gadgetbridge/issues/3266). Gadgetbridge development is on Codeberg; the GitHub mirror is outdated.

## Designing for it

- **Make everything work offline, on the watch.** Calculations, data (ship it as asset files) and settings (`LocalStorage` on the watch).
- **Share data between your own apps on the watch** with `ShareTypedStorage` / `TypedStorage` (see [watch faces](watch-faces.md)), not through the phone.
- **Location comes from the watch** (`Geolocation` in `@zos/sensor`, which needs GPS) or from the user: a city list or coordinates entered on the watch.
- **Release the `.zab` on GitHub (or elsewhere)** for people who don't use the store. Prune it first (`zeus prune --ip`, see [build and tooling](build-and-tooling.md)).

## Small things

- **Reply suffix (watch).** Gadgetbridge adds " (canned reply)" to replies sent from the watch. It's set in the device's settings → Calls and notifications → Replies → Common suffix.
- **Custom keyboards work for replies (watch).** A keyboard app installed on the watch was offered for notification replies through Gadgetbridge, and the text arrived intact.
- **No console.** `console.log` output isn't visible; show debug values on screen, or use the simulator.
