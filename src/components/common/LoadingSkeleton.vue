<script setup lang="ts">
/**
 * Vercel 风格骨架屏组件
 *
 * 脉冲动画效果，支持不同尺寸和形状
 */

type SkeletonVariant = 'text' | 'circular' | 'rectangular'
type SkeletonSize = 'sm' | 'md' | 'lg'

interface Props {
  variant?: SkeletonVariant
  size?: SkeletonSize
  width?: string
  height?: string
  lines?: number
}

withDefaults(defineProps<Props>(), {
  variant: 'text',
  size: 'md',
  width: '100%',
  height: 'auto',
  lines: 1
})
</script>

<template>
  <div class="skeleton-container">
    <template v-if="lines > 1">
      <div
        v-for="i in lines"
        :key="i"
        class="skeleton-vercel"
        :class="[`skeleton-vercel--${variant}`, `skeleton-vercel--${size}`]"
        :style="{
          width: i === lines ? '60%' : width,
          height: height !== 'auto' ? height : undefined
        }"
      />
    </template>
    <template v-else>
      <div
        class="skeleton-vercel"
        :class="[`skeleton-vercel--${variant}`, `skeleton-vercel--${size}`]"
        :style="{ width, height }"
      />
    </template>
  </div>
</template>

<style scoped>
.skeleton-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skeleton-vercel {
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: pulse 1.5s ease-in-out infinite;
}

/* Variants */
.skeleton-vercel--text {
  border-radius: 4px;
}

.skeleton-vercel--circular {
  border-radius: 50%;
}

.skeleton-vercel--rectangular {
  border-radius: 6px;
}

/* Sizes */
.skeleton-vercel--sm {
  height: 0.75rem;
}

.skeleton-vercel--md {
  height: 1rem;
}

.skeleton-vercel--lg {
  height: 1.5rem;
}

.skeleton-vercel--circular.skeleton-vercel--sm {
  width: 24px;
  height: 24px;
}

.skeleton-vercel--circular.skeleton-vercel--md {
  width: 40px;
  height: 40px;
}

.skeleton-vercel--circular.skeleton-vercel--lg {
  width: 64px;
  height: 64px;
}

@keyframes pulse {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
