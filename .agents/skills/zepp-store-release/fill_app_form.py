# Fills the Zepp developer console's mini app release form from a project's store listing file.
# Never submits, and leaves the Work Statement (agreement) box alone. Run with the form open in
# the attached browser-use tab:
#   ZAB=/abs/x.zab LISTING=/abs/store-listing.json IMAGES=/abs/dir \
#     browser-use < .agents/skills/zepp-store-release/fill_app_form.py
# IMAGES holds <lang>-round.png and <lang>-square.png (360 x 360, transparent background) per listing
# language and a 240 x 240 icon.png. Safe to re-run: steps already done are skipped. Prints the
# form's state at the end; check it before handing over.
import json, os, time

L = json.load(open(os.environ["LISTING"]))
ZAB = os.environ["ZAB"]
IMAGES = os.environ["IMAGES"].rstrip("/") + "/"
LANGS = list(L["langs"])  # en first: the console's default language panel

activate_tab(current_tab())
if not js("!!document.querySelector(\"input[type=file][accept='.zab']\") && !!document.querySelector('textarea#privacy_statement')"):
    raise SystemExit(f"Not on an app release form: {page_info()['url']}")


def key(k, code, vk):
    cdp("Input.dispatchKeyEvent", type="keyDown", key=k, code=code, windowsVirtualKeyCode=vk)
    cdp("Input.dispatchKeyEvent", type="keyUp", key=k, code=code, windowsVirtualKeyCode=vk)


def wait(cond, secs=30):
    for _ in range(secs):
        if js(cond):
            return True
        time.sleep(1)
    return False


def set_value(el_js, v, proto):  # React-controlled fields need the native setter + an input event
    js(f"""(() => {{ const el = {el_js};
      Object.getOwnPropertyDescriptor(window.{proto}.prototype, 'value').set.call(el, {json.dumps(v)});
      el.dispatchEvent(new Event('input', {{ bubbles: true }})) }})()""")


def pick(input_js, option):
    """Single select: open it and step down the options until `option` is highlighted, then Enter
    (these selects aren't searchable, so typing doesn't filter). Returns the item now shown."""
    item = f"{input_js}.closest('.ant-select').querySelector('.ant-select-selection-item')?.innerText || ''"
    active = "document.querySelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-active')?.innerText || ''"
    for _ in range(3):
        if js(item) == option:
            break
        js(f"{input_js}.focus()"); time.sleep(0.5)
        key("ArrowDown", "ArrowDown", 40); time.sleep(0.8)
        seen = []
        while (a := js(active)) != option and a not in seen:
            seen.append(a); key("ArrowDown", "ArrowDown", 40); time.sleep(0.2)
        key("Enter" if a == option else "Escape", "Enter" if a == option else "Escape", 13 if a == option else 27)
        time.sleep(1)
        js("document.activeElement.blur()"); time.sleep(0.5)
    return js(item)


def tick(item_label, value, on=True):  # a radio or checkbox in the form item labelled item_label
    js(f"""(() => {{ const f = [...document.querySelectorAll('.ant-form-item')].find(f =>
      (f.querySelector('.ant-form-item-label')?.innerText || '').replace('*', '').trim() === {json.dumps(item_label)});
      const i = f && [...f.querySelectorAll('input')].find(i => i.value === {json.dumps(value)});
      if (i && i.checked !== {json.dumps(on)}) i.click() }})()""")


def png_inputs():
    """[(form item label, CDP nodeId)] for every .png upload, in page order."""
    doc = cdp("DOM.getDocument", depth=-1, pierce=True)
    ids = cdp("DOM.querySelectorAll", nodeId=doc["root"]["nodeId"], selector="input[type=file][accept='.png']")["nodeIds"]
    labels = js("[...document.querySelectorAll(\"input[type=file][accept='.png']\")].map(i => "
                "(i.closest('.ant-form-item')?.querySelector('.ant-form-item-label')?.innerText || '').replace('*', '').trim())")
    return list(zip(labels, ids))


def image_counts(label):
    return js(f"""[...document.querySelectorAll('.ant-form-item')].filter(f =>
      (f.querySelector('.ant-form-item-label')?.innerText || '').replace('*', '').trim() === {json.dumps(label)})
      .map(f => f.querySelectorAll('.ant-upload-list-item').length)""")


# 1. package: the console reads the devices and the version from it. A freshly opened form can drop
# the upload, leaving the list empty: send again only then, and wait for the finished state.
UPLOADED = ("[...document.querySelectorAll('.ant-upload-list-text .ant-upload-list-item')]"
            f".some(i => i.className.includes('success') && i.innerText.includes({json.dumps(os.path.basename(ZAB))}))")
for _ in range(3):
    if js(UPLOADED):
        break
    if not js("!!document.querySelector('.ant-upload-list-text .ant-upload-list-item')"):
        time.sleep(3)
        doc = cdp("DOM.getDocument", depth=-1, pierce=True)
        nid = cdp("DOM.querySelector", nodeId=doc["root"]["nodeId"], selector="input[type=file][accept='.zab']")["nodeId"]
        cdp("DOM.setFileInputFiles", nodeId=nid, files=[ZAB])
    wait(UPLOADED, 120)
if not js(UPLOADED):
    raise SystemExit("package upload did not finish; check the form's upload list")
wait("!!document.querySelector('#version').value", 30)

# 2. categories, pricing (free), regions (global)
tick("Pricing", "0")
tick("Distribution Regions", "all")
pick("document.querySelector('input#category')", L.get("service_category", "General"))
time.sleep(1)  # the service category's dropdown must close first, or this pick is lost
pick("document.querySelector('div#category_watch input')", L["category"])

# 3. extra languages: add each in the "other languages" box, then tick its checkbox (opens its panel)
for lang in LANGS[1:]:
    label = L["langs"][lang]["console"]
    has = f"[...document.querySelectorAll('.ant-checkbox-wrapper')].find(w => w.innerText.trim() === {json.dumps(label)})"
    if not js(f"!!{has}"):
        js("document.querySelector('#otherLanguage').focus()"); time.sleep(0.5)
        cdp("Input.insertText", text=label); time.sleep(1)
        key("Enter", "Enter", 13); time.sleep(0.6)
        key("Escape", "Escape", 27); time.sleep(0.4)
    js(f"(() => {{ const i = {has}.querySelector('input'); if (!i.checked) i.click() }})()")
    time.sleep(0.8)

# 4. per language: name, short and full description (panels are in LANGS order)
for i, lang in enumerate(LANGS):
    v = L["langs"][lang]
    set_value(f"document.querySelectorAll(\"input[id$='.app_name']\")[{i}]", v["name"], "HTMLInputElement")
    set_value(f"document.querySelectorAll(\"input[id$='.brief_description']\")[{i}]", v["short"], "HTMLInputElement")
    set_value(f"document.querySelectorAll(\"textarea[id$='.description']\")[{i}]", v["description"], "HTMLTextAreaElement")

# 5. images: per language a round and a square screenshot, and the icon. Uploads can take a few
# seconds; re-sending a slow one adds a second image, so wait instead.
SLOTS = {"App Screenshots (Round Screen)": "{lang}-round.png", "App Screenshots (Square Screen)": "{lang}-square.png",
         "App Icon": "icon.png"}
for label, pattern in SLOTS.items():
    nodes = [n for l, n in png_inputs() if l == label]
    for i, lang in enumerate(LANGS[:len(nodes)]):
        if image_counts(label)[i]:
            continue
        cdp("DOM.setFileInputFiles", nodeId=[n for l, n in png_inputs() if l == label][i],
            files=[IMAGES + pattern.format(lang=lang)])
        wait(f"""([...document.querySelectorAll('.ant-form-item')].filter(f =>
          (f.querySelector('.ant-form-item-label')?.innerText || '').replace('*', '').trim() === {json.dumps(label)})[{i}]
          ?.querySelectorAll('.ant-upload-list-item').length || 0) > 0""", 30)
        time.sleep(1)

# 6. privacy, permissions, SDKs, music, review notes
set_value("document.querySelector('textarea#privacy_statement')", L["privacy"], "HTMLTextAreaElement")
for p in L.get("permissions", ["none"]):
    tick("App Permissions", p)
if L.get("other_permission"):  # "Others" opens a text field for what the permission is for
    set_value("document.getElementById('otherAuth')", L["other_permission"], "HTMLInputElement")
tick("Includes Third-Party SDKs", "true" if L.get("third_party_sdk") else "false")
tick("Plays Full Music Tracks", "1" if L.get("music") else "0")
set_value("document.querySelector('textarea#remarks')", L["notes"], "HTMLTextAreaElement")
time.sleep(2)

# state, for checking before handing over
print("package ", js("[...document.querySelectorAll('.ant-upload-list-text .ant-upload-list-item')].map(i => i.innerText)"))
print("version ", js("document.querySelector('#version').value"))
print("devices ", js("document.querySelectorAll('#devices ~ * .ant-select-selection-item, .ant-select-selection-overflow-item:not(.ant-select-selection-overflow-item-suffix)').length"))
print("selects ", js("[...document.querySelectorAll('.ant-select-single .ant-select-selection-item')].map(s => s.innerText)"))
print("names   ", js("[...document.querySelectorAll(\"input[id$='.app_name']\")].map(e => e.value)"))
print("shorts  ", js("[...document.querySelectorAll(\"input[id$='.brief_description']\")].map(e => e.value.length)"))
print("descs ok", js("[...document.querySelectorAll(\"textarea[id$='.description']\")].map(e => e.value.length)"),
      [len(L["langs"][l]["description"]) for l in LANGS])
for label in SLOTS:
    print(f"{label}: {image_counts(label)}")
print("checked ", js("[...document.querySelectorAll('.ant-radio-wrapper-checked, .ant-checkbox-wrapper-checked')].map(w => w.innerText.trim().slice(0, 40))"))
print("privacy ", len(js("document.querySelector('textarea#privacy_statement').value")), "notes", len(js("document.querySelector('textarea#remarks').value")))
print("errors  ", js("[...document.querySelectorAll('.ant-form-item-explain-error, .ant-message-notice')].map(e => e.innerText)"))
