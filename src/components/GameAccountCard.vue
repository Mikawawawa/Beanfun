<script setup lang="ts">
/**
 * GameAccountCard - 游戏和账号信息聚合卡片
 *
 * 布局：
 * 1. 游戏信息区：游戏图片 + 游戏名称 + 状态 + 快捷操作（会员、客服、工具）
 * 2. 账号信息行：账号名称（带下拉菜单）+ Gash 点数
 * 3. 启动游戏：占满宽度的按钮
 */

import { VideoPlay, Refresh, Wallet, ArrowDown, DocumentCopy, Key, Operation } from '@element-plus/icons-vue'
import { ElIcon, ElDropdown, ElDropdownMenu, ElDropdownItem } from 'element-plus'
import { useI18n } from 'vue-i18n'

defineProps<{
  gameName: string
  gameImage?: string | null
  gameStatus: string
  showAccountSection: boolean
  accountName: string
  accountId?: string
  isBanned: boolean
  balance: string
  refreshing: boolean
  showToolsButton?: boolean
}>()

const emit = defineEmits<{
  (event: 'start-game'): void
  (event: 'change-game'): void
  (event: 'refresh-balance'): void
  (event: 'add-value'): void
  (event: 'member-center'): void
  (event: 'customer-service'): void
  (event: 'tools'): void
  (event: 'copy-account-id'): void
  (event: 'get-otp'): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="game-account-card">
    <!-- 第1行：游戏信息区 - 图片 + 名称/状态 + 快捷操作 -->
    <div class="game-account-card__game">
      <div class="game-account-card__game-main" @click="emit('change-game')">
        <div class="game-account-card__game-icon">
          <img
            v-if="gameImage"
            :src="gameImage"
            :alt="gameName"
            class="game-account-card__game-image"
          />
          <el-icon v-else :size="28"><video-play /></el-icon>
        </div>
        <div class="game-account-card__game-info">
          <span class="game-account-card__game-name">{{ gameName }}</span>
          <span class="game-account-card__game-status">
            <span class="game-account-card__status-dot" />
            {{ gameStatus }}
          </span>
        </div>
      </div>
      
      <!-- 快捷操作按钮 -->
      <div class="game-account-card__game-actions">
        <button
          type="button"
          class="game-account-card__action-btn"
          :title="t('accountList.memberCenter')"
          @click="emit('member-center')"
        >
          {{ t('accountList.memberCenterShort') }}
        </button>
        <button
          type="button"
          class="game-account-card__action-btn"
          :title="t('accountList.customerService')"
          @click="emit('customer-service')"
        >
          {{ t('accountList.customerServiceShort') }}
        </button>
        <button
          v-if="showToolsButton"
          type="button"
          class="game-account-card__action-btn"
          :title="t('accountList.toolsButton')"
          @click="emit('tools')"
        >
          <el-icon><operation /></el-icon>
        </button>
      </div>
    </div>

    <!-- 第2行：账号信息行 - 账号（带下拉）+ Gash -->
    <div class="game-account-card__info-row">
      <!-- 账号信息（带下拉菜单） -->
      <div v-if="showAccountSection" class="game-account-card__account-section">
        <span class="game-account-card__label">{{ t('accountList.currentAccount') }}</span>
        <div class="game-account-card__account-wrapper">
          <el-dropdown trigger="click" placement="bottom-start">
            <span
              class="game-account-card__account-name"
              :class="{ 'game-account-card__account-name--banned': isBanned }"
            >
              {{ accountName }}
              <el-icon class="game-account-card__dropdown-icon"><arrow-down /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="emit('copy-account-id')">
                  <el-icon><document-copy /></el-icon>
                  <span>{{ t('accountList.copyAccountId') }}</span>
                </el-dropdown-item>
                <el-dropdown-item @click="emit('get-otp')">
                  <el-icon><key /></el-icon>
                  <span>{{ t('accountList.getOtp') }}</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <span v-if="isBanned" class="game-account-card__banned-tag">
            {{ t('accountList.statusBanned') }}
          </span>
        </div>
      </div>

      <!-- Gash 余额 -->
      <div class="game-account-card__balance-section">
        <span class="game-account-card__label">{{ t('accountList.gashBalance') }}</span>
        <div class="game-account-card__balance-value-wrapper">
          <span class="game-account-card__balance-value">{{ balance }}</span>
          <button
            type="button"
            class="game-account-card__icon-btn"
            :class="{ 'game-account-card__icon-btn--spinning': refreshing }"
            :title="t('accountList.refreshBalance')"
            :disabled="refreshing"
            @click="emit('refresh-balance')"
          >
            <el-icon><refresh /></el-icon>
          </button>
          <button
            type="button"
            class="game-account-card__icon-btn game-account-card__icon-btn--primary"
            :title="t('accountList.addValue')"
            @click="emit('add-value')"
          >
            <el-icon><wallet /></el-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- 第3行：启动游戏（占满宽度） -->
    <div class="game-account-card__launch-row">
      <button type="button" class="game-account-card__launch-btn" @click="emit('start-game')">
        <el-icon><video-play /></el-icon>
        <span>{{ t('GameStart') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.game-account-card {
  padding: 0.75rem 1rem;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin: 0 0 0.75rem;
}

/* 第1行：游戏信息区 */
.game-account-card__game {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-bottom: 0.625rem;
  border-bottom: 1px solid #f3f4f6;
}

.game-account-card__game-main {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  cursor: pointer;
  transition: opacity 150ms ease;
}

.game-account-card__game-main:hover {
  opacity: 0.8;
}

.game-account-card__game-icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.game-account-card__game-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.game-account-card__game-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.game-account-card__game-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  line-height: 1.2;
}

.game-account-card__game-status {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: #22c55e;
}

.game-account-card__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
}

.game-account-card__game-actions {
  display: flex;
  gap: 0.375rem;
}

.game-account-card__action-btn {
  padding: 0.375rem 0.625rem;
  font-size: 0.75rem;
  color: #6b7280;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 150ms ease;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.game-account-card__action-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

/* 第2行：账号信息行 */
.game-account-card__info-row {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  padding: 0.625rem 0;
}

.game-account-card__label {
  display: block;
  font-size: 0.6875rem;
  color: #9ca3af;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.game-account-card__account-section {
  flex: 1;
  min-width: 0;
}

.game-account-card__account-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.game-account-card__account-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  transition: color 150ms ease;
}

.game-account-card__account-name:hover {
  color: #2563eb;
}

.game-account-card__account-name--banned {
  text-decoration: line-through;
  font-style: italic;
  color: #9ca3af;
}

.game-account-card__dropdown-icon {
  font-size: 0.75rem;
  color: #9ca3af;
}

.game-account-card__banned-tag {
  padding: 0.125rem 0.375rem;
  font-size: 0.6875rem;
  color: #ef4444;
  background: #fef2f2;
  border-radius: 4px;
}

.game-account-card__balance-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.game-account-card__balance-value-wrapper {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.game-account-card__balance-value {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
}

.game-account-card__icon-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #9ca3af;
  transition: all 150ms ease;
}

.game-account-card__icon-btn:hover:not(:disabled) {
  background: #f3f4f6;
  color: #6b7280;
}

.game-account-card__icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.game-account-card__icon-btn--spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.game-account-card__icon-btn--primary {
  color: #3b82f6;
}

.game-account-card__icon-btn--primary:hover {
  background: #eff6ff;
  color: #2563eb;
}

/* 第3行：启动游戏 */
.game-account-card__launch-row {
  padding-top: 0.375rem;
}

.game-account-card__launch-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #fff;
  background: #171717;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.game-account-card__launch-btn:hover {
  background: #374151;
}
</style>
