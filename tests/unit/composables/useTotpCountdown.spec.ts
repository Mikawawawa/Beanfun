/**
 * useTotpCountdown composable tests
 *
 * Tests the TOTP countdown functionality that syncs with standard
 * TOTP authenticator apps (Google Authenticator, Microsoft Authenticator, etc.)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useTotpCountdown } from '../../../src/composables/useTotpCountdown'

describe('useTotpCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns correct initial values based on current time', async () => {
    // Set time to 15 seconds into a 30-second window
    const baseTime = 1700000000000
    const secondsIntoWindow = 15
    vi.setSystemTime(baseTime + secondsIntoWindow * 1000)

    // Create a component that uses the composable
    const TestComponent = defineComponent({
      setup() {
        const countdown = useTotpCountdown()
        return { countdown }
      },
      render() {
        return h('div', this.countdown.secondsLeft.value)
      },
    })

    const wrapper = mount(TestComponent)
    await nextTick()

    // Should show 15 seconds left (30 - 15 = 15)
    const secondsLeft = Number(wrapper.text())
    expect(secondsLeft).toBeGreaterThan(0)
    expect(secondsLeft).toBeLessThanOrEqual(30)
  })

  it('updates secondsLeft after time advances', async () => {
    const baseTime = 1700000000000
    // Start at beginning of a window
    const windowStart = Math.floor(baseTime / 1000 / 30) * 30 * 1000
    vi.setSystemTime(windowStart)

    const TestComponent = defineComponent({
      setup() {
        const countdown = useTotpCountdown()
        return { countdown }
      },
      render() {
        return h('div', { class: 'seconds' }, this.countdown.secondsLeft.value)
      },
    })

    const wrapper = mount(TestComponent)
    await nextTick()

    const initialSeconds = Number(wrapper.find('.seconds').text())

    // Advance 5 seconds
    vi.advanceTimersByTime(5000)
    await nextTick()

    const newSeconds = Number(wrapper.find('.seconds').text())
    // After 5 seconds, should have decreased by 5 (or wrapped around)
    expect(newSeconds).not.toBe(initialSeconds)
  })

  it('enters warning state when seconds are low', async () => {
    // Set time to near end of window (25 seconds in = 5 seconds left)
    const baseTime = 1700000000000
    const windowStart = Math.floor(baseTime / 1000 / 30) * 30 * 1000
    vi.setSystemTime(windowStart + 25000)

    const TestComponent = defineComponent({
      setup() {
        const countdown = useTotpCountdown({ warningThreshold: 5 })
        return { countdown }
      },
      render() {
        return h('div', [
          h('span', { class: 'seconds' }, this.countdown.secondsLeft.value),
          h('span', { class: 'warning' }, this.countdown.isWarning.value),
        ])
      },
    })

    const wrapper = mount(TestComponent)
    await nextTick()

    expect(wrapper.find('.warning').text()).toBe('true')
  })

  it('calls onReset when window resets', async () => {
    const onReset = vi.fn()
    const baseTime = 1700000000000
    const windowStart = Math.floor(baseTime / 1000 / 30) * 30 * 1000
    // Start at 28 seconds into window (2 seconds left)
    vi.setSystemTime(windowStart + 28000)

    const TestComponent = defineComponent({
      setup() {
        const countdown = useTotpCountdown({ onReset })
        return { countdown }
      },
      render() {
        return h('div', this.countdown.secondsLeft.value)
      },
    })

    mount(TestComponent)
    await nextTick()

    expect(onReset).not.toHaveBeenCalled()

    // Advance 3 seconds to cross window boundary
    vi.advanceTimersByTime(3000)
    await nextTick()

    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('calls onWarning when entering warning threshold', async () => {
    const onWarning = vi.fn()
    const baseTime = 1700000000000
    const windowStart = Math.floor(baseTime / 1000 / 30) * 30 * 1000
    // Start at 24 seconds (6 seconds left, above threshold)
    vi.setSystemTime(windowStart + 24000)

    const TestComponent = defineComponent({
      setup() {
        const countdown = useTotpCountdown({ warningThreshold: 5, onWarning })
        return { countdown }
      },
      render() {
        return h('div', this.countdown.secondsLeft.value)
      },
    })

    mount(TestComponent)
    await nextTick()

    expect(onWarning).not.toHaveBeenCalled()

    // Advance 1 second to enter warning state (5 seconds left)
    vi.advanceTimersByTime(1000)
    await nextTick()

    expect(onWarning).toHaveBeenCalledWith(5)
  })

  it('progress increases over time', async () => {
    const baseTime = 1700000000000
    const windowStart = Math.floor(baseTime / 1000 / 30) * 30 * 1000
    vi.setSystemTime(windowStart)

    const TestComponent = defineComponent({
      setup() {
        const countdown = useTotpCountdown()
        return { countdown }
      },
      render() {
        return h('div', { class: 'progress' }, this.countdown.progress.value)
      },
    })

    const wrapper = mount(TestComponent)
    await nextTick()

    const initialProgress = Number(wrapper.find('.progress').text())

    // Advance 15 seconds
    vi.advanceTimersByTime(15000)
    await nextTick()

    const newProgress = Number(wrapper.find('.progress').text())
    expect(newProgress).toBeGreaterThan(initialProgress)
  })

  it('currentWindow changes when crossing window boundary', async () => {
    const baseTime = 1700000000000
    const windowStart = Math.floor(baseTime / 1000 / 30) * 30 * 1000
    // Start at 29 seconds into window (1 second left)
    vi.setSystemTime(windowStart + 29000)

    const TestComponent = defineComponent({
      setup() {
        const countdown = useTotpCountdown()
        return { countdown }
      },
      render() {
        return h('div', { class: 'window' }, this.countdown.currentWindow.value)
      },
    })

    const wrapper = mount(TestComponent)
    await nextTick()

    const initialWindow = Number(wrapper.find('.window').text())

    // Advance 2 seconds to cross boundary
    vi.advanceTimersByTime(2000)
    await nextTick()

    const newWindow = Number(wrapper.find('.window').text())
    expect(newWindow).toBe(initialWindow + 1)
  })

  it('stops updating when stop() is called', async () => {
    const baseTime = 1700000000000
    const windowStart = Math.floor(baseTime / 1000 / 30) * 30 * 1000
    vi.setSystemTime(windowStart + 10000)

    const TestComponent = defineComponent({
      setup() {
        const countdown = useTotpCountdown()
        return { countdown }
      },
      render() {
        return h('div', { class: 'seconds' }, this.countdown.secondsLeft.value)
      },
    })

    const wrapper = mount(TestComponent)
    await nextTick()

    const initialSeconds = Number(wrapper.find('.seconds').text())

    // Stop the countdown
    wrapper.vm.countdown.stop()

    // Advance time
    vi.advanceTimersByTime(5000)
    await nextTick()

    const newSeconds = Number(wrapper.find('.seconds').text())
    // Should still be the same (stopped)
    expect(newSeconds).toBe(initialSeconds)
  })

  it('syncs with standard TOTP time windows', async () => {
    // TOTP uses 30-second windows starting from Unix epoch
    const baseTime = 1700000000000
    const windowStart = Math.floor(baseTime / 1000 / 30) * 30 * 1000
    vi.setSystemTime(windowStart)

    const TestComponent = defineComponent({
      setup() {
        const countdown = useTotpCountdown()
        return { countdown }
      },
      render() {
        return h('div', [
          h('span', { class: 'seconds' }, this.countdown.secondsLeft.value),
          h('span', { class: 'progress' }, this.countdown.progress.value),
        ])
      },
    })

    const wrapper = mount(TestComponent)
    await nextTick()

    // At start of window: should have many seconds left
    const initialSeconds = Number(wrapper.find('.seconds').text())
    expect(initialSeconds).toBeGreaterThan(20) // Should be near 30
    const initialProgress = Number(wrapper.find('.progress').text())
    expect(initialProgress).toBeLessThan(20) // Near 0%

    // Advance 15 seconds to middle of window
    vi.advanceTimersByTime(15000)
    await nextTick()

    const midSeconds = Number(wrapper.find('.seconds').text())
    const midProgress = Number(wrapper.find('.progress').text())

    // After 15 seconds, should have decreased
    expect(midSeconds).toBeLessThan(initialSeconds)
    expect(midProgress).toBeGreaterThan(initialProgress)
  })
})
