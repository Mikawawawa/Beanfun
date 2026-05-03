<script setup lang="ts">
/**
 * GameLogo - 遊戲 Logo 組件
 *
 * 統一處理遊戲圖片加載和兜底邏輯
 * - 自動嘗試加載 API 返回的圖片
 * - 404 時自動切換到兜底圖片
 * - 兜底圖片也失敗時顯示遊戲名稱首字母
 */

import { ref, computed, watch } from 'vue'
import {
  generateImageUrl,
  getFallbackImageUrl,
  getFallbackImageUrlByNameFuzzy,
  getGameInitials,
  getGameColor,
} from '../config/gameImages'

interface Props {
  serviceCode: string
  serviceRegion: string
  name: string
  imageName?: string  // API 返回的圖片名稱（small_image_name 或 large_image_name）
  size?: 'small' | 'medium' | 'large'
  shape?: 'square' | 'rounded' | 'circle'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  shape: 'rounded',
})

// 組件初始化日誌
console.log('[GameLogo] Component created for:', props.name, 'region:', props.serviceRegion)

// 加載狀態
enum LoadState {
  Idle = 'idle',
  Loading = 'loading',
  Success = 'success',
  Failed = 'failed',
}

const loadState = ref<LoadState>(LoadState.Idle)
const currentUrl = ref<string>('')
const retryCount = ref(0)

// 最大重試次數
const MAX_RETRIES = 2

// 尺寸配置
const sizeConfig = {
  small: { width: 40, height: 40, fontSize: '14px' },
  medium: { width: 64, height: 64, fontSize: '20px' },
  large: { width: 152, height: 102, fontSize: '28px' },
}

// 當前尺寸
const currentSize = computed(() => sizeConfig[props.size])

// 佔位符樣式
const placeholderStyle = computed(() => ({
  width: `${currentSize.value.width}px`,
  height: `${currentSize.value.height}px`,
  fontSize: currentSize.value.fontSize,
  backgroundColor: getGameColor(props.serviceCode),
}))

// 圖片樣式
const imageStyle = computed(() => ({
  width: `${currentSize.value.width}px`,
  height: `${currentSize.value.height}px`,
}))

// 形狀類名
const shapeClass = computed(() => `game-logo--${props.shape}`)

// 獲取要顯示的文本（首字母）
const displayText = computed(() => getGameInitials(props.name))

// 構建圖片 URL 列表（按優先級）
function buildImageUrlList(): string[] {
  const urls: string[] = []

  console.log('[GameLogo] buildImageUrlList - props:', {
    serviceCode: props.serviceCode,
    serviceRegion: props.serviceRegion,
    name: props.name,
    imageName: props.imageName,
  })

  // 1. API 返回的圖片（根據區域選擇正確的 CDN）
  if (props.imageName) {
    const apiUrl = generateImageUrl(props.imageName, props.serviceRegion)
    console.log('[GameLogo] API URL:', apiUrl)
    urls.push(apiUrl)
  }

  // 2. 兜底配置（根據 serviceCode 和 serviceRegion）
  const fallbackUrl = getFallbackImageUrl(props.serviceCode, props.serviceRegion)
  console.log('[GameLogo] Fallback URL by code/region:', fallbackUrl)
  if (fallbackUrl && !urls.includes(fallbackUrl)) {
    urls.push(fallbackUrl)
  }

  // 3. 兜底配置（根據遊戲名稱模糊匹配）
  const fuzzyUrl = getFallbackImageUrlByNameFuzzy(props.name)
  console.log('[GameLogo] Fuzzy URL by name:', fuzzyUrl)
  if (fuzzyUrl && !urls.includes(fuzzyUrl)) {
    urls.push(fuzzyUrl)
  }

  console.log('[GameLogo] Final URL list:', urls)
  return urls
}

// 開始加載圖片
function startLoading() {
  const urls = buildImageUrlList()

  if (urls.length === 0) {
    // 沒有可用的圖片 URL，直接顯示佔位符
    console.log('[GameLogo] No URLs available, showing placeholder')
    loadState.value = LoadState.Failed
    return
  }

  // 根據重試次數選擇 URL
  const urlIndex = Math.min(retryCount.value, urls.length - 1)
  currentUrl.value = urls[urlIndex]
  console.log(`[GameLogo] Starting load with URL[${urlIndex}]:`, currentUrl.value)
  loadState.value = LoadState.Loading
}

// 處理圖片加載成功
function handleLoad() {
  console.log('[GameLogo] Image loaded successfully:', currentUrl.value)
  loadState.value = LoadState.Success
}

// 處理圖片加載失敗
function handleError() {
  console.log('[GameLogo] Image failed to load:', currentUrl.value)
  retryCount.value++

  const urls = buildImageUrlList()
  console.log(`[GameLogo] Retry ${retryCount.value}, total URLs: ${urls.length}`)

  if (retryCount.value < urls.length && retryCount.value <= MAX_RETRIES) {
    // 嘗試下一個 URL
    currentUrl.value = urls[retryCount.value]
    console.log('[GameLogo] Trying next URL:', currentUrl.value)
    // 保持 Loading 狀態，繼續嘗試
  } else {
    // 所有 URL 都失敗了
    console.log('[GameLogo] All URLs failed, showing placeholder')
    loadState.value = LoadState.Failed
  }
}

// 當 props 變化時重新加載
watch(
  () => [props.serviceCode, props.serviceRegion, props.name, props.imageName],
  () => {
    console.log('[GameLogo] Props changed, resetting')
    retryCount.value = 0
    startLoading()
  },
  { immediate: true }
)
</script>

<template>
  <div class="game-logo" :class="[shapeClass]">
    <!-- 圖片 -->
    <img
      v-if="loadState === LoadState.Loading || loadState === LoadState.Success"
      :src="currentUrl"
      :alt="name"
      class="game-logo__image"
      :style="imageStyle"
      @load="handleLoad"
      @error="handleError"
    />

    <!-- 佔位符 -->
    <div
      v-if="loadState === LoadState.Failed"
      class="game-logo__placeholder"
      :style="placeholderStyle"
    >
      <span class="game-logo__text">{{ displayText }}</span>
    </div>
  </div>
</template>

<style scoped>
.game-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.game-logo--square {
  border-radius: 0;
}

.game-logo--rounded {
  border-radius: 8px;
}

.game-logo--circle {
  border-radius: 50%;
}

.game-logo__image {
  object-fit: cover;
  display: block;
}

.game-logo__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.game-logo__text {
  line-height: 1;
}
</style>
