# Amazfit Bip Max: Zepp OS projects

Offline-first Zepp OS projects for the **Amazfit Bip Max** (Zepp OS 5, API level 4.4, 432×514, `deviceSource 11206915`). They are built to work with **Gadgetbridge**: no Zepp app-side code and no phone dependency.

| Project | What it is |
|---|---|
| [`prayer-times-watchface/`](prayer-times-watchface/README.md) | Arabic prayer-times watchface. It shows the Hijri date (Umm al-Qura), the next prayer with a countdown and progress bar, iqama, night portions, Duha/Eid and prohibited times, extras (weather, steps, …), with on-watch edit slots and 13 calculation methods. |
| [`prayer-location-app/`](prayer-location-app/) | Small companion app: takes a GPS fix and shares lat/lon with the watchface via shared storage. A fuller companion app is planned. |

## Setup

Everything is managed by [mise](https://mise.jdx.dev). The repo is a [mise monorepo](https://mise.jdx.dev/tasks/monorepo.html):
- **Root `mise.toml`:** shared tools (node, pnpm, zeus CLI, the Zepp OS simulator) and the `simulator` task.
- **Each project's `mise.toml`:** that project's tasks (and `uv` for its Python generators).

```sh
mise trust && mise install --monorepo   # tools for every project, including the simulator
mise tasks --all                        # list every project's tasks
```

The watchface's preview generators also need Homebrew's `libraqm` (`brew install libraqm`) for Arabic text rendering; see its README.

## Tasks

```sh
mise run //prayer-times-watchface:build   # fonts + generated assets → tests → dist/*.zab
mise run //prayer-times-watchface:test    # prayer / Hijri / countdown checks
mise run //prayer-location-app:build      # icon → dist/*.zab
mise run simulator                        # open the Zepp OS Simulator
```

Inside a project folder the short form works too: `mise run :build`.

## Simulator

`http:zepp-simulator` installs the macOS DMG. `scripts/install-simulator.sh` (mise postinstall) copies the app into place and makes the bundled QEMU scripts executable, since the DMG ships them without `+x`.
- Start the simulator, boot the Bip Max image, then run `zeus dev` in a project folder.
- **Clock:** the emulator runs on UTC, so prayer times look shifted there.

## Installing on the watch

- **Gadgetbridge:** open the built `dist/*.zab` with Gadgetbridge (File Installer).
- **Zepp app (Developer Mode):** `zeus preview` (QR code) or `zeus bridge`.

`zeus build` wipes `dist/`, so don't keep anything else there.

## License

The code is licensed under the [GNU General Public License v3.0](LICENSE).

Bundled third-party assets keep their own licenses:
- The Arabic font in `prayer-times-watchface/assets/bip-max/fonts/` is derived from SIL's Scheherazade New and Google's Noto Sans, under the SIL Open Font License 1.1. See `prayer-times-watchface/fonts/`.
- [adhan-js](https://github.com/batoulapps/adhan-js) is MIT-licensed and bundled into the watchface build.
