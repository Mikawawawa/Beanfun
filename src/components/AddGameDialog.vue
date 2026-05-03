<script setup lang="ts">
/**
 * Add Game Dialog - 添加游戏对话框
 *
 * 用户按需添加游戏，添加时必须设置游戏路径
 */

import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, FolderOpened, Check, Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { GameService, GameIniEntry } from '../types/bindings'
import { useGameStore, gameCodeOf } from '../stores/game'
import * as gamePathService from '../services/gamePath'
import GameLogo from './GameLogo.vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'add', gameCode: string, path: string): void
}>()

const { t } = useI18n()
const gameStore = useGameStore()

// 所有可用游戏列表
const availableGames = ref<GameService[]>([])
const gameInis = ref<Record<string, GameIniEntry>>({})
const isLoading = ref(false)

// 已添加的游戏列表（从父组件传入）
const addedGameCodes = ref<Set<string>>(new Set())

// 选中的游戏
const selectedGame = ref<GameService | null>(null)
const gamePath = ref<string>('')
const isSettingPath = ref(false)

// 过滤后的游戏列表（排除已添加的）
const filteredGames = computed(() => {
  return availableGames.value.filter(
    g => !addedGameCodes.value.has(gameCodeOf(g.service_code, g.service_region))
  )
})

// 对话框可见性
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})



// 选择游戏
function selectGame(game: GameService) {
  selectedGame.value = game
  gamePath.value = ''
}

// 设置游戏路径
async function handleSetPath() {
  if (!selectedGame.value) return
  
  isSettingPath.value = true
  try {
    const path = await gamePathService.selectGamePath()
    if (path) {
      gamePath.value = path
    }
  } finally {
    isSettingPath.value = false
  }
}

// 确认添加
async function handleConfirm() {
  if (!selectedGame.value || !gamePath.value) {
    ElMessage.warning(t('addGame.selectGameAndPath'))
    return
  }
  
  const gameCode = gameCodeOf(
    selectedGame.value.service_code,
    selectedGame.value.service_region
  )
  
  // 保存路径到配置
  const ini = gameInis.value[gameCode]
  if (ini) {
    await gamePathService.setPath(gameCode, ini.dir_value_name, gamePath.value)
  }
  
  emit('add', gameCode, gamePath.value)
  ElMessage.success(t('addGame.addSuccess'))
  
  // 重置状态
  selectedGame.value = null
  gamePath.value = ''
  visible.value = false
}

// 取消
function handleCancel() {
  selectedGame.value = null
  gamePath.value = ''
  visible.value = false
}

// 加载所有可用游戏
async function loadAvailableGames() {
  isLoading.value = true
  try {
    await gameStore.loadGames()
    availableGames.value = gameStore.services
    gameInis.value = gameStore.ini
  } finally {
    isLoading.value = false
  }
}

// 设置已添加的游戏列表
function setAddedGames(codes: string[]) {
  addedGameCodes.value = new Set(codes)
}

// 暴露方法给父组件
defineExpose({
  setAddedGames,
  loadAvailableGames
})

onMounted(() => {
  loadAvailableGames()
})
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="t('addGame.title')"
    width="100%"
    :close-on-click-modal="false"
    @close="handleCancel"
  >
    <div class="add-game-dialog">
      <!-- 游戏列表 -->
      <div v-if="isLoading" class="loading-state">
        <el-icon class="loading-icon"><Loading /></el-icon>
        <span>{{ t('common.loading') }}</span>
      </div>
      
      <div v-else-if="filteredGames.length === 0" class="empty-state">
        <p>{{ t('addGame.noAvailableGames') }}</p>
      </div>
      
      <div v-else class="game-list">
        <div
          v-for="game in filteredGames"
          :key="gameCodeOf(game.service_code, game.service_region)"
          class="game-item"
          :class="{ 'is-selected': selectedGame?.service_code === game.service_code }"
          @click="selectGame(game)"
        >
          <div class="game-image-wrapper">
            <GameLogo
              :service-code="game.service_code"
              :service-region="game.service_region"
              :name="game.name"
              :image-name="game.small_image_name || game.large_image_name"
              size="medium"
              shape="rounded"
            />
          </div>
          <span class="game-name">{{ game.name }}</span>
          <el-icon v-if="selectedGame?.service_code === game.service_code" class="check-icon">
            <Check />
          </el-icon>
        </div>
      </div>
      
      <!-- 路径设置 -->
      <div v-if="selectedGame" class="path-section">
        <el-divider />
        <h4>{{ t('addGame.setPath') }}</h4>
        <div class="path-input">
          <el-input
            v-model="gamePath"
            :placeholder="t('addGame.pathPlaceholder')"
            readonly
          >
            <template #append>
              <el-button
                :loading="isSettingPath"
                @click="handleSetPath"
              >
                <el-icon><FolderOpened /></el-icon>
                {{ t('addGame.browse') }}
              </el-button>
            </template>
          </el-input>
        </div>
        <p class="path-hint">{{ t('addGame.pathHint') }}</p>
      </div>
    </div>
    
    <template #footer>
      <el-button @click="handleCancel">{{ t('common.cancel') }}</el-button>
      <el-button
        type="primary"
        :disabled="!selectedGame || !gamePath"
        @click="handleConfirm"
      >
        <el-icon><Plus /></el-icon>
        {{ t('addGame.confirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.add-game-dialog {
  max-height: 400px;
  overflow-y: auto;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #6b7280;
  gap: 1rem;
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.game-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1rem;
  padding: 1rem 0;
}

.game-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.game-item:hover {
  border-color: #3b82f6;
  background: #f0f7ff;
}

.game-item.is-selected {
  border-color: #3b82f6;
  background: #eff6ff;
}

.game-image-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
}

.game-banner {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.game-banner-placeholder {
  width: 100%;
  height: 100%;
  display: none;
  align-items: center;
  justify-content: center;
  background: var(--bf-bg-tertiary);
  color: var(--bf-text-disabled);
}

.game-banner-placeholder.is-visible {
  display: flex;
}

.game-name {
  font-size: 0.875rem;
  text-align: center;
  color: #374151;
}

.check-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  color: #3b82f6;
  font-size: 1.25rem;
}

.path-section {
  padding-top: 1rem;
}

.path-section h4 {
  margin: 0 0 1rem 0;
  color: #374151;
}

.path-input {
  margin-bottom: 0.5rem;
}

.path-hint {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0;
}
</style>
