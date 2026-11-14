import { createWidget, widget, prop, align, text_style, keyboard, createKeyboard, deleteKeyboard, inputType, getRtlLayout, setStatusBarVisible } from '@zos/ui'
import { launchApp } from '@zos/router'
import { getDeviceInfo } from '@zos/device'
import { getPackageInfo } from '@zos/app'
import { isRound, span } from '../lib/geometry'

const { width: W, height: H } = getDeviceInfo()
const ROUND = isRound(W, H)
const has = (fn) => typeof keyboard[fn] === 'function' // missing on some firmware, per Zepp docs

const T = getRtlLayout()
  ? {
      on: 'مفعّلة', off: 'غير مفعّلة',
      steps: '١. فعّلها من إعدادات لوحة المفاتيح\n٢. عند الكتابة، اضغط مطولاً على زر الكرة الأرضية واخترها',
      settings: 'إعدادات لوحة المفاتيح', tryIt: 'جرّبها', empty: '(فارغ)',
    }
  : {
      on: 'Enabled', off: 'Not enabled',
      steps: '1. Turn it on in keyboard settings\n2. When typing, long-press the globe key and pick it',
      settings: 'Keyboard settings', tryIt: 'Try it', empty: '(empty)',
    }

Page({
  build() {
    setStatusBarVisible(false) // the bar overlaps the title
    // A circle is narrow at the top and bottom: start lower, lift the buttons, and size every box
    // to the circle at its height.
    const oy = ROUND ? Math.round(H * 0.08) : 0
    const text = (y, h, size, color, value) => {
      const s = span(W, H, y, y + h, ROUND ? 10 : 30)
      return createWidget(widget.TEXT, {
        x: s.x, y, w: s.w, h, text_size: size, color, text: value,
        align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.WRAP,
      })
    }
    // Buttons sit at the bottom and the steps fill the space above them, so the steps get every
    // line the screen has (4 at 390 px wide). The typed text then replaces the steps.
    const tryY = H - 76 - (ROUND ? Math.round(H * 0.1) : 0)
    const settingsY = tryY - 70
    const b = span(W, H, tryY, tryY + 60, ROUND ? 10 : 60) // both buttons as wide as the lower one fits
    const btn = (y, value, click_func) =>
      createWidget(widget.BUTTON, {
        x: b.x, y, w: b.w, h: 60, radius: 30, text: value, text_size: 26,
        normal_color: 0x0a84ff, press_color: 0x5ab0ff, color: 0xffffff, click_func,
      })
    text(40 + oy, 50, ROUND ? 28 : 32, 0xffffff, getPackageInfo().name)
    this.status = text(90 + oy, 36, 24, 0x9e9e9e, '')
    this.steps = text(130 + oy, settingsY - 136 - oy, 24, 0xcccccc, T.steps)
    btn(settingsY, T.settings, () =>
      has('gotoSettings') ? keyboard.gotoSettings() : launchApp({ url: 'Settings_keyboardScreen', native: true }),
    )
    btn(tryY, T.tryIt, () => this.tryIt())
    this.refresh()
  },

  onResume() {
    this.refresh()
  },

  refresh() {
    if (!this.status) return
    const on = !has('isEnabled') || keyboard.isEnabled()
    this.status.setProperty(prop.TEXT, on ? T.on : T.off)
    this.status.setProperty(prop.COLOR, on ? 0x30d158 : 0xff9f0a)
  },

  tryIt() {
    createKeyboard({
      inputType: inputType.JSKB,
      text: '',
      onComplete: (_, result) => {
        deleteKeyboard()
        this.steps.setProperty(prop.TEXT, (result && result.data) || T.empty)
        this.steps.setProperty(prop.COLOR, 0xffffff)
      },
      onCancel: () => deleteKeyboard(),
    })
  },
})
