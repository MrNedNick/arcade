import { createApp } from 'vue'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/jetbrains-mono'
import './styles/tokens.css'
import './styles/base.css'
import App from './App.vue'
import { router } from './router'

createApp(App).use(router).mount('#app')

// Offline support: the service worker exists only in the production build.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
}
