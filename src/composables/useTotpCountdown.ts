/**
 * TOTP countdown composable - 与标准TOTP工具同步的倒计时
 *
 * TOTP (Time-based One-Time Password) 使用30秒时间窗口，基于Unix时间戳计算。
 * 所有标准TOTP工具（Google Authenticator、Microsoft Authenticator等）都使用相同的算法：
 * - 时间窗口：30秒
 * - 起始点：Unix epoch (1970-01-01 00:00:00 UTC)
 * - 当前窗口 = Math.floor(currentUnixTime / 30) * 30
 * - 剩余秒数 = 30 - (currentUnixTime % 30)
 *
 * 因此前端计算的倒计时与所有标准TOTP工具完全同步。
 */

import { computed, onUnmounted, ref, type ComputedRef } from 'vue'

export interface UseTotpCountdownOptions {
  /**
   * 倒计时归零时的回调
   */
  onReset?: () => void
  /**
   * 最后N秒时的回调（用于视觉提醒）
   */
  onWarning?: (secondsLeft: number) => void
  /**
   * 警告阈值（秒），默认5秒
   */
  warningThreshold?: number
}

export interface UseTotpCountdown {
  /**
   * 当前窗口剩余秒数 (30 -> 0)
   */
  secondsLeft: ComputedRef<number>
  /**
   * 是否处于警告状态（最后几秒）
   */
  isWarning: ComputedRef<boolean>
  /**
   * 进度百分比 (0% -> 100%)
   */
  progress: ComputedRef<number>
  /**
   * 当前时间窗口的序号（用于检测窗口变化）
   */
  currentWindow: ComputedRef<number>
  /**
   * 手动停止倒计时
   */
  stop: () => void
  /**
   * 手动重新开始倒计时
   */
  start: () => void
}

const TOTP_PERIOD = 30 // TOTP标准周期为30秒

export function useTotpCountdown(options: UseTotpCountdownOptions = {}): UseTotpCountdown {
  const { onReset, onWarning, warningThreshold = 5 } = options

  // 使用ref存储当前时间戳，每秒更新
  const now = ref(Date.now())
  let intervalId: ReturnType<typeof setInterval> | null = null

  /**
   * 计算当前TOTP时间窗口序号
   * 每个窗口是30秒的整数倍
   */
  const currentWindow = computed(() => {
    const unixTime = Math.floor(now.value / 1000)
    return Math.floor(unixTime / TOTP_PERIOD)
  })

  /**
   * 计算当前窗口剩余秒数
   * 范围：30 -> 1 -> 0（然后进入下一个窗口）
   */
  const secondsLeft = computed(() => {
    const unixTime = Math.floor(now.value / 1000)
    const elapsedInWindow = unixTime % TOTP_PERIOD
    return TOTP_PERIOD - elapsedInWindow
  })

  /**
   * 是否处于警告状态（最后几秒）
   */
  const isWarning = computed(() => secondsLeft.value <= warningThreshold)

  /**
   * 进度百分比 (0% -> 100%)
   * 用于可视化进度条
   */
  const progress = computed(() => {
    const elapsed = TOTP_PERIOD - secondsLeft.value
    return (elapsed / TOTP_PERIOD) * 100
  })

  // 记录上一个窗口序号，用于检测窗口变化
  let lastWindow = currentWindow.value

  /**
   * 更新当前时间并检测窗口变化
   */
  function tick(): void {
    now.value = Date.now()

    const newWindow = currentWindow.value

    // 检测窗口变化（倒计时归零）
    if (newWindow !== lastWindow) {
      lastWindow = newWindow
      onReset?.()
    }

    // 警告回调
    if (secondsLeft.value <= warningThreshold && onWarning) {
      onWarning(secondsLeft.value)
    }
  }

  /**
   * 开始倒计时
   */
  function start(): void {
    // 先执行一次，确保立即有值
    tick()

    // 清除可能存在的旧定时器
    stop()

    // 每秒更新一次
    intervalId = setInterval(tick, 1000)
  }

  /**
   * 停止倒计时
   */
  function stop(): void {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  // 自动开始
  start()

  // 组件卸载时清理
  onUnmounted(stop)

  return {
    secondsLeft,
    isWarning,
    progress,
    currentWindow,
    stop,
    start,
  }
}
