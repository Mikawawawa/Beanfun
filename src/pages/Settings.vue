<script setup lang="ts">
/**
 * Settings page — global app preferences + per-game launcher
 * preferences (P12.4 D3 / D4 / D5 / D6).
 *
 * # WPF parity
 *
 * Mirrors `Beanfun/Pages/Settings.xaml(.cs)` 1:1:
 *
 * | WPF section / control                          | SPA equivalent                                       |
 * |------------------------------------------------|------------------------------------------------------|
 * | "AppName" section header (App-scoped)          | `<section class="settings__section">` + section header |
 * | `ManageAccount` button                         | `el-button` → `router.push('/manage-account')`       |
 * | `cb_UpdateChannel` (Stable / Development)      | `el-select` writing `'Stable' \| 'Beta'` (D3 typo fix) |
 * | `cb_Language` (zh-Hant / zh-Hans / en)         | `el-select` writing `'zh-TW' \| 'zh-CN' \| 'en-US'`   |
 * | `cb_ThemeColor` (free-form hex + WPF presets)  | `el-input` + `el-color-picker` (free-form hex; P11 preset swatches) |
 * | `LoginModePanel` (TW-only Regular / QrCode)    | `el-select` `v-if="region === 'TW'"`                 |
 * | `ask_update` checkbox                          | `el-checkbox` bound to `useUiStore.askUpdate`        |
 * | `autoStartGame` checkbox                       | `el-checkbox` bound to `useUiStore.autoStartGame`    |
 * | `minimize_to_tray` checkbox                    | `el-checkbox` bound to `useUiStore.minimizeToTray`   |
 * | `disableHardwareAcceleration` checkbox         | `el-checkbox` + `ElMessageBox.alert` on toggle (WPF L217-222) |
 * | "Game" section header                          | `<section v-if="game.selectedGame">`                 |
 * | `t_GamePath` `TextBox` (read-only + click)     | `el-input readonly` + click handler → `pickGamePath` |
 * | `tradLogin` checkbox + tooltip                 | `el-checkbox` + `el-tooltip`                         |
 * | `autoKillPatcher` checkbox + tooltip           | `el-checkbox` + `el-tooltip`                         |
 * | `skipPlayWnd` checkbox + tooltip               | `el-checkbox` + `el-tooltip`                         |
 * | `btn_Tools` button                             | `el-button` (stub — P12.5 wires real MapleTools/KartTools) |
 * | `Back` button                                  | `el-button` → `router.back()`                        |
 *
 * # Mockup conflict resolution (per Todo.md P12.4 plan)
 *
 * 1. **Layout** — WPF is one long form (App / Game stacked); mockups
 *    typically use sidebar tabs. We keep the WPF one-page form to
 *    avoid introducing a tab abstraction that no other page needs
 *    (SRP: tabbing is a navigation concern, not a settings concern).
 *    Glass panel chrome from the P11 design system is layered on
 *    top for visual polish.
 *
 * 2. **ThemeColor** — WPF used `IsEditable=True ComboBox` accepting
 *    any hex string; mockups show 6 fixed swatches. We render an
 *    `el-input` (free-form) plus an `el-color-picker` for the
 *    swatch affordance. The P11 `WPF_NAMED_COLOR_ALIASES` table in
 *    `composables/useThemeColor.ts` already accepts WPF legacy
 *    named colors (`White` / `Black` / `LightBlue` / …) so an
 *    existing `Config.xml` written by the WPF client still boots
 *    cleanly.
 *
 * 3. **GamePath picker** — WPF used `OpenFileDialog` (synchronous
 *    Win32 modal); we use `@tauri-apps/plugin-dialog`'s `open()`
 *    JS API directly (D1 decision — same precedent as
 *    `ManageAccount.vue` D9). The WPF `FileDialog_Filter` resource
 *    is a pipe-delimited C# format string; we translate the
 *    leading "exe" entry into Tauri's `filters: [{ name, extensions }]`
 *    shape (Tauri can't express WPF's "match exact filename"
 *    behaviour — `extensions` is the closest equivalent).
 *
 * 4. **DisableHardwareAcceleration restart message** — WPF showed
 *    `MessageBox.Show(..., MessageBoxImage.Information)`. SPA uses
 *    `ElMessageBox.alert` with `type: 'info'`, matching the dialog
 *    shape. Message + title resource keys reused verbatim from
 *    `MsgRestartForHardwareAccel` / `MsgRestartForHardwareAccelTitle`.
 *
 * 5. **Tools button** — WPF delegated to
 *    `accountList.btn_Tools_Click` which opens the per-game tools
 *    window (MapleTools / KartTools). P12.5 owns the real handler;
 *    until then we surface a `console.warn` stub identical to
 *    `AccountList.vue`'s `handleTools` so QA can grep one marker
 *    for both call sites.
 *
 * # Why no per-checkbox "value-changed-from-config" guard
 *
 * WPF Settings.xaml.cs guards every CheckedChanged / SelectionChanged
 * handler with `if (newValue == config.GetValue(key))` to avoid
 * re-writing the same value (and to skip the post-write side-effect
 * — e.g. `App.MainWnd.checkPlayPage.IsEnabled` — when nothing
 * actually changed). The SPA uses Pinia + `el-checkbox v-model`,
 * which only fires the setter on real value changes; Element Plus
 * does not emit `change` for programmatic re-assignments via
 * `v-model`, so the guard is unnecessary noise here. The
 * Config.xml writes themselves are idempotent (`commands.setConfig`
 * is a deterministic XML write), so even the rare pathological
 * "set to current value" path is a benign no-op.
 *
 * # Why one `useUiStore` setter per checkbox (vs. a generic K-V API)
 *
 * Type safety. `setAutoKillPatcher(true)` can't accidentally write
 * to the wrong key; a generic `set(key, value)` would lose the
 * literal-key constraint and re-introduce the WPF
 * "stringly-typed Config keys scattered across handlers" problem.
 * The store maintains the per-key WPF-default semantics in one
 * place (see `stores/ui.ts` docblock).
 *
 * # AccountList top-bar wiring (D6)
 *
 * The Settings entry button lands in `AccountList.vue` alongside
 * the existing Logout icon button (matches WPF's MainWindow
 * titlebar Settings + About icons L112-139). Both Settings and
 * About are `requiresAuth: false` because WPF allowed entering
 * Settings from the login page too (WPF `Button_Click` L85-94
 * branches on `return_page` — when null, it returns to
 * `loginPage`).
 */

import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  ElButton,
  ElCheckbox,
  ElIcon,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElSelect,
  ElTooltip,
} from 'element-plus'
import {
  ArrowLeft,
  FolderOpened,
  InfoFilled,
  Operation,
  Setting as SettingIcon,
  User,
} from '@element-plus/icons-vue'
import { open as openFileDialog } from '@tauri-apps/plugin-dialog'

import { useAuthStore } from '../stores/auth'
import { useConfigStore } from '../stores/config'
import { useGameStore, gameCodeOf } from '../stores/game'
import { useUiStore, type AppLocale, type LoginMethodValue, type UpdateChannel } from '../stores/ui'
import type { GameService } from '../types/bindings'
import { TOOLS_GAME_CODES } from '../constants/tools'
import ToolsDialogStack from '../windows/ToolsDialogStack.vue'
import TitleBar from '../components/TitleBar.vue'

defineOptions({ name: 'SettingsPage' })

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const configStore = useConfigStore()
const game = useGameStore()
const ui = useUiStore()

/* --------------- D3 — App section (left half) --------------- */

/**
 * Language picker options. WPF `Settings.xaml.cs` L23-26 stores the
 * three culture names verbatim (`zh-Hant` / `zh-Hans` / `en`) with
 * ItemsSource bound to a `LanguageItem` POCO list; we mirror the
 * three options but use the SPA's locale codes (`zh-TW` / `zh-CN`
 * / `en-US`) since `useUiStore.setLanguage` types its argument as
 * {@link AppLocale} and the i18n bundle key tree uses the same
 * shape (see `i18n/index.ts` and `locales/{zh-TW,zh-CN,en-US}.json`).
 *
 * The display labels are hard-coded native-script names rather than
 * passing through `t(...)` because they should appear in the
 * source language regardless of the current UI locale (a Chinese
 * user looking at the English locale should still see "中文(繁體)"
 * for the Traditional Chinese option, not a localized translation
 * of the language name). Mirrors WPF L24-26 verbatim.
 */
const LANGUAGE_OPTIONS: ReadonlyArray<{ value: AppLocale; label: string }> = [
  { value: 'zh-TW', label: '中文(繁體)' },
  { value: 'zh-CN', label: '中文(简体)' },
  { value: 'en-US', label: 'English' },
] as const

/**
 * Update channel picker options. Display labels reuse the WPF
 * resource keys `Stable` / `Development` (the latter renders as
 * "測試版" in zh-TW); the underlying value stored to Config is
 * `'Stable'` / `'Beta'` (matching backend `Channel` enum and WPF
 * Config schema — see `stores/ui.ts::UpdateChannel` docblock).
 */
const UPDATE_CHANNEL_OPTIONS: ReadonlyArray<{ value: UpdateChannel; labelKey: string }> = [
  { value: 'Stable', labelKey: 'Stable' },
  { value: 'Beta', labelKey: 'Development' },
] as const

/**
 * Login method picker options. Values are the WPF integer literals
 * stored as strings (`'0'` Regular / `'1'` QRCode). Display labels
 * reuse WPF resource keys `Regular` / `QrCode`.
 */
const LOGIN_METHOD_OPTIONS: ReadonlyArray<{ value: LoginMethodValue; labelKey: string }> = [
  { value: '0', labelKey: 'Regular' },
  { value: '1', labelKey: 'QrCode' },
] as const

/**
 * `LoginModePanel.Visibility = TW ? Visible : Collapsed`
 * (WPF `MainWindow.xaml.cs::loginMethodChanged` L1023). Mirror the
 * same gate so HK users don't see a picker that has no QR codepath
 * (HK currently routes everything through the regular login flow).
 *
 * `auth.session?.region` resolves to `null` when the user reached
 * Settings before completing login (WPF allowed this via
 * `return_page == loginPage` branch in `Button_Click` L89). On the
 * pre-login path we hide the picker — selecting the login method
 * matters only for users who have already logged in once and want
 * to change it for next session.
 */
const showLoginModePanel = computed<boolean>(() => auth.session?.region === 'TW')

/* --------------- D3/D4 setters — `v-model` writes through store --------------- */

/**
 * Helper to convert an Element Plus `el-select` `change` event
 * into a typed setter call. Element Plus `el-select` `v-model`
 * with an enum-shaped `:value` returns the option's `value`
 * verbatim; we narrow it through the literal type the store
 * expects so an out-of-range `string` cannot silently round-trip.
 *
 * The narrowing is defensive — current `el-option` `:value`
 * bindings are already typed via the `OPTIONS` literals above —
 * but it keeps a single chokepoint if a future option list grows
 * to be loaded dynamically from backend metadata.
 */
function isAppLocaleValue(value: unknown): value is AppLocale {
  return value === 'zh-TW' || value === 'zh-CN' || value === 'en-US'
}

function isUpdateChannelValue(value: unknown): value is UpdateChannel {
  return value === 'Stable' || value === 'Beta'
}

function isLoginMethodValue(value: unknown): value is LoginMethodValue {
  return value === '0' || value === '1'
}

async function handleLanguageChange(value: AppLocale | string | number | boolean): Promise<void> {
  if (!isAppLocaleValue(value)) return
  await ui.setLanguage(value)
}

async function handleUpdateChannelChange(
  value: UpdateChannel | string | number | boolean,
): Promise<void> {
  if (!isUpdateChannelValue(value)) return
  await ui.setUpdateChannel(value)
}

async function handleLoginMethodChange(
  value: LoginMethodValue | string | number | boolean,
): Promise<void> {
  if (!isLoginMethodValue(value)) return
  await ui.setLoginMethod(value)
}

function handleManageAccount(): void {
  void router.push('/manage-account')
}

/* --------------- D5 — Game section (per-game launcher prefs) --------------- */

/**
 * Reactive game-path display value. Hydrated on mount from
 * Config.xml and refreshed after `pickGamePath` returns. The
 * `el-input` is `readonly` (matches WPF `t_GamePath.IsReadOnly`)
 * — the only mutation path is the click handler.
 *
 * `null` means "not yet hydrated" (initial paint flash); empty
 * string means "no path saved" (renders as a blank field with a
 * "click to pick" affordance); non-empty string is the resolved
 * path.
 */
const gamePath = ref<string>('')

/**
 * Build the Config.xml key WPF uses for per-game-per-region
 * launcher path persistence: `<dir_value_name>.<gameCode>` (WPF
 * `MainWindow.xaml.cs::btn_SetGamePath_Click` L1011).
 *
 * Returns `null` when no game is selected / INI is missing —
 * callers gate on the null to skip the lookup entirely instead
 * of falling back to a partial key that would silently collide
 * across games. SRP: this helper is the one place the key shape
 * is constructed so a future schema change is a one-line edit.
 */
function gamePathConfigKey(): string | null {
  const ini = settingsSelectedIni.value
  const code = settingsSelectedGameCode.value
  if (!ini || code === null || ini.dir_value_name === '') return null
  return `${ini.dir_value_name}.${code}`
}

/**
 * Hydrate {@link gamePath} from Config.xml on mount and after a
 * successful pick. Mirrors WPF `t_GamePath.Text =` writes:
 *
 * - WPF `MainWindow.xaml.cs::selectedGameChanged` L668 sets the
 *   text to `ConfigAppSettings.GetValue(dir_value_name + "." + gameCode)`.
 * - The Settings page also runs the same `GetValue` indirectly by
 *   relying on the `MainWindow` having already populated it before
 *   the user navigates here.
 *
 * The SPA cannot rely on a parent component pre-populating this
 * value (Settings is a top-level route, not a child of AccountList),
 * so we read directly from the config store. No backend round-trip
 * is needed because `useConfigStore.loadAll()` runs at boot and
 * every subsequent set goes through the in-memory cache.
 */
function refreshGamePathFromConfig(): void {
  const key = gamePathConfigKey()
  gamePath.value = key === null ? '' : (configStore.get(key) ?? '')
}

/**
 * Open a native file picker to choose the game executable, then
 * persist the result to Config.xml. Mirrors WPF
 * `MainWindow.xaml.cs::btn_SetGamePath_Click` (L996-1014):
 *
 * 1. Build the file dialog filter from `FileDialog_Filter` /
 *    `FileDialog_Title` resource templates with `game_exe`
 *    interpolated. WPF used C# `string.Format` with the pipe-
 *    delimited filter syntax `OpenFileDialog.Filter` expects;
 *    Tauri's `open()` API takes `filters: [{ name, extensions }]`
 *    instead — see "WPF deviation" below.
 * 2. Show the picker. If the user cancels (Tauri returns `null`),
 *    bail without mutating Config.
 * 3. Persist the selected path to `<dir_value_name>.<gameCode>`
 *    via `configStore.set` (auto-toasts on backend failure
 *    via `wrapCommand`).
 * 4. Update the local `gamePath` ref so the input re-renders
 *    immediately (no re-mount round-trip).
 *
 * # WPF deviation: filter shape
 *
 * WPF `OpenFileDialog.Filter` accepts `"display|pattern"` pairs
 * and lets the pattern be an exact filename (e.g. `MapleStory.exe`).
 * Tauri's filter API only supports per-extension matching
 * (`extensions: ['exe']`), so we surface "exe files" to the OS
 * picker and rely on the title (`t('FileDialog_Title', [exeName])`)
 * to communicate the expected file. The user can still pick any
 * `.exe` and the WPF launcher itself will ultimately validate the
 * path at game-launch time (`commands.launchGame` does its own
 * existence check).
 *
 * # WPF deviation: skipped pre-game-name prefix in the filter
 *
 * WPF L1001-1002 prepends `accountList.gameName.Content` to the
 * filter string ("新楓之谷主程式|MapleStory.exe|..."). The Tauri
 * API doesn't support a "prefix-style label" — `name` is just the
 * dropdown entry text. We build a single combined name
 * (`<gameName> <FileDialog_Filter[name]>`) so the dropdown still
 * carries the same context, just with a slightly different layout.
 *
 * # Why not error-toast on a Config write failure here
 *
 * `configStore.set` already toasts via `wrapCommand`. Adding a
 * second toast would double-fire the user-visible noise.
 */
async function pickGamePath(): Promise<void> {
  const ini = settingsSelectedIni.value
  const code = settingsSelectedGameCode.value
  const selected = settingsSelectedGame.value
  const key = gamePathConfigKey()

  if (!ini || !selected || code === null || key === null) {
    /*
     * Defensive: the click handler is gated on
     * `v-if="settingsSelectedGame"` at the template level, so this
     * branch should be unreachable. Surface a structured warning
     * if it ever runs (e.g. a race where the user clicks during
     * a game-switch transition) so we know the gate slipped.
     */
    ElMessage.warning(t('GameSelected'))
    return
  }

  /*
   * Derive the file extension from the INI's `exe` field for the
   * Tauri filter. WPF passes the bare exe name through C# format;
   * we lift the extension because Tauri filters by extension. If
   * the INI ever ships an exe without an extension, fall back to
   * "exe" (the WPF launcher would similarly fail downstream).
   */
  const exeName = ini.exe.split(' ')[0] ?? ini.exe
  const dotIdx = exeName.lastIndexOf('.')
  const extension = dotIdx >= 0 ? exeName.slice(dotIdx + 1) : 'exe'

  /*
   * Build the dropdown name string. WPF resource
   * `FileDialog_Filter` is a pipe-delimited C# format string
   * (`"主程式|{0}|全部檔案 (*.*)|*.*"` in zh-TW); we strip the
   * pipes and interpolate the exe name to get a single human-
   * readable label that fits Tauri's `name` field.
   */
  const filterTemplate = t('FileDialog_Filter')
  const firstPipeIdx = filterTemplate.indexOf('|')
  const exeFilterLabel = firstPipeIdx >= 0 ? filterTemplate.slice(0, firstPipeIdx) : filterTemplate
  const exeFilterDisplay = `${selected.name} ${exeFilterLabel}`

  let picked: string | string[] | null
  try {
    picked = await openFileDialog({
      title: t('FileDialog_Title', [exeName]),
      multiple: false,
      directory: false,
      filters: [{ name: exeFilterDisplay, extensions: [extension] }],
    })
  } catch (err) {
    /*
     * `@tauri-apps/plugin-dialog::open` rejects only on plugin /
     * permission failure (not on user cancel — that resolves to
     * `null`). Surface the message so the user knows why the
     * picker didn't appear.
     */
    const msg = err instanceof Error ? err.message : String(err)
    ElMessage.error(msg)
    return
  }

  if (picked === null || Array.isArray(picked)) return

  await configStore.set(key, picked)
  gamePath.value = picked
}

/* --------------- P12.5 D7 — Tools button real handler --------------- */

/**
 * Settings-page Tools button visibility gate. Mirrors WPF
 * `MainWindow.xaml.cs::selectedGameChanged` L621 (when the game
 * has a per-game launcher prefs panel, the Tools button is
 * shown) and L630-633 (when it doesn't, the Tools button is
 * still shown for `610096_TE` but hidden otherwise):
 *
 * ```cs
 * // L621 (TW MapleStory branch)
 * settingPage.btn_Tools.Visibility = Visibility.Visible;
 *
 * // L630-633 (KartRider / non-launcher branch)
 * if (gameCode == "610096_TE")
 *     settingPage.btn_Tools.Visibility = Visibility.Visible;
 * else
 *     settingPage.btn_Tools.Visibility = Visibility.Collapsed;
 * ```
 *
 * Net effect: the WPF Settings Tools button is visible iff
 * `gameCode ∈ {610074_T9, 610075_T9, 610096_TE}` — the same
 * three codes the AccountList Tools button uses. We collapse
 * the two WPF branches into a single `TOOLS_GAME_CODES`
 * membership check (sourced from `src/constants/tools.ts`) for
 * consistency with `pages/AccountList.vue::showToolsButton`.
 *
 * # Why P12.5 D7 added the gate (was unconditionally visible in D5)
 *
 * D5 shipped the Settings shell with the Tools button always
 * visible because the click handler was a `console.warn` stub —
 * a hidden stub button would have been QA-invisible. D7 wires
 * the real dispatch to `ToolsDialogStack`, which is a no-op for
 * non-tools-bearing games (matches WPF's switch fallthrough);
 * that no-op would silently confuse a user clicking the button
 * with no observable outcome. Adding the gate restores the WPF
 * "the affordance only exists where it does something" UX
 * invariant and matches `AccountList.vue`'s D8e gate
 * one-for-one.
 */
const showToolsButton = computed<boolean>(() => {
  if (game.selectedGameCode === null) return false
  return TOOLS_GAME_CODES.has(game.selectedGameCode)
})

/* --------------- Game selection for settings --------------- */

// 已添加的游戏代码列表
const addedGameCodes = ref<string[]>([])

// 计算属性：已添加的游戏列表
// 优先从 game.services 获取完整信息（登录状态）
// 如果 game.services 为空（未登录状态），尝试从缓存恢复，最后构造最小游戏对象
const addedGames = computed(() => {
  // 确保有游戏数据（尝试从缓存恢复）
  if (game.services.length === 0) {
    game.restoreFromCache(configStore)
  }

  if (game.services.length > 0) {
    // 有缓存或已登录：从 game.services 过滤
    return game.services.filter(g => {
      const code = gameCodeOf(g.service_code, g.service_region)
      return addedGameCodes.value.includes(code)
    })
  }

  // 无缓存：从 addedGameCodes 构造最小游戏对象
  return addedGameCodes.value.map(code => {
    const [serviceCode, serviceRegion] = code.split('_')
    return {
      service_code: serviceCode ?? code,
      service_region: serviceRegion ?? '',
      name: code, // 使用 gameCode 作为名称
      // 其他字段使用空值或默认值
      service_family_name: '',
      service_family_name_en: '',
      service_type: '',
      xlarge_image_name: '',
      large_image_name: '',
      small_image_name: '',
      website_url: '',
      download_url: '',
    } as GameService
  })
})

// 当前设置中选中的游戏代码
const settingsSelectedGameCode = ref<string | null>(null)

// 当前设置中选中的游戏
const settingsSelectedGame = computed(() => {
  if (settingsSelectedGameCode.value === null) return null
  return game.services.find(g => {
    const code = gameCodeOf(g.service_code, g.service_region)
    return code === settingsSelectedGameCode.value
  }) ?? null
})

// 当前设置中选中的游戏 INI
const settingsSelectedIni = computed(() => {
  if (settingsSelectedGameCode.value === null) return null
  return game.ini[settingsSelectedGameCode.value] ?? null
})

// 加载已添加的游戏列表
function loadAddedGames(): void {
  const saved = configStore.get('addedGames')
  if (saved) {
    try {
      addedGameCodes.value = JSON.parse(saved) as string[]
    } catch {
      addedGameCodes.value = []
    }
  } else {
    addedGameCodes.value = []
  }
}

// 处理游戏选择变化
function handleGameSelectionChange(gameCode: string | null): void {
  if (gameCode) {
    const selectedGame = game.services.find(g => {
      const code = gameCodeOf(g.service_code, g.service_region)
      return code === gameCode
    })
    if (selectedGame) {
      // 更新 game store 中的选中游戏
      game.selectGame(selectedGame.service_code, selectedGame.service_region)
      // 刷新游戏路径显示
      refreshGamePathFromConfig()
    }
  }
}

// 监听 game store 中的选中游戏变化，同步到设置页面的选择器
watch(() => game.selectedGameCode, (newCode) => {
  if (newCode && !settingsSelectedGameCode.value) {
    settingsSelectedGameCode.value = newCode
  }
})

/**
 * Imperative handle to the {@link ToolsDialogStack} mounted at
 * the bottom of the template. Same pattern as the AccountList
 * page (see `pages/AccountList.vue::toolsDialogRef` docblock for
 * the full rationale on why imperative + why a single wrapper).
 *
 * The two pages each mount their own `ToolsDialogStack`
 * instance — the dialog visibility refs live inside the wrapper,
 * so two parallel mounts on different routes don't share state.
 * In practice only one is alive at a time (vue-router unmounts
 * the inactive page), so the duplication is purely a "mount
 * site" concern, not a state-coupling one.
 */
const toolsDialogRef = ref<InstanceType<typeof ToolsDialogStack> | null>(null)

/**
 * Tools button click handler. Mirrors WPF
 * `Settings.xaml.cs::btn_Tools_Click` L271-275, which delegates
 * straight to `accountList.btn_Tools_Click(null, null)` — i.e.
 * the same dispatch the AccountList page runs. We replicate that
 * "one dispatch, two call sites" shape by routing both pages
 * through the shared `ToolsDialogStack::openForGame`.
 *
 * `void`-prefix on the call: see
 * `pages/AccountList.vue::handleTools` docblock for the
 * fire-and-forget rationale.
 */
function handleTools(): void {
  const code = settingsSelectedGameCode.value
  if (code === null) return
  void toolsDialogRef.value?.openForGame(code)
}

/* --------------- D4 — DisableHardwareAcceleration restart prompt --------------- */

/**
 * `disableHardwareAcceleration` toggle handler. WPF L213-222 shows
 * a restart prompt after writing the new value to Config.
 *
 * The SPA now honours this flag at startup via
 * `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--disable-gpu` (set in
 * `lib.rs::run()` before the WebView2 runtime initialises).
 * A full restart is still required for the change to take effect.
 */
async function handleDisableHwAccelChange(value: boolean): Promise<void> {
  await ui.setDisableHwAccel(value)
  try {
    await ElMessageBox.alert(
      t('MsgRestartForHardwareAccel'),
      t('MsgRestartForHardwareAccelTitle'),
      { type: 'info' },
    )
  } catch {
    /* User dismissed the alert — no-op. */
  }
}

/* --------------- D6 — Back navigation --------------- */

/**
 * Back button handler. WPF `Button_Click` (L85-94) inspects
 * `App.MainWnd.return_page`:
 *
 * - `null` or equal to `loginPage` → `App.MainWnd.NavigateLoginPage()`
 *   (return to login funnel).
 * - Otherwise → `App.MainWnd.frame.Content = return_page` (return
 *   to whatever page launched Settings).
 *
 * The SPA's vue-router maintains its own history stack — calling
 * `router.back()` returns the user to the previous route entry
 * regardless of source page (login funnel, AccountList, or a
 * future deep-linked entry). This is a strict superset of the WPF
 * branch: the WPF `frame.Content` swap was the WPF-style
 * "single-page back navigation" idiom, which `router.back()`
 * implements natively in an SPA.
 *
 * # Edge case: Settings is the entry route (no back history)
 *
 * If the user opens Settings via direct hash (`#/settings`) with
 * no prior history entry (e.g. devtools navigation), `router.back()`
 * is a no-op. We fall back to `router.push('/login')` after
 * `router.back()` to give the user *some* exit affordance instead
 * of silently dead-ending. The check is best-effort — vue-router
 * does not expose a "can go back" predicate, so we use
 * `window.history.length` as the proxy (a value of `1` means the
 * SPA was opened directly into this route).
 */
function handleBack(): void {
  if (window.history.length > 1) {
    router.back()
    return
  }
  void router.push('/login')
}

/* --------------- mount --------------- */

onMounted(() => {
  loadAddedGames()

  // 尝试从缓存恢复游戏数据（用于未登录状态）
  if (game.services.length === 0) {
    game.restoreFromCache(configStore)
  }

  // 初始化设置页面的选中游戏
  if (game.selectedGameCode) {
    settingsSelectedGameCode.value = game.selectedGameCode
  } else if (addedGameCodes.value.length > 0) {
    // 如果没有选中的游戏，默认选择第一个已添加的游戏
    const firstCode = addedGameCodes.value[0]
    settingsSelectedGameCode.value = firstCode
    // 尝试从缓存的服务中找到对应游戏并设置
    const cachedGame = game.services.find(g => {
      const code = gameCodeOf(g.service_code, g.service_region)
      return code === firstCode
    })
    if (cachedGame) {
      game.selectGame(cachedGame.service_code, cachedGame.service_region)
    }
  }

  // 确保在选中游戏设置完成后再刷新路径
  nextTick(() => {
    refreshGamePathFromConfig()
  })
})
</script>

<template>
  <main class="settings" data-window-root>
    <TitleBar />
    <div class="settings__scroll">
      <div class="settings__container" data-window-content>
        <!-- Header -->
        <header class="settings__header">
          <div class="settings__header-icon" aria-hidden="true">
            <el-icon :size="24"><SettingIcon /></el-icon>
          </div>
          <div class="settings__header-text">
            <h1 class="settings__title">{{ t('Settings') }}</h1>
            <p class="settings__subline">{{ t('settings.subtitle') }}</p>
          </div>
        </header>

        <!-- App section -->
        <section class="settings__section" data-test="settings-app-section">
          <header class="settings__section-header">
            <el-icon><User /></el-icon>
            <span>{{ t('AppName') }}</span>
          </header>

          <div class="settings__grid settings__grid--two-col">
            <!-- Left column: Manage account + 3 selects -->
            <div class="settings__col">
              <div class="settings__row">
                <el-button
                  class="bf-btn-secondary settings__inline-btn"
                  data-test="settings-manage-account"
                  @click="handleManageAccount"
                >
                  {{ t('ManageAccount') }}
                </el-button>
              </div>

              <div class="settings__row">
                <label class="settings__label">{{ t('UpdateChannel') }}</label>
                <el-select
                  :model-value="ui.updateChannel"
                  class="settings__select"
                  data-test="settings-update-channel"
                  @change="handleUpdateChannelChange"
                >
                  <el-option
                    v-for="opt in UPDATE_CHANNEL_OPTIONS"
                    :key="opt.value"
                    :value="opt.value"
                    :label="t(opt.labelKey)"
                  />
                </el-select>
              </div>

              <div class="settings__row">
                <label class="settings__label">{{ t('Language') }}</label>
                <el-select
                  :model-value="ui.language"
                  class="settings__select"
                  data-test="settings-language"
                  @change="handleLanguageChange"
                >
                  <el-option
                    v-for="opt in LANGUAGE_OPTIONS"
                    :key="opt.value"
                    :value="opt.value"
                    :label="opt.label"
                  />
                </el-select>
              </div>

              <div class="settings__row settings__row--checkbox">
                <el-checkbox
                  :model-value="ui.darkMode"
                  data-test="settings-dark-mode"
                  @change="(value) => ui.setDarkMode(Boolean(value))"
                >
                  {{ t('settings.darkMode') }}
                </el-checkbox>
              </div>

              <div
                v-if="showLoginModePanel"
                class="settings__row"
                data-test="settings-login-mode-row"
              >
                <label class="settings__label">{{ t('LoginMode') }}</label>
                <el-select
                  :model-value="ui.loginMethod"
                  class="settings__select"
                  data-test="settings-login-mode"
                  @change="handleLoginMethodChange"
                >
                  <el-option
                    v-for="opt in LOGIN_METHOD_OPTIONS"
                    :key="opt.value"
                    :value="opt.value"
                    :label="t(opt.labelKey)"
                  />
                </el-select>
              </div>
            </div>

            <!-- Right column: 5 boolean checkboxes (D4) -->
            <div class="settings__col">
              <div class="settings__row settings__row--checkbox">
                <el-checkbox
                  :model-value="ui.askUpdate"
                  data-test="settings-ask-update"
                  @change="(value) => ui.setAskUpdate(Boolean(value))"
                >
                  {{ t('AutoCheckUpdate') }}
                </el-checkbox>
              </div>

              <div class="settings__row settings__row--checkbox">
                <el-checkbox
                  :model-value="ui.autoStartGame"
                  data-test="settings-auto-start-game"
                  @change="(value) => ui.setAutoStartGame(Boolean(value))"
                >
                  {{ t('RunAfterLogin') }}
                </el-checkbox>
              </div>

              <div class="settings__row settings__row--checkbox">
                <el-checkbox
                  :model-value="ui.minimizeToTray"
                  data-test="settings-minimize-to-tray"
                  @change="(value) => ui.setMinimizeToTray(Boolean(value))"
                >
                  {{ t('MinimizeToTaskbar') }}
                </el-checkbox>
              </div>

              <div class="settings__row settings__row--checkbox">
                <el-tooltip
                  placement="right"
                  popper-class="settings__tip-popper"
                  :content="t('settings.disableHardwareAccelerationTip')"
                >
                  <el-checkbox
                    :model-value="ui.disableHwAccel"
                    data-test="settings-disable-hw-accel"
                    @change="(value) => handleDisableHwAccelChange(Boolean(value))"
                  >
                    {{ t('DisableHardwareAcceleration') }}
                  </el-checkbox>
                </el-tooltip>
              </div>

              <div class="settings__row settings__row--checkbox">
                <el-tooltip
                  placement="right"
                  popper-class="settings__tip-popper"
                  :content="t('settings.autoLoginTip')"
                >
                  <el-checkbox
                    :model-value="configStore.enableAutoLogin"
                    data-test="settings-auto-login"
                    @change="(value) => configStore.enableAutoLogin = Boolean(value)"
                  >
                    {{ t('AutoLogin') }}
                  </el-checkbox>
                </el-tooltip>
              </div>
            </div>
          </div>
        </section>

        <!-- Game section (D5) — only when a game is selected (WPF parity: if no game, t_GamePath is empty + the section is uninteractive). -->
        <section
          v-if="addedGames.length > 0"
          class="settings__section"
          data-test="settings-game-section"
        >
          <header class="settings__section-header">
            <el-icon><Operation /></el-icon>
            <span>{{ t('Game') }}</span>
          </header>

          <!-- 游戏 Tab 切换 -->
          <div class="settings__game-tabs">
            <button
              v-for="g in addedGames"
              :key="gameCodeOf(g.service_code, g.service_region)"
              class="settings__game-tab"
              :class="{ 'is-active': settingsSelectedGameCode === gameCodeOf(g.service_code, g.service_region) }"
              @click="handleGameSelectionChange(gameCodeOf(g.service_code, g.service_region))"
            >
              <img
                v-if="g.large_image_name"
                :src="g.large_image_name.startsWith('http') ? g.large_image_name : `https://images.beanfun.com/GameZone/${g.large_image_name}`"
                :alt="g.name"
                class="settings__game-tab-image"
                @error="($event.target as HTMLImageElement).style.display='none'"
              />
              <span class="settings__game-tab-name">{{ g.name }}</span>
            </button>
          </div>

          <div class="settings__grid">
            <div class="settings__row">
              <label class="settings__label">{{ t('GamePath') }}</label>
              <el-input
                :model-value="gamePath"
                readonly
                :placeholder="t('settings.gamePathPlaceholder')"
                class="settings__game-path-input"
                data-test="settings-game-path"
                @click="pickGamePath"
              >
                <template #suffix>
                  <el-icon class="settings__game-path-icon"><FolderOpened /></el-icon>
                </template>
              </el-input>
            </div>

            <div class="settings__grid settings__grid--two-col">
              <div class="settings__col">
                <div class="settings__row settings__row--checkbox">
                  <el-tooltip
                    placement="right"
                    popper-class="settings__tip-popper"
                    :content="t('settings.tradLoginTip')"
                  >
                    <el-checkbox
                      :model-value="ui.tradLogin"
                      data-test="settings-trad-login"
                      @change="(value) => ui.setTradLogin(Boolean(value))"
                    >
                      {{ t('TraditionalLoginMode') }}
                    </el-checkbox>
                  </el-tooltip>
                </div>

                <div class="settings__row settings__row--checkbox">
                  <el-tooltip
                    placement="right"
                    popper-class="settings__tip-popper"
                    :content="t('settings.killPatcherTip')"
                  >
                    <el-checkbox
                      :model-value="ui.autoKillPatcher"
                      data-test="settings-auto-kill-patcher"
                      @change="(value) => ui.setAutoKillPatcher(Boolean(value))"
                    >
                      {{ t('KillPatcher') }}
                    </el-checkbox>
                  </el-tooltip>
                </div>
              </div>

              <div class="settings__col">
                <div class="settings__row settings__row--checkbox">
                  <el-tooltip
                    placement="right"
                    popper-class="settings__tip-popper"
                    :content="t('settings.skipPlayWindowTip')"
                  >
                    <el-checkbox
                      :model-value="ui.skipPlayWnd"
                      data-test="settings-skip-play-wnd"
                      @change="(value) => ui.setSkipPlayWnd(Boolean(value))"
                    >
                      {{ t('SkipPlayWindow') }}
                    </el-checkbox>
                  </el-tooltip>
                </div>

                <div v-if="showToolsButton && settingsSelectedGameCode" class="settings__row" data-test="settings-tools-row">
                  <!--
                  P12.5 D7: WPF parity gate — the Tools button is only
                  rendered for the three tools-bearing game codes
                  (`MainWindow.xaml.cs` L621 / L630-633 hides it for
                  any other game). Hidden via `v-if` rather than
                  `display: none` so the surrounding row collapses
                  cleanly when the button is absent (mirrors WPF
                  `Visibility.Collapsed` semantics, not `Hidden`).
                -->
                  <el-button
                    class="bf-btn-secondary settings__inline-btn"
                    data-test="settings-tools"
                    @click="handleTools"
                  >
                    {{ t('Tools') }}
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Game section empty banner (no added games) — informational, mirrors WPF's empty t_GamePath fallback semantically. -->
        <section
          v-else
          class="settings__section settings__section--empty"
          data-test="settings-game-section-empty"
        >
          <el-icon class="settings__empty-icon" :size="20"><InfoFilled /></el-icon>
          <p class="settings__empty-text">{{ t('settings.noGamesAdded') }}</p>
        </section>

        <!-- Footer: Back button -->
        <footer class="settings__footer">
          <el-button
            class="bf-btn-secondary settings__back-btn"
            data-test="settings-back"
            @click="handleBack"
          >
            <el-icon><ArrowLeft /></el-icon>
            <span>{{ t('Back') }}</span>
          </el-button>
        </footer>

        <!-- P12.5 D7: Tools dialog stack — same wrapper component the
           AccountList page mounts. See `pages/AccountList.vue`'s
           ToolsDialogStack mount comment + `windows/ToolsDialogStack.vue`
           top docblock for the full design discussion. The wrapper
           mounts unconditionally so its internal dialog mounts can
           play their open transitions on first open; per-dialog
           visibility is owned inside the wrapper. -->
        <ToolsDialogStack ref="toolsDialogRef" />
      </div>
    </div>
  </main>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings__scroll {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;
}

.settings__container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* --------------- header --------------- */

.settings__header {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  margin-bottom: 0.25rem;
}

.settings__header-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--bf-bg-secondary);
  color: var(--bf-text-secondary);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.settings__header-text {
  min-width: 0;
}

.settings__title {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 500;
  letter-spacing: -0.01em;
  line-height: 1.15;
  color: var(--bf-text-primary);
}

.settings__subline {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  color: var(--bf-text-tertiary);
}

/* --------------- section --------------- */

.settings__section {
  padding: 1rem 1.25rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: var(--bf-bg-primary);
  border: 1px solid var(--bf-border);
  border-radius: 8px;
}

.settings__section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--bf-text-tertiary);
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--bf-border);
}

.settings__section--empty {
  flex-direction: row;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1rem;
  background: var(--bf-bg-secondary);
}

.settings__empty-icon {
  flex-shrink: 0;
  color: var(--bf-text-disabled);
}

.settings__empty-text {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--bf-text-tertiary);
}

/* --------------- game tabs --------------- */

.settings__game-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.settings__game-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--bf-bg-secondary);
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.settings__game-tab:hover {
  background: var(--bf-bg-tertiary);
  border-color: var(--bf-border-hover);
}

.settings__game-tab.is-active {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
}

.settings__game-tab-image {
  width: 32px;
  height: 32px;
  object-fit: cover;
  border-radius: 4px;
  background: var(--bf-bg-tertiary);
}

.settings__game-tab-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--bf-text-secondary);
}

.settings__game-tab.is-active .settings__game-tab-name {
  color: var(--el-color-primary);
}

/* --------------- grid / row --------------- */

.settings__grid {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.settings__grid--two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.875rem;
}

@media (max-width: 600px) {
  .settings__grid--two-col {
    grid-template-columns: 1fr;
  }
}

.settings__col {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  min-width: 0;
}

.settings__row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.settings__row--checkbox {
  flex-direction: row;
  align-items: center;
}

.settings__label {
  font-size: 0.8125rem;
  color: var(--bf-text-secondary);
  font-weight: 450;
}

.settings__select,
.settings__game-path-input,
.settings__theme-input {
  width: 100%;
}

.settings__theme-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.settings__theme-input {
  flex: 1;
}

.settings__inline-btn {
  align-self: flex-start;
}

.settings__game-path-input :deep(.el-input__inner) {
  cursor: pointer;
}

.settings__game-path-icon {
  color: var(--bf-text-disabled);
}

/* --------------- footer --------------- */

.settings__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.settings__back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}
</style>

<!--
 * Non-scoped style block for the `el-tooltip` popper. Element Plus
 * teleports poppers to `document.body`, which sits outside this
 * component's scoped CSS boundary, so a scoped rule (even behind
 * `:deep(...)`) would not match. Keeping it global-but-namespaced
 * via `.settings__tip-popper` limits the blast radius to the four
 * tooltips in this page (`popper-class="settings__tip-popper"`).
 *
 * Why this exists:
 *   - Several i18n strings embed `\n` to break long explanations
 *     into two sentences (see `disableHardwareAccelerationTip` /
 *     `tradLoginTip` in `src/i18n/messages.ts`). The default
 *     `white-space: normal` in `el-popper` collapses those
 *     newlines, and the resulting single-line string is wide
 *     enough that placement="right" gets clipped by the Tauri
 *     window edge (reported on PR #237: "Disabling h..." truncation).
 *   - `max-width: 280px` lets Element Plus' flip strategy fall back
 *     to `top`/`bottom` if the right placement still cannot fit.
 *   - `word-break: break-word` protects English copy that has no
 *     `\n` seam from overflowing when it sits right at the cap.
 -->
<style>
.settings__tip-popper.el-popper {
  max-width: 280px;
  white-space: pre-line;
  word-break: break-word;
  line-height: 1.5;
}
</style>
