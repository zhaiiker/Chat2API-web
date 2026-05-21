import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import zhCN from './locales/zh-CN.json'
import enUS from './locales/en-US.json'

const resources = {
  'zh-CN': {
    translation: zhCN,
  },
  'en-US': {
    translation: enUS,
  },
}

/**
 * Determine the initial language from persisted zustand store or browser navigator.
 * We no longer use i18next-browser-languagedetector to avoid race conditions
 * with zustand's persist middleware (both writing to localStorage independently).
 */
function getInitialLanguage(): string {
  try {
    const stored = localStorage.getItem('chat2api-settings')
    if (stored) {
      const parsed = JSON.parse(stored)
      const lang = parsed?.state?.language
      if (lang === 'zh-CN' || lang === 'en-US') {
        return lang
      }
    }
  } catch {
    // ignore parse errors
  }

  // Fallback: detect from browser navigator
  const navLang = navigator.language || ''
  if (navLang.startsWith('zh')) return 'zh-CN'
  return 'en-US'
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'en-US',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
