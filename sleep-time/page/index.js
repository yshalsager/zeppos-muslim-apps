import { createWidget, deleteWidget, widget, prop, event, setStatusBarVisible } from '@zos/ui'
import { push } from '@zos/router'
import { Time } from '@zos/sensor'
import { T, L, timeText, durText, minutesUntil, lang, watch24 } from '../lib/env'
import { load, save } from '../lib/store'
import { now, upcoming, clockAt } from '../lib/alarms'
import { C, text, button } from '../lib/ui'
import { MODES, BEST, results, stepHour, stepMinute, hourText, minuteText, meridiem, is24 } from '../lib/sleep'

const M = L.main

Page({
  build() {
    setStatusBarVisible(false) // the bar overlaps the tabs
    this.clock = new Time()
    this.clock.onPerMinute(() => this.widgets && this.update())
    this.s = load()
    this.mode = this.s.mode
    this.render()
  },

  onResume() {
    if (!this.s) return
    this.s = load() // the settings or alarm page may have changed something; this.mode stays
    this.render()
  },

  // the set time: the wake or bed time, or now
  t() {
    if (this.mode === 'now') return this.clock.getHours() * 60 + this.clock.getMinutes()
    return this.s[this.mode]
  },

  // Full redraw: on start, on a tab change, back from another page
  render() {
    for (const w of this.widgets || []) deleteWidget(w)
    const W = (this.widgets = [])
    const add = (w) => (W.push(w), w)
    const mode = this.mode
    MODES.forEach((m, i) => {
      const on = m === mode
      add(button(M.tabs[i], T.tabs[m], () => this.setMode(m), on ? C.accent : C.cell, on ? C.white : C.dim))
    })
    this.hour = add(text(M.hour.value, '', C.white))
    add(text(M.colon, ':', C.white))
    this.minute = add(text(M.minute.value, '', C.white))
    if (mode !== 'now') {
      add(button(M.hour.minus, '-', () => this.change(stepHour, -1)))
      add(button(M.hour.plus, '+', () => this.change(stepHour, 1)))
      add(button(M.minute.minus, '-', () => this.change(stepMinute, -1)))
      add(button(M.minute.plus, '+', () => this.change(stepMinute, 1)))
    }
    this.ampm = add(text(M.ampm, '', C.dim))
    add(text(M.hint, T.hint[mode], C.dim))
    this.cells = results(mode, 0, this.s.cycle, this.s.fall).map((r, i) => {
      const best = BEST.includes(r.cycles)
      const b = M.cells[i]
      add(createWidget(widget.FILL_RECT, { ...b.cell, color: best ? C.best : C.cell }))
      const cell = { time: add(text(b.time, '', best ? C.bestTime : C.white)), dur: add(text(b.dur, '', best ? C.bestDur : C.dim)) }
      // a tap area on top: an IMG with a size and no image (guide/watch-faces.md)
      add(createWidget(widget.IMG, { ...b.cell })).addEventListener(event.CLICK_UP, () => this.pick(i))
      return cell
    })
    // bottom row: Settings; with an alarm set, the alarm chip (tap to cancel) and a gear
    const settings = () => push({ url: 'page/settings' })
    this.chip = null
    if (upcoming(now())) {
      add(createWidget(widget.FILL_RECT, { ...M.chip, color: C.best }))
      add(createWidget(widget.IMG, { ...M.chipIcon, src: 'icons/alarm.png' }))
      this.chip = add(text(M.chipText, '', C.bestTime))
      add(createWidget(widget.IMG, { ...M.chip })).addEventListener(event.CLICK_UP, () => push({ url: 'page/alarm' }))
      add(createWidget(widget.BUTTON, { ...M.gear, normal_src: 'icons/gear.png', press_src: 'icons/gear-press.png', click_func: settings }))
    } else add(button(M.settings, T.settings, settings))
    this.update()
  },

  // Text only: after a stepper tap, and every minute
  update() {
    const t = this.t()
    const h24 = is24(this.s.clock, watch24)
    this.hour.setProperty(prop.TEXT, hourText(t, h24, lang))
    this.minute.setProperty(prop.TEXT, minuteText(t, lang))
    this.ampm.setProperty(prop.TEXT, meridiem(t, h24, lang))
    this.shown = results(this.mode, t, this.s.cycle, this.s.fall)
    this.shown.forEach((r, i) => {
      this.cells[i].time.setProperty(prop.TEXT, timeText(r.time, this.s))
      this.cells[i].dur.setProperty(prop.TEXT, durText(r.sleep))
    })
    if (this.chip) {
      const n = now()
      const up = upcoming(n)
      if (!up) return setTimeout(() => this.render(), 0) // it just rang: back to the Settings button
      this.chip.setProperty(prop.TEXT, T.chip(timeText(clockAt(n, up.at), this.s), durText(minutesUntil(up.at, n))))
    }
  },

  // A result tapped: confirm an alarm at that wake time, or (wake-up mode) at the set wake time
  // with a bedtime reminder at that bedtime
  pick(i) {
    const r = this.shown[i]
    const p = this.mode === 'wake' ? { wake: this.s.wake, remind: r.time } : { wake: r.time, sleep: r.sleep }
    push({ url: 'page/alarm', params: JSON.stringify(p) })
  },

  setMode(m) {
    if (m === this.mode) return
    this.mode = m
    setTimeout(() => this.render(), 0) // not while the tapped button's handler is running
  },

  change(fn, d) {
    this.s[this.mode] = fn(this.s[this.mode], d)
    save(this.s) // the last wake and bed times come back next time
    this.update()
  },

  onDestroy() {
    if (this.clock && typeof this.clock.offPerMinute === 'function') this.clock.offPerMinute()
  },
})
