<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ServiceAccount } from '../types/bindings'
import { commands } from '../types/bindings'

const props = defineProps<{
  account: ServiceAccount
  gameName: string
  gameIcon: string
  isExpanded?: boolean
}>()

const emit = defineEmits<{
  (e: 'launch', accountId: string): void
  (e: 'toggle-expand', accountId: string): void
  (e: 'remove', accountId: string): void
}>()

const { t } = useI18n()

const isGettingOtp = ref(false)
const isLaunching = ref(false)

const isBanned = computed(() => !props.account.is_enable)

const displayAccountId = computed(() => {
  const id = props.account.sname
  if (id.length <= 12) return id
  return id.slice(0, 6) + '...' + id.slice(-3)
})

const fullAccountId = computed(() => props.account.sname)

async function handleCopyAccount() {
  try {
    await navigator.clipboard.writeText(fullAccountId.value)
    ElMessage.success(t('AccountCopied'))
  } catch {
    ElMessage.error(t('CopyFailed'))
  }
}

async function handleGetOtp() {
  if (isGettingOtp.value) return
  isGettingOtp.value = true

  try {
    const result = await commands.getOtp(props.account)
    if (result.status === 'ok') {
      await navigator.clipboard.writeText(result.data)
      ElMessage.success(t('OTPCopied', { code: result.data }))
    } else {
      ElMessage.error(result.error.message || t('OTPFailed'))
    }
  } catch (err) {
    console.error('Failed to get OTP:', err)
    ElMessage.error(t('OTPFailed'))
  } finally {
    isGettingOtp.value = false
  }
}

async function handleLaunch() {
  if (isLaunching.value || isBanned.value) return
  isLaunching.value = true

  try {
    emit('launch', props.account.sid)
  } finally {
    isLaunching.value = false
  }
}

async function handleRemove() {
  try {
    await ElMessageBox.confirm(
      t('RemoveAccountConfirm', { account: displayAccountId.value }),
      t('Confirm'),
      {
        confirmButtonText: t('Remove'),
        cancelButtonText: t('Cancel'),
        type: 'warning',
      }
    )
    emit('remove', props.account.sid)
  } catch {
    // User cancelled
  }
}

function handleToggleExpand() {
  emit('toggle-expand', props.account.sid)
}
</script>

<template>
  <div class="game-account-card">
    <!-- 第1行：游戏信息区 -->
    <div class="game-account-card__game">
      <div class="game-account-card__game-main" @click="handleToggleExpand">
        <div class="game-account-card__game-icon">
          <img
            v-if="gameIcon"
            :src="gameIcon"
            :alt="gameName"
            class="game-account-card__game-image"
          />
          <span v-else class="material-symbols-outlined">sports_esports</span>
        </div>
        <div class="game-account-card__game-info">
          <span class="game-account-card__game-name">{{ gameName }}</span>
          <span class="game-account-card__game-status">
            <span class="game-account-card__status-dot"></span>
            {{ isBanned ? t('Banned') : t('Active') }}
          </span>
        </div>
      </div>
      <div class="game-account-card__game-actions">
        <button
          class="game-account-card__action-btn"
          @click="handleRemove"
          :title="t('RemoveAccount')"
        >
          <span class="material-symbols-outlined" style="font-size: 14px">delete</span>
        </button>
      </div>
    </div>

    <!-- 第2行：账号信息行 -->
    <div class="game-account-card__info-row">
      <div class="game-account-card__account-section">
        <span class="game-account-card__label">{{ t('Account') }}</span>
        <div class="game-account-card__account-wrapper">
          <span
            class="game-account-card__account-name"
            :class="{ 'game-account-card__account-name--banned': isBanned }"
            @click="handleCopyAccount"
            :title="fullAccountId"
          >
            {{ displayAccountId }}
            <span class="material-symbols-outlined game-account-card__dropdown-icon">
              content_copy
            </span>
          </span>
          <span v-if="isBanned" class="game-account-card__banned-tag">{{ t('Banned') }}</span>
        </div>
      </div>

      <div class="game-account-card__balance-section">
        <span class="game-account-card__label">{{ t('Balance') }}</span>
        <div class="game-account-card__balance-value-wrapper">
          <span class="game-account-card__balance-value">{{ '0' }} PT</span>
          <button
            class="game-account-card__icon-btn"
            :disabled="isGettingOtp"
            @click="handleGetOtp"
            :title="t('GetOTP')"
          >
            <span
              class="material-symbols-outlined"
              :class="{ 'game-account-card__icon-btn--spinning': isGettingOtp }"
            >
              vpn_key
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- 第3行：启动游戏 -->
    <div class="game-account-card__launch-row">
      <button
        class="game-account-card__launch-btn"
        :disabled="isLaunching || isBanned"
        @click="handleLaunch"
      >
        <span
          v-if="isLaunching"
          class="material-symbols-outlined game-account-card__icon-btn--spinning"
        >
          progress_activity
        </span>
        <span v-else class="material-symbols-outlined">play_arrow</span>
        {{ isBanned ? t('Banned') : t('LaunchGame') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.game-account-card {
  padding: 0.75rem 1rem;
  background: var(--bf-bg-primary);
  border: 1px solid var(--bf-border);
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
  border-bottom: 1px solid var(--bf-bg-secondary);
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
  background: var(--bf-bg-secondary);
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
  color: var(--bf-text-primary);
  line-height: 1.2;
}

.game-account-card__game-status {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: var(--bf-success);
}

.game-account-card__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bf-success);
}

.game-account-card__game-actions {
  display: flex;
  gap: 0.375rem;
}

.game-account-card__action-btn {
  padding: 0.375rem 0.625rem;
  font-size: 0.75rem;
  color: var(--bf-text-tertiary);
  background: var(--bf-bg-secondary);
  border: 1px solid var(--bf-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 150ms ease;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.game-account-card__action-btn:hover {
  background: var(--bf-bg-tertiary);
  color: var(--bf-text-secondary);
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
  color: var(--bf-text-disabled);
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
  color: var(--bf-text-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  transition: color 150ms ease;
}

.game-account-card__account-name:hover {
  color: var(--bf-info);
}

.game-account-card__account-name--banned {
  text-decoration: line-through;
  font-style: italic;
  color: var(--bf-text-disabled);
}

.game-account-card__dropdown-icon {
  font-size: 0.75rem;
  color: var(--bf-text-disabled);
}

.game-account-card__banned-tag {
  padding: 0.125rem 0.375rem;
  font-size: 0.6875rem;
  color: var(--bf-danger);
  background: rgba(239, 68, 68, 0.1);
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
  color: var(--bf-text-primary);
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
  color: var(--bf-text-disabled);
  transition: all 150ms ease;
}

.game-account-card__icon-btn:hover:not(:disabled) {
  background: var(--bf-bg-secondary);
  color: var(--bf-text-tertiary);
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
  color: var(--bf-info);
}

.game-account-card__icon-btn--primary:hover {
  background: rgba(59, 130, 246, 0.1);
  color: var(--bf-info);
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
  color: var(--bf-text-inverse);
  background: var(--bf-text-primary);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.game-account-card__launch-btn:hover {
  background: var(--bf-text-secondary);
}
</style>
