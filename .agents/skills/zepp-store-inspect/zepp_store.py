"""Query the Zepp store through Zepp Explorer (https://ze.mmk.pw, melianmiko's public store mirror).
Standard library only; output is JSON (one file per command), so runs can be resumed and diffed.

  python3 -I zepp_store.py devices [--match "bip max"]
  python3 -I zepp_store.py search OUT.json --type lightapp|watch [--device 11206915] TERM...
  python3 -I zepp_store.py details OUT.json --from SEARCH.json [--ids 123 456] [--device 11206915]
  python3 -I zepp_store.py packages OUT.json --from DETAILS.json
  python3 -I zepp_store.py summary --from DETAILS.json [--packages PACKAGES.json] [--device 11206915]

search:   every result for each term (all pages), merged by appId, with the terms that found it.
details:  the store page of each app: description, changelog, versions, screenshots, every device
          it supports (knownDeviceSources), package downloadUrl. With --device, the details of
          that device's build when the app lists it.
packages: downloads each package and keeps only its file list, sizes and every app.json inside
          (nested .zab/.zpk/.zip are opened). Packages are untrusted: nothing is extracted to disk
          or run.

OUT files are reused: entries already in them are skipped, so an interrupted run continues.
Rate limits (about 15 searches per 5 minutes) are honoured from the x-ratelimit-* headers.
"""
import argparse
import io
import json
import sys
import time
import urllib.error
import urllib.request
import zipfile

API = "https://ze.mmk.pw/api/v1"
UA = {"user-agent": "zepp-store-inspect"}  # generic: never put personal details here
PAGE = 18  # search page size


def request(url, body=None):
    """JSON from the API, waiting out rate limits; None for 404."""
    data = json.dumps(body).encode() if body is not None else None
    headers = {**UA, "content-type": "application/json"} if body is not None else UA
    for attempt in range(8):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, data, headers), timeout=60)
            out = json.load(r)
            left, reset = r.headers.get("x-ratelimit-remaining"), r.headers.get("x-ratelimit-reset")
            if left is not None and int(left) <= 0 and reset:
                time.sleep(max(0, int(reset) - time.time()) + 2)
            else:
                time.sleep(1)
            return out
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code != 429:
                raise
            reset = e.headers.get("x-ratelimit-reset")
            wait = max(5, int(reset) - time.time()) + 2 if reset else 30 * (attempt + 1)
            print(f"rate limited, waiting {int(wait)} s", file=sys.stderr, flush=True)
            time.sleep(wait)
    raise RuntimeError(f"gave up: {url}")


def load(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def save(path, value):
    with open(path, "w") as f:
        json.dump(value, f, ensure_ascii=False, indent=1)


def cmd_devices(a):
    devices = request(f"{API}/device/enum")
    rows = [d for d in devices.values() if not a.match or a.match.lower() in d["displayName"].lower()]
    for d in sorted(rows, key=lambda d: d["displayName"]):
        print(f'{d["deviceSource"]:>10}  {d["displayName"]}  {d["screenWidth"]}x{d["screenHeight"]}  OS {d["osVersion"]}')


def cmd_search(a):
    seen = {e["appId"]: e for e in load(a.out, [])}
    done = {(e_type, t) for e in seen.values() for e_type, t in e.get("_queries", [])}
    for term in a.terms:
        if (a.type, term) in done:
            continue
        page, found = 1, 0
        while True:
            body = {"entryType": a.type, "name": term, "page": page, "viewLevel": "app"}
            if a.device:
                body["deviceSources"] = [str(a.device)]
            items = (request(f"{API}/search", body) or {}).get("items", [])
            for it in items:
                e = seen.setdefault(it["appId"], {**it, "terms": [], "_queries": []})
                if term not in e["terms"]:
                    e["terms"].append(term)
                e["_queries"].append([a.type, term])
            found += len(items)
            if len(items) < PAGE or page >= a.max_pages:
                break
            page += 1
        if not found:  # remember empty terms too, so a resumed run skips them
            seen.setdefault(f"_none:{a.type}:{term}", {"appId": f"_none:{a.type}:{term}", "_queries": [[a.type, term]]})
        print(f"{a.type} {term!r}: {found} results, {sum(not str(k).startswith('_') for k in seen)} apps", flush=True)
        save(a.out, list(seen.values()))


def cmd_details(a):
    apps = [e for e in load(a.source, []) if not str(e["appId"]).startswith("_")]
    if a.ids:
        apps = [e for e in apps if e["appId"] in a.ids]
    done = {d["appId"]: d for d in load(a.out, [])}
    for e in apps:
        if e["appId"] in done:
            continue
        info = request(f"{API}/app/info/{e['deviceSource']}/{e['appId']}/latest")
        if info and a.device and a.device in info.get("knownDeviceSources", []) and info.get("deviceSource") != a.device:
            build = request(f"{API}/app/info/{a.device}/{e['appId']}/latest")
            if build:
                info = {**build, "knownDeviceSources": info["knownDeviceSources"]}
        done[e["appId"]] = {"appId": e["appId"], "terms": e.get("terms", []), "info": info}
        listed = " (lists the device)" if info and a.device in info.get("knownDeviceSources", []) else ""
        print(f'{e["appId"]} {e.get("name")}{listed}', flush=True)
        save(a.out, list(done.values()))


def unpack(data, depth=0):
    """File list and app.json of a zip, recursing into nested packages. Nothing is written or run."""
    z = zipfile.ZipFile(io.BytesIO(data))
    out = {"files": [], "appjson": [], "nested": []}
    for info in z.infolist():
        out["files"].append([info.filename, info.file_size])
        if info.filename.endswith("app.json") and info.file_size < 1_000_000:
            try:
                out["appjson"].append(json.loads(z.read(info)))
            except ValueError as err:
                out["appjson"].append({"error": str(err)})
        elif info.filename.endswith((".zip", ".zab", ".zpk")) and depth < 2 and info.file_size < 30_000_000:
            try:
                out["nested"].append([info.filename, unpack(z.read(info), depth + 1)])
            except zipfile.BadZipFile:
                pass
    return out


def cmd_packages(a):
    res = load(a.out, {})
    for d in load(a.source, []):
        info = d.get("info") or {}
        key = str(d["appId"])
        if key in res or not info.get("downloadUrl"):
            continue
        try:
            data = urllib.request.urlopen(urllib.request.Request(info["downloadUrl"], headers=UA), timeout=120).read()
            res[key] = {"name": info.get("name"), "size": len(data), **unpack(data)}
        except (urllib.error.URLError, zipfile.BadZipFile, OSError) as err:
            res[key] = {"name": info.get("name"), "error": str(err)}
        print(key, info.get("name"), res[key].get("size", res[key].get("error")), flush=True)
        save(a.out, res)
        time.sleep(1)


def manifests(pkg):
    """Every app.json in a package result, nested ones included."""
    out = list(pkg.get("appjson", []))
    for _, inner in pkg.get("nested", []):
        out += manifests(inner)
    return out


def modules(app_json):
    """Module names of an app.json (top level, or per target)."""
    names = set(app_json.get("module", {}))
    for t in (app_json.get("targets") or {}).values():
        names |= set(t.get("module", {}))
    return names


def cmd_summary(a):
    pkgs = load(a.packages, {}) if a.packages else {}
    print("appId\tname\tpublisher\tfirst seen\tversion\tdevices\tdevice?\tsize\tmodules\tpermissions")
    for d in load(a.source, []):
        i = d.get("info") or {}
        apps = manifests(pkgs.get(str(d["appId"]), {}))
        mods = sorted(set().union(*(modules(j) for j in apps))) if apps else []
        perms = sorted({p for j in apps for p in j.get("permissions", [])})
        print("\t".join(str(x) for x in [
            d["appId"], i.get("name"), (i.get("publisher") or {}).get("name"), (i.get("firstSeen") or "")[:10],
            i.get("version"), len(i.get("knownDeviceSources", [])),
            "yes" if a.device and a.device in i.get("knownDeviceSources", []) else "",
            i.get("downloadSize"), ",".join(mods), ",".join(perms)]))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("devices")
    s.add_argument("--match")
    s = sub.add_parser("search")
    s.add_argument("out")
    s.add_argument("terms", nargs="+")
    s.add_argument("--type", choices=["lightapp", "watch"], default="lightapp")
    s.add_argument("--device", type=int, help="deviceSource to limit results to")
    s.add_argument("--max-pages", type=int, default=8)
    s = sub.add_parser("details")
    s.add_argument("out")
    s.add_argument("--from", dest="source", required=True)
    s.add_argument("--ids", type=int, nargs="*")
    s.add_argument("--device", type=int, help="deviceSource whose build to describe when listed")
    s = sub.add_parser("packages")
    s.add_argument("out")
    s.add_argument("--from", dest="source", required=True)
    s = sub.add_parser("summary")
    s.add_argument("--from", dest="source", required=True, help="details output")
    s.add_argument("--packages", help="packages output, for modules and permissions")
    s.add_argument("--device", type=int, help="deviceSource to flag")
    a = p.parse_args()
    {"devices": cmd_devices, "search": cmd_search, "details": cmd_details, "packages": cmd_packages,
     "summary": cmd_summary}[a.cmd](a)


if __name__ == "__main__":
    main()
