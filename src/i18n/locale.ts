export const supportedLocales = ['zh-CN', 'en'] as const

export type Locale = (typeof supportedLocales)[number]
export type LocalePreference = Locale | 'system'
export type LocaleSource = 'path' | 'saved' | 'system'

export const localePreferenceStorageKey = 'museum.locale'
export const localeCookieName = 'museum_locale'
export const localeCookieMaxAgeSeconds = 31_536_000

export interface LocaleResolutionInput {
  readonly pathname: string
  readonly savedPreference: string | null | undefined
  readonly navigatorLanguages: readonly string[]
}

export interface LocaleResolution {
  readonly locale: Locale
  readonly source: LocaleSource
}

export function isLocale(value: unknown): value is Locale {
  return value === 'zh-CN' || value === 'en'
}

export function localeCookiePath(pathname: string): string {
  const normalisedPath = pathname.replace(/\/index\.html\/?$/, '/')
  const withoutTrailingSlash = (path: string) =>
    path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
  const localizedPath = normalisedPath.match(
    /^(.*\/)(?:zh-CN|en)(?:\/|$)/,
  )
  if (localizedPath?.[1]) {
    return withoutTrailingSlash(localizedPath[1])
  }
  if (normalisedPath.endsWith('/')) {
    return withoutTrailingSlash(normalisedPath)
  }
  return normalisedPath || '/'
}

export function serializeLocaleCookie(
  locale: Locale,
  pathname: string,
): string {
  return `${localeCookieName}=${locale}; Max-Age=${localeCookieMaxAgeSeconds}; Path=${localeCookiePath(pathname)}; SameSite=Lax; Secure`
}

export function serializeClearedLocaleCookie(pathname: string): string {
  return `${localeCookieName}=; Max-Age=0; Path=${localeCookiePath(pathname)}; SameSite=Lax; Secure`
}

export function localeFromPath(pathname: string): Locale | null {
  const match = pathname.match(/(?:^|\/)(zh-CN|en)(?:\/|$)/)
  return match && isLocale(match[1]) ? match[1] : null
}

export function systemLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const normalizedLanguage = language.trim().toLowerCase()
    if (
      normalizedLanguage === 'zh' ||
      normalizedLanguage.startsWith('zh-')
    ) {
      return 'zh-CN'
    }
    if (
      normalizedLanguage === 'en' ||
      normalizedLanguage.startsWith('en-')
    ) {
      return 'en'
    }
  }
  return 'zh-CN'
}

export function resolveLocale({
  pathname,
  savedPreference,
  navigatorLanguages,
}: LocaleResolutionInput): LocaleResolution {
  const pathLocale = localeFromPath(pathname)
  if (pathLocale) {
    return { locale: pathLocale, source: 'path' }
  }

  if (isLocale(savedPreference)) {
    return { locale: savedPreference, source: 'saved' }
  }

  return { locale: systemLocale(navigatorLanguages), source: 'system' }
}

function rootPathFor(pathname: string): string {
  const normalisedPath = pathname.replace(/\/index\.html\/?$/, '/')
  const localeSuffix = normalisedPath.match(/^(.*\/)(?:zh-CN|en)\/?$/)
  if (localeSuffix?.[1]) {
    return localeSuffix[1]
  }

  if (normalisedPath.endsWith('/')) {
    return normalisedPath
  }
  return `${normalisedPath}/`
}

export function buildLocaleUrl(
  currentUrl: string,
  preference: LocalePreference,
): string {
  const url = new URL(currentUrl, 'http://localhost')
  const normalisedPath = url.pathname.replace(/\/index\.html\/?$/, '/')
  const localeSegment = normalisedPath.match(
    /^(.*\/)(?:zh-CN|en)(\/.*|\/$)/,
  )
  if (localeSegment?.[1] && localeSegment[2]) {
    url.pathname =
      preference === 'system'
        ? `${localeSegment[1]}${localeSegment[2].slice(1)}`
        : `${localeSegment[1]}${preference}${localeSegment[2]}`
    return `${url.pathname}${url.search}${url.hash}`
  }

  const rootPath = rootPathFor(url.pathname)
  url.pathname =
    preference === 'system' ? rootPath : `${rootPath}${preference}/`
  return `${url.pathname}${url.search}${url.hash}`
}
