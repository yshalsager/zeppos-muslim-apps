"""The Unicode bidi algorithm (UAX #9) for one line of plain text, as tools/render.py needs it:
which parts of a line run left to right or right to left, in visual order. HarfBuzz shapes each run
but doesn't reorder them; this does the job FriBiDi does inside libraqm.

Covers the rules plain text uses: weak types (W1–W7), neutrals (N1–N2), implicit levels (I1–I2) and
reordering (L2). No explicit embeddings or isolates (the face's strings have none), and no bracket
pairs (N0), which only change the result when a bracket pair holds text of the other direction.
"""
import unicodedata

STRONG = {"L", "R", "AL"}
NEUTRAL = {"B", "S", "WS", "ON"}


def _types(s):
    return [unicodedata.bidirectional(ch) or "L" for ch in s]


def levels(s, rtl):
    """Embedding level per character (0 = left to right, odd = right to left)."""
    e = 1 if rtl else 0
    sos = "R" if rtl else "L"
    t = _types(s)
    # explicit formatting characters (none expected): treat as boundary neutrals
    t = ["ON" if x in {"LRE", "RLE", "LRO", "RLO", "PDF", "LRI", "RLI", "FSI", "PDI", "BN"} else x for x in t]
    n = len(t)

    # W1: a non-spacing mark takes the type of what it's on
    for i in range(n):
        if t[i] == "NSM":
            t[i] = t[i - 1] if i else sos
    # W2: European digits after Arabic letters are Arabic numbers
    last = sos
    for i in range(n):
        if t[i] in STRONG:
            last = t[i]
        elif t[i] == "EN" and last == "AL":
            t[i] = "AN"
    # W3
    t = ["R" if x == "AL" else x for x in t]
    # W4: one separator between two numbers of the same kind joins them
    for i in range(1, n - 1):
        if t[i] == "ES" and t[i - 1] == "EN" and t[i + 1] == "EN":
            t[i] = "EN"
        elif t[i] == "CS" and t[i - 1] == t[i + 1] and t[i - 1] in {"EN", "AN"}:
            t[i] = t[i - 1]
    # W5: terminators (% ° …) next to European numbers become part of them
    i = 0
    while i < n:
        if t[i] == "ET":
            j = i
            while j < n and t[j] == "ET":
                j += 1
            if (i and t[i - 1] == "EN") or (j < n and t[j] == "EN"):
                t[i:j] = ["EN"] * (j - i)
            i = j
        else:
            i += 1
    # W6: any other separator or terminator is a neutral
    t = ["ON" if x in {"ES", "ET", "CS"} else x for x in t]
    # W7: European numbers in left-to-right text are left to right
    last = sos
    for i in range(n):
        if t[i] in {"L", "R"}:
            last = t[i]
        elif t[i] == "EN" and last == "L":
            t[i] = "L"
    # N1/N2: neutrals take the direction around them when both sides agree (numbers count as R),
    # otherwise the line's direction
    strong = lambda x: "L" if x == "L" else "R"  # noqa: E731  (R, AN, EN)
    i = 0
    while i < n:
        if t[i] in NEUTRAL:
            j = i
            while j < n and t[j] in NEUTRAL:
                j += 1
            before = strong(t[i - 1]) if i else sos
            after = strong(t[j]) if j < n else sos
            t[i:j] = [before if before == after else ("R" if rtl else "L")] * (j - i)
            i = j
        else:
            i += 1
    # I1/I2
    out = []
    for x in t:
        if e % 2 == 0:
            out.append(e + (1 if x == "R" else 2 if x in {"AN", "EN"} else 0))
        else:
            out.append(e + (1 if x in {"L", "AN", "EN"} else 0))
    # L1: whitespace at the end of the line goes back to the line's level
    i = n
    while i and unicodedata.bidirectional(s[i - 1]) in {"WS", "S", "B"}:
        i -= 1
        out[i] = e
    return out


def runs(s, rtl):
    """[(text, rtl)] runs in visual order, left to right. Each run's own text stays in logical
    order; the shaper lays it out in its direction."""
    if not s:
        return []
    lv = levels(s, rtl)
    logical = []  # [text, level]
    for ch, level in zip(s, lv):
        if logical and logical[-1][1] == level:
            logical[-1][0] += ch
        else:
            logical.append([ch, level])
    # L2: from the highest level down to the lowest odd one, reverse every sequence at or above it
    top = max(lv)
    low = min(lv) | 1
    for level in range(top, low - 1, -1):
        i = 0
        while i < len(logical):
            if logical[i][1] >= level:
                j = i
                while j < len(logical) and logical[j][1] >= level:
                    j += 1
                logical[i:j] = logical[i:j][::-1]
                i = j
            else:
                i += 1
    return [(text, level % 2 == 1) for text, level in logical]
