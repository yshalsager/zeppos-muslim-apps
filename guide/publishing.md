# Publishing

## Zepp store

Upload at the [Zepp developer console](https://console.zepp.com/). Read the [developer agreement](https://upload-cdn.huami.com/tposts/7726) before the first upload; the points that need work in the project:

- **Open-source notices (§4.1(b)).** You must comply with the licences of everything you ship. Put a `NOTICE.txt` in each target's assets folder with your own licence and source link, plus every third-party licence (libraries, fonts, data). Our tests check that each target has one.
- **Privacy policy (§13.1),** in your own name, at a public URL, even if the app collects nothing. Say what the app reads on the watch and that nothing leaves it. Ours: [`PRIVACY.md`](../PRIVACY.md).
- **Your name as publisher.** The policy and the listing should name who publishes the app.

Practical points:

- **Upload the store build,** the `.zab` with `.ip-package` still in it (`zeus build` without `zeus prune --ip`; `mise run :build-store` in the watchface project); the store uses the source to rebuild for other devices.
- **The version must go up for every upload.** Set `version.code` and `version.name` in `app.json` before building.
- **Preview images per language.** Generate them from the real layout with a script, so every update and language gets them for free.
- **Write the listing in a file** (name, description and review notes per language) and keep it in the repo, so the next upload reuses it.
- **Review quota:** the console allows about six submissions a week.
- **The form is fiddly** (dropdowns, file uploads that get duplicated if resent). The [`zepp-store-release`](../.agents/skills/zepp-store-release/SKILL.md) skill fills it from the listing file; a person still submits.
- **The store holds devices per variant.** Make sure `app.json` lists every `deviceSource` of each model you support (see [multiple devices](multiple-devices.md)).

To see how similar apps are described, which devices they support and what permissions they ask for, use [Zepp Explorer](https://ze.mmk.pw/catalog/) or the [`zepp-store-inspect`](../.agents/skills/zepp-store-inspect/SKILL.md) skill.

## GitHub releases

- Tag `<project>/vX.Y.Z`; the release workflow builds, prunes and attaches the `.zab`.
- Users without the store install it with Gadgetbridge (see [Gadgetbridge](gadgetbridge.md)).
- Re-running a release replaces the file (`--clobber`), so fixes to a release before anyone downloads it don't need a new version.
