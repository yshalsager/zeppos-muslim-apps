# Build and tooling

## zeus

- **One package per firmware group (build).** `zeus build` writes a `.zab` holding one `.zpk` per group of devices, plus a `manifest.json` that maps device ids to packages. With eight screen targets covering 25 watch models we got thirteen `.zpk`s: zeus splits one target into several packages when its watches are on different firmware groups. Each holds only its own target's assets; a watch installs one.
- **Source archive (build).** `zeus build` also puts `.ip-package` in the `.zab`: a copy of the project source including every target's assets (three quarters of a one-target `.zab`; 2.6 of 6.5 MB with eight targets), which the Zepp store uses to rebuild for other devices. It never reaches the watch. `zeus prune --ip` removes it: do that for sideloading and GitHub releases, and keep it for store uploads.
- **A failed build can exit 0 (build).** When packing failed (a broken symlink in `assets/`), zeus printed the error and exited 0 with no `.zab` in `dist/`. Check that `dist/` has a fresh file, not only the exit code.
- **Symlinks in assets (build).** zeus copies the project to a temp folder first and keeps symlinks as links, so a relative link (`cities -> ../bip-max/cities`) points nowhere there and the build fails. Absolute links work but can't be committed. Copy shared files into each target's folder instead; git stores identical files once, so the copies cost no repository space.
- **Images become uncompressed TGA (build).** Every PNG is converted to an 8-bit palette TGA without compression, so an image costs about `width × height` bytes on the watch whatever it shows. See [size and performance](size-and-performance.md).
- **Environment variables don't reach the watch.** Values like app ids have to be written into source files before the build; we generate them from `mise.toml` (`scripts/app-ids.py`).
- **`zeus create` offers API levels up to 4.0 (build),** though newer watches report higher. Targeting API 3.0 keeps a project installable on Zepp OS 3 watches and up.
- **`zeus preview` (docs)** builds for one device and prints a QR code that the Zepp app installs from, with Developer Mode on (Profile → your watch → Developer Mode). Useful for testers on the Zepp app; Gadgetbridge users install the `.zab` instead.

## mise tasks

- **Dependencies run in parallel.** `depends = [":gen", ":test"]` starts both at once, so tests can run against files the generators haven't written yet. Give the test task `wait_for = [":gen"]`: it then waits when both are scheduled, and still runs alone with `mise run :test`.
- Keep project tasks in each project's `mise.toml` and run them from anywhere as `mise run //<project>:<task>`.

## Simulator

- The simulator's clock runs on UTC (watch), so anything that depends on local time looks shifted.
- `mise run simulator` at the repo root starts it; boot a device image, then `zeus dev` in the project.

## Testing off the watch

- **Run the real code in Node.** A small stub for the `@zos/*` modules (record widgets and their properties, route taps to the topmost widget at a point, fake the sensors) lets tests and screenshot tools drive the actual face code, menus included. Ours: `prayer-times-watchface/tools/zos-stub/`, loaded with `node --import ./tools/zos-stub/register.mjs`.
- **Keep logic out of the UI.** Prayer maths, the calendar, settings and text building live in plain modules that Node imports directly, so they can be checked against reference implementations (ICU calendars, the upstream library) over thousands of days.
- **Draw text like the watch.** For previews and screenshots, shape Arabic with HarfBuzz and draw with FreeType (`uharfbuzz` + `freetype-py` wheels): the output is pixel-identical on macOS and Linux, unlike Pillow's own text layout, which needs `libraqm` for Arabic. Compare PNGs by pixels in CI; their compressed bytes differ between machines.
- **Pin the inputs.** Download fonts at fixed versions and check their checksums; run Python generators with pinned wheels (`uv run --with … --no-build`), so a generated file changes only when its inputs do.
