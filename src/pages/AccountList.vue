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

import { computed, onMounted, ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Loading } from '@element-plus/icons-vue'

import { useAuthStore } from '../stores/auth'
import { useAccountStore } from '../stores/account'
import { useConfigStore } from '../stores/config'
import { useGameStore, gameCodeOf } from '../stores/game'
import { commands } from '../types/bindings'
import { wrapCommand } from '../services/invoke'

import TitleBar from '../components/TitleBar.vue'
import GameCardFull from '../components/GameCardFull.vue'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const account = useAccountStore()
const configStore = useConfigStore()
const game = useGameStore()

/* --------------- game cards state --------------- */

const expandedGameCode = ref<string | null>(null)
const gameCardsLoading = ref(false)

// Map of game code to account count (loaded once on mount)
const gameAccountCounts = ref<Record<string, number>>({})

/* --------------- computed --------------- */

const hasGames = computed(() => game.services.length > 0)

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

/* --------------- initialization --------------- */

async function loadGames(): Promise<void> {
  gameCardsLoading.value = true
  try {
    await game.loadGames()
    
    // Restore last selected game or expand first game
    await restoreGameSelection()
  } finally {
    gameCardsLoading.value = false
  }
}

async function restoreGameSelection(): Promise<void> {
  const saved = configStore.get('loginGame')
  
  if (saved) {
    const sep = saved.lastIndexOf('_')
    if (sep > 0) {
      const code = saved.substring(0, sep)
      const region = saved.substring(sep + 1)
      const found = game.services.find(
        s => s.service_code === code && s.service_region === region
      )
      if (found) {
        expandedGameCode.value = saved
        game.selectGame(code, region)
        return
      }
    }
  }
  
  // Expand first game by default
  if (game.services.length > 0) {
    const first = game.services[0]
    const code = gameCodeOf(first.service_code, first.service_region)
    expandedGameCode.value = code
    game.selectGame(first.service_code, first.service_region)
  }
}

/* --------------- header actions --------------- */

function handleOpenSettings(): void {
  void router.push('/settings')
}

function handleOpenAbout(): void {
  void router.push('/about')
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

        <!-- Empty State -->
        <div v-else-if="!hasGames" class="account-list__empty">
          <p>{{ t('accountList.noGames') }}</p>
        </div>

        <!-- Game Cards List -->
        <div v-else class="account-list__game-cards">
          <GameCardFull
            v-for="g in game.services"
            :key="gameCodeOf(g.service_code, g.service_region)"
            :game="g"
            :ini="getIniForGame(g.service_code, g.service_region)"
            :is-expanded="isGameExpanded(g.service_code, g.service_region)"
            @toggle="toggleGameCard(g.service_code, g.service_region)"
            @update:accounts="handleAccountsUpdate(g.service_code, g.service_region, $event)"
          />
        </div>
      </div>
    </div>
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
  color: #666;
  transition: background 150ms ease;
  padding: 0;
}

.account-list__titlebar-btn .material-symbols-outlined {
  font-size: 18px;
}

.account-list__titlebar-btn:hover {
  background: rgba(0, 0, 0, 0.06);
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

/* Balance Bar */
.account-list__balance-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.account-list__balance-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.account-list__balance-label {
  font-size: 0.875rem;
  color: #6b7280;
}

.account-list__balance-value {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
}

.account-list__balance-refresh {
  appearance: none;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #6b7280;
  padding: 0.25rem;
  border-radius: 6px;
  transition: all 150ms ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.account-list__balance-refresh:hover:not(:disabled) {
  color: #111827;
  background: #e5e7eb;
}

.account-list__balance-refresh:disabled {
  opacity: 0.5;
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
  color: #6b7280;
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
  color: #6b7280;
  text-align: center;
}

/* Game Cards */
.account-list__game-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-bottom: 1rem;
}
</style>
