# Zepp OS notes

Practical notes from building offline Zepp OS watch faces and mini apps in this repo: what works, what doesn't, and the traps we hit. They apply to any project here, and to Zepp OS work in general.

Each fact says where it comes from:
- **(watch)** tested on an Amazfit Bip Max (Zepp OS 5, API_LEVEL 4.4) with code targeting API 3.0 (the keyboard: 4.2);
- **(build)** seen in our own builds with zeus-cli 1.10.0;
- **(simulator)** seen in Zepp's simulator (2.1.2) with that model's firmware image;
- **(docs)** from Zepp's documentation, not tested by us.

Other watches and firmware versions can differ. Corrections are welcome.

| Page | What's in it |
|---|---|
| [Build and tooling](build-and-tooling.md) | zeus quirks, lean vs store packages, mise tasks, the simulator, testing off the watch |
| [Multiple devices](multiple-devices.md) | targets, device ids, scaling one design to other screens, round screens, per-target assets |
| [Watch faces](watch-faces.md) | layers and always-on display, taps without images, edit slots, storage, what a face can't do |
| [Custom keyboards](custom-keyboards.md) | the keyboard data widget, building on resume, cached pages, button events, labels |
| [Text and languages](text-and-languages.md) | Arabic shaping and fonts, right-to-left layout, measuring text, translations loaded on demand |
| [Size and performance](size-and-performance.md) | how a package is stored on the watch, what costs space, what costs power |
| [Gadgetbridge](gadgetbridge.md) | building apps that work without the Zepp app |
| [Publishing](publishing.md) | the Zepp store's requirements, previews, review, GitHub releases |

Agents working in this repo also have two skills: [`zepp-store-release`](../.agents/skills/zepp-store-release/SKILL.md) (upload to the store) and [`zepp-store-inspect`](../.agents/skills/zepp-store-inspect/SKILL.md) (survey the store).

## Useful references

- [Zepp OS docs](https://docs.zepp.com/docs/intro/) and their [device list](https://docs.zepp.com/docs/reference/related-resources/device-list/) (device ids, screens, API levels, preview sizes)
- [ZeppDB](https://zdb.yardev.pw/devices): hardware revisions and firmware versions per model
- [Zepp Explorer](https://ze.mmk.pw/catalog/): a public mirror of the Zepp store with a JSON API
- [Zepp's samples](https://github.com/zepp-health/zeppos-samples)
- [Gadgetbridge's Zepp OS page](https://gadgetbridge.org/basics/topics/zeppos/)
