---
name: zepp-store-release
description: Upload or re-upload a Zepp OS watch face or mini app from this repo to the Zepp store (console.zepp.com), including the GitHub release that goes with it. Use when asked to publish, submit, update or re-submit a project to the Zepp store or to cut a new version.
---

# Zepp store release

How a project in this repo (a folder with an `app.json`, such as `prayer-times-watchface/`) goes to the Zepp store and to GitHub releases. Tasks come from each project's `mise.toml`; run them with `mise run //<project>:<task>`.

**The person submits.** Prepare everything, fill the form, and stop. The person clicks "Submit for Review" (it uses one of a few reviews per week, shown on the form) and confirms the service agreement. Don't click either, and don't publish a GitHub release, move a tag or push unless they asked.

## 1. Before building

- **Version:** a re-upload needs a higher `version.code` and a new `version.name` in the project's `app.json`. The GitHub release workflow checks that the tag `<project>/vX.Y.Z` matches `version.name`.
- **Licence notices:** the store agreement (https://upload-cdn.huami.com/tposts/7726, clause 4.1(b)) requires meeting the open-source licences of what the package contains. Each target ships `assets/<target>/NOTICE.txt` with the project's licence, the source URL and the third-party notices; the project's tests check that it exists. Add a notice when a new bundled dependency, font, icon set or data source comes in.
- **Privacy policy:** the agreement (clause 13.1) requires one, published in the developer's own name. `PRIVACY.md` at the repo root covers the published projects; extend it before publishing a new one, and keep its date current. The URL is `https://github.com/<owner>/<repo>/blob/master/PRIVACY.md`, so it must be pushed before submission.
- **Store text:** `<project>/store-listing.json` holds the category, the review notes, and per language the console's language label, a name (30 characters at most) and a description (400 at most). Update it when features change. Translations other than Arabic and English haven't had a native speaker's review: say so if you change them.
- **Previews:** one PNG per listing language, at the device's screen size (432×514 for the Bip Max), at most 1 MB, not the always-on version. The watch face's generator writes them to `docs/watchface/store/<lang>.png` as part of `:gen`; CI checks they're up to date.

## 2. Build

- **Store:** `mise run //<project>:build-store`. It keeps zeus's source archive inside the `.zab`, which the store uses to build for other devices. Upload this one to the store.
- **GitHub / sideloading:** `mise run //<project>:build` prunes the source archive (a smaller `.zab`). The release workflow builds this itself.
- Both run the generators and the tests first. Check the tests passed, that `git status` shows no regenerated files left uncommitted, and that the package has what you expect: unzip the `.zab`, then its `.zpk`, then `device.zip` (look for `assets/NOTICE.txt`).

## 3. Commit, push, GitHub release (when asked)

1. Commit and push; wait for CI to pass.
2. Publish a GitHub release tagged `<project>/vX.Y.Z` on that commit (for example with `gh release create`). `.github/workflows/release.yml` builds the lean `.zab`, checks the version and attaches it.
3. If a fix lands right after a release and the person wants it in the same version: move the tag to the new commit and force-push only that tag, then re-run the release workflow so CI rebuilds and replaces the attachment (`--clobber`). The run page keeps showing the old commit; its checkout log shows the one it built.

## 4. Fill the store form

The console needs the person's logged-in browser session, so use their own browser through a browser automation tool (for example the `browser-use` CLI). Stop and ask if it shows a login page.

1. Open `https://console.zepp.com/#/service/app/audit/list/watchface` (or `/app` for mini apps). Find the project's row. The action link ("Submit", or the update action for a released item) is a plain link to the release form: read its `href` and navigate to it. That only opens the form.
2. With the form open in the attached tab, run the fill script:

   ```bash
   ZAB=/abs/path/<project>/dist/<file>.zab \
   LISTING=/abs/path/<project>/store-listing.json \
   PREVIEWS=/abs/path/docs/watchface/store \
     browser-use < .agents/skills/zepp-store-release/fill_form.py
   ```

   It uploads the package, picks the category, adds and ticks each extra language, fills names, descriptions and review notes, and uploads each language's preview. It skips steps already done, so it's safe to re-run, and it prints the form's state at the end.
3. Check that output: one package (the right file name), the device the console detected, every name, `descs ok True`, one preview per language, no errors.
4. Tell the person the form is ready, with what's in it, and leave "Submit for Review" to them.

**Mini apps:** the fill script was written against the watch face form. The app form may name its category field differently (set `category_field` in the listing file to the field's `id`) or ask for more (several screenshots, a category per language). Read the form's fields before running it, and extend the script for what differs.

## Pitfalls seen in this console

- **Background tab:** the form usually lives in a tab that isn't in front. There, Ant Design dropdowns never open, clicks at coordinates can miss, and some updates (removing a file) wait until the tab is shown. The script brings the tab to the front first. Doing anything by hand: focus the field's `input` and use keys (ArrowDown, Enter, typing to filter), and call `.click()` on buttons.
- **React fields:** setting `.value` isn't enough. Use the native value setter, then dispatch an `input` event (see `set_value` in the script).
- **Slow uploads:** a preview can take several seconds to appear. Sending it again adds a second image to that language; the script waits instead. To remove an image, `.click()` its `button[title="Remove file"]`.
- **Replacing the package:** removing an uploaded `.zab` and adding another left the upload list in a broken state (the old file stuck, the new one without its size). Reload the form page and re-run the fill script instead; it fills everything again from the files.
- **Selectors that look alike:** the device box and the language box are both multi-selects. The script uses the language box's id (`#otherLanguage`) and the category's (`#category_watch` on the watch face form).
- **Review quota:** the form shows how many reviews are left this week (it resets on Monday). Get everything right before the person submits; a rejected or resubmitted version uses another.
