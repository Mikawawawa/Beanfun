<script setup lang="ts">
/**
 * Login shell — the WPF `LoginPage.xaml` equivalent.
 *
 * The glass-panel IS the window body. Tauri runs with
 * `decorations: false` + `transparent: true` so only the rounded
 * card is visible. TitleBar provides drag + minimize / close.
 */

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import TitleBar from '../components/TitleBar.vue'
import { useConfigStore } from '../stores/config'
import type { LoginRegion } from '../types/bindings'

defineOptions({ name: 'LoginPage' })

const route = useRoute()
const router = useRouter()
const config = useConfigStore()

const currentRegion = computed(() => (config.get('loginRegion') as LoginRegion | undefined) ?? 'TW')

/** True when we're on the region picker itself — hide the switcher there. */
const isRegionPage = computed(() => route.name === 'login-region')

async function toggleRegion(): Promise<void> {
  const next: LoginRegion = currentRegion.value === 'TW' ? 'HK' : 'TW'
  await config.set('loginRegion', next)

  // Close any open GamePass window
  try {
    const gpWin = await WebviewWindow.getByLabel('gamepass-login')
    if (gpWin) await gpWin.close()
  } catch {
    /* Window may not exist — safe to ignore */
  }

  // Navigate back to id-pass so any active QR/GamePass session is abandoned
  if (route.path !== '/login/id-pass') {
    await router.replace('/login/id-pass')
  }
}

function handleOpenSettings(): void {
  void router.push('/settings')
}

function handleOpenAbout(): void {
  void router.push('/about')
}
</script>

<template>
  <section class="login-shell" data-window-root>
    <TitleBar>
      <button
        v-if="!isRegionPage"
        type="button"
        class="login-shell__region-btn"
        :title="`Region: ${currentRegion}`"
        @click="toggleRegion"
      >
        <span class="material-symbols-outlined login-shell__region-icon">public</span>
        <span class="login-shell__region-label">{{ currentRegion }}</span>
      </button>
      <button type="button" class="login-shell__action-btn" @click="handleOpenSettings">
        <span class="material-symbols-outlined">settings</span>
      </button>
      <button type="button" class="login-shell__action-btn" @click="handleOpenAbout">
        <span class="material-symbols-outlined">info</span>
      </button>
    </TitleBar>
    <div class="login-shell__body">
      <div class="login-shell__content" data-window-content>
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="currentRegion" />
          </Transition>
        </RouterView>
      </div>
    </div>
  </section>
</template>

<style scoped>
.login-shell {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.login-shell__body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1.5rem;
}

.login-shell__action-btn {
  appearance: none;
  background: transparent;
  border: none;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  cursor: pointer;
  color: #666666;
  transition: background 150ms ease;
  padding: 0;
}
.login-shell__action-btn .material-symbols-outlined {
  font-size: 18px;
}
.login-shell__action-btn:hover {
  background: #f5f5f5;
}

.login-shell__region-btn {
  appearance: none;
  background: #f5f5f5;
  border: 1px solid #e5e5e5;
  height: 26px;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0 0.5rem 0 0.25rem;
  border-radius: 6px;
  cursor: pointer;
  color: #000000;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  transition: background 150ms ease;
}
.login-shell__region-icon {
  font-size: 14px;
}
.login-shell__region-btn:hover {
  background: #efefef;
}

/* Page transition animations */
.page-enter-active,
.page-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
