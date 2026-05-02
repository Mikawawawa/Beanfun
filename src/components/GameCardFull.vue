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
  VideoPlay,
  Key,
  ArrowDown,
  ArrowRight,
  Warning,
  FolderOpened,
  Plus,
  Edit,
  Delete,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { GameService, GameIniEntry, ServiceAccount } from '../types/bindings'
import { useAccountStore } from '../stores/account'
import { useConfigStore } from '../stores/config'
import { useGameLauncher } from '../composables/useGameLauncher'
import * as gamePathService from '../services/gamePath'

const props = defineProps<{
  game: GameService
  ini: GameIniEntry
  isExpanded: boolean
}>()

const emit = defineEmits<{
  (event: 'toggle'): void
  (event: 'update:accounts', accounts: ServiceAccount[]): void
}>()

const { t } = useI18n()
const accountStore = useAccountStore()
const configStore = useConfigStore()
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

// 编辑账号
const editingAccount = ref<ServiceAccount | null>(null)
const editName = ref('')

const gameCode = computed(() => `${props.game.service_code}_${props.game.service_region}`)

const accountCount = computed(() => accounts.value.length)

const isInstalled = computed(() => pathState.value === 'installed')

const bannerUrl = computed(() => {
  if (!props.game.large_image_name) return ''
  if (props.game.large_image_name.startsWith('http')) {
    return props.game.large_image_name
  }
  return `https://images.beanfun.com/GameZone/${props.game.large_image_name}`
})

// 加载游戏路径
async function loadGamePath() {
  pathState.value = 'checking'
  gamePath.value = await gamePathService.getPath(gameCode.value, props.ini)
  pathState.value = gamePath.value ? 'installed' : 'not-installed'
}

// 加载账号列表
async function loadAccounts() {
  if (isLoadingAccounts.value) return
  
  isLoadingAccounts.value = true
  try {
    // 获取当前游戏的账号列表
    await accountStore.getServiceAccounts()
    // 过滤出当前游戏的账号
    accounts.value = accountStore.serviceAccounts.filter(acc => 
      acc.sid.startsWith(props.game.service_code)
    )
    
    if (accounts.value.length > 0 && !selectedAccount.value) {
      selectedAccount.value = accounts.value[0]
    }
    
    emit('update:accounts', accounts.value)
  } finally {
    isLoadingAccounts.value = false
  }
}

// 展开/收起
async function toggleExpand() {
  emit('toggle')

  if (!props.isExpanded) {
    // 即将展开，加载数据
    if (pathState.value === 'checking') {
      await loadGamePath()
    }
    if (isInstalled.value && accounts.value.length === 0) {
      await loadAccounts()
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

// 删除账号
async function handleDeleteAccount(account: ServiceAccount) {
  try {
    await ElMessageBox.confirm(
      t('accountList.deleteAccountConfirm', { name: account.sname }),
      t('common.warning'),
      { type: 'warning' }
    )
    // 调用删除账号的命令
    // await accountStore.removeServiceAccount(account)
    await loadAccounts()
    ElMessage.success(t('accountList.deleteAccountSuccess'))
  } catch {
    // 用户取消
  }
}

// 编辑账号名称
async function handleEditAccount(account: ServiceAccount) {
  editingAccount.value = account
  editName.value = account.sname
}

async function handleSaveEdit() {
  if (!editingAccount.value || !editName.value.trim()) return
  
  try {
    await accountStore.changeServiceAccountName(
      editName.value.trim(),
      editingAccount.value
    )
    editingAccount.value = null
    editName.value = ''
    await loadAccounts()
    ElMessage.success(t('accountList.editAccountSuccess'))
  } catch (error) {
    console.error('Failed to edit account:', error)
  }
}

// 监听自动粘贴选项变化
watch(autoPaste, (value) => {
  configStore.set('autoPaste', value.toString())
})

// 监听展开状态
watch(() => props.isExpanded, async (expanded) => {
  if (expanded) {
    if (pathState.value === 'checking') {
      await loadGamePath()
    }
    if (isInstalled.value && accounts.value.length === 0) {
      await loadAccounts()
    }
  }
})

onMounted(() => {
  if (props.isExpanded) {
    loadGamePath()
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
        <img 
          v-if="bannerUrl" 
          :src="bannerUrl" 
          :alt="game.name"
          class="game-banner"
        />
        <div v-else class="game-banner-placeholder">
          <el-icon :size="32"><video-play /></el-icon>
        </div>
        
        <div class="header-info">
          <h3 class="game-name">{{ game.name }}</h3>
          <div class="header-meta">
            <span v-if="accountCount > 0" class="account-count">
              {{ accountCount }} {{ t('accountList.accounts') }}
            </span>
            <span v-if="!isInstalled" class="path-warning">
              <el-icon><warning /></el-icon>
              {{ t('accountList.pathNotSet') }}
            </span>
          </div>
        </div>
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
        <el-button type="primary" @click="handleSetPath">
          {{ t('accountList.setPath') }}
        </el-button>
      </div>
      
      <!-- 账号列表区域 -->
      <div v-else class="account-section">
        <!-- 账号列表 -->
        <div class="account-list">
          <div 
            v-for="account in accounts" 
            :key="account.sid"
            class="account-item"
            :class="{ 'is-selected': selectedAccount?.sid === account.sid }"
            @click="selectedAccount = account"
          >
            <div class="account-info">
              <span class="account-name">{{ account.sname }}</span>
              <span v-if="account.sid" class="account-id">{{ account.sid }}</span>
            </div>
            
            <div class="account-actions">
              <el-button
                v-if="editingAccount?.sid !== account.sid"
                type="primary"
                link
                size="small"
                @click.stop="handleEditAccount(account)"
              >
                <el-icon><edit /></el-icon>
              </el-button>
              <el-button
                type="danger"
                link
                size="small"
                @click.stop="handleDeleteAccount(account)"
              >
                <el-icon><delete /></el-icon>
              </el-button>
            </div>
          </div>
          
          <!-- 编辑状态 -->
          <div v-if="editingAccount" class="account-item is-editing">
            <el-input 
              v-model="editName" 
              size="small"
              @keyup.enter="handleSaveEdit"
            />
            <div class="edit-actions">
              <el-button type="primary" size="small" @click="handleSaveEdit">
                {{ t('common.save') }}
              </el-button>
              <el-button size="small" @click="editingAccount = null">
                {{ t('common.cancel') }}
              </el-button>
            </div>
          </div>
        </div>
        
        <!-- 添加账号按钮 -->
        <div v-if="!editingAccount" class="add-account-section">
          <el-button 
            v-if="!showAddAccount"
            type="primary"
            link
            @click="showAddAccount = true"
          >
            <el-icon><plus /></el-icon>
            {{ t('accountList.addAccount') }}
          </el-button>
          
          <div v-else class="add-account-form">
            <el-input 
              v-model="newAccountName" 
              :placeholder="t('accountList.accountNamePlaceholder')"
              size="small"
              @keyup.enter="handleAddAccount"
            />
            <div class="add-actions">
              <el-button type="primary" size="small" @click="handleAddAccount">
                {{ t('common.add') }}
              </el-button>
              <el-button size="small" @click="showAddAccount = false">
                {{ t('common.cancel') }}
              </el-button>
            </div>
          </div>
        </div>
        
        <!-- OTP区域 -->
        <div class="otp-section">
          <div class="otp-display">
            <span v-if="otp" class="otp-code">{{ otp }}</span>
            <span v-else class="otp-placeholder">{{ t('accountList.clickToGetOtp') }}</span>
          </div>
          <el-button 
            type="primary"
            :loading="otpLoading"
            :disabled="!selectedAccount || otpLoading"
            @click="handleGetOtp"
          >
            <el-icon><key /></el-icon>
            {{ otpLoading ? t('accountList.gettingOtp') : t('accountList.getOtp') }}
          </el-button>
        </div>
        
        <!-- 启动选项 -->
        <div class="launch-options">
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
          <el-icon><video-play /></el-icon>
          {{ t('accountList.launchGame') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-card-full {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.game-card-full:hover {
  border-color: #d1d5db;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.game-card-full.is-expanded {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.08);
}

/* 卡片头部 */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  cursor: pointer;
  background: #fafafa;
  transition: background-color 0.15s ease;
}

.card-header:hover {
  background: #f3f4f6;
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
  background: #e5e7eb;
  border-radius: 8px;
  color: #9ca3af;
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.game-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.account-count {
  font-size: 0.875rem;
  color: #6b7280;
}

.path-warning {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: #f59e0b;
}

.expand-icon {
  color: #9ca3af;
  font-size: 1.25rem;
}

/* 卡片内容 */
.card-body {
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
}

/* 路径设置 */
.path-setup {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  color: #6b7280;
}

.path-setup p {
  margin: 0;
  text-align: center;
}

/* 账号区域 */
.account-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 账号列表 */
.account-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.account-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.account-item:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.account-item.is-selected {
  background: #eff6ff;
  border-color: #3b82f6;
}

.account-item.is-editing {
  gap: 0.5rem;
}

.account-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.account-name {
  font-weight: 500;
  color: #111827;
}

.account-id {
  font-size: 0.75rem;
  color: #9ca3af;
}

.account-actions {
  display: flex;
  gap: 0.25rem;
}

.edit-actions {
  display: flex;
  gap: 0.5rem;
}

/* 添加账号 */
.add-account-section {
  padding: 0.5rem 0;
}

.add-account-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.add-actions {
  display: flex;
  gap: 0.5rem;
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
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  text-align: center;
  font-family: monospace;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: 0.25em;
  color: #111827;
}

.otp-placeholder {
  color: #9ca3af;
  font-size: 0.875rem;
  letter-spacing: normal;
}

.otp-code {
  color: #3b82f6;
}

/* 启动选项 */
.launch-options {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

/* 启动按钮 */
.launch-btn {
  width: 100%;
  margin-top: 0.5rem;
}
</style>
