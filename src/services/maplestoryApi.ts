import { MapleStoryApi } from 'maplestory-openapi/tms'

const API_KEY = import.meta.env.VITE_NEXON_TMS_API_KEY

if (!API_KEY) {
  console.warn('VITE_NEXON_TMS_API_KEY is not set. Character info feature will not work.')
}

let client: MapleStoryApi | null = null

export function getMapleStoryClient(): MapleStoryApi | null {
  if (!API_KEY) return null
  if (!client) {
    client = new MapleStoryApi(API_KEY)
  }
  return client
}

export interface CharacterInfo {
  name: string
  level: number
  class: string
  imageUrl: string
  unionLevel?: number
  expRate: string
  combatPower: string
}

export async function getCharacterInfo(characterName: string): Promise<CharacterInfo | null> {
  try {
    const mapleClient = getMapleStoryClient()
    if (!mapleClient) {
      console.warn('MapleStory API client is not initialized. Check your API key.')
      return null
    }

    // 获取角色 OCID
    const ocid = await mapleClient.getCharacter(characterName)
    if (!ocid?.ocid) return null

    // 获取角色基本信息
    const basic = await mapleClient.getCharacterBasic(ocid.ocid)
    if (!basic) return null

    // 获取联盟信息
    let unionLevel: number | undefined
    try {
      const union = await mapleClient.getUnion(ocid.ocid)
      unionLevel = union?.unionLevel ?? undefined
    } catch {
      // 联盟信息可能不存在，忽略错误
    }

    // 获取角色属性（战斗力）
    let combatPower = '0'
    try {
      const stat = await mapleClient.getCharacterStat(ocid.ocid)
      if (stat && stat.finalStat) {
        const combatPowerStat = stat.finalStat.find(s => s.statName === '戰鬥力')
        combatPower = combatPowerStat?.statValue || '0'
      }
    } catch {
      // 属性信息可能不存在，忽略错误
    }

    return {
      name: basic.characterName,
      level: basic.characterLevel,
      class: basic.characterClass,
      imageUrl: basic.characterImage,
      unionLevel,
      expRate: basic.characterExpRate,
      combatPower
    }
  } catch (error) {
    console.error('Failed to fetch character info:', error)
    return null
  }
}

export function getMaplerHouseUrl(characterName: string): string {
  return `https://sg.maplerhouse.com/zh-cn/character/tms/${encodeURIComponent(characterName)}`
}
