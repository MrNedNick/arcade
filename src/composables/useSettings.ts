import { reactive, watch } from 'vue'
import { readJSON, writeJSON } from '@/engine/storage'

export interface Settings {
  /** Player name used on the top players board. Empty until the first record. */
  name: string
  sound: boolean
  /** Short vibrations on phones that support them. */
  haptics: boolean
}

const KEY = 'arcade:settings'
const DEFAULTS: Settings = { name: '', sound: true, haptics: true }

const settings = reactive<Settings>({ ...DEFAULTS, ...readJSON<Partial<Settings>>(KEY, {}) })

watch(settings, (value) => writeJSON(KEY, value), { deep: true })

export const MAX_NAME = 16

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME)
}

export function useSettings() {
  return settings
}
