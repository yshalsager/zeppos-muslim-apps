# Fills a Zepp developer console release form (watch face or app) from a project's store listing
# file. Never submits. Run with the form already open in the attached browser-use tab:
#   ZAB=/abs/x.zab LISTING=/abs/store-listing.json PREVIEWS=/abs/dir \
#     browser-use < .agents/skills/zepp-store-release/fill_form.py
# PREVIEWS holds one <lang>.png per listing language. Safe to re-run: steps already done are
# skipped. Prints the form's state at the end; check it before handing over.
import json, os, time

L = json.load(open(os.environ["LISTING"]))
ZAB = os.environ["ZAB"]
PREVIEWS = os.environ["PREVIEWS"].rstrip("/") + "/"
LANGS = list(L["langs"])  # en first: the console's default language panel
CAT = '#' + L.get('category_field', 'category_watch')  # the watch face form's id; check the app form's
NAME, DESC = "input[placeholder='Up to 30 Characters']", "textarea[placeholder='Up to 400 Characters']"

# The tab is usually in the background, where Ant Design dropdowns never open and some state
# updates wait for a repaint: bring it to the front, and use focus + keys instead of clicks.
activate_tab(current_tab())
if not js("!!document.querySelector(\"input[type=file][accept='.zab']\")"):
    raise SystemExit(f"Not on a release form (no .zab upload field): {page_info()['url']}")


def key(k, code, vk):
    cdp("Input.dispatchKeyEvent", type="keyDown", key=k, code=code, windowsVirtualKeyCode=vk)
    cdp("Input.dispatchKeyEvent", type="keyUp", key=k, code=code, windowsVirtualKeyCode=vk)


def file_inputs(accept):
    doc = cdp("DOM.getDocument", depth=-1, pierce=True)
    return cdp("DOM.querySelectorAll", nodeId=doc["root"]["nodeId"], selector=f"input[type=file][accept='{accept}']")["nodeIds"]


def set_value(sel, idx, v, proto):  # React-controlled fields need the native setter + an input event
    js(f"""(() => {{ const el = document.querySelectorAll({json.dumps(sel)})[{idx}];
      Object.getOwnPropertyDescriptor(window.{proto}.prototype, 'value').set.call(el, {json.dumps(v)});
      el.dispatchEvent(new Event('input', {{ bubbles: true }})) }})()""")


def wait(cond, secs=30):
    for _ in range(secs):
        if js(cond):
            return True
        time.sleep(1)
    return False


def preview_counts():
    return js("[...document.querySelectorAll('.ant-upload-list-picture-card')].map(l => l.querySelectorAll('img').length)")


# 1. package: the console reads the supported devices from it
if os.path.basename(ZAB) not in js("document.querySelector('.ant-upload-list-text')?.innerText || ''"):
    cdp("DOM.setFileInputFiles", nodeId=file_inputs(".zab")[0], files=[ZAB])
    wait(f"document.querySelector('.ant-upload-list-text')?.innerText.includes({json.dumps(os.path.basename(ZAB))})", 60)
    time.sleep(3)

# 2. category: the first option is highlighted when the list opens, so ArrowDown + Enter picks it
for _ in range(3):
    got = js(f"document.querySelector({json.dumps(CAT)})?.closest('.ant-form-item').querySelector('.ant-select-selection-item')?.innerText || ''")
    if got == L["category"]:
        break
    js(f"document.querySelector({json.dumps(CAT + ' input')}).focus()"); time.sleep(0.5)
    key("ArrowDown", "ArrowDown", 40); time.sleep(1)
    if js(f"[...document.querySelectorAll('.ant-select-item-option-active')].some(o => o.innerText === {json.dumps(L['category'])})"):
        key("Enter", "Enter", 13)
    else:  # not the first option: type to filter
        cdp("Input.insertText", text=L["category"]); time.sleep(1); key("Enter", "Enter", 13)
    time.sleep(1)

# 3. extra languages: add each in the "other languages" box, then tick its checkbox (that opens its panel)
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

# 4. names, descriptions (panels are in LANGS order), review notes
for i, lang in enumerate(LANGS):
    set_value(NAME, i, L["langs"][lang]["name"], "HTMLInputElement")
    set_value(DESC, i, L["langs"][lang]["description"], "HTMLTextAreaElement")
set_value("textarea:not([placeholder])", 0, L["notes"], "HTMLTextAreaElement")

# 5. one preview per language; uploads can take several seconds, so wait before moving on
#    (re-sending a slow upload adds a second image)
for i, lang in enumerate(LANGS):
    if preview_counts()[i]:
        continue
    cdp("DOM.setFileInputFiles", nodeId=file_inputs(".png,.gif")[i], files=[PREVIEWS + lang + ".png"])
    wait(f"[...document.querySelectorAll('.ant-upload-list-picture-card')][{i}].querySelectorAll('img').length > 0")

time.sleep(3)
print("package ", js("[...document.querySelectorAll('.ant-upload-list-text .ant-upload-list-item')].map(i => i.innerText)"))
print("selected", js("[...document.querySelectorAll('.ant-select-selection-item')].map(e => e.innerText)"))
print("names   ", js(f"[...document.querySelectorAll({json.dumps(NAME)})].map(e => e.value)"))
print("descs ok", js(f"[...document.querySelectorAll({json.dumps(DESC)})].map(e => e.value)") == [L["langs"][l]["description"] for l in LANGS])
print("previews", preview_counts(), "(want one each)")
print("errors  ", js("[...document.querySelectorAll('.ant-form-item-has-error')].map(f => f.innerText.slice(0, 80))"))
