import { useCallback, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

const STORAGE_KEY = 'anypay.voice'
const listeners = new Set<() => void>()

// Web Speech voices are named by BCP 47 tag; South African variants first.
const SPEECH_LANG: Record<string, string> = { en: 'en-ZA', zu: 'zu-ZA', xh: 'xh-ZA', nso: 'nso-ZA' }

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

function writeEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // Not remembered; still works for this visit.
  }
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const isSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

/**
 * "Payment received, R25": the shop hears each payment without looking at the phone, like the
 * soundboxes market traders use. Off by default; turning it on is the tap browsers require
 * before a page may speak. Falls back to English when the phone has no voice for the language.
 */
export function useVoiceConfirm() {
  const { i18n } = useTranslation()
  const enabled = useSyncExternalStore(subscribe, readEnabled, () => false)
  const supported = isSupported()

  const announce = useCallback(
    (key: 'merchant.voice.received', values: { amount: string }) => {
      if (!enabled || !supported) return
      const lang = SPEECH_LANG[i18n.resolvedLanguage ?? 'en'] ?? 'en-ZA'
      const hasVoice = speechSynthesis
        .getVoices()
        .some((voice) => voice.lang.toLowerCase().startsWith(lang.slice(0, 2)))
      const speakIn = hasVoice ? i18n.resolvedLanguage : 'en'
      const utterance = new SpeechSynthesisUtterance(i18n.getFixedT(speakIn ?? 'en')(key, values))
      utterance.lang = hasVoice ? lang : 'en-ZA'
      speechSynthesis.speak(utterance)
    },
    [enabled, supported, i18n],
  )

  return { enabled, supported, setEnabled: writeEnabled, announce }
}
