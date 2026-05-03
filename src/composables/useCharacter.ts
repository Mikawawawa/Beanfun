import useSWR, { type SWRConfiguration } from 'swr'
import { getCharacterInfo, type CharacterInfo } from '../services/maplestoryApi'
import { useCharacterStore } from '../stores/character'

// SWR 配置
const swrConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  refreshInterval: 5 * 60 * 1000, // 5 分钟自动刷新
  dedupingInterval: 2000, // 2 秒内重复请求去重
  errorRetryCount: 3,
  errorRetryInterval: 5000,
}

// 获取角色数据的 fetcher 函数
const fetchCharacter = async (_gameCode: string, characterName: string): Promise<CharacterInfo | null> => {
  if (!characterName) return null
  return await getCharacterInfo(characterName)
}

/**
 * 使用 SWR 获取角色信息
 * @param gameCode 游戏代码
 * @returns 角色信息、加载状态、错误信息、刷新函数、变更角色函数
 */
export function useCharacter(gameCode: string) {
  const characterStore = useCharacterStore()
  const characterName = characterStore.getCharacterName(gameCode)

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    characterName ? [gameCode, characterName] : null,
    ([, name]) => fetchCharacter(gameCode, name),
    swrConfig
  )

  // 手动刷新
  const refresh = async () => {
    await mutate()
  }

  // 重新配置角色
  const reconfigure = async (newName: string | null) => {
    await characterStore.setCharacterName(gameCode, newName)
    // 清除 SWR 缓存并重新获取
    await mutate(null, false) // 先清空数据
    if (newName) {
      await mutate() // 如果有新名称，重新获取
    }
  }

  // 清除配置
  const clear = async () => {
    await characterStore.setCharacterName(gameCode, null)
    await mutate(null, false)
  }

  return {
    characterInfo: data,
    isLoading,
    isValidating,
    error,
    refresh,
    reconfigure,
    clear,
    hasCharacter: !!characterName,
    characterName,
  }
}
