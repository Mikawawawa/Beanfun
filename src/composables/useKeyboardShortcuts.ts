/**
 * 键盘快捷键管理
 *
 * 提供全局和局部快捷键支持
 * 所有快捷键遵循 Vercel 风格：简洁、高效
 */

import { onMounted, onUnmounted, ref, type Ref } from 'vue'

export interface ShortcutConfig {
  key: string
  ctrl?: boolean
  cmd?: boolean
  alt?: boolean
  shift?: boolean
  handler: (event: KeyboardEvent) => void | boolean
  description: string
  scope?: 'global' | 'local'
}

export interface UseKeyboardShortcutsOptions {
  enabled?: Ref<boolean>
  scope?: 'global' | 'local'
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutConfig[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = ref(true), scope = 'global' } = options
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

  function handleKeyDown(event: KeyboardEvent) {
    if (!enabled.value) return

    for (const shortcut of shortcuts) {
      // 检查快捷键作用域
      if (shortcut.scope && shortcut.scope !== scope) continue

      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
      const ctrlMatch = shortcut.ctrl ? (isMac ? event.metaKey : event.ctrlKey) : true
      const cmdMatch = shortcut.cmd ? event.metaKey : true
      const altMatch = shortcut.alt ? event.altKey : true
      const shiftMatch = shortcut.shift ? event.shiftKey : true

      if (keyMatch && ctrlMatch && cmdMatch && altMatch && shiftMatch) {
        const result = shortcut.handler(event)
        if (result !== false) {
          event.preventDefault()
          event.stopPropagation()
        }
        break
      }
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
  })

  return {
    isMac
  }
}

// 常用快捷键预设
export const commonShortcuts = {
  addGame: (handler: () => void): ShortcutConfig => ({
    key: 'n',
    ctrl: true,
    handler,
    description: '添加新游戏'
  }),

  refresh: (handler: () => void): ShortcutConfig => ({
    key: 'r',
    ctrl: true,
    handler,
    description: '刷新列表'
  }),

  settings: (handler: () => void): ShortcutConfig => ({
    key: ',',
    ctrl: true,
    handler,
    description: '打开设置'
  }),

  escape: (handler: () => void): ShortcutConfig => ({
    key: 'Escape',
    handler,
    description: '关闭/取消'
  }),

  launch: (handler: () => void): ShortcutConfig => ({
    key: 'Enter',
    handler,
    description: '启动游戏'
  })
}

// 获取快捷键显示文本
export function getShortcutDisplay(shortcut: ShortcutConfig): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const parts: string[] = []

  if (shortcut.ctrl || shortcut.cmd) {
    parts.push(isMac ? '⌘' : 'Ctrl')
  }
  if (shortcut.alt) {
    parts.push(isMac ? '⌥' : 'Alt')
  }
  if (shortcut.shift) {
    parts.push('Shift')
  }

  // 特殊键映射
  const keyMap: Record<string, string> = {
    'Escape': 'Esc',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→'
  }

  parts.push(keyMap[shortcut.key] || shortcut.key)

  return parts.join(' + ')
}
