import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getCharacterInfo, getMaplerHouseUrl, type CharacterInfo } from '../services/maplestoryApi'
import { useConfigStore } from './config'

// 缓存项结构，包含数据和过期时间
interface CacheEntry {
  data: CharacterInfo
  expiresAt: number
}

// 缓存有效期：30分钟（毫秒）
const CACHE_TTL = 30 * 60 * 1000

export const useCharacterStore = defineStore('character', () => {
  const configStore = useConfigStore()

  // 角色信息缓存（带过期时间）
  const characterCache = ref<Record<string, CacheEntry>>({})
  const loading = ref<Record<string, boolean>>({})

  // 获取游戏的角色配置
  function getCharacterName(gameCode: string): string | undefined {
    return configStore.get(`characterName_${gameCode}`)
  }

  // 保存角色配置
  async function setCharacterName(gameCode: string, name: string | null): Promise<void> {
    await configStore.set(`characterName_${gameCode}`, name)
    // 清除缓存，下次加载时重新获取
    if (name === null) {
      delete characterCache.value[gameCode]
    }
  }

  // 检查缓存是否有效
  function isCacheValid(gameCode: string): boolean {
    const entry = characterCache.value[gameCode]
    if (!entry) return false
    return Date.now() < entry.expiresAt
  }

  // 获取缓存数据（如果有效）
  function getCachedData(gameCode: string): CharacterInfo | null {
    if (isCacheValid(gameCode)) {
      return characterCache.value[gameCode].data
    }
    return null
  }

  // 加载角色信息
  async function loadCharacterInfo(gameCode: string, characterName: string): Promise<CharacterInfo | null> {
    if (loading.value[gameCode]) return null

    // 检查缓存是否有效
    const cached = getCachedData(gameCode)
    if (cached) {
      console.log('[CharacterStore] Using cached data for', gameCode)
      return cached
    }

    loading.value[gameCode] = true
    try {
      console.log('[CharacterStore] Fetching character info for', gameCode, characterName)
      const info = await getCharacterInfo(characterName)
      console.log('[CharacterStore] API response:', info)
      if (info) {
        // 保存到缓存，设置过期时间
        characterCache.value[gameCode] = {
          data: info,
          expiresAt: Date.now() + CACHE_TTL
        }
        console.log('[CharacterStore] Cached data for', gameCode)
      }
      return info
    } catch (error) {
      console.error('[CharacterStore] Failed to load character info:', error)
      return null
    } finally {
      loading.value[gameCode] = false
    }
  }

  // 获取角色信息（带缓存）
  async function getCharacterInfoCached(gameCode: string): Promise<CharacterInfo | null> {
    // 先检查内存缓存
    const cached = getCachedData(gameCode)
    if (cached) return cached

    const name = getCharacterName(gameCode)
    if (!name) return null

    return await loadCharacterInfo(gameCode, name)
  }

  // 强制刷新角色信息（忽略缓存）
  async function refreshCharacterInfo(gameCode: string): Promise<CharacterInfo | null> {
    // 清除缓存
    delete characterCache.value[gameCode]

    const name = getCharacterName(gameCode)
    if (!name) return null

    return await loadCharacterInfo(gameCode, name)
  }

  // 获取 MaplerHouse URL
  function getCharacterUrl(gameCode: string): string | null {
    const name = getCharacterName(gameCode)
    if (!name) return null
    return getMaplerHouseUrl(name)
  }

  return {
    characterCache,
    loading,
    getCharacterName,
    setCharacterName,
    loadCharacterInfo,
    getCharacterInfoCached,
    refreshCharacterInfo,
    getCharacterUrl
  }
})
