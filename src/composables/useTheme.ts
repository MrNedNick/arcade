import { ref, watch } from 'vue'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'arcade:theme'

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function readSaved(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

const theme = ref<Theme>(readSaved() ?? systemTheme())

watch(
  theme,
  (value) => {
    document.documentElement.dataset.theme = value
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', value === 'light' ? '#f5f6fb' : '#0b0d17')
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      /* private mode: the theme simply isn't remembered */
    }
  },
  { flush: 'sync' },
)

export function useTheme() {
  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }
  return { theme, toggle }
}
