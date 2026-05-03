<script setup lang="ts">
/**
 * Vercel 风格按钮组件
 *
 * 统一的按钮样式，支持多种变体和尺寸
 */

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface Props {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  type: 'button'
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

function handleClick(event: MouseEvent) {
  emit('click', event)
}
</script>

<template>
  <button
    :type="type"
    class="vercel-btn"
    :class="[
      `vercel-btn--${variant}`,
      `vercel-btn--${size}`,
      { 'is-loading': loading, 'is-disabled': disabled || loading }
    ]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="vercel-btn__spinner">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"/>
      </svg>
    </span>
    <span class="vercel-btn__content" :class="{ 'is-hidden': loading }">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.vercel-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  outline: none;
  position: relative;
  white-space: nowrap;
}

/* Variants */
.vercel-btn--primary {
  background: #000000;
  color: #ffffff;
}

.vercel-btn--primary:hover:not(:disabled) {
  background: #333333;
}

.vercel-btn--secondary {
  background: #ffffff;
  color: #333333;
  border: 1px solid #eaeaea;
}

.vercel-btn--secondary:hover:not(:disabled) {
  border-color: #000000;
}

.vercel-btn--ghost {
  background: transparent;
  color: #666666;
}

.vercel-btn--ghost:hover:not(:disabled) {
  background: #f5f5f5;
  color: #333333;
}

/* Sizes */
.vercel-btn--sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  height: 32px;
}

.vercel-btn--md {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  height: 40px;
}

.vercel-btn--lg {
  padding: 0.625rem 1.25rem;
  font-size: 1rem;
  height: 48px;
}

/* States */
.vercel-btn.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.vercel-btn:active:not(:disabled) {
  transform: scale(0.96);
}

/* Loading state */
.vercel-btn__spinner {
  position: absolute;
  width: 16px;
  height: 16px;
  animation: spin 1s linear infinite;
}

.vercel-btn__spinner svg {
  width: 100%;
  height: 100%;
}

.vercel-btn__content.is-hidden {
  opacity: 0;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
