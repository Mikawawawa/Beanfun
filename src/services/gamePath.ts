/**
 * Game path management service — abstracts the path detection and
 * configuration logic for multiple games.
 *
 * Each game needs its executable path resolved before it can be launched.
 * This service wraps the backend `detect_game_path` and `set_game_path`
 * commands with a frontend-friendly caching layer.
 *
 * Path resolution follows the WPF parity order:
 * 1. Config.xml cached value (fast path)
 * 2. Windows registry lookup via `dir_reg` (fallback)
 * 3. User manual selection (last resort)
 */

import { commands } from '../types/bindings'
import type { GameIniEntry } from '../types/bindings'

export type PathState = 'checking' | 'installed' | 'not-installed'

interface GamePathCache {
  path: string | null
  state: PathState
  checkedAt: number
}

const cache = new Map<string, GamePathCache>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function cacheKey(gameCode: string, dirValueName: string): string {
  return `${dirValueName}.${gameCode}`
}

/**
 * Get the install path for a game, checking cache first.
 *
 * Flow:
 * 1. Return cached value if present and fresh
 * 2. Call backend `detect_game_path` (Config → Registry)
 * 3. Cache and return the result
 */
export async function getPath(
  gameCode: string,
  ini: GameIniEntry,
): Promise<string | null> {
  const key = cacheKey(gameCode, ini.dir_value_name)
  const cached = cache.get(key)

  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    return cached.path
  }

  const result = await commands.detectGamePath(
    gameCode,
    ini.dir_value_name,
    ini.dir_reg,
  )

  console.log('detectGamePath result:', result)
  const path = result.status === 'ok' ? result.data : null
  console.log('Extracted path:', path)

  cache.set(key, {
    path,
    state: path ? 'installed' : 'not-installed',
    checkedAt: Date.now(),
  })

  return path
}

/**
 * Check if a game is installed (path is resolved and valid).
 */
export async function isInstalled(
  gameCode: string,
  ini: GameIniEntry,
): Promise<boolean> {
  const path = await getPath(gameCode, ini)
  return path !== null
}

/**
 * Get the current path state without triggering a backend call
 * if already cached.
 */
export function getCachedState(gameCode: string, ini: GameIniEntry): PathState {
  const key = cacheKey(gameCode, ini.dir_value_name)
  const cached = cache.get(key)

  if (!cached) return 'checking'
  if (Date.now() - cached.checkedAt >= CACHE_TTL_MS) return 'checking'
  return cached.state
}

/**
 * Manually set the game path (user-selected via file picker).
 * Updates both backend Config.xml and local cache.
 */
export async function setPath(
  gameCode: string,
  dirValueName: string,
  path: string,
): Promise<void> {
  await commands.setGamePath(gameCode, dirValueName, path)

  const key = cacheKey(gameCode, dirValueName)
  cache.set(key, {
    path,
    state: 'installed',
    checkedAt: Date.now(),
  })
}

/**
 * Clear the path cache for a specific game or all games.
 */
export function clearCache(gameCode?: string, dirValueName?: string): void {
  if (gameCode && dirValueName) {
    cache.delete(cacheKey(gameCode, dirValueName))
  } else {
    cache.clear()
  }
}

/**
 * Open a file dialog for the user to select the game executable.
 * Returns the selected path or null if cancelled.
 * 
 * Uses Tauri's dialog plugin.
 */
export async function selectGamePath(): Promise<string | null> {
  // Use Tauri's dialog plugin
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({
    filters: [{
      name: 'Executable',
      extensions: ['exe']
    }]
  })
  return selected as string | null
}
