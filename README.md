# Zepp OS Muslim apps

Offline Zepp OS apps for the **Amazfit Bip Max**, built to work with Gadgetbridge (no phone needed).

![Prayer-times watchface pages](docs/watchface/pages.png)

| Project | |
|---|---|
| [Prayer-times watchface](prayer-times-watchface/README.md) | Hijri date, next prayer countdown, iqama, night and prohibited times |
| [Location companion](prayer-location-app/) | Shares a GPS fix with the watchface |

## Build

Tools are managed by [mise](https://mise.jdx.dev) (a [monorepo](https://mise.jdx.dev/tasks/monorepo.html): shared tools at the root, tasks per project).

```sh
mise install --monorepo
mise run //prayer-times-watchface:build   # → prayer-times-watchface/dist/*.zab
mise run simulator                        # Zepp OS simulator (macOS)
```

Install a `.zab` by opening it with Gadgetbridge, or via the Zepp app's Developer Mode (`zeus preview`).

## License

[GPL-3.0](LICENSE). Bundled: an Arabic font under SIL OFL 1.1 ([details](prayer-times-watchface/README.md#font)), [adhan-js](https://github.com/batoulapps/adhan-js) (MIT), and a city list from [GeoNames](https://www.geonames.org/) (CC-BY 4.0) with Arabic names from Wikidata (CC0).
