import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  buildLocaleUrl,
  localePreferenceStorageKey,
  serializeClearedLocaleCookie,
  serializeLocaleCookie,
  systemLocale,
  type Locale,
  type LocalePreference,
} from './locale'
import { readInitialLocaleState } from './browser-locale'
import type { InitialLocaleState } from './browser-locale'
import { messagesFor, type MuseumMessages } from './messages'

interface I18nContextValue {
  readonly locale: Locale
  readonly preference: LocalePreference
  readonly messages: MuseumMessages
  readonly setPreference: (preference: LocalePreference) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)
const systemPreferenceHistoryKey = 'museumSystemLocalePreference'

function historyStateFor(preference: LocalePreference): Record<string, unknown> {
  const currentState =
    window.history.state && typeof window.history.state === 'object'
      ? (window.history.state as Record<string, unknown>)
      : {}
  const nextState = { ...currentState }
  if (preference === 'system') {
    nextState[systemPreferenceHistoryKey] = true
  } else {
    delete nextState[systemPreferenceHistoryKey]
  }
  return nextState
}

function historyFollowsSystem(): boolean {
  return Boolean(
    window.history.state &&
      typeof window.history.state === 'object' &&
      (window.history.state as Record<string, unknown>)[
        systemPreferenceHistoryKey
      ] === true,
  )
}

export function I18nProvider({
  children,
  initialState,
}: {
  readonly children: ReactNode
  readonly initialState?: InitialLocaleState
}) {
  const [state, setState] = useState<InitialLocaleState>(
    () => {
      if (!initialState) {
        return readInitialLocaleState()
      }
      if (typeof window === 'undefined') {
        return initialState
      }
      return historyFollowsSystem()
        ? { locale: initialState.locale, preference: 'system' }
        : initialState
    },
  )

  const setPreference = useCallback((preference: LocalePreference) => {
    const locale =
      preference === 'system'
        ? systemLocale(
            navigator.languages.length > 0
              ? navigator.languages
              : [navigator.language],
          )
        : preference

    try {
      if (preference === 'system') {
        window.localStorage.removeItem(localePreferenceStorageKey)
      } else {
        window.localStorage.setItem(localePreferenceStorageKey, preference)
      }
    } catch {
      // Local storage can be unavailable in privacy modes.
    }
    try {
      document.cookie =
        preference === 'system'
          ? serializeClearedLocaleCookie(window.location.pathname)
          : serializeLocaleCookie(preference, window.location.pathname)
    } catch {
      // Cookie access can be unavailable independently of local storage. The
      // current visit still changes language and receives a shareable path.
    }

    const nextUrl = buildLocaleUrl(window.location.href, locale)
    window.history.replaceState(historyStateFor(preference), '', nextUrl)
    setState({ locale, preference })
  }, [])

  useEffect(() => {
    document.documentElement.lang = state.locale
    document.documentElement.dataset.locale = state.locale
  }, [state.locale])

  useEffect(() => {
    if (state.preference !== 'system') {
      return
    }
    const handleLanguageChange = () => {
      const locale = systemLocale(
        navigator.languages.length > 0
          ? navigator.languages
          : [navigator.language],
      )
      if (locale === state.locale) {
        return
      }
      const nextUrl = buildLocaleUrl(window.location.href, locale)
      window.history.replaceState(window.history.state, '', nextUrl)
      setState((current) =>
        current.preference === 'system' && current.locale !== locale
          ? { locale, preference: 'system' }
          : current,
      )
    }
    handleLanguageChange()
    window.addEventListener('languagechange', handleLanguageChange)
    return () => {
      window.removeEventListener('languagechange', handleLanguageChange)
    }
  }, [state.locale, state.preference])

  const value = useMemo<I18nContextValue>(
    () => ({
      ...state,
      messages: messagesFor(state.locale),
      setPreference,
    }),
    [setPreference, state],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// This hook intentionally shares its context module with the provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider.')
  }
  return context
}
