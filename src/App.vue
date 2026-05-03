<script setup lang="ts">
/**
 * Root shell for the Beanfun frontend.
 *
 * # Boot sequence (runs once in `onMounted`)
 *
 * 1. `config.loadAll()` — pull every Config.xml entry into the
 *    in-memory cache. Subsequent `config.get(key)` calls return
 *    instantly without an IPC hop.
 * 2. `account.loadAccounts()` — decrypt `Users.dat` once into the
 *    account store. Mirrors WPF `MainWindow ctor` calling
 *    `accountManager.readRecord()` at startup so login-form
 *    prefill (P12.2 D2.5 / D2.7) and the ManageAccount page
 *    (P12.2 D9) read from a populated cache without a per-mount
 *    IPC hop. Soft-fails the same way `config.loadAll` does — a
 *    corrupt Users.dat or DPAPI failure must not soft-brick boot
 *    (the user can still pick "register a new account" or recover
 *    via Settings).
 * 3. `ui.applyAll()` — push the loaded config values out as DOM
 *    side effects: `setPrimaryColor` for the theme + the
 *    registered locale applier for vue-i18n. Either step
 *    soft-fails to defaults — a corrupt Config.xml entry must
 *    never soft-brick boot.
 * 4. Auto-login (if enabled) — attempt to restore the previous
 *    session or auto-login with saved credentials. On success,
 *    redirect to `/accounts` directly, skipping the login form.
 *
 * All three calls run sequentially; `ui.applyAll()` reads from the
 * cache `config.loadAll()` populates so step 1 must finish before
 * step 3. Step 2 is independent of steps 1/3 (account state is
 * read by `IdPassForm` / `VerifyPage` mount-time prefill, not the
 * root shell), but lives in the boot sequence rather than a
 * lazy-on-mount hook so the very first navigation to `/login`
 * never paints a half-empty form.
 *
 * # Why `<el-config-provider>` at the root
 *
 * Element Plus components read their locale from the nearest
 * `<el-config-provider>` ancestor; placing it at the app root means
 * every `<el-*>` (across every page in P12) inherits the
 * user-selected language without per-page boilerplate. The locale
 * prop is bound to the UI store's reactive `language` getter, so
 * `setLanguage(...)` flips both the application's vue-i18n locale
 * and Element Plus's component-level translations in one shot.
 */

import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElConfigProvider, ElMessage } from 'element-plus'
import enLocale from 'element-plus/dist/locale/en.mjs'
import zhCnLocale from 'element-plus/dist/locale/zh-cn.mjs'
import zhTwLocale from 'element-plus/dist/locale/zh-tw.mjs'

import { useAccountStore } from './stores/account'
import { useConfigStore } from './stores/config'
import { useUiStore, type AppLocale } from './stores/ui'
import { commands } from './types/bindings'

const account = useAccountStore()
const config = useConfigStore()
const ui = useUiStore()
const router = useRouter()

/**
 * Map our internal locale code to the matching Element Plus locale
 * pack. Centralized so adding a fourth locale (P12+) is a one-line
 * edit instead of a hunt-through-templates exercise.
 */
const ELP_LOCALE_MAP: Record<AppLocale, typeof zhTwLocale> = {
  'zh-TW': zhTwLocale,
  'zh-CN': zhCnLocale,
  'en-US': enLocale,
}

const elpLocale = computed(() => ELP_LOCALE_MAP[ui.language])

onMounted(async () => {
  try {
    await config.loadAll()
  } catch (err) {
    // The wrapCommand toast already fired; we just keep boot going so
    // the user can still see *something* (default theme + zh-TW) and
    // retry from Settings instead of staring at a blank window.
    console.error('[App.vue] config.loadAll failed; falling back to defaults', err)
    ElMessage.warning('Config.xml 載入失敗，使用預設設定。')
  }

  try {
    await account.loadAccounts()
  } catch (err) {
    /*
     * Same soft-fail pattern as `config.loadAll` — a corrupt
     * `Users.dat` or DPAPI failure must not block boot. The
     * `wrapCommand` toast already fired with the structured error
     * code; the account cache stays empty and downstream prefill
     * paths (IdPassForm / VerifyPage / ManageAccount) treat that
     * as "no saved credentials" rather than crashing.
     */
    console.error('[App.vue] account.loadAccounts failed; starting with empty cache', err)
  }

  ui.applyAll()
  ui.applyDarkMode(ui.darkMode)

  // Auto-login: attempt to restore session or auto-login with saved credentials
  if (config.enableAutoLogin) {
    console.log('[App.vue] Auto-login enabled, attempting to restore session...')
    const restoreResult = await commands.tryRestoreSession()
    if (restoreResult.status === 'ok') {
      if (restoreResult.data.type === 'success') {
        console.log('[App.vue] Session restored successfully, redirecting to /accounts')
        router.replace('/accounts')
        return
      }
      console.log('[App.vue] Session restore failed:', restoreResult.data.type)
    } else {
      console.warn('[App.vue] Session restore error:', restoreResult.error)
    }

    // Session restore failed, try auto-login with saved credentials
    console.log('[App.vue] Attempting auto-login with saved credentials...')
    const loginResult = await commands.autoLogin()
    if (loginResult.status === 'ok') {
      if (loginResult.data.type === 'success') {
        console.log('[App.vue] Auto-login succeeded, redirecting to /accounts')
        router.replace('/accounts')
        return
      }
      if (loginResult.data.type === 'requiresTotp') {
        console.log('[App.vue] Auto-login requires TOTP, redirecting to /login/totp')
        router.replace('/login/totp')
        return
      }
      if (loginResult.data.type === 'requiresVerify') {
        console.log('[App.vue] Auto-login requires verification, redirecting to /login/verify')
        router.replace('/login/verify')
        return
      }
      console.log('[App.vue] Auto-login failed:', loginResult.data.type)
    } else {
      console.warn('[App.vue] Auto-login error:', loginResult.error)
    }

    // Both restore and auto-login failed, continue to normal login flow
    console.log('[App.vue] Auto-login not possible, continuing to login page')
  }
})
</script>

<template>
  <el-config-provider :locale="elpLocale">
    <RouterView />
  </el-config-provider>
</template>

<style>
/* ============================================
   CSS Variables System - Light/Dark Mode
   ============================================ */

:root {
  /* ---- Beanfun Design Tokens (Light Mode) ---- */
  
  /* Background Colors */
  --bf-bg-primary: #ffffff;
  --bf-bg-secondary: #f5f5f5;
  --bf-bg-tertiary: #e8e8e8;
  --bf-bg-hover: #fafafa;
  --bf-bg-active: #f0f0f0;
  
  /* Text Colors */
  --bf-text-primary: #171717;
  --bf-text-secondary: #525252;
  --bf-text-tertiary: #737373;
  --bf-text-disabled: #a3a3a3;
  --bf-text-inverse: #ffffff;
  
  /* Border Colors */
  --bf-border: #e5e5e5;
  --bf-border-hover: #d4d4d4;
  --bf-border-active: #a3a3a3;
  
  /* Functional Colors */
  --bf-success: #22c55e;
  --bf-warning: #f59e0b;
  --bf-danger: #ef4444;
  --bf-info: #3b82f6;
  
  /* Legacy alias for compatibility */
  --bf-on-surface: var(--bf-text-primary);
  
  /* ---- Element Plus Theme (Light Mode) ---- */
  --el-color-primary: #171717;
  --el-color-primary-dark-2: #000000;
  --el-color-primary-light-3: #404040;
  --el-color-primary-light-5: #737373;
  --el-color-primary-light-7: #a3a3a3;
  --el-color-primary-light-8: #d4d4d4;
  --el-color-primary-light-9: #f5f5f5;
  --el-color-success: #22c55e;
  --el-color-warning: #f59e0b;
  --el-color-danger: #ef4444;
  --el-color-info: #3b82f6;
  
  /* Element Plus Background */
  --el-bg-color: #ffffff;
  --el-bg-color-page: #f5f5f5;
  --el-bg-color-overlay: #ffffff;
  
  /* Element Plus Text */
  --el-text-color-primary: #171717;
  --el-text-color-regular: #525252;
  --el-text-color-secondary: #737373;
  --el-text-color-placeholder: #a3a3a3;
  --el-text-color-disabled: #d4d4d4;
  
  /* Element Plus Border */
  --el-border-color: #e5e5e5;
  --el-border-color-light: #f0f0f0;
  --el-border-color-lighter: #f5f5f5;
  --el-border-color-extra-light: #fafafa;
  --el-border-color-dark: #d4d4d4;
  --el-border-color-darker: #a3a3a3;
  
  /* Element Plus Fill */
  --el-fill-color: #f0f0f0;
  --el-fill-color-light: #f5f5f5;
  --el-fill-color-lighter: #fafafa;
  --el-fill-color-extra-light: #fafafa;
  --el-fill-color-dark: #e8e8e8;
  --el-fill-color-darker: #e5e5e5;
  --el-fill-color-blank: #ffffff;
  
  /* ---- Typography ---- */
  font-family:
    'Inter',
    -apple-system,
    'Segoe UI',
    sans-serif;
  font-size: 14px;
  line-height: 1.5;
  
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

/* ---- Dark Mode ---- */
[data-theme="dark"] {
  /* Beanfun Design Tokens (Dark Mode) */
  
  /* Background Colors */
  --bf-bg-primary: #0a0a0a;
  --bf-bg-secondary: #171717;
  --bf-bg-tertiary: #262626;
  --bf-bg-hover: #1a1a1a;
  --bf-bg-active: #262626;
  
  /* Text Colors */
  --bf-text-primary: #fafafa;
  --bf-text-secondary: #a3a3a3;
  --bf-text-tertiary: #737373;
  --bf-text-disabled: #525252;
  --bf-text-inverse: #171717;
  
  /* Border Colors */
  --bf-border: #262626;
  --bf-border-hover: #404040;
  --bf-border-active: #525252;
  
  /* Functional Colors - Adjusted for dark mode visibility */
  --bf-success: #4ade80;
  --bf-warning: #fbbf24;
  --bf-danger: #f87171;
  --bf-info: #60a5fa;
  
  /* ---- Element Plus Theme (Dark Mode) ---- */
  --el-color-primary: #fafafa;
  --el-color-primary-dark-2: #ffffff;
  --el-color-primary-light-3: #d4d4d4;
  --el-color-primary-light-5: #a3a3a3;
  --el-color-primary-light-7: #737373;
  --el-color-primary-light-8: #525252;
  --el-color-primary-light-9: #262626;
  --el-color-success: #4ade80;
  --el-color-warning: #fbbf24;
  --el-color-danger: #f87171;
  --el-color-info: #60a5fa;
  
  /* Element Plus Background */
  --el-bg-color: #0a0a0a;
  --el-bg-color-page: #171717;
  --el-bg-color-overlay: #171717;
  
  /* Element Plus Text */
  --el-text-color-primary: #fafafa;
  --el-text-color-regular: #a3a3a3;
  --el-text-color-secondary: #737373;
  --el-text-color-placeholder: #525252;
  --el-text-color-disabled: #404040;
  
  /* Element Plus Border */
  --el-border-color: #262626;
  --el-border-color-light: #171717;
  --el-border-color-lighter: #0a0a0a;
  --el-border-color-extra-light: #0a0a0a;
  --el-border-color-dark: #404040;
  --el-border-color-darker: #525252;
  
  /* Element Plus Fill */
  --el-fill-color: #262626;
  --el-fill-color-light: #171717;
  --el-fill-color-lighter: #0a0a0a;
  --el-fill-color-extra-light: #0a0a0a;
  --el-fill-color-dark: #404040;
  --el-fill-color-darker: #525252;
  --el-fill-color-blank: #0a0a0a;
}

/* ---- Base Styles ---- */
html,
body,
#app {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--bf-bg-primary);
  color: var(--bf-text-primary);
}

/* ---- Native app feel ---- */
body {
  -webkit-user-select: none;
  user-select: none;
}

input,
textarea,
[contenteditable='true'] {
  -webkit-user-select: text;
  user-select: text;
}

/* ---- Smooth scrollbar ---- */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background-color: var(--bf-outline, #d4d4d4);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background-color: var(--bf-on-surface-variant, #525252);
}

/* ---- Element Plus — refined button styles ---- */
.el-button--primary {
  background-color: var(--el-color-primary, #171717) !important;
  border-color: var(--el-color-primary, #171717) !important;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.el-button--primary:hover,
.el-button--primary:focus {
  background-color: #404040 !important;
  border-color: #404040 !important;
}

.el-button--primary:active {
  background-color: #000000 !important;
  border-color: #000000 !important;
}

/* ---- Element Plus inputs ---- */
.el-input__wrapper {
  background-color: var(--bf-surface, #ffffff) !important;
  box-shadow: 0 0 0 1px var(--bf-outline, #d4d4d4) inset !important;
  transition: box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.el-input__wrapper:hover {
  box-shadow: 0 0 0 1px #a3a3a3 inset !important;
}

.el-input__wrapper.is-focus {
  box-shadow: 0 0 0 2px var(--el-color-primary, #171717) inset !important;
}

/* ---- Element Plus checkbox ---- */
.el-checkbox__input.is-checked .el-checkbox__inner {
  background-color: var(--el-color-primary, #171717) !important;
  border-color: var(--el-color-primary, #171717) !important;
}

/* ---- Element Plus select ---- */
.el-select .el-input.is-focus .el-input__wrapper {
  box-shadow: 0 0 0 2px var(--el-color-primary, #171717) inset !important;
}

/* ---- Element Plus MessageBox ---- */
.el-overlay {
  background: rgba(0, 0, 0, 0.5) !important;
  backdrop-filter: blur(4px);
}

.el-message-box {
  border-radius: var(--bf-radius-panel, 12px) !important;
  border: 1px solid var(--bf-outline-variant, #e5e5e5) !important;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.12),
    0 1px 4px rgba(0, 0, 0, 0.06) !important;
  padding: 1.5rem !important;
}

.el-message-box__header {
  padding: 0 0 1rem !important;
}

.el-message-box__title {
  font-size: 1rem !important;
  font-weight: 600 !important;
  color: var(--bf-on-surface, #171717) !important;
}

.el-message-box__content {
  padding: 0 !important;
  font-size: 0.875rem !important;
  color: var(--bf-on-surface-variant, #525252) !important;
}

.el-message-box__btns {
  padding: 1.25rem 0 0 !important;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.el-message-box__btns .el-button--primary {
  background: var(--el-color-primary, #171717) !important;
  border-color: var(--el-color-primary, #171717) !important;
  color: #ffffff !important;
  border-radius: var(--bf-radius-button, 6px) !important;
  font-weight: 500 !important;
  padding: 8px 16px !important;
}

/* ============================================
   Element Plus Dark Mode Overrides
   ============================================ */

/* ---- Checkbox ---- */
[data-theme="dark"] .el-checkbox {
  color: var(--bf-text-primary) !important;
}

[data-theme="dark"] .el-checkbox__input.is-checked + .el-checkbox__label {
  color: var(--bf-text-primary) !important;
}

/* ---- Tooltip ---- */
[data-theme="dark"] .el-popper.is-dark {
  background: var(--bf-bg-secondary) !important;
  border: 1px solid var(--bf-border) !important;
  color: var(--bf-text-primary) !important;
}

[data-theme="dark"] .el-popper.is-dark .el-popper__arrow::before {
  background: var(--bf-bg-secondary) !important;
  border: 1px solid var(--bf-border) !important;
}

/* ---- Select Dropdown ---- */
[data-theme="dark"] .el-select-dropdown {
  background: var(--bf-bg-primary) !important;
  border: 1px solid var(--bf-border) !important;
}

[data-theme="dark"] .el-select-dropdown__item {
  color: var(--bf-text-primary) !important;
}

[data-theme="dark"] .el-select-dropdown__item.hover,
[data-theme="dark"] .el-select-dropdown__item:hover {
  background: var(--bf-bg-secondary) !important;
}

[data-theme="dark"] .el-select-dropdown__item.selected {
  color: var(--el-color-primary) !important;
  background: var(--el-color-primary-light-9) !important;
}

/* ---- Dialog ---- */
[data-theme="dark"] .el-dialog {
  background: var(--bf-bg-primary) !important;
}

[data-theme="dark"] .el-dialog__title {
  color: var(--bf-text-primary) !important;
}

[data-theme="dark"] .el-dialog__body {
  color: var(--bf-text-secondary) !important;
}

/* ---- Input ---- */
[data-theme="dark"] .el-input__wrapper {
  background-color: var(--bf-bg-primary) !important;
  box-shadow: 0 0 0 1px var(--bf-border) inset !important;
}

[data-theme="dark"] .el-input__inner {
  color: var(--bf-text-primary) !important;
}

[data-theme="dark"] .el-input__wrapper:hover {
  box-shadow: 0 0 0 1px var(--bf-border-hover) inset !important;
}

[data-theme="dark"] .el-input__wrapper.is-focus {
  box-shadow: 0 0 0 2px var(--el-color-primary) inset !important;
}

/* ---- Button hover states ---- */
[data-theme="dark"] .el-button--primary:hover,
[data-theme="dark"] .el-button--primary:focus {
  background-color: var(--bf-text-secondary) !important;
  border-color: var(--bf-text-secondary) !important;
}

[data-theme="dark"] .el-button--primary:active {
  background-color: var(--bf-text-primary) !important;
  border-color: var(--bf-text-primary) !important;
}

/* ---- Message Box ---- */
[data-theme="dark"] .el-message-box {
  background: var(--bf-bg-primary) !important;
  border: 1px solid var(--bf-border) !important;
}

[data-theme="dark"] .el-message-box__title {
  color: var(--bf-text-primary) !important;
}

[data-theme="dark"] .el-message-box__content {
  color: var(--bf-text-secondary) !important;
}

/* ---- Popover ---- */
[data-theme="dark"] .el-popover {
  background: var(--bf-bg-primary) !important;
  border: 1px solid var(--bf-border) !important;
  color: var(--bf-text-primary) !important;
}

[data-theme="dark"] .el-popover__title {
  color: var(--bf-text-primary) !important;
}

/* ---- Dropdown ---- */
[data-theme="dark"] .el-dropdown-menu {
  background: var(--bf-bg-primary) !important;
  border: 1px solid var(--bf-border) !important;
}

[data-theme="dark"] .el-dropdown-menu__item {
  color: var(--bf-text-primary) !important;
}

[data-theme="dark"] .el-dropdown-menu__item:hover {
  background: var(--bf-bg-secondary) !important;
}

/* ---- Loading ---- */
[data-theme="dark"] .el-loading-mask {
  background: rgba(0, 0, 0, 0.7) !important;
}

/* ---- Notification ---- */
[data-theme="dark"] .el-notification {
  background: var(--bf-bg-primary) !important;
  border: 1px solid var(--bf-border) !important;
}

[data-theme="dark"] .el-notification__title {
  color: var(--bf-text-primary) !important;
}

[data-theme="dark"] .el-notification__content {
  color: var(--bf-text-secondary) !important;
}

/* ---- Button Link ---- */
.el-button.is-link {
  color: var(--bf-info) !important;
  background: transparent !important;
  border: none !important;
}

.el-button.is-link:hover,
.el-button.is-link:focus {
  color: var(--bf-info) !important;
  opacity: 0.8;
  background: transparent !important;
}

.el-button.is-link:active {
  color: var(--bf-info) !important;
  opacity: 0.6;
  background: transparent !important;
}

[data-theme="dark"] .el-button.is-link {
  color: var(--bf-info) !important;
  background: transparent !important;
}

[data-theme="dark"] .el-button.is-link:hover,
[data-theme="dark"] .el-button.is-link:focus {
  color: var(--bf-info) !important;
  opacity: 0.8;
  background: transparent !important;
}

[data-theme="dark"] .el-button.is-link:active {
  color: var(--bf-info) !important;
  opacity: 0.6;
  background: transparent !important;
}
</style>
