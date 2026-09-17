import { animalIdPattern } from './content/types'
import { isLocale, type Locale, type LocalePreference } from './i18n/locale'

export const appBootstrapElementId = 'museum-bootstrap'

export type AppPageKind = 'museum' | 'animal-detail'

export interface InitialAppState {
  readonly animalId: string
  readonly locale: Locale
  readonly pageKind: AppPageKind
  readonly preference: LocalePreference
  readonly rootFallback?: boolean
}

export function animalDetailIdFromPath(pathname: string): string | null {
  const match = pathname.match(
    /(?:^|\/)(?:zh-CN|en)\/animals\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/|$)/,
  )
  return match?.[1] && animalIdPattern.test(match[1]) ? match[1] : null
}

export function readInitialAppState(
  source: Pick<Document, 'getElementById'> = document,
): InitialAppState | null {
  const element = source.getElementById(appBootstrapElementId)
  if (!element?.textContent) {
    return null
  }

  try {
    const value: unknown = JSON.parse(element.textContent)
    if (!value || typeof value !== 'object') {
      return null
    }
    const candidate = value as Record<string, unknown>
    if (
      typeof candidate.animalId !== 'string' ||
      !animalIdPattern.test(candidate.animalId) ||
      !isLocale(candidate.locale) ||
      (candidate.pageKind !== 'museum' &&
        candidate.pageKind !== 'animal-detail') ||
      (candidate.preference !== 'system' &&
        !isLocale(candidate.preference)) ||
      (candidate.rootFallback !== undefined &&
        typeof candidate.rootFallback !== 'boolean') ||
      (candidate.rootFallback === true && candidate.pageKind !== 'museum')
    ) {
      return null
    }
    return {
      animalId: candidate.animalId,
      locale: candidate.locale,
      pageKind: candidate.pageKind,
      preference: candidate.preference,
      ...(candidate.rootFallback === true ? { rootFallback: true } : {}),
    }
  } catch {
    return null
  }
}
