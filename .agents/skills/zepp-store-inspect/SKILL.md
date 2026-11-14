---
name: zepp-store-inspect
description: Survey and inspect Zepp store apps and watch faces (Zepp OS / Amazfit) without an account. Find what exists for a device or topic, read store descriptions, supported devices and versions, and check packages for permissions and phone-side code. Use for market research, competitor checks, "does X already exist on the store", or "which apps work without the phone / with Gadgetbridge".
---

# Zepp store inspection

The Zepp store has no public API, but **Zepp Explorer** (https://ze.mmk.pw/catalog/, by melianmiko; source at https://code.mmk.pw/zepp/explorer) mirrors it for every device model and most regions, with a public JSON API. `zepp_store.py` (Python standard library only) wraps it. Run it with `python3 -I` from a scratch folder; every command writes or reads JSON files there.

## Steps

1. **Find the device:** `python3 -I zepp_store.py devices --match "bip max"` prints each matching model's `deviceSource` (the store's device id), screen size and OS version. Models often have several sources (regions, variants); look at all of them.
2. **Search:** `python3 -I zepp_store.py search search.json --type lightapp --device 11206915 prayer salah qibla …`
   - `--type lightapp` is mini apps; `--type watch` is watch faces. Run both if both matter.
   - Leave out `--device` to see what exists for other watches too; step 3's `knownDeviceSources` then tells which apps list your device.
   - **Search matches the app's name only**, in its English/default form. Use many spellings and transliterations (salah, salat, solat, namaz…) and words from the brief. Non-Latin terms rarely find anything, but try a few.
   - Results are merged by app, with the terms that found each. Re-running skips terms already done.
3. **Details:** `python3 -I zepp_store.py details details.json --from search.json --device 11206915` fetches each app's store page: description, changelog, `knownVersions`, screenshots, `firstSeen`, publisher, `knownDeviceSources` (every device it supports) and the package `downloadUrl`. With `--device`, apps that list that device are described from its own build. Use `--ids` to limit it to the relevant apps after reading the search results; searches catch plenty of noise.
4. **Packages (optional):** `python3 -I zepp_store.py packages packages.json --from details.json` downloads each package and keeps only the file list, sizes and every `app.json` inside. Nothing is extracted to disk or run.
5. **Table:** `python3 -I zepp_store.py summary --from details.json --packages packages.json --device 11206915` prints one tab-separated line per app: name, publisher, first seen, version, number of devices, whether it lists the device, size, modules, permissions.

Then read the descriptions yourself; that's where features, limits and requirements are stated. Write findings where the user wants them, with the date of the survey, the search terms and the device ids, so it can be repeated.

## Reading the results

- **Modules in `app.json`:** `page` is the watch app, `app-side` is code that runs on the phone (inside the Zepp app), `setting` is a settings page on the phone, `app-widget` / `secondary-widget` are watch widgets, `app-service` a background service. Watch faces have a `watchface` module.
- **Phone dependence:** only an `app-side` **module in `app.json`** means the app runs code on the phone. Every package contains an `app-side.zip`, because the build tool (zeus) packs one by default; its presence alone means nothing.
- **Gadgetbridge:** Gadgetbridge installs packages but doesn't run app-side code or phone settings pages. Apps whose core features need `app-side` (network data, phone GPS, phone settings) won't fully work there. Say which features depend on it when the description makes that clear.
- **What app-side code calls:** if it matters, the package results include the file list; to see which web hosts a phone-side script uses, open the nested `app-side` files as text and look for URLs. Don't run or install any package.
- **Permissions** (`device:os.geolocation`, `data:user.hd.*`, `device:os.alarm`…) show what the app reads on the watch.
- **Dates:** `firstSeen` is when the mirror first saw the app, which is close to its first release; `knownVersions` gives the version history.
- **Open source:** the store doesn't say. Search GitHub/Codeberg for the app or publisher name before saying something is or isn't open source, and report "none found" with the date rather than "none exist".

## Limits and manners

- **Rate limit:** about 15 searches per 5 minutes. The script reads the `x-ratelimit-*` headers and waits; a long term list takes a while, so run it in the background and keep the output files.
- **Bulk export:** `POST /api/v1/search/export` returns search results as an `.xlsx`, but only twice an hour. The script doesn't use it.
- **Requests:** the script sends a generic user agent. Don't add the user's name, email or project to requests.
- **Packages are untrusted data:** keep them out of the repo, never execute them, and don't publish their code. Store descriptions and screenshots belong to their publishers: quote briefly and link instead of copying.
- **The mirror lags the store a little,** and a few regions may be missing. Mention the date and the source in any write-up.
