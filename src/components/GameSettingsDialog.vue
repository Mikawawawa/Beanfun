<script setup lang="ts">
/**
 * Game Settings Dialog - 游戏专属设置弹窗
 *
 * 嵌入游戏相关的设置功能，包括：
 * - 游戏路径设置
 * - 传统登录模式切换
 * - 跳过 Play 窗口
 * - 阻止自动更新
 * - 新枫之谷角色名配置
 */

import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { FolderOpened, Tools } from '@element-plus/icons-vue'
import { open as openFileDialog } from '@tauri-apps/plugin-dialog'

import type { GameService, GameIniEntry } from '../types/bindings'
import { useConfigStore } from '../stores/config'
import { useUiStore } from '../stores/ui'
import { useCharacterStore } from '../stores/character'
import { gameCodeOf } from '../stores/game'
import * as gamePathService from '../services/gamePath'
import { TOOLS_GAME_CODES } from '../constants/tools'

const props = defineProps<{
  modelValue: boolean
  game: GameService | null
  ini: GameIniEntry | null
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'openTools', gameCode: string): void
}>()

const { t } = useI18n()
const configStore = useConfigStore()
const uiStore = useUiStore()
const characterStore = useCharacterStore()

// 游戏代码
const gameCode = computed(() => {
  if (!props.game) return null
  return gameCodeOf(props.game.service_code, props.game.service_region)
})

// 是否显示工具按钮
const showToolsButton = computed(() => {
  if (!gameCode.value) return false
  return TOOLS_GAME_CODES.has(gameCode.value)
})

// 是否为新枫之谷
const isMapleStory = computed(() => {
  return props.game?.service_code === '610074'
})

// 游戏路径
const gamePath = ref('')
const pathState = ref<gamePathService.PathState>('checking')

// 设置项
const tradLogin = ref(uiStore.tradLogin)
const skipPlayWindow = ref(false)
const preventAutoUpdate = ref(false)
const killPatcher = ref(false)

// 新枫之谷角色名
const characterName = ref('')

// 弹窗可见性
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// 加载游戏路径
async function loadGamePath() {
  if (!props.game || !props.ini) return
  
  pathState.value = 'checking'
  const code = gameCodeOf(props.game.service_code, props.game.service_region)
  const path = await gamePathService.getPath(code, props.ini)
  gamePath.value = path || ''
  pathState.value = path ? 'installed' : 'not-installed'
}

// 选择游戏路径
async function handleSelectPath() {
  try {
    const path = await openFileDialog({
      filters: [{ name: 'Executable', extensions: ['exe'] }]
    })
    if (path && props.game && props.ini) {
      const code = gameCodeOf(props.game.service_code, props.game.service_region)
      await gamePathService.setPath(code, props.ini.dir_value_name, path)
      gamePath.value = path
      pathState.value = 'installed'
      ElMessage.success(t('accountList.pathSetSuccess'))
    }
  } catch (error) {
    console.error('Failed to select path:', error)
  }
}

// 保存设置
async function saveSettings() {
  if (!gameCode.value) return
  
  // 保存传统登录模式（全局设置）
  uiStore.setTradLogin(tradLogin.value)
  
  // 保存游戏特定设置
  const settingsKey = `gameSettings_${gameCode.value}`
  const settings = {
    skipPlayWindow: skipPlayWindow.value,
    preventAutoUpdate: preventAutoUpdate.value,
    killPatcher: killPatcher.value,
    characterName: isMapleStory.value ? characterName.value : undefined
  }
  await configStore.set(settingsKey, JSON.stringify(settings))
  
  ElMessage.success(t('settings.saveSuccess'))
  visible.value = false
}

// 加载设置
function loadSettings() {
  if (!gameCode.value) return
  
  const settingsKey = `gameSettings_${gameCode.value}`
  const saved = configStore.get(settingsKey)
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      skipPlayWindow.value = settings.skipPlayWindow ?? false
      preventAutoUpdate.value = settings.preventAutoUpdate ?? false
      killPatcher.value = settings.killPatcher ?? false
    } catch {
      // 使用默认值
    }
  }
  
  // 加载角色名（从 character store）
  if (isMapleStory.value) {
    const name = characterStore.getCharacterName(gameCode.value)
    if (name) {
      characterName.value = name
    }
  }
}

// 打开工具
function handleOpenTools() {
  if (gameCode.value) {
    emit('openTools', gameCode.value)
    visible.value = false
  }
}

// 监听弹窗打开
watch(() => props.modelValue, (open) => {
  if (open && props.game) {
    loadGamePath()
    loadSettings()
    tradLogin.value = uiStore.tradLogin
  }
})

onMounted(() => {
  if (props.game) {
    loadSettings()
  }
})
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="game?.name + ' ' + t('accountList.settings')"
    width="450px"
    align-center
    destroy-on-close
    class="game-settings-dialog"
  >
    <div v-if="game" class="settings-content">
      <!-- 游戏路径 -->
      <div class="settings-section">
        <label class="settings-label">{{ t('settings.gamePath') }}</label>
        <div class="path-input-row">
          <el-input
            v-model="gamePath"
            readonly
            :placeholder="t('settings.gamePathPlaceholder')"
            class="path-input"
          />
          <el-button
            type="primary"
            class="browse-btn"
            @click="handleSelectPath"
          >
            <el-icon><FolderOpened /></el-icon>
            {{ t('addGame.browse') }}
          </el-button>
        </div>
      </div>

      <!-- 新枫之谷角色名配置 -->
      <div v-if="isMapleStory" class="settings-section">
        <label class="settings-label">{{ t('accountList.characterName') }}</label>
        <el-input
          v-model="characterName"
          :placeholder="t('accountList.characterNamePlaceholder')"
          class="character-input"
        />
        <p class="settings-hint">{{ t('accountList.characterNameHint') }}</p>
      </div>

      <!-- 启动选项 -->
      <div class="settings-section">
        <label class="settings-label">{{ t('settings.launchOptions') }}</label>
        <div class="checkbox-group">
          <el-checkbox v-model="tradLogin">
            {{ t('settings.tradLogin') }}
            <el-tooltip :content="t('settings.tradLoginTip')">
              <el-icon class="info-icon"><Info-Filled /></el-icon>
            </el-tooltip>
          </el-checkbox>
          <el-checkbox v-model="skipPlayWindow">
            {{ t('settings.skipPlayWindow') }}
          </el-checkbox>
          <el-checkbox v-model="preventAutoUpdate">
            {{ t('settings.preventAutoUpdate') }}
          </el-checkbox>
          <el-checkbox v-model="killPatcher">
            {{ t('settings.killPatcher') }}
          </el-checkbox>
        </div>
      </div>

      <!-- 工具按钮（仅支持工具的游戏显示） -->
      <div v-if="showToolsButton" class="settings-section tools-section">
        <label class="settings-label">{{ t('accountList.gameTools') }}</label>
        <el-button class="tools-btn" @click="handleOpenTools">
          <el-icon><Tools /></el-icon>
          {{ t('accountList.openTools') }}
        </el-button>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" @click="saveSettings">
        {{ t('common.save') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.settings-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.settings-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
}

.path-input-row {
  display: flex;
  gap: 0.5rem;
}

.path-input {
  flex: 1;
}

.browse-btn {
  background-color: #000000;
  border-color: #000000;
}

.browse-btn:hover {
  background-color: #333333;
  border-color: #333333;
}

.character-input {
  width: 100%;
}

.settings-hint {
  margin: 0;
  font-size: 0.75rem;
  color: #6b7280;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-icon {
  margin-left: 0.25rem;
  color: #9ca3af;
  cursor: help;
}

.tools-section {
  padding-top: 0.5rem;
  border-top: 1px solid #e5e7eb;
}

.tools-btn {
  width: 100%;
  justify-content: center;
}
</style>
