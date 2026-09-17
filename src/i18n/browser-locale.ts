import {
  isLocale,
  localePreferenceStorageKey,
  resolveLocale,
  type Locale,
  type LocalePreference,
} from './locale'

export interface InitialLocaleState {
  readonly locale: Locale
  readonly preference: LocalePreference
}

function readStoredPreference(): string | null {
  try {
    return window.localStorage.getItem(localePreferenceStorageKey)
  } catch {
    return null
  }
}

export function readInitialLocaleState(): InitialLocaleState {
  const savedPreference = readStoredPreference()
  const resolved = resolveLocale({
    pathname: window.location.pathname,
    savedPreference,
    navigatorLanguages:
      navigator.languages.length > 0
        ? navigator.languages
        : [navigator.language],
  })
  return {
    locale: resolved.locale,
    preference:
      resolved.source === 'path'
        ? resolved.locale
        : isLocale(savedPreference)
          ? savedPreference
          : 'system',
  }
}
