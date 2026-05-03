<script setup lang="ts">
/**
 * Account list — the post-login landing page with game card list.
 *
 * Each game is displayed as an expandable card containing:
 * - Account list (loaded on expand)
 * - OTP retrieval (only on user click)
 * - Game launch
 * - Auto-paste option
 *
 * This design minimizes OTP API calls to prevent account flags.
 */

import { computed, onMounted, ref, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Loading, Plus } from '@element-plus/icons-vue'

import { useAuthStore } from '../stores/auth'
import { useAccountStore } from '../stores/account'
import { useConfigStore } from '../stores/config'
import { useGameStore, gameCodeOf } from '../stores/game'
import { commands } from '../types/bindings'
import { wrapCommand } from '../services/invoke'
import * as gamePathService from '../services/gamePath'
import { useKeyboardShortcuts, commonShortcuts } from '../composables/useKeyboardShortcuts'

import TitleBar from '../components/TitleBar.vue'
import GameCardFull from '../components/GameCardFull.vue'
import AddGameDialog from '../components/AddGameDialog.vue'
import GameSettingsDialog from '../components/GameSettingsDialog.vue'
import ToolsDialogStack from '../windows/ToolsDialogStack.vue'
import type { GameService, GameIniEntry } from '../types/bindings'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const account = useAccountStore()
const configStore = useConfigStore()
const game = useGameStore()

/* --------------- game cards state --------------- */

const expandedGameCode = ref<string | null>(null)
const gameCardsLoading = ref(false)

// 用户已添加的游戏列表（从配置读取）
const addedGameCodes = ref<string[]>([])

// Map of game code to account count (loaded once on mount)
const gameAccountCounts = ref<Record<string, number>>({})

// 添加游戏对话框
const showAddGameDialog = ref(false)
const addGameDialogRef = ref<InstanceType<typeof AddGameDialog> | null>(null)

// 工具对话框
const toolsDialogRef = ref<InstanceType<typeof ToolsDialogStack> | null>(null)

// 游戏设置弹窗
const showGameSettings = ref(false)
const settingsGame = ref<GameService | null>(null)
const settingsGameIni = ref<GameIniEntry | null>(null)

/* --------------- computed --------------- */

const hasGames = computed(() => addedGameCodes.value.length > 0)

// 过滤出已添加的游戏
const addedGames = computed(() => {
  return game.services.filter(g => {
    const code = gameCodeOf(g.service_code, g.service_region)
    return addedGameCodes.value.includes(code)
  })
})

/* --------------- game card helpers --------------- */

function isGameExpanded(serviceCode: string, serviceRegion: string): boolean {
  const code = gameCodeOf(serviceCode, serviceRegion)
  return expandedGameCode.value === code
}

async function toggleGameCard(serviceCode: string, serviceRegion: string): Promise<void> {
  const code = gameCodeOf(serviceCode, serviceRegion)

  if (expandedGameCode.value === code) {
    // Collapse current
    expandedGameCode.value = null
  } else {
    // Collapse previous and expand new
    expandedGameCode.value = code

    // Update game store selection
    game.selectGame(serviceCode, serviceRegion)

    // Persist selection
    void configStore.set('loginGame', code)

    // Update backend session if needed
    const session = auth.session
    if (session && (session.service_code !== serviceCode || session.service_region !== serviceRegion)) {
      void wrapCommand(commands.setActiveService(serviceCode, serviceRegion))
        .then(() => {
          auth.updateSessionService(serviceCode, serviceRegion)
        })
        .catch(() => {
          // Error already toasted
        })
    }

    // Wait for DOM update then trigger window resize
    await nextTick()
    // Dispatch a custom event to trigger fitWindow
    window.dispatchEvent(new Event('resize'))
  }
}

function getIniForGame(serviceCode: string, serviceRegion: string) {
  const gameCode = gameCodeOf(serviceCode, serviceRegion)
  return game.ini[gameCode] || Object.values(game.ini)[0]
}

function handleAccountsUpdate(serviceCode: string, serviceRegion: string, accounts: unknown[]): void {
  const code = gameCodeOf(serviceCode, serviceRegion)
  gameAccountCounts.value[code] = accounts.length
}

function isMapleStory(serviceCode: string): boolean {
  // 新枫之谷的服务代码是 610074
  return serviceCode === '610074'
}

/* --------------- initialization --------------- */

async function loadGames(): Promise<void> {
  gameCardsLoading.value = true
  try {
    // 加载所有可用游戏信息
    await game.loadGames()
    
    // 从配置读取用户已添加的游戏列表
    loadAddedGames()
    
    // Restore last selected game or expand first game
    await restoreGameSelection()
  } finally {
    gameCardsLoading.value = false
  }
}

// 从配置加载已添加的游戏列表
function loadAddedGames() {
  const saved = configStore.get('addedGames')
  if (saved) {
    try {
      addedGameCodes.value = JSON.parse(saved)
    } catch {
      addedGameCodes.value = []
    }
  } else {
    addedGameCodes.value = []
  }
}

// 保存已添加的游戏列表到配置
async function saveAddedGames() {
  await configStore.set('addedGames', JSON.stringify(addedGameCodes.value))
}

async function restoreGameSelection(): Promise<void> {
  const saved = configStore.get('loginGame')
  
  if (saved && addedGameCodes.value.includes(saved)) {
    const sep = saved.lastIndexOf('_')
    if (sep > 0) {
      const code = saved.substring(0, sep)
      const region = saved.substring(sep + 1)
      const found = addedGames.value.find(
        s => s.service_code === code && s.service_region === region
      )
      if (found) {
        expandedGameCode.value = saved
        game.selectGame(code, region)
        return
      }
    }
  }
  
  // 自动展开第一个已安装的游戏
  for (const g of addedGames.value) {
    const code = gameCodeOf(g.service_code, g.service_region)
    const ini = getIniForGame(g.service_code, g.service_region)
    if (ini) {
      const isInstalled = await gamePathService.isInstalled(code, ini)
      if (isInstalled) {
        expandedGameCode.value = code
        game.selectGame(g.service_code, g.service_region)
        // 保存选择
        void configStore.set('loginGame', code)
        return
      }
    }
  }
}

/* --------------- add game --------------- */

function handleOpenAddGame() {
  console.log('Opening add game dialog...')
  showAddGameDialog.value = true
  console.log('showAddGameDialog set to:', showAddGameDialog.value)
  // 传递已添加的游戏列表给对话框
  nextTick(() => {
    console.log('nextTick called')
    addGameDialogRef.value?.setAddedGames(addedGameCodes.value)
    addGameDialogRef.value?.loadAvailableGames()
  })
}

async function handleGameAdded(gameCode: string, _path: string) {
  if (!addedGameCodes.value.includes(gameCode)) {
    addedGameCodes.value.push(gameCode)
    await saveAddedGames()
    
    // 展开新添加的游戏
    expandedGameCode.value = gameCode
    const sep = gameCode.lastIndexOf('_')
    if (sep > 0) {
      const code = gameCode.substring(0, sep)
      const region = gameCode.substring(sep + 1)
      game.selectGame(code, region)
    }
  }
}

/* --------------- header actions --------------- */

function handleOpenSettings(): void {
  console.log('Opening settings...')
  void router.push('/settings')
}

function handleOpenAbout(): void {
  void router.push('/about')
}

/* --------------- game card actions --------------- */

function handleOpenGameSettings(game: GameService): void {
  settingsGame.value = game
  settingsGameIni.value = getIniForGame(game.service_code, game.service_region)
  showGameSettings.value = true
}

function handleOpenGameTools(gameCode: string): void {
  void toolsDialogRef.value?.openForGame(gameCode)
}

/* --------------- Gash balance (D11) --------------- */

const refreshing = ref(false)

async function handleRefreshBalance(): Promise<void> {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await account.getRemainPoint(true)
  } finally {
    refreshing.value = false
  }
}

const formattedRemainPoint = computed(() => {
  const value = account.remainPoint
  if (value === null) return t('accountList.gashBalancePlaceholder')
  const region = auth.session?.region
  const showInGame = region !== 'TW' && value !== 0
  const inGameSuffix = showInGame ? t('GashRemainInGame', [Math.floor(value / 2.5)]) : ''
  return t('GashRemain', [`${value}${inGameSuffix}`])
})

/* --------------- keyboard shortcuts --------------- */

// 快捷键启用状态（弹窗打开时禁用）
const shortcutsEnabled = ref(true)

// 定义快捷键
const shortcuts = [
  commonShortcuts.addGame(() => {
    if (!showAddGameDialog.value) {
      handleOpenAddGame()
    }
  }),
  commonShortcuts.refresh(() => {
    void loadGames()
  }),
  commonShortcuts.settings(() => {
    if (!showAddGameDialog.value && !showGameSettings.value) {
      handleOpenSettings()
    }
  }),
  commonShortcuts.escape(() => {
    if (showAddGameDialog.value) {
      showAddGameDialog.value = false
    } else if (showGameSettings.value) {
      showGameSettings.value = false
    } else if (expandedGameCode.value) {
      expandedGameCode.value = null
    }
  })
]

// 注册快捷键
useKeyboardShortcuts(shortcuts, { enabled: shortcutsEnabled })

// 监听弹窗状态，打开时禁用快捷键
watch(showAddGameDialog, (val) => {
  shortcutsEnabled.value = !val
})

watch(showGameSettings, (val) => {
  shortcutsEnabled.value = !val
})

/* --------------- lifecycle --------------- */

onMounted(() => {
  void loadGames()
  // Load Gash balance
  void account.getRemainPoint().catch(() => {})
})
</script>

<template>
  <main class="account-list" data-window-root>
    <TitleBar>
      <button
        type="button"
        class="account-list__titlebar-btn"
        :title="t('Settings')"
        data-test="account-list-settings"
        @click="handleOpenSettings"
      >
        <span class="material-symbols-outlined">settings</span>
      </button>
      <button
        type="button"
        class="account-list__titlebar-btn"
        :title="t('settings.aboutLink')"
        data-test="account-list-about"
        @click="handleOpenAbout"
      >
        <span class="material-symbols-outlined">info</span>
      </button>
    </TitleBar>
    
    <div class="account-list__scroll">
      <div class="account-list__container" data-window-content>
        <!-- Gash Balance Bar -->
        <div class="account-list__balance-bar">
          <div class="account-list__balance-display">
            <span class="account-list__balance-label">{{ t('accountList.gashBalance') }}</span>
            <span class="account-list__balance-value">{{ formattedRemainPoint }}</span>
          </div>
          <button
            type="button"
            class="account-list__balance-refresh"
            :disabled="refreshing"
            :title="t('accountList.refreshBalance')"
            @click="handleRefreshBalance"
          >
            <span class="material-symbols-outlined" :class="{ 'is-spinning': refreshing }">refresh</span>
          </button>
        </div>

        <!-- Loading State -->
        <div v-if="gameCardsLoading" class="account-list__loading">
          <el-icon class="account-list__loading-icon"><Loading /></el-icon>
          <span>{{ t('accountList.loadingGames') }}</span>
        </div>

        <!-- Empty State - Vercel Style -->
        <div v-else-if="!hasGames" class="account-list__empty-vercel">
          <div class="empty-icon-vercel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </div>
          <h3 class="empty-title-vercel">{{ t('accountList.noGamesTitle') }}</h3>
          <p class="empty-desc-vercel">{{ t('accountList.noGamesDesc') }}</p>
          <button class="empty-action-btn-vercel" @click="handleOpenAddGame">
            <el-icon><Plus /></el-icon>
            {{ t('accountList.addFirstGame') }}
          </button>
        </div>

        <!-- Game Cards List -->
        <div v-else class="account-list__game-cards">
          <GameCardFull
            v-for="g in addedGames"
            :key="gameCodeOf(g.service_code, g.service_region)"
            :game="g"
            :ini="getIniForGame(g.service_code, g.service_region)"
            :is-expanded="isGameExpanded(g.service_code, g.service_region)"
            :show-character-info="isMapleStory(g.service_code)"
            @toggle="toggleGameCard(g.service_code, g.service_region)"
            @update:accounts="handleAccountsUpdate(g.service_code, g.service_region, $event)"
            @open-settings="handleOpenGameSettings"
            @open-tools="handleOpenGameTools"
          />
          
          <!-- Add Game Button -->
          <el-button
            class="add-game-btn"
            @click="handleOpenAddGame"
          >
            <el-icon><Plus /></el-icon>
            {{ t('accountList.addGame') }}
          </el-button>
        </div>
      </div>
    </div>
    
    <!-- Add Game Dialog -->
    <AddGameDialog
      ref="addGameDialogRef"
      v-model="showAddGameDialog"
      @add="handleGameAdded"
    />
    
    <!-- Tools Dialog Stack -->
    <ToolsDialogStack ref="toolsDialogRef" />
    
    <!-- Game Settings Dialog -->
    <GameSettingsDialog
      v-model="showGameSettings"
      :game="settingsGame"
      :ini="settingsGameIni"
      @open-tools="handleOpenGameTools"
    />
  </main>
</template>

<style scoped>
.account-list {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.account-list__titlebar-btn {
  appearance: none;
  background: transparent;
  border: none;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  cursor: pointer;
  color: var(--bf-text-tertiary);
  transition: background 150ms ease;
  padding: 0;
}

.account-list__titlebar-btn .material-symbols-outlined {
  font-size: 18px;
}

.account-list__titlebar-btn:hover {
  background: var(--bf-bg-hover);
}

.account-list__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem;
}

.account-list__container {
  flex: 0 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Balance Bar - Vercel Style */
.account-list__balance-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--bf-bg-secondary);
  border: 1px solid var(--bf-border);
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.account-list__balance-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.account-list__balance-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--bf-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.25rem 0.5rem;
  background: var(--bf-bg-tertiary);
  border-radius: 4px;
}

.account-list__balance-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--bf-text-primary);
  letter-spacing: -0.01em;
}

.account-list__balance-refresh {
  appearance: none;
  background: var(--bf-bg-primary);
  border: 1px solid var(--bf-border);
  cursor: pointer;
  color: var(--bf-text-secondary);
  padding: 0.375rem;
  border-radius: 8px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
}

.account-list__balance-refresh:hover:not(:disabled) {
  color: var(--bf-text-primary);
  background: var(--bf-bg-tertiary);
  border-color: var(--bf-border-hover);
}

.account-list__balance-refresh:active:not(:disabled) {
  transform: scale(0.92);
}

.account-list__balance-refresh:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.account-list__balance-refresh .is-spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Loading State */
.account-list__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem;
  color: var(--bf-text-tertiary);
}

.account-list__loading-icon {
  font-size: 2rem;
  animation: spin 1s linear infinite;
}

/* Empty State */
.account-list__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: var(--bf-text-tertiary);
  text-align: center;
  gap: 1rem;
}

/* Game Cards */
.account-list__game-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-bottom: 1rem;
}

.add-game-btn {
  margin-top: 0.5rem;
  width: 100%;
}
</style>
