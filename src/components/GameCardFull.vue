<script setup lang="ts">
/**
 * GameCardFull - 完整功能游戏卡片
 *
 * 每个卡片是一个独立区域，包含该游戏的所有操作：
 * - 账号列表（展开后加载）
 * - OTP获取（点击时才调用API）
 * - 游戏启动
 * - 自动粘贴选项
 *
 * 核心设计：延迟加载OTP，防止频繁API调用导致封号
 */

import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Key,
  ArrowDown,
  ArrowRight,
  Warning,
  FolderOpened,
  User,
  More,
  Refresh,
  Edit,
  Delete,
} from '@element-plus/icons-vue'
import { ElMessage, ElSkeleton, ElSkeletonItem } from 'element-plus'
import { commands, type GameService, type GameIniEntry, type ServiceAccount } from '../types/bindings'
import { useAccountStore } from '../stores/account'
import { useAuthStore } from '../stores/auth'
import { useConfigStore } from '../stores/config'
import { useUiStore } from '../stores/ui'
import { useGameLauncher } from '../composables/useGameLauncher'
import { useCharacterStore } from '../stores/character'
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts'
import { wrapCommand } from '../services/invoke'
import { TOOLS_GAME_CODES } from '../constants/tools'
import * as gamePathService from '../services/gamePath'
import GameLogo from './GameLogo.vue'

const props = defineProps<{
  game: GameService
  ini: GameIniEntry
  isExpanded: boolean
  // 是否显示角色信息（仅新枫之谷显示）
  showCharacterInfo?: boolean
}>()

const emit = defineEmits<{
  (event: 'toggle'): void
  (event: 'update:accounts', accounts: ServiceAccount[]): void
  (event: 'openSettings', game: GameService): void
  (event: 'openTools', gameCode: string): void
}>()

const { t } = useI18n()
const accountStore = useAccountStore()
const auth = useAuthStore()
const configStore = useConfigStore()
const uiStore = useUiStore()
const { runGame } = useGameLauncher()

// 路径状态
const pathState = ref<gamePathService.PathState>('checking')
const gamePath = ref<string | null>(null)

// 账号列表
const accounts = ref<ServiceAccount[]>([])
const isLoadingAccounts = ref(false)

// 选中的账号
const selectedAccount = ref<ServiceAccount | null>(null)

// OTP
const otp = ref('')
const otpLoading = ref(false)
const lastOtpTime = ref<number>(0)

// 自动粘贴
const autoPaste = ref(configStore.get('autoPaste') === 'true')

// 添加账号弹窗
const showAddAccount = ref(false)
const newAccountName = ref('')

const gameCode = computed(() => `${props.game.service_code}_${props.game.service_region}`)

// 是否显示工具按钮
const showToolsButton = computed(() => TOOLS_GAME_CODES.has(gameCode.value))

// 角色信息 store
const characterStore = useCharacterStore()
const characterInfo = computed(() => {
  const cache = characterStore.characterCache[gameCode.value]
  console.log('[GameCardFull] characterCache for', gameCode.value, ':', cache)
  return cache?.data
})
const characterLoading = computed(() => characterStore.loading[gameCode.value])

// 是否显示角色配置弹窗
const showCharacterConfig = ref(false)
const characterNameInput = ref('')
const showCharacterMenu = ref(false)

// 加载角色信息
async function loadCharacterInfo() {
  console.log('[GameCardFull] loadCharacterInfo called, showCharacterInfo:', props.showCharacterInfo)
  if (!props.showCharacterInfo) return
  const name = characterStore.getCharacterName(gameCode.value)
  console.log('[GameCardFull] character name from config:', name)
  if (name) {
    const result = await characterStore.loadCharacterInfo(gameCode.value, name)
    console.log('[GameCardFull] loadCharacterInfo result:', result)
  }
}

// 刷新角色信息
async function refresh() {
  await loadCharacterInfo()
}

// 重新配置角色
async function reconfigure(newName: string | null) {
  await characterStore.setCharacterName(gameCode.value, newName)
  if (newName) {
    await loadCharacterInfo()
  }
}

// 清除角色配置
async function clear() {
  await characterStore.setCharacterName(gameCode.value, null)
}

const accountCount = computed(() => accounts.value.length)

const isInstalled = computed(() => pathState.value === 'installed')
const isPathNotSet = computed(() => pathState.value === 'not-installed')

// 加载游戏路径
async function loadGamePath() {
  pathState.value = 'checking'
  // 清除缓存以确保获取最新状态
  gamePathService.clearCache(gameCode.value, props.ini.dir_value_name)
  const path = await gamePathService.getPath(gameCode.value, props.ini)
  console.log('Game path detected:', path, 'for game:', gameCode.value)
  gamePath.value = path
  pathState.value = path ? 'installed' : 'not-installed'
  console.log('Path state set to:', pathState.value)
}

// 加载账号列表
async function loadAccounts() {
  if (isLoadingAccounts.value) return

  isLoadingAccounts.value = true
  try {
    // 如果当前会话的游戏与要加载的游戏不同，先切换活动游戏
    if (auth.session && (auth.session.service_code !== props.game.service_code || 
                         auth.session.service_region !== props.game.service_region)) {
      await wrapCommand(commands.setActiveService(props.game.service_code, props.game.service_region))
      // 更新会话中的游戏信息
      auth.updateSessionService(props.game.service_code, props.game.service_region)
    }
    
    // 获取当前游戏的账号列表
    const result = await accountStore.getServiceAccounts()
    
    // 直接使用返回的账号列表（后端已经根据当前活动游戏过滤好了）
    accounts.value = result.accounts

    if (accounts.value.length > 0 && !selectedAccount.value) {
      selectedAccount.value = accounts.value[0]
    }

    emit('update:accounts', accounts.value)
  } finally {
    isLoadingAccounts.value = false
  }
}

// 打开角色配置
function openCharacterConfig() {
  characterNameInput.value = characterInfo.value?.name || ''
  showCharacterConfig.value = true
}

// 保存角色配置
async function saveCharacterConfig() {
  const name = characterNameInput.value.trim()
  if (name) {
    await reconfigure(name)
  } else {
    await clear()
  }
  showCharacterConfig.value = false
}

// 打开 MaplerHouse
function openMaplerHouse() {
  if (characterInfo.value?.name) {
    const url = `https://sg.maplerhouse.com/zh-cn/character/tms/${encodeURIComponent(characterInfo.value.name)}`
    window.open(url, '_blank')
  }
}

// 处理菜单命令
async function handleMenuCommand(command: string) {
  switch (command) {
    case 'refresh':
      await refresh()
      ElMessage.success('角色信息已刷新')
      break
    case 'reconfigure':
      openCharacterConfig()
      break
    case 'clear':
      await clear()
      ElMessage.success('角色配置已清除')
      break
  }
  showCharacterMenu.value = false
}

// 格式化战斗力数值
function formatCombatPower(value: string): string {
  const num = parseInt(value, 10)
  if (num >= 100000000) {
    return (num / 100000000).toFixed(2) + '亿'
  } else if (num >= 10000) {
    return (num / 10000).toFixed(0) + '万'
  }
  return num.toLocaleString()
}

// 展开/收起
async function toggleExpand() {
  emit('toggle')

  if (!props.isExpanded) {
    // 即将展开，加载数据
    console.log('Before loadGamePath - pathState:', pathState.value, 'isInstalled:', isInstalled.value)
    // 强制重新加载路径状态
    await loadGamePath()
    console.log('After loadGamePath - pathState:', pathState.value, 'isInstalled:', isInstalled.value)
    
    // 路径加载完成后再检查是否已安装
    if (isInstalled.value) {
      console.log('Game is installed, loading accounts and character info')
      if (accounts.value.length === 0) {
        await loadAccounts()
      }
      // 加载角色信息
      if (props.showCharacterInfo) {
        await loadCharacterInfo()
      }
    } else {
      console.log('Game is not installed, skipping account loading')
    }
    // 确保 DOM 更新后再触发 ResizeObserver
    await nextTick()
  }
}

// 设置游戏路径
async function handleSetPath() {
  try {
    const path = await gamePathService.selectGamePath()
    if (path) {
      await gamePathService.setPath(
        gameCode.value,
        props.ini.dir_value_name,
        path
      )
      gamePath.value = path
      pathState.value = 'installed'
      ElMessage.success(t('accountList.pathSetSuccess'))

      // 设置路径后加载账号
      await loadAccounts()
    }
  } catch (error) {
    console.error('Failed to set game path:', error)
  }
}

// 获取OTP（带防抖）
async function handleGetOtp() {
  if (!selectedAccount.value) {
    ElMessage.warning(t('accountList.selectAccountFirst'))
    return
  }

  // 防抖：3秒内禁止重复点击
  const now = Date.now()
  if (now - lastOtpTime.value < 3000) {
    return
  }
  lastOtpTime.value = now

  otpLoading.value = true
  try {
    otp.value = await accountStore.getOtp(selectedAccount.value)
    // 自动复制到剪贴板
    await navigator.clipboard.writeText(otp.value)
    ElMessage.success(t('accountList.otpCopied'))
  } catch (error) {
    console.error('Failed to get OTP:', error)
    ElMessage.error(t('accountList.otpFailed'))
  } finally {
    otpLoading.value = false
  }
}

// 复制 OTP 到剪贴板
async function copyOtpToClipboard() {
  if (!otp.value) {
    ElMessage.warning('请先获取 OTP')
    return
  }
  try {
    await navigator.clipboard.writeText(otp.value)
    ElMessage.success('OTP 已复制')
  } catch (error) {
    console.error('Failed to copy OTP:', error)
    ElMessage.error('复制失败')
  }
}

// 启动游戏
async function handleLaunchGame() {
  if (!selectedAccount.value) {
    ElMessage.warning(t('accountList.selectAccountFirst'))
    return
  }

  if (!gamePath.value) {
    ElMessage.warning(t('accountList.gamePathNotSet'))
    return
  }

  try {
    if (autoPaste.value) {
      // 先获取OTP
      await handleGetOtp()
    }

    await runGame(selectedAccount.value.sid, otp.value)
  } catch (error) {
    console.error('Failed to launch game:', error)
  }
}

// 快捷启动游戏（用于收起状态下的启动按钮）
async function handleQuickLaunch() {
  if (!selectedAccount.value) {
    ElMessage.warning(t('accountList.selectAccountFirst'))
    return
  }

  if (!gamePath.value) {
    ElMessage.warning(t('accountList.gamePathNotSet'))
    return
  }

  try {
    // 非传统模式下直接启动，不获取OTP
    await runGame(selectedAccount.value.sid, '')
    ElMessage.success(t('accountList.gameLaunching'))
  } catch (error) {
    console.error('Failed to launch game:', error)
    ElMessage.error(t('accountList.gameLaunchFailed'))
  }
}

// 添加账号
async function handleAddAccount() {
  if (!newAccountName.value.trim()) return

  try {
    await accountStore.addServiceAccount(newAccountName.value.trim())
    newAccountName.value = ''
    showAddAccount.value = false
    await loadAccounts()
    ElMessage.success(t('accountList.addAccountSuccess'))
  } catch (error) {
    console.error('Failed to add account:', error)
  }
}

// 监听自动粘贴选项变化
watch(autoPaste, (value) => {
  configStore.set('autoPaste', value.toString())
})

// 监听展开状态
watch(() => props.isExpanded, async (expanded) => {
  if (expanded) {
    // 每次展开都重新加载路径状态
    await loadGamePath()
    if (isInstalled.value && accounts.value.length === 0) {
      await loadAccounts()
    }
  }
})

// 卡片快捷键（仅在展开时生效）
const cardShortcutsEnabled = computed(() => props.isExpanded)

const cardShortcuts = [
  {
    key: 'Escape',
    handler: () => {
      if (props.isExpanded) {
        emit('toggle')
      }
    },
    description: '收起卡片'
  },
  {
    key: 'l',
    handler: () => {
      if (props.isExpanded && isInstalled.value && selectedAccount.value) {
        void handleLaunchGame()
      }
    },
    description: '启动游戏'
  },
  {
    key: 'o',
    handler: () => {
      if (props.isExpanded && uiStore.tradLogin && selectedAccount.value) {
        void handleGetOtp()
      }
    },
    description: '获取 OTP'
  },
  {
    key: 'c',
    handler: () => {
      if (props.isExpanded && otp.value) {
        void copyOtpToClipboard()
      }
    },
    description: '复制 OTP'
  },
  {
    key: 'ArrowUp',
    handler: () => {
      if (props.isExpanded && accounts.value.length > 0) {
        const currentIndex = accounts.value.findIndex(a => a.sid === selectedAccount.value?.sid)
        const newIndex = currentIndex > 0 ? currentIndex - 1 : accounts.value.length - 1
        selectedAccount.value = accounts.value[newIndex]
      }
    },
    description: '上一个账号'
  },
  {
    key: 'ArrowDown',
    handler: () => {
      if (props.isExpanded && accounts.value.length > 0) {
        const currentIndex = accounts.value.findIndex(a => a.sid === selectedAccount.value?.sid)
        const newIndex = currentIndex < accounts.value.length - 1 ? currentIndex + 1 : 0
        selectedAccount.value = accounts.value[newIndex]
      }
    },
    description: '下一个账号'
  }
]

useKeyboardShortcuts(cardShortcuts, { enabled: cardShortcutsEnabled })

onMounted(() => {
  // 组件挂载时加载路径状态（无论是否展开）
  loadGamePath()
  if (props.isExpanded) {
    loadAccounts()
  }
})
</script>

<template>
  <div
    class="game-card-full"
    :class="{
      'is-expanded': isExpanded,
      'is-installed': isInstalled
    }"
  >
    <!-- 卡片头部（始终显示） -->
    <div class="card-header" @click="toggleExpand">
      <div class="header-main">
        <GameLogo
          :service-code="game.service_code"
          :service-region="game.service_region"
          :name="game.name"
          :image-name="game.small_image_name || game.large_image_name"
          size="medium"
          shape="rounded"
          class="game-banner"
        />

        <div class="header-info">
          <h3 class="game-name">{{ game.name }}</h3>
          <div class="header-meta">
            <span v-if="accountCount > 0" class="account-count">
              {{ accountCount }} {{ t('accountList.accounts') }}
            </span>
            <span v-if="isPathNotSet" class="path-warning">
              <el-icon><Warning /></el-icon>
              {{ t('accountList.pathNotSet') }}
            </span>
          </div>
        </div>
      </div>

      <!-- 头部操作按钮区域 -->
      <div class="header-actions" @click.stop>
        <!-- 设置和工具按钮 - 紧挨着游戏名（在左边） -->
        <div class="header-secondary-actions">
          <button
            v-if="showToolsButton"
            class="header-btn header-btn-tools"
            :title="t('accountList.gameTools')"
            @click="$emit('openTools', gameCode)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          </button>
          <button
            class="header-btn header-btn-settings"
            :title="t('accountList.gameSettings')"
            @click="$emit('openSettings', game)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>

        <!-- 启动游戏按钮（仅收起时显示，非传统模式下）- 在右边 -->
        <button
          v-if="!isExpanded && !uiStore.tradLogin && isInstalled && selectedAccount"
          class="launch-btn-compact"
          :title="t('accountList.launchGame')"
          @click="handleQuickLaunch"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span>{{ t('accountList.launchGame') }}</span>
        </button>
      </div>

      <div class="expand-icon">
        <el-icon v-if="isExpanded"><arrow-down /></el-icon>
        <el-icon v-else><arrow-right /></el-icon>
      </div>
    </div>

    <!-- 卡片内容（展开时显示） -->
    <div v-if="isExpanded" class="card-body">
      <!-- 未设置路径提示 -->
      <div v-if="!isInstalled" class="path-setup">
        <el-icon :size="48"><folder-opened /></el-icon>
        <p>{{ t('accountList.pathNotSetDesc') }}</p>
        <el-button type="primary" class="set-path-btn" @click="handleSetPath">
          {{ t('accountList.setPath') }}
        </el-button>
      </div>

      <!-- 账号列表区域 -->
      <div v-else class="account-section">
        <!-- 角色信息区域（仅新枫之谷显示） -->
        <div v-if="showCharacterInfo && isInstalled" class="character-section">
          <div v-if="characterInfo" class="character-card-vercel" @click="openMaplerHouse">
            <!-- 左侧：角色头像 -->
            <div class="character-avatar-wrapper">
              <img :src="characterInfo.imageUrl" :alt="characterInfo.name" class="character-avatar" />
            </div>

            <!-- 中间：角色信息 -->
            <div class="character-info-vercel">
              <div class="character-header">
                <h3 class="character-name-vercel">{{ characterInfo.name }}</h3>
                <span class="character-class-badge">{{ characterInfo.class }}</span>
              </div>

              <div class="character-stats-row">
                <div class="stat-item">
                  <span class="stat-label">等级</span>
                  <span class="stat-value">Lv. {{ characterInfo.level }}</span>
                </div>
                <div v-if="characterInfo.unionLevel" class="stat-item">
                  <span class="stat-label">联盟</span>
                  <span class="stat-value">Lv. {{ characterInfo.unionLevel }}</span>
                </div>
              </div>

              <!-- 经验值进度条 -->
              <div class="exp-section">
                <div class="exp-header">
                  <span class="exp-label">经验值</span>
                  <span class="exp-percentage">{{ characterInfo.expRate }}%</span>
                </div>
                <div class="exp-track">
                  <div class="exp-progress" :style="{ width: parseFloat(characterInfo.expRate || '0') + '%' }"></div>
                </div>
              </div>
            </div>

            <!-- 右侧：战斗力 -->
            <div class="combat-power-section">
              <div class="combat-power-label">
                <svg class="combat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
                战斗力
              </div>
              <div class="combat-power-value">{{ formatCombatPower(characterInfo.combatPower) }}</div>
            </div>

            <!-- 外部链接图标 -->
            <div class="external-link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </div>

            <!-- 操作菜单按钮 -->
            <div class="character-actions" @click.stop>
              <el-dropdown trigger="click" @command="handleMenuCommand">
                <el-button type="primary" link class="menu-btn">
                  <el-icon><More /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="refresh">
                      <el-icon><component :is="Refresh" /></el-icon>刷新数据
                    </el-dropdown-item>
                    <el-dropdown-item command="reconfigure">
                      <el-icon><component :is="Edit" /></el-icon>重新配置
                    </el-dropdown-item>
                    <el-dropdown-item command="clear" divided>
                      <el-icon><component :is="Delete" /></el-icon>清除配置
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <div v-else-if="characterLoading" class="character-skeleton">
            <el-skeleton :rows="2" animated>
              <template #template>
                <div class="character-skeleton-content">
                  <el-skeleton-item variant="image" class="character-skeleton-avatar" />
                  <div class="character-skeleton-info">
                    <el-skeleton-item variant="text" class="character-skeleton-name" />
                    <el-skeleton-item variant="text" class="character-skeleton-stats" />
                  </div>
                </div>
              </template>
            </el-skeleton>
          </div>

          <div v-else class="character-config">
            <el-button type="primary" link @click="openCharacterConfig">
              <el-icon><User /></el-icon>
              配置角色信息
            </el-button>
          </div>
        </div>

        <!-- 账号列表 - Vercel 风格 -->
        <div v-if="accounts.length > 0" class="account-list-vercel">
          <div
            v-for="account in accounts"
            :key="account.sid"
            class="account-card-vercel"
            :class="{ 'is-selected': selectedAccount?.sid === account.sid }"
            @click="selectedAccount = account"
          >
            <div class="account-card-content">
              <div class="account-info-vercel">
                <span class="account-name-vercel">{{ account.sname }}</span>
                <span class="account-id-vercel">{{ account.sid }}</span>
              </div>
              <button
                class="copy-otp-btn-vercel"
                :disabled="!otp || selectedAccount?.sid !== account.sid"
                @click.stop="copyOtpToClipboard"
              >
                <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                <span>复制 OTP</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 空状态 - Vercel 风格 -->
        <div v-else class="account-empty-state-vercel">
          <div class="empty-icon-vercel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
          </div>
          <span class="empty-text-vercel">{{ t('accountList.noAccounts') }}</span>
        </div>

        <!-- 添加账号按钮 - Vercel 风格，仅当没有账号时显示 -->
        <div v-if="accounts.length === 0 && !showAddAccount" class="add-account-section-vercel">
          <button class="add-account-btn-vercel" @click="showAddAccount = true">
            <svg class="plus-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>新增账号</span>
          </button>
        </div>

        <!-- 添加账号表单 - Vercel 风格 -->
        <div v-if="showAddAccount" class="add-account-form-vercel">
          <div class="form-field-vercel">
            <label class="form-label-vercel">账号名称</label>
            <input
              v-model="newAccountName"
              type="text"
              class="form-input-vercel"
              placeholder="请输入账号名称"
              @keyup.enter="handleAddAccount"
            />
          </div>
          <div class="form-actions-vercel">
            <button class="btn-vercel btn-primary-vercel" @click="handleAddAccount">
              确认添加
            </button>
            <button class="btn-vercel btn-secondary-vercel" @click="showAddAccount = false">
              取消
            </button>
          </div>
        </div>

        <!-- OTP区域 - 仅在传统登录模式下显示 -->
        <div v-if="uiStore.tradLogin" class="otp-section">
          <div class="otp-display">
            <span v-if="otp" class="otp-code">{{ otp }}</span>
            <span v-else class="otp-placeholder">{{ t('accountList.clickToGetOtp') }}</span>
          </div>
          <el-button
            type="primary"
            :loading="otpLoading"
            :disabled="!selectedAccount || otpLoading"
            class="otp-btn"
            @click="handleGetOtp"
          >
            <el-icon><Key /></el-icon>
            {{ otpLoading ? t('accountList.gettingOtp') : t('accountList.getOtp') }}
          </el-button>
        </div>

        <!-- 启动选项 - 仅在传统登录模式下显示 -->
        <div v-if="uiStore.tradLogin" class="launch-options">
          <el-checkbox v-model="autoPaste">
            {{ t('accountList.autoPasteOtp') }}
          </el-checkbox>
        </div>

        <!-- 启动游戏按钮 -->
        <el-button
          type="primary"
          size="large"
          class="launch-btn"
          :disabled="!selectedAccount"
          @click="handleLaunchGame"
        >
          <el-icon><VideoPlay /></el-icon>
          {{ t('accountList.launchGame') }}
        </el-button>
      </div>
    </div>

    <!-- 角色配置弹窗 -->
    <el-dialog
      v-model="showCharacterConfig"
      title="配置角色信息"
      width="300px"
    >
      <el-input
        v-model="characterNameInput"
        placeholder="请输入角色名称"
        @keyup.enter="saveCharacterConfig"
      />
      <template #footer>
        <el-button @click="showCharacterConfig = false">取消</el-button>
        <el-button type="primary" @click="saveCharacterConfig">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.game-card-full {
  background: var(--bf-bg-primary);
  border: 1px solid var(--bf-border);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.game-card-full:hover {
  border-color: var(--bf-border-hover);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.game-card-full.is-expanded {
  border-color: var(--bf-info);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.08);
}

/* 卡片头部 */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  cursor: pointer;
  background: var(--bf-bg-secondary);
  transition: background-color 0.15s ease;
}

.card-header:hover {
  background: var(--bf-bg-tertiary);
}

.header-main {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.game-banner {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 8px;
}

.game-banner-placeholder {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bf-border);
  border-radius: 8px;
  color: var(--bf-text-disabled);
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.game-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--bf-text-primary);
  margin: 0;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.account-count {
  font-size: 0.875rem;
  color: var(--bf-text-tertiary);
}

.path-warning {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--bf-warning);
}

.expand-icon {
  color: var(--bf-text-disabled);
  font-size: 1.25rem;
}

/* 头部操作按钮 */
.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
  margin-right: 1rem;
}

/* 收起时的启动按钮 - 更醒目 */
.launch-btn-compact {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--bf-text-primary);
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--bf-bg-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.launch-btn-compact:hover {
  background: var(--bf-text-secondary);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.launch-btn-compact svg {
  width: 16px;
  height: 16px;
}

/* 次要操作按钮组 - 紧挨着游戏名 */
.header-secondary-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-btn:hover {
  background: var(--bf-bg-tertiary);
}

.header-btn svg {
  width: 18px;
  height: 18px;
  color: var(--bf-text-disabled);
}

.header-btn:hover svg {
  color: var(--bf-text-secondary);
}

/* 卡片内容 - 带动画 */
.card-body {
  padding: 1rem;
  border-top: 1px solid var(--bf-border);
}

/* 卡片展开/收起动画 */
.card-expand-enter-active,
.card-expand-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 1000px;
  opacity: 1;
  overflow: hidden;
}

.card-expand-enter-from,
.card-expand-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

/* 按钮点击动画 */
.launch-btn-compact:active {
  transform: scale(0.96);
}

.header-btn:active {
  transform: scale(0.92);
}

/* 账号卡片选中动画 */
.account-card-vercel {
  background: var(--bf-bg-primary);
  border: 1px solid #eaeaea;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.account-card-vercel:hover {
  border-color: var(--bf-border-hover);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.account-card-vercel.is-selected {
  border-color: var(--bf-text-primary);
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

/* 路径设置 */
.path-setup {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  color: var(--bf-text-tertiary);
}

.path-setup p {
  margin: 0;
  text-align: center;
}

.set-path-btn {
  background-color: #000000 !important;
  border-color: #000000 !important;
  color: #ffffff !important;
  font-weight: 500;
}

.set-path-btn:hover {
  background-color: #333333 !important;
  border-color: #333333 !important;
}

/* 账号区域 */
.account-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 账号列表 - Vercel 风格 */
.account-list-vercel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* 账号卡片样式已在上方定义，包含动画效果 */

.account-card-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.account-info-vercel {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.account-name-vercel {
  font-size: 1rem;
  font-weight: 600;
  color: var(--bf-text-primary);
  letter-spacing: -0.01em;
}

.account-id-vercel {
  font-size: 0.75rem;
  color: var(--bf-text-tertiary);
  font-family: 'SF Mono', Monaco, monospace;
}

.copy-otp-btn-vercel {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  background: var(--bf-bg-primary);
  border: 1px solid var(--bf-border);
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--bf-text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.copy-otp-btn-vercel:hover:not(:disabled) {
  border-color: var(--bf-text-primary);
  color: var(--bf-text-primary);
}

.copy-otp-btn-vercel:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.copy-icon {
  width: 16px;
  height: 16px;
}

/* 空状态 - Vercel 风格 */
.account-empty-state-vercel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2.5rem;
  background: var(--bf-bg-secondary);
  border: 1px dashed #eaeaea;
  border-radius: 8px;
}

.empty-icon-vercel {
  width: 48px;
  height: 48px;
  color: var(--bf-text-disabled);
}

.empty-text-vercel {
  font-size: 0.875rem;
  color: var(--bf-text-tertiary);
}

/* 添加账号 - Vercel 风格 */
.add-account-section-vercel {
  margin-top: 0.5rem;
}

.add-account-btn-vercel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem;
  background: var(--bf-bg-primary);
  border: 1px dashed #eaeaea;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--bf-text-tertiary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-account-btn-vercel:hover {
  border-color: var(--bf-text-primary);
  color: var(--bf-text-primary);
  background: var(--bf-bg-secondary);
}

.plus-icon {
  width: 18px;
  height: 18px;
}

/* 添加账号表单 - Vercel 风格 */
.add-account-form-vercel {
  background: var(--bf-bg-primary);
  border: 1px solid #eaeaea;
  border-radius: 8px;
  padding: 1.25rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.form-field-vercel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.form-label-vercel {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--bf-text-primary);
}

.form-input-vercel {
  padding: 0.625rem 0.875rem;
  background: var(--bf-bg-primary);
  border: 1px solid #eaeaea;
  border-radius: 6px;
  font-size: 0.875rem;
  color: var(--bf-text-primary);
  transition: all 0.2s ease;
  outline: none;
}

.form-input-vercel:focus {
  border-color: var(--bf-text-primary);
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.08);
}

.form-input-vercel::placeholder {
  color: var(--bf-text-disabled);
}

.form-actions-vercel {
  display: flex;
  gap: 0.75rem;
}

.btn-vercel {
  flex: 1;
  padding: 0.625rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  outline: none;
}

.btn-primary-vercel {
  background: var(--bf-text-primary);
  color: var(--bf-bg-primary);
}

.btn-primary-vercel:hover {
  background: var(--bf-text-secondary);
}

.btn-secondary-vercel {
  background: var(--bf-bg-primary);
  color: var(--bf-text-secondary);
  border: 1px solid #eaeaea;
}

.btn-secondary-vercel:hover {
  border-color: var(--bf-border-hover);
  background: var(--bf-bg-secondary);
}

/* OTP区域 */
.otp-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.otp-display {
  flex: 1;
  padding: 0.75rem 1rem;
  background: var(--bf-bg-primary);
  border: 1px solid var(--bf-border);
  border-radius: 6px;
  text-align: center;
  font-family: monospace;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: 0.25em;
  color: var(--bf-text-primary);
}

.otp-placeholder {
  color: var(--bf-text-disabled);
  font-size: 0.875rem;
  letter-spacing: normal;
}

.otp-code {
  color: var(--bf-text-primary);
}

.otp-btn {
  background-color: #000000 !important;
  border-color: #000000 !important;
  color: #ffffff !important;
}

.otp-btn:hover {
  background-color: #333333 !important;
  border-color: #333333 !important;
}

.otp-btn:disabled {
  background-color: #9ca3af !important;
  border-color: #9ca3af !important;
  color: #ffffff !important;
}

/* 启动选项 */
.launch-options {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

/* 启动按钮 - 黑色主题 */
.launch-btn {
  width: 100%;
  margin-top: 0.5rem;
  background-color: #000000 !important;
  border-color: #000000 !important;
  color: #ffffff !important;
  font-weight: 600;
}

.launch-btn:hover {
  background-color: #333333 !important;
  border-color: #333333 !important;
}

.launch-btn:disabled {
  background-color: #9ca3af !important;
  border-color: #9ca3af !important;
  color: #ffffff !important;
}

.launch-btn .el-icon {
  color: #ffffff !important;
}

/* 角色信息区域 */
.character-section {
  margin-bottom: 1rem;
}

/* Vercel 风格角色卡片 */
.character-card-vercel {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--bf-text-primary);
  border: 1px solid var(--bf-text-secondary);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.character-card-vercel:hover {
  border-color: var(--bf-text-secondary);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

/* 角色头像 */
.character-avatar-wrapper {
  flex-shrink: 0;
}

.character-avatar {
  width: 72px;
  height: 72px;
  border-radius: 10px;
  object-fit: cover;
  background: #1a1a1a;
  border: 1px solid var(--bf-text-secondary);
}

/* 角色信息区域 */
.character-info-vercel {
  flex: 1;
  min-width: 0;
}

.character-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.character-name-vercel {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--bf-bg-primary);
  margin: 0;
  letter-spacing: -0.01em;
}

.character-class-badge {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--bf-text-tertiary);
  background: #1a1a1a;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--bf-text-secondary);
}

/* 统计信息行 */
.character-stats-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.stat-label {
  font-size: 0.6875rem;
  color: var(--bf-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--bf-bg-primary);
}

/* 经验值区域 */
.exp-section {
  margin-top: 0.5rem;
}

.exp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.375rem;
}

.exp-label {
  font-size: 0.6875rem;
  color: var(--bf-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.exp-percentage {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--bf-success);
}

.exp-track {
  height: 4px;
  background: #1a1a1a;
  border-radius: 2px;
  overflow: hidden;
}

.exp-progress {
  height: 100%;
  background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
  border-radius: 2px;
  transition: width 0.5s ease;
}

/* 战斗力区域 */
.combat-power-section {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  padding-left: 1rem;
  border-left: 1px solid var(--bf-text-secondary);
}

.combat-power-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  color: var(--bf-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.combat-icon {
  width: 12px;
  height: 12px;
  color: var(--bf-warning);
}

.combat-power-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--bf-warning);
  letter-spacing: -0.02em;
}

/* 外部链接图标 */
.external-link {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 16px;
  height: 16px;
  color: var(--bf-text-secondary);
  transition: color 0.2s ease;
}

.character-card-vercel:hover .external-link {
  color: var(--bf-text-tertiary);
}

/* 操作菜单 */
.character-actions {
  position: absolute;
  bottom: 0.75rem;
  right: 0.75rem;
}

.character-actions .menu-btn {
  color: var(--bf-text-secondary);
  padding: 0.25rem;
}

.character-actions .menu-btn:hover {
  color: var(--bf-text-tertiary);
}

/* 旧样式保留（用于兼容性） */
.character-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.character-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.character-image {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.2);
}

.character-details {
  flex: 1;
  color: white;
}

.character-name {
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 0.25rem;
}

.character-level {
  font-size: 0.875rem;
  opacity: 0.9;
}

.character-exp {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.375rem;
}

.exp-bar-container {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
  overflow: hidden;
}

.exp-bar {
  height: 100%;
  background: linear-gradient(90deg, #4ade80 0%, #22c55e 100%);
  border-radius: 3px;
  transition: width 0.5s ease;
}

.exp-text {
  font-size: 0.75rem;
  opacity: 0.9;
  min-width: 2.5rem;
  text-align: right;
}

.character-union {
  font-size: 0.75rem;
  opacity: 0.8;
  margin-top: 0.125rem;
}

.character-link {
  color: white;
  font-size: 1.25rem;
  opacity: 0.8;
}

.character-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  color: var(--bf-text-tertiary);
}

.character-skeleton {
  padding: 1rem;
}

.character-skeleton-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.character-skeleton-avatar {
  width: 64px !important;
  height: 64px !important;
  border-radius: 8px !important;
}

.character-skeleton-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.character-skeleton-name {
  width: 120px !important;
  height: 20px !important;
}

.character-skeleton-stats {
  width: 200px !important;
  height: 16px !important;
}

.character-config {
  display: flex;
  justify-content: center;
  padding: 0.5rem;
}
</style>
