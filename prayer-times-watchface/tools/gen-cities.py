"""Builds the face's city list from GeoNames (CC-BY 4.0) into assets/bip-max/cities/.

Inputs in .cache/geonames (tools/fetch-geonames.sh): cities15000.zip, countryInfo.txt,
admin1CodesASCII.txt, alternateNamesV2.zip. The output is committed; rerun with
`mise run :gen-cities` to refresh it (GeoNames changes daily, so it isn't part of every build).

Selection (research: tiered set): Arab League countries every city ≥ 15k people, other
Muslim-majority countries ≥ 50k, everywhere else ≥ 250k, plus every capital.

Names: Arabic from alternateNamesV2 (isolanguage "ar"); where GeoNames has none, the Arabic label
of the place's Wikidata item (GeoNames "wkdt" link; CC0), cached in .cache/geonames/wikidata-ar.json.
Diacritics are removed, and a name is only kept when every letter is one the face's font shapes
(basic Arabic, U+0621–U+064A); otherwise the English GeoNames name. Countries with more than REGION_MIN cities get a region step
(admin1, e.g. governorates). Lists are sorted alphabetically, ignoring a leading "ال".

Other languages (lib/i18n) show the ASCII GeoNames name, stored as a 4th element of a city row (3rd of
a region row) when it differs from the Arabic one; country names come from CLDR (Babel).

Files (compact, read by lib/city-data.js): index.json {langs: [...], groups: [[groupKey, [[cc, name per lang...], ...]], ...]};
<CC>.json is {cities: [[name, lat, lon, latin?], ...]} or, with regions, {regions: [[region, [[name, lat, lon, latin?], ...], latin?], ...]}.
lat/lon are whole hundredths of a degree (~1 km, under 3 s of prayer time). Group keys are lib/i18n menu.groups keys.

Run: uv run --with babel python3 -I tools/gen-cities.py (via mise).
"""
import io
import json
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path

from babel import Locale

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / ".cache" / "geonames"
OUT = ROOT / "assets" / "bip-max" / "cities"

ARAB = set("DZ BH KM DJ EG IQ JO KW LB LY MR MA OM PS QA SA SO SD SY TN AE YE".split())
MUSLIM = set("AF AL AZ BA BD BF BN GM GN ID IR KG KZ ML MV MY NE NG PK SL SN TD TJ TM TR UZ XK".split())
MIN_POP = (15_000, 50_000, 250_000)  # Arab, other Muslim-majority, rest
SKIP_CODES = {"PPLX", "PPLH", "PPLQ", "PPLW", "PPLCH"}  # city sections, historical, abandoned
REGION_MIN = 15
GROUPS = [  # (lib/i18n menu.groups key, test(cc, continent))
    ("arab", lambda cc, ct: cc in ARAB),
    *((ct, (lambda c: lambda cc, ct: ct == c)(ct)) for ct in ("AS", "AF", "EU", "NA", "SA", "OC")),
]
LANGS = ["ar", "en", "fr", "tr", "id", "ms", "ru"]  # lib/i18n/index.js LANG_CODES (test/verify.mjs checks)
# Fixes for GeoNames Arabic names that are wrong or odd; key = geonameid.
OVERRIDES = {
    "109223": "المدينة المنورة",  # GeoNames prefers the short "المدينة"
}

TASHKEEL = re.compile("[ؐ-ًؚ-ٰٟۖ-ۭـ‌-‏]")
ARABIC_OK = re.compile(r"^[ء-غف-ي ()\-]+$")


# Persian/Urdu letter forms that have a plain Arabic equivalent the font shapes
VARIANTS = str.maketrans({"\u06cc": "\u064a", "\u06a9": "\u0643", "\u06c1": "\u0647", "\u06be": "\u0647", "\u06a4": "\u0641"})


def clean_ar(s):
    s = re.split("[\u060c,]", s)[0]  # "city، region" → "city"
    s = re.sub(r"\s+", " ", TASHKEEL.sub("", s).translate(VARIANTS)).strip()
    return s if ARABIC_OK.match(s) and re.search("[ء-ي]", s) else None


ADMIN_PREFIX = re.compile("^(محافظة|ولاية|منطقة|إمارة|مقاطعة|إقليم|جهة|بلدية) ")


def latin(s):
    """Fallback name in plain ASCII (the font only carries basic Latin): "Curaçao" → "Curacao"."""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip() or "?"


def wikidata_labels(qids, cache_file):
    """Arabic labels for Wikidata items, cached on disk (only missing ids are queried)."""
    cache = json.loads(cache_file.read_text(encoding="utf-8")) if cache_file.exists() else {}
    todo = sorted(q for q in qids if q not in cache)
    for i in range(0, len(todo), 200):
        batch = todo[i:i + 200]
        query = ("SELECT ?item ?label WHERE { VALUES ?item { " + " ".join(f"wd:{q}" for q in batch) +
                 ' } ?item rdfs:label ?label FILTER(LANG(?label) = "ar") }')
        req = urllib.request.Request(
            "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": query, "format": "json"}),
            headers={"User-Agent": "zeppos-watchface-city-generator/1.0 (build tool)"})
        with urllib.request.urlopen(req, timeout=60) as r:
            rows = json.load(r)["results"]["bindings"]
        for q in batch:
            cache[q] = None
        for row in rows:
            cache[row["item"]["value"].rsplit("/", 1)[1]] = row["label"]["value"]
        print(f"wikidata: {min(i + 200, len(todo))}/{len(todo)}", file=sys.stderr)
    cache_file.write_text(json.dumps(cache, ensure_ascii=False, sort_keys=True), encoding="utf-8")
    return cache


def sort_key(name):
    n = name[2:] if name.startswith("ال") else name
    return n.translate(str.maketrans("أإآ", "ااا"))


def read_tsv(f):
    for line in f:
        if line and not line.startswith("#"):
            yield line.rstrip("\n").split("\t")


def main():
    countries = {}  # cc → (english, continent, geonameid)
    with open(SRC / "countryInfo.txt", encoding="utf-8") as f:
        for r in read_tsv(f):
            countries[r[0]] = (r[4], r[8], r[16])

    admin1 = {}  # "EG.11" → (english, geonameid)
    with open(SRC / "admin1CodesASCII.txt", encoding="utf-8") as f:
        for r in read_tsv(f):
            admin1[r[0]] = (r[2] or r[1], r[3])

    cities = []
    with zipfile.ZipFile(SRC / "cities15000.zip") as z, z.open("cities15000.txt") as raw:
        for r in read_tsv(io.TextIOWrapper(raw, encoding="utf-8")):
            gid, name, lat, lon, code, cc, a1, pop = r[0], r[2] or r[1], float(r[4]), float(r[5]), r[7], r[8], r[10], int(r[14] or 0)
            if cc not in countries or code in SKIP_CODES:
                continue
            tier = 0 if cc in ARAB else 1 if cc in MUSLIM else 2
            if pop >= MIN_POP[tier] or code == "PPLC":
                cities.append({"id": gid, "en": name, "lat": lat, "lon": lon, "cc": cc, "a1": f"{cc}.{a1}", "pop": pop})

    # Arabic names for the cities, their regions and countries (one pass over the 200 MB file)
    wanted = {c["id"] for c in cities} | {admin1[c["a1"]][1] for c in cities if c["a1"] in admin1}
    wanted |= {countries[cc][2] for cc in {c["cc"] for c in cities}}
    best = {}  # geonameid → (rank, name)
    wkdt = {}  # geonameid → Wikidata id
    with zipfile.ZipFile(SRC / "alternateNamesV2.zip") as z, z.open("alternateNamesV2.txt") as raw:
        for line in io.TextIOWrapper(raw, encoding="utf-8"):
            r = line.rstrip("\n").split("\t")
            if r[1] not in wanted:
                continue
            if r[2] == "wkdt":
                wkdt[r[1]] = r[3]
                continue
            if r[2] != "ar" or r[6] == "1" or r[7] == "1":  # colloquial, historic
                continue
            name = clean_ar(r[3])
            if not name:
                continue
            rank = (0 if r[4] == "1" else 1, 0 if r[5] == "1" else 1, len(name))  # preferred, short, shorter
            if r[1] not in best or rank < best[r[1]][0]:
                best[r[1]] = (rank, name)
    missing = {gid: q for gid, q in wkdt.items() if gid not in best}
    labels = wikidata_labels(set(missing.values()), SRC / "wikidata-ar.json")
    from_wikidata = 0
    for gid, q in missing.items():
        label = labels.get(q)
        name = clean_ar(re.split("[،,(]", label)[0]) if label else None
        if name:
            best[gid] = ((2, 2, len(name)), name)
            from_wikidata += 1
    print(f"Arabic names: {len(best) - from_wikidata} from GeoNames, {from_wikidata} from Wikidata")
    ar = lambda gid, en: OVERRIDES.get(gid) or (best[gid][1] if gid in best else latin(en))

    by_cc = defaultdict(list)
    for c in cities:
        c["name"] = ADMIN_PREFIX.sub("", ar(c["id"], c["en"]))  # "محافظة عفيف" → "عفيف"
        by_cc[c["cc"]].append(c)

    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*.json"):
        f.unlink()
    stats = {"cities": 0, "arabic": 0, "files": 0, "bytes": 0}
    country_names = {}
    for cc in [cc for cc in by_cc if not any(t(cc, countries[cc][1]) for _, t in GROUPS)]:
        del by_cc[cc]  # e.g. Antarctica: no menu group
    for cc, lst in by_cc.items():
        en, _, cgid = countries[cc]
        country_names[cc] = [ar(cgid, en)] + [Locale.parse(lang).territories.get(cc, en) for lang in LANGS[1:]]
        with_latin = lambda r, en: r + [latin(en)] if latin(en) != r[0] else r  # noqa: E731
        row = lambda c: with_latin([c["name"], round(c["lat"] * 100), round(c["lon"] * 100)], c["en"])  # noqa: E731
        by_name = lambda cs: [row(c) for c in sorted(cs, key=lambda c: sort_key(c["name"]))]  # noqa: E731
        if len(lst) > REGION_MIN and len({c["a1"] for c in lst}) > 1:
            # "محافظة الجيزة" → "الجيزة": GeoNames uses the admin prefix inconsistently, and it breaks the sort
            names = {a: (ADMIN_PREFIX.sub("", ar(admin1[a][1], admin1[a][0])), admin1[a][0]) if a in admin1 else ("أخرى", "Other")
                     for a in {c["a1"] for c in lst}}
            regions = {}  # Arabic name → English name (the first one met, if two regions share it)
            for a in sorted(names):
                regions.setdefault(*names[a])
            data = {"regions": [with_latin([r, by_name([c for c in lst if names[c["a1"]][0] == r])], regions[r])
                                for r in sorted(regions, key=sort_key)]}
        else:
            data = {"cities": by_name(lst)}
        text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        (OUT / f"{cc}.json").write_text(text, encoding="utf-8")
        stats["cities"] += len(lst)
        stats["arabic"] += sum(bool(ARABIC_OK.match(c["name"])) for c in lst)
        stats["files"] += 1
        stats["bytes"] += len(text.encode())

    groups = []
    for gname, test in GROUPS:
        ccs = [cc for cc in by_cc if test(cc, countries[cc][1]) and not any(t(cc, countries[cc][1]) for _, t in GROUPS[:GROUPS.index((gname, test))])]
        if ccs:
            groups.append([gname, sorted(([cc, *country_names[cc]] for cc in ccs), key=lambda x: sort_key(x[1]))])
    index = {"source": "GeoNames (CC-BY 4.0) cities15000 + alternateNamesV2; Arabic gaps from Wikidata labels (CC0); "
             "country names from CLDR (Unicode License)",
             "langs": LANGS, "groups": groups}
    text = json.dumps(index, ensure_ascii=False, separators=(",", ":"))
    (OUT / "index.json").write_text(text, encoding="utf-8")
    stats["bytes"] += len(text.encode())
    print(f"{stats['cities']} cities in {stats['files']} countries, {stats['arabic']} with Arabic names, "
          f"{stats['bytes'] // 1024} KB → {OUT.relative_to(ROOT)}")
    big = sorted(by_cc.items(), key=lambda kv: -len(kv[1]))[:5]
    print("largest:", ", ".join(f"{cc} {len(v)}" for cc, v in big))


if __name__ == "__main__":
    sys.exit(main())
