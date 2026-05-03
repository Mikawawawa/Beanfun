<script setup lang="ts">
/**
 * Vercel 风格空状态组件
 *
 * 统一的空状态设计：图标 + 标题 + 描述 + 操作按钮
 */

interface Props {
  title: string
  description?: string
  actionText?: string
  compact?: boolean
}

withDefaults(defineProps<Props>(), {
  description: '',
  actionText: '',
  compact: false
})

const emit = defineEmits<{
  action: []
}>()

function handleAction() {
  emit('action')
}
</script>

<template>
  <div class="empty-state-vercel" :class="{ 'is-compact': compact }">
    <div class="empty-state__icon">
      <slot name="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
      </slot>
    </div>
    <h3 class="empty-state__title">{{ title }}</h3>
    <p v-if="description" class="empty-state__description">{{ description }}</p>
    <button
      v-if="actionText"
      class="empty-state__action"
      @click="handleAction"
    >
      <slot name="action-icon" />
      {{ actionText }}
    </button>
  </div>
</template>

<style scoped>
.empty-state-vercel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem;
  background: #fafafa;
  border: 1px dashed #eaeaea;
  border-radius: 8px;
  text-align: center;
}

.empty-state-vercel.is-compact {
  padding: 2rem;
  gap: 0.75rem;
}

.empty-state__icon {
  width: 64px;
  height: 64px;
  color: #999999;
}

.empty-state-vercel.is-compact .empty-state__icon {
  width: 48px;
  height: 48px;
}

.empty-state__icon svg {
  width: 100%;
  height: 100%;
}

.empty-state__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #333333;
  margin: 0;
  line-height: 1.4;
}

.empty-state-vercel.is-compact .empty-state__title {
  font-size: 1rem;
}

.empty-state__description {
  font-size: 0.875rem;
  color: #666666;
  margin: 0;
  max-width: 300px;
  line-height: 1.5;
}

.empty-state-vercel.is-compact .empty-state__description {
  font-size: 0.8125rem;
}

.empty-state__action {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: #000000;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 0.5rem;
}

.empty-state__action:hover {
  background: #333333;
}

.empty-state__action:active {
  transform: scale(0.96);
}
</style>
