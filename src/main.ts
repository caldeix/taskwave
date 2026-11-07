import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import './styles/main.css'

/**
 * Frame-busting (step-27, R-3): sin cabeceras HTTP en GitHub Pages no hay `frame-ancestors`, así
 * que si otra web mete la app en un iframe (clickjacking), se sale de él y no se monta dentro.
 */
function framed(): boolean {
  if (window.top === window.self) return false
  try {
    window.top!.location.href = window.location.href
  } catch {
    document.documentElement.innerHTML = ''
  }
  return true
}

if (!framed()) createApp(App).use(createPinia()).use(router).use(i18n).mount('#app')
