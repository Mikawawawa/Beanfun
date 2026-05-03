/**
 * 游戏图片兜底配置
 *
 * 从 Beanfun 官网抓取的图片配置
 * 用于在 API 返回的图片加载失败时作为兜底
 */

export interface GameImageConfig {
  serviceCode: string
  serviceRegion: string
  name: string
  imageUrl: string
}

// 香港区 (HK) 游戏图片配置
export const hkGameImages: GameImageConfig[] = [
  {
    serviceCode: 'tosm',
    serviceRegion: 'HK',
    name: '救世者之樹M',
    imageUrl: 'https://cdn.hk.beanfun.com/uploaded_images/beanfun/game_zone/tosm_ver1.png'
  },
  {
    serviceCode: 'warsofprasia',
    serviceRegion: 'HK',
    name: '波拉西亞戰記',
    imageUrl: 'https://cdn.hk.beanfun.com/uploaded_images/beanfun/game_zone/warsofprasiapc.png'
  },
  {
    serviceCode: 'mabinogi',
    serviceRegion: 'HK',
    name: '新瑪奇 mabinogi',
    imageUrl: 'https://cdn.hk.beanfun.com/uploaded_images/beanfun/game_zone/20120810182528083_s.jpg'
  },
  {
    serviceCode: '610074',
    serviceRegion: 'HK',
    name: '新楓之谷',
    imageUrl: 'https://cdn.hk.beanfun.com/uploaded_images/beanfun/game_zone/20090224114432968_s.gif'
  },
  {
    serviceCode: 'dragonnest',
    serviceRegion: 'HK',
    name: '新龍之谷',
    imageUrl: 'https://cdn.hk.beanfun.com/uploaded_images/beanfun/game_zone/20191010114630741_s.jpg'
  },
  {
    serviceCode: 'elsword',
    serviceRegion: 'HK',
    name: '艾爾之光',
    imageUrl: 'https://cdn.hk.beanfun.com/uploaded_images/beanfun/game_zone/20160318155347498_s.gif'
  },
  {
    serviceCode: 'csonline',
    serviceRegion: 'HK',
    name: 'CS Online',
    imageUrl: 'https://cdn.hk.beanfun.com/uploaded_images/beanfun/game_zone/20090224114732187_s.gif'
  },
  {
    serviceCode: 'lineage',
    serviceRegion: 'HK',
    name: '天堂國際服',
    imageUrl: 'https://cdn.hk.beanfun.com/uploaded_images/beanfun/game_zone/20170915124232831_s.jpg'
  },
  {
    serviceCode: 'getamped',
    serviceRegion: 'HK',
    name: '爆爆王',
    imageUrl: 'https://cdn.hk.beanfun.com/uploaded_images/beanfun/game_zone/20090224114613171_s.gif'
  }
]

// 台湾区 (TW) 游戏图片配置
export const twGameImages: GameImageConfig[] = [
  {
    serviceCode: 'tosm',
    serviceRegion: 'TW',
    name: '救世者之樹M',
    imageUrl: 'https://images.beanfun.com/BFWebCommon_MiddleImage/1752160691086.png'
  },
  {
    serviceCode: 'warsofprasia',
    serviceRegion: 'TW',
    name: '波拉西亞戰記',
    imageUrl: 'https://images.beanfun.com/BFWebCommon_MiddleImage/1706802264723.png'
  },
  {
    serviceCode: '610074',
    serviceRegion: 'TW',
    name: '新楓之谷',
    imageUrl: 'https://images.beanfun.com/BFWebCommon_MiddleImage/20170110111850.jpg'
  },
  {
    serviceCode: 'lineagenew',
    serviceRegion: 'TW',
    name: '天堂國際服',
    imageUrl: 'https://images.beanfun.com/BFWebCommon_MiddleImage/20190807195118.jpg'
  },
  {
    serviceCode: 'mabinogi',
    serviceRegion: 'TW',
    name: '新瑪奇 mabinogi',
    imageUrl: 'https://images.beanfun.com/BFWebCommon_MiddleImage/20120810182528083_s.jpg'
  },
  {
    serviceCode: 'dragonnest',
    serviceRegion: 'TW',
    name: '新龍之谷',
    imageUrl: 'https://images.beanfun.com/BFWebCommon_MiddleImage/20191010114630741_s.jpg'
  },
  {
    serviceCode: 'elsword',
    serviceRegion: 'TW',
    name: '艾爾之光',
    imageUrl: 'https://images.beanfun.com/BFWebCommon_MiddleImage/20160318155347498_s.gif'
  }
]

// 所有游戏图片配置
export const allGameImages: GameImageConfig[] = [...hkGameImages, ...twGameImages]

/**
 * 根据 serviceCode 和 serviceRegion 获取兜底图片 URL
 */
export function getFallbackImageUrl(serviceCode: string, serviceRegion: string): string | undefined {
  const config = allGameImages.find(
    g => g.serviceCode === serviceCode && g.serviceRegion === serviceRegion
  )
  return config?.imageUrl
}

/**
 * 根据游戏名称获取兜底图片 URL
 */
export function getFallbackImageUrlByName(name: string): string | undefined {
  const config = allGameImages.find(g => g.name === name)
  return config?.imageUrl
}

/**
 * 根据游戏名称模糊匹配兜底图片 URL
 * 用於當精確匹配失敗時嘗試模糊匹配
 */
export function getFallbackImageUrlByNameFuzzy(name: string): string | undefined {
  // 首先嘗試精確匹配
  const exactMatch = allGameImages.find(g => g.name === name)
  if (exactMatch) return exactMatch.imageUrl

  // 嘗試包含關係匹配
  const containsMatch = allGameImages.find(g =>
    g.name.toLowerCase().includes(name.toLowerCase()) ||
    name.toLowerCase().includes(g.name.toLowerCase())
  )
  if (containsMatch) return containsMatch.imageUrl

  // 嘗試關鍵詞匹配
  const keywords: Record<string, string[]> = {
    '楓之谷': ['maple', 'story', '新楓之谷'],
    '龍之谷': ['dragon', 'nest', '新龍之谷'],
    '瑪奇': ['mabinogi', '新瑪奇'],
    '艾爾': ['elsword', '艾爾之光'],
    'CS': ['csonline', 'counter', 'strike'],
    '天堂': ['lineage', '天堂'],
    '爆爆': ['getamped', '爆爆王'],
    '救世者': ['tosm', 'tree', 'savior', '救世者'],
    '波拉西亞': ['warsofprasia', '波拉西亞']
  }

  for (const [keyword, aliases] of Object.entries(keywords)) {
    const nameLower = name.toLowerCase()
    const hasKeyword = aliases.some(alias =>
      nameLower.includes(alias.toLowerCase()) ||
      keyword.toLowerCase().includes(nameLower)
    )
    if (hasKeyword) {
      const match = allGameImages.find(g =>
        aliases.some(alias => g.name.toLowerCase().includes(alias.toLowerCase()))
      )
      if (match) return match.imageUrl
    }
  }

  return undefined
}

/**
 * 生成圖片 URL（從 API 返回的圖片名稱）
 * @param imageName 圖片名稱
 * @param region 區域（TW 或 HK），如果提供會使用對應的 CDN
 */
export function generateImageUrl(imageName: string, region?: string): string {
  if (!imageName) return ''

  // 確保使用 HTTPS
  if (imageName.startsWith('http://')) {
    return imageName.replace('http://', 'https://')
  }
  if (imageName.startsWith('https://')) {
    return imageName
  }

  // 根據區域選擇不同的 CDN
  if (region === 'HK') {
    return `https://cdn.hk.beanfun.com/uploaded_images/beanfun/game_zone/${imageName}`
  }
  // 默認使用 TW 區域的 CDN
  return `https://images.beanfun.com/GameZone/${imageName}`
}

/**
 * 獲取遊戲名稱的首字母（用於佔位符）
 */
export function getGameInitials(name: string): string {
  if (!name) return '?'

  // 提取中文字符或英文字母
  const chars = name.match(/[\u4e00-\u9fa5]|[a-zA-Z]/g) || []
  if (chars.length === 0) return name.charAt(0).toUpperCase()

  // 返回前兩個字符
  return chars.slice(0, 2).join('').toUpperCase()
}

/**
 * 獲取遊戲的主色調（用於佔位符背景）
 */
export function getGameColor(serviceCode: string): string {
  const colors: Record<string, string> = {
    '610074': '#4ade80', // 新楓之谷 - 綠色
    'dragonnest': '#f472b6', // 新龍之谷 - 粉色
    'mabinogi': '#fbbf24', // 新瑪奇 - 黃色
    'elsword': '#60a5fa', // 艾爾之光 - 藍色
    'csonline': '#a78bfa', // CS Online - 紫色
    'lineage': '#f87171', // 天堂 - 紅色
    'lineagenew': '#f87171', // 天堂國際服 - 紅色
    'getamped': '#34d399', // 爆爆王 - 綠色
    'tosm': '#22d3ee', // 救世者之樹 - 青色
    'warsofprasia': '#a3e635', // 波拉西亞戰記 - 黃綠色
  }

  return colors[serviceCode] || '#6b7280' // 默認灰色
}
